// Pillar L: View - Dashboard with premium UI design
import { useMemo, useState } from 'react';
import type { UserId } from '../../../00_kernel/types';
import type { ViewType } from '../../../components/Sidebar';
import { createMonthlySummary } from '../../../01_domains/transaction'; // Phase 2: add createDailySummary
import { useTransactionLogic } from '../../transaction';
import { useQuota } from '../../capture/hooks/useQuotaState';
import { useTranslation } from '../../../i18n';
import { EmptyState } from './EmptyState';
import '../styles/dashboard.css';

interface DashboardViewProps {
  userId: UserId | null;
  onViewChange: (view: ViewType) => void;
}

// Phase 1: Mock data scenarios for UI development
const MOCK_SCENARIOS = {
  typical: {
    totalIncome: 50000,
    totalExpense: 30000,
    confirmedIncome: 45000,
    confirmedExpense: 28000,
    unconfirmedIncome: 5000,
    unconfirmedExpense: 2000,
    unconfirmedCount: 3,
  },
  allConfirmed: {
    totalIncome: 50000,
    totalExpense: 30000,
    confirmedIncome: 50000,
    confirmedExpense: 30000,
    unconfirmedIncome: 0,
    unconfirmedExpense: 0,
    unconfirmedCount: 0,
  },
  allUnconfirmed: {
    totalIncome: 50000,
    totalExpense: 30000,
    confirmedIncome: 0,
    confirmedExpense: 0,
    unconfirmedIncome: 50000,
    unconfirmedExpense: 30000,
    unconfirmedCount: 5,
  },
  empty: {
    totalIncome: 0,
    totalExpense: 0,
    confirmedIncome: 0,
    confirmedExpense: 0,
    unconfirmedIncome: 0,
    unconfirmedExpense: 0,
    unconfirmedCount: 0,
  },
};

// Smart default: 0:00-12:00 → yesterday, 12:00-24:00 → today
function getSmartDefaultDate(): string {
  const now = new Date();
  const hour = now.getHours();

  if (hour < 12) {
    // Morning → show yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toLocaleDateString('sv-SE');
  }

  // Afternoon → show today
  return now.toLocaleDateString('sv-SE');
}

function getTodayDate(): string {
  return new Date().toLocaleDateString('sv-SE');
}

function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toLocaleDateString('sv-SE');
}

export function DashboardView({ userId, onViewChange }: DashboardViewProps) {
  const { t } = useTranslation();

  // Phase 1: Date selector with smart default
  const [selectedDate, setSelectedDate] = useState(getSmartDefaultDate());
  const [mockScenario] = useState<keyof typeof MOCK_SCENARIOS>('typical');

  const today = getTodayDate();
  const yesterday = getYesterdayDate();
  const dayOfWeek = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });

  const { state, transactions } = useTransactionLogic(userId);
  const { quota } = useQuota();

  // Phase 1: Use mock data (Phase 2 will use real data)
  const mockData = MOCK_SCENARIOS[mockScenario];

  // Phase 2: Replace mock with real data
  // const todaySummary = useMemo(
  //   () => createDailySummary(selectedDate, transactions),
  //   [selectedDate, transactions]
  // );

  // Monthly summary
  const monthlySummary = useMemo(
    () => createMonthlySummary(transactions),
    [transactions]
  );

  // Count pending (unconfirmed) transactions
  const pendingCount = useMemo(
    () => transactions.filter(tx => !tx.confirmedAt).length,
    [transactions]
  );

  // Recent activity (last 4 items)
  const recentActivity = useMemo(() => {
    return transactions
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4)
      .map(tx => ({
        id: tx.id,
        icon: tx.confirmedAt ? '✅' : '🧾',
        iconBg: tx.confirmedAt ? 'bg-blue-100' : 'bg-emerald-100',
        title: tx.confirmedAt ? t('dashboard.activity.confirmed') : t('dashboard.activity.uploaded'),
        subtitle: `${tx.merchant || tx.category} - ¥${Math.abs(tx.amount).toLocaleString()}`,
        time: formatRelativeTime(tx.createdAt),
      }));
  }, [transactions, t]);

  // Handle loading state
  if (!userId) {
    return (
      <div className="dashboard">
        <DashboardHeader date={today} dayOfWeek={dayOfWeek} title={t('nav.dashboard')} />
        <div className="dashboard-content">
          <EmptyState variant="first-use" />
        </div>
      </div>
    );
  }

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="dashboard">
        <DashboardHeader date={today} dayOfWeek={dayOfWeek} title={t('nav.dashboard')} />
        <div className="dashboard-content">
          <div className="dashboard-loading">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="dashboard">
        <DashboardHeader date={today} dayOfWeek={dayOfWeek} title={t('nav.dashboard')} />
        <div className="dashboard-content">
          <div className="dashboard-error">{t('common.error')}</div>
        </div>
      </div>
    );
  }

  // Phase 1: Use mock data for hero card
  const netBalance = mockData.totalIncome - mockData.totalExpense;
  const isPositive = netBalance >= 0;

  return (
    <div className="dashboard">
      <DashboardHeader date={selectedDate} dayOfWeek={dayOfWeek} title={t('nav.dashboard')} />

      <div className="dashboard-content">
        <div className="dashboard-container">
          {/* Phase 1: Date Selector */}
          <div className="date-selector">
            <button
              type="button"
              className={`date-btn ${selectedDate === today ? 'active' : ''}`}
              onClick={() => setSelectedDate(today)}
            >
              {t('dashboard.today')}
            </button>
            <button
              type="button"
              className={`date-btn ${selectedDate === yesterday ? 'active' : ''}`}
              onClick={() => setSelectedDate(yesterday)}
            >
              {t('dashboard.yesterday')}
            </button>
          </div>

          {/* Hero Card - Daily Summary with Breakdown */}
          <div className="card card--hero hero-card">
            <p className="card--hero__title">
              {selectedDate === today ? t('dashboard.todayBalance') : t('dashboard.yesterdayBalance')}
              <span className="card--hero__date mono"> ({selectedDate})</span>
            </p>
            <div className="hero-balance">
              <span className={`hero-arrow ${isPositive ? 'positive' : 'negative'}`}>
                {isPositive ? '↑' : '↓'}
              </span>
              <span className="card--hero__value">
                ¥{Math.abs(netBalance).toLocaleString()}
              </span>
              <span className="hero-label">{t('report.netProfit')}</span>
            </div>

            {/* Income Breakdown */}
            <div className="hero-breakdown">
              <div className="breakdown-section">
                <div className="breakdown-header">
                  <span className="breakdown-total">+¥{mockData.totalIncome.toLocaleString()}</span>
                  <span className="breakdown-label">{t('report.income')}</span>
                </div>
                <div className="breakdown-detail">
                  <span className="breakdown-item confirmed">
                    ✓ ¥{mockData.confirmedIncome.toLocaleString()}
                  </span>
                  {mockData.unconfirmedIncome > 0 && (
                    <span className="breakdown-item unconfirmed">
                      ⏳ ¥{mockData.unconfirmedIncome.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Expense Breakdown */}
              <div className="breakdown-section">
                <div className="breakdown-header">
                  <span className="breakdown-total">-¥{mockData.totalExpense.toLocaleString()}</span>
                  <span className="breakdown-label">{t('report.expense')}</span>
                </div>
                <div className="breakdown-detail">
                  <span className="breakdown-item confirmed">
                    ✓ ¥{mockData.confirmedExpense.toLocaleString()}
                  </span>
                  {mockData.unconfirmedExpense > 0 && (
                    <span className="breakdown-item unconfirmed">
                      ⏳ ¥{mockData.unconfirmedExpense.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Unconfirmed Count & View Details */}
            {mockData.unconfirmedCount > 0 && (
              <div className="hero-footer">
                <span className="unconfirmed-count">
                  {t('dashboard.pending')}: {mockData.unconfirmedCount}件
                </span>
                <button
                  type="button"
                  className="view-details-btn"
                  onClick={() => onViewChange('ledger')}
                >
                  {t('dashboard.viewDetails')} →
                </button>
              </div>
            )}
          </div>

          {/* Quick Stats Grid */}
          <div className="summary-grid">
            <div className="card card--summary is-pending">
              <p className="card--summary__label">{t('dashboard.pending')}</p>
              <p className="card--summary__value">{pendingCount}</p>
            </div>
            <div className="card card--summary is-info">
              <p className="card--summary__label">{t('dashboard.quotaRemaining')}</p>
              <p className="card--summary__value">{quota ? `${quota.remaining}/${quota.limit}` : '—'}</p>
            </div>
            <div className="card card--summary is-income">
              <p className="card--summary__label">{t('dashboard.monthlyIncome')}</p>
              <p className="card--summary__value">¥{monthlySummary.income.toLocaleString()}</p>
            </div>
            <div className="card card--summary is-expense">
              <p className="card--summary__label">{t('dashboard.monthlyExpense')}</p>
              <p className="card--summary__value">¥{monthlySummary.expense.toLocaleString()}</p>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card card--list activity-card">
            <h2 className="section-header">{t('dashboard.recentActivity')}</h2>
            {recentActivity.length === 0 ? (
              <p className="activity-empty">{t('dashboard.noActivity')}</p>
            ) : (
              <div className="activity-list">
                {recentActivity.map(item => (
                  <div key={item.id} className="activity-item">
                    <div className={`activity-icon ${item.iconBg}`}>{item.icon}</div>
                    <div className="activity-content">
                      <div className="activity-title">{item.title}</div>
                      <div className="activity-subtitle">{item.subtitle}</div>
                    </div>
                    <div className="activity-time mono">{item.time}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="activity-footer">
              <button type="button" className="activity-link" onClick={() => onViewChange('ledger')}>
                {t('dashboard.viewAllInLedger')} →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Header component
function DashboardHeader({ date, dayOfWeek, title }: { date: string; dayOfWeek: string; title: string }) {
  return (
    <header className="dashboard-header">
      <h1 className="dashboard-title">{title}</h1>
      <div className="dashboard-date">
        <span className="mono">{date}</span>
        <span className="date-separator">•</span>
        <span>{dayOfWeek}</span>
      </div>
    </header>
  );
}

// Utility: Format relative time
function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}
