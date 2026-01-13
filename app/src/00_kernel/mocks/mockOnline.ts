// Centralized mock data for "online" mode (successful API responses)
// Pillar C: Generate mock data from schema for consistent testing
//
// Usage: Import these functions in adapters instead of inline mock data
// Example: if (isMockingOnline()) return mockPresignUrl(userId, fileName);

import { UserId, ImageId, TransactionId } from '../types';
import type { TransactionCategory } from '../../01_domains/transaction';

/**
 * Mock presign URL response
 * Returns a fake S3 presign URL that triggers mock upload behavior
 * Format matches actual presign Lambda response: { url, key }
 */
let mockPresignCounter = 0;
export function mockPresignUrl(
  userId: UserId,
  fileName: string
): {
  url: string;
  key: string;
} {
  mockPresignCounter++;
  const timestamp = Date.now();
  const key = `uploads/${userId}/${timestamp}-${mockPresignCounter}-${fileName}`;

  return {
    url: `https://mock-s3.local/${key}?mock=true`,
    key,
  };
}

/**
 * Mock quota data response
 * Returns realistic quota information based on tier
 * Note: `used` can be a real count from local DB for hybrid mock strategy
 */
export function mockQuotaData(
  used: number,
  tier: 'guest' | 'free' | 'basic' | 'pro' = 'guest'
): {
  used: number;
  limit: number;
  remaining: number;
  tier: 'guest' | 'free' | 'basic' | 'pro';
  resetsAt: string;
  guest?: {
    dataExpiresAt: string;
    daysUntilExpiration: number;
  };
} {
  const TIER_LIMITS = {
    guest: 50,
    free: 100,
    basic: 200,
    pro: 1000,
  };

  const limit = TIER_LIMITS[tier];

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    tier,
    resetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    // Guest-specific fields
    ...(tier === 'guest' && {
      guest: {
        dataExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
        daysUntilExpiration: 60,
      },
    }),
  };
}

/**
 * Mock admin delete data response
 * Returns counts of deleted items
 */
export function mockAdminDeleteData(
  userId: UserId,
  types: Array<'transactions' | 'images'>
): {
  userId: string;
  deleted: {
    transactions?: number;
    images?: number;
  };
} {
  return {
    userId,
    deleted: {
      transactions: types.includes('transactions') ? 5 : undefined,
      images: types.includes('images') ? 3 : undefined,
    },
  };
}

/**
 * Mock transaction sync response
 * Returns pulled transactions from cloud
 */
export function mockTransactionPull(
  userId: UserId,
  count: number = 3
): Array<{
  id: TransactionId;
  userId: UserId;
  imageId: ImageId | null;
  s3Key: string | null;
  type: 'income' | 'expense';
  category: TransactionCategory;
  amount: number;
  currency: 'JPY';
  description: string;
  merchant: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  status: 'unconfirmed' | 'confirmed' | 'deleted' | 'needs_review';
  confidence: number | null;
  rawText: string | null;
}> {
  const now = new Date();
  const transactions = [];

  for (let i = 0; i < count; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    transactions.push({
      id: TransactionId(`mock-tx-${i + 1}`),
      userId,
      imageId: i % 2 === 0 ? ImageId(`mock-img-${i + 1}`) : null,
      s3Key: null as string | null,
      type: (i % 2 === 0 ? 'expense' : 'income') as 'income' | 'expense',
      category: (i % 2 === 0 ? 'shopping' : 'food') as TransactionCategory,
      amount: 1000 + i * 500,
      currency: 'JPY' as 'JPY',
      description: `Mock transaction ${i + 1}`,
      merchant: `Mock Merchant ${i + 1}`,
      date: date.toISOString().split('T')[0],
      createdAt: date.toISOString(),
      updatedAt: date.toISOString(),
      status: (i % 3 === 0 ? 'confirmed' : 'unconfirmed') as 'unconfirmed' | 'confirmed' | 'deleted' | 'needs_review',
      confidence: 0.85 + Math.random() * 0.15,
      rawText: null as string | null,
    });
  }

  return transactions;
}

/**
 * Mock batch config response
 * Returns batch processing configuration
 */
export function mockBatchConfig(): {
  mode: 'instant' | 'batch' | 'hybrid';
  batchTime: string;
  timezone: string;
} {
  return {
    mode: 'instant',
    batchTime: '03:00',
    timezone: 'Asia/Tokyo',
  };
}
