/**
 * Diagnostic Export Lambda Handler
 *
 * Processes diagnostic data collection for all users (guest + authenticated)
 * - Collects local data (sent from client)
 * - Collects cloud data (DynamoDB transactions, S3 metadata, CloudWatch logs)
 * - Combines both into single report
 * - Uploads to S3 with presigned URL (7-day expiry)
 *
 * User types (based on userId prefix):
 * - "device-*" (guest): Full diagnostic export with cloud data
 * - "user-*" (authenticated): Full diagnostic export with cloud data
 *
 * Access control via userId prefix + IAM policies
 * No authentication token required
 */
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { CloudWatchLogsClient, FilterLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { logger } from "/opt/nodejs/shared/logger.mjs";
import { nanoid } from "nanoid";

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const logsClient = new CloudWatchLogsClient({ region: process.env.AWS_REGION || "us-east-1" });

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
// Cloud Data Collection (for all users)
// ============================================================================

async function collectCloudData(userId, traceId) {
  const errors = [];
  const transactions = [];
  const cloudWatchLogs = [];

  try {
    logger.info("DIAGNOSTIC_COLLECTING_CLOUD_DATA", { traceId, userId });

    // 1. Query DynamoDB for user's transactions
    try {
      const params = {
        TableName: TRANSACTIONS_TABLE,
        FilterExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": { S: userId },
        },
        Limit: 50, // Limit to 50 transactions for diagnostic report
      };

      const scanResult = await dynamoClient.send(new ScanCommand(params));

      // Convert DynamoDB items to readable format (extract all fields)
      if (scanResult.Items && scanResult.Items.length > 0) {
        transactions.push(...scanResult.Items.slice(0, 10).map(item => {
          // Helper to convert DynamoDB format to plain JS objects recursively
          const convertDynamoItem = (dynamoItem) => {
            const result = {};
            for (const [key, value] of Object.entries(dynamoItem)) {
              // Handle different DynamoDB types
              if (value.S) result[key] = value.S;
              else if (value.N) result[key] = value.N;
              else if (value.BOOL) result[key] = value.BOOL;
              else if (value.NULL) result[key] = null;
              else if (value.L) result[key] = value.L.map(convertDynamoItem);
              else if (value.M) result[key] = convertDynamoItem(value.M);
              else result[key] = value;
            }
            return result;
          };
          return convertDynamoItem(item);
        }));
      }

      logger.info("DIAGNOSTIC_TRANSACTIONS_COLLECTED", {
        traceId,
        userId,
        count: transactions.length,
      });
    } catch (e) {
      const msg = `Failed to collect DynamoDB transactions: ${e.message}`;
      logger.warn("DIAGNOSTIC_DYNAMODB_ERROR", { traceId, userId, error: msg });
      errors.push(msg);
    }

    // 2. Fetch CloudWatch logs for this Lambda function
    try {
      const logGroupName = `/aws/lambda/${process.env.AWS_LAMBDA_FUNCTION_NAME || "diagnostic"}`;

      const params = {
        logGroupName,
        startTime: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
        interleaved: true,
        limit: 100, // Limit to 100 log events
      };

      const logsResult = await logsClient.send(new FilterLogEventsCommand(params));

      if (logsResult.events && logsResult.events.length > 0) {
        cloudWatchLogs.push(...logsResult.events.slice(0, 20).map(event => ({
          timestamp: event.timestamp,
          message: event.message || "",
        })));
      }

      logger.info("DIAGNOSTIC_LOGS_COLLECTED", {
        traceId,
        userId,
        count: cloudWatchLogs.length,
      });
    } catch (e) {
      const msg = `Failed to collect CloudWatch logs: ${e.message}`;
      logger.warn("DIAGNOSTIC_LOGS_ERROR", { traceId, userId, error: msg });
      errors.push(msg);
    }

    return {
      transactions,
      images: [],
      cloudWatchLogs,
      errors,
    };
  } catch (error) {
    logger.error("DIAGNOSTIC_CLOUD_DATA_ERROR", {
      traceId,
      userId,
      error: error.message,
    });
    // Don't fail the entire export if cloud collection fails
    // Return partial cloud data with errors
    return {
      transactions,
      images: [],
      cloudWatchLogs,
      errors: [...errors, error.message],
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

    // Collect cloud data for all users (guest + authenticated)
    const cloudData = await collectCloudData(userId, traceId);

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
