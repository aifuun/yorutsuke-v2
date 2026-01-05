// Pillar L: View - Dashboard with premium UI design
import { useMemo } from 'react';
import type { UserId } from '../../../00_kernel/types';
import type { ViewType } from '../../../components/Sidebar';
import { createDailySummary, createMonthlySummary } from '../../../01_domains/transaction';
import { useTransactionLogic } from '../../transaction';
import { useQuota } from '../../capture';
import { useTranslation } from '../../../i18n';
import { EmptyState } from './EmptyState';
import '../styles/dashboard.css';

interface DashboardViewProps {
  userId: UserId | null;
  onViewChange: (view: ViewType) => void;
}

export function DashboardView({ userId, onViewChange }: DashboardViewProps) {
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  const { state, transactions } = useTransactionLogic(userId);
  const { quota } = useQuota(userId);

  // Today's summary
  const todaySummary = useMemo(
    () => createDailySummary(today, transactions),
    [today, transactions]
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

  const netBalance = todaySummary.totalIncome - todaySummary.totalExpense;
  const isPositive = netBalance >= 0;

  return (
    <div className="dashboard">
      <DashboardHeader date={today} dayOfWeek={dayOfWeek} title={t('nav.dashboard')} />

      <div className="dashboard-content">
        <div className="dashboard-container">
          {/* Hero Card - Today's Balance */}
          <div className="premium-card hero-card">
            <p className="section-header">{t('dashboard.todayBalance')}</p>
            <div className="hero-balance">
              <span className={`hero-arrow ${isPositive ? 'positive' : 'negative'}`}>
                {isPositive ? '↑' : '↓'}
              </span>
              <span className="hero-amount mono">
                ¥{Math.abs(netBalance).toLocaleString()}
              </span>
            </div>
            <div className="hero-breakdown">
              <div className="hero-income">
                <span className="hero-value">+¥{todaySummary.totalIncome.toLocaleString()}</span>
                <span className="hero-label">{t('report.income')}</span>
              </div>
              <div className="hero-expense">
                <span className="hero-value">-¥{todaySummary.totalExpense.toLocaleString()}</span>
                <span className="hero-label">{t('report.expense')}</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-icon">📈</span>
                <span className="section-header">{t('dashboard.monthlyIncome')}</span>
              </div>
              <div className="stat-value mono">¥{monthlySummary.income.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-icon">📉</span>
                <span className="section-header">{t('dashboard.monthlyExpense')}</span>
              </div>
              <div className="stat-value mono">¥{monthlySummary.expense.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-icon">📷</span>
                <span className="section-header">{t('dashboard.pending')}</span>
              </div>
              <div className="stat-value mono stat-warning">{pendingCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-icon">🎯</span>
                <span className="section-header">{t('dashboard.quotaRemaining')}</span>
              </div>
              <div className="stat-value mono stat-success">
                {quota ? `${quota.remaining}/${quota.limit}` : '—'}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="premium-card activity-card">
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
