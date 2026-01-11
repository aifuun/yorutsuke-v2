// Seed mock data for development (Pillar C)
// Seeds ALWAYS write to mock database for isolation from production data
import type { Transaction, TransactionCategory, TransactionType } from '../../../01_domains/transaction';
import { TransactionId, UserId } from '../../../00_kernel/types';
import { isMockMode } from '../../../00_kernel/config/mock';
import { getMockDb } from '../../../00_kernel/storage/db';
import { clearAllTransactions } from './transactionDb';
import { logger, EVENTS } from '../../../00_kernel/telemetry';

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
    imageId: null, // Mock data has no real images (FK constraint)
    s3Key: null,
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
 * Seed mock transactions into mock SQLite database
 * Works in both 'online' and 'offline' mock modes
 * Seeds to mock database ONLY, never affects production data
 *
 * Both online and offline mock modes use the same mock database,
 * allowing developers to seed data once and test both scenarios.
 *
 * @param userId User ID for seeding
 * @param scenario Scenario to seed (default: balanced)
 * @param force If true, clears existing data first
 *
 * @returns { seeded: true/false, count: number of transactions created }
 */
export async function seedMockTransactions(
  userId: UserId,
  scenario: SeedScenario = 'default',
  force = false,
): Promise<{ seeded: boolean; count: number }> {
  // Safety check: Only allow seeding in mock mode (online or offline)
  if (!isMockMode()) {
    logger.warn(EVENTS.SEED_FAILED, {
      reason: 'not_in_mock_mode',
      current_mode: 'production',
      required_mode: 'online_or_offline'
    });
    return { seeded: false, count: 0 };
  }

  logger.info(EVENTS.SEED_STARTED, {
    userId: userId.slice(0, 8),
    scenario,
    force,
    database: 'mock'
  });

  try {
    // Use mock database for all seed operations
    const mockDb = await getMockDb();

    // Query existing transactions from mock db
    const existing = await mockDb.select<Array<{ id: string }>>(
      'SELECT id FROM transactions WHERE user_id = ?',
      [userId]
    );
    logger.debug(EVENTS.SEED_STARTED, { phase: 'existing', count: existing.length });

    if (existing.length > 0 && !force) {
      logger.warn(EVENTS.SEED_STARTED, { phase: 'skip', reason: 'data_exists' });
      return { seeded: false, count: 0 };
    }

    // Clear existing data when force=true
    if (force && existing.length > 0) {
      await mockDb.execute('DELETE FROM transactions WHERE user_id = ?', [userId]);
      logger.info(EVENTS.SEED_CLEARED, { count: existing.length, database: 'mock' });
    }

    const config = SCENARIO_CONFIG[scenario];

    if (config.daySpan === 0) {
      logger.info(EVENTS.SEED_COMPLETED, { count: 0, reason: 'empty_scenario' });
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

        // Insert directly to mock db
        await mockDb.execute(
          `INSERT INTO transactions (
            id, user_id, image_id, s3_key, type, category, amount, currency,
            description, merchant, date, created_at, updated_at, confirmed_at, confidence, raw_text
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tx.id,
            tx.userId,
            tx.imageId,
            tx.s3Key,
            tx.type,
            tx.category,
            tx.amount,
            tx.currency,
            tx.description,
            tx.merchant,
            tx.date,
            tx.createdAt,
            tx.updatedAt,
            tx.confirmedAt,
            tx.confidence,
            tx.rawText,
          ]
        );
        totalCount++;
      }
    }

    logger.info(EVENTS.SEED_COMPLETED, { count: totalCount, database: 'mock' });
    return { seeded: true, count: totalCount };
  } catch (e) {
    logger.error(EVENTS.SEED_FAILED, {
      error: String(e),
      database: 'mock'
    });
    return { seeded: false, count: 0 };
  }
}

/**
 * Clear all transactions for a user (for dev tools)
 */
export async function clearTransactions(userId: UserId): Promise<{ cleared: boolean; count: number }> {
  try {
    const count = await clearAllTransactions(userId);
    logger.info(EVENTS.SEED_CLEARED, { count, userId: userId.slice(0, 8) });
    return { cleared: true, count };
  } catch (e) {
    logger.error(EVENTS.SEED_FAILED, { context: 'clear', error: String(e) });
    return { cleared: false, count: 0 };
  }
}
