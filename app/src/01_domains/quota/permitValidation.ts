/**
 * Permit Format Validation (Issue #154)
 *
 * Validates permit structure before accepting it for storage.
 * Uses format-only validation (not HMAC) because client cannot safely
 * store the HMAC secret key. Server validates actual HMAC signatures
 * in presign Lambda (defense in depth).
 *
 * @see ADR-017: Permit-Based Quota System
 * @see docs/operations/QUOTA.md
 */

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
  // Note: Using dynamic import to avoid circular dependency with mock.ts
  if (isMockPermit(permit)) {
    // Lazy load isMockMode to avoid module cycle
    const { isMockMode: isMockModeFn } = require('../../00_kernel/config/mock');
    if (!isMockModeFn()) {
      return {
        valid: false,
        reason: 'Mock permit only valid in mock mode',
      };
    }
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
