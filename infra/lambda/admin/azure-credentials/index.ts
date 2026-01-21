/**
 * Admin Azure Credentials Lambda (Phase 4 - P2)
 *
 * Allows admins to update Azure DI credentials without redeploying Lambda:
 * - POST /admin/azure-credentials - Update credentials
 * - Credentials stored in AWS Secrets Manager
 * - Schema validation (Pillar B)
 * - Security: Never log full API keys
 * - Cognito authorization required
 *
 * @ai-intent: Support runtime credential rotation without code changes
 */

import {
  SecretsManagerClient,
  PutSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { logger, EVENTS, initContext } from '/opt/nodejs/shared/logger.mjs';
import { AzureCredentialsSchema } from '/opt/nodejs/shared/schemas.mjs';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from './types/aws-events.js';

const secretsClient = new SecretsManagerClient({});
const AZURE_SECRET_ARN = process.env.AZURE_CREDENTIALS_SECRET_ARN;

/**
 * Azure credentials interface
 */
interface AzureCredentials {
  endpoint: string;
  apiKey: string;
}

/**
 * Lambda handler
 * POST /admin/azure-credentials
 */
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const ctx = initContext(event);
  logger.info(EVENTS.API_REQUEST_RECEIVED, {
    method: event.requestContext?.http?.method,
    path: event.requestContext?.http?.path,
    userId: event.requestContext?.authorizer?.claims?.sub,
  });

  const method = event.requestContext?.http?.method;

  try {
    if (method === 'POST') {
      const userId =
        event.requestContext?.authorizer?.claims?.sub || 'anonymous';
      const body = JSON.parse(event.body || '{}') as Record<string, unknown>;
      return await updateAzureCredentials(body, userId);
    } else if (method === 'OPTIONS') {
      // CORS preflight
      return corsResponse(200, {});
    } else {
      return corsResponse(405, { error: 'Method not allowed' });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(EVENTS.UNEXPECTED_ERROR, {
      error: errorMessage,
      stack: errorStack,
    });
    return corsResponse(500, { error: 'Internal server error' });
  }
};

async function updateAzureCredentials(
  body: Record<string, unknown>,
  userId: string
): Promise<APIGatewayProxyResultV2> {
  try {
    // 1. Validate credentials against schema (Pillar B: Airlock)
    const credentials = AzureCredentialsSchema.parse(body) as AzureCredentials;

    logger.info('AZURE_CREDENTIALS_UPDATE_ATTEMPT', {
      userId,
      endpoint: credentials.endpoint.substring(0, 50),
    });

    // 2. Update Secrets Manager
    // @ai-intent: Only store endpoint and API key, metadata in logs
    if (!AZURE_SECRET_ARN) {
      logger.warn('AZURE_SECRET_ARN_NOT_CONFIGURED', { userId });
      return corsResponse(500, { error: 'Azure credentials not configured' });
    }

    await secretsClient.send(
      new PutSecretValueCommand({
        SecretId: AZURE_SECRET_ARN,
        SecretString: JSON.stringify(credentials),
      })
    );

    // 3. Log successful update (never log full API key)
    logger.info('AZURE_CREDENTIALS_UPDATED', {
      userId,
      endpoint: credentials.endpoint.substring(0, 50),
      timestamp: new Date().toISOString(),
    });

    return corsResponse(200, {
      success: true,
      message: 'Azure credentials updated successfully',
      endpoint: credentials.endpoint.substring(0, 50), // Truncated for safety
    });
  } catch (error: unknown) {
    // Handle validation errors
    if (error && typeof error === 'object' && 'errors' in error) {
      logger.warn(EVENTS.AIRLOCK_BREACH, {
        errors: (error as any).errors,
        userId,
      });
      return corsResponse(400, {
        error: 'Invalid credentials',
        details: (error as any).errors,
      });
    }

    // Handle Secrets Manager errors
    if (error instanceof Error && error.name === 'ResourceNotFoundException') {
      logger.warn('AZURE_SECRET_NOT_FOUND', {
        secretArn: AZURE_SECRET_ARN,
        userId,
      });
      return corsResponse(404, { error: 'Azure credentials secret not found' });
    }

    // Generic error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('AZURE_CREDENTIALS_UPDATE_FAILED', {
      error: errorMessage,
      userId,
    });
    return corsResponse(500, { error: 'Failed to update credentials' });
  }
}

function corsResponse(
  statusCode: number,
  body: Record<string, unknown>
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    body: JSON.stringify(body),
  };
}
