// Pillar L: View - renders data from headless hook
import { useMemo, useEffect, useRef } from 'react';
import type { UserId, TransactionId } from '../../../00_kernel/types';
import type { Transaction } from '../../../01_domains/transaction';
import { createDailySummary } from '../../../01_domains/transaction';
import { useTransactionLogic } from '../../transaction';
import { seedMockTransactions } from '../../transaction/adapters/seedData';
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
  const { state, transactions, save, confirm, remove, load } = useTransactionLogic(userId);
  const seededRef = useRef(false);

  // Seed mock data for development (only once)
  useEffect(() => {
    if (!seededRef.current && userId) {
      seededRef.current = true;
      seedMockTransactions(userId).then((seeded) => {
        if (seeded) load(); // Reload if data was seeded
      });
    }
  }, [userId, load]);

  // Compute summary from transactions
  const summary = useMemo(
    () => createDailySummary(targetDate, transactions),
    [targetDate, transactions]
  );

  // Action handlers
  const handleEdit = async (id: TransactionId, changes: Partial<Transaction>) => {
    const tx = transactions.find(t => t.id === id);
    if (tx) {
      await save({ ...tx, ...changes, updatedAt: new Date().toISOString() });
    }
  };

  const handleConfirm = async (id: TransactionId) => {
    await confirm(id);
  };

  const handleDelete = async (id: TransactionId) => {
    await remove(id);
  };

  // Handle all states (Pillar D: FSM)
  if (state.status === 'idle' || state.status === 'loading') {
    return <div className="report-loading">Loading report...</div>;
  }
  if (state.status === 'error') {
    return <div className="report-error">Error: {state.error}</div>;
  }

  return (
    <div className="morning-report">
      <header className="report-header">
        <h2>Morning Report</h2>
        <span className="report-date">{targetDate}</span>
      </header>

      <SummaryCards summary={summary} />
      <CategoryBreakdown byCategory={summary.byCategory} />
      <TransactionList
        transactions={transactions}
        onEdit={handleEdit}
        onConfirm={handleConfirm}
        onDelete={handleDelete}
      />

      <footer className="report-footer">
        <span>{transactions.length} transactions</span>
      </footer>
    </div>
  );
}
