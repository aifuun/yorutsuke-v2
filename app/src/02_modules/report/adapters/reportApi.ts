// Pillar B: Airlock - validate all API responses with Zod
import { z } from 'zod';
import type { UserId } from '../../../00_kernel/types';
import { TransactionId, ImageId, UserId as UserIdConstructor } from '../../../00_kernel/types';
import type { Transaction, DailySummary } from '../../../01_domains/transaction';
import { createMockReportData, createMockReportHistory } from './mockData';
import { isMockingOnline, isMockingOffline, mockDelay } from '../../../00_kernel/config/mock';

const CONFIG_URL = import.meta.env.VITE_LAMBDA_CONFIG_URL;

// Zod schemas for report response validation
const TransactionCategorySchema = z.enum([
  'food', 'transport', 'shopping', 'entertainment', 'utilities', 'health', 'other'
]);

const TransactionTypeSchema = z.enum(['income', 'expense']);

const TransactionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  imageId: z.string().nullable(),
  type: TransactionTypeSchema,
  category: TransactionCategorySchema,
  amount: z.number().nonnegative(),
  currency: z.literal('JPY'),
  description: z.string(),
  merchant: z.string().nullable(),
  date: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  confirmedAt: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  rawText: z.string().nullable(),
});

const DailySummarySchema = z.object({
  date: z.string(),
  totalIncome: z.number().nonnegative(),
  totalExpense: z.number().nonnegative(),
  netProfit: z.number(),
  transactionCount: z.number().int().nonnegative(),
  byCategory: z.record(TransactionCategorySchema, z.number()),
});

const MorningReportResponseSchema = z.object({
  date: z.string(),
  summary: DailySummarySchema,
  transactions: z.array(TransactionSchema),
  generatedAt: z.string(),
});

const ReportHistoryResponseSchema = z.object({
  reports: z.array(MorningReportResponseSchema),
});

interface MorningReportResponse {
  date: string;
  summary: DailySummary;
  transactions: Transaction[];
  generatedAt: string;
}

// Transform raw API response to domain types with branded IDs
function transformTransaction(raw: z.infer<typeof TransactionSchema>): Transaction {
  return {
    ...raw,
    id: TransactionId(raw.id),
    userId: UserIdConstructor(raw.userId),
    imageId: raw.imageId ? ImageId(raw.imageId) : null,
    s3Key: null, // Report API doesn't include S3 keys
  };
}

function transformReportResponse(raw: z.infer<typeof MorningReportResponseSchema>): MorningReportResponse {
  return {
    ...raw,
    transactions: raw.transactions.map(transformTransaction),
  };
}

export async function fetchMorningReport(
  userId: UserId,
  date: string,
): Promise<MorningReportResponse> {
  // Mocking offline - simulate network failure
  if (isMockingOffline()) {
    await mockDelay(100);
    throw new Error('Network error: offline mode');
  }

  // Mocking online - return mock data
  if (isMockingOnline()) {
    await mockDelay(300);
    return createMockReportData(date);
  }

  const response = await fetch(`${CONFIG_URL}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, date }),
  });

  if (!response.ok) {
    throw new Error(`Report fetch failed: ${response.status}`);
  }

  const data = await response.json();

  // Pillar B: Validate response with Zod schema
  const parsed = MorningReportResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Invalid report response: ${parsed.error.message}`);
  }

  return transformReportResponse(parsed.data);
}

export async function fetchReportHistory(
  userId: UserId,
  limit: number = 7,
): Promise<MorningReportResponse[]> {
  // Mocking offline - simulate network failure
  if (isMockingOffline()) {
    await mockDelay(100);
    throw new Error('Network error: offline mode');
  }

  // Mocking online - return mock data
  if (isMockingOnline()) {
    await mockDelay(300);
    return createMockReportHistory(limit);
  }

  const response = await fetch(`${CONFIG_URL}/report/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, limit }),
  });

  if (!response.ok) {
    throw new Error(`History fetch failed: ${response.status}`);
  }

  const data = await response.json();

  // Pillar B: Validate response with Zod schema
  const parsed = ReportHistoryResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Invalid history response: ${parsed.error.message}`);
  }

  return parsed.data.reports.map(transformReportResponse);
}
