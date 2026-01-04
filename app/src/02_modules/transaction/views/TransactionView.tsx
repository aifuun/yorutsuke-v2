// Pillar L: Views are pure JSX, logic in headless hooks
import { useState, useMemo } from 'react';
import { useTransactionLogic } from '../headless/useTransactionLogic';
import { useTranslation } from '../../../i18n';
import type { UserId } from '../../../00_kernel/types';
import type { Transaction } from '../../../01_domains/transaction';
import './ledger.css';

interface TransactionViewProps {
  userId: UserId | null;
}

// Month names for the interval selector
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_JA = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export function TransactionView({ userId }: TransactionViewProps) {
  const { t, i18n } = useTranslation();
  const { state, transactions, filteredTransactions, confirm, remove } = useTransactionLogic(userId);

  // Year/month selection state
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // null = full year

  // Filter transactions by selected year/month
  const displayTransactions = useMemo(() => {
    return filteredTransactions.filter((t) => {
      const date = new Date(t.date);
      if (date.getFullYear() !== selectedYear) return false;
      if (selectedMonth !== null && date.getMonth() !== selectedMonth) return false;
      return true;
    });
  }, [filteredTransactions, selectedYear, selectedMonth]);

  // Calculate summary
  const summary = useMemo(() => {
    const income = displayTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = displayTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, count: displayTransactions.length };
  }, [displayTransactions]);

  // Handle all states (Pillar D: FSM)
  if (state.status === 'idle') {
    return (
      <div className="ledger">
        <LedgerHeader title={t('nav.ledger')} />
        <div className="ledger-content">
          <div className="ledger-loading">{t('auth.login')}</div>
        </div>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="ledger">
        <LedgerHeader title={t('nav.ledger')} />
        <div className="ledger-content">
          <div className="ledger-loading">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="ledger">
        <LedgerHeader title={t('nav.ledger')} />
        <div className="ledger-content">
          <div className="ledger-error">{state.error}</div>
        </div>
      </div>
    );
  }

  const months = i18n.language === 'ja' ? MONTHS_JA : MONTHS;

  return (
    <div className="ledger">
      <LedgerHeader title={t('nav.ledger')} />

      {/* Time Control Bar */}
      <div className="ledger-controls">
        <div className="control-row">
          <span className="control-label">{t('ledger.yearly')}</span>
          <div className="year-selector">
            {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
              <button
                key={year}
                type="button"
                className={`year-btn ${year === selectedYear ? 'year-btn--active' : ''}`}
                onClick={() => setSelectedYear(year)}
              >
                {year}
                {year === selectedYear && <span className="active-dot" />}
              </button>
            ))}
          </div>
        </div>

        <div className="control-row">
          <span className="control-label">{t('ledger.interval')}</span>
          <div className="interval-selector">
            <button
              type="button"
              className={`interval-btn ${selectedMonth === null ? 'interval-btn--active' : ''}`}
              onClick={() => setSelectedMonth(null)}
            >
              {t('ledger.fullYear')}
            </button>
            <span className="interval-divider" />
            {months.map((month, idx) => (
              <button
                key={month}
                type="button"
                className={`month-btn ${selectedMonth === idx ? 'month-btn--active' : ''}`}
                onClick={() => setSelectedMonth(idx)}
              >
                {month}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="ledger-content">
        <div className="ledger-container">
          {/* Summary Cards */}
          <div className="summary-grid">
            <div className="glass-card summary-card summary-card--inflow">
              <p className="summary-label">{t('ledger.annualInflow')}</p>
              <div className="summary-value mono">¥{summary.income.toLocaleString()}</div>
            </div>
            <div className="glass-card summary-card summary-card--outflow">
              <p className="summary-label">{t('ledger.annualOutflow')}</p>
              <div className="summary-value mono">¥{summary.expense.toLocaleString()}</div>
            </div>
          </div>

          {/* Transaction List */}
          <div className="registry-section">
            <div className="registry-header">
              <h2 className="registry-title">{t('ledger.latestEntries')}</h2>
              <span className="registry-count">
                {t('ledger.totalItems', { count: summary.count })}
              </span>
            </div>

            {displayTransactions.length === 0 ? (
              <div className="glass-card empty-state">
                <p className="empty-title">{t('empty.no-results.title')}</p>
                <p className="empty-message">{t('empty.no-results.message')}</p>
              </div>
            ) : (
              <div className="transaction-list">
                {displayTransactions.map((transaction) => (
                  <TransactionCard
                    key={transaction.id}
                    transaction={transaction}
                    onConfirm={() => confirm(transaction.id)}
                    onDelete={() => remove(transaction.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Header component
function LedgerHeader({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <header className="ledger-header">
      <h1 className="ledger-title">{title}</h1>
      <button type="button" className="btn-new-entry">
        + {t('ledger.newEntry')}
      </button>
    </header>
  );
}

// Transaction Card component
interface TransactionCardProps {
  transaction: Transaction;
  onConfirm: () => void;
  onDelete: () => void;
}

function TransactionCard({ transaction, onConfirm, onDelete }: TransactionCardProps) {
  const { t, i18n } = useTranslation();
  const date = new Date(transaction.date);
  const month = i18n.language === 'ja'
    ? `${date.getMonth() + 1}月`
    : MONTHS[date.getMonth()];
  const day = date.getDate();

  const isConfirmed = !!transaction.confirmedAt;
  const isIncome = transaction.type === 'income';
  const categoryKey = `transaction.categories.${transaction.category}` as const;

  return (
    <div className={`glass-card transaction-card ${isIncome ? 'transaction-card--income' : ''}`}>
      {/* Date Stamp */}
      <div className="date-stamp">
        <span className="date-month">{month}</span>
        <span className="date-day">{day}</span>
      </div>

      {/* Details */}
      <div className="transaction-details">
        <h3 className="transaction-title">
          {transaction.merchant || transaction.description}
        </h3>
        <div className="transaction-tags">
          <span className="tag tag--category">{t(categoryKey)}</span>
          {!isConfirmed && (
            <span className="tag tag--pending">{t('transaction.pending')}</span>
          )}
        </div>
      </div>

      {/* Amount & Actions */}
      <div className="transaction-right">
        <div className={`transaction-amount ${isIncome ? 'amount--income' : 'amount--expense'}`}>
          {isIncome ? '+' : '-'} ¥{transaction.amount.toLocaleString()}
        </div>
        <div className="transaction-actions">
          {!isConfirmed && (
            <button
              type="button"
              className="action-btn action-btn--confirm"
              onClick={onConfirm}
              title={t('transaction.confirm')}
            >
              {t('common.confirm')}
            </button>
          )}
          <button
            type="button"
            className="action-btn action-btn--delete"
            onClick={() => {
              if (confirm(t('transaction.deleteConfirm'))) {
                onDelete();
              }
            }}
            title={t('transaction.delete')}
          >
            {t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
