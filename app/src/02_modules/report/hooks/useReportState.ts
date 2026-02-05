// Report Hooks - React bridge to reportService
// Pillar L: Headless - React bridge layer
// ADR-001: Service Pattern - hooks connect React components to vanilla stores
// ADR-012: Zustand Selector Safety - primitive selectors only
// ADR-020: Hook Bridge Layer - formal pattern for React-Service connection

import { useStore } from 'zustand';
import { reportStore } from '../stores/reportStore';
import type { ReportStatus, PendingTransactionItem, TrendData } from '../stores/reportStore';
import type { DailySummaryBreakdown } from '../../../01_domains/transaction';
import { reportService } from '../services/reportService';

// ========== Primitive Selectors (ADR-012) ==========
// All selectors return primitive values or immutable references
// No object creation in selectors to prevent infinite loops

/**
 * Get current report status
 * Returns: 'idle' | 'loading' | 'success' | 'error'
 */
export function useReportStatus(): ReportStatus {
  return useStore(reportStore, (s) => s.status);
}

/**
 * Get currently selected date (YYYY-MM-DD)
 */
export function useSelectedDate(): string {
  return useStore(reportStore, (s) => s.selectedDate);
}

/**
 * Get daily summary with confirmed/unconfirmed breakdown
 * Returns null if not yet loaded
 */
export function useDailySummary(): DailySummaryBreakdown | null {
  return useStore(reportStore, (s) => s.dailySummary);
}

/**
 * Get trend comparison data (weekly and daily)
 * Returns null if not yet loaded
 */
export function useTrendData(): TrendData | null {
  return useStore(reportStore, (s) => s.trendData);
}

/**
 * Get pending transactions (top 5 unconfirmed)
 * Returns empty array if none
 */
export function usePendingTransactions(): PendingTransactionItem[] {
  return useStore(reportStore, (s) => s.pendingTransactions);
}

/**
 * Get error message
 * Returns null if no error
 */
export function useReportError(): string | null {
  return useStore(reportStore, (s) => s.error);
}

// ========== Actions (ADR-020) ==========
// Actions are plain objects that call service methods
// No hooks needed for actions - they're just function calls

export const reportActions = {
  /**
   * Set selected date and recalculate reports
   * @param date - YYYY-MM-DD format
   */
  setDate: (date: string) => {
    reportService.setDate(date);
  },
};
