// Pillar L: Views are pure JSX, logic in headless hooks
import { useState, useCallback, useEffect } from 'react';
import { useTransactionLogic, useSyncLogic } from '../headless';
import { useTranslation } from '../../../i18n';
import { ViewHeader } from '../../../components';
import { ask } from '@tauri-apps/plugin-dialog';
import type { UserId } from '../../../00_kernel/types';
import type { Transaction } from '../../../01_domains/transaction';
import { on } from '../../../00_kernel/eventBus';
import { getImageUrl, type ImageUrlResult } from '../services/imageService';
import { ImageLightbox, Pagination } from '../components';
import type { FetchTransactionsOptions } from '../services/transactionService';
import { navigationStore } from '../../../00_kernel/navigation';
import { SyncStatusIndicator } from '../../sync';
import './ledger.css';

type ViewType = 'dashboard' | 'ledger' | 'capture' | 'settings' | 'profile' | 'debug';

interface TransactionViewProps {
  userId: UserId | null;
  onNavigate?: (view: ViewType) => void;
}

// Status filter type
type StatusFilter = 'all' | 'pending' | 'confirmed';

export function TransactionView({ userId, onNavigate }: TransactionViewProps) {
  const { t } = useTranslation();
  const { state, filteredTransactions, confirm, remove, update, load, totalCount } = useTransactionLogic(userId);
  const syncLogic = useSyncLogic(userId, true); // Auto-sync enabled

  // Sorting state
  const [sortBy, setSortBy] = useState<'date' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // Status filter state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Type filter state (NEW)
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');

  // Category filter state (NEW)
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'purchase' | 'sale' | 'shipping' | 'packaging' | 'fee' | 'other'>('all');

  // Year/Month filters (NEW - replacing DatePicker)
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all'); // Default: すべての年
  const [selectedMonth, setSelectedMonth] = useState<'all' | number>('all'); // Default: すべての月

  // Generate dynamic year list (current year and 3 years back)
  const availableYears = Array.from({ length: 4 }, (_, i) => currentYear - i);

  // Layout: Option B - Two rows (Time+Sort | Filters)

  // Pagination state
  const pageSize = 20;
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Build fetch options
  const buildFetchOptions = useCallback((): FetchTransactionsOptions => {
    const options: FetchTransactionsOptions = {
      sortBy,
      sortOrder,
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
    };

    // Year/Month filters (NEW)
    if (selectedYear !== 'all') {
      // Specific year selected
      if (selectedMonth !== 'all') {
        // Specific month selected
        const startDate = new Date(selectedYear, selectedMonth, 1);
        const endDate = new Date(selectedYear, selectedMonth + 1, 0); // Last day of month
        options.startDate = startDate.toLocaleDateString('sv-SE');
        options.endDate = endDate.toLocaleDateString('sv-SE');
      } else {
        // Full year selected
        const startDate = new Date(selectedYear, 0, 1);
        const endDate = new Date(selectedYear, 11, 31);
        options.startDate = startDate.toLocaleDateString('sv-SE');
        options.endDate = endDate.toLocaleDateString('sv-SE');
      }
    }
    // If selectedYear === 'all', don't set date filters (query all data)

    // Status filter
    if (statusFilter !== 'all') {
      options.statusFilter = statusFilter;
    }

    // Type filter (NEW)
    if (typeFilter !== 'all') {
      options.typeFilter = typeFilter;
    }

    // Category filter (NEW)
    if (categoryFilter !== 'all') {
      options.categoryFilter = categoryFilter as any; // TODO: Fix type
    }

    return options;
  }, [selectedYear, selectedMonth, sortBy, sortOrder, currentPage, pageSize, statusFilter, typeFilter, categoryFilter]);

  // Check for navigation intent on mount
  useEffect(() => {
    const intent = navigationStore.getState().ledgerIntent;
    if (intent) {
      // Apply intent
      if (intent.statusFilter) {
        setStatusFilter(intent.statusFilter);
      }
      // Note: quickFilter removed with date picker redesign (Issue #115)
      // Clear intent after applying
      navigationStore.getState().clearLedgerIntent();
    }
  }, []); // Run only on mount

  // Reload data when options change
  useEffect(() => {
    if (userId) {
      load(buildFetchOptions());
    }
  }, [userId, buildFetchOptions, load]);

  // Handle sorting change
  const handleSortByChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as 'date' | 'createdAt');
    setCurrentPage(1);
  };

  // Handle status filter change
  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value as StatusFilter);
    setCurrentPage(1);
  };

  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'DESC' ? 'ASC' : 'DESC');
    setCurrentPage(1);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // NEW: Handle year change
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedYear(value === 'all' ? 'all' : Number(value));
    setCurrentPage(1);
  };

  // NEW: Handle month change
  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedMonth(value === 'all' ? 'all' : Number(value));
    setCurrentPage(1);
  };

  // NEW: Handle type filter change
  const handleTypeFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTypeFilter(e.target.value as 'all' | 'income' | 'expense');
    setCurrentPage(1);
  };

  // NEW: Handle category filter change
  const handleCategoryFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryFilter(e.target.value as any);
    setCurrentPage(1);
  };

  // Display transactions (already filtered and sorted by backend)
  const displayTransactions = filteredTransactions;

  const handleNewEntry = () => onNavigate?.('capture');

  // Handle sync completion - reload transactions
  const handleSync = useCallback(async () => {
    await syncLogic.sync();
    // Always reload transactions after sync attempt (even if partial failure)
    load(buildFetchOptions());
  }, [syncLogic, load, buildFetchOptions]);

  // Listen to auto-sync completion events and reload transactions
  useEffect(() => {
    const cleanup = on('transaction:synced', () => {
      // Auto-sync completed - reload transactions to show new data
      // Note: Using latest buildFetchOptions without adding to deps to avoid infinite loop
      load(buildFetchOptions());
    });

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]); // Only depend on load, buildFetchOptions will be captured from closure

  // Handle all states (Pillar D: FSM)
  if (state.status === 'idle') {
    return (
      <div className="ledger">
        <ViewHeader
          title={t('nav.ledger')}
          rightContent={
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {/* Temporarily disabled to debug infinite loop */}
              {/* <SyncStatusIndicator hideWhenIdle /> */}
              {syncLogic.getTimeSinceLastSync() && (
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
                  {syncLogic.getTimeSinceLastSync()}
                </span>
              )}
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={handleSync}
                disabled={syncLogic.state.status === 'syncing'}
                title={syncLogic.state.status === 'syncing' ? t('ledger.syncing') : t('ledger.syncTooltip')}
              >
                {syncLogic.state.status === 'syncing' ? `⟳ ${t('ledger.syncing')}` : `↻ ${t('ledger.sync')}`}
              </button>
              <button type="button" className="btn btn--primary btn--sm" onClick={handleNewEntry}>
                + {t('ledger.newEntry')}
              </button>
            </div>
          }
        />
        <div className="ledger-content">
          <div className="ledger-loading">{t('auth.login')}</div>
        </div>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="ledger">
        <ViewHeader
          title={t('nav.ledger')}
          rightContent={
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {/* Temporarily disabled to debug infinite loop */}
              {/* <SyncStatusIndicator hideWhenIdle /> */}
              {syncLogic.getTimeSinceLastSync() && (
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
                  {syncLogic.getTimeSinceLastSync()}
                </span>
              )}
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={handleSync}
                disabled={syncLogic.state.status === 'syncing'}
                title={syncLogic.state.status === 'syncing' ? t('ledger.syncing') : t('ledger.syncTooltip')}
              >
                {syncLogic.state.status === 'syncing' ? `⟳ ${t('ledger.syncing')}` : `↻ ${t('ledger.sync')}`}
              </button>
              <button type="button" className="btn btn--primary btn--sm" onClick={handleNewEntry}>
                + {t('ledger.newEntry')}
              </button>
            </div>
          }
        />
        <div className="ledger-content">
          <div className="ledger-loading">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="ledger">
        <ViewHeader
          title={t('nav.ledger')}
          rightContent={
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {/* Temporarily disabled to debug infinite loop */}
              {/* <SyncStatusIndicator hideWhenIdle /> */}
              {syncLogic.getTimeSinceLastSync() && (
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
                  {syncLogic.getTimeSinceLastSync()}
                </span>
              )}
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={handleSync}
                disabled={syncLogic.state.status === 'syncing'}
                title={syncLogic.state.status === 'syncing' ? t('ledger.syncing') : t('ledger.syncTooltip')}
              >
                {syncLogic.state.status === 'syncing' ? `⟳ ${t('ledger.syncing')}` : `↻ ${t('ledger.sync')}`}
              </button>
              <button type="button" className="btn btn--primary btn--sm" onClick={handleNewEntry}>
                + {t('ledger.newEntry')}
              </button>
            </div>
          }
        />
        <div className="ledger-content">
          <div className="ledger-error">{state.error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ledger">
      <ViewHeader
        title={t('nav.ledger')}
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {/* Temporarily disabled to debug infinite loop */}
            {/* <SyncStatusIndicator hideWhenIdle /> */}
            {syncLogic.getTimeSinceLastSync() && (
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
                {syncLogic.getTimeSinceLastSync()}
              </span>
            )}
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={handleSync}
              disabled={syncLogic.state.status === 'syncing'}
              title={syncLogic.state.status === 'syncing' ? t('ledger.syncing') : t('ledger.syncTooltip')}
            >
              {syncLogic.state.status === 'syncing' ? `⟳ ${t('ledger.syncing')}` : `↻ ${t('ledger.sync')}`}
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={handleNewEntry}>
              + {t('ledger.newEntry')}
            </button>
          </div>
        }
      />

      <div className="ledger-content">
        <div className="ledger-container">
          {/* Unified Filter Bar - Compact Layout */}
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Row 1: Time Range + Sort */}
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                {/* Time Range */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('ledger.filterTime')}:</span>
                  <select className="select" value={selectedYear} onChange={handleYearChange} style={{ width: '120px' }}>
                    <option value="all">{t('ledger.allYears')}</option>
                    {availableYears.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <select className="select" value={selectedMonth} onChange={handleMonthChange} style={{ width: '140px' }}>
                    <option value="all">{t('ledger.allMonths')}</option>
                    <option value={0}>{t('ledger.months.january')}</option>
                    <option value={1}>{t('ledger.months.february')}</option>
                    <option value={2}>{t('ledger.months.march')}</option>
                    <option value={3}>{t('ledger.months.april')}</option>
                    <option value={4}>{t('ledger.months.may')}</option>
                    <option value={5}>{t('ledger.months.june')}</option>
                    <option value={6}>{t('ledger.months.july')}</option>
                    <option value={7}>{t('ledger.months.august')}</option>
                    <option value={8}>{t('ledger.months.september')}</option>
                    <option value={9}>{t('ledger.months.october')}</option>
                    <option value={10}>{t('ledger.months.november')}</option>
                    <option value={11}>{t('ledger.months.december')}</option>
                  </select>
                </div>

                {/* Sort */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('ledger.sortBy')}:</span>
                  <select className="select" value={sortBy} onChange={handleSortByChange} style={{ width: '140px' }}>
                    <option value="date">{t('ledger.invoiceDate')}</option>
                    <option value="createdAt">{t('ledger.processingTime')}</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={toggleSortOrder}
                    style={{ minWidth: '100px' }}
                  >
                    {sortOrder === 'DESC' ? `↓ ${t('ledger.newestFirst')}` : `↑ ${t('ledger.oldestFirst')}`}
                  </button>
                </div>
              </div>

              {/* Row 2: Filters - Compact Grid */}
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('ledger.filters')}:</span>

                {/* Type */}
                <select className="select" value={typeFilter} onChange={handleTypeFilterChange} style={{ width: '110px' }}>
                  <option value="all">{t('type.all')}</option>
                  <option value="income">{t('type.income')}</option>
                  <option value="expense">{t('type.expense')}</option>
                </select>

                {/* Category */}
                <select className="select" value={categoryFilter} onChange={handleCategoryFilterChange} style={{ width: '130px' }}>
                  <option value="all">{t('category.all')}</option>
                  <option value="food">{t('category.food')}</option>
                  <option value="transport">{t('category.transport')}</option>
                  <option value="shopping">{t('category.shopping')}</option>
                  <option value="entertainment">{t('category.entertainment')}</option>
                  <option value="utilities">{t('category.utilities')}</option>
                  <option value="health">{t('category.health')}</option>
                  <option value="other">{t('category.other')}</option>
                </select>

                {/* Status */}
                <select className="select" value={statusFilter} onChange={handleStatusFilterChange} style={{ width: '110px' }}>
                  <option value="all">{t('ledger.all')}</option>
                  <option value="pending">{t('transaction.pending')}</option>
                  <option value="confirmed">{t('transaction.confirmed')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Transaction List */}
          <div className="card card--list">
            <div className="card--list__header">
              <h2 className="card--list__title">{t('ledger.latestEntries')}</h2>
              <span className="card--list__count">
                {t('ledger.totalItems', { count: totalCount })}
              </span>
            </div>

            {displayTransactions.length === 0 ? (
              <div className="card--list__empty">
                <p className="empty-title">{t('empty.no-results.title')}</p>
                <p className="empty-message">{t('empty.no-results.message')}</p>
              </div>
            ) : (
              <>
                <div className="card--list__items">
                  {displayTransactions.map((transaction) => (
                    <TransactionCard
                      key={transaction.id}
                      transaction={transaction}
                      onConfirm={() => confirm(transaction.id)}
                      onUpdate={(fields) => update(transaction.id, fields)}
                      onDelete={() => remove(transaction.id)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                <Pagination
                  currentPage={currentPage}
                  totalItems={totalCount}
                  pageSize={pageSize}
                  onPageChange={handlePageChange}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Header component
// Transaction Card component
interface TransactionCardProps {
  transaction: Transaction;
  onConfirm: () => void;
  onUpdate: (fields: any) => void; // TODO: import UpdateTransactionFields type
  onDelete: () => void;
}

function TransactionCard({ transaction, onConfirm, onUpdate, onDelete }: TransactionCardProps) {
  const { t, i18n } = useTranslation();
  const date = new Date(transaction.date);

  // Format date based on locale
  const formattedDate = date.toLocaleDateString(
    i18n.language === 'ja' ? 'ja-JP' : i18n.language === 'zh' ? 'zh-CN' : 'en-US',
    { year: 'numeric', month: 'short', day: '2-digit' }
  );

  const isConfirmed = !!transaction.confirmedAt;
  const isIncome = transaction.type === 'income';
  const categoryKey = `transaction.categories.${transaction.category}` as const;

  // Image state for modal
  const [imageResult, setImageResult] = useState<ImageUrlResult | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Load image URL when component mounts
  useEffect(() => {
    if (transaction.imageId) {
      getImageUrl(transaction.imageId)
        .then(setImageResult)
        .catch((error) => {
          console.error('Failed to load image:', error);
          setImageResult({ url: null, source: 'missing', error: String(error) });
        });
    }
  }, [transaction.imageId]);

  // Handle confirm button click - opens confirm modal
  const handleConfirmClick = () => {
    setIsConfirmModalOpen(true);
  };

  // Handle actual confirmation from modal (with optional edits)
  const handleModalConfirm = (edits?: any) => {
    // If there are edits, update first, then confirm
    if (edits) {
      onUpdate(edits);
    }
    onConfirm();
    setIsConfirmModalOpen(false);
  };

  // Handle delete from modal
  const handleModalDelete = async () => {
    const confirmed = await ask(t('transaction.deleteConfirm'), {
      title: 'Delete',
      kind: 'warning',
    });
    if (confirmed) {
      onDelete();
      setIsConfirmModalOpen(false);
    }
  };

  return (
    <div className={`glass-card transaction-card ${isIncome ? 'transaction-card--income' : ''}`}>
      {/* Confirm Modal with Image, OCR text, and Transaction details */}
      {isConfirmModalOpen && (
        <ImageLightbox
          imageUrl={imageResult?.url || ''}
          alt={`Receipt from ${transaction.merchant || transaction.description}`}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={isConfirmed ? undefined : handleModalConfirm}
          onDelete={handleModalDelete}
          isConfirmed={isConfirmed}
          transaction={transaction}
        />
      )}

      {/* Date Stamp - Year-Month-Day format */}
      <div className="date-stamp date-stamp--full">
        <span className="date-full">{formattedDate}</span>
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
          {isConfirmed && (
            <span className="tag tag--confirmed">✓</span>
          )}
        </div>
      </div>

      {/* Amount - no +/- sign, color indicates type */}
      <div className="transaction-right">
        <div className={`transaction-amount ${isIncome ? 'amount--income' : 'amount--expense'}`}>
          ¥{transaction.amount.toLocaleString()}
        </div>
        {/* Actions - only Review button, delete moved to modal */}
        <div className="transaction-actions">
          <button
            type="button"
            className={`btn btn--sm ${isConfirmed ? 'btn--secondary' : 'btn--primary'}`}
            onClick={handleConfirmClick}
            title={isConfirmed ? t('transaction.viewDetails') : t('transaction.reviewAndConfirm')}
          >
            {isConfirmed ? t('common.view') : t('transaction.review')}
          </button>
        </div>
      </div>
    </div>
  );
}
