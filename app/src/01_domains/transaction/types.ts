import type { TransactionId, ImageId, UserId } from '../../00_kernel/types';

// Transaction categories
export type TransactionCategory =
  | 'purchase'    // Buying items for resale
  | 'sale'        // Selling items
  | 'shipping'    // Shipping costs
  | 'packaging'   // Packaging materials
  | 'fee'         // Platform fees (Mercari, Yahoo, etc.)
  | 'other';      // Other expenses

// Transaction type
export type TransactionType = 'income' | 'expense';

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
  confirmedAt: string | null;

  // AI extraction metadata
  confidence: number | null;  // 0-1 from Nova Lite
  rawText: string | null;     // OCR result
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

// Transaction filters
export interface TransactionFilters {
  dateStart?: string;    // YYYY-MM-DD
  dateEnd?: string;      // YYYY-MM-DD
  category?: TransactionCategory | 'all';
  type?: TransactionType | 'all';
}
