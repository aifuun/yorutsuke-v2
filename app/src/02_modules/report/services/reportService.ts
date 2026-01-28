// Report Service - Pure TypeScript service for report data orchestration
// Pillar L: Headless - business logic separate from UI
// ADR-001: Service Pattern - orchestrates data flow between transaction store and report store
// ADR-020: Hook Bridge - connects to React via useReportState hooks

import { reportStore } from '../stores/reportStore';
import type { PendingTransactionItem, TrendData } from '../stores/reportStore';
import { transactionStore } from '../../transaction/stores/transactionStore';
import type { Transaction } from '../../../01_domains/transaction';
import {
  createDailySummaryWithBreakdown,
  createWeeklySummary,
} from '../../../01_domains/transaction';

// Helper functions for date calculations
function getTodayDate(): string {
  return new Date().toLocaleDateString('sv-SE');
}

function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toLocaleDateString('sv-SE');
}

function getThisWeekMonday(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toLocaleDateString('sv-SE');
}

function getLastWeekMonday(): string {
  const thisWeekMonday = new Date(getThisWeekMonday());
  thisWeekMonday.setDate(thisWeekMonday.getDate() - 7);
  return thisWeekMonday.toLocaleDateString('sv-SE');
}

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

class ReportService {
  private unsubscribe: (() => void) | null = null;

  /**
   * Initialize service - subscribe to transaction store changes
   * Called once at app startup (main.tsx)
   */
  init() {
    // Subscribe to transaction store changes
    this.unsubscribe = transactionStore.subscribe((state) => {
      // Update reports whenever transactions change
      this.updateReports(state.transactions);
    });

    // Initial load
    const transactions = transactionStore.getState().transactions;
    if (transactions.length > 0) {
      this.updateReports(transactions);
    }
  }

  /**
   * Cleanup subscriptions
   */
  cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Set selected date and recalculate reports
   * Called from UI when user changes date selector
   */
  setDate(date: string) {
    reportStore.getState().setSelectedDate(date);
    const transactions = transactionStore.getState().transactions;
    this.updateReports(transactions);
  }

  /**
   * Main orchestration: compute all report data from transactions
   * This is the core business logic that was previously in DashboardView
   */
  private updateReports(transactions: Transaction[]) {
    const selectedDate = reportStore.getState().selectedDate;

    // Phase 1: Daily summary with breakdown
    const dailySummary = createDailySummaryWithBreakdown(selectedDate, transactions);

    // Phase 2: Trend comparison data
    const trendData = this.calculateTrend(transactions);

    // Phase 3: Pending transactions (unconfirmed only, limit 5)
    const pendingTransactions = this.filterPending(transactions);

    // Bulk update to reduce re-renders
    reportStore.getState().updateReportData({
      dailySummary,
      trendData,
      pendingTransactions,
    });
  }

  /**
   * Calculate trend comparison (weekly and daily)
   */
  private calculateTrend(transactions: Transaction[]): TrendData {
    const today = getTodayDate();
    const yesterday = getYesterdayDate();
    const thisWeekMonday = getThisWeekMonday();
    const lastWeekMonday = getLastWeekMonday();

    const thisWeek = createWeeklySummary(thisWeekMonday, transactions);
    const lastWeek = createWeeklySummary(lastWeekMonday, transactions);

    // Calculate week-over-week change (handle edge cases)
    const weekChange =
      lastWeek.net !== 0
        ? ((thisWeek.net - lastWeek.net) / Math.abs(lastWeek.net)) * 100
        : thisWeek.net === 0
          ? 0
          : thisWeek.net > 0
            ? 100
            : -100;

    // Calculate day-over-day change (today vs yesterday)
    const todaySummary = createDailySummaryWithBreakdown(today, transactions);
    const yesterdaySummary = createDailySummaryWithBreakdown(yesterday, transactions);
    const todayNet = todaySummary.totalIncome - todaySummary.totalExpense;
    const yesterdayNet = yesterdaySummary.totalIncome - yesterdaySummary.totalExpense;

    const dayChange =
      yesterdayNet !== 0
        ? ((todayNet - yesterdayNet) / Math.abs(yesterdayNet)) * 100
        : todayNet === 0
          ? 0
          : todayNet > 0
            ? 100
            : -100;

    return {
      thisWeek,
      lastWeek,
      weekChange,
      todayNet,
      yesterdayNet,
      dayChange,
    };
  }

  /**
   * Filter and format pending transactions for display
   */
  private filterPending(transactions: Transaction[]): PendingTransactionItem[] {
    return transactions
      .filter((tx) => tx.status !== 'confirmed')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map((tx) => ({
        id: tx.id,
        // Use merchant if available, otherwise use translation key for category
        merchant: tx.merchant || `transaction.categories.${tx.category}`,
        amount: tx.amount,
        type: tx.type,
        date: tx.date,
        imageId: tx.imageId,
        confidence: tx.confidence,
        time: formatRelativeTime(tx.createdAt),
      }));
  }
}

// Singleton instance
export const reportService = new ReportService();
