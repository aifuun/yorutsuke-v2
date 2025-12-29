// Seed mock data for development
import type { Transaction, TransactionCategory, TransactionType } from '../../../01_domains/transaction';
import { TransactionId, ImageId, UserId } from '../../../00_kernel/types';
import { fetchTransactions, saveTransaction } from './transactionDb';

// Sample merchants
const MERCHANTS = [
  'Amazon', 'Mercari', 'Yahoo Auction', 'Rakuten', 'Book Off',
  'Hard Off', 'Yamato Transport', 'Sagawa Express', 'Japan Post',
];

const CATEGORIES: TransactionCategory[] = [
  'purchase', 'sale', 'shipping', 'packaging', 'fee', 'other',
];

// Simple ID generator
let idCounter = 0;
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${++idCounter}`;

// Generate a single mock transaction
function createMockTransaction(userId: UserId, daysAgo: number): Transaction {
  const type: TransactionType = Math.random() > 0.4 ? 'income' : 'expense';
  const category = type === 'income'
    ? 'sale'
    : CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];

  const baseAmount = type === 'income'
    ? Math.floor(Math.random() * 30000) + 1000
    : Math.floor(Math.random() * 5000) + 100;

  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const dateStr = date.toISOString().split('T')[0];
  const timestamp = date.toISOString();

  return {
    id: TransactionId(generateId('tx')),
    userId,
    imageId: Math.random() > 0.3 ? ImageId(generateId('img')) : null,
    type,
    category,
    amount: baseAmount,
    currency: 'JPY',
    description: `${category} - ${MERCHANTS[Math.floor(Math.random() * MERCHANTS.length)]}`,
    merchant: MERCHANTS[Math.floor(Math.random() * MERCHANTS.length)],
    date: dateStr,
    createdAt: timestamp,
    updatedAt: timestamp,
    confirmedAt: Math.random() > 0.5 ? timestamp : null,
    confidence: Math.random() * 0.3 + 0.7,
    rawText: null,
  };
}

/**
 * Seed mock transactions into SQLite for development
 * Only seeds if no transactions exist for the user
 */
export async function seedMockTransactions(userId: UserId, count = 10): Promise<boolean> {
  try {
    const existing = await fetchTransactions(userId);
    if (existing.length > 0) {
      return false; // Already has data
    }

    // Create transactions spread over last 7 days
    for (let i = 0; i < count; i++) {
      const daysAgo = Math.floor(i / 2); // ~2 transactions per day
      const tx = createMockTransaction(userId, daysAgo);
      await saveTransaction(tx);
    }

    return true; // Seeded successfully
  } catch (e) {
    console.error('[seedData] Failed to seed:', e);
    return false;
  }
}
