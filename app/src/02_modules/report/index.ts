// Public API for report module (T1 - no headless)
export { ReportView, DashboardView, ReportHistoryView, SummaryCards, CategoryBreakdown, TransactionList } from './views';
export { fetchMorningReport, fetchReportHistory } from './adapters';
export type { ReportState, ReportData } from './types';
// Mock config is now centralized: import { USE_MOCK } from '00_kernel/config/mock'
