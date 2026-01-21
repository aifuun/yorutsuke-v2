/**
 * Unit tests for Permit Format Validation (Issue #154)
 * Run: npm test permitValidation.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validatePermitFormat, isMockPermit } from './permitValidation';
import type { UploadPermit } from './LocalQuota';

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
