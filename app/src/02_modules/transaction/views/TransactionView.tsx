// Pillar L: Views are pure JSX, logic in headless hooks
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTransactionLogic, useSyncLogic } from '../headless';
import { useTranslation } from '../../../i18n';
import { ViewHeader } from '../../../components';
import { ask } from '@tauri-apps/plugin-dialog';
import DatePicker from 'react-datepicker';
import { ja } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import type { UserId } from '../../../00_kernel/types';
import type { Transaction } from '../../../01_domains/transaction';
import { on } from '../../../00_kernel/eventBus';
import { getImageUrl, type ImageUrlResult } from '../services/imageService';
import { ImageLightbox, Pagination } from '../components';
import type { FetchTransactionsOptions } from '../services/transactionService';
import './ledger.css';

type ViewType = 'dashboard' | 'ledger' | 'capture' | 'settings' | 'profile' | 'debug';

interface TransactionViewProps {
  userId: UserId | null;
  onNavigate?: (view: ViewType) => void;
}

// Status filter type
type StatusFilter = 'all' | 'pending' | 'confirmed';

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
  const { state, filteredTransactions, confirm, remove, load, totalCount } = useTransactionLogic(userId);
  const syncLogic = useSyncLogic(userId, true); // Auto-sync enabled

  // Date range state - initialize with this month's range
  const thisMonth = getThisMonth();
  const [startDate, setStartDate] = useState<Date>(thisMonth.start);
  const [endDate, setEndDate] = useState<Date>(thisMonth.end);
  const [activeFilter, setActiveFilter] = useState<QuickFilter>('all'); // Default to 'all' to show historical data

  // Sorting state
  const [sortBy, setSortBy] = useState<'date' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // Status filter state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

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

    // Add date filters if not 'all'
    // Use local date (not UTC) per time-handling.md rules
    if (activeFilter !== 'all') {
      options.startDate = startDate.toLocaleDateString('sv-SE');
      options.endDate = endDate.toLocaleDateString('sv-SE');
    }

    // Add status filter
    if (statusFilter !== 'all') {
      options.statusFilter = statusFilter;
    }

    return options;
  }, [activeFilter, startDate, endDate, sortBy, sortOrder, currentPage, pageSize, statusFilter]);

  // Reload data when options change
  useEffect(() => {
    if (userId) {
      load(buildFetchOptions());
    }
  }, [userId, buildFetchOptions, load]);

  // Apply quick filter
  const applyQuickFilter = useCallback((filter: QuickFilter) => {
    setActiveFilter(filter);
    setCurrentPage(1); // Reset to first page
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
    setCurrentPage(1); // Reset to first page
    if (type === 'start') {
      setStartDate(date);
    } else {
      setEndDate(date);
    }
  };

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

  // Display transactions (already filtered and sorted by backend)
  const displayTransactions = filteredTransactions;

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
              <div>
                <h2 className="card--list__title">{t('ledger.latestEntries')}</h2>
                <span className="card--list__count">
                  {t('ledger.totalItems', { count: totalCount })}
                </span>
              </div>

              {/* Sorting & Filter Controls */}
              <div className="sorting-controls">
                <div className="control-group">
                  <label className="control-label">{t('ledger.sortBy')}:</label>
                  <select
                    className="select select--sort"
                    value={sortBy}
                    onChange={handleSortByChange}
                  >
                    <option value="date">{t('ledger.invoiceDate')}</option>
                    <option value="createdAt">{t('ledger.processingTime')}</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn--icon"
                    onClick={toggleSortOrder}
                    title={sortOrder === 'DESC' ? 'Newest first' : 'Oldest first'}
                  >
                    {sortOrder === 'DESC' ? '↓' : '↑'}
                  </button>
                </div>

                <div className="control-group">
                  <label className="control-label">{t('ledger.filter')}:</label>
                  <select
                    className="select select--filter"
                    value={statusFilter}
                    onChange={handleStatusFilterChange}
                  >
                    <option value="all">{t('ledger.all')}</option>
                    <option value="pending">{t('ledger.pendingConfirmation')}</option>
                    <option value="confirmed">{t('ledger.confirmed')}</option>
                  </select>
                </div>
              </div>
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
  const { t } = useTranslation();
  const date = new Date(transaction.date);

  // Format date as YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;

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
        <div className="account-label">{transaction.category.toUpperCase()}</div>
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
