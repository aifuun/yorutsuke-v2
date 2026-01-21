/**
 * Admin Model Config Lambda (Phase 4 - P2)
 *
 * Allows admins to configure processing mode and model selection:
 * - GET /admin/model-config - Get current config
 * - POST /admin/model-config - Update config
 * - Schema validation (Pillar B)
 * - Backward compatibility: modelId → primaryModelId
 * - Cognito authorization required
 *
 * @ai-intent: Dynamic model selection without redeploying Lambda
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { logger, EVENTS, initContext } from '/opt/nodejs/shared/logger.mjs';
import { SystemConfigSchema } from '/opt/nodejs/shared/schemas.mjs';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from './types/aws-events.js';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const CONTROL_TABLE = process.env.CONTROL_TABLE_NAME;

/**
 * System Configuration interface
 */
interface SystemConfig {
  processingMode: 'instant';
  primaryModelId: string;
  azureConfig: null | Record<string, unknown>;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: SystemConfig = {
  processingMode: 'instant', // Only instant mode supported (batch removed)
  primaryModelId: 'us.amazon.nova-lite-v1:0',
  azureConfig: null,
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
};

/**
 * Lambda handler
 * GET /admin/model-config - Get config
 * POST /admin/model-config - Update config
 */
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const ctx = initContext(event);
  logger.info(EVENTS.API_REQUEST_RECEIVED, {
    method: event.requestContext?.http?.method,
    path: event.requestContext?.http?.path,
  });

  const method = event.requestContext?.http?.method;

  try {
    if (method === 'GET') {
      return await getConfig();
    } else if (method === 'POST') {
      const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
      const userId = event.requestContext?.authorizer?.claims?.sub || 'anonymous';
      return await updateConfig(body, userId);
    } else if (method === 'OPTIONS') {
      // CORS preflight
      return response(200, {});
    } else {
      return response(405, { error: 'Method not allowed' });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(EVENTS.UNEXPECTED_ERROR, {
      error: errorMessage,
      stack: errorStack,
    });
    return response(500, { error: 'Internal server error' });
  }
};

/**
 * Get current configuration (or initialize default)
 */
async function getConfig(): Promise<APIGatewayProxyResultV2> {
  const result = await ddb.send(
    new GetCommand({
      TableName: CONTROL_TABLE,
      Key: { key: 'system_config' },
    })
  );

  if (!result.Item) {
    logger.info('MODEL_CONFIG_INIT_DEFAULT', {
      message: 'Initializing default config in ControlTable',
    });
    const config = { ...DEFAULT_CONFIG, key: 'system_config' };
    await ddb.send(
      new PutCommand({
        TableName: CONTROL_TABLE,
        Item: config,
      })
    );
    const { key, ...rest } = config;
    return response(200, rest);
  }

  const { key, ...config } = result.Item;
  return response(200, config);
}

/**
 * Update configuration with validation
 */
async function updateConfig(
  body: Record<string, unknown>,
  userId: string
): Promise<APIGatewayProxyResultV2> {
  // 1. Get current config for merging
  const currentResult = await ddb.send(
    new GetCommand({
      TableName: CONTROL_TABLE,
      Key: { key: 'system_config' },
    })
  );
  const current = currentResult.Item || { ...DEFAULT_CONFIG, key: 'system_config' };

  // 2. Prepare update
  let updateData: Record<string, unknown> = {
    ...current,
    ...body,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };

  // 2.5 Backward compatibility: migrate old modelId to primaryModelId
  // @ai-intent: Support old field names during migration period (1 sprint)
  if (updateData.modelId && !updateData.primaryModelId) {
    updateData.primaryModelId = updateData.modelId;
    logger.info('MIGRATED_MODEL_ID_TO_PRIMARY', { userId });
  }

  // 3. Validate with Zod (Pillar B: Airlock)
  try {
    const validated = SystemConfigSchema.parse(updateData);

    // 4. Save to DynamoDB
    await ddb.send(
      new PutCommand({
        TableName: CONTROL_TABLE,
        Item: {
          key: 'system_config',
          ...validated,
        },
      })
    );

    logger.info('MODEL_CONFIG_UPDATED', {
      userId,
      mode: validated.processingMode,
    });
    return response(200, validated);
  } catch (zodError: unknown) {
    // Handle Zod validation errors
    if (zodError && typeof zodError === 'object' && 'errors' in zodError) {
      logger.warn(EVENTS.AIRLOCK_BREACH, {
        errors: (zodError as any).errors,
        userId,
      });
      return response(400, { errors: (zodError as any).errors });
    }

    // Generic error
    const errorMessage = zodError instanceof Error ? zodError.message : 'Unknown error';
    logger.error('MODEL_CONFIG_UPDATE_FAILED', {
      error: errorMessage,
      userId,
    });
    return response(500, { error: 'Failed to update config' });
  }
}

/**
 * Format response with CORS headers
 */
function response(
  statusCode: number,
  body: Record<string, unknown>
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(body),
  };
}
