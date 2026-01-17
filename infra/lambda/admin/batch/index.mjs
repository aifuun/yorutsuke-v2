/**
 * Admin Batch Lambda
 * Batch processing monitoring and manual trigger
 */

import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { CloudWatchLogsClient, FilterLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const lambda = new LambdaClient({});
const logs = new CloudWatchLogsClient({});
const s3 = new S3Client({});

const BATCH_LAMBDA_NAME = process.env.BATCH_PROCESS_LAMBDA_NAME;
const IMAGE_BUCKET = process.env.IMAGE_BUCKET_NAME;
const BATCH_MODE_DISABLED = process.env.BATCH_MODE_DISABLED === "true";

/**
 * Get recent batch processing logs
 */
async function getRecentLogs(limit = 20) {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  try {
    const result = await logs.send(
      new FilterLogEventsCommand({
        logGroupName: `/aws/lambda/${BATCH_LAMBDA_NAME}`,
        startTime: oneDayAgo,
        endTime: now,
        limit,
        filterPattern: "", // All logs
      })
    );

    return (result.events || []).map((event) => ({
      timestamp: new Date(event.timestamp).toISOString(),
      message: event.message?.trim(),
    }));
  } catch (e) {
    console.error("Error getting logs:", e);
    return [];
  }
}

/**
 * Get pending images count (images in uploads/ waiting for processing)
 */
async function getPendingImages() {
  try {
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: IMAGE_BUCKET,
        Prefix: "uploads/",
      })
    );

    return {
      pending: result.KeyCount || 0,
      isTruncated: result.IsTruncated || false,
    };
  } catch (e) {
    console.error("Error counting pending images:", e);
    return { pending: 0, isTruncated: false };
  }
}

/**
 * Parse batch result from logs
 */
function parseBatchResult(logs) {
  // Look for summary line in logs
  const summaryLog = logs.find((log) =>
    log.message?.includes("processed") ||
    log.message?.includes("Batch complete")
  );

  if (summaryLog) {
    // Try to extract counts from log message
    const match = summaryLog.message.match(/(\d+)\s*processed.*?(\d+)\s*failed/i);
    if (match) {
      return {
        processed: parseInt(match[1], 10),
        failed: parseInt(match[2], 10),
        timestamp: summaryLog.timestamp,
      };
    }
  }

  return null;
}

/**
 * Manually trigger batch processing
 */
async function triggerBatch() {
  try {
    const result = await lambda.send(
      new InvokeCommand({
        FunctionName: BATCH_LAMBDA_NAME,
        InvocationType: "Event", // Async invocation
        Payload: JSON.stringify({ source: "admin-manual-trigger" }),
      })
    );

    return {
      success: result.StatusCode === 202,
      statusCode: result.StatusCode,
    };
  } catch (e) {
    console.error("Error triggering batch:", e);
    return { success: false, error: e.message };
  }
}

export async function handler(event) {
  console.log("Admin batch request:", JSON.stringify(event));

  const method = event.httpMethod || event.requestContext?.http?.method;

  try {
    if (method === "GET") {
      // Check if batch mode is disabled
      if (BATCH_MODE_DISABLED) {
        const pendingImages = await getPendingImages();
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            disabled: true,
            message: "Batch processing mode has been removed. Using Instant mode only.",
            note: "Images are processed immediately upon upload via instant-processor Lambda.",
            pendingImages,
            recentLogs: [],
            lastResult: null,
            scheduledTime: "N/A (Instant mode only)",
          }),
        };
      }

      // Get batch status and recent logs
      const [recentLogs, pendingImages] = await Promise.all([
        getRecentLogs(50),
        getPendingImages(),
      ]);

      const lastResult = parseBatchResult(recentLogs);

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          pendingImages,
          lastResult,
          recentLogs: recentLogs.slice(0, 20), // Return only last 20
          scheduledTime: "Depends on processing mode (Instant: immediate, Batch/Hybrid: on trigger)",
          lambdaName: BATCH_LAMBDA_NAME,
        }),
      };
    }

    if (method === "POST") {
      // Check if batch mode is disabled
      if (BATCH_MODE_DISABLED) {
        return {
          statusCode: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            error: "Batch processing is disabled",
            message: "Batch mode has been removed. Using Instant mode only.",
            note: "Images are processed automatically upon upload.",
          }),
        };
      }

      // Manually trigger batch processing
      const body = JSON.parse(event.body || "{}");

      if (body.action !== "trigger") {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ error: "Invalid action. Use 'trigger'" }),
        };
      }

      const result = await triggerBatch();

      if (result.success) {
        console.log("Batch triggered manually by admin");
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            message: "Batch processing triggered successfully",
            note: "Processing runs asynchronously. Check logs for results.",
          }),
        };
      } else {
        return {
          statusCode: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            error: "Failed to trigger batch processing",
            details: result.error,
          }),
        };
      }
    }

    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    console.error("Error in batch handler:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}
