/**
 * Permit Validation (Issue #154)
 *
 * Two-layer validation:
 * 1. Format validation: Structure checks (required fields, types, ranges)
 *    - Always performed client-side
 *    - Fast, no secret key needed
 *
 * 2. HMAC-SHA256 signature verification: Cryptographic integrity check
 *    - Client-side (if secret key provided, e.g., in tests)
 *    - Server-side in presign Lambda (always performed, defense in depth)
 *
 * Security Model:
 * - Production: secretKey never leaves Secrets Manager
 * - Testing: secretKey can be provided to verify signature logic
 * - Client cannot safely store or use secretKey in production
 *
 * @see ADR-017: Permit-Based Quota System
 * @see docs/operations/QUOTA.md
 */

import { isMockMode } from '../../00_kernel/config/mock';
import type { UploadPermit } from './LocalQuota';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate permit format before storing
 *
 * Checks:
 * 1. All required fields present
 * 2. Signature format valid (64 hex chars or mock pattern)
 * 3. Mock permits only valid in mock mode
 * 4. Permit not expired
 *
 * Does NOT validate:
 * - HMAC-SHA256 signature (server validates in presign Lambda)
 * - Tier matches user record (server validates)
 * - Permit revocation status (server validates)
 */
export function validatePermitFormat(permit: UploadPermit): ValidationResult {
  // 1. Check all required fields present
  const requiredFields = [
    'userId',
    'totalLimit',
    'dailyRate',
    'expiresAt',
    'issuedAt',
    'signature',
    'tier',
  ] as const;

  for (const field of requiredFields) {
    if (!(field in permit) || permit[field] === undefined) {
      return { valid: false, reason: `Missing required field: ${field}` };
    }
  }

  // 2. Validate signature format
  const signatureValid = /^[0-9a-f]{64}$/.test(permit.signature) ||
    permit.signature.startsWith('mock-signature-');

  if (!signatureValid) {
    return {
      valid: false,
      reason: `Invalid signature format: expected 64 hex chars or mock pattern, got "${permit.signature}"`,
    };
  }

  // 3. Reject mock permit if not in mock mode
  if (isMockPermit(permit) && !isMockMode()) {
    return {
      valid: false,
      reason: 'Mock permit only valid in mock mode',
    };
  }

  // 4. Check expiry
  const expiresAt = new Date(permit.expiresAt).getTime();
  if (expiresAt < Date.now()) {
    return { valid: false, reason: 'Permit expired' };
  }

  // 5. Validate tier value
  const validTiers = ['guest', 'free', 'basic', 'pro'];
  if (!validTiers.includes(permit.tier)) {
    return { valid: false, reason: `Invalid tier: ${permit.tier}` };
  }

  // 6. Validate numbers are non-negative
  if (permit.totalLimit < 0 || permit.dailyRate < 0) {
    return { valid: false, reason: 'Limits must be non-negative' };
  }

  return { valid: true };
}

/**
 * Check if permit is a mock permit by signature pattern
 */
export function isMockPermit(permit: UploadPermit): boolean {
  return permit.signature.startsWith('mock-signature-');
}

/**
 * Verify HMAC-SHA256 signature of permit
 *
 * Used in testing and optional client-side verification.
 * In production, server-side verification in presign Lambda is authoritative.
 *
 * Signature covers: userId:totalLimit:dailyRate:expiresAt:issuedAt
 *
 * Environment detection:
 * - Browser (SubtleCrypto): Production and in-browser testing
 * - Node.js (crypto module): Testing environment (Vitest)
 *
 * @param permit - Permit with signature to verify
 * @param secretKey - HMAC secret key (must match server key)
 * @returns true if signature is valid, false otherwise
 *
 * @example
 * const isValid = await verifyPermitSignature(permit, secretKey);
 * if (!isValid) {
 *   throw new Error('Permit signature verification failed');
 * }
 */
export async function verifyPermitSignature(
  permit: UploadPermit,
  secretKey: string
): Promise<boolean> {
  try {
    // Mock permits always verify (they don't have real signatures)
    if (isMockPermit(permit)) {
      return true;
    }

    // Construct message exactly as server does (order matters!)
    const message = `${permit.userId}:${permit.totalLimit}:${permit.dailyRate}:${permit.expiresAt}:${permit.issuedAt}`;

    // Detect environment and use appropriate HMAC implementation
    let computedSignature: string;

    // Browser environment with SubtleCrypto
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      computedSignature = await verifyWithSubtleCrypto(message, secretKey);
    }
    // Node.js environment (testing)
    else if (typeof require !== 'undefined') {
      computedSignature = verifyWithNodeCrypto(message, secretKey);
    }
    // Fallback: can't verify in this environment
    else {
      console.warn('HMAC verification not available in this environment');
      return false;
    }

    // Compare signatures (constant-time comparison to prevent timing attacks)
    return constantTimeCompare(permit.signature, computedSignature);
  } catch (error) {
    console.error('Permit signature verification failed:', error);
    return false;
  }
}

/**
 * Verify HMAC using browser SubtleCrypto API
 * @internal
 */
async function verifyWithSubtleCrypto(message: string, secretKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(message);

  const key = await window.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await window.crypto.subtle.sign('HMAC', key, messageData);
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify HMAC using Node.js crypto module
 * @internal
 */
function verifyWithNodeCrypto(message: string, secretKey: string): string {
  // Dynamic import for Node.js crypto (works in both browser and Node)
  // This is safe because we only call this in Node.js environment
  const crypto = require('crypto') as typeof import('crypto');
  return crypto.createHmac('sha256', secretKey).update(message).digest('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @internal
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
