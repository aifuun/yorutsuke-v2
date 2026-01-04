// Seed mock data for development (Pillar C)
import type { Transaction, TransactionCategory, TransactionType } from '../../../01_domains/transaction';
import { TransactionId, ImageId, UserId } from '../../../00_kernel/types';
import { fetchTransactions, saveTransaction, clearAllTransactions } from './transactionDb';
import { dlog } from '../../debug/headless/debugLog';

// =========================================================================
// Seeded Random Generator (for reproducible mock data)
// =========================================================================

function createSeededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// =========================================================================
// Rich Mock Data Collections
// =========================================================================

// Merchants by category - realistic Japanese second-hand business
const MERCHANTS_BY_CATEGORY: Record<string, string[]> = {
  sale: [
    'Mercari', 'Yahoo Auction', 'Rakuten Fril', 'PayPay Flea Market',
    'Jimoty', 'Booth', 'minne', 'Creema',
  ],
  purchase: [
    'Hard Off', 'Book Off', '2nd Street', 'Treasure Factory',
    'Janpara', 'Sofmap', 'PC Depot', 'Geo',
  ],
  shipping: [
    'Yamato Transport', 'Sagawa Express', 'Japan Post', 'Neko Posu',
    'Yu-Pack', 'Click Post', 'Nekopos', 'Yuyu Mail',
  ],
  packaging: [
    'Daiso', 'Seria', 'Can★Do', 'Amazon',
    'MonotaRO', 'Askul', 'Hands', 'Yodobashi',
  ],
  fee: [
    'Mercari (Fee)', 'Yahoo Auction (Fee)', 'PayPay Flea Market (Fee)',
    'Stripe', 'PayPal', 'Square', 'Credit Card Fee',
  ],
  other: [
    'Convenience Store', 'ATM', 'Bank Transfer', 'Cash',
    'Unknown', 'Misc', 'Adjustment', 'Refund',
  ],
};

// Descriptions by category - more realistic entries
const DESCRIPTIONS_BY_CATEGORY: Record<string, string[]> = {
  sale: [
    'Sold MacBook Pro 2019',
    'Sold iPhone 12 Pro',
    'Sold Nintendo Switch',
    'Sold PS5 Controller',
    'Sold Camera Lens',
    'Sold Vintage Watch',
    'Sold Designer Bag',
    'Sold Mechanical Keyboard',
    'Sold Graphics Card',
    'Sold Monitor Stand',
  ],
  purchase: [
    'Purchased iPhone for resale',
    'Purchased MacBook Air',
    'Purchased Game Console',
    'Purchased Camera Body',
    'Purchased Vintage Item',
    'Purchased Electronics Lot',
    'Purchased Collectibles',
    'Purchased Audio Equipment',
  ],
  shipping: [
    'Shipping for MacBook',
    'Express shipping',
    'Standard shipping',
    'Nekopos shipping',
    'Yu-Pack 60 size',
    'Click Post',
    'International shipping',
    'Return shipping',
  ],
  packaging: [
    'Bubble wrap',
    'Cardboard boxes (10 pcs)',
    'Tape and labels',
    'Padded envelopes',
    'Anti-static bags',
    'Packaging materials',
    'Shipping supplies',
    'Protective foam',
  ],
  fee: [
    'Platform commission',
    'Payment processing fee',
    'Subscription fee',
    'Premium listing fee',
    'Featured listing',
    'Transaction fee',
    'Withdrawal fee',
  ],
  other: [
    'Miscellaneous expense',
    'Equipment maintenance',
    'Storage rental',
    'Photography supplies',
    'Cleaning supplies',
    'Office supplies',
    'Refund processed',
  ],
};

// Amount ranges by category (in JPY)
const AMOUNT_RANGES: Record<string, { min: number; max: number }> = {
  sale: { min: 1000, max: 150000 },
  purchase: { min: 500, max: 80000 },
  shipping: { min: 180, max: 2500 },
  packaging: { min: 100, max: 3000 },
  fee: { min: 50, max: 15000 },
  other: { min: 100, max: 5000 },
};

// =========================================================================
// Seed Scenarios
// =========================================================================

export type SeedScenario =
  | 'default'       // Mixed balanced data over 7 days
  | 'empty'         // No transactions
  | 'sparse'        // Very few transactions
  | 'busy'          // Lots of transactions
  | 'profitable'    // Mostly sales, high profit
  | 'loss'          // Mostly expenses, negative profit
  | 'new-user'      // Just started, only recent data
  | 'veteran';      // Long history, many transactions

const SCENARIO_CONFIG: Record<SeedScenario, {
  daySpan: number;
  transactionsPerDay: [number, number];
  incomeRatio: number;
  confirmRatio: number;
}> = {
  default: { daySpan: 7, transactionsPerDay: [2, 5], incomeRatio: 0.6, confirmRatio: 0.7 },
  empty: { daySpan: 0, transactionsPerDay: [0, 0], incomeRatio: 0.5, confirmRatio: 1 },
  sparse: { daySpan: 7, transactionsPerDay: [0, 1], incomeRatio: 0.5, confirmRatio: 0.8 },
  busy: { daySpan: 7, transactionsPerDay: [5, 10], incomeRatio: 0.5, confirmRatio: 0.6 },
  profitable: { daySpan: 14, transactionsPerDay: [3, 6], incomeRatio: 0.8, confirmRatio: 0.9 },
  loss: { daySpan: 7, transactionsPerDay: [3, 5], incomeRatio: 0.2, confirmRatio: 0.5 },
  'new-user': { daySpan: 2, transactionsPerDay: [1, 3], incomeRatio: 0.5, confirmRatio: 0.3 },
  veteran: { daySpan: 30, transactionsPerDay: [2, 4], incomeRatio: 0.55, confirmRatio: 0.95 },
};

// =========================================================================
// ID Generator
// =========================================================================

let idCounter = 0;
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${++idCounter}`;

// =========================================================================
// Transaction Generator
// =========================================================================

function pickRandom<T>(arr: T[], random: () => number): T {
  return arr[Math.floor(random() * arr.length)];
}

function randomInRange(min: number, max: number, random: () => number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

interface TransactionGenOptions {
  userId: UserId;
  date: Date;
  random: () => number;
  forceType?: TransactionType;
  confirmRatio: number;
}

function createMockTransaction(options: TransactionGenOptions): Transaction {
  const { userId, date, random, forceType, confirmRatio } = options;

  const type: TransactionType = forceType ?? (random() > 0.4 ? 'income' : 'expense');

  // Pick category based on type
  const categoryOptions: TransactionCategory[] = type === 'income'
    ? ['sale']
    : ['purchase', 'shipping', 'packaging', 'fee', 'other'];
  const category = pickRandom(categoryOptions, random);

  // Get realistic amount based on category
  const range = AMOUNT_RANGES[category];
  const amount = randomInRange(range.min, range.max, random);

  // Get realistic merchant and description
  const merchants = MERCHANTS_BY_CATEGORY[category];
  const descriptions = DESCRIPTIONS_BY_CATEGORY[category];

  const merchant = pickRandom(merchants, random);
  const description = pickRandom(descriptions, random);

  const dateStr = date.toISOString().split('T')[0];
  const timestamp = date.toISOString();

  // Confidence varies
  const confidence = 0.65 + random() * 0.35; // 0.65-1.0

  return {
    id: TransactionId(generateId('tx')),
    userId,
    imageId: random() > 0.3 ? ImageId(generateId('img')) : null,
    type,
    category,
    amount,
    currency: 'JPY',
    description,
    merchant,
    date: dateStr,
    createdAt: timestamp,
    updatedAt: timestamp,
    confirmedAt: random() < confirmRatio ? timestamp : null,
    confidence,
    rawText: null,
  };
}

// =========================================================================
// Public API
// =========================================================================

/**
 * Get all available seed scenarios (for dev tools / testing UI)
 */
export function getSeedScenarios(): SeedScenario[] {
  return Object.keys(SCENARIO_CONFIG) as SeedScenario[];
}

/**
 * Seed mock transactions into SQLite for development
 * Only seeds if no transactions exist for the user (unless force=true)
 */
export async function seedMockTransactions(
  userId: UserId,
  scenario: SeedScenario = 'default',
  force = false,
): Promise<{ seeded: boolean; count: number }> {
  const TAG = 'Seed';
  dlog.info(TAG, 'Starting', { userId, scenario, force });

  try {
    const existing = await fetchTransactions(userId);
    dlog.info(TAG, `Found ${existing.length} existing transactions`);

    if (existing.length > 0 && !force) {
      dlog.warn(TAG, 'Skipping - data exists, use force to overwrite');
      return { seeded: false, count: 0 };
    }

    // Clear existing data when force=true
    if (force && existing.length > 0) {
      dlog.info(TAG, 'Clearing existing transactions...');
      const cleared = await clearAllTransactions(userId);
      dlog.info(TAG, `Cleared ${cleared} transactions`);
    }

    const config = SCENARIO_CONFIG[scenario];
    dlog.info(TAG, 'Config loaded', config);

    if (config.daySpan === 0) {
      dlog.info(TAG, 'Empty scenario, no transactions to create');
      return { seeded: true, count: 0 };
    }

    const seed = Date.now();
    const random = createSeededRandom(seed);
    let totalCount = 0;

    // Create transactions spread over the configured days
    for (let daysAgo = 0; daysAgo < config.daySpan; daysAgo++) {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);

      const txCount = randomInRange(
        config.transactionsPerDay[0],
        config.transactionsPerDay[1],
        random
      );

      dlog.info(TAG, `Day -${daysAgo}: creating ${txCount} transactions`);

      for (let i = 0; i < txCount; i++) {
        const forceType: TransactionType | undefined =
          random() < config.incomeRatio ? 'income' : 'expense';

        const tx = createMockTransaction({
          userId,
          date,
          random,
          forceType,
          confirmRatio: config.confirmRatio,
        });

        await saveTransaction(tx);
        totalCount++;
      }
    }

    dlog.info(TAG, `Complete! Created ${totalCount} transactions`);
    return { seeded: true, count: totalCount };
  } catch (e) {
    dlog.error(TAG, 'Failed to seed', e);
    return { seeded: false, count: 0 };
  }
}

/**
 * Clear all transactions for a user (for dev tools)
 */
export async function clearTransactions(userId: UserId): Promise<{ cleared: boolean; count: number }> {
  try {
    const count = await clearAllTransactions(userId);
    console.log(`[seedData] Cleared ${count} transactions for ${userId}`);
    return { cleared: true, count };
  } catch (e) {
    console.error('[seedData] Failed to clear:', e);
    return { cleared: false, count: 0 };
  }
}
