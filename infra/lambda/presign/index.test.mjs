/**
 * Unit tests for presign Lambda - Permit Signature Validation
 * Focus: validatePermit() function that verifies HMAC signatures
 * Run: npx vitest
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';

// ============================================================
// Mock implementations (to avoid AWS SDK dependencies)
// ============================================================

const secretKey = 'test-secret-key-for-presign-validation';

// Helper to sign a permit (same as issue-permit Lambda)
function signPermit(userId, totalLimit, dailyRate, expiresAt, issuedAt, key) {
  const message = `${userId}:${totalLimit}:${dailyRate}:${expiresAt}:${issuedAt}`;
  return crypto.createHmac('sha256', key).update(message).digest('hex');
}

// validatePermit implementation from presign/index.mjs
function verifyPermitSignature(permit, key) {
  const message = `${permit.userId}:${permit.totalLimit}:${permit.dailyRate}:${permit.expiresAt}:${permit.issuedAt}`;
  const expectedSignature = crypto.createHmac('sha256', key).update(message).digest('hex');
  return permit.signature === expectedSignature;
}

function isPermitExpired(expiresAt) {
  return new Date(expiresAt).getTime() < Date.now();
}

async function validatePermit(permit) {
  // Check required fields
  const requiredFields = ['userId', 'totalLimit', 'dailyRate', 'expiresAt', 'issuedAt', 'signature'];
  for (const field of requiredFields) {
    if (!(field in permit)) {
      return { valid: false, reason: `Missing required field: ${field}` };
    }
  }

  // Check expiration
  if (isPermitExpired(permit.expiresAt)) {
    return { valid: false, reason: 'PERMIT_EXPIRED' };
  }

  // Verify signature
  if (!verifyPermitSignature(permit, secretKey)) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  return { valid: true };
}

// ============================================================
// Test Fixtures
// ============================================================

const createValidPermit = (overrides = {}) => {
  const userId = overrides.userId ?? 'device-test-123';
  const totalLimit = overrides.totalLimit ?? 500;
  const dailyRate = overrides.dailyRate ?? 30; // Use ?? to handle dailyRate=0 (Pro tier)
  const expiresAt = overrides.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const issuedAt = overrides.issuedAt ?? new Date().toISOString();

  return {
    userId,
    totalLimit,
    dailyRate,
    expiresAt,
    issuedAt,
    signature: signPermit(userId, totalLimit, dailyRate, expiresAt, issuedAt, secretKey),
    tier: overrides.tier || 'guest',
    ...overrides,
  };
};

// ============================================================
// Test Suite 1: Valid Permits
// ============================================================

describe('validatePermit() - Valid Permits', () => {
  it('T1.1: should accept valid permit', async () => {
    const permit = createValidPermit();
    const result = await validatePermit(permit);

    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('T1.2: should accept valid permit for free tier', async () => {
    const permit = createValidPermit({
      tier: 'free',
      totalLimit: 1000,
      dailyRate: 50,
    });
    const result = await validatePermit(permit);

    expect(result.valid).toBe(true);
  });

  it('T1.3: should accept valid permit for pro tier', async () => {
    const permit = createValidPermit({
      tier: 'pro',
      totalLimit: 10000,
      dailyRate: 0, // Unlimited daily
    });
    const result = await validatePermit(permit);

    expect(result.valid).toBe(true);
  });

  it('T1.4: should accept permit expiring in 1 second', async () => {
    const permitInFuture = new Date(Date.now() + 1000).toISOString();
    const permit = createValidPermit({
      expiresAt: permitInFuture,
    });
    const result = await validatePermit(permit);

    expect(result.valid).toBe(true);
  });
});

// ============================================================
// Test Suite 2: Missing Fields
// ============================================================

describe('validatePermit() - Missing Fields', () => {
  it('T2.1: should reject permit missing userId', async () => {
    const permit = createValidPermit();
    delete permit.userId;

    const result = await validatePermit(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('userId');
  });

  it('T2.2: should reject permit missing signature', async () => {
    const permit = createValidPermit();
    delete permit.signature;

    const result = await validatePermit(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('signature');
  });

  it('T2.3: should reject permit missing expiresAt', async () => {
    const permit = createValidPermit();
    delete permit.expiresAt;

    const result = await validatePermit(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('expiresAt');
  });
});

// ============================================================
// Test Suite 3: Signature Tampering (Critical Security Tests)
// ============================================================

describe('validatePermit() - Signature Tampering', () => {
  it('T3.1: should reject permit with tampered totalLimit', async () => {
    const permit = createValidPermit();

    // Tamper with totalLimit
    permit.totalLimit = 10000; // Changed from 500

    const result = await validatePermit(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('T3.2: should reject permit with tampered dailyRate', async () => {
    const permit = createValidPermit({
      dailyRate: 30,
    });

    // Tamper: change to unlimited daily
    permit.dailyRate = 0;

    const result = await validatePermit(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('T3.3: should reject permit with tampered expiresAt (extend validity)', async () => {
    const permit = createValidPermit({
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Tamper: extend validity to 1 year
    permit.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const result = await validatePermit(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('T3.4: should reject permit with tampered userId', async () => {
    const permit = createValidPermit({
      userId: 'device-123',
    });

    // Tamper: change to different user
    permit.userId = 'device-attacker-999';

    const result = await validatePermit(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('T3.5: should reject permit with tampered issuedAt', async () => {
    const permit = createValidPermit();

    // Tamper: change issuedAt to make it look older
    permit.issuedAt = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

    const result = await validatePermit(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('T3.6: should reject permit with completely forged signature', async () => {
    const permit = createValidPermit();

    // Forge: replace signature with random hex
    permit.signature = 'a'.repeat(64);

    const result = await validatePermit(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('T3.7: should reject permit with wrong signature length', async () => {
    const permit = createValidPermit();

    // Wrong length: too short
    permit.signature = 'abcd1234';

    const result = await validatePermit(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('T3.8: should reject permit with multiple fields tampered', async () => {
    const permit = createValidPermit({
      totalLimit: 500,
      dailyRate: 30,
    });

    // Tamper multiple fields (classic attack)
    permit.totalLimit = 100000;
    permit.dailyRate = 10000;

    const result = await validatePermit(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });
});

// ============================================================
// Test Suite 4: Expiration Checks
// ============================================================

describe('validatePermit() - Expiration', () => {
  it('T4.1: should reject expired permit (1 second ago)', async () => {
    const expiredTime = new Date(Date.now() - 1000).toISOString();
    const permit = createValidPermit({
      expiresAt: expiredTime,
    });

    const result = await validatePermit(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('PERMIT_EXPIRED');
  });

  it('T4.2: should reject expired permit (1 day ago)', async () => {
    const expiredTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const permit = createValidPermit({
      expiresAt: expiredTime,
    });

    const result = await validatePermit(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('PERMIT_EXPIRED');
  });

  it('T4.3: should accept permit expiring exactly now', async () => {
    // Edge case: expiresAt = current time
    // Since check is: expiresAt < now (strictly less than), this should PASS
    // Permit is still valid at the exact expiration moment
    const nowTime = new Date().toISOString();
    const permit = createValidPermit({
      expiresAt: nowTime,
    });

    const result = await validatePermit(permit);

    // Valid at exact expiration moment (expiresAt is not < now)
    expect(result.valid).toBe(true);
  });

  it('T4.4: should accept permit expiring in far future', async () => {
    const futureTime = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString();
    const permit = createValidPermit({
      expiresAt: futureTime,
    });

    const result = await validatePermit(permit);

    expect(result.valid).toBe(true);
  });
});

// ============================================================
// Test Suite 5: Quota Edge Cases
// ============================================================

describe('validatePermit() - Quota Limits', () => {
  it('T5.1: should accept permit with totalLimit = 1', async () => {
    const permit = createValidPermit({
      totalLimit: 1,
      dailyRate: 1,
    });

    const result = await validatePermit(permit);

    expect(result.valid).toBe(true);
  });

  it('T5.2: should accept permit with dailyRate = 0 (unlimited)', async () => {
    const permit = createValidPermit({
      totalLimit: 5000,
      dailyRate: 0, // Pro tier
    });

    const result = await validatePermit(permit);

    expect(result.valid).toBe(true);
  });

  it('T5.3: should accept permit with totalLimit > dailyRate', async () => {
    const permit = createValidPermit({
      totalLimit: 1000,
      dailyRate: 50,
    });

    const result = await validatePermit(permit);

    expect(result.valid).toBe(true);
  });

  it('T5.4: should accept permit with totalLimit = dailyRate', async () => {
    const permit = createValidPermit({
      totalLimit: 100,
      dailyRate: 100,
    });

    const result = await validatePermit(permit);

    expect(result.valid).toBe(true);
  });
});

// ============================================================
// Test Suite 6: Attack Scenarios
// ============================================================

describe('validatePermit() - Attack Scenarios', () => {
  it('T6.1: Should prevent privilege escalation (guest → pro)', async () => {
    // Attacker tries to change tier and increase limits
    const permit = createValidPermit({
      tier: 'guest',
      totalLimit: 500,
      dailyRate: 30,
    });

    // Attack: modify to pro tier limits
    permit.tier = 'pro';
    permit.totalLimit = 10000;
    permit.dailyRate = 0;

    // Signature should fail (tier not in signed message, but limits changed)
    const result = await validatePermit(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('T6.2: Should prevent quota overflow attack', async () => {
    const permit = createValidPermit({
      totalLimit: 500,
    });

    // Attack: set to maximum JavaScript number
    permit.totalLimit = Number.MAX_SAFE_INTEGER;

    const result = await validatePermit(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('T6.3: Should prevent replay attack (old permit reused)', async () => {
    // Create permit that was valid 30 days ago
    const oldTime = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString();
    const permit = createValidPermit({
      expiresAt: oldTime,
    });

    const result = await validatePermit(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('PERMIT_EXPIRED');
  });

  it('T6.4: Should prevent signature collision attack', async () => {
    const permit1 = createValidPermit({
      userId: 'device-123',
      totalLimit: 500,
    });

    // Try to use permit1's signature on different data
    const permit2 = {
      userId: 'device-456',
      totalLimit: 10000,
      dailyRate: 30,
      expiresAt: permit1.expiresAt,
      issuedAt: permit1.issuedAt,
      signature: permit1.signature, // Reuse signature
      tier: 'pro',
    };

    const result = await validatePermit(permit2);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('T6.5: Should reject permit with null signature', async () => {
    const permit = createValidPermit();
    permit.signature = null;

    const result = await validatePermit(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('T6.6: Should reject permit with empty signature', async () => {
    const permit = createValidPermit();
    permit.signature = '';

    const result = await validatePermit(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });
});

// ============================================================
// Test Suite 7: Real-World Scenarios
// ============================================================

describe('validatePermit() - Real-World Scenarios', () => {
  it('T7.1: Should validate permit after network transmission (no corruption)', async () => {
    // Simulate permit sent over HTTP (should be unchanged)
    const original = createValidPermit();
    const transmitted = JSON.parse(JSON.stringify(original)); // Simulate serialization

    const result = await validatePermit(transmitted);

    expect(result.valid).toBe(true);
  });

  it('T7.2: Should reject permit with ISO 8601 timezone mismatch', async () => {
    const permit = createValidPermit();

    // Replace Z with +00:00 (both valid ISO 8601, but changes message)
    permit.expiresAt = permit.expiresAt.replace('Z', '+00:00');

    const result = await validatePermit(permit);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('T7.3: Should work with different tier configurations', async () => {
    const tiers = [
      { tier: 'guest', totalLimit: 500, dailyRate: 30 },
      { tier: 'free', totalLimit: 1000, dailyRate: 50 },
      { tier: 'basic', totalLimit: 3000, dailyRate: 100 },
      { tier: 'pro', totalLimit: 10000, dailyRate: 0 },
    ];

    for (const tierConfig of tiers) {
      const permit = createValidPermit(tierConfig);
      const result = await validatePermit(permit);

      expect(result.valid).toBe(true);
    }
  });
});
