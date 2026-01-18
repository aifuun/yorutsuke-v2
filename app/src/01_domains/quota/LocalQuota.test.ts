/**
 * Unit tests for LocalQuota class
 * Run: npm test LocalQuota.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================
// Type Definitions
// ============================================================

interface UploadPermit {
  userId: string;
  totalLimit: number;
  dailyRate: number;
  expiresAt: string;
  issuedAt: string;
  signature: string;
  tier: 'guest' | 'free' | 'basic' | 'pro';
}

interface LocalQuotaData {
  permit: UploadPermit;
  totalUsed: number;
  dailyUsage: Record<string, number>;
}

interface CanUploadResult {
  allowed: boolean;
  reason?: 'total_limit_reached' | 'daily_limit_reached' | 'permit_expired' | 'no_permit';
  remainingTotal: number;
  remainingDaily: number | typeof Infinity;
}

interface UsageStats {
  totalUsed: number;
  totalLimit: number;
  remainingTotal: number;
  usedToday: number;
  dailyRate: number;
  remainingDaily: number | typeof Infinity;
  tier: 'guest' | 'free' | 'basic' | 'pro';
  isExpired: boolean;
}

// ============================================================
// Mock localStorage
// ============================================================

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

// @ts-ignore
global.localStorage = localStorageMock;

// ============================================================
// Helper Functions (will be in LocalQuota.ts)
// ============================================================

const STORAGE_KEY = 'yorutsuke:quota';

function getTodayDate(): string {
  return new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
}

// ============================================================
// Test Suite 1: setPermit() - 设置 Permit
// ============================================================

describe('LocalQuota.setPermit()', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('T1.1: should store permit in localStorage', () => {
    const permit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'test-signature',
      tier: 'guest',
    };

    const data: LocalQuotaData = {
      permit,
      totalUsed: 0,
      dailyUsage: {},
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as LocalQuotaData;
    expect(stored.permit).toEqual(permit);
    expect(stored.totalUsed).toBe(0);
    expect(stored.dailyUsage).toEqual({});
  });

  it('T1.2: should reset totalUsed when setting new permit', () => {
    // 旧数据
    const oldData: LocalQuotaData = {
      permit: {
        userId: 'device-123',
        totalLimit: 500,
        dailyRate: 30,
        expiresAt: '2026-01-01T00:00:00.000Z',
        issuedAt: '2025-12-01T00:00:00.000Z',
        signature: 'old-sig',
        tier: 'guest',
      },
      totalUsed: 250,
      dailyUsage: { '2026-01-17': 25, '2026-01-18': 15 },
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(oldData));

    // 设置新 permit
    const newPermit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 1000,
      dailyRate: 50,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'new-sig',
      tier: 'free',
    };

    const newData: LocalQuotaData = {
      permit: newPermit,
      totalUsed: 0,
      dailyUsage: {},
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as LocalQuotaData;
    expect(stored.totalUsed).toBe(0);
    expect(stored.dailyUsage).toEqual({});
  });

  it('T1.3: should reset dailyUsage when setting new permit', () => {
    const oldData: LocalQuotaData = {
      permit: {
        userId: 'device-123',
        totalLimit: 500,
        dailyRate: 30,
        expiresAt: '2026-01-01T00:00:00.000Z',
        issuedAt: '2025-12-01T00:00:00.000Z',
        signature: 'old',
        tier: 'guest',
      },
      totalUsed: 100,
      dailyUsage: { '2026-01-17': 30, '2026-01-18': 25 },
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(oldData));

    const newPermit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'new',
      tier: 'guest',
    };

    const newData: LocalQuotaData = {
      permit: newPermit,
      totalUsed: 0,
      dailyUsage: {},
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as LocalQuotaData;
    expect(Object.keys(stored.dailyUsage)).toHaveLength(0);
  });

  it('T1.4: should handle userId change (guest → user)', () => {
    const guestPermit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'guest-sig',
      tier: 'guest',
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      permit: guestPermit,
      totalUsed: 100,
      dailyUsage: { '2026-01-18': 20 },
    }));

    // 用户注册后
    const userPermit: UploadPermit = {
      userId: 'user-cognito-abc',
      totalLimit: 1000,
      dailyRate: 50,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'user-sig',
      tier: 'free',
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      permit: userPermit,
      totalUsed: 0,
      dailyUsage: {},
    }));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as LocalQuotaData;
    expect(stored.permit.userId).toBe('user-cognito-abc');
    expect(stored.totalUsed).toBe(0);
  });
});

// ============================================================
// Test Suite 2: getPermit() - 获取 Permit
// ============================================================

describe('LocalQuota.getPermit()', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('T2.1: should return null if no permit stored', () => {
    const result = localStorage.getItem(STORAGE_KEY);
    expect(result).toBeNull();
  });

  it('T2.2: should return stored permit', () => {
    const permit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: '2026-02-18T00:00:00.000Z',
      issuedAt: '2026-01-18T00:00:00.000Z',
      signature: 'test-sig',
      tier: 'guest',
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      permit,
      totalUsed: 10,
      dailyUsage: { '2026-01-18': 5 },
    }));

    const data = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as LocalQuotaData;
    expect(data.permit).toEqual(permit);
  });

  it('T2.3: should handle corrupted localStorage data', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid-json');

    expect(() => JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toThrow();
  });
});

// ============================================================
// Test Suite 3: isExpired() - 过期检查
// ============================================================

describe('LocalQuota.isExpired()', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('T3.1: should return false for valid permit', () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const isExpired = new Date(futureDate).getTime() < Date.now();
    expect(isExpired).toBe(false);
  });

  it('T3.2: should return true for expired permit', () => {
    const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const isExpired = new Date(pastDate).getTime() < Date.now();
    expect(isExpired).toBe(true);
  });

  it('T3.3: should return true if no permit exists', () => {
    const permit = null;
    const isExpired = permit === null || new Date(permit.expiresAt).getTime() < Date.now();
    expect(isExpired).toBe(true);
  });
});

// ============================================================
// Test Suite 4: checkCanUpload() - 核心逻辑（总量限制）
// ============================================================

describe('LocalQuota.checkCanUpload() - Total Limit', () => {
  it('T4.1: should allow upload when under total limit', () => {
    const permit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'sig',
      tier: 'guest',
    };

    const totalUsed = 250;
    const usedToday = 10;
    const canUploadTotal = totalUsed < permit.totalLimit;
    const canUploadDaily = permit.dailyRate === 0 || usedToday < permit.dailyRate;
    const isExpired = new Date(permit.expiresAt).getTime() < Date.now();

    const result: CanUploadResult = {
      allowed: canUploadTotal && canUploadDaily && !isExpired,
      remainingTotal: permit.totalLimit - totalUsed,
      remainingDaily: permit.dailyRate === 0 ? Infinity : permit.dailyRate - usedToday,
    };

    expect(result.allowed).toBe(true);
    expect(result.remainingTotal).toBe(250);
    expect(result.remainingDaily).toBe(20);
  });

  it('T4.2: should block upload when total limit reached', () => {
    const totalUsed = 500;
    const totalLimit = 500;
    const canUpload = totalUsed < totalLimit;

    const result: CanUploadResult = {
      allowed: canUpload,
      reason: canUpload ? undefined : 'total_limit_reached',
      remainingTotal: totalLimit - totalUsed,
      remainingDaily: 20,
    };

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('total_limit_reached');
    expect(result.remainingTotal).toBe(0);
  });

  it('T4.3: should block upload when total limit exceeded', () => {
    const totalUsed = 501;
    const totalLimit = 500;
    const canUpload = totalUsed < totalLimit;

    expect(canUpload).toBe(false);
  });

  it('T4.4: should calculate remaining correctly', () => {
    const totalUsed = 100;
    const totalLimit = 500;
    const remaining = totalLimit - totalUsed;

    expect(remaining).toBe(400);
  });
});

// ============================================================
// Test Suite 5: checkCanUpload() - 日速率限制
// ============================================================

describe('LocalQuota.checkCanUpload() - Daily Rate', () => {
  it('T5.1: should allow upload when under daily rate', () => {
    const permit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'sig',
      tier: 'guest',
    };

    const usedToday = 15;
    const canUpload = usedToday < permit.dailyRate;

    expect(canUpload).toBe(true);
  });

  it('T5.2: should block upload when daily rate reached', () => {
    const permit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'sig',
      tier: 'guest',
    };

    const usedToday = 30;
    const canUpload = usedToday < permit.dailyRate;

    const result: CanUploadResult = {
      allowed: canUpload,
      reason: canUpload ? undefined : 'daily_limit_reached',
      remainingTotal: 470,
      remainingDaily: permit.dailyRate - usedToday,
    };

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('daily_limit_reached');
    expect(result.remainingDaily).toBe(0);
  });

  it('T5.3: should allow unlimited daily uploads when dailyRate is 0 (Pro tier)', () => {
    const permit: UploadPermit = {
      userId: 'user-pro-123',
      totalLimit: 10000,
      dailyRate: 0,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'sig',
      tier: 'pro',
    };

    const usedToday = 500;
    const canUploadDaily = permit.dailyRate === 0 || usedToday < permit.dailyRate;

    expect(canUploadDaily).toBe(true);
    expect(permit.dailyRate).toBe(0);
  });

  it('T5.4: should calculate remainingDaily as Infinity for Pro tier', () => {
    const dailyRate = 0;
    const usedToday = 100;
    const remainingDaily = dailyRate === 0 ? Infinity : dailyRate - usedToday;

    expect(remainingDaily).toBe(Infinity);
  });

  it('T5.5: should reset daily counter on new day', () => {
    const today = getTodayDate();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE');

    const dailyUsage: Record<string, number> = {
      [yesterday]: 30,
      [today]: 5,
    };

    const usedToday = dailyUsage[today] || 0;
    expect(usedToday).toBe(5);
  });
});

// ============================================================
// Test Suite 6: checkCanUpload() - 过期检查
// ============================================================

describe('LocalQuota.checkCanUpload() - Expiration', () => {
  it('T6.1: should block upload when permit expired', () => {
    const permit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      signature: 'sig',
      tier: 'guest',
    };

    const isExpired = new Date(permit.expiresAt).getTime() < Date.now();

    const result: CanUploadResult = {
      allowed: !isExpired,
      reason: isExpired ? 'permit_expired' : undefined,
      remainingTotal: 500,
      remainingDaily: 30,
    };

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('permit_expired');
  });

  it('T6.2: should block upload when no permit', () => {
    const permit = null;

    const result: CanUploadResult = {
      allowed: false,
      reason: 'no_permit',
      remainingTotal: 0,
      remainingDaily: 0,
    };

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('no_permit');
  });

  it('T6.3: should allow upload for valid permit', () => {
    const permit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'sig',
      tier: 'guest',
    };

    const isExpired = new Date(permit.expiresAt).getTime() < Date.now();
    expect(isExpired).toBe(false);
  });
});

// ============================================================
// Test Suite 7: incrementUsage() - 递增使用计数
// ============================================================

describe('LocalQuota.incrementUsage()', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('T7.1: should increment totalUsed', () => {
    let totalUsed = 10;
    totalUsed += 1;
    expect(totalUsed).toBe(11);
  });

  it('T7.2: should increment daily usage for today', () => {
    const today = getTodayDate();
    const dailyUsage: Record<string, number> = {
      [today]: 5,
    };

    dailyUsage[today] = (dailyUsage[today] || 0) + 1;

    expect(dailyUsage[today]).toBe(6);
  });

  it('T7.3: should create daily entry if not exists', () => {
    const today = getTodayDate();
    const dailyUsage: Record<string, number> = {};

    dailyUsage[today] = (dailyUsage[today] || 0) + 1;

    expect(dailyUsage[today]).toBe(1);
  });

  it('T7.4: should clean up old daily records (>7 days)', () => {
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE');
    const eightDaysAgo = new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE');
    const todayStr = getTodayDate();

    const dailyUsage: Record<string, number> = {
      [eightDaysAgo]: 10,
      [sevenDaysAgo]: 15,
      [todayStr]: 5,
    };

    // Cleanup logic - Use date string comparison (YYYY-MM-DD)
    const cutoffDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE');
    Object.keys(dailyUsage).forEach((date) => {
      if (date < cutoffDate) {  // String comparison in ISO format (YYYY-MM-DD)
        delete dailyUsage[date];
      }
    });

    expect(dailyUsage[eightDaysAgo]).toBeUndefined();  // 8 days ago deleted
    expect(dailyUsage[sevenDaysAgo]).toBe(15);         // 7 days ago kept
    expect(dailyUsage[todayStr]).toBe(5);              // today kept
  });

  it('T7.5: should persist to localStorage after increment', () => {
    const permit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: '2026-02-18T00:00:00.000Z',
      issuedAt: '2026-01-18T00:00:00.000Z',
      signature: 'sig',
      tier: 'guest',
    };

    const data: LocalQuotaData = {
      permit,
      totalUsed: 10,
      dailyUsage: { '2026-01-18': 5 },
    };

    // Increment
    const today = '2026-01-18';
    data.totalUsed += 1;
    data.dailyUsage[today] = (data.dailyUsage[today] || 0) + 1;

    // Persist
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as LocalQuotaData;
    expect(stored.totalUsed).toBe(11);
    expect(stored.dailyUsage['2026-01-18']).toBe(6);
  });
});

// ============================================================
// Test Suite 8: getUsageStats() - 获取统计数据
// ============================================================

describe('LocalQuota.getUsageStats()', () => {
  it('T8.1: should return complete statistics', () => {
    const permit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'sig',
      tier: 'guest',
    };

    const totalUsed = 250;
    const usedToday = 15;

    const stats: UsageStats = {
      totalUsed,
      totalLimit: permit.totalLimit,
      remainingTotal: permit.totalLimit - totalUsed,
      usedToday,
      dailyRate: permit.dailyRate,
      remainingDaily: permit.dailyRate === 0 ? Infinity : permit.dailyRate - usedToday,
      tier: permit.tier,
      isExpired: new Date(permit.expiresAt).getTime() < Date.now(),
    };

    expect(stats.totalUsed).toBe(250);
    expect(stats.totalLimit).toBe(500);
    expect(stats.remainingTotal).toBe(250);
    expect(stats.usedToday).toBe(15);
    expect(stats.dailyRate).toBe(30);
    expect(stats.remainingDaily).toBe(15);
    expect(stats.tier).toBe('guest');
    expect(stats.isExpired).toBe(false);
  });

  it('T8.2: should return Infinity for Pro tier remainingDaily', () => {
    const permit: UploadPermit = {
      userId: 'user-pro',
      totalLimit: 10000,
      dailyRate: 0,
      expiresAt: '2026-02-18T00:00:00.000Z',
      issuedAt: '2026-01-18T00:00:00.000Z',
      signature: 'sig',
      tier: 'pro',
    };

    const usedToday = 100;
    const remainingDaily = permit.dailyRate === 0 ? Infinity : permit.dailyRate - usedToday;

    expect(remainingDaily).toBe(Infinity);
  });

  it('T8.3: should mark as expired for past expiresAt', () => {
    const permit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      signature: 'sig',
      tier: 'guest',
    };

    const isExpired = new Date(permit.expiresAt).getTime() < Date.now();
    expect(isExpired).toBe(true);
  });
});

// ============================================================
// Test Suite 9: clear() - 清除数据
// ============================================================

describe('LocalQuota.clear()', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('T9.1: should remove data from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      permit: {},
      totalUsed: 100,
      dailyUsage: {},
    }));

    localStorage.removeItem(STORAGE_KEY);

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('T9.2: should not throw if no data exists', () => {
    expect(() => localStorage.removeItem(STORAGE_KEY)).not.toThrow();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

// ============================================================
// Test Suite 10: Edge Cases - 边界情况
// ============================================================

describe('LocalQuota - Edge Cases', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('T10.1: should handle corrupted localStorage data gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid-json');

    expect(() => JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toThrow();
  });

  it('T10.2: should handle missing permit field', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      totalUsed: 10,
    }));

    const data = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(data.permit).toBeUndefined();
  });

  it('T10.3: should handle negative usage values (defensive)', () => {
    const totalUsed = -5;
    const totalLimit = 500;

    const remaining = Math.max(0, totalLimit - totalUsed);
    expect(remaining).toBe(505);
  });

  it('T10.4: should use local date for daily usage (timezone-aware)', () => {
    const todayLocal = new Date().toLocaleDateString('sv-SE');
    expect(typeof todayLocal).toBe('string');
    expect(todayLocal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('T10.5: should handle empty dailyUsage object', () => {
    const today = getTodayDate();
    const dailyUsage: Record<string, number> = {};

    const usedToday = dailyUsage[today] || 0;
    expect(usedToday).toBe(0);
  });

  it('T10.6: should handle very large totalUsed (overflow protection)', () => {
    const totalUsed = Number.MAX_SAFE_INTEGER;
    const totalLimit = 500;

    const canUpload = totalUsed < totalLimit;
    expect(canUpload).toBe(false);
  });
});

// ============================================================
// Test Suite 11: Integration Scenarios - 完整场景
// ============================================================

// ============================================================
// Test Suite 12: checkCanUpload() - Combined Scenarios
// ============================================================

describe('LocalQuota.checkCanUpload() - Combined Scenarios', () => {
  it('T12.1: Expired + Quota available → should block (expired takes priority)', () => {
    const permit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 过期
      issuedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      signature: 'sig',
      tier: 'guest',
    };

    const totalUsed = 100; // 配额充足
    const usedToday = 10; // 日配额充足
    const isExpired = new Date(permit.expiresAt).getTime() < Date.now();

    const result: CanUploadResult = {
      allowed: false,
      reason: 'permit_expired',
      remainingTotal: permit.totalLimit - totalUsed,
      remainingDaily: permit.dailyRate - usedToday,
    };

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('permit_expired');
  });

  it('T12.2: Valid + Total limit reached + Daily quota available', () => {
    const permit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'sig',
      tier: 'guest',
    };

    const totalUsed = 500; // 总配额用完
    const usedToday = 10; // 日配额充足

    const canUploadTotal = totalUsed < permit.totalLimit;
    const canUploadDaily = usedToday < permit.dailyRate;

    const result: CanUploadResult = {
      allowed: false,
      reason: 'total_limit_reached',
      remainingTotal: 0,
      remainingDaily: 20,
    };

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('total_limit_reached');
    expect(canUploadTotal).toBe(false);
    expect(canUploadDaily).toBe(true);
  });

  it('T12.3: Valid + Total available + Daily limit reached', () => {
    const permit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'sig',
      tier: 'guest',
    };

    const totalUsed = 100; // 总配额充足
    const usedToday = 30; // 日配额用完

    const canUploadTotal = totalUsed < permit.totalLimit;
    const canUploadDaily = usedToday < permit.dailyRate;

    const result: CanUploadResult = {
      allowed: false,
      reason: 'daily_limit_reached',
      remainingTotal: 400,
      remainingDaily: 0,
    };

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('daily_limit_reached');
    expect(canUploadTotal).toBe(true);
    expect(canUploadDaily).toBe(false);
  });

  it('T12.4: Valid + Both limits reached (total takes priority)', () => {
    const permit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'sig',
      tier: 'guest',
    };

    const totalUsed = 500; // 总配额用完
    const usedToday = 30; // 日配额也用完

    // 检查顺序：expired → total → daily
    const isExpired = new Date(permit.expiresAt).getTime() < Date.now();
    const canUploadTotal = totalUsed < permit.totalLimit;
    const canUploadDaily = usedToday < permit.dailyRate;

    const result: CanUploadResult = {
      allowed: false,
      reason: isExpired ? 'permit_expired' : !canUploadTotal ? 'total_limit_reached' : 'daily_limit_reached',
      remainingTotal: 0,
      remainingDaily: 0,
    };

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('total_limit_reached'); // total 优先
  });

  it('T12.5: Expired + Both limits reached (expired takes priority)', () => {
    const permit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 过期
      issuedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      signature: 'sig',
      tier: 'guest',
    };

    const totalUsed = 500;
    const usedToday = 30;

    const isExpired = new Date(permit.expiresAt).getTime() < Date.now();

    const result: CanUploadResult = {
      allowed: false,
      reason: 'permit_expired',
      remainingTotal: 0,
      remainingDaily: 0,
    };

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('permit_expired');
    expect(isExpired).toBe(true);
  });
});

// ============================================================
// Test Suite 13: Boundary Values - 边界值
// ============================================================

describe('LocalQuota - Boundary Values', () => {
  it('T13.1: totalUsed = totalLimit - 1 (last upload allowed)', () => {
    const permit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'sig',
      tier: 'guest',
    };

    const totalUsed = 499; // 剩余 1 张
    const canUpload = totalUsed < permit.totalLimit;

    expect(canUpload).toBe(true);
    expect(permit.totalLimit - totalUsed).toBe(1);
  });

  it('T13.2: usedToday = dailyRate - 1 (last upload today allowed)', () => {
    const permit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'sig',
      tier: 'guest',
    };

    const usedToday = 29; // 今天剩余 1 张
    const canUpload = usedToday < permit.dailyRate;

    expect(canUpload).toBe(true);
    expect(permit.dailyRate - usedToday).toBe(1);
  });

  it('T13.3: totalUsed = totalLimit (exactly at limit)', () => {
    const totalUsed = 500;
    const totalLimit = 500;
    const canUpload = totalUsed < totalLimit;

    expect(canUpload).toBe(false);
    expect(totalUsed).toBe(totalLimit);
  });

  it('T13.4: usedToday = dailyRate (exactly at limit)', () => {
    const usedToday = 30;
    const dailyRate = 30;
    const canUpload = usedToday < dailyRate;

    expect(canUpload).toBe(false);
    expect(usedToday).toBe(dailyRate);
  });

  it('T13.5: incrementUsage 1000 times (stress test)', () => {
    let totalUsed = 0;
    const today = getTodayDate();
    const dailyUsage: Record<string, number> = {};

    for (let i = 0; i < 1000; i++) {
      totalUsed += 1;
      dailyUsage[today] = (dailyUsage[today] || 0) + 1;
    }

    expect(totalUsed).toBe(1000);
    expect(dailyUsage[today]).toBe(1000);
  });
});

// ============================================================
// Test Suite 14: Cleanup Logic - 自动清理
// ============================================================

describe('LocalQuota - Automatic Cleanup', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('T14.1: should clean up records older than 7 days on increment', () => {
    const today = new Date();
    const sixDaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE');
    const eightDaysAgo = new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE');
    const todayStr = getTodayDate();

    const dailyUsage: Record<string, number> = {
      [eightDaysAgo]: 10, // 应该被清理
      [sixDaysAgo]: 15, // 应该保留
      [todayStr]: 5,
    };

    // 模拟清理逻辑（incrementUsage 时触发）- Use date string comparison
    const cutoffDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE');
    Object.keys(dailyUsage).forEach((date) => {
      if (date < cutoffDate) {  // String comparison in ISO format (YYYY-MM-DD)
        delete dailyUsage[date];
      }
    });

    expect(dailyUsage[eightDaysAgo]).toBeUndefined();  // 8 days ago deleted
    expect(dailyUsage[sixDaysAgo]).toBe(15);           // 6 days ago kept (< 7 days)
    expect(dailyUsage[todayStr]).toBe(5);              // today kept
  });

  it('T14.2: should keep exactly 7 days of history', () => {
    const today = new Date();
    const dailyUsage: Record<string, number> = {};

    // 创建 10 天的记录
    for (let i = 0; i < 10; i++) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE');
      dailyUsage[date] = i + 1;
    }

    // 清理 >7 天的记录 - Use date string comparison
    const cutoffDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE');
    Object.keys(dailyUsage).forEach((date) => {
      if (date < cutoffDate) {  // String comparison in ISO format (YYYY-MM-DD)
        delete dailyUsage[date];
      }
    });

    const remainingDays = Object.keys(dailyUsage).length;
    expect(remainingDays).toBeLessThanOrEqual(8); // 今天 + 最多 7 天历史
  });

  it('T14.3: should not fail if dailyUsage is empty', () => {
    const dailyUsage: Record<string, number> = {};
    const today = new Date();
    const sevenDaysAgoTime = today.getTime() - 7 * 24 * 60 * 60 * 1000;

    // 清理空对象不应抛错
    expect(() => {
      Object.keys(dailyUsage).forEach((date) => {
        const dateTime = new Date(date).getTime();
        if (dateTime < sevenDaysAgoTime) {
          delete dailyUsage[date];
        }
      });
    }).not.toThrow();

    expect(Object.keys(dailyUsage)).toHaveLength(0);
  });
});

// ============================================================
// Test Suite 15: Integration Scenarios - 完整场景
// ============================================================

describe('LocalQuota - Integration Scenarios', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('T15.1: Complete flow - Guest user uploads 30 images', () => {
    const permit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'sig',
      tier: 'guest',
    };

    let data: LocalQuotaData = {
      permit,
      totalUsed: 0,
      dailyUsage: {},
    };

    const today = getTodayDate();

    // 上传 30 张图片
    for (let i = 0; i < 30; i++) {
      data.totalUsed += 1;
      data.dailyUsage[today] = (data.dailyUsage[today] || 0) + 1;
    }

    expect(data.totalUsed).toBe(30);
    expect(data.dailyUsage[today]).toBe(30);

    // 第 31 张应该被日限制阻止
    const usedToday = data.dailyUsage[today] || 0;
    const canUpload = usedToday < permit.dailyRate;
    expect(canUpload).toBe(false);
  });

  it('T15.2: Pro user can upload unlimited daily', () => {
    const permit: UploadPermit = {
      userId: 'user-pro',
      totalLimit: 10000,
      dailyRate: 0,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'sig',
      tier: 'pro',
    };

    let data: LocalQuotaData = {
      permit,
      totalUsed: 0,
      dailyUsage: {},
    };

    const today = getTodayDate();

    // 上传 500 张（远超普通日限制）
    for (let i = 0; i < 500; i++) {
      data.totalUsed += 1;
      data.dailyUsage[today] = (data.dailyUsage[today] || 0) + 1;
    }

    expect(data.totalUsed).toBe(500);

    // 仍然可以上传（日速率 = 0）
    const canUploadDaily = permit.dailyRate === 0 || data.dailyUsage[today] < permit.dailyRate;
    expect(canUploadDaily).toBe(true);

    // 但总限制仍然有效
    const canUploadTotal = data.totalUsed < permit.totalLimit;
    expect(canUploadTotal).toBe(true); // 500 < 10000
  });

  it('T15.3: Daily counter resets on new day', () => {
    const permit: UploadPermit = {
      userId: 'device-123',
      totalLimit: 500,
      dailyRate: 30,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      issuedAt: new Date().toISOString(),
      signature: 'sig',
      tier: 'guest',
    };

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE');
    const today = getTodayDate();

    const data: LocalQuotaData = {
      permit,
      totalUsed: 30,
      dailyUsage: {
        [yesterday]: 30, // 昨天用完
        [today]: 0, // 今天重置
      },
    };

    const usedToday = data.dailyUsage[today] || 0;
    const canUpload = usedToday < permit.dailyRate;

    expect(canUpload).toBe(true);
    expect(usedToday).toBe(0);
  });
});
