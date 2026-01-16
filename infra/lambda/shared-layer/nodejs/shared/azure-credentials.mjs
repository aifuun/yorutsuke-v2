import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { AzureCredentialsSchema } from './schemas.mjs';

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

/**
 * Azure DI Credentials Cache (Lambda container-level)
 * @ai-intent: Cache at container level to avoid repeated Secrets Manager calls
 * Re-initialized on Lambda warm start, persists across invocations on same container
 */
let credentialsCache = {
    secretArn: null,
    credentials: null,
    expiresAt: 0,
};

/**
 * Load Azure DI credentials from AWS Secrets Manager
 *
 * @param {string} secretArn - Secret ARN from ControlTable.azureConfig.secretArn
 * @returns {Promise<{endpoint: string, apiKey: string} | null>}
 *   Returns null if secret not found or validation fails (graceful degradation)
 *
 * @example
 * const creds = await getAzureCredentials('arn:aws:secretsmanager:...');
 * if (creds) {
 *   const result = await analyzeWithAzure(imageBuffer, creds);
 * }
 */
export async function getAzureCredentials(secretArn) {
    // Validate inputs
    if (!secretArn || typeof secretArn !== 'string') {
        return null;
    }

    // Check container-level cache (same Lambda instance)
    const now = Date.now();
    if (credentialsCache.secretArn === secretArn && credentialsCache.credentials && credentialsCache.expiresAt > now) {
        return credentialsCache.credentials;
    }

    try {
        // Load from Secrets Manager
        const response = await secretsClient.send(
            new GetSecretValueCommand({
                SecretId: secretArn,
            })
        );

        // Parse secret string
        let secretValue;
        if (response.SecretString) {
            secretValue = JSON.parse(response.SecretString);
        } else {
            return null; // Binary secrets not supported
        }

        // Validate against schema (Pillar B: Airlock)
        const credentials = AzureCredentialsSchema.parse(secretValue);

        // Cache for 55 minutes (Secrets Manager default rotation is 30 days)
        credentialsCache = {
            secretArn,
            credentials,
            expiresAt: now + 55 * 60 * 1000, // 55 minutes
        };

        return credentials;
    } catch (error) {
        // Graceful degradation: log error but don't throw
        // Azure DI is optional (other models can process the receipt)
        console.error('AZURE_CREDENTIALS_LOAD_ERROR', {
            secretArn,
            error: error.message,
            code: error.code,
        });

        return null;
    }
}

/**
 * Clear credentials cache (for testing or credential rotation)
 *
 * @example
 * await clearAzureCredentialsCache();
 */
export function clearAzureCredentialsCache() {
    credentialsCache = {
        secretArn: null,
        credentials: null,
        expiresAt: 0,
    };
}

/**
 * Get current cache status (for testing/debugging)
 *
 * @returns {object} Cache state with secretArn, isCached, expiresIn
 */
export function getAzureCredentialsCacheStatus() {
    const now = Date.now();
    return {
        secretArn: credentialsCache.secretArn,
        isCached: credentialsCache.credentials !== null && credentialsCache.expiresAt > now,
        expiresIn: Math.max(0, credentialsCache.expiresAt - now),
    };
}
