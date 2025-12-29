// Report history with calendar navigation
import { useState, useMemo } from 'react';
import type { UserId } from '../../../00_kernel/types';
import { createDailySummary } from '../../../01_domains/transaction';
import { useTransactionLogic } from '../../transaction';
import { useTranslation } from '../../../i18n';
import { CalendarView } from './CalendarView';
import { SummaryCards } from './SummaryCards';
import { EmptyState } from './EmptyState';
import '../styles/history.css';

interface ReportHistoryViewProps {
  userId: UserId;
  onDateSelect?: (date: string) => void;
}

export function ReportHistoryView({ userId, onDateSelect }: ReportHistoryViewProps) {
  const { t } = useTranslation();
  const { state, transactions } = useTransactionLogic(userId);

  // Calendar state
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Get unique dates with transactions
  const transactionDates = useMemo(() => {
    return new Set(transactions.map(t => t.date));
  }, [transactions]);

  // Monthly summary
  const monthlySummary = useMemo(() => {
    const monthStart = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`;
    const monthEnd = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-31`;

    const monthTransactions = transactions.filter(t =>
      t.date >= monthStart && t.date <= monthEnd
    );

    const income = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      income,
      expense,
      netProfit: income - expense,
      count: monthTransactions.length,
    };
  }, [transactions, viewYear, viewMonth]);

  // Selected date summary
  const selectedSummary = useMemo(() => {
    if (!selectedDate) return null;
    return createDailySummary(selectedDate, transactions);
  }, [selectedDate, transactions]);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    onDateSelect?.(date);
  };

  const handleMonthChange = (year: number, month: number) => {
    setViewYear(year);
    setViewMonth(month);
    setSelectedDate(null);
  };

  // Handle states
  if (state.status === 'loading' || state.status === 'idle') {
    return <div className="history-loading">{t('common.loading')}</div>;
  }

  if (state.status === 'error') {
    return <div className="history-error">{t('common.error')}</div>;
  }

  // Show empty state for first-time users
  if (transactions.length === 0) {
    return (
      <div className="report-history">
        <header className="history-header">
          <h2>{t('history.title')}</h2>
        </header>
        <EmptyState variant="first-use" />
      </div>
    );
  }

  return (
    <div className="report-history">
      <header className="history-header">
        <h2>{t('history.title')}</h2>
      </header>

      <div className="history-content">
        <CalendarView
          year={viewYear}
          month={viewMonth}
          selectedDate={selectedDate}
          transactionDates={transactionDates}
          onDateSelect={handleDateSelect}
          onMonthChange={handleMonthChange}
        />

        <div className="history-summary">
          <div className="monthly-summary">
            <h3>{t('history.monthlySummary')}</h3>
            <div className="summary-row">
              <span className="summary-label">{t('report.income')}</span>
              <span className="summary-value income">+¥{monthlySummary.income.toLocaleString()}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">{t('report.expense')}</span>
              <span className="summary-value expense">-¥{monthlySummary.expense.toLocaleString()}</span>
            </div>
            <div className="summary-row total">
              <span className="summary-label">{t('report.netProfit')}</span>
              <span className={`summary-value ${monthlySummary.netProfit >= 0 ? 'positive' : 'negative'}`}>
                ¥{monthlySummary.netProfit.toLocaleString()}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">{t('history.transactionCount')}</span>
              <span className="summary-value">{monthlySummary.count}</span>
            </div>
          </div>

          {selectedDate && selectedSummary && (
            <div className="daily-summary">
              <h3>{selectedDate}</h3>
              <SummaryCards summary={selectedSummary} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
