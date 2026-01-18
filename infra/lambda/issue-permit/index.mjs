/**
 * Issue Permit Lambda
 *
 * Generates signed upload permits for users based on their tier.
 * Permits include total quota, daily rate, expiration, and HMAC signature.
 */

import crypto from 'crypto';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

// Tier configurations
const TIER_CONFIGS = {
  guest: { totalLimit: 500, dailyRate: 30, validDays: 30 },
  free: { totalLimit: 1000, dailyRate: 50, validDays: 30 },
  basic: { totalLimit: 3000, dailyRate: 100, validDays: 30 },
  pro: { totalLimit: 10000, dailyRate: 0, validDays: 30 }, // 0 = unlimited daily
};

// Cache for secret key (Lambda container reuse)
let cachedSecretKey = null;

const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

/**
 * Retrieve PERMIT_SECRET_KEY from AWS Secrets Manager
 */
async function getSecretKey() {
  if (cachedSecretKey) return cachedSecretKey;

  const secretArn = process.env.PERMIT_SECRET_KEY_ARN;
  if (!secretArn) {
    throw new Error('PERMIT_SECRET_KEY_ARN environment variable not set');
  }

  try {
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretArn })
    );
    cachedSecretKey = response.SecretString;
    return cachedSecretKey;
  } catch (error) {
    console.error('Failed to retrieve secret key:', error);
    throw new Error('Failed to retrieve permit secret key');
  }
}

/**
 * Determine user tier based on userId
 *
 * Logic:
 * - device-* → guest
 * - user-* → Check users table (future), default to free for now
 *
 * TODO: Query DynamoDB users table for authenticated users' subscription tier
 */
export function getUserTier(userId) {
  if (userId.startsWith('device-')) {
    return 'guest';
  }

  if (userId.startsWith('user-')) {
    // TODO: Query DynamoDB users table
    // const user = await usersTable.get(userId);
    // return user.tier || 'free';
    return 'free'; // Default for MVP
  }

  throw new Error(`Invalid userId format: ${userId}`);
}

/**
 * Sign a permit using HMAC-SHA256
 *
 * Message format: userId:totalLimit:dailyRate:expiresAt:issuedAt
 */
export function signPermit(userId, totalLimit, dailyRate, expiresAt, issuedAt, secretKey) {
  // Parameter validation (fixes T8.1, T8.2)
  if (userId === null || userId === undefined) {
    throw new Error('userId is required');
  }

  const message = `${userId}:${totalLimit}:${dailyRate}:${expiresAt}:${issuedAt}`;
  return crypto.createHmac('sha256', secretKey).update(message).digest('hex');
}

/**
 * Verify permit signature using a single secret key
 *
 * @param {object} permit - Permit object with signature
 * @param {string} secretKey - Secret key for verification
 * @returns {boolean} True if signature is valid
 */
export function verifyPermitSignature(permit, secretKey) {
  // Field validation (fixes T11.5)
  const requiredFields = ['userId', 'totalLimit', 'dailyRate', 'expiresAt', 'issuedAt', 'signature'];
  for (const field of requiredFields) {
    if (!(field in permit)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  const message = `${permit.userId}:${permit.totalLimit}:${permit.dailyRate}:${permit.expiresAt}:${permit.issuedAt}`;
  const expectedSignature = crypto.createHmac('sha256', secretKey).update(message).digest('hex');
  return permit.signature === expectedSignature;
}

/**
 * Verify permit signature with multiple keys (for key rotation)
 *
 * @param {object} permit - Permit object with signature
 * @param {string[]} secretKeys - Array of secret keys to try
 * @returns {boolean} True if any key validates the signature
 */
export function verifyPermitSignatureMultiKey(permit, secretKeys) {
  for (const secretKey of secretKeys) {
    if (verifyPermitSignature(permit, secretKey)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a permit has expired
 *
 * @param {string} expiresAt - ISO 8601 expiration timestamp
 * @returns {boolean} True if expired
 */
export function isPermitExpired(expiresAt) {
  return new Date(expiresAt).getTime() < Date.now();
}

/**
 * Generate an upload permit for a user
 *
 * @param {string} userId - User identifier (device-* or user-*)
 * @param {number} [validDays] - Permit validity period (default: tier config)
 * @returns {Promise<object>} Generated permit
 */
export async function issuePermit(userId, validDays = null) {
  // 1. Determine tier
  const tier = getUserTier(userId);
  const config = TIER_CONFIGS[tier];

  if (!config) {
    throw new Error(`Unknown tier: ${tier}`);
  }

  // 2. Calculate timestamps
  const issuedAt = new Date().toISOString();
  // Use provided validDays or default from config
  const effectiveValidDays = validDays !== null ? validDays : config.validDays;
  const expiresAt = new Date(
    Date.now() + effectiveValidDays * 24 * 60 * 60 * 1000
  ).toISOString();

  // 3. Get secret key
  const secretKey = await getSecretKey();

  // 4. Generate signature
  const signature = signPermit(
    userId,
    config.totalLimit,
    config.dailyRate,
    expiresAt,
    issuedAt,
    secretKey
  );

  // 5. Construct permit
  const permit = {
    userId,
    totalLimit: config.totalLimit,
    dailyRate: config.dailyRate,
    expiresAt,
    issuedAt,
    signature,
    tier,
  };

  return permit;
}

/**
 * Lambda handler
 */
export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle CORS preflight
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { userId, validDays } = body;

    // Validate userId
    if (!userId || typeof userId !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'INVALID_REQUEST',
          message: 'Missing or invalid userId',
        }),
      };
    }

    // Validate userId format
    if (!userId.startsWith('device-') && !userId.startsWith('user-')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'INVALID_USER_ID',
          message: 'userId must start with device- or user-',
        }),
      };
    }

    // Validate validDays (optional, must be positive integer if provided)
    if (validDays !== undefined && validDays !== null) {
      if (typeof validDays !== 'number' || validDays <= 0 || !Number.isInteger(validDays)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'INVALID_VALID_DAYS',
            message: 'validDays must be a positive integer',
          }),
        };
      }
    }

    // Issue permit
    const permit = await issuePermit(userId, validDays);

    // Log permit issuance (for monitoring)
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'PERMIT_ISSUED',
        userId,
        tier: permit.tier,
        totalLimit: permit.totalLimit,
        dailyRate: permit.dailyRate,
        expiresAt: permit.expiresAt,
      })
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ permit }),
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'PERMIT_ISSUE_FAILED',
        error: error.message,
        stack: error.stack,
      })
    );

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: 'Failed to issue permit',
      }),
    };
  }
}
