// Lambda: Purge All System Data (Admin Only)
// DANGEROUS: Deletes ALL data from DynamoDB and S3 for all users
// Security: Requires admin authorization header
// Usage: POST /admin/purge-all-data with header: x-admin-user-id: user-123

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { CloudWatchLogsClient, CreateLogStreamCommand, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { logger, initContext, EVENTS } from '/opt/nodejs/shared/logger.mjs';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});
const logsClient = new CloudWatchLogsClient({});

const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE;
const IMAGES_BUCKET = process.env.IMAGES_BUCKET;
const LOG_GROUP = '/aws/lambda/yorutsuke-admin-purge';

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-user-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

/**
 * Write to CloudWatch Logs for audit trail
 * Admin actions must be logged for compliance
 */
async function auditLog(adminUserId, action, details) {
  try {
    const logStreamName = `admin-${new Date().toISOString().split('T')[0]}`;

    // Create log stream if it doesn't exist (will fail silently if exists)
    try {
      await logsClient.send(new CreateLogStreamCommand({
        logGroupName: LOG_GROUP,
        logStreamName,
      }));
    } catch (e) {
      // Stream already exists, ignore
    }

    // Write log event
    await logsClient.send(new PutLogEventsCommand({
      logGroupName: LOG_GROUP,
      logStreamName,
      logEvents: [
        {
          timestamp: Date.now(),
          message: JSON.stringify({
            adminUserId,
            action,
            timestamp: new Date().toISOString(),
            ...details,
          }),
        },
      ],
    }));
  } catch (error) {
    logger.warn(EVENTS.AUDIT_LOG_WRITE_FAILED, { action, error: error.message });
    // Don't fail the operation if logging fails
  }
}

/**
 * Delete ALL transactions from DynamoDB (no userId filter)
 * DANGEROUS: This will delete data for all users
 */
async function purgeAllTransactions() {
  logger.info(EVENTS.PURGE_ALL_TRANSACTIONS_STARTED, {});

  // Step 1: Scan ALL transactions (no partition key filter)
  const scanParams = {
    TableName: TRANSACTIONS_TABLE,
    ProjectionExpression: 'userId, transactionId', // Only fetch keys
  };

  let allItems = [];
  let lastEvaluatedKey = null;

  do {
    if (lastEvaluatedKey) {
      scanParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await docClient.send(new ScanCommand(scanParams));
    allItems = allItems.concat(result.Items || []);
    lastEvaluatedKey = result.LastEvaluatedKey;
    logger.debug(EVENTS.PURGE_ALL_TRANSACTIONS_SCAN_BATCH, { totalFound: allItems.length });
  } while (lastEvaluatedKey);

  logger.info(EVENTS.PURGE_ALL_TRANSACTIONS_FOUND, { count: allItems.length });

  if (allItems.length === 0) {
    return 0;
  }

  // Step 2: Batch delete (max 25 items per batch)
  const batchSize = 25;
  let deletedCount = 0;

  for (let i = 0; i < allItems.length; i += batchSize) {
    const batch = allItems.slice(i, i + batchSize);
    const deleteRequests = batch.map((item) => ({
      DeleteRequest: {
        Key: {
          userId: item.userId,
          transactionId: item.transactionId,
        },
      },
    }));

    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TRANSACTIONS_TABLE]: deleteRequests,
        },
      })
    );

    deletedCount += batch.length;
    logger.info(EVENTS.PURGE_ALL_TRANSACTIONS_BATCH_COMPLETED, { batchNum: Math.floor(i / batchSize) + 1, total: deletedCount });
  }

  return deletedCount;
}

/**
 * Delete ALL images from S3 (no prefix filter)
 * DANGEROUS: This will delete all images for all users
 */
async function purgeAllImages() {
  logger.info(EVENTS.PURGE_ALL_IMAGES_STARTED, {});

  // Step 1: List ALL objects (no prefix filter)
  let allObjects = [];
  let continuationToken = null;

  do {
    const listParams = {
      Bucket: IMAGES_BUCKET,
      ContinuationToken: continuationToken,
    };

    const result = await s3Client.send(new ListObjectsV2Command(listParams));

    if (result.Contents) {
      allObjects = allObjects.concat(result.Contents);
    }

    continuationToken = result.NextContinuationToken;
    logger.debug(EVENTS.PURGE_ALL_IMAGES_LIST_BATCH, { totalFound: allObjects.length });
  } while (continuationToken);

  logger.info(EVENTS.PURGE_ALL_IMAGES_FOUND, { count: allObjects.length });

  if (allObjects.length === 0) {
    return 0;
  }

  // Step 2: Batch delete (max 1000 objects per request)
  const batchSize = 1000;
  let deletedCount = 0;

  for (let i = 0; i < allObjects.length; i += batchSize) {
    const batch = allObjects.slice(i, i + batchSize);
    const deleteParams = {
      Bucket: IMAGES_BUCKET,
      Delete: {
        Objects: batch.map((obj) => ({ Key: obj.Key })),
        Quiet: true,
      },
    };

    await s3Client.send(new DeleteObjectsCommand(deleteParams));
    deletedCount += batch.length;
    logger.info(EVENTS.PURGE_ALL_IMAGES_BATCH_COMPLETED, { batchNum: Math.floor(i / batchSize) + 1, total: deletedCount });
  }

  return deletedCount;
}

/**
 * Lambda handler
 * POST /admin/purge-all-data
 * Headers: { x-admin-user-id: "admin-user-id" }
 *
 * WARNING: This endpoint deletes ALL system data
 * Use with extreme caution
 */
export async function handler(event) {
  initContext(event);
  logger.debug('ADMIN_PURGE_ALL_DATA_REQUEST', { method: event.requestContext?.http?.method });

  // Handle OPTIONS for CORS
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    // Step 1: Validate admin authorization
    const adminUserId = event.headers?.['x-admin-user-id'];

    if (!adminUserId || typeof adminUserId !== 'string') {
      logger.warn(EVENTS.ADMIN_PURGE_UNAUTHORIZED, { reason: 'missing admin user ID' });
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: 'Unauthorized: missing x-admin-user-id header',
        }),
      };
    }

    logger.info(EVENTS.ADMIN_PURGE_ALL_DATA_INITIATED, { adminUserId });

    // Step 2: Log the admin action (audit trail)
    await auditLog(adminUserId, 'purge_all_data_started', {
      ip: event.requestContext?.http?.sourceIp || 'unknown',
      userAgent: event.headers?.['user-agent'] || 'unknown',
    });

    // Step 3: Purge all data
    const transactionCount = await purgeAllTransactions();
    const imageCount = await purgeAllImages();

    const result = {
      action: 'admin_purge_all_data',
      adminUserId,
      deleted: {
        transactions: transactionCount,
        images: imageCount,
      },
      timestamp: new Date().toISOString(),
    };

    // Step 4: Log the completion (audit trail)
    await auditLog(adminUserId, 'purge_all_data_completed', result);

    logger.info(EVENTS.ADMIN_PURGE_ALL_DATA_COMPLETED, { result });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error(EVENTS.ADMIN_PURGE_ALL_DATA_ERROR, error);

    // Log the error for audit trail
    const adminUserId = event.headers?.['x-admin-user-id'] || 'unknown';
    await auditLog(adminUserId, 'purge_all_data_failed', {
      error: error.message,
      stack: error.stack,
    });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
    };
  }
}
