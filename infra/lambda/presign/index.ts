/**
 * Presign Lambda (Phase 4 - P2)
 *
 * Generates S3 presigned URLs for secure upload/download:
 * - Emergency stop circuit breaker (SSM)
 * - Permit v2 validation (HMAC-SHA256)
 * - Legacy quota checking (DynamoDB)
 * - TraceId propagation (Pillar N)
 * - Both upload (PUT) and download (GET) presigned URLs
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
} from '@aws-sdk/client-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger, EVENTS, initContext } from '/opt/nodejs/shared/logger.mjs';
import crypto from 'crypto';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from './types/aws-events.js';

const s3 = new S3Client({});
const ddb = new DynamoDBClient({});
const ssm = new SSMClient({});
const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const BUCKET_NAME = process.env.BUCKET_NAME;
const QUOTAS_TABLE_NAME = process.env.QUOTAS_TABLE_NAME;
const EMERGENCY_STOP_PARAM = process.env.EMERGENCY_STOP_PARAM; // Circuit breaker
const PERMIT_SECRET_KEY_ARN = process.env.PERMIT_SECRET_KEY_ARN;

// Cache emergency stop status (refresh every 60s)
let emergencyStopCache = { value: false, expiry: 0 };
const CACHE_TTL_MS = 60_000;

// Cache for permit secret key (Lambda container reuse)
let cachedPermitSecretKey: string | null = null;

/**
 * Reset caches (for testing)
 * @internal
 */
export function resetCaches(): void {
  emergencyStopCache = { value: false, expiry: 0 };
  cachedPermitSecretKey = null;
}

// Tier-based quota limits
const TIER_LIMITS: Record<string, number> = {
  guest: 30,
  free: 50,
  basic: 100,
  pro: 300,
};

/**
 * Permit interface
 */
export interface Permit {
  userId: string;
  totalLimit: number;
  dailyRate: number;
  expiresAt: string;
  issuedAt: string;
  signature: string;
  tier?: string;
}

/**
 * Permit validation result
 */
interface PermitValidation {
  valid: boolean;
  reason?: string;
}

/**
 * Determine user tier from userId
 */
function getUserTier(userId: string): string {
  if (userId.startsWith('device-') || userId.startsWith('ephemeral-')) {
    return 'guest';
  }
  // TODO: Look up tier from users table
  return 'free';
}

/**
 * Get quota limit for user tier
 */
function getQuotaLimit(userId: string): number {
  const tier = getUserTier(userId);
  return TIER_LIMITS[tier] || TIER_LIMITS.guest;
}

/**
 * Get current date in JST (UTC+9)
 */
function getJSTDate(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/**
 * Get TTL timestamp (7 days from now)
 */
function getTTL(): number {
  return Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
}

/**
 * Check current quota usage
 */
async function getQuotaUsage(userId: string, date: string): Promise<number> {
  if (!QUOTAS_TABLE_NAME) return 0;

  const result = await ddb.send(
    new GetItemCommand({
      TableName: QUOTAS_TABLE_NAME,
      Key: {
        userId: { S: userId },
        date: { S: date },
      },
    })
  );

  return result.Item?.count?.N ? parseInt(result.Item.count.N) : 0;
}

/**
 * Increment quota usage
 */
async function incrementQuota(userId: string, date: string): Promise<number> {
  if (!QUOTAS_TABLE_NAME) return 0;

  const result = await ddb.send(
    new UpdateItemCommand({
      TableName: QUOTAS_TABLE_NAME,
      Key: {
        userId: { S: userId },
        date: { S: date },
      },
      UpdateExpression:
        'SET #count = if_not_exists(#count, :zero) + :one, #ttl = :ttl',
      ExpressionAttributeNames: {
        '#count': 'count',
        '#ttl': 'ttl',
      },
      ExpressionAttributeValues: {
        ':zero': { N: '0' },
        ':one': { N: '1' },
        ':ttl': { N: String(getTTL()) },
      },
      ReturnValues: 'UPDATED_NEW',
    })
  );

  return parseInt(result.Attributes?.count?.N || '1');
}

/**
 * Check if emergency stop is enabled (circuit breaker)
 * Uses cached value to minimize SSM calls
 */
async function isEmergencyStop(): Promise<boolean> {
  if (!EMERGENCY_STOP_PARAM) return false;

  const now = Date.now();
  if (now < emergencyStopCache.expiry) {
    return emergencyStopCache.value;
  }

  try {
    const result = await ssm.send(
      new GetParameterCommand({ Name: EMERGENCY_STOP_PARAM })
    );
    const isStop = result.Parameter?.Value === 'true';
    emergencyStopCache = { value: isStop, expiry: now + CACHE_TTL_MS };
    return isStop;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(EVENTS.PRESIGN_FAILED, {
      step: 'emergency_stop_check',
      error: errorMessage,
    });
    return false; // Fail open - don't block uploads on SSM errors
  }
}

/**
 * Get permit secret key from Secrets Manager (cached)
 */
async function getPermitSecretKey(): Promise<string> {
  if (cachedPermitSecretKey) return cachedPermitSecretKey;

  if (!PERMIT_SECRET_KEY_ARN) {
    throw new Error('PERMIT_SECRET_KEY_ARN not configured');
  }

  try {
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: PERMIT_SECRET_KEY_ARN })
    );
    cachedPermitSecretKey = response.SecretString || '';
    return cachedPermitSecretKey;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(EVENTS.PRESIGN_FAILED, {
      step: 'get_secret_key',
      error: errorMessage,
    });
    throw new Error('Failed to retrieve permit secret key');
  }
}

/**
 * Sign a permit (HMAC-SHA256)
 * Exported for testing
 */
export function signPermit(
  userId: string,
  totalLimit: number,
  dailyRate: number,
  expiresAt: string,
  issuedAt: string,
  secretKey: string
): string {
  const message = `${userId}:${totalLimit}:${dailyRate}:${expiresAt}:${issuedAt}`;
  return crypto.createHmac('sha256', secretKey).update(message).digest('hex');
}

/**
 * Verify permit signature
 * Exported for testing
 */
export function verifyPermitSignature(permit: Permit, secretKey: string): boolean {
  const message = `${permit.userId}:${permit.totalLimit}:${permit.dailyRate}:${permit.expiresAt}:${permit.issuedAt}`;
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('hex');
  return permit.signature === expectedSignature;
}

/**
 * Check if permit has expired
 */
function isPermitExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

/**
 * Validate permit structure and signature
 * Exported for testing
 */
export async function validatePermit(
  permit: Partial<Permit>,
  secretKey?: string
): Promise<PermitValidation> {
  // Check required fields
  const requiredFields: (keyof Permit)[] = [
    'userId',
    'totalLimit',
    'dailyRate',
    'expiresAt',
    'issuedAt',
    'signature',
  ];
  for (const field of requiredFields) {
    if (!(field in permit)) {
      return { valid: false, reason: `Missing required field: ${field}` };
    }
  }

  // Check expiration
  if (isPermitExpired(permit.expiresAt!)) {
    return { valid: false, reason: 'PERMIT_EXPIRED' };
  }

  // Verify signature
  const key = secretKey || (await getPermitSecretKey());
  if (!verifyPermitSignature(permit as Permit, key)) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  return { valid: true };
}

/**
 * Lambda handler
 * POST /presign - Upload presigned URL
 * POST /presign (action=download) - Download presigned URL
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  // Extract traceId from headers or body (before initContext)
  const headers = event.headers || {};
  const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
  const headerTraceId = headers['x-trace-id'] || headers['X-Trace-Id'];
  const bodyTraceId = body.traceId as string | undefined;
  const explicitTraceId = headerTraceId || bodyTraceId;

  // Initialize logging context with explicit traceId if provided
  const ctx = initContext(event, explicitTraceId);

  try {
    // Handle CORS preflight
    if (event.requestContext?.http?.method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, Authorization, X-Trace-Id',
        },
        body: '',
      };
    }

    // Circuit breaker: Check emergency stop
    if (await isEmergencyStop()) {
      logger.warn(EVENTS.EMERGENCY_STOP, { action: 'upload_rejected' });
      return {
        statusCode: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Upload service temporarily unavailable',
        }),
      };
    }

    // Body already parsed above for traceId extraction
    const { userId, fileName, contentType, action, s3Key, permit } = body as {
      userId?: string;
      fileName?: string;
      contentType?: string;
      action?: string;
      s3Key?: string;
      permit?: Permit;
    };

    logger.info(EVENTS.PRESIGN_STARTED, {
      userId,
      fileName,
      action,
      hasPermit: !!permit,
    });

    // Handle download action (GET presigned URL)
    if (action === 'download') {
      if (!s3Key) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'MISSING_PARAMS',
            message: 'Missing s3Key for download',
          }),
        };
      }

      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
      });

      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour

      logger.info(EVENTS.PRESIGN_COMPLETED, {
        s3Key,
        action: 'download',
        traceId: ctx.traceId,
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-Trace-Id': ctx.traceId,
        },
        body: JSON.stringify({ url: signedUrl, key: s3Key, traceId: ctx.traceId }),
      };
    }

    // Handle upload action (PUT presigned URL) - existing logic
    if (!userId || !fileName) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'MISSING_PARAMS',
          message: 'Missing userId or fileName',
        }),
      };
    }

    // NEW: Permit-based quota validation (Permit v2 system)
    if (permit && PERMIT_SECRET_KEY_ARN) {
      logger.info(EVENTS.PRESIGN_STARTED, { step: 'validating_permit', userId });

      const validation = await validatePermit(permit);
      if (!validation.valid) {
        logger.warn(EVENTS.QUOTA_EXCEEDED, {
          userId,
          reason: validation.reason,
          system: 'permit_v2',
        });
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: validation.reason || 'INVALID_PERMIT',
            message: 'Permit validation failed',
          }),
        };
      }

      // Permit validation passed - skip old quota system
      logger.info(EVENTS.PRESIGN_STARTED, {
        step: 'permit_validated',
        userId,
        system: 'permit_v2',
      });
    } else {
      // LEGACY: Fall back to old quota system (quotas DynamoDB table)
      const jstDate = getJSTDate();

      if (QUOTAS_TABLE_NAME) {
        const currentUsage = await getQuotaUsage(userId, jstDate);
        const quotaLimit = getQuotaLimit(userId);
        if (currentUsage >= quotaLimit) {
          logger.warn(EVENTS.QUOTA_EXCEEDED, {
            userId,
            used: currentUsage,
            limit: quotaLimit,
            system: 'legacy',
          });
          return {
            statusCode: 403,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
              error: 'QUOTA_EXCEEDED',
              message: `Daily upload limit (${quotaLimit}) exceeded`,
              used: currentUsage,
              limit: quotaLimit,
              tier: getUserTier(userId),
            }),
          };
        }

        // Increment quota after successful check (legacy system only)
        await incrementQuota(userId, jstDate);
      }
    }

    const key = `uploads/${userId}/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType || 'image/jpeg',
      // Pillar N: Include traceId in S3 metadata for distributed tracing
      Metadata: {
        'trace-id': ctx.traceId,
        'user-id': userId,
      },
    });

    // Pillar N: Presigned URL valid for 30 minutes
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 1800 });

    const result = { url: signedUrl, key, traceId: ctx.traceId };

    logger.info(EVENTS.PRESIGN_COMPLETED, { userId, key, traceId: ctx.traceId });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Trace-Id': ctx.traceId,
      },
      body: JSON.stringify(result),
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(EVENTS.PRESIGN_FAILED, { error: errorMessage, stack: errorStack });
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: 'Failed to generate presigned URL',
      }),
    };
  }
}
