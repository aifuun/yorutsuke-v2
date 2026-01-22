// Pillar L: View - renders data from headless hook
import { useMemo, useState, useEffect } from 'react';
import type { UserId, TransactionId } from '../../../00_kernel/types';
import type { Transaction } from '../../../01_domains/transaction';
import { createDailySummary } from '../../../01_domains/transaction';
import { useTransactions, useTransactionStatus } from '../../transaction/hooks/useTransactionState';
import { transactionService } from '../../transaction/services/transactionService';
import { useTranslation } from '../../../i18n';
import { SummaryCards } from './SummaryCards';
import { CategoryBreakdown } from './CategoryBreakdown';
import { TransactionList } from './TransactionList';
import { FilterBar } from './FilterBar';
import { EmptyState } from './EmptyState';
import '../styles/report.css';

interface ReportViewProps {
  userId: UserId | null;
  date?: string;
}

export function ReportView({ userId, date }: ReportViewProps) {
  const { t } = useTranslation();
  const targetDate = date || new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in local TZ

  // Local filter state
  const [filters, setFiltersLocal] = useState({ dateStart: undefined, dateEnd: undefined, category: 'all' as const, type: 'all' as const });

  // Initialize service with user
  useEffect(() => {
    if (userId) {
      transactionService.init();
      transactionService.setUser(userId);
    }
  }, [userId]);

  const state = useTransactionStatus();
  const transactions = useTransactions();

  // Action handlers
  const setFilters = (newFilters: any) => setFiltersLocal(newFilters);
  const clearFilters = () => setFiltersLocal({ dateStart: undefined, dateEnd: undefined, category: 'all' as const, type: 'all' as const });

  // Local action methods
  const save = async (tx: Transaction) => {
    await transactionService.saveTransaction(tx);
  };
  const confirm = async (id: TransactionId) => {
    await transactionService.confirmTransaction(id);
  };
  const remove = async (id: TransactionId) => {
    await transactionService.removeTransaction(id);
  };

  // Filter transactions locally
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (filters.category && filters.category !== 'all' && tx.category !== filters.category) return false;
      if (filters.type && filters.type !== 'all' && tx.type !== filters.type) return false;
      return true;
    });
  }, [transactions, filters]);

  // Compute summary from filtered transactions
  const summary = useMemo(
    () => createDailySummary(targetDate, filteredTransactions),
    [targetDate, filteredTransactions]
  );

  // Determine empty state variant
  const hasFiltersApplied = filters.dateStart || filters.dateEnd ||
    (filters.category && filters.category !== 'all') ||
    (filters.type && filters.type !== 'all');

  const emptyVariant = transactions.length === 0
    ? 'first-use'
    : hasFiltersApplied && filteredTransactions.length === 0
    ? 'no-results'
    : filteredTransactions.length === 0
    ? 'no-data-today'
    : null;

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
  if (!userId) {
    // No user - show first-use empty state
    return (
      <div className="morning-report">
        <header className="report-header">
          <h2>{t('report.title')}</h2>
        </header>
        <EmptyState variant="first-use" />
      </div>
    );
  }
  if (state === 'loading') {
    return <div className="report-loading">{t('common.loading')}</div>;
  }
  if (state === 'idle') {
    // Initial state before load starts - treat as loading
    return <div className="report-loading">{t('common.loading')}</div>;
  }
  if (state === 'error') {
    return <div className="report-error">{t('common.error')}</div>;
  }

  return (
    <div className="morning-report">
      <header className="report-header">
        <h2>{t('report.title')}</h2>
        <span className="report-date">{targetDate}</span>
      </header>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        onClear={clearFilters}
      />

      {emptyVariant === 'first-use' ? (
        <EmptyState variant="first-use" />
      ) : (
        <>
          <SummaryCards summary={summary} />
          <CategoryBreakdown byCategory={summary.byCategory} />
          {emptyVariant === 'no-results' ? (
            <EmptyState
              variant="no-results"
              action={{ label: t('filter.clear'), onClick: clearFilters }}
            />
          ) : emptyVariant === 'no-data-today' ? (
            <EmptyState variant="no-data-today" />
          ) : (
            <TransactionList
              transactions={filteredTransactions}
              onEdit={handleEdit}
              onConfirm={handleConfirm}
              onDelete={handleDelete}
            />
          )}
        </>
      )}

      <footer className="report-footer">
        <span>{t('report.transactionCount', { count: filteredTransactions.length })}</span>
        {filteredTransactions.length !== transactions.length && (
          <span className="filter-indicator">
            {' '}({t('filter.filtered', { total: transactions.length })})
          </span>
        )}
      </footer>
    </div>
  );
}
