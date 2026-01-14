// Lambda: Delete User Data (Admin/Debug Only)
// Deletes all data for a specific user from DynamoDB and S3
// Security: Only deletes data belonging to the specified userId

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE;
const IMAGES_BUCKET = process.env.IMAGES_BUCKET;

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

/**
 * Delete all transactions for a user from DynamoDB
 * Security: Uses userId as partition key filter
 */
async function deleteUserTransactions(userId) {
  console.log('[DeleteData] Deleting transactions for userId:', userId);

  // Step 1: Query all transactions for this user
  const queryParams = {
    TableName: TRANSACTIONS_TABLE,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId,
    },
    ProjectionExpression: 'userId, transactionId', // Only fetch keys
  };

  let allItems = [];
  let lastEvaluatedKey = null;

  do {
    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await docClient.send(new QueryCommand(queryParams));
    allItems = allItems.concat(result.Items || []);
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`[DeleteData] Found ${allItems.length} transactions to delete`);

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
    console.log(`[DeleteData] Deleted batch ${i / batchSize + 1}, total: ${deletedCount}`);
  }

  return deletedCount;
}

/**
 * Delete all images for a user from S3
 * Security: Uses userId prefix to filter objects
 */
async function deleteUserImages(userId) {
  console.log('[DeleteData] Deleting images for userId:', userId);

  // Step 1: List all objects with userId prefix
  // S3 key format: uploads/{userId}/{timestamp}/{uuid}.jpg
  const prefix = `uploads/${userId}/`;

  let allObjects = [];
  let continuationToken = null;

  do {
    const listParams = {
      Bucket: IMAGES_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    };

    const result = await s3Client.send(new ListObjectsV2Command(listParams));

    if (result.Contents) {
      allObjects = allObjects.concat(result.Contents);
    }

    continuationToken = result.NextContinuationToken;
  } while (continuationToken);

  console.log(`[DeleteData] Found ${allObjects.length} images to delete`);

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
    console.log(`[DeleteData] Deleted S3 batch ${i / batchSize + 1}, total: ${deletedCount}`);
  }

  return deletedCount;
}

/**
 * Lambda handler
 * POST /admin/delete-data
 * Body: { userId: string, types: ['transactions', 'images'] }
 */
export async function handler(event) {
  console.log('[DeleteData] Event:', JSON.stringify(event, null, 2));

  // Handle OPTIONS for CORS
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { userId, types } = body;

    // Validate input
    if (!userId || typeof userId !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing or invalid userId',
        }),
      };
    }

    if (!Array.isArray(types) || types.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing or invalid types (must be non-empty array)',
        }),
      };
    }

    // Validate types
    const validTypes = ['transactions', 'images'];
    const invalidTypes = types.filter((t) => !validTypes.includes(t));
    if (invalidTypes.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: `Invalid types: ${invalidTypes.join(', ')}. Valid: ${validTypes.join(', ')}`,
        }),
      };
    }

    console.log(`[DeleteData] Deleting data for userId: ${userId}, types: ${types.join(', ')}`);

    // Delete data based on types
    const result = {
      userId,
      deleted: {},
    };

    if (types.includes('transactions')) {
      result.deleted.transactions = await deleteUserTransactions(userId);
    }

    if (types.includes('images')) {
      result.deleted.images = await deleteUserImages(userId);
    }

    console.log('[DeleteData] Result:', result);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('[DeleteData] Error:', error);

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
