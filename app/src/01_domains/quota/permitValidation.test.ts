/**
 * Unit tests for Permit Format Validation (Issue #154)
 * Run: npm test permitValidation.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validatePermitFormat, isMockPermit, verifyPermitSignature } from './permitValidation';
import type { UploadPermit } from './LocalQuota';
import crypto from 'crypto';

// Stub isMockMode for testing
vi.stubGlobal('isMockMode', vi.fn(() => false));

// ============================================================
// Helper Functions
// ============================================================

function createValidPermit(overrides?: Partial<UploadPermit>): UploadPermit {
  return {
    userId: 'device-123',
    totalLimit: 500,
    dailyRate: 30,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    issuedAt: new Date().toISOString(),
    signature: 'a'.repeat(64),
    tier: 'guest',
    ...overrides,
  };
}

/**
 * Generate valid HMAC-SHA256 signature for a permit (for testing)
 * Matches server-side implementation in presign/index.mjs:185-187
 */
function generateValidSignature(permit: Partial<UploadPermit>, secretKey: string): string {
  const message = `${permit.userId}:${permit.totalLimit}:${permit.dailyRate}:${permit.expiresAt}:${permit.issuedAt}`;
  return crypto.createHmac('sha256', secretKey).update(message).digest('hex');
}

// ============================================================
// Test Suite 1: validatePermitFormat() - Valid Permits
// ============================================================

describe('validatePermitFormat() - Valid Permits', () => {
  it('V1.1: should accept valid guest permit', () => {
    const permit = createValidPermit({ tier: 'guest' });
    const result = validatePermitFormat(permit);

    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('V1.2: should accept valid pro permit with unlimited daily rate', () => {
    const permit = createValidPermit({ tier: 'pro', totalLimit: 10000, dailyRate: 0 });
    const result = validatePermitFormat(permit);

    expect(result.valid).toBe(true);
  });

  it('V1.3: should accept permit expiring in future', () => {
    const permit = createValidPermit({
      expiresAt: new Date(Date.now() + 1 * 60 * 1000).toISOString(),
    });
    const result = validatePermitFormat(permit);

    expect(result.valid).toBe(true);
  });
});

// ============================================================
// Test Suite 2: validatePermitFormat() - Missing Fields
// ============================================================

describe('validatePermitFormat() - Missing Fields', () => {
  it('M1.1: should reject permit missing userId', () => {
    const permit = createValidPermit();
    delete (permit as any).userId;
    const result = validatePermitFormat(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('userId');
  });

  it('M1.2: should reject permit missing signature', () => {
    const permit = createValidPermit();
    delete (permit as any).signature;
    const result = validatePermitFormat(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('signature');
  });

  it('M1.3: should reject permit missing tier', () => {
    const permit = createValidPermit();
    delete (permit as any).tier;
    const result = validatePermitFormat(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('tier');
  });
});

// ============================================================
// Test Suite 3: validatePermitFormat() - Signature Format
// ============================================================

describe('validatePermitFormat() - Signature Format', () => {
  it('S1.1: should accept 64-character hex signature', () => {
    const permit = createValidPermit({ signature: 'a'.repeat(64) });
    const result = validatePermitFormat(permit);

    expect(result.valid).toBe(true);
  });

  it('S1.2: should accept mixed hex digits', () => {
    const permit = createValidPermit({ signature: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1' });
    const result = validatePermitFormat(permit);

    expect(result.valid).toBe(true);
  });

  it('S1.3: should reject signature with uppercase hex', () => {
    const permit = createValidPermit({ signature: 'A'.repeat(64) });
    const result = validatePermitFormat(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('signature format');
  });

  it('S1.4: should reject signature shorter than 64 chars', () => {
    const permit = createValidPermit({ signature: 'a'.repeat(63) });
    const result = validatePermitFormat(permit);

    expect(result.valid).toBe(false);
  });

  it('S1.5: should reject signature with non-hex characters', () => {
    const permit = createValidPermit({ signature: 'z'.repeat(64) });
    const result = validatePermitFormat(permit);

    expect(result.valid).toBe(false);
  });
});

// ============================================================
// Test Suite 4: validatePermitFormat() - Expiration
// ============================================================

describe('validatePermitFormat() - Expiration', () => {
  it('E1.1: should reject expired permit', () => {
    const permit = createValidPermit({
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const result = validatePermitFormat(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('E1.2: should accept permit expiring in future', () => {
    const permit = createValidPermit({
      expiresAt: new Date(Date.now() + 100).toISOString(),
    });
    const result = validatePermitFormat(permit);

    expect(result.valid).toBe(true);
  });
});

// ============================================================
// Test Suite 5: validatePermitFormat() - Tier Validation
// ============================================================

describe('validatePermitFormat() - Tier Validation', () => {
  it('T1.1: should accept guest tier', () => {
    const permit = createValidPermit({ tier: 'guest' });
    expect(validatePermitFormat(permit).valid).toBe(true);
  });

  it('T1.2: should accept free tier', () => {
    const permit = createValidPermit({ tier: 'free' });
    expect(validatePermitFormat(permit).valid).toBe(true);
  });

  it('T1.3: should accept pro tier', () => {
    const permit = createValidPermit({ tier: 'pro' });
    expect(validatePermitFormat(permit).valid).toBe(true);
  });

  it('T1.4: should reject invalid tier', () => {
    const permit = createValidPermit({ tier: 'invalid' as any });
    const result = validatePermitFormat(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('tier');
  });
});

// ============================================================
// Test Suite 6: validatePermitFormat() - Limits Validation
// ============================================================

describe('validatePermitFormat() - Limits Validation', () => {
  it('L1.1: should accept zero limits', () => {
    const permit = createValidPermit({ totalLimit: 0, dailyRate: 0 });
    expect(validatePermitFormat(permit).valid).toBe(true);
  });

  it('L1.2: should reject negative totalLimit', () => {
    const permit = createValidPermit({ totalLimit: -1 });
    const result = validatePermitFormat(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('non-negative');
  });

  it('L1.3: should reject negative dailyRate', () => {
    const permit = createValidPermit({ dailyRate: -1 });
    const result = validatePermitFormat(permit);

    expect(result.valid).toBe(false);
  });

  it('L1.4: should accept large limits', () => {
    const permit = createValidPermit({ totalLimit: 1000000, dailyRate: 10000 });
    expect(validatePermitFormat(permit).valid).toBe(true);
  });
});

// ============================================================
// Test Suite 7: isMockPermit()
// ============================================================

describe('isMockPermit()', () => {
  it('P1.1: should detect mock permit by signature prefix', () => {
    const permit = createValidPermit({ signature: 'mock-signature-device-123' });
    expect(isMockPermit(permit)).toBe(true);
  });

  it('P1.2: should not detect regular permit as mock', () => {
    const permit = createValidPermit({ signature: 'a'.repeat(64) });
    expect(isMockPermit(permit)).toBe(false);
  });

  it('P1.3: should detect mock permit with various suffixes', () => {
    const permit1 = createValidPermit({ signature: 'mock-signature-xyz' });
    const permit2 = createValidPermit({ signature: 'mock-signature-123-abc-def-ghi' });

    expect(isMockPermit(permit1)).toBe(true);
    expect(isMockPermit(permit2)).toBe(true);
  });
});

// ============================================================
// Test Suite 8: Edge Cases
// ============================================================

describe('validatePermitFormat() - Edge Cases', () => {
  it('E2.1: should handle very long userId', () => {
    const permit = createValidPermit({ userId: 'a'.repeat(1000) });
    expect(validatePermitFormat(permit).valid).toBe(true);
  });

  it('E2.2: should handle empty string userId', () => {
    const permit = createValidPermit({ userId: '' });
    // Empty string is still a valid field (exists)
    expect(validatePermitFormat(permit).valid).toBe(true);
  });

  it('E2.3: should handle null values', () => {
    const permit = createValidPermit({ tier: null as any });
    expect(validatePermitFormat(permit).valid).toBe(false);
  });
});

// ============================================================
// Test Suite 9: HMAC-SHA256 Signature Verification
// ============================================================

describe('verifyPermitSignature() - HMAC-SHA256 Verification', () => {
  const TEST_SECRET_KEY = 'my-secret-key-for-hmac-sha256';

  it('H1.1: should verify correct signature', async () => {
    const permit = createValidPermit({
      userId: 'user-abc123',
      totalLimit: 1000,
      dailyRate: 50,
    });

    // Generate valid signature with test secret key
    const validSignature = generateValidSignature(permit, TEST_SECRET_KEY);
    const permitWithValidSig = { ...permit, signature: validSignature };

    const isValid = await verifyPermitSignature(permitWithValidSig, TEST_SECRET_KEY);
    expect(isValid).toBe(true);
  });

  it('H1.2: should reject incorrect signature', async () => {
    const permit = createValidPermit({
      userId: 'user-abc123',
      totalLimit: 1000,
      dailyRate: 50,
      signature: 'wrong' + 'a'.repeat(60), // Invalid signature
    });

    const isValid = await verifyPermitSignature(permit, TEST_SECRET_KEY);
    expect(isValid).toBe(false);
  });

  it('H1.3: should reject signature signed with different secret key', async () => {
    const permit = createValidPermit({
      userId: 'user-abc123',
      totalLimit: 1000,
      dailyRate: 50,
    });

    // Sign with one key
    const signatureWithKey1 = generateValidSignature(permit, 'secret-key-1');
    const permitWithSig1 = { ...permit, signature: signatureWithKey1 };

    // Try to verify with different key (should fail)
    const isValid = await verifyPermitSignature(permitWithSig1, 'secret-key-2');
    expect(isValid).toBe(false);
  });

  it('H1.4: should reject when userId is modified', async () => {
    const permit = createValidPermit({
      userId: 'user-original',
      totalLimit: 1000,
      dailyRate: 50,
    });

    // Sign original permit
    const validSignature = generateValidSignature(permit, TEST_SECRET_KEY);

    // Modify userId and try with same signature (signature should now be invalid)
    const tamperedPermit = { ...permit, userId: 'user-modified', signature: validSignature };

    const isValid = await verifyPermitSignature(tamperedPermit, TEST_SECRET_KEY);
    expect(isValid).toBe(false);
  });

  it('H1.5: should reject when totalLimit is modified', async () => {
    const permit = createValidPermit({
      userId: 'user-abc123',
      totalLimit: 1000,
      dailyRate: 50,
    });

    const validSignature = generateValidSignature(permit, TEST_SECRET_KEY);

    // Modify totalLimit with same signature
    const tamperedPermit = { ...permit, totalLimit: 2000, signature: validSignature };

    const isValid = await verifyPermitSignature(tamperedPermit, TEST_SECRET_KEY);
    expect(isValid).toBe(false);
  });

  it('H1.6: should reject when dailyRate is modified', async () => {
    const permit = createValidPermit({
      userId: 'user-abc123',
      totalLimit: 1000,
      dailyRate: 50,
    });

    const validSignature = generateValidSignature(permit, TEST_SECRET_KEY);

    // Modify dailyRate with same signature
    const tamperedPermit = { ...permit, dailyRate: 100, signature: validSignature };

    const isValid = await verifyPermitSignature(tamperedPermit, TEST_SECRET_KEY);
    expect(isValid).toBe(false);
  });

  it('H1.7: should reject when expiresAt is modified', async () => {
    const permit = createValidPermit({
      userId: 'user-abc123',
      totalLimit: 1000,
      dailyRate: 50,
    });

    const validSignature = generateValidSignature(permit, TEST_SECRET_KEY);

    // Modify expiresAt with same signature
    const tamperedPermit = {
      ...permit,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      signature: validSignature,
    };

    const isValid = await verifyPermitSignature(tamperedPermit, TEST_SECRET_KEY);
    expect(isValid).toBe(false);
  });

  it('H1.8: should reject when issuedAt is modified', async () => {
    const permit = createValidPermit({
      userId: 'user-abc123',
      totalLimit: 1000,
      dailyRate: 50,
    });

    const validSignature = generateValidSignature(permit, TEST_SECRET_KEY);

    // Modify issuedAt with same signature
    const tamperedPermit = {
      ...permit,
      issuedAt: new Date(Date.now() - 1000).toISOString(),
      signature: validSignature,
    };

    const isValid = await verifyPermitSignature(tamperedPermit, TEST_SECRET_KEY);
    expect(isValid).toBe(false);
  });

  it('H1.9: should accept mock permit signature (always valid)', async () => {
    const permit = createValidPermit({
      userId: 'user-abc123',
      signature: 'mock-signature-device-123',
    });

    // Mock permits always verify regardless of secret key
    const isValid = await verifyPermitSignature(permit, 'any-secret-key');
    expect(isValid).toBe(true);
  });

  it('H1.10: should handle various permitted values', async () => {
    const testCases = [
      { userId: 'device-xyz789', totalLimit: 100, dailyRate: 10 },
      { userId: 'user-pro', totalLimit: 10000, dailyRate: 0 }, // Pro tier unlimited daily
      { userId: 'user-free', totalLimit: 1000, dailyRate: 50 },
    ];

    for (const testCase of testCases) {
      const permit = createValidPermit(testCase);
      const validSignature = generateValidSignature(permit, TEST_SECRET_KEY);
      const permitWithSig = { ...permit, signature: validSignature };

      const isValid = await verifyPermitSignature(permitWithSig, TEST_SECRET_KEY);
      expect(isValid).toBe(true);
    }
  });

  it('H1.11: should reject signature with wrong length', async () => {
    const permit = createValidPermit({
      userId: 'user-abc123',
      totalLimit: 1000,
      dailyRate: 50,
      signature: 'abc'.repeat(20), // Wrong length (60 chars vs 64)
    });

    const isValid = await verifyPermitSignature(permit, TEST_SECRET_KEY);
    expect(isValid).toBe(false);
  });

  it('H1.12: should reject permit signed with different key', async () => {
    const permit = createValidPermit({
      userId: 'user-abc123',
      totalLimit: 1000,
      dailyRate: 50,
    });

    // Generate signature with key-1
    const signatureWithKey1 = generateValidSignature(permit, 'secret-key-1');
    const permitWithSig = { ...permit, signature: signatureWithKey1 };

    // Verify with different key-2 (should fail)
    const isInvalid = await verifyPermitSignature(permitWithSig, 'secret-key-2');
    expect(isInvalid).toBe(false);

    // Verify with original key-1 (should pass)
    const isValid = await verifyPermitSignature(permitWithSig, 'secret-key-1');
    expect(isValid).toBe(true);
  });
});
