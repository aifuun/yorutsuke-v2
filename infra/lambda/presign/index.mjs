import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({});
const ddb = new DynamoDBClient({});
const BUCKET_NAME = process.env.BUCKET_NAME;
const QUOTAS_TABLE_NAME = process.env.QUOTAS_TABLE_NAME;
const QUOTA_LIMIT = parseInt(process.env.QUOTA_LIMIT || "50");

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
    const { userId, fileName, contentType } = body;

    if (!userId || !fileName) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "MISSING_PARAMS", message: "Missing userId or fileName" }),
      };
    }

    const jstDate = getJSTDate();

    // Check quota before generating presigned URL
    if (QUOTAS_TABLE_NAME) {
      const currentUsage = await getQuotaUsage(userId, jstDate);
      if (currentUsage >= QUOTA_LIMIT) {
        return {
          statusCode: 403,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({
            error: "QUOTA_EXCEEDED",
            message: `Daily upload limit (${QUOTA_LIMIT}) exceeded`,
            used: currentUsage,
            limit: QUOTA_LIMIT,
          }),
        };
      }
    }

    const key = `uploads/${userId}/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType || "image/webp",
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    // Increment quota after successful presign generation
    if (QUOTAS_TABLE_NAME) {
      await incrementQuota(userId, jstDate);
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ url: signedUrl, key }),
    };
  } catch (error) {
    console.error("Presign error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "INTERNAL_ERROR", message: "Failed to generate presigned URL" }),
    };
  }
}
