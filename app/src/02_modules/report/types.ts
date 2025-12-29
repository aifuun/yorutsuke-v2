// Report module types
import type { Transaction, DailySummary } from '../../01_domains/transaction';

// FSM State for ReportView (Pillar D)
export type ReportState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: ReportData }
  | { status: 'error'; error: string };

// Report data structure
export interface ReportData {
  date: string;
  summary: DailySummary;
  transactions: Transaction[];
  generatedAt: string;
}
