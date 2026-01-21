import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { logger, initContext, EVENTS } from '/opt/nodejs/shared/logger.mjs';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from './types/aws-events.js';

const ssm = new SSMClient({});

/**
 * Config response interface
 */
interface ConfigResponse {
  quotaLimit: number;
  uploadIntervalMs: number;
  batchTime: string;
  maintenanceMode: boolean;
  version: {
    minimum: string;
    latest: string;
  };
}

/**
 * Maintenance mode cache
 */
interface MaintenanceModeCache {
  value: boolean;
  expiresAt: number;
}

// Cache for SSM parameter (5 minutes)
let maintenanceModeCache: MaintenanceModeCache = { value: false, expiresAt: 0 };
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get maintenance mode from SSM Parameter Store with caching
 */
async function getMaintenanceMode(): Promise<boolean> {
  const MAINTENANCE_MODE_PARAM = process.env.MAINTENANCE_MODE_PARAM;

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

    const value = result.Parameter?.Value === 'true';
    maintenanceModeCache = {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    return value;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(EVENTS.MAINTENANCE_MODE_FETCH_FAILED, { error: errorMessage });
    // Return cached value or false on error
    return maintenanceModeCache.value;
  }
}

/**
 * Reset cache (for testing)
 */
export function resetCache(): void {
  maintenanceModeCache = { value: false, expiresAt: 0 };
}

/**
 * Lambda handler
 * GET /config - Returns application configuration
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  initContext(event);

  try {
    // Handle CORS preflight
    if (event.requestContext?.http?.method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: '',
      };
    }

    // Read config from environment variables (lazy evaluation for testability)
    const QUOTA_LIMIT = parseInt(process.env.QUOTA_LIMIT || '50');
    const UPLOAD_INTERVAL_MS = parseInt(process.env.UPLOAD_INTERVAL_MS || '10000');
    const BATCH_TIME = process.env.BATCH_TIME || '02:00';
    const MIN_VERSION = process.env.MIN_VERSION || '1.0.0';
    const LATEST_VERSION = process.env.LATEST_VERSION || '1.1.0';

    const maintenanceMode = await getMaintenanceMode();

    const config: ConfigResponse = {
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
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300', // 5 minute cache
      },
      body: JSON.stringify(config),
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(EVENTS.CONFIG_ERROR, { error: errorMessage });
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Failed to get config' }),
    };
  }
}
