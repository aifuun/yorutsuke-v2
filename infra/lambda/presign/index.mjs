import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, UpdateItemCommand, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger, EVENTS, initContext } from "/opt/nodejs/shared/logger.mjs";
import crypto from 'crypto';

const s3 = new S3Client({});
const ddb = new DynamoDBClient({});
const ssm = new SSMClient({});
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const BUCKET_NAME = process.env.BUCKET_NAME;
const QUOTAS_TABLE_NAME = process.env.QUOTAS_TABLE_NAME;
const EMERGENCY_STOP_PARAM = process.env.EMERGENCY_STOP_PARAM;  // Circuit breaker
const PERMIT_SECRET_KEY_ARN = process.env.PERMIT_SECRET_KEY_ARN;

// Cache emergency stop status (refresh every 60s)
let emergencyStopCache = { value: false, expiry: 0 };
const CACHE_TTL_MS = 60_000;

// Cache for permit secret key (Lambda container reuse)
let cachedPermitSecretKey = null;

// Tier-based quota limits
const TIER_LIMITS = {
  guest: 30,
  free: 50,
  basic: 100,
  pro: 300,
};

/**
 * Determine user tier from userId
 * - device-* or ephemeral-* → guest
 * - TODO: Look up from users table for account users
 */
function getUserTier(userId) {
  if (userId.startsWith("device-") || userId.startsWith("ephemeral-")) {
    return "guest";
  }
  // TODO: Look up tier from users table
  // For now, treat all account users as "free"
  return "free";
}

/**
 * Get quota limit for user tier
 */
function getQuotaLimit(userId) {
  const tier = getUserTier(userId);
  return TIER_LIMITS[tier] || TIER_LIMITS.guest;
}

/**
 * Get current date in JST (UTC+9)
 * @returns {string} Date in YYYY-MM-DD format
 */
function getJSTDate() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/**
 * Get TTL timestamp (7 days from now)
 * @returns {number} Unix timestamp
 */
function getTTL() {
  return Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
}

/**
 * Check current quota usage
 * @param {string} userId
 * @param {string} date
 * @returns {Promise<number>}
 */
async function getQuotaUsage(userId, date) {
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
 * @param {string} userId
 * @param {string} date
 * @returns {Promise<number>} New count
 */
async function incrementQuota(userId, date) {
  if (!QUOTAS_TABLE_NAME) return 0;

  const result = await ddb.send(
    new UpdateItemCommand({
      TableName: QUOTAS_TABLE_NAME,
      Key: {
        userId: { S: userId },
        date: { S: date },
      },
      UpdateExpression: "SET #count = if_not_exists(#count, :zero) + :one, #ttl = :ttl",
      ExpressionAttributeNames: {
        "#count": "count",
        "#ttl": "ttl",
      },
      ExpressionAttributeValues: {
        ":zero": { N: "0" },
        ":one": { N: "1" },
        ":ttl": { N: String(getTTL()) },
      },
      ReturnValues: "UPDATED_NEW",
    })
  );

  return parseInt(result.Attributes?.count?.N || "1");
}


/**
 * Check if emergency stop is enabled (circuit breaker)
 * Uses cached value to minimize SSM calls
 * @returns {Promise<boolean>}
 */
async function isEmergencyStop() {
  if (!EMERGENCY_STOP_PARAM) return false;

  const now = Date.now();
  if (now < emergencyStopCache.expiry) {
    return emergencyStopCache.value;
  }

  try {
    const result = await ssm.send(
      new GetParameterCommand({ Name: EMERGENCY_STOP_PARAM })
    );
    const isStop = result.Parameter?.Value === "true";
    emergencyStopCache = { value: isStop, expiry: now + CACHE_TTL_MS };
    return isStop;
  } catch (error) {
    logger.warn(EVENTS.PRESIGN_FAILED, { step: "emergency_stop_check", error: error.message });
    return false; // Fail open - don't block uploads on SSM errors
  }
}

/**
 * Get permit secret key from Secrets Manager (cached)
 * @returns {Promise<string>}
 */
async function getPermitSecretKey() {
  if (cachedPermitSecretKey) return cachedPermitSecretKey;

  if (!PERMIT_SECRET_KEY_ARN) {
    throw new Error('PERMIT_SECRET_KEY_ARN not configured');
  }

  try {
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: PERMIT_SECRET_KEY_ARN })
    );
    cachedPermitSecretKey = response.SecretString;
    return cachedPermitSecretKey;
  } catch (error) {
    logger.error(EVENTS.PRESIGN_FAILED, { step: 'get_secret_key', error: error.message });
    throw new Error('Failed to retrieve permit secret key');
  }
}

/**
 * Verify permit signature
 * @param {object} permit - Permit object with signature
 * @param {string} secretKey - Secret key for verification
 * @returns {boolean} True if signature is valid
 */
function verifyPermitSignature(permit, secretKey) {
  const message = `${permit.userId}:${permit.totalLimit}:${permit.dailyRate}:${permit.expiresAt}:${permit.issuedAt}`;
  const expectedSignature = crypto.createHmac('sha256', secretKey).update(message).digest('hex');
  return permit.signature === expectedSignature;
}

/**
 * Check if permit has expired
 * @param {string} expiresAt - ISO 8601 timestamp
 * @returns {boolean} True if expired
 */
function isPermitExpired(expiresAt) {
  return new Date(expiresAt).getTime() < Date.now();
}

/**
 * Validate permit structure and signature
 * @param {object} permit - Permit to validate
 * @returns {Promise<{valid: boolean, reason?: string}>}
 */
async function validatePermit(permit) {
  // Check required fields
  const requiredFields = ['userId', 'totalLimit', 'dailyRate', 'expiresAt', 'issuedAt', 'signature'];
  for (const field of requiredFields) {
    if (!(field in permit)) {
      return { valid: false, reason: `Missing required field: ${field}` };
    }
  }

  // Check expiration
  if (isPermitExpired(permit.expiresAt)) {
    return { valid: false, reason: 'PERMIT_EXPIRED' };
  }

  // Verify signature
  const secretKey = await getPermitSecretKey();
  if (!verifyPermitSignature(permit, secretKey)) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  return { valid: true };
}

export async function handler(event) {
  // Extract traceId from headers or body (before initContext)
  const headers = event.headers || {};
  const body = JSON.parse(event.body || "{}");
  const headerTraceId = headers['x-trace-id'] || headers['X-Trace-Id'];
  const bodyTraceId = body.traceId;
  const explicitTraceId = headerTraceId || bodyTraceId;

  // Initialize logging context with explicit traceId if provided
  const ctx = initContext(event, explicitTraceId);

  try {
    // Handle CORS preflight
    if (event.requestContext?.http?.method === "OPTIONS") {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Trace-Id",
        },
        body: "",
      };
    }

    // Circuit breaker: Check emergency stop
    if (await isEmergencyStop()) {
      logger.warn(EVENTS.EMERGENCY_STOP, { action: "upload_rejected" });
      return {
        statusCode: 503,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: "SERVICE_UNAVAILABLE",
          message: "Upload service temporarily unavailable",
        }),
      };
    }

    // Body already parsed above for traceId extraction
    const { userId, fileName, contentType, action, s3Key, traceId, permit } = body;

    logger.info(EVENTS.PRESIGN_STARTED, { userId, fileName, action, hasPermit: !!permit });

    // Handle download action (GET presigned URL)
    if (action === 'download') {
      if (!s3Key) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "MISSING_PARAMS", message: "Missing s3Key for download" }),
        };
      }

      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
      });

      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour

      logger.info(EVENTS.PRESIGN_COMPLETED, { s3Key, action: 'download', traceId: ctx.traceId });

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "X-Trace-Id": ctx.traceId,
        },
        body: JSON.stringify({ url: signedUrl, key: s3Key, traceId: ctx.traceId }),
      };
    }

    // Handle upload action (PUT presigned URL) - existing logic
    if (!userId || !fileName) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "MISSING_PARAMS", message: "Missing userId or fileName" }),
      };
    }

    // NEW: Permit-based quota validation (Permit v2 system)
    if (permit && PERMIT_SECRET_KEY_ARN) {
      logger.info(EVENTS.PRESIGN_STARTED, { step: 'validating_permit', userId });

      const validation = await validatePermit(permit);
      if (!validation.valid) {
        logger.warn(EVENTS.QUOTA_EXCEEDED, { userId, reason: validation.reason, system: 'permit_v2' });
        return {
          statusCode: 403,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({
            error: validation.reason || "INVALID_PERMIT",
            message: "Permit validation failed",
          }),
        };
      }

      // Permit validation passed - skip old quota system
      logger.info(EVENTS.PRESIGN_STARTED, { step: 'permit_validated', userId, system: 'permit_v2' });
    } else {
      // LEGACY: Fall back to old quota system (quotas DynamoDB table)
      const jstDate = getJSTDate();

      if (QUOTAS_TABLE_NAME) {
        const currentUsage = await getQuotaUsage(userId, jstDate);
        const quotaLimit = getQuotaLimit(userId);
        if (currentUsage >= quotaLimit) {
          logger.warn(EVENTS.QUOTA_EXCEEDED, { userId, used: currentUsage, limit: quotaLimit, system: 'legacy' });
          return {
            statusCode: 403,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({
              error: "QUOTA_EXCEEDED",
              message: `Daily upload limit (${quotaLimit}) exceeded`,
              used: currentUsage,
              limit: quotaLimit,
              tier: getUserTier(userId),
            }),
          };
        }

        // Increment quota after successful check (legacy system only)
        // Note: Permit v2 doesn't need cloud-side quota tracking
        await incrementQuota(userId, jstDate);
      }
    }

    const key = `uploads/${userId}/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType || "image/jpeg",
      // Pillar N: Include traceId in S3 metadata for distributed tracing
      Metadata: {
        'trace-id': ctx.traceId,
        'user-id': userId,
      },
    });

    // Pillar N: Presigned URL valid for 30 minutes to accommodate slow networks
    // (Frontend timeout is 60s, but network delays may add up)
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 1800 });

    // Note: Quota increment moved to legacy path above (only for non-permit requests)

    const result = { url: signedUrl, key, traceId: ctx.traceId };

    logger.info(EVENTS.PRESIGN_COMPLETED, { userId, key, traceId: ctx.traceId });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "X-Trace-Id": ctx.traceId,
      },
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error(EVENTS.PRESIGN_FAILED, { error: error.message, stack: error.stack });
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "INTERNAL_ERROR", message: "Failed to generate presigned URL" }),
    };
  }
}
