// Pillar L: T1 View - simple fetch and render
import { useState, useEffect } from 'react';
import type { UserId } from '../../../00_kernel/types';
import type { DailySummary } from '../../../01_domains/transaction';
import { fetchMorningReport } from '../adapters/reportApi';

interface ReportViewProps {
  userId: UserId;
  date?: string;
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; summary: DailySummary }
  | { status: 'error'; error: string };

export function ReportView({ userId, date }: ReportViewProps) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const [state, setState] = useState<State>({ status: 'idle' });

  useEffect(() => {
    setState({ status: 'loading' });
    fetchMorningReport(userId, targetDate)
      .then((report) => setState({ status: 'success', summary: report.summary }))
      .catch((e) => setState({ status: 'error', error: String(e) }));
  }, [userId, targetDate]);

  // Handle all states
  if (state.status === 'idle') return null;
  if (state.status === 'loading') return <div>Loading report...</div>;
  if (state.status === 'error') return <div>Error: {state.error}</div>;

  const { summary } = state;

  return (
    <div className="report-container">
      <h2>Morning Report - {summary.date}</h2>

      <div className="report-summary">
        <div className="summary-item income">
          <span>Income</span>
          <span>¥{summary.totalIncome.toLocaleString()}</span>
        </div>
        <div className="summary-item expense">
          <span>Expense</span>
          <span>¥{summary.totalExpense.toLocaleString()}</span>
        </div>
        <div className="summary-item net">
          <span>Net Profit</span>
          <span className={summary.netProfit >= 0 ? 'positive' : 'negative'}>
            ¥{summary.netProfit.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="category-breakdown">
        <h3>By Category</h3>
        {Object.entries(summary.byCategory).map(([category, amount]) => (
          <div key={category} className="category-item">
            <span>{category}</span>
            <span>¥{amount.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="report-meta">
        <span>Transactions: {summary.transactionCount}</span>
      </div>
    </div>
  );
}
