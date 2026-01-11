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
  const { state, filteredTransactions, confirm, remove, load, totalCount } = useTransactionLogic(userId);
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
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<'all' | number>('all');

  // Layout toggle for mockup (TEMPORARY - for testing)
  const [filterLayout, setFilterLayout] = useState<'compact' | 'grouped'>('compact');

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
    setSelectedYear(Number(e.target.value));
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
      load(buildFetchOptions());
    });

    return cleanup;
  }, [load, buildFetchOptions]);

  // Handle all states (Pillar D: FSM)
  if (state.status === 'idle') {
    return (
      <div className="ledger">
        <ViewHeader
          title={t('nav.ledger')}
          rightContent={
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
          {/* MOCKUP: Layout Toggle (TEMPORARY - for testing only) */}
          <div style={{ padding: '8px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>🎨 Mockup Toggle:</span>
            <button
              type="button"
              className={`btn btn--sm ${filterLayout === 'compact' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setFilterLayout('compact')}
            >
              Option A: Compact Row
            </button>
            <button
              type="button"
              className={`btn btn--sm ${filterLayout === 'grouped' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setFilterLayout('grouped')}
            >
              Option B: Grouped Rows
            </button>
          </div>

          {/* NEW: Unified Filter Bar */}
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            {filterLayout === 'compact' ? (
              /* Option A: Single Compact Row */
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Time Filters */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.25rem' }}>📅</span>
                  <select className="select" value={selectedYear} onChange={handleYearChange} style={{ width: '100px' }}>
                    <option value={2024}>2024</option>
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                  </select>
                  <select className="select" value={selectedMonth} onChange={handleMonthChange} style={{ width: '140px' }}>
                    <option value="all">{t('ledger.all')} Months</option>
                    <option value={0}>January</option>
                    <option value={1}>February</option>
                    <option value={2}>March</option>
                    <option value={3}>April</option>
                    <option value={4}>May</option>
                    <option value={5}>June</option>
                    <option value={6}>July</option>
                    <option value={7}>August</option>
                    <option value={8}>September</option>
                    <option value={9}>October</option>
                    <option value={10}>November</option>
                    <option value={11}>December</option>
                  </select>
                </div>

                <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />

                {/* Content Filters */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.25rem' }}>📊</span>
                  <select className="select" value={typeFilter} onChange={handleTypeFilterChange} style={{ width: '120px' }}>
                    <option value="all">All Types</option>
                    <option value="income">💰 Income</option>
                    <option value="expense">💸 Expense</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.25rem' }}>🏷️</span>
                  <select className="select" value={categoryFilter} onChange={handleCategoryFilterChange} style={{ width: '140px' }}>
                    <option value="all">All Categories</option>
                    <option value="purchase">Purchase</option>
                    <option value="sale">Sale</option>
                    <option value="shipping">Shipping</option>
                    <option value="packaging">Packaging</option>
                    <option value="fee">Fee</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.25rem' }}>✓</span>
                  <select className="select" value={statusFilter} onChange={handleStatusFilterChange} style={{ width: '120px' }}>
                    <option value="all">{t('ledger.all')}</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                  </select>
                </div>

                <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />

                {/* Sort Controls */}
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.25rem' }}>⇅</span>
                  <select className="select" value={sortBy} onChange={handleSortByChange} style={{ width: '140px' }}>
                    <option value="date">Invoice Date</option>
                    <option value="createdAt">Processing Time</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn--icon"
                    onClick={toggleSortOrder}
                    style={{ minWidth: '32px' }}
                  >
                    {sortOrder === 'DESC' ? '↓' : '↑'}
                  </button>
                </div>
              </div>
            ) : (
              /* Option B: Grouped Multi-Row */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {/* Row 1: Time Filters */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '80px' }}>📅 Time:</span>
                  <select className="select" value={selectedYear} onChange={handleYearChange} style={{ width: '100px' }}>
                    <option value={2024}>2024</option>
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                  </select>
                  <select className="select" value={selectedMonth} onChange={handleMonthChange} style={{ width: '140px' }}>
                    <option value="all">{t('ledger.all')} Months</option>
                    <option value={0}>January</option>
                    <option value={1}>February</option>
                    <option value={2}>March</option>
                    <option value={3}>April</option>
                    <option value={4}>May</option>
                    <option value={5}>June</option>
                    <option value={6}>July</option>
                    <option value={7}>August</option>
                    <option value={8}>September</option>
                    <option value={9}>October</option>
                    <option value={10}>November</option>
                    <option value={11}>December</option>
                  </select>
                </div>

                {/* Row 2: Content Filters */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '80px' }}>🔍 Filters:</span>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Type:</label>
                    <select className="select" value={typeFilter} onChange={handleTypeFilterChange} style={{ width: '120px' }}>
                      <option value="all">All</option>
                      <option value="income">💰 Income</option>
                      <option value="expense">💸 Expense</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Category:</label>
                    <select className="select" value={categoryFilter} onChange={handleCategoryFilterChange} style={{ width: '140px' }}>
                      <option value="all">All</option>
                      <option value="purchase">Purchase</option>
                      <option value="sale">Sale</option>
                      <option value="shipping">Shipping</option>
                      <option value="packaging">Packaging</option>
                      <option value="fee">Fee</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Status:</label>
                    <select className="select" value={statusFilter} onChange={handleStatusFilterChange} style={{ width: '120px' }}>
                      <option value="all">{t('ledger.all')}</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                    </select>
                  </div>
                </div>

                {/* Row 3: Sort Controls */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '80px' }}>⇅ Sort:</span>
                  <select className="select" value={sortBy} onChange={handleSortByChange} style={{ width: '160px' }}>
                    <option value="date">Invoice Date</option>
                    <option value="createdAt">Processing Time</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={toggleSortOrder}
                  >
                    {sortOrder === 'DESC' ? '↓ Newest First' : '↑ Oldest First'}
                  </button>
                </div>
              </div>
            )}
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
  onDelete: () => void;
}

function TransactionCard({ transaction, onConfirm, onDelete }: TransactionCardProps) {
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

  // Image thumbnail state
  const [imageResult, setImageResult] = useState<ImageUrlResult | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Load image URL when component mounts
  useEffect(() => {
    if (transaction.imageId) {
      setIsLoadingImage(true);
      getImageUrl(transaction.imageId)
        .then(setImageResult)
        .catch((error) => {
          console.error('Failed to load image:', error);
          setImageResult({ url: null, source: 'missing', error: String(error) });
        })
        .finally(() => setIsLoadingImage(false));
    }
  }, [transaction.imageId]);

  // Handle thumbnail click - opens confirm modal
  const handleThumbnailClick = () => {
    setIsConfirmModalOpen(true);
  };

  // Handle confirm button click - opens confirm modal
  const handleConfirmClick = () => {
    setIsConfirmModalOpen(true);
  };

  // Handle actual confirmation from modal
  const handleModalConfirm = () => {
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
      {/* Image Thumbnail */}
      {transaction.imageId && (
        <div className="transaction-thumbnail" onClick={handleThumbnailClick}>
          {isLoadingImage ? (
            <div className="thumbnail-placeholder thumbnail-loading">⏳</div>
          ) : imageResult?.url ? (
            <img
              src={imageResult.url}
              alt="Receipt"
              className="thumbnail-image"
              title={t('transaction.clickToReview')}
            />
          ) : (
            <div
              className="thumbnail-placeholder thumbnail-missing"
              title={imageResult?.error || 'Image not available'}
            >
              📷
            </div>
          )}
        </div>
      )}

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
