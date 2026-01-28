// Pillar L: View - Dashboard with premium UI design
// ADR-001: Service Pattern - uses report hooks instead of direct transaction hooks
// ADR-020: Hook Bridge - connects to reportService via useReportState hooks
import { useState } from 'react';
import type { UserId } from '../../../00_kernel/types';
import type { ViewType } from '../../../components/Sidebar';
import { useQuota } from '../../capture/hooks/useQuotaState';
import { useTranslation } from '../../../i18n';
import { ViewHeader } from '../../../components';
import { EmptyState } from './EmptyState';
import { HistoryModal } from './HistoryModal';
import { navigationStore } from '../../../00_kernel/navigation';
import {
  useReportStatus,
  useSelectedDate,
  useDailySummary,
  useTrendData,
  usePendingTransactions,
  reportActions,
} from '../hooks/useReportState';
import { useTransactions } from '../../transaction/hooks/useTransactionState'; // Only for HistoryModal
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

// Get Monday of current week (YYYY-MM-DD)
function getThisWeekMonday(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toLocaleDateString('sv-SE');
}

// Get Monday of last week (YYYY-MM-DD)
function getLastWeekMonday(): string {
  const thisWeekMonday = new Date(getThisWeekMonday());
  thisWeekMonday.setDate(thisWeekMonday.getDate() - 7);
  return thisWeekMonday.toLocaleDateString('sv-SE');
}

export function DashboardView({ userId, onViewChange }: DashboardViewProps) {
  const { t } = useTranslation();

  // History modal state (UI-only state)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Helper: Navigate to ledger with optional filter intent
  const navigateToLedger = (showPending: boolean = false) => {
    if (showPending) {
      navigationStore.getState().setLedgerIntent({
        statusFilter: 'pending',
        quickFilter: 'all',
      });
    }
    onViewChange('ledger');
  };

  // ========== Use Report Hooks (ADR-001 Service Pattern) ==========
  // All business logic moved to reportService
  // DashboardView is now a pure presentation component
  const status = useReportStatus();
  const selectedDate = useSelectedDate();
  const dailySummary = useDailySummary();
  const trendData = useTrendData();
  const pendingTransactions = usePendingTransactions();
  const { quota } = useQuota();

  // Only for HistoryModal - will be refactored later
  const transactions = useTransactions();

  // Date helpers (pure calculations, no state)
  const today = getTodayDate();
  const yesterday = getYesterdayDate();
  const dayOfWeek = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });

  // Handle date selection through reportActions
  const handleDateChange = (date: string) => {
    reportActions.setDate(date);
  };

  // Handle loading state
  if (!userId) {
    return (
      <div className="dashboard">
        <DashboardHeaderComponent
          date={today}
          dayOfWeek={dayOfWeek}
          title={t('nav.dashboard')}
          onHistoryClick={() => setIsHistoryOpen(true)}
        />
        <div className="dashboard-content">
          <EmptyState variant="first-use" />
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="dashboard">
        <DashboardHeaderComponent
          date={today}
          dayOfWeek={dayOfWeek}
          title={t('nav.dashboard')}
          onHistoryClick={() => setIsHistoryOpen(true)}
        />
        <div className="dashboard-content">
          <div className="dashboard-loading">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="dashboard">
        <DashboardHeaderComponent
          date={today}
          dayOfWeek={dayOfWeek}
          title={t('nav.dashboard')}
          onHistoryClick={() => setIsHistoryOpen(true)}
        />
        <div className="dashboard-content">
          <div className="dashboard-error">{t('common.error')}</div>
        </div>
      </div>
    );
  }

  // Guard: ensure data is loaded before rendering
  if (!dailySummary || !trendData) {
    return (
      <div className="dashboard">
        <DashboardHeaderComponent
          date={today}
          dayOfWeek={dayOfWeek}
          title={t('nav.dashboard')}
          onHistoryClick={() => setIsHistoryOpen(true)}
        />
        <div className="dashboard-content">
          <div className="dashboard-loading">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  // Calculate net balance from real data
  const netBalance = dailySummary.totalIncome - dailySummary.totalExpense;
  const isPositive = netBalance >= 0;

  return (
    <div className="dashboard">
      <DashboardHeaderComponent
        date={selectedDate}
        dayOfWeek={dayOfWeek}
        title={t('nav.dashboard')}
        onHistoryClick={() => setIsHistoryOpen(true)}
      />

      <div className="dashboard-content">
        <div className="dashboard-container">
          {/* Hero Card - Simplified with inline date selector */}
          <div className="card card--hero hero-card">
            <div className="hero-header">
              <div className="hero-title-group">
                <h2 className="card--hero__title">
                  {selectedDate === today ? t('dashboard.todayBalance') : t('dashboard.yesterdayBalance')}
                  <span className="card--hero__date mono"> ({selectedDate})</span>
                </h2>
              </div>
              {/* Date Selector - Inline */}
              <div className="date-selector-inline">
                <button
                  type="button"
                  className={`date-btn ${selectedDate === yesterday ? 'active' : ''}`}
                  onClick={() => handleDateChange(yesterday)}
                >
                  {t('dashboard.yesterday')}
                </button>
                <button
                  type="button"
                  className={`date-btn ${selectedDate === today ? 'active' : ''}`}
                  onClick={() => handleDateChange(today)}
                >
                  {t('dashboard.today')}
                </button>
              </div>
            </div>

            {/* Net Balance - Main Focus */}
            <div className="hero-balance">
              <span className={`hero-arrow ${isPositive ? 'positive' : 'negative'}`}>
                {isPositive ? '↑' : '↓'}
              </span>
              <span className="card--hero__value">
                ¥{Math.abs(netBalance).toLocaleString()}
              </span>
              <span className="hero-label">{t('report.netProfit')}</span>
            </div>

            {/* Always show view details button */}
            <div className="hero-footer">
              <button
                type="button"
                className="view-details-btn"
                onClick={() => navigateToLedger(dailySummary.unconfirmedCount > 0)}
                aria-label={t('dashboard.viewDetails')}
              >
                {dailySummary.unconfirmedCount > 0
                  ? `${t('dashboard.viewDetails')} (${dailySummary.unconfirmedCount}${t('dashboard.itemsPending')}) →`
                  : `${t('dashboard.viewDetails')} →`
                }
              </button>
            </div>
          </div>

          {/* Phase 2: Breakdown Cards - Moved outside Hero Card */}
          <div className="breakdown-cards-grid">
            {/* Income Card with Progress */}
            <div className="breakdown-card income-card">
              <div className="breakdown-card-header">
                <span className="breakdown-icon">📈</span>
                <span className="breakdown-label">{t('report.income')}</span>
              </div>
              <div className="breakdown-amount income">
                +¥{dailySummary.totalIncome.toLocaleString()}
              </div>

              {/* Progress Bars */}
              <div className="breakdown-progress">
                <div className="progress-row">
                  <span className="progress-icon">✓</span>
                  <span className="progress-label">{t('dashboard.processed')}</span>
                  <span className="progress-value">¥{dailySummary.confirmedIncome.toLocaleString()}</span>
                  <span className="progress-percent">
                    {dailySummary.totalIncome > 0
                      ? Math.round((dailySummary.confirmedIncome / dailySummary.totalIncome) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill confirmed"
                    style={{
                      width: `${dailySummary.totalIncome > 0
                        ? (dailySummary.confirmedIncome / dailySummary.totalIncome) * 100
                        : 0}%`
                    }}
                  />
                </div>

                {dailySummary.unconfirmedIncome > 0 && (
                  <>
                    <div className="progress-row">
                      <span className="progress-icon">⏳</span>
                      <span className="progress-label">{t('dashboard.pending')}</span>
                      <span className="progress-value">¥{dailySummary.unconfirmedIncome.toLocaleString()}</span>
                      <span className="progress-percent">
                        {Math.round((dailySummary.unconfirmedIncome / dailySummary.totalIncome) * 100)}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill unconfirmed"
                        style={{
                          width: `${(dailySummary.unconfirmedIncome / dailySummary.totalIncome) * 100}%`
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Expense Card with Progress */}
            <div className="breakdown-card expense-card">
              <div className="breakdown-card-header">
                <span className="breakdown-icon">📉</span>
                <span className="breakdown-label">{t('report.expense')}</span>
              </div>
              <div className="breakdown-amount expense">
                -¥{dailySummary.totalExpense.toLocaleString()}
              </div>

              {/* Progress Bars */}
              <div className="breakdown-progress">
                <div className="progress-row">
                  <span className="progress-icon">✓</span>
                  <span className="progress-label">{t('dashboard.processed')}</span>
                  <span className="progress-value">¥{dailySummary.confirmedExpense.toLocaleString()}</span>
                  <span className="progress-percent">
                    {dailySummary.totalExpense > 0
                      ? Math.round((dailySummary.confirmedExpense / dailySummary.totalExpense) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill confirmed"
                    style={{
                      width: `${dailySummary.totalExpense > 0
                        ? (dailySummary.confirmedExpense / dailySummary.totalExpense) * 100
                        : 0}%`
                    }}
                  />
                </div>

                {dailySummary.unconfirmedExpense > 0 && (
                  <>
                    <div className="progress-row">
                      <span className="progress-icon">⏳</span>
                      <span className="progress-label">{t('dashboard.pending')}</span>
                      <span className="progress-value">¥{dailySummary.unconfirmedExpense.toLocaleString()}</span>
                      <span className="progress-percent">
                        {Math.round((dailySummary.unconfirmedExpense / dailySummary.totalExpense) * 100)}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill unconfirmed"
                        style={{
                          width: `${(dailySummary.unconfirmedExpense / dailySummary.totalExpense) * 100}%`
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Phase 3: Quick Stats - Today's Statistics */}
          <div className="summary-grid">
            <div className="card card--summary is-pending">
              <p className="card--summary__label">{t('dashboard.pending')}</p>
              <p className="card--summary__value">{dailySummary.unconfirmedCount}</p>
              <p className="card--summary__subtitle">{t('dashboard.pending')}</p>
            </div>
            <div className="card card--summary is-count">
              <p className="card--summary__label">
                {selectedDate === today ? t('dashboard.todayTransactions') : t('dashboard.yesterdayTransactions')}
              </p>
              <p className="card--summary__value">{dailySummary.count}</p>
              <p className="card--summary__subtitle">{dailySummary.confirmedCount} {t('dashboard.processed')}</p>
            </div>
            <div className="card card--summary is-quota">
              <p className="card--summary__label">{t('dashboard.quotaRemaining')}</p>
              <p className="card--summary__value">{quota ? `${quota.remainingTotal}/${quota.totalLimit}` : '—'}</p>
              <p className="card--summary__subtitle">{t('dashboard.queueReady')}</p>
            </div>
            <div className="card card--summary is-income">
              <p className="card--summary__label">{t('dashboard.averageAmount')}</p>
              <p className="card--summary__value">
                {dailySummary.count > 0
                  ? `¥${Math.round((dailySummary.totalIncome + dailySummary.totalExpense) / dailySummary.count).toLocaleString()}`
                  : '¥0'
                }
              </p>
              <p className="card--summary__subtitle">{t('dashboard.perTransaction')}</p>
            </div>
          </div>

          {/* Phase 5: Trend Comparison */}
          <div className="card card--trend trend-card">
            <div className="trend-header">
              <h2 className="section-header">📊 {t('dashboard.trendComparison')}</h2>
            </div>

            <div className="trend-grid">
              {/* Week-over-week comparison */}
              <div className="trend-item">
                <div className="trend-label">
                  <span className="trend-icon">📅</span>
                  <span>{t('dashboard.thisWeekVsLast')}</span>
                </div>
                <div className="trend-values">
                  <div className="trend-value current">
                    <span className="trend-label-mini">{t('dashboard.thisWeekNet')}</span>
                    <span className={`trend-amount ${trendData.thisWeek.net >= 0 ? 'positive' : 'negative'}`}>
                      ¥{Math.abs(trendData.thisWeek.net).toLocaleString()}
                    </span>
                  </div>
                  <div className="trend-divider">→</div>
                  <div className="trend-value previous">
                    <span className="trend-label-mini">{t('dashboard.lastWeekNet')}</span>
                    <span className="trend-amount muted">
                      ¥{Math.abs(trendData.lastWeek.net).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className={`trend-change ${trendData.weekChange >= 0 ? 'positive' : 'negative'}`}>
                  <span className="trend-arrow">{trendData.weekChange >= 0 ? '↑' : '↓'}</span>
                  <span className="trend-percent">{Math.abs(trendData.weekChange).toFixed(1)}%</span>
                </div>
              </div>

              {/* Day-over-day comparison */}
              <div className="trend-item">
                <div className="trend-label">
                  <span className="trend-icon">📆</span>
                  <span>{t('dashboard.todayVsYesterday')}</span>
                </div>
                <div className="trend-values">
                  <div className="trend-value current">
                    <span className="trend-label-mini">{t('dashboard.todayNet')}</span>
                    <span className={`trend-amount ${trendData.todayNet >= 0 ? 'positive' : 'negative'}`}>
                      ¥{Math.abs(trendData.todayNet).toLocaleString()}
                    </span>
                  </div>
                  <div className="trend-divider">→</div>
                  <div className="trend-value previous">
                    <span className="trend-label-mini">{t('dashboard.yesterdayNet')}</span>
                    <span className="trend-amount muted">
                      ¥{Math.abs(trendData.yesterdayNet).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className={`trend-change ${trendData.dayChange >= 0 ? 'positive' : 'negative'}`}>
                  <span className="trend-arrow">{trendData.dayChange >= 0 ? '↑' : '↓'}</span>
                  <span className="trend-percent">{Math.abs(trendData.dayChange).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Phase 4: Pending Transactions List */}
          <div className="card card--list pending-card">
            <div className="pending-header">
              <h2 className="section-header">
                {t('dashboard.pending')}
                {pendingTransactions.length > 0 && (
                  <span className="pending-count-badge">{pendingTransactions.length}</span>
                )}
              </h2>
            </div>

            {pendingTransactions.length === 0 ? (
              <div className="pending-empty">
                <div className="pending-empty-icon">✓</div>
                <p className="pending-empty-text">{t('dashboard.allProcessed')}</p>
                <p className="pending-empty-hint">{t('dashboard.noTasksHint')}</p>
              </div>
            ) : (
              <div className="pending-list">
                {pendingTransactions.map(item => (
                  <div key={item.id} className="pending-item">
                    <div className="pending-status">
                      <span className="pending-badge">⏳</span>
                    </div>
                    <div className="pending-content">
                      <div className="pending-main">
                        <span className="pending-merchant">
                          {item.merchant.startsWith('transaction.categories.')
                            ? t(item.merchant)
                            : item.merchant}
                        </span>
                        <span className={`pending-amount ${item.type === 'income' ? 'income' : 'expense'}`}>
                          {item.type === 'income' ? '+' : '-'}¥{item.amount.toLocaleString()}
                        </span>
                      </div>
                      <div className="pending-meta">
                        <span className="pending-date">{item.date}</span>
                        <span className="pending-separator">•</span>
                        <span className="pending-time">{item.time}</span>
                        {item.confidence && (
                          <>
                            <span className="pending-separator">•</span>
                            <span className="pending-confidence">
                              {Math.round(item.confidence * 100)}% {t('transaction.confidence')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pending-footer">
              <button
                type="button"
                className="activity-link"
                onClick={() => navigateToLedger(pendingTransactions.length > 0)}
              >
                {pendingTransactions.length > 0
                  ? `${t('dashboard.processAll')} ${pendingTransactions.length} ${t('dashboard.itemsPending')} →`
                  : `${t('dashboard.viewFullLedger')} →`
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* History Modal */}
      {isHistoryOpen && (
        <HistoryModal
          transactions={transactions}
          onClose={() => setIsHistoryOpen(false)}
          initialDate={selectedDate}
        />
      )}
    </div>
  );
}

// Header component
function DashboardHeaderComponent({
  date,
  dayOfWeek,
  title,
  onHistoryClick
}: {
  date: string;
  dayOfWeek: string;
  title: string;
  onHistoryClick: () => void;
}) {
  const { t } = useTranslation();

  return (
    <ViewHeader
      title={title}
      rightContent={
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={onHistoryClick}
            aria-label={t('history.title')}
          >
            📅 {t('history.title')}
          </button>
          <div className="dashboard-date">
            <span className="mono">{date}</span>
            <span className="date-separator">•</span>
            <span>{dayOfWeek}</span>
          </div>
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
