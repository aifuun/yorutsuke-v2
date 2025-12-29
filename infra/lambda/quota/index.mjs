import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.QUOTAS_TABLE_NAME;
const QUOTA_LIMIT = parseInt(process.env.QUOTA_LIMIT || "50");

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
    const remaining = Math.max(0, QUOTA_LIMIT - used);
    const resetsAt = getNextMidnightJST();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        used,
        limit: QUOTA_LIMIT,
        remaining,
        resetsAt,
      }),
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
