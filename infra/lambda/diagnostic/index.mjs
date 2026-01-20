/**
 * Diagnostic Export Lambda Handler (Phase C)
 */
import { reportGenerator } from "/opt/nodejs/shared/report-generator.mjs";
import { logger } from "/opt/nodejs/shared/logger.mjs";

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
      s3Url: data.s3Url,
      timestamp: data.timestamp,
      fileSize: data.fileSize,
      traceId,
    }),
  };
}

function verifyJWTToken(token) {
  if (!token) return { valid: false, error: "token is required" };
  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false, error: "Invalid JWT format" };
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
    if (!payload.sub && !payload.user_id) {
      return { valid: false, error: "Missing required JWT claims" };
    }
    return { valid: true, payload };
  } catch (e) {
    return { valid: false, error: "Invalid JWT payload" };
  }
}

export async function handler(event, context) {
  const traceId = event.traceId || event.headers?.["x-trace-id"] || `trace-${Date.now()}`;

  try {
    let requestBody;
    try {
      requestBody = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch (e) {
      logger.error("INVALID_REQUEST_BODY", { traceId, error: e.message });
      return createErrorResponse(400, "Invalid request body", traceId);
    }

    const { userId, token, localData, attempt = 1 } = requestBody;

    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      return createErrorResponse(400, "userId is required", traceId);
    }
    if (!token || typeof token !== "string" || token.trim() === "") {
      return createErrorResponse(400, "token is required", traceId);
    }
    if (!localData || typeof localData !== "object") {
      return createErrorResponse(400, "localData is required", traceId);
    }

    const jwtValidation = verifyJWTToken(token);
    if (!jwtValidation.valid) {
      return createErrorResponse(401, jwtValidation.error, traceId);
    }

    logger.info("DIAGNOSTIC_EXPORT_STARTED", { traceId, userId, attempt });
    const result = await reportGenerator.generate({ userId, localData, token, traceId });
    logger.info("DIAGNOSTIC_EXPORT_COMPLETED", { traceId, reportId: result.reportId });

    return createSuccessResponse(result, traceId);
  } catch (error) {
    if (error.code === "RequestTimeout" || error.name === "TimeoutError") {
      logger.error("DIAGNOSTIC_EXPORT_TIMEOUT", { traceId, error: error.message });
      return createErrorResponse(504, "Request timeout", traceId);
    }
    logger.error("DIAGNOSTIC_EXPORT_ERROR", { traceId, error: error.message });
    return createErrorResponse(500, "Internal server error", traceId);
  }
}
