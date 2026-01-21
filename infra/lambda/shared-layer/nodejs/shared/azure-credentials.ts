import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { AzureCredentialsSchema, type AzureCredentials } from './schemas.js';

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

/**
 * Azure DI Credentials Cache (Lambda container-level)
 * @ai-intent: Cache at container level to avoid repeated Secrets Manager calls
 * Re-initialized on Lambda warm start, persists across invocations on same container
 */
interface CredentialsCache {
  secretArn: string | null;
  credentials: AzureCredentials | null;
  expiresAt: number;
}

let credentialsCache: CredentialsCache = {
  secretArn: null,
  credentials: null,
  expiresAt: 0,
};

/**
 * Cache status for debugging
 */
export interface CacheStatus {
  secretArn: string | null;
  isCached: boolean;
  expiresIn: number;
}

/**
 * Load Azure DI credentials from AWS Secrets Manager
 *
 * @param secretArn - Secret ARN from ControlTable.azureConfig.secretArn
 * @returns Azure credentials or null if not found/invalid (graceful degradation)
 *
 * @example
 * const creds = await getAzureCredentials('arn:aws:secretsmanager:...');
 * if (creds) {
 *   const result = await analyzeWithAzure(imageBuffer, creds);
 * }
 */
export async function getAzureCredentials(secretArn: string): Promise<AzureCredentials | null> {
  // Validate inputs
  if (!secretArn || typeof secretArn !== 'string') {
    return null;
  }

  // Check container-level cache (same Lambda instance)
  const now = Date.now();
  if (
    credentialsCache.secretArn === secretArn &&
    credentialsCache.credentials &&
    credentialsCache.expiresAt > now
  ) {
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
    let secretValue: unknown;
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
  } catch (error: unknown) {
    // Graceful degradation: log error but don't throw
    // Azure DI is optional (other models can process the receipt)
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode =
      error && typeof error === 'object' && 'code' in error
        ? (error as { code?: string }).code
        : undefined;

    console.error('AZURE_CREDENTIALS_LOAD_ERROR', {
      secretArn,
      error: errorMessage,
      code: errorCode,
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
export function clearAzureCredentialsCache(): void {
  credentialsCache = {
    secretArn: null,
    credentials: null,
    expiresAt: 0,
  };
}

/**
 * Get current cache status (for testing/debugging)
 *
 * @returns Cache state with secretArn, isCached, expiresIn
 */
export function getAzureCredentialsCacheStatus(): CacheStatus {
  const now = Date.now();
  return {
    secretArn: credentialsCache.secretArn,
    isCached: credentialsCache.credentials !== null && credentialsCache.expiresAt > now,
    expiresIn: Math.max(0, credentialsCache.expiresAt - now),
  };
}
