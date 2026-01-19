// Test helper: Create mock Transaction with all required fields
// Fixes TypeScript errors where primaryModelId/primaryConfidence are undefined

import { TransactionId, UserId, ImageId } from '../../00_kernel/types';
import type { Transaction, TransactionType, TransactionCategory, TransactionStatus } from '../../01_domains/transaction';

export function createMockTransaction(
  overrides: Partial<Transaction> = {}
): Transaction {
  const now = new Date().toISOString();

  return {
    id: TransactionId('mock-tx-1'),
    userId: UserId('mock-user-1'),
    imageId: ImageId('mock-img-1'),
    s3Key: null,
    type: 'expense' as TransactionType,
    category: 'other' as TransactionCategory,
    amount: 1000,
    currency: 'JPY',
    description: 'Mock transaction',
    merchant: 'Mock Merchant',
    date: '2026-01-01',
    createdAt: now,
    updatedAt: now,
    status: 'unconfirmed' as TransactionStatus,
    confidence: null,
    rawText: null,
    primaryModelId: null,  // ✅ Required field
    primaryConfidence: null,  // ✅ Required field
    ...overrides,
  };
}
