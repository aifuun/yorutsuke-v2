// Pillar L: Views are pure JSX, logic in headless hooks
import { useState, useMemo, useCallback } from 'react';
import { useTransactionLogic } from '../headless/useTransactionLogic';
import { useTranslation } from '../../../i18n';
import { ask } from '@tauri-apps/plugin-dialog';
import DatePicker from 'react-datepicker';
import { ja } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import type { UserId } from '../../../00_kernel/types';
import type { Transaction } from '../../../01_domains/transaction';
import './ledger.css';

type ViewType = 'dashboard' | 'ledger' | 'capture' | 'settings' | 'profile' | 'debug';

interface TransactionViewProps {
  userId: UserId | null;
  onNavigate?: (view: ViewType) => void;
}

// Month names for display
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Get day boundaries
function getDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function getDayEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

// Quick filter helpers
function getThisMonth(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of month
  return { start, end };
}

function getLastMonth(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
  return { start, end };
}

function getThisYear(): { start: Date; end: Date } {
  const year = new Date().getFullYear();
  return {
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31),
  };
}

type QuickFilter = 'thisMonth' | 'lastMonth' | 'thisYear' | 'all' | 'custom';

export function TransactionView({ userId, onNavigate }: TransactionViewProps) {
  const { t, i18n } = useTranslation();
  const { state, filteredTransactions, confirm, remove } = useTransactionLogic(userId);

  // Date range state
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [activeFilter, setActiveFilter] = useState<QuickFilter>('thisMonth');

  // Apply quick filter
  const applyQuickFilter = useCallback((filter: QuickFilter) => {
    setActiveFilter(filter);
    if (filter === 'thisMonth') {
      const { start, end } = getThisMonth();
      setStartDate(start);
      setEndDate(end);
    } else if (filter === 'lastMonth') {
      const { start, end } = getLastMonth();
      setStartDate(start);
      setEndDate(end);
    } else if (filter === 'thisYear') {
      const { start, end } = getThisYear();
      setStartDate(start);
      setEndDate(end);
    }
    // 'all' and 'custom' don't change the date selectors
  }, []);

  // Handle manual date change from DatePicker
  const handleDateChange = (type: 'start' | 'end', date: Date | null) => {
    if (!date) return;
    setActiveFilter('custom');
    if (type === 'start') {
      setStartDate(date);
    } else {
      setEndDate(date);
    }
  };

  // Filter transactions by date range
  const displayTransactions = useMemo(() => {
    if (activeFilter === 'all') {
      return filteredTransactions;
    }
    const start = getDayStart(startDate);
    const end = getDayEnd(endDate);
    return filteredTransactions.filter((t) => {
      const date = new Date(t.date);
      return date >= start && date <= end;
    });
  }, [filteredTransactions, startDate, endDate, activeFilter]);

  // DatePicker locale
  const dateLocale = i18n.language === 'ja' ? ja : undefined;

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

  const handleNewEntry = () => onNavigate?.('capture');

  // Handle all states (Pillar D: FSM)
  if (state.status === 'idle') {
    return (
      <div className="ledger">
        <LedgerHeader title={t('nav.ledger')} onNewEntry={handleNewEntry} />
        <div className="ledger-content">
          <div className="ledger-loading">{t('auth.login')}</div>
        </div>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="ledger">
        <LedgerHeader title={t('nav.ledger')} onNewEntry={handleNewEntry} />
        <div className="ledger-content">
          <div className="ledger-loading">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="ledger">
        <LedgerHeader title={t('nav.ledger')} onNewEntry={handleNewEntry} />
        <div className="ledger-content">
          <div className="ledger-error">{state.error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ledger">
      <LedgerHeader title={t('nav.ledger')} onNewEntry={handleNewEntry} />

      <div className="ledger-content">
        <div className="ledger-container">
          {/* Date Picker Card */}
          <div className="card card--picker">
            {/* Date Range Selectors */}
            <span className="picker-label">{t('ledger.dateRange')}</span>
            <div className="date-range-row">
              {/* Start Date */}
              <DatePicker
                selected={startDate}
                onChange={(date: Date | null) => handleDateChange('start', date)}
                dateFormat="yyyy/MM/dd"
                locale={dateLocale}
                className="input input--date"
                selectsStart
                startDate={startDate}
                endDate={endDate}
              />

              <span className="date-range-arrow">→</span>

              {/* End Date */}
              <DatePicker
                selected={endDate}
                onChange={(date: Date | null) => handleDateChange('end', date)}
                dateFormat="yyyy/MM/dd"
                locale={dateLocale}
                className="input input--date"
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate}
              />
            </div>

            {/* Quick Filters */}
            <div className="quick-filters">
              <button
                type="button"
                className={`btn btn--filter ${activeFilter === 'thisMonth' ? 'btn--filter-active' : ''}`}
                onClick={() => applyQuickFilter('thisMonth')}
              >
                {t('ledger.thisMonth')}
              </button>
              <button
                type="button"
                className={`btn btn--filter ${activeFilter === 'lastMonth' ? 'btn--filter-active' : ''}`}
                onClick={() => applyQuickFilter('lastMonth')}
              >
                {t('ledger.lastMonth')}
              </button>
              <button
                type="button"
                className={`btn btn--filter ${activeFilter === 'thisYear' ? 'btn--filter-active' : ''}`}
                onClick={() => applyQuickFilter('thisYear')}
              >
                {t('ledger.thisYear')}
              </button>
              <button
                type="button"
                className={`btn btn--filter ${activeFilter === 'all' ? 'btn--filter-active' : ''}`}
                onClick={() => applyQuickFilter('all')}
              >
                {t('ledger.all')}
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="summary-grid">
            <div className="card card--summary is-income">
              <p className="card--summary__label">{t('ledger.annualInflow')}</p>
              <p className="card--summary__value">¥{summary.income.toLocaleString()}</p>
            </div>
            <div className="card card--summary is-expense">
              <p className="card--summary__label">{t('ledger.annualOutflow')}</p>
              <p className="card--summary__value">¥{summary.expense.toLocaleString()}</p>
            </div>
          </div>

          {/* Transaction List */}
          <div className="card card--list">
            <div className="card--list__header">
              <h2 className="card--list__title">{t('ledger.latestEntries')}</h2>
              <span className="card--list__count">
                {t('ledger.totalItems', { count: summary.count })}
              </span>
            </div>

            {displayTransactions.length === 0 ? (
              <div className="card--list__empty">
                <p className="empty-title">{t('empty.no-results.title')}</p>
                <p className="empty-message">{t('empty.no-results.message')}</p>
              </div>
            ) : (
              <div className="card--list__items">
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
function LedgerHeader({ title, onNewEntry }: { title: string; onNewEntry?: () => void }) {
  const { t } = useTranslation();
  return (
    <header className="ledger-header">
      <h1 className="ledger-title">{title}</h1>
      <button type="button" className="btn btn--primary" onClick={onNewEntry}>
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
        <div className="account-label">{transaction.category.toUpperCase()}</div>
        <div className="transaction-actions">
          {!isConfirmed && (
            <button
              type="button"
              className="btn btn--success btn--sm"
              onClick={onConfirm}
              title={t('transaction.confirm')}
            >
              {t('common.confirm')}
            </button>
          )}
          <button
            type="button"
            className="btn btn--danger btn--sm"
            onClick={async () => {
              const confirmed = await ask(t('transaction.deleteConfirm'), {
                title: 'Delete',
                kind: 'warning',
              });
              if (confirmed) {
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
