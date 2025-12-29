// Pillar L: T1 View - simple fetch and render
import { useState, useEffect } from 'react';
import type { UserId } from '../../../00_kernel/types';
import type { ReportState } from '../types';
import { fetchMorningReport } from '../adapters/reportApi';
import { SummaryCards } from './SummaryCards';
import { CategoryBreakdown } from './CategoryBreakdown';
import { TransactionList } from './TransactionList';
import '../styles/report.css';

interface ReportViewProps {
  userId: UserId;
  date?: string;
}

export function ReportView({ userId, date }: ReportViewProps) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const [state, setState] = useState<ReportState>({ status: 'idle' });

  useEffect(() => {
    setState({ status: 'loading' });
    fetchMorningReport(userId, targetDate)
      .then((data) => setState({ status: 'success', data }))
      .catch((e) => setState({ status: 'error', error: String(e) }));
  }, [userId, targetDate]);

  // Handle all states (Pillar D: FSM)
  if (state.status === 'idle') return null;
  if (state.status === 'loading') {
    return <div className="report-loading">Loading report...</div>;
  }
  if (state.status === 'error') {
    return <div className="report-error">Error: {state.error}</div>;
  }

  const { data } = state;

  return (
    <div className="morning-report">
      <header className="report-header">
        <h2>Morning Report</h2>
        <span className="report-date">{data.date}</span>
      </header>

      <SummaryCards summary={data.summary} />
      <CategoryBreakdown byCategory={data.summary.byCategory} />
      <TransactionList transactions={data.transactions} />

      <footer className="report-footer">
        <span>Generated: {new Date(data.generatedAt).toLocaleTimeString()}</span>
      </footer>
    </div>
  );
}
