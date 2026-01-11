// Pillar L: History modal with calendar and day summary
import { useState, useMemo } from 'react';
import type { Transaction } from '../../../01_domains/transaction';
import { createDailySummary } from '../../../01_domains/transaction';
import { useTranslation } from '../../../i18n';
import { CalendarView } from './CalendarView';
import '../styles/history-modal.css';

interface HistoryModalProps {
  transactions: Transaction[];
  onClose: () => void;
  initialDate?: string; // YYYY-MM-DD
}

export function HistoryModal({ transactions, onClose, initialDate }: HistoryModalProps) {
  const { t } = useTranslation();
  const today = new Date();

  // Calendar state
  const [selectedDate, setSelectedDate] = useState(initialDate || today.toLocaleDateString('sv-SE'));
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  // Transaction counts by date
  const transactionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    transactions.forEach(tx => {
      counts[tx.date] = (counts[tx.date] || 0) + 1;
    });
    return counts;
  }, [transactions]);

  // Daily summary for selected date
  const dailySummary = useMemo(() => {
    return createDailySummary(selectedDate, transactions);
  }, [selectedDate, transactions]);

  // Transactions for selected date
  const dayTransactions = useMemo(() => {
    return transactions
      .filter(tx => tx.date === selectedDate)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [selectedDate, transactions]);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  const handleMonthChange = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  const netProfit = dailySummary.totalIncome - dailySummary.totalExpense;
  const isPositive = netProfit >= 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="history-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="history-modal-header">
          <h2>{t('history.title')}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label={t('common.cancel')}
          >
            ✕
          </button>
        </div>

        {/* Content: Calendar + Summary side by side */}
        <div className="history-modal-content">
          {/* Left: Calendar */}
          <div className="history-modal-calendar">
            <CalendarView
              year={currentYear}
              month={currentMonth}
              selectedDate={selectedDate}
              transactionCounts={transactionCounts}
              onDateSelect={handleDateSelect}
              onMonthChange={handleMonthChange}
            />
          </div>

          {/* Right: Day Summary */}
          <div className="history-modal-summary">
            <h3 className="summary-date">{selectedDate}</h3>

            {dailySummary.transactionCount === 0 ? (
              <div className="summary-empty">
                <p className="empty-icon">📅</p>
                <p className="empty-text">{t('history.noTransactions')}</p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="summary-cards">
                  <div className="summary-card summary-card--income">
                    <span className="summary-card-label">{t('report.income')}</span>
                    <span className="summary-card-value">
                      ¥{dailySummary.totalIncome.toLocaleString()}
                    </span>
                  </div>

                  <div className="summary-card summary-card--expense">
                    <span className="summary-card-label">{t('report.expense')}</span>
                    <span className="summary-card-value">
                      ¥{dailySummary.totalExpense.toLocaleString()}
                    </span>
                  </div>

                  <div className={`summary-card summary-card--net ${isPositive ? 'positive' : 'negative'}`}>
                    <span className="summary-card-label">{t('report.netProfit')}</span>
                    <span className="summary-card-value">
                      {isPositive ? '+' : '-'}¥{Math.abs(netProfit).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Transaction List */}
                <div className="summary-transactions">
                  <h4 className="summary-section-title">
                    {t('history.transactions')} ({dailySummary.transactionCount})
                  </h4>
                  <div className="transaction-list">
                    {dayTransactions.map(tx => (
                      <div key={tx.id} className="transaction-item">
                        <div className="transaction-info">
                          <span className="transaction-merchant">
                            {tx.merchant || tx.description}
                          </span>
                          <span className="transaction-category">
                            {t(`transaction.categories.${tx.category}`)}
                          </span>
                        </div>
                        <span className={`transaction-amount ${tx.type === 'income' ? 'income' : 'expense'}`}>
                          {tx.type === 'income' ? '+' : '-'}¥{tx.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
