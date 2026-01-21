/**
 * Admin Stats Lambda (Phase 3 - P1)
 *
 * Returns dashboard metrics for admin panel:
 * - Emergency stop status
 * - Image counts (today + total)
 * - Active users today
 * - Batch process CloudWatch metrics
 *
 * All operations run in parallel for fast response times.
 */

import { DynamoDBClient, ScanCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { logger, initContext, EVENTS } from '/opt/nodejs/shared/logger.mjs';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from './types/aws-events.js';

const ddb = new DynamoDBClient({});
const s3 = new S3Client({});
const cloudwatch = new CloudWatchClient({});

const CONTROL_TABLE = process.env.CONTROL_TABLE_NAME;
const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE_NAME;
const QUOTAS_TABLE = process.env.QUOTAS_TABLE_NAME;
const IMAGE_BUCKET = process.env.IMAGE_BUCKET_NAME;

/**
 * Emergency stop status
 */
interface EmergencyStatus {
  emergencyStop: boolean;
  reason: string | null;
  updatedAt: string | null;
}

/**
 * Image counts
 */
interface ImageCounts {
  today: number;
  total: number;
}

/**
 * Batch metrics
 */
interface BatchMetrics {
  invocations: number;
  errors: number;
  lastRun: string | null;
}

/**
 * Stats response
 */
interface StatsResponse {
  emergency: EmergencyStatus;
  images: ImageCounts;
  activeUsers: number;
  batch: BatchMetrics;
  generatedAt: string;
}

/**
 * Get today's date in JST (YYYY-MM-DD)
 */
function getTodayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

/**
 * Get emergency stop status
 */
async function getEmergencyStatus(): Promise<EmergencyStatus> {
  try {
    const result = await ddb.send(
      new GetItemCommand({
        TableName: CONTROL_TABLE,
        Key: { key: { S: 'global_state' } },
      })
    );

    if (result.Item) {
      return {
        emergencyStop: result.Item.emergency_stop?.BOOL || false,
        reason: result.Item.emergency_reason?.S || null,
        updatedAt: result.Item.updated_at?.S || null,
      };
    }

    return { emergencyStop: false, reason: null, updatedAt: null };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(EVENTS.ADMIN_STATS_EMERGENCY_ERROR, { error: errorMessage });
    return { emergencyStop: false, reason: null, updatedAt: null };
  }
}

/**
 * Count images uploaded today
 */
async function countTodayImages(): Promise<ImageCounts> {
  const today = getTodayJST();

  try {
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: IMAGE_BUCKET,
        Prefix: 'uploads/',
      })
    );

    // Count objects that were uploaded today
    const todayCount = (result.Contents || []).filter((obj) => {
      const objDate = obj.LastModified?.toISOString().split('T')[0];
      return objDate === today;
    }).length;

    return {
      today: todayCount,
      total: result.KeyCount || 0,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(EVENTS.ADMIN_STATS_IMAGES_ERROR, { error: errorMessage });
    return { today: 0, total: 0 };
  }
}

/**
 * Count active users today (users with quota records)
 */
async function countActiveUsers(): Promise<number> {
  const today = getTodayJST();

  try {
    const result = await ddb.send(
      new ScanCommand({
        TableName: QUOTAS_TABLE,
        FilterExpression: '#d = :today',
        ExpressionAttributeNames: { '#d': 'date' },
        ExpressionAttributeValues: { ':today': { S: today } },
        Select: 'COUNT',
      })
    );

    return result.Count || 0;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(EVENTS.ADMIN_STATS_USERS_ERROR, { error: errorMessage });
    return 0;
  }
}

/**
 * Get batch process metrics from CloudWatch
 */
async function getBatchMetrics(): Promise<BatchMetrics> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const result = await cloudwatch.send(
      new GetMetricDataCommand({
        MetricDataQueries: [
          {
            Id: 'invocations',
            MetricStat: {
              Metric: {
                Namespace: 'AWS/Lambda',
                MetricName: 'Invocations',
                Dimensions: [
                  {
                    Name: 'FunctionName',
                    Value: `yorutsuke-batch-process-${process.env.AWS_REGION?.includes('dev') ? 'dev' : 'prod'}`,
                  },
                ],
              },
              Period: 86400,
              Stat: 'Sum',
            },
          },
          {
            Id: 'errors',
            MetricStat: {
              Metric: {
                Namespace: 'AWS/Lambda',
                MetricName: 'Errors',
                Dimensions: [
                  {
                    Name: 'FunctionName',
                    Value: `yorutsuke-batch-process-${process.env.AWS_REGION?.includes('dev') ? 'dev' : 'prod'}`,
                  },
                ],
              },
              Period: 86400,
              Stat: 'Sum',
            },
          },
        ],
        StartTime: oneDayAgo,
        EndTime: now,
      })
    );

    const invocations = result.MetricDataResults?.find((r) => r.Id === 'invocations')?.Values?.[0] || 0;
    const errors = result.MetricDataResults?.find((r) => r.Id === 'errors')?.Values?.[0] || 0;

    return {
      invocations,
      errors,
      lastRun: null, // Will be filled by batch Lambda logs
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(EVENTS.ADMIN_STATS_BATCH_ERROR, { error: errorMessage });
    return { invocations: 0, errors: 0, lastRun: null };
  }
}

/**
 * Lambda handler
 * GET /admin/stats
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  initContext(event);

  logger.info(EVENTS.ADMIN_STATS_REQUEST, {});

  try {
    // Fetch all stats in parallel
    const [emergency, images, activeUsers, batch] = await Promise.all([
      getEmergencyStatus(),
      countTodayImages(),
      countActiveUsers(),
      getBatchMetrics(),
    ]);

    const stats: StatsResponse = {
      emergency,
      images,
      activeUsers,
      batch,
      generatedAt: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(stats),
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(EVENTS.ADMIN_STATS_HANDLER_ERROR, { error: errorMessage });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Failed to fetch stats' }),
    };
  }
}
