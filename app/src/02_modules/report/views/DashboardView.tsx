// Pillar L: View - Dashboard with premium UI design
import { useMemo, useState } from 'react';
import { Check, Receipt } from 'lucide-react';
import type { UserId } from '../../../00_kernel/types';
import type { ViewType } from '../../../components/Sidebar';
import { createMonthlySummary, createDailySummaryWithBreakdown } from '../../../01_domains/transaction';
import { useTransactionLogic } from '../../transaction';
import { useQuota } from '../../capture/hooks/useQuotaState';
import { useTranslation } from '../../../i18n';
import { Icon, ViewHeader } from '../../../components';
import { EmptyState } from './EmptyState';
import '../styles/dashboard.css';

interface DashboardViewProps {
  userId: UserId | null;
  onViewChange: (view: ViewType) => void;
}


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

  // Date selector with smart default
  const [selectedDate, setSelectedDate] = useState(getSmartDefaultDate());

  const today = getTodayDate();
  const yesterday = getYesterdayDate();
  const dayOfWeek = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });

  const { state, transactions } = useTransactionLogic(userId);
  const { quota } = useQuota();

  // Phase 2: Use real data with breakdown (local-first reactive)
  const dailySummary = useMemo(
    () => createDailySummaryWithBreakdown(selectedDate, transactions),
    [selectedDate, transactions]
  );

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
        icon: tx.confirmedAt ? Check : Receipt,
        iconLabel: tx.confirmedAt ? t('dashboard.activity.confirmed') : t('dashboard.activity.uploaded'),
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
        <DashboardHeaderComponent date={today} dayOfWeek={dayOfWeek} title={t('nav.dashboard')} />
        <div className="dashboard-content">
          <EmptyState variant="first-use" />
        </div>
      </div>
    );
  }

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div className="dashboard">
        <DashboardHeaderComponent date={today} dayOfWeek={dayOfWeek} title={t('nav.dashboard')} />
        <div className="dashboard-content">
          <div className="dashboard-loading">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="dashboard">
        <DashboardHeaderComponent date={today} dayOfWeek={dayOfWeek} title={t('nav.dashboard')} />
        <div className="dashboard-content">
          <div className="dashboard-error">{t('common.error')}</div>
        </div>
      </div>
    );
  }

  // Calculate net balance from real data
  const netBalance = dailySummary.totalIncome - dailySummary.totalExpense;
  const isPositive = netBalance >= 0;

  return (
    <div className="dashboard">
      <DashboardHeaderComponent date={selectedDate} dayOfWeek={dayOfWeek} title={t('nav.dashboard')} />

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
                  <span className="breakdown-total income">+¥{dailySummary.totalIncome.toLocaleString()}</span>
                  <span className="breakdown-label">{t('report.income')}</span>
                </div>
                <div className="breakdown-detail">
                  <span className="breakdown-item confirmed">
                    ✓ ¥{dailySummary.confirmedIncome.toLocaleString()}
                  </span>
                  {dailySummary.unconfirmedIncome > 0 && (
                    <span className="breakdown-item unconfirmed">
                      ⏳ ¥{dailySummary.unconfirmedIncome.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Expense Breakdown */}
              <div className="breakdown-section">
                <div className="breakdown-header">
                  <span className="breakdown-total expense">-¥{dailySummary.totalExpense.toLocaleString()}</span>
                  <span className="breakdown-label">{t('report.expense')}</span>
                </div>
                <div className="breakdown-detail">
                  <span className="breakdown-item confirmed">
                    ✓ ¥{dailySummary.confirmedExpense.toLocaleString()}
                  </span>
                  {dailySummary.unconfirmedExpense > 0 && (
                    <span className="breakdown-item unconfirmed">
                      ⏳ ¥{dailySummary.unconfirmedExpense.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Hero Footer - Unconfirmed Count & Queue Status */}
            <div className="hero-footer">
              {/* Unconfirmed Count */}
              {dailySummary.unconfirmedCount > 0 && (
                <div className="unconfirmed-count">
                  ⏳ {t('dashboard.pending')}: {dailySummary.unconfirmedCount}件
                </div>
              )}

              {/* Queue Status */}
              <div className="queue-status">
                {t('dashboard.queue')}：{t('dashboard.queueReady')} ({quota?.remaining || 0}/{quota?.limit || 50})
              </div>

              {/* View Details Button */}
              {dailySummary.unconfirmedCount > 0 && (
                <button
                  type="button"
                  className="view-details-btn"
                  onClick={() => onViewChange('ledger')}
                  aria-label={t('dashboard.viewDetails')}
                >
                  {t('dashboard.viewDetails')} →
                </button>
              )}
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="summary-grid">
            <div className="card card--summary is-pending">
              <p className="card--summary__label">{t('dashboard.pending')}</p>
              <p className="card--summary__value">{pendingCount}</p>
            </div>
            <div className="card card--summary is-count">
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
                    <div className={`activity-icon ${item.iconBg}`}>
                      <Icon icon={item.icon} size="md" aria-label={item.iconLabel} />
                    </div>
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
function DashboardHeaderComponent({ date, dayOfWeek, title }: { date: string; dayOfWeek: string; title: string }) {
  return (
    <ViewHeader 
      title={title}
      rightContent={
        <div className="dashboard-date">
          <span className="mono">{date}</span>
          <span className="date-separator">•</span>
          <span>{dayOfWeek}</span>
        </div>
      }
    />
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
