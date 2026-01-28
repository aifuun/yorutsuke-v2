// Report Store - Zustand vanilla store for report data management
// Pillar D: FSM - no boolean flags
// Pillar J: Locality - state near usage
// ADR-001: Service Pattern - vanilla store owned by reportService

import { createStore } from 'zustand/vanilla';
import type { DailySummaryBreakdown } from '../../../01_domains/transaction';

// Pending transaction display data (computed from full transactions)
export interface PendingTransactionItem {
  id: string;
  merchant: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  imageId: string | null;
  confidence: number | null;
  time: string; // Relative time like "2 hours ago"
}

// Trend comparison data (weekly and daily)
export interface TrendData {
  thisWeek: {
    net: number;
    income: number;
    expense: number;
    count: number;
  };
  lastWeek: {
    net: number;
    income: number;
    expense: number;
    count: number;
  };
  weekChange: number; // Percentage change
  todayNet: number;
  yesterdayNet: number;
  dayChange: number; // Percentage change
}

// FSM State (union type for status)
export type ReportStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ReportState {
  status: ReportStatus;
  selectedDate: string; // YYYY-MM-DD
  dailySummary: DailySummaryBreakdown | null;
  trendData: TrendData | null;
  pendingTransactions: PendingTransactionItem[];
  error: string | null;
}

export interface ReportActions {
  // State setters
  setStatus: (status: ReportStatus) => void;
  setSelectedDate: (date: string) => void;
  setDailySummary: (summary: DailySummaryBreakdown | null) => void;
  setTrendData: (data: TrendData | null) => void;
  setPendingTransactions: (items: PendingTransactionItem[]) => void;
  setError: (error: string | null) => void;

  // Bulk update (for service layer efficiency)
  updateReportData: (data: {
    dailySummary: DailySummaryBreakdown | null;
    trendData: TrendData | null;
    pendingTransactions: PendingTransactionItem[];
  }) => void;

  // Getters - for service layer to read state
  getStatus: () => ReportStatus;
  getSelectedDate: () => string;
  getDailySummary: () => DailySummaryBreakdown | null;
  getTrendData: () => TrendData | null;
  getPendingTransactions: () => PendingTransactionItem[];
  getError: () => string | null;
}

export type ReportStore = ReportState & ReportActions;

// Helper: get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  return new Date().toLocaleDateString('sv-SE');
}

export const reportStore = createStore<ReportStore>((set, get) => ({
  // Initial state
  status: 'idle',
  selectedDate: getTodayDate(),
  dailySummary: null,
  trendData: null,
  pendingTransactions: [],
  error: null,

  // State setters
  setStatus: (status) => set({ status }),

  setSelectedDate: (date) => set({ selectedDate: date }),

  setDailySummary: (summary) => set({ dailySummary: summary }),

  setTrendData: (data) => set({ trendData: data }),

  setPendingTransactions: (items) => set({ pendingTransactions: items }),

  setError: (error) => set({ error }),

  // Bulk update (reduces re-renders)
  updateReportData: (data) =>
    set({
      dailySummary: data.dailySummary,
      trendData: data.trendData,
      pendingTransactions: data.pendingTransactions,
      status: 'success',
      error: null,
    }),

  // Getters (for service layer)
  getStatus: () => get().status,

  getSelectedDate: () => get().selectedDate,

  getDailySummary: () => get().dailySummary,

  getTrendData: () => get().trendData,

  getPendingTransactions: () => get().pendingTransactions,

  getError: () => get().error,
}));
