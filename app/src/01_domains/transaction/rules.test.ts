import { describe, it, expect } from 'vitest';
import {
  filterTransactions,
  calculateNetProfit,
  categorizeByType,
  summarizeByCategory,
  createDailySummary,
  isValidAmount,
  isHighConfidence,
} from './rules';
import type { Transaction } from './types';
import { TransactionId, UserId } from '../../00_kernel/types';

// Test fixtures
const createTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: TransactionId('tx-1'),
  userId: UserId('user-1'),
  imageId: null,
  type: 'expense',
  category: 'purchase',
  amount: 1000,
  currency: 'JPY',
  description: 'Test transaction',
  merchant: null,
  date: '2024-01-15',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
  confirmedAt: null,
  confidence: 0.95,
  rawText: null,
  ...overrides,
});

describe('transaction/rules', () => {
  describe('filterTransactions', () => {
    const transactions: Transaction[] = [
      createTransaction({ id: TransactionId('tx-1'), date: '2024-01-10', type: 'income', category: 'sale' }),
      createTransaction({ id: TransactionId('tx-2'), date: '2024-01-15', type: 'expense', category: 'purchase' }),
      createTransaction({ id: TransactionId('tx-3'), date: '2024-01-20', type: 'expense', category: 'shipping' }),
      createTransaction({ id: TransactionId('tx-4'), date: '2024-01-25', type: 'income', category: 'sale' }),
    ];

    it('returns all when no filters', () => {
      const result = filterTransactions(transactions, {});
      expect(result).toHaveLength(4);
    });

    it('filters by date range', () => {
      const result = filterTransactions(transactions, {
        dateStart: '2024-01-12',
        dateEnd: '2024-01-22',
      });
      expect(result).toHaveLength(2);
      expect(result.map(t => t.id)).toEqual([TransactionId('tx-2'), TransactionId('tx-3')]);
    });

    it('filters by category', () => {
      const result = filterTransactions(transactions, { category: 'sale' });
      expect(result).toHaveLength(2);
      expect(result.every(t => t.category === 'sale')).toBe(true);
    });

    it('filters by type', () => {
      const result = filterTransactions(transactions, { type: 'income' });
      expect(result).toHaveLength(2);
      expect(result.every(t => t.type === 'income')).toBe(true);
    });

    it('ignores "all" category filter', () => {
      const result = filterTransactions(transactions, { category: 'all' });
      expect(result).toHaveLength(4);
    });

    it('ignores "all" type filter', () => {
      const result = filterTransactions(transactions, { type: 'all' });
      expect(result).toHaveLength(4);
    });

    it('combines multiple filters', () => {
      const result = filterTransactions(transactions, {
        dateStart: '2024-01-01',
        dateEnd: '2024-01-31',
        type: 'expense',
        category: 'purchase',
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(TransactionId('tx-2'));
    });
  });

  describe('calculateNetProfit', () => {
    it('calculates positive profit', () => {
      expect(calculateNetProfit(10000, 5000)).toBe(5000);
    });

    it('calculates negative profit (loss)', () => {
      expect(calculateNetProfit(5000, 10000)).toBe(-5000);
    });

    it('calculates zero profit', () => {
      expect(calculateNetProfit(5000, 5000)).toBe(0);
    });
  });

  describe('categorizeByType', () => {
    const transactions: Transaction[] = [
      createTransaction({ id: TransactionId('tx-1'), type: 'income', amount: 5000 }),
      createTransaction({ id: TransactionId('tx-2'), type: 'expense', amount: 1000 }),
      createTransaction({ id: TransactionId('tx-3'), type: 'income', amount: 3000 }),
      createTransaction({ id: TransactionId('tx-4'), type: 'expense', amount: 2000 }),
    ];

    it('separates income and expense', () => {
      const result = categorizeByType(transactions);
      expect(result.income).toHaveLength(2);
      expect(result.expense).toHaveLength(2);
    });

    it('preserves original transactions', () => {
      const result = categorizeByType(transactions);
      expect(result.income[0].amount).toBe(5000);
      expect(result.expense[0].amount).toBe(1000);
    });
  });

  describe('summarizeByCategory', () => {
    const transactions: Transaction[] = [
      createTransaction({ category: 'purchase', amount: 1000 }),
      createTransaction({ category: 'purchase', amount: 2000 }),
      createTransaction({ category: 'shipping', amount: 500 }),
      createTransaction({ category: 'sale', amount: 3000 }),
    ];

    it('sums amounts by category', () => {
      const result = summarizeByCategory(transactions);
      expect(result.purchase).toBe(3000);
      expect(result.shipping).toBe(500);
      expect(result.sale).toBe(3000);
    });

    it('initializes all categories to 0', () => {
      const result = summarizeByCategory([]);
      expect(result.purchase).toBe(0);
      expect(result.sale).toBe(0);
      expect(result.shipping).toBe(0);
      expect(result.packaging).toBe(0);
      expect(result.fee).toBe(0);
      expect(result.other).toBe(0);
    });
  });

  describe('createDailySummary', () => {
    const transactions: Transaction[] = [
      createTransaction({ date: '2024-01-15', type: 'income', category: 'sale', amount: 5000 }),
      createTransaction({ date: '2024-01-15', type: 'expense', category: 'purchase', amount: 2000 }),
      createTransaction({ date: '2024-01-15', type: 'expense', category: 'shipping', amount: 500 }),
      createTransaction({ date: '2024-01-16', type: 'income', category: 'sale', amount: 10000 }), // Different day
    ];

    it('creates summary for specific date', () => {
      const summary = createDailySummary('2024-01-15', transactions);
      expect(summary.date).toBe('2024-01-15');
      expect(summary.transactionCount).toBe(3);
    });

    it('calculates totals correctly', () => {
      const summary = createDailySummary('2024-01-15', transactions);
      expect(summary.totalIncome).toBe(5000);
      expect(summary.totalExpense).toBe(2500);
      expect(summary.netProfit).toBe(2500);
    });

    it('summarizes by category', () => {
      const summary = createDailySummary('2024-01-15', transactions);
      expect(summary.byCategory.sale).toBe(5000);
      expect(summary.byCategory.purchase).toBe(2000);
      expect(summary.byCategory.shipping).toBe(500);
    });

    it('handles empty day', () => {
      const summary = createDailySummary('2024-01-01', transactions);
      expect(summary.transactionCount).toBe(0);
      expect(summary.totalIncome).toBe(0);
      expect(summary.totalExpense).toBe(0);
      expect(summary.netProfit).toBe(0);
    });
  });

  describe('isValidAmount', () => {
    it('returns true for positive amounts', () => {
      expect(isValidAmount(100)).toBe(true);
      expect(isValidAmount(0.01)).toBe(true);
    });

    it('returns false for zero', () => {
      expect(isValidAmount(0)).toBe(false);
    });

    it('returns false for negative amounts', () => {
      expect(isValidAmount(-100)).toBe(false);
    });

    it('returns false for Infinity', () => {
      expect(isValidAmount(Infinity)).toBe(false);
    });

    it('returns false for NaN', () => {
      expect(isValidAmount(NaN)).toBe(false);
    });
  });

  describe('isHighConfidence', () => {
    it('returns true for confidence >= 0.8', () => {
      expect(isHighConfidence(0.8)).toBe(true);
      expect(isHighConfidence(0.95)).toBe(true);
      expect(isHighConfidence(1.0)).toBe(true);
    });

    it('returns false for confidence < 0.8', () => {
      expect(isHighConfidence(0.79)).toBe(false);
      expect(isHighConfidence(0.5)).toBe(false);
    });

    it('returns false for null confidence', () => {
      expect(isHighConfidence(null)).toBe(false);
    });
  });
});
