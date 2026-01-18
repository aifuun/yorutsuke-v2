import type { TransactionId, ImageId, UserId } from '../../00_kernel/types';

// Transaction categories (General personal finance)
export type TransactionCategory =
  | 'food'          // Food & Dining
  | 'transport'     // Transportation
  | 'shopping'      // Shopping & Retail
  | 'entertainment' // Entertainment & Recreation
  | 'utilities'     // Utilities & Bills
  | 'health'        // Healthcare & Medical
  | 'other';        // Other expenses

// Transaction type
export type TransactionType = 'income' | 'expense';

// Transaction status (for cloud sync)
export type TransactionStatus = 'unconfirmed' | 'confirmed' | 'deleted' | 'needs_review';

export interface Transaction {
  id: TransactionId;
  userId: UserId;
  imageId: ImageId | null;
  s3Key: string | null;     // S3 object key for the associated image
  type: TransactionType;
  category: TransactionCategory;
  amount: number;           // Always positive
  currency: 'JPY';
  description: string;
  merchant: string | null;
  date: string;             // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
  status: TransactionStatus; // Sync status (unconfirmed/confirmed/deleted/needs_review)

  // AI extraction metadata
  confidence: number | null;          // [DEPRECATED: use primaryConfidence] 0-1 scale
  rawText: string | null;             // OCR result
  primaryModelId: string | null;      // e.g., 'us.amazon.nova-lite-v1:0', 'azure_di'
  primaryConfidence: number | null;   // 0-100 confidence score (if available)
}

// Daily summary for morning report
export interface DailySummary {
  date: string;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  transactionCount: number;
  byCategory: Record<TransactionCategory, number>;
}

// Daily summary with confirmed/unconfirmed breakdown
export interface DailySummaryBreakdown {
  date: string;
  totalIncome: number;
  totalExpense: number;
  confirmedIncome: number;
  confirmedExpense: number;
  unconfirmedIncome: number;
  unconfirmedExpense: number;
  count: number;
  confirmedCount: number;
  unconfirmedCount: number;
}

// Transaction filters
export interface TransactionFilters {
  dateStart?: string;    // YYYY-MM-DD
  dateEnd?: string;      // YYYY-MM-DD
  category?: TransactionCategory | 'all';
  type?: TransactionType | 'all';
}
