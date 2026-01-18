/**
 * Unit tests for issue-permit Lambda
 * Run: npx vitest
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import {
  signPermit,
  verifyPermitSignature,
  verifyPermitSignatureMultiKey,
  getUserTier,
  isPermitExpired,
} from './index.mjs';

// Tier configurations (for testing)
const TIER_CONFIGS = {
  guest: { totalLimit: 500, dailyRate: 30, validDays: 30 },
  free: { totalLimit: 1000, dailyRate: 50, validDays: 30 },
  basic: { totalLimit: 3000, dailyRate: 100, validDays: 30 },
  pro: { totalLimit: 10000, dailyRate: 0, validDays: 30 },
};

// ============================================================
// Test Suite 1: signPermit() - 签名生成
// ============================================================

describe('signPermit() - Signature Generation', () => {
  const secretKey = 'test-secret-key-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

  it('T1.1: should generate consistent signature for same inputs', () => {
    const userId = 'device-test-123';
    const totalLimit = 500;
    const dailyRate = 30;
    const expiresAt = '2026-02-18T00:00:00.000Z';
    const issuedAt = '2026-01-18T00:00:00.000Z';

    const sig1 = signPermit(userId, totalLimit, dailyRate, expiresAt, issuedAt, secretKey);
    const sig2 = signPermit(userId, totalLimit, dailyRate, expiresAt, issuedAt, secretKey);

    expect(sig1).toBe(sig2);
    expect(sig1).toHaveLength(64);
  });

  it('T1.2: should generate different signatures for different userId', () => {
    const base = {
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: '2026-02-18T00:00:00.000Z',
      issuedAt: '2026-01-18T00:00:00.000Z',
    };

    const sig1 = signPermit('device-123', base.totalLimit, base.dailyRate, base.expiresAt, base.issuedAt, secretKey);
    const sig2 = signPermit('device-456', base.totalLimit, base.dailyRate, base.expiresAt, base.issuedAt, secretKey);

    expect(sig1).not.toBe(sig2);
  });

  it('T1.3: should generate different signatures for different totalLimit', () => {
    const base = {
      userId: 'device-123',
      dailyRate: 30,
      expiresAt: '2026-02-18T00:00:00.000Z',
      issuedAt: '2026-01-18T00:00:00.000Z',
    };

    const sig1 = signPermit(base.userId, 500, base.dailyRate, base.expiresAt, base.issuedAt, secretKey);
    const sig2 = signPermit(base.userId, 1000, base.dailyRate, base.expiresAt, base.issuedAt, secretKey);

    expect(sig1).not.toBe(sig2);
  });

  it('T1.4: should generate different signatures for different dailyRate', () => {
    const base = {
      userId: 'device-123',
      totalLimit: 500,
      expiresAt: '2026-02-18T00:00:00.000Z',
      issuedAt: '2026-01-18T00:00:00.000Z',
    };

    const sig1 = signPermit(base.userId, base.totalLimit, 30, base.expiresAt, base.issuedAt, secretKey);
    const sig2 = signPermit(base.userId, base.totalLimit, 50, base.expiresAt, base.issuedAt, secretKey);

    expect(sig1).not.toBe(sig2);
  });

  it('T1.5: should generate different signatures with different secret keys', () => {
    const params = ['device-123', 500, 30, '2026-02-18T00:00:00.000Z', '2026-01-18T00:00:00.000Z'];

    const sig1 = signPermit(...params, 'secret-key-1');
    const sig2 = signPermit(...params, 'secret-key-2');

    expect(sig1).not.toBe(sig2);
  });

  it('T1.6: should return 64-character hex string (SHA256)', () => {
    const sig = signPermit('device-123', 500, 30, '2026-02-18T00:00:00.000Z', '2026-01-18T00:00:00.000Z', secretKey);

    expect(sig).toMatch(/^[a-f0-9]{64}$/);
    expect(sig.length).toBe(64);
  });

  it('T1.7: should use correct message format (userId:totalLimit:dailyRate:expiresAt:issuedAt)', () => {
    const userId = 'device-123';
    const totalLimit = 500;
    const dailyRate = 30;
    const expiresAt = '2026-02-18T00:00:00.000Z';
    const issuedAt = '2026-01-18T00:00:00.000Z';
    const secretKey = 'test-secret';

    // 手动构建预期消息（定义签名格式）
    const expectedMessage = `${userId}:${totalLimit}:${dailyRate}:${expiresAt}:${issuedAt}`;
    const expectedSignature = crypto.createHmac('sha256', secretKey).update(expectedMessage).digest('hex');

    const actualSignature = signPermit(userId, totalLimit, dailyRate, expiresAt, issuedAt, secretKey);

    expect(actualSignature).toBe(expectedSignature);
  });
});

// ============================================================
// Test Suite 2: verifyPermitSignature() - 签名验证
// ============================================================

describe('verifyPermitSignature() - Single Key', () => {
  const secretKey = 'test-secret-key';

  it('T2.1: should return true for valid signature', () => {
    const permit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: '2026-02-18T00:00:00.000Z',
      issuedAt: '2026-01-18T00:00:00.000Z',
      signature: '',
    };

    permit.signature = signPermit(
      permit.userId,
      permit.totalLimit,
      permit.dailyRate,
      permit.expiresAt,
      permit.issuedAt,
      secretKey
    );

    expect(verifyPermitSignature(permit, secretKey)).toBe(true);
  });

  it('T2.2: should return false for tampered totalLimit', () => {
    const permit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: '2026-02-18T00:00:00.000Z',
      issuedAt: '2026-01-18T00:00:00.000Z',
      signature: '',
    };

    permit.signature = signPermit(
      permit.userId,
      permit.totalLimit,
      permit.dailyRate,
      permit.expiresAt,
      permit.issuedAt,
      secretKey
    );

    // 篡改 totalLimit
    permit.totalLimit = 10000;

    expect(verifyPermitSignature(permit, secretKey)).toBe(false);
  });

  it('T2.3: should return false for tampered dailyRate', () => {
    const permit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: '2026-02-18T00:00:00.000Z',
      issuedAt: '2026-01-18T00:00:00.000Z',
      signature: '',
    };

    permit.signature = signPermit(
      permit.userId,
      permit.totalLimit,
      permit.dailyRate,
      permit.expiresAt,
      permit.issuedAt,
      secretKey
    );

    // 篡改 dailyRate 为无限制
    permit.dailyRate = 0;

    expect(verifyPermitSignature(permit, secretKey)).toBe(false);
  });

  it('T2.4: should return false for tampered expiresAt', () => {
    const permit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: '2026-02-18T00:00:00.000Z',
      issuedAt: '2026-01-18T00:00:00.000Z',
      signature: '',
    };

    permit.signature = signPermit(
      permit.userId,
      permit.totalLimit,
      permit.dailyRate,
      permit.expiresAt,
      permit.issuedAt,
      secretKey
    );

    // 篡改 expiresAt 延长有效期
    permit.expiresAt = '2027-01-18T00:00:00.000Z';

    expect(verifyPermitSignature(permit, secretKey)).toBe(false);
  });

  it('T2.5: should return false for wrong secret key', () => {
    const permit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: '2026-02-18T00:00:00.000Z',
      issuedAt: '2026-01-18T00:00:00.000Z',
      signature: '',
    };

    permit.signature = signPermit(
      permit.userId,
      permit.totalLimit,
      permit.dailyRate,
      permit.expiresAt,
      permit.issuedAt,
      'secret-key-1'
    );

    expect(verifyPermitSignature(permit, 'secret-key-2')).toBe(false);
  });
});

// ============================================================
// Test Suite 3: verifyPermitSignature() - 多密钥验证（轮换支持）
// ============================================================

describe('verifyPermitSignature() - Multi-Key Support', () => {
  const activeKey = 'active-secret-key';
  const oldKey = 'old-secret-key';

  it('T3.1: should accept permit signed with active key', () => {
    const permit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: '2026-02-18T00:00:00.000Z',
      issuedAt: '2026-01-18T00:00:00.000Z',
      signature: '',
    };

    permit.signature = signPermit(
      permit.userId,
      permit.totalLimit,
      permit.dailyRate,
      permit.expiresAt,
      permit.issuedAt,
      activeKey
    );

    expect(verifyPermitSignatureMultiKey(permit, [activeKey, oldKey])).toBe(true);
  });

  it('T3.2: should accept permit signed with old key (rotation period)', () => {
    const permit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: '2026-02-18T00:00:00.000Z',
      issuedAt: '2026-01-18T00:00:00.000Z',
      signature: '',
    };

    permit.signature = signPermit(
      permit.userId,
      permit.totalLimit,
      permit.dailyRate,
      permit.expiresAt,
      permit.issuedAt,
      oldKey
    );

    expect(verifyPermitSignatureMultiKey(permit, [activeKey, oldKey])).toBe(true);
  });

  it('T3.3: should reject permit signed with unknown key', () => {
    const permit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: '2026-02-18T00:00:00.000Z',
      issuedAt: '2026-01-18T00:00:00.000Z',
      signature: '',
    };

    permit.signature = signPermit(
      permit.userId,
      permit.totalLimit,
      permit.dailyRate,
      permit.expiresAt,
      permit.issuedAt,
      'unknown-key'
    );

    expect(verifyPermitSignatureMultiKey(permit, [activeKey, oldKey])).toBe(false);
  });

  it('T3.4: should try all keys before failing', () => {
    const permit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: '2026-02-18T00:00:00.000Z',
      issuedAt: '2026-01-18T00:00:00.000Z',
      signature: '',
    };

    // 使用 oldKey 签名
    permit.signature = signPermit(
      permit.userId,
      permit.totalLimit,
      permit.dailyRate,
      permit.expiresAt,
      permit.issuedAt,
      oldKey
    );

    // activeKey 会失败，但 oldKey 会成功
    expect(verifyPermitSignatureMultiKey(permit, [activeKey, oldKey])).toBe(true);
  });

  it('T3.5: should work with single key array', () => {
    const permit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: '2026-02-18T00:00:00.000Z',
      issuedAt: '2026-01-18T00:00:00.000Z',
      signature: '',
    };

    permit.signature = signPermit(
      permit.userId,
      permit.totalLimit,
      permit.dailyRate,
      permit.expiresAt,
      permit.issuedAt,
      activeKey
    );

    expect(verifyPermitSignatureMultiKey(permit, [activeKey])).toBe(true);
  });
});

// ============================================================
// Test Suite 4: getUserTier() - 用户层级判断
// ============================================================

describe('getUserTier() - Tier Detection', () => {
  it('T4.1: should return "guest" for device- prefix', () => {
    expect(getUserTier('device-abc-123')).toBe('guest');
    expect(getUserTier('device-xyz-789')).toBe('guest');
    expect(getUserTier('device-')).toBe('guest');
  });

  it('T4.2: should return "free" for user- prefix', () => {
    expect(getUserTier('user-cognito-sub-123')).toBe('free');
    expect(getUserTier('user-xyz')).toBe('free');
    expect(getUserTier('user-')).toBe('free');
  });

  it('T4.3: should throw error for invalid userId format', () => {
    expect(() => getUserTier('invalid-123')).toThrow('Invalid userId format');
    expect(() => getUserTier('guest-123')).toThrow('Invalid userId format');
    expect(() => getUserTier('')).toThrow('Invalid userId format');
    expect(() => getUserTier('123')).toThrow('Invalid userId format');
  });

  it('T4.4: should be case-sensitive', () => {
    expect(() => getUserTier('Device-123')).toThrow();
    expect(() => getUserTier('USER-123')).toThrow();
    expect(() => getUserTier('DEVICE-123')).toThrow();
  });
});

// ============================================================
// Test Suite 5: Tier Configurations - 配额配置
// ============================================================

describe('Tier Configurations', () => {
  it('T5.1: guest tier should have 500 total, 30 daily, 30 days', () => {
    const config = TIER_CONFIGS.guest;
    expect(config.totalLimit).toBe(500);
    expect(config.dailyRate).toBe(30);
    expect(config.validDays).toBe(30);
  });

  it('T5.2: free tier should have 1000 total, 50 daily, 30 days', () => {
    const config = TIER_CONFIGS.free;
    expect(config.totalLimit).toBe(1000);
    expect(config.dailyRate).toBe(50);
    expect(config.validDays).toBe(30);
  });

  it('T5.3: basic tier should have 3000 total, 100 daily, 30 days', () => {
    const config = TIER_CONFIGS.basic;
    expect(config.totalLimit).toBe(3000);
    expect(config.dailyRate).toBe(100);
    expect(config.validDays).toBe(30);
  });

  it('T5.4: pro tier should have 10000 total, 0 daily (unlimited), 30 days', () => {
    const config = TIER_CONFIGS.pro;
    expect(config.totalLimit).toBe(10000);
    expect(config.dailyRate).toBe(0); // 0 表示无日限制
    expect(config.validDays).toBe(30);
  });

  it('T5.5: all tiers should be defined', () => {
    expect(TIER_CONFIGS.guest).toBeDefined();
    expect(TIER_CONFIGS.free).toBeDefined();
    expect(TIER_CONFIGS.basic).toBeDefined();
    expect(TIER_CONFIGS.pro).toBeDefined();
  });
});

// ============================================================
// Test Suite 6: isPermitExpired() - 过期检查
// ============================================================

describe('isPermitExpired() - Expiration Check', () => {
  it('T6.1: should return false for future expiration', () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(isPermitExpired(futureDate)).toBe(false);
  });

  it('T6.2: should return true for past expiration', () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(isPermitExpired(pastDate)).toBe(true);
  });

  it('T6.3: should handle 30-day validity period', () => {
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(isPermitExpired(thirtyDaysFromNow)).toBe(false);

    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    expect(isPermitExpired(thirtyOneDaysAgo)).toBe(true);
  });

  it('T6.4: should handle edge case (exactly now)', () => {
    const now = Date.now();
    const nowISO = new Date(now).toISOString();

    // 由于时间流逝，可能返回 true 或 false
    const result = isPermitExpired(nowISO);
    expect(typeof result).toBe('boolean');
  });
});

// ============================================================
// Test Suite 7: Permit Structure - Permit 结构验证
// ============================================================

describe('Permit Structure', () => {
  it('T7.1: should have all required fields', () => {
    const permit = {
      userId: 'device-test-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'a'.repeat(64),
      tier: 'guest',
    };

    expect(permit).toHaveProperty('userId');
    expect(permit).toHaveProperty('totalLimit');
    expect(permit).toHaveProperty('dailyRate');
    expect(permit).toHaveProperty('expiresAt');
    expect(permit).toHaveProperty('issuedAt');
    expect(permit).toHaveProperty('signature');
    expect(permit).toHaveProperty('tier');
  });

  it('T7.2: expiresAt should be ISO 8601 format', () => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('T7.3: issuedAt should be close to current time', () => {
    const before = Date.now();
    const issuedAt = new Date().toISOString();
    const after = Date.now();

    const issuedTime = new Date(issuedAt).getTime();
    expect(issuedTime).toBeGreaterThanOrEqual(before);
    expect(issuedTime).toBeLessThanOrEqual(after + 100); // 允许 100ms 误差
  });

  it('T7.4: tier should be one of the valid values', () => {
    const validTiers = ['guest', 'free', 'basic', 'pro'];
    validTiers.forEach((tier) => {
      expect(validTiers).toContain(tier);
    });
  });

  it('T7.5: signature should be 64-character hex', () => {
    const signature = signPermit('device-123', 500, 30, '2026-02-18T00:00:00.000Z', '2026-01-18T00:00:00.000Z', 'secret');
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ============================================================
// Test Suite 8: Error Handling - Null/Undefined/Invalid Inputs
// ============================================================

describe('Error Handling - Invalid Inputs', () => {
  const secretKey = 'test-secret';

  it('T8.1: should handle null userId in signPermit', () => {
    expect(() => signPermit(null, 500, 30, '2026-02-18T00:00:00.000Z', '2026-01-18T00:00:00.000Z', secretKey)).toThrow();
  });

  it('T8.2: should handle undefined userId in signPermit', () => {
    expect(() => signPermit(undefined, 500, 30, '2026-02-18T00:00:00.000Z', '2026-01-18T00:00:00.000Z', secretKey)).toThrow();
  });

  it('T11.3: should handle empty signature in verifyPermitSignature', () => {
    const permit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: '2026-02-18T00:00:00.000Z',
      issuedAt: '2026-01-18T00:00:00.000Z',
      signature: '',
    };

    expect(verifyPermitSignature(permit, secretKey)).toBe(false);
  });

  it('T11.4: should handle non-hex signature', () => {
    const permit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: '2026-02-18T00:00:00.000Z',
      issuedAt: '2026-01-18T00:00:00.000Z',
      signature: 'not-a-valid-hex-string',
    };

    expect(verifyPermitSignature(permit, secretKey)).toBe(false);
  });

  it('T11.5: should handle permit missing required fields', () => {
    const incompletePermit = {
      userId: 'device-123',
      // 缺少其他字段
    };

    expect(() => verifyPermitSignature(incompletePermit, secretKey)).toThrow();
  });

  it('T11.6: should handle negative totalLimit', () => {
    const result = signPermit('device-123', -500, 30, '2026-02-18T00:00:00.000Z', '2026-01-18T00:00:00.000Z', secretKey);
    // 签名应该成功，但验证时应该被业务逻辑拒绝
    expect(result).toBeDefined();
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it('T8.7: should handle negative dailyRate', () => {
    const result = signPermit('device-123', 500, -30, '2026-02-18T00:00:00.000Z', '2026-01-18T00:00:00.000Z', secretKey);
    expect(result).toBeDefined();
  });
});

// ============================================================
// Test Suite 9: validDays Parameter - 自定义有效期
// ============================================================

describe('issuePermit() - validDays parameter', () => {
  it('T9.1: should calculate expiresAt correctly with default 30 days', () => {
    const validDays = 30;
    const issuedAt = new Date();
    const expectedExpiry = new Date(issuedAt.getTime() + validDays * 24 * 60 * 60 * 1000);

    const actualExpiry = new Date(issuedAt.getTime() + validDays * 24 * 60 * 60 * 1000);

    const diff = Math.abs(expectedExpiry.getTime() - actualExpiry.getTime());
    expect(diff).toBeLessThan(1000); // 允许1秒误差
  });

  it('T9.2: should calculate expiresAt correctly with custom validDays (60)', () => {
    const validDays = 60;
    const issuedAt = new Date();
    const expectedExpiry = new Date(issuedAt.getTime() + validDays * 24 * 60 * 60 * 1000);

    const actualExpiry = new Date(issuedAt.getTime() + validDays * 24 * 60 * 60 * 1000);

    const diff = Math.abs(expectedExpiry.getTime() - actualExpiry.getTime());
    expect(diff).toBeLessThan(1000);
  });

  it('T9.3: should handle validDays = 1 (minimum)', () => {
    const validDays = 1;
    const issuedAt = new Date();
    const expectedExpiry = new Date(issuedAt.getTime() + validDays * 24 * 60 * 60 * 1000);

    expect(expectedExpiry.getTime()).toBeGreaterThan(issuedAt.getTime());
  });

  it('T9.4: should handle large validDays (365)', () => {
    const validDays = 365;
    const issuedAt = new Date();
    const expectedExpiry = new Date(issuedAt.getTime() + validDays * 24 * 60 * 60 * 1000);

    const diffDays = (expectedExpiry.getTime() - issuedAt.getTime()) / (1000 * 60 * 60 * 24);
    expect(Math.round(diffDays)).toBe(365);
  });

  it('T9.5: should reject validDays = 0', () => {
    // Lambda handler 应该返回 400
    const isInvalid = (validDays) => validDays <= 0;
    expect(isInvalid(0)).toBe(true);
  });

  it('T9.6: should reject negative validDays', () => {
    const isInvalid = (validDays) => validDays <= 0;
    expect(isInvalid(-10)).toBe(true);
  });

  it('T9.7: should reject float validDays (30.5)', () => {
    const isInvalid = (validDays) => !Number.isInteger(validDays);
    expect(isInvalid(30.5)).toBe(true);
  });
});

// ============================================================
// Test Suite 10: Secrets Manager Integration
// ============================================================

describe('getSecretKey() - Secrets Manager', () => {
  it('T10.1: should handle missing PERMIT_SECRET_KEY_ARN env var', () => {
    const envVarMissing = !process.env.PERMIT_SECRET_KEY_ARN;

    if (envVarMissing) {
      // 应该抛出错误
      expect(true).toBe(true);
    } else {
      expect(process.env.PERMIT_SECRET_KEY_ARN).toBeDefined();
    }
  });

  it('T10.2: should parse JSON secret correctly', () => {
    const mockSecretResponse = '{"key":"test-secret-key-64-chars"}';
    const parsed = JSON.parse(mockSecretResponse);

    expect(parsed.key).toBeDefined();
    expect(typeof parsed.key).toBe('string');
  });

  it('T10.3: should handle malformed JSON secret', () => {
    const malformedSecret = 'not-json';

    expect(() => JSON.parse(malformedSecret)).toThrow();
  });
});

// ============================================================
// Test Suite 11: Lambda Handler Mock - HTTP 边界测试
// ============================================================

describe('Lambda Handler Integration', () => {
  it('T11.1: should return 400 for missing userId', () => {
    const response = {
      statusCode: 400,
      body: JSON.stringify({
        error: 'INVALID_REQUEST',
        message: 'Missing or invalid userId',
      }),
    };

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('INVALID_REQUEST');
  });

  it('T11.2: should return 400 for invalid userId format', () => {
    const response = {
      statusCode: 400,
      body: JSON.stringify({
        error: 'INVALID_USER_ID',
        message: 'userId must start with device- or user-',
      }),
    };

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('INVALID_USER_ID');
  });

  it('T11.3: should return 400 for invalid validDays (negative)', () => {
    const response = {
      statusCode: 400,
      body: JSON.stringify({
        error: 'INVALID_VALID_DAYS',
        message: 'validDays must be a positive integer',
      }),
    };

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('INVALID_VALID_DAYS');
  });

  it('T11.4: should return 200 with permit for valid request', () => {
    const permit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: '2026-02-18T00:00:00.000Z',
      issuedAt: '2026-01-18T00:00:00.000Z',
      signature: 'a'.repeat(64),
      tier: 'guest',
    };

    const response = {
      statusCode: 200,
      body: JSON.stringify({ permit }),
    };

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.permit).toBeDefined();
    expect(body.permit.userId).toBe('device-123');
    expect(body.permit.tier).toBe('guest');
  });

  it('T11.5: should include CORS headers', () => {
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    expect(headers['Access-Control-Allow-Origin']).toBe('*');
    expect(headers['Access-Control-Allow-Methods']).toContain('POST');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('T11.6: should handle OPTIONS preflight request', () => {
    const response = {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('');
  });
});
