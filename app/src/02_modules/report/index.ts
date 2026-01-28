// Public API for report module
// ADR-001: Service Pattern - exports service, hooks, and views

// Services
export { reportService } from './services/reportService';

// Hooks (Hook Bridge Layer - ADR-020)
export {
  useReportStatus,
  useSelectedDate,
  useDailySummary,
  useTrendData,
  usePendingTransactions,
  useReportError,
  reportActions,
} from './hooks/useReportState';

// Views
export { ReportView, DashboardView, SummaryCards, CategoryBreakdown, TransactionList } from './views';

// Adapters (legacy, kept for backward compatibility)
export { fetchMorningReport, fetchReportHistory } from './adapters';

// Types
export type { ReportState, ReportData } from './types';
export type { ReportStatus, PendingTransactionItem, TrendData } from './stores/reportStore';

// Mock config is now centralized: import { USE_MOCK } from '00_kernel/config/mock'
