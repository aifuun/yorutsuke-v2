import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});

// Static config from environment variables
const QUOTA_LIMIT = parseInt(process.env.QUOTA_LIMIT || "50");
const UPLOAD_INTERVAL_MS = parseInt(process.env.UPLOAD_INTERVAL_MS || "10000");
const BATCH_TIME = process.env.BATCH_TIME || "02:00"; // Default fallback time (configurable processing modes preferred)
const MIN_VERSION = process.env.MIN_VERSION || "1.0.0";
const LATEST_VERSION = process.env.LATEST_VERSION || "1.1.0";

// SSM parameter name for maintenance mode (can be changed without deploy)
const MAINTENANCE_MODE_PARAM = process.env.MAINTENANCE_MODE_PARAM;

// Cache for SSM parameter (5 minutes)
let maintenanceModeCache = { value: false, expiresAt: 0 };
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get maintenance mode from SSM Parameter Store with caching
 * @returns {Promise<boolean>}
 */
async function getMaintenanceMode() {
  // If no SSM param configured, return false
  if (!MAINTENANCE_MODE_PARAM) {
    return false;
  }

  // Check cache
  if (Date.now() < maintenanceModeCache.expiresAt) {
    return maintenanceModeCache.value;
  }

  try {
    const result = await ssm.send(
      new GetParameterCommand({
        Name: MAINTENANCE_MODE_PARAM,
      })
    );

    const value = result.Parameter?.Value === "true";
    maintenanceModeCache = {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    return value;
  } catch (error) {
    console.warn("Failed to get maintenance mode from SSM:", error.message);
    // Return cached value or false on error
    return maintenanceModeCache.value;
  }
}

export async function handler(event) {
  try {
    // Handle CORS preflight
    if (event.requestContext?.http?.method === "OPTIONS") {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
        body: "",
      };
    }

    const maintenanceMode = await getMaintenanceMode();

    const config = {
      quotaLimit: QUOTA_LIMIT,
      uploadIntervalMs: UPLOAD_INTERVAL_MS,
      batchTime: BATCH_TIME,
      maintenanceMode,
      version: {
        minimum: MIN_VERSION,
        latest: LATEST_VERSION,
      },
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300", // 5 minute cache
      },
      body: JSON.stringify(config),
    };
  } catch (error) {
    console.error("Config error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "INTERNAL_ERROR", message: "Failed to get config" }),
    };
  }
}
