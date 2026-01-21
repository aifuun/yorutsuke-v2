/**
 * Diagnostic Lambda (Phase 4 - P2)
 *
 * Collects diagnostic information from local app and cloud (DynamoDB, S3, CloudWatch),
 * generates a comprehensive JSON report, and uploads to S3 with a presigned URL.
 *
 * Supports:
 * - Guest users (device-*): Local data only
 * - Authenticated users (user-*): Local + cloud data
 * - Presigned S3 URLs (7-day expiry)
 * - CloudWatch Logs integration
 *
 * @ai-intent: Enable support team to troubleshoot user issues with comprehensive diagnostic data
 */

import {
  DynamoDBClient,
  ScanCommand,
  type ScanCommandInput,
} from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
  type FilterLogEventsCommandInput,
} from '@aws-sdk/client-cloudwatch-logs';
import { nanoid } from 'nanoid';
import { logger, EVENTS, initContext } from '/opt/nodejs/shared/logger.mjs';
import type {
  LambdaEvent,
  LambdaContext,
  LambdaResponse,
} from './types/lambda-events.js';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const s3Client = new S3Client({ region: 'us-east-1' });
const logsClient = new CloudWatchLogsClient({ region: 'us-east-1' });

const DIAGNOSTICS_BUCKET = process.env.DIAGNOSTICS_BUCKET;
const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE;
const MAX_CLOUD_TRANSACTIONS = parseInt(
  process.env.MAX_CLOUD_TRANSACTIONS || '50',
  10
);
const MAX_CLOUD_LOGS = parseInt(process.env.MAX_CLOUD_LOGS || '100', 10);
const CLOUD_LOGS_LOOKBACK_HOURS = parseInt(
  process.env.CLOUD_LOGS_LOOKBACK_HOURS || '24',
  10
);

/**
 * User type classification
 */
type UserType = 'guest' | 'authenticated' | null;

/**
 * Local diagnostic data (from Tauri app)
 */
interface LocalData {
  images: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/**
 * Cloud diagnostic data (from AWS)
 */
interface CloudData {
  transactions: Array<Record<string, unknown>>;
  images: Array<Record<string, unknown>>;
  cloudWatchLogs: Array<Record<string, unknown>>;
  errors: Array<string>;
}

/**
 * Report generation result
 */
interface ReportResult {
  reportId: string;
  s3Url: string;
  timestamp: string;
  fileSize: number;
}

/**
 * Determine user type from userId
 */
function getUserType(userId: string): UserType {
  if (userId.startsWith('device-')) return 'guest';
  if (userId.startsWith('user-')) return 'authenticated';
  return null;
}

/**
 * Collect cloud data (DynamoDB + CloudWatch Logs)
 * Only available for authenticated users
 */
async function collectCloudData(
  userId: string,
  traceId: string
): Promise<CloudData> {
  const transactions: Array<Record<string, unknown>> = [];
  const cloudWatchLogs: Array<Record<string, unknown>> = [];
  const errors: Array<string> = [];

  try {
    logger.info(EVENTS.DIAGNOSTIC_COLLECTING_CLOUD_DATA, { traceId, userId });

    // 1. Query DynamoDB transactions
    try {
      const scanParams: ScanCommandInput = {
        TableName: TRANSACTIONS_TABLE,
        FilterExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': { S: userId },
        },
        Limit: MAX_CLOUD_TRANSACTIONS * 2,
      };

      const scanResult = await dynamoClient.send(new ScanCommand(scanParams));

      if (scanResult.Items) {
        for (const item of scanResult.Items) {
          const unmarshalled = unmarshall(item);
          transactions.push(unmarshalled);
          if (transactions.length >= MAX_CLOUD_TRANSACTIONS) break;
        }
      }

      logger.debug('DIAGNOSTIC_DYNAMODB_QUERY_SUCCESS', {
        traceId,
        count: transactions.length,
      });
    } catch (dynamoError: unknown) {
      const errorMessage =
        dynamoError instanceof Error
          ? dynamoError.message
          : 'Unknown DynamoDB error';
      logger.error('DIAGNOSTIC_DYNAMODB_ERROR', {
        traceId,
        error: errorMessage,
      });
      errors.push(`DynamoDB: ${errorMessage}`);
    }

    // 2. Fetch CloudWatch Logs
    try {
      const logsParams: FilterLogEventsCommandInput = {
        logGroupName: `/aws/lambda/${process.env.AWS_LAMBDA_FUNCTION_NAME}`,
        startTime: Date.now() - CLOUD_LOGS_LOOKBACK_HOURS * 60 * 60 * 1000,
        filterPattern: `"${userId}"`,
        limit: MAX_CLOUD_LOGS * 2,
      };

      const logsResult = await logsClient.send(
        new FilterLogEventsCommand(logsParams)
      );

      if (logsResult.events) {
        for (const event of logsResult.events) {
          if (!event.message) continue;

          try {
            const parsed = JSON.parse(event.message);
            cloudWatchLogs.push({
              timestamp: event.timestamp,
              message: parsed,
            });
          } catch {
            cloudWatchLogs.push({
              timestamp: event.timestamp,
              message: event.message,
            });
          }

          if (cloudWatchLogs.length >= MAX_CLOUD_LOGS) break;
        }
      }

      logger.debug('DIAGNOSTIC_CLOUDWATCH_QUERY_SUCCESS', {
        traceId,
        count: cloudWatchLogs.length,
      });
    } catch (logsError: unknown) {
      const errorMessage =
        logsError instanceof Error ? logsError.message : 'Unknown CloudWatch error';
      logger.error('DIAGNOSTIC_CLOUDWATCH_ERROR', {
        traceId,
        error: errorMessage,
      });
      errors.push(`CloudWatch: ${errorMessage}`);
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('DIAGNOSTIC_CLOUD_COLLECTION_ERROR', {
      traceId,
      error: errorMessage,
    });
    errors.push(`General: ${errorMessage}`);
  }

  return {
    transactions,
    images: [],
    cloudWatchLogs,
    errors,
  };
}

/**
 * Generate diagnostic report and upload to S3
 * Returns presigned URL (7-day expiry)
 */
async function generateAndUploadReport(
  userId: string,
  localData: LocalData,
  cloudData: CloudData,
  traceId: string
): Promise<ReportResult> {
  const reportId = `diag-${nanoid()}`;
  const timestamp = new Date().toISOString();

  const reportData = {
    reportId,
    timestamp,
    userId,
    local: localData,
    cloud: cloudData,
  };

  const reportJson = JSON.stringify(reportData, null, 2);
  const fileSize = Buffer.byteLength(reportJson, 'utf8');

  logger.info(EVENTS.DIAGNOSTIC_UPLOADING_TO_S3, {
    traceId,
    userId,
    reportId,
    fileSize,
  });

  // Upload to S3
  const s3Key = `${userId}/${reportId}.json`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: DIAGNOSTICS_BUCKET,
      Key: s3Key,
      Body: reportJson,
      ContentType: 'application/json',
    })
  );

  // Generate presigned URL (7-day expiry)
  const s3Url = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: DIAGNOSTICS_BUCKET,
      Key: s3Key,
    }),
    {
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
    }
  );

  logger.info(EVENTS.DIAGNOSTIC_UPLOAD_SUCCESS, {
    traceId,
    userId,
    reportId,
    s3Url: s3Url.substring(0, 100), // Truncate for logging
  });

  return {
    reportId,
    s3Url,
    timestamp,
    fileSize,
  };
}

/**
 * Create error response with CORS headers
 */
function createErrorResponse(
  error: string,
  traceId: string,
  statusCode = 500
): LambdaResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify({
      success: false,
      error,
      traceId,
    }),
  };
}

/**
 * Create success response with CORS headers
 */
function createSuccessResponse(
  result: ReportResult,
  traceId: string
): LambdaResponse {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify({
      success: true,
      ...result,
      traceId,
    }),
  };
}

/**
 * Lambda handler
 * Processes diagnostic export requests from Tauri app
 */
export async function handler(
  event: LambdaEvent,
  context: LambdaContext
): Promise<LambdaResponse> {
  let traceId = 'trace-unknown';

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
    const userId = body.userId as string;
    const localData = body.localData as LocalData;
    traceId = (body.traceId as string) || `trace-${nanoid()}`;

    const ctx = initContext({ traceId });

    logger.info(EVENTS.DIAGNOSTIC_EXPORT_START, {
      traceId,
      userId,
      userType: getUserType(userId),
      attempt: 1,
    });

    // Validate userId format
    const userType = getUserType(userId);
    if (!userType) {
      logger.error('DIAGNOSTIC_INVALID_USER_ID', { traceId, userId });
      return createErrorResponse('Invalid userId format', traceId, 400);
    }

    // Collect cloud data (only for authenticated users)
    let cloudData: CloudData = {
      transactions: [],
      images: [],
      cloudWatchLogs: [],
      errors: [],
    };

    if (userType === 'authenticated') {
      cloudData = await collectCloudData(userId, traceId);
    } else {
      logger.debug('DIAGNOSTIC_GUEST_USER_SKIP_CLOUD', { traceId, userId });
    }

    // Generate report and upload to S3
    const result = await generateAndUploadReport(
      userId,
      localData,
      cloudData,
      traceId
    );

    logger.info(EVENTS.DIAGNOSTIC_EXPORT_SUCCESS, {
      traceId,
      userId,
      reportId: result.reportId,
      fileSize: result.fileSize,
    });

    return createSuccessResponse(result, traceId);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error(EVENTS.DIAGNOSTIC_EXPORT_ERROR, {
      traceId,
      error: errorMessage,
      stack: errorStack,
    });

    return createErrorResponse('Failed to generate diagnostic report', traceId);
  }
}
