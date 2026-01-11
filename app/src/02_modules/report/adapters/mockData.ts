// Mock data factory for development (Pillar C)
// Note: USE_MOCK is now centralized in 00_kernel/config/mock.ts
import type { Transaction, TransactionCategory, TransactionType } from '../../../01_domains/transaction';
import { TransactionId, ImageId, UserId } from '../../../00_kernel/types';
import { createDailySummary } from '../../../01_domains/transaction';
import type { ReportData } from '../types';

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

// Default random uses date-based seed for daily consistency
function getDateSeed(date: string): number {
  return date.split('-').reduce((acc, part) => acc * 100 + parseInt(part, 10), 0);
}

// =========================================================================
// Rich Mock Data Collections
// =========================================================================

// Merchants by category - realistic personal finance
const MERCHANTS_BY_CATEGORY: Record<string, string[]> = {
  food: [
    'Starbucks', 'McDonald\'s', '7-Eleven', 'Family Mart',
    'Yoshinoya', 'Coco Ichibanya', 'Saizeriya', 'Gusto',
  ],
  transport: [
    'JR East', 'Tokyo Metro', 'Uber', 'Taxi',
    'Shell Gas Station', 'ENEOS', 'Yamato Parking', 'Airport Limousine',
  ],
  shopping: [
    'Amazon', 'Uniqlo', 'Don Quijote', 'Tokyu Hands',
    'Yodobashi Camera', 'Bic Camera', 'Daiso', 'Seria',
  ],
  entertainment: [
    'Netflix', 'Spotify', 'PlayStation Store', 'Nintendo eShop',
    'TOHO Cinemas', 'Round1', 'Karaoke Kan', 'Book Off',
  ],
  utilities: [
    'TEPCO (Electric)', 'Tokyo Gas', 'NTT (Internet)', 'Softbank Mobile',
    'AU Mobile', 'Water Bureau', 'NHK', 'City Tax Office',
  ],
  health: [
    'Pharmacy', 'Hospital', 'Dental Clinic', 'Matsumoto Kiyoshi',
    'Welcia', 'Sugi Pharmacy', 'Eye Clinic', 'Fitness Gym',
  ],
  other: [
    'Convenience Store', 'ATM', 'Bank Transfer', 'Cash',
    'Unknown', 'Misc', 'Adjustment', 'Refund',
  ],
};

// Descriptions by category - personal finance entries
const DESCRIPTIONS_BY_CATEGORY: Record<string, string[]> = {
  food: [
    'Lunch at restaurant',
    'Coffee and pastry',
    'Groceries at supermarket',
    'Dinner with friends',
    'Convenience store meal',
    'Fast food meal',
    'Snacks and drinks',
    'Weekend brunch',
  ],
  transport: [
    'Train commute',
    'Taxi to airport',
    'Gas refill',
    'Parking fee',
    'IC card charge',
    'Monthly train pass',
    'Uber ride',
    'Highway toll',
  ],
  shopping: [
    'Clothes shopping',
    'Electronics purchase',
    'Home supplies',
    'Online shopping',
    'Household items',
    'Personal care products',
    'Books and magazines',
    'Gifts for family',
  ],
  entertainment: [
    'Movie ticket',
    'Streaming subscription',
    'Game purchase',
    'Concert ticket',
    'Karaoke session',
    'Museum entrance',
    'Sports event ticket',
    'Hobby supplies',
  ],
  utilities: [
    'Electricity bill',
    'Gas bill',
    'Internet monthly',
    'Mobile phone bill',
    'Water bill',
    'NHK subscription',
    'City tax payment',
    'Home insurance',
  ],
  health: [
    'Doctor visit',
    'Prescription medicine',
    'Dental checkup',
    'Gym membership',
    'Vitamins and supplements',
    'Eye exam',
    'Health insurance',
    'Medical supplies',
  ],
  other: [
    'Miscellaneous expense',
    'Bank fee',
    'ATM withdrawal',
    'Cash adjustment',
    'Refund received',
    'Other payment',
    'Unknown transaction',
  ],
};

// Amount ranges by category (in JPY)
const AMOUNT_RANGES: Record<string, { min: number; max: number }> = {
  food: { min: 300, max: 8000 },
  transport: { min: 150, max: 15000 },
  shopping: { min: 500, max: 50000 },
  entertainment: { min: 800, max: 20000 },
  utilities: { min: 2000, max: 25000 },
  health: { min: 500, max: 30000 },
  other: { min: 100, max: 5000 },
};

// =========================================================================
// Scenario Presets
// =========================================================================

export type MockScenario =
  | 'default'       // Mixed balanced data
  | 'empty'         // No transactions
  | 'sparse'        // 1-2 transactions
  | 'busy'          // 15-20 transactions
  | 'profitable'    // Mostly sales, high profit
  | 'loss'          // Mostly expenses, negative profit
  | 'all-income'    // Only sales
  | 'all-expense'   // Only expenses
  | 'unconfirmed'   // Many unconfirmed transactions
  | 'high-value'    // High-value transactions only
  | 'low-value';    // Small transactions only

const SCENARIO_CONFIG: Record<MockScenario, {
  countRange: [number, number];
  incomeRatio: number;
  confirmRatio: number;
  amountMultiplier: number;
}> = {
  default: { countRange: [5, 10], incomeRatio: 0.6, confirmRatio: 0.7, amountMultiplier: 1 },
  empty: { countRange: [0, 0], incomeRatio: 0.5, confirmRatio: 1, amountMultiplier: 1 },
  sparse: { countRange: [1, 2], incomeRatio: 0.5, confirmRatio: 0.8, amountMultiplier: 1 },
  busy: { countRange: [15, 20], incomeRatio: 0.5, confirmRatio: 0.6, amountMultiplier: 1 },
  profitable: { countRange: [8, 12], incomeRatio: 0.8, confirmRatio: 0.9, amountMultiplier: 1.5 },
  loss: { countRange: [6, 10], incomeRatio: 0.2, confirmRatio: 0.5, amountMultiplier: 1.2 },
  'all-income': { countRange: [5, 8], incomeRatio: 1, confirmRatio: 0.8, amountMultiplier: 1 },
  'all-expense': { countRange: [5, 8], incomeRatio: 0, confirmRatio: 0.7, amountMultiplier: 1 },
  unconfirmed: { countRange: [8, 12], incomeRatio: 0.5, confirmRatio: 0.1, amountMultiplier: 1 },
  'high-value': { countRange: [3, 5], incomeRatio: 0.6, confirmRatio: 0.8, amountMultiplier: 3 },
  'low-value': { countRange: [10, 15], incomeRatio: 0.5, confirmRatio: 0.7, amountMultiplier: 0.3 },
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
  date: string;
  random: () => number;
  forceType?: TransactionType;
  confirmRatio: number;
  amountMultiplier: number;
}

function createMockTransaction(options: TransactionGenOptions): Transaction {
  const { date, random, forceType, confirmRatio, amountMultiplier } = options;

  const type: TransactionType = forceType ?? (random() > 0.4 ? 'income' : 'expense');

  // Pick category based on type
  const categoryOptions: TransactionCategory[] = type === 'income'
    ? ['other'] // Income typically doesn't have detailed categories in personal finance
    : ['food', 'transport', 'shopping', 'entertainment', 'utilities', 'health', 'other'];
  const category = pickRandom(categoryOptions, random);

  // Get realistic amount based on category
  const range = AMOUNT_RANGES[category];
  const baseAmount = randomInRange(range.min, range.max, random);
  const amount = Math.round(baseAmount * amountMultiplier);

  // Get realistic merchant and description
  const merchants = MERCHANTS_BY_CATEGORY[category];
  const descriptions = DESCRIPTIONS_BY_CATEGORY[category];

  const merchant = pickRandom(merchants, random);
  const description = pickRandom(descriptions, random);

  // Confidence varies by scenario
  const confidence = 0.65 + random() * 0.35; // 0.65-1.0

  return {
    id: TransactionId(generateId('tx')),
    userId: UserId('mock-user'),
    imageId: random() > 0.3 ? ImageId(generateId('img')) : null,
    s3Key: null,
    type,
    category,
    amount,
    currency: 'JPY',
    description,
    merchant,
    date,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    confirmedAt: random() < confirmRatio ? new Date().toISOString() : null,
    confidence,
    rawText: null,
  };
}

// =========================================================================
// Public API
// =========================================================================

/**
 * Generate mock transactions for a date with scenario
 */
export function createMockTransactions(
  date: string,
  scenario: MockScenario = 'default',
  seed?: number,
): Transaction[] {
  const config = SCENARIO_CONFIG[scenario];
  const random = createSeededRandom(seed ?? getDateSeed(date));

  const count = randomInRange(config.countRange[0], config.countRange[1], random);
  if (count === 0) return [];

  return Array.from({ length: count }, () => {
    // Determine type based on income ratio
    const forceType: TransactionType | undefined =
      config.incomeRatio === 1 ? 'income' :
      config.incomeRatio === 0 ? 'expense' :
      random() < config.incomeRatio ? 'income' : 'expense';

    return createMockTransaction({
      date,
      random,
      forceType,
      confirmRatio: config.confirmRatio,
      amountMultiplier: config.amountMultiplier,
    });
  });
}

/**
 * Generate complete mock report data for a date
 */
export function createMockReportData(
  date?: string,
  scenario: MockScenario = 'default',
): ReportData {
  const targetDate = date ?? new Date().toISOString().split('T')[0];
  const transactions = createMockTransactions(targetDate, scenario);

  return {
    date: targetDate,
    summary: createDailySummary(targetDate, transactions),
    transactions,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate mock history with varied scenarios per day
 * Each day gets a different scenario for UI testing variety
 */
export function createMockReportHistory(limit = 7): ReportData[] {
  const reports: ReportData[] = [];
  const today = new Date();

  // Cycle through different scenarios for variety
  const scenarioCycle: MockScenario[] = [
    'default',
    'profitable',
    'sparse',
    'busy',
    'loss',
    'unconfirmed',
    'default',
  ];

  for (let i = 0; i < limit; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const scenario = scenarioCycle[i % scenarioCycle.length];
    reports.push(createMockReportData(dateStr, scenario));
  }

  return reports;
}

/**
 * Get all available mock scenarios (for dev tools / testing UI)
 */
export function getMockScenarios(): MockScenario[] {
  return Object.keys(SCENARIO_CONFIG) as MockScenario[];
}
