import { SecretsManagerClient, PutSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { logger, EVENTS, initContext } from "/opt/nodejs/shared/logger.mjs";
import { AzureCredentialsSchema } from "/opt/nodejs/shared/schemas.mjs";

const secretsClient = new SecretsManagerClient({});
const AZURE_SECRET_ARN = process.env.AZURE_CREDENTIALS_SECRET_ARN;

/**
 * Admin Lambda: Azure DI Credentials Management
 * Allows admins to update Azure credentials without redeploying Lambda
 * Credentials are stored in AWS Secrets Manager for security
 *
 * @ai-intent: Support runtime credential rotation without code changes
 */
export const handler = async (event) => {
    const ctx = initContext(event);
    logger.info(EVENTS.API_REQUEST_RECEIVED, {
        method: event.requestContext?.http?.method,
        path: event.requestContext?.http?.path,
        userId: event.requestContext?.authorizer?.claims?.sub
    });

    const method = event.requestContext?.http?.method || event.httpMethod;

    try {
        if (method === 'POST') {
            const userId = event.requestContext?.authorizer?.claims?.sub || 'anonymous';
            const body = JSON.parse(event.body || '{}');
            return await updateAzureCredentials(body, userId);
        } else if (method === 'OPTIONS') {
            // CORS preflight
            return corsResponse(200, {});
        } else {
            return corsResponse(405, { error: 'Method not allowed' });
        }
    } catch (error) {
        logger.error(EVENTS.UNEXPECTED_ERROR, {
            error: error.message,
            stack: error.stack
        });
        return corsResponse(500, { error: 'Internal server error' });
    }
};

async function updateAzureCredentials(body, userId) {
    try {
        // 1. Validate credentials against schema (Pillar B: Airlock)
        const credentials = AzureCredentialsSchema.parse(body);

        logger.info("AZURE_CREDENTIALS_UPDATE_ATTEMPT", {
            userId,
            endpoint: credentials.endpoint.substring(0, 50),
        });

        // 2. Update Secrets Manager
        // @ai-intent: Only store endpoint and API key, metadata in logs
        if (!AZURE_SECRET_ARN) {
            logger.warn("AZURE_SECRET_ARN_NOT_CONFIGURED", { userId });
            return corsResponse(500, { error: 'Azure credentials not configured' });
        }

        await secretsClient.send(
            new PutSecretValueCommand({
                SecretId: AZURE_SECRET_ARN,
                SecretString: JSON.stringify(credentials),
            })
        );

        // 3. Log successful update (never log full API key)
        logger.info("AZURE_CREDENTIALS_UPDATED", {
            userId,
            endpoint: credentials.endpoint.substring(0, 50),
            timestamp: new Date().toISOString(),
        });

        return corsResponse(200, {
            success: true,
            message: 'Azure credentials updated successfully',
            endpoint: credentials.endpoint.substring(0, 50), // Truncated for safety
        });
    } catch (error) {
        // Handle validation errors
        if (error.errors) {
            logger.warn(EVENTS.AIRLOCK_BREACH, {
                errors: error.errors,
                userId,
            });
            return corsResponse(400, { error: 'Invalid credentials', details: error.errors });
        }

        // Handle Secrets Manager errors
        if (error.name === 'ResourceNotFoundException') {
            logger.warn("AZURE_SECRET_NOT_FOUND", {
                secretArn: AZURE_SECRET_ARN,
                userId,
            });
            return corsResponse(404, { error: 'Azure credentials secret not found' });
        }

        // Generic error
        logger.error("AZURE_CREDENTIALS_UPDATE_FAILED", {
            error: error.message,
            userId,
        });
        return corsResponse(500, { error: 'Failed to update credentials' });
    }
}

function corsResponse(statusCode, body) {
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
