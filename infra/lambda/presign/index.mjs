import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, UpdateItemCommand, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger, EVENTS, initContext } from "/opt/nodejs/shared/logger.mjs";

const s3 = new S3Client({});
const ddb = new DynamoDBClient({});
const ssm = new SSMClient({});
const BUCKET_NAME = process.env.BUCKET_NAME;
const QUOTAS_TABLE_NAME = process.env.QUOTAS_TABLE_NAME;
const INTENTS_TABLE_NAME = process.env.INTENTS_TABLE_NAME;  // Pillar Q: Idempotency
const EMERGENCY_STOP_PARAM = process.env.EMERGENCY_STOP_PARAM;  // Circuit breaker

// Cache emergency stop status (refresh every 60s)
let emergencyStopCache = { value: false, expiry: 0 };
const CACHE_TTL_MS = 60_000;

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
 * Pillar Q: Check if intent was already processed
 * @param {string} intentId
 * @returns {Promise<{url: string, key: string} | null>} Cached result or null
 */
async function checkIntent(intentId) {
  if (!INTENTS_TABLE_NAME || !intentId) return null;

  const result = await ddb.send(
    new GetItemCommand({
      TableName: INTENTS_TABLE_NAME,
      Key: { intentId: { S: intentId } },
    })
  );

  if (result.Item?.result?.S) {
    return JSON.parse(result.Item.result.S);
  }
  return null;
}

/**
 * Pillar Q: Store intent result for idempotency
 * @param {string} intentId
 * @param {{url: string, key: string}} result
 * @returns {Promise<void>}
 */
async function storeIntent(intentId, result) {
  if (!INTENTS_TABLE_NAME || !intentId) return;

  await ddb.send(
    new PutItemCommand({
      TableName: INTENTS_TABLE_NAME,
      Item: {
        intentId: { S: intentId },
        result: { S: JSON.stringify(result) },
        ttl: { N: String(getTTL()) },  // 7 days TTL
      },
    })
  );
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
    const { userId, fileName, intentId, contentType, action, s3Key, traceId } = body;

    logger.info(EVENTS.PRESIGN_STARTED, { userId, fileName, intentId, action });

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

    // Pillar Q: Check idempotency - return cached result if already processed
    const cachedResult = await checkIntent(intentId);
    if (cachedResult) {
      logger.info(EVENTS.PRESIGN_CACHED, { intentId });
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify(cachedResult),
      };
    }

    const jstDate = getJSTDate();

    // Check quota before generating presigned URL
    if (QUOTAS_TABLE_NAME) {
      const currentUsage = await getQuotaUsage(userId, jstDate);
      const quotaLimit = getQuotaLimit(userId);
      if (currentUsage >= quotaLimit) {
        logger.warn(EVENTS.QUOTA_EXCEEDED, { userId, used: currentUsage, limit: quotaLimit });
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
    }

    const key = `uploads/${userId}/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType || "image/jpeg",
      // Pillar N: Include traceId in S3 metadata for distributed tracing
      Metadata: {
        'trace-id': ctx.traceId,
        'intent-id': intentId || '',
        'user-id': userId,
      },
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    // Increment quota after successful presign generation
    if (QUOTAS_TABLE_NAME) {
      await incrementQuota(userId, jstDate);
    }

    const result = { url: signedUrl, key, traceId: ctx.traceId };

    // Pillar Q: Store intent result for idempotency
    await storeIntent(intentId, result);

    logger.info(EVENTS.PRESIGN_COMPLETED, { userId, key, intentId, traceId: ctx.traceId });

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
