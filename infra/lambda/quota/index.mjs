import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.QUOTAS_TABLE_NAME;

// Tier-based quota limits
const TIER_LIMITS = {
  guest: 30,
  free: 50,
  basic: 100,
  pro: 300,
};

// Guest data expires after 60 days of inactivity
const GUEST_TTL_DAYS = 60;

/**
 * Check if userId is a guest (device-* or ephemeral-*)
 */
function isGuestUser(userId) {
  return userId.startsWith("device-") || userId.startsWith("ephemeral-");
}

/**
 * Determine user tier from userId
 * - device-* or ephemeral-* → guest
 * - TODO: Look up from users table for account users
 */
function getUserTier(userId) {
  if (isGuestUser(userId)) {
    return "guest";
  }
  // TODO: Look up tier from users table
  // For now, treat all account users as "free"
  return "free";
}

/**
 * Update last active timestamp for guest users
 * This is used to calculate data expiration
 */
async function updateLastActive(userId, date) {
  if (!isGuestUser(userId)) return null;

  const now = Date.now();
  const expiresAt = now + GUEST_TTL_DAYS * 24 * 60 * 60 * 1000;

  try {
    await ddb.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: {
          userId: { S: userId },
          date: { S: date },
        },
        UpdateExpression: "SET lastActiveAt = :now",
        ExpressionAttributeValues: {
          ":now": { N: String(now) },
        },
      })
    );

    return {
      lastActiveAt: new Date(now).toISOString(),
      dataExpiresAt: new Date(expiresAt).toISOString(),
      daysUntilExpiration: GUEST_TTL_DAYS,
    };
  } catch (error) {
    console.warn("Failed to update lastActiveAt:", error);
    // Return default values even if update fails
    return {
      lastActiveAt: new Date(now).toISOString(),
      dataExpiresAt: new Date(expiresAt).toISOString(),
      daysUntilExpiration: GUEST_TTL_DAYS,
    };
  }
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
  // Add 9 hours for JST
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/**
 * Get next midnight in JST as ISO string
 * @returns {string} ISO 8601 timestamp
 */
function getNextMidnightJST() {
  const now = new Date();
  // Current JST time
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  // Next midnight JST
  const nextMidnight = new Date(jstNow);
  nextMidnight.setUTCHours(24, 0, 0, 0); // Set to next day 00:00
  // Convert back to UTC
  return new Date(nextMidnight.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

export async function handler(event) {
  try {
    // Handle CORS preflight
    if (event.requestContext?.http?.method === "OPTIONS") {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: "",
      };
    }

    const body = JSON.parse(event.body || "{}");
    const { userId } = body;

    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "MISSING_USER_ID", message: "userId is required" }),
      };
    }

    const jstDate = getJSTDate();

    // Query current upload count for today
    const result = await ddb.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: {
          userId: { S: userId },
          date: { S: jstDate },
        },
      })
    );

    const used = result.Item?.count?.N ? parseInt(result.Item.count.N) : 0;
    const tier = getUserTier(userId);
    const limit = getQuotaLimit(userId);
    const remaining = Math.max(0, limit - used);
    const resetsAt = getNextMidnightJST();

    // Build response
    const response = {
      used,
      limit,
      remaining,
      resetsAt,
      tier,
    };

    // For guest users, include expiration info
    if (isGuestUser(userId)) {
      const expirationInfo = await updateLastActive(userId, jstDate);
      if (expirationInfo) {
        response.guest = {
          dataExpiresAt: expirationInfo.dataExpiresAt,
          daysUntilExpiration: expirationInfo.daysUntilExpiration,
        };
      }
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Quota check error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "INTERNAL_ERROR", message: "Failed to check quota" }),
    };
  }
}
