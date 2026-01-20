/**
 * Diagnostic Export Lambda Handler
 *
 * Pillar: Processes diagnostic data collection based on userId prefix
 * - "device-*" (guest): Collects local + cloud data, uploads to S3, returns presigned URL
 * - "user-*" (authenticated): Collects local + cloud data, uploads to S3, returns presigned URL
 *
 * All users get S3 presigned URLs (7-day expiry)
 * Access control via userId prefix + IAM policies
 * No token required
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "/opt/nodejs/shared/logger.mjs";
import { nanoid } from "nanoid";

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

const DIAGNOSTICS_BUCKET = process.env.DIAGNOSTICS_BUCKET || "yorutsuke-diagnostics-dev";
const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE || "yorutsuke-transactions-us-dev";

// ============================================================================
// Response Builders
// ============================================================================

function createErrorResponse(statusCode, message, traceId) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ success: false, error: message, traceId }),
  };
}

function createSuccessResponse(data, traceId) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({
      success: true,
      reportId: data.reportId,
      s3Url: data.s3Url || "", // Empty string for guest users (no S3 URL)
      timestamp: data.timestamp,
      fileSize: data.fileSize,
      traceId,
    }),
  };
}

// ============================================================================
// User Type Detection
// ============================================================================

function getUserType(userId) {
  if (typeof userId !== "string") return null;
  if (userId.startsWith("device-")) return "guest";
  if (userId.startsWith("user-")) return "authenticated";
  return null;
}

// ============================================================================
// Cloud Data Collection (for authenticated users only)
// ============================================================================

async function collectCloudData(userId, traceId) {
  try {
    logger.info("DIAGNOSTIC_COLLECTING_CLOUD_DATA", { traceId, userId });

    // TODO: Implement cloud data collection
    // - Query DynamoDB for user's transactions
    // - List S3 for user's images
    // - Fetch CloudWatch logs (if needed)

    return {
      transactions: [],
      images: [],
      errors: [],
    };
  } catch (error) {
    logger.error("DIAGNOSTIC_CLOUD_DATA_ERROR", {
      traceId,
      userId,
      error: error.message,
    });
    // Don't fail the entire export if cloud collection fails
    // Return empty cloud data instead
    return {
      transactions: [],
      images: [],
      errors: [error.message],
    };
  }
}

// ============================================================================
// Report Generation & Upload
// ============================================================================

async function generateAndUploadReport(userId, localData, cloudData, traceId) {
  const reportId = `diag-${nanoid()}`;
  const timestamp = new Date().toISOString();

  // Combine local + cloud data
  const reportData = {
    reportId,
    timestamp,
    userId,
    local: localData,
    cloud: cloudData || null,
  };

  const reportJson = JSON.stringify(reportData, null, 2);
  const fileSize = Buffer.byteLength(reportJson, "utf-8");

  // Upload to S3 for all users (guest + authenticated)
  // Access control via userId prefix + IAM policies
  try {
    logger.info("DIAGNOSTIC_UPLOADING_TO_S3", {
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
        ContentType: "application/json",
      })
    );

    // Generate S3 presigned URL (7-day expiry) for all users
    const getObjectCommand = new GetObjectCommand({
      Bucket: DIAGNOSTICS_BUCKET,
      Key: s3Key,
    });
    const s3Url = await getSignedUrl(s3Client, getObjectCommand, {
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    logger.info("DIAGNOSTIC_UPLOAD_SUCCESS", {
      traceId,
      userId,
      reportId,
      s3Url: s3Url.split("?")[0], // Log without query params
    });

    return {
      reportId,
      s3Url,
      timestamp,
      fileSize,
    };
  } catch (error) {
    logger.error("DIAGNOSTIC_S3_UPLOAD_ERROR", {
      traceId,
      userId,
      error: error.message,
    });
    // If S3 upload fails, retry logic is handled by Service layer
    throw error;
  }
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handler(event, context) {
  try {
    // Parse request body
    let requestBody;
    try {
      requestBody = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch (e) {
      const fallbackTraceId = event.traceId || event.headers?.["x-trace-id"] || `trace-${Date.now()}`;
      logger.error("DIAGNOSTIC_INVALID_REQUEST", { traceId: fallbackTraceId, error: e.message });
      return createErrorResponse(400, "Invalid request body", fallbackTraceId);
    }

    // Extract traceId from request body (sent by client) or fall back to headers/generate
    const { userId, localData, traceId: clientTraceId, attempt = 1 } = requestBody;
    const traceId = clientTraceId || event.headers?.["x-trace-id"] || `trace-${Date.now()}`;

    // Validate inputs
    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      return createErrorResponse(400, "userId is required", traceId);
    }
    if (!localData || typeof localData !== "object") {
      return createErrorResponse(400, "localData is required", traceId);
    }

    // Determine user type based on userId prefix
    const userType = getUserType(userId);
    if (!userType) {
      return createErrorResponse(400, "Invalid userId format (must start with 'device-' or 'user-')", traceId);
    }

    logger.info("DIAGNOSTIC_EXPORT_START", {
      traceId,
      userId,
      userType,
      attempt,
    });

    // Collect cloud data for authenticated users only
    let cloudData = null;
    if (userType === "authenticated") {
      cloudData = await collectCloudData(userId, traceId);
    }

    // Generate report and upload
    const result = await generateAndUploadReport(userId, localData, cloudData, traceId);

    logger.info("DIAGNOSTIC_EXPORT_SUCCESS", {
      traceId,
      userId,
      reportId: result.reportId,
      fileSize: result.fileSize,
    });

    return createSuccessResponse(result, traceId);
  } catch (error) {
    logger.error("DIAGNOSTIC_EXPORT_ERROR", {
      traceId,
      error: error.message,
      stack: error.stack,
    });

    if (error.code === "RequestTimeout" || error.name === "TimeoutError") {
      return createErrorResponse(504, "Request timeout", traceId);
    }

    return createErrorResponse(500, "Internal server error", traceId);
  }
}
