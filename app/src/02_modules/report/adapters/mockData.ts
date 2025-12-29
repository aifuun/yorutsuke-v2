// Mock data factory for development (Pillar C)
import type { Transaction, TransactionCategory, TransactionType } from '../../../01_domains/transaction';
import { TransactionId, ImageId, UserId } from '../../../00_kernel/types';
import { createDailySummary } from '../../../01_domains/transaction';
import type { ReportData } from '../types';

// Check if running without backend
export const USE_MOCK_DATA = !import.meta.env.VITE_LAMBDA_CONFIG_URL;

// Simple ID generator
let idCounter = 0;
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${++idCounter}`;

// Sample merchants for realistic data
const MERCHANTS = [
  'Amazon', 'Mercari', 'Yahoo Auction', 'Rakuten', 'Book Off',
  'Hard Off', 'Yamato Transport', 'Sagawa Express', 'Japan Post',
];

const CATEGORIES: TransactionCategory[] = [
  'purchase', 'sale', 'shipping', 'packaging', 'fee', 'other',
];

// Generate a single mock transaction
function createMockTransaction(
  date: string,
  overrides: Partial<Transaction> = {},
): Transaction {
  const type: TransactionType = Math.random() > 0.4 ? 'income' : 'expense';
  const category = type === 'income'
    ? 'sale'
    : CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];

  const baseAmount = type === 'income'
    ? Math.floor(Math.random() * 30000) + 1000  // 1000-31000
    : Math.floor(Math.random() * 5000) + 100;   // 100-5100

  return {
    id: TransactionId(generateId('tx')),
    userId: UserId('mock-user'),
    imageId: Math.random() > 0.3 ? ImageId(generateId('img')) : null,
    type,
    category,
    amount: baseAmount,
    currency: 'JPY',
    description: `${category} transaction`,
    merchant: MERCHANTS[Math.floor(Math.random() * MERCHANTS.length)],
    date,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    confirmedAt: Math.random() > 0.5 ? new Date().toISOString() : null,
    confidence: Math.random() * 0.3 + 0.7, // 0.7-1.0
    rawText: null,
    ...overrides,
  };
}

// Generate mock transactions for a date
function createMockTransactions(date: string, count = 8): Transaction[] {
  return Array.from({ length: count }, () => createMockTransaction(date));
}

// Generate complete mock report data
export function createMockReportData(date?: string): ReportData {
  const targetDate = date ?? new Date().toISOString().split('T')[0];
  const transactions = createMockTransactions(targetDate);

  return {
    date: targetDate,
    summary: createDailySummary(targetDate, transactions),
    transactions,
    generatedAt: new Date().toISOString(),
  };
}

// Generate mock history (multiple days)
export function createMockReportHistory(limit = 7): ReportData[] {
  const reports: ReportData[] = [];
  const today = new Date();

  for (let i = 0; i < limit; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    reports.push(createMockReportData(dateStr));
  }

  return reports;
}
