// Transaction Service - Business logic for transaction management
// Pillar L: Pure orchestration, no React dependencies
// Owns Zustand vanilla store for global state management
// @listen transaction:* - Reload transactions after mutations
// @listen auth:dataClaimed - Clear queue on user switch

import type { TransactionId, UserId } from '../../../00_kernel/types';
import { createTraceId, ImageId } from '../../../00_kernel/types';
import type { Transaction } from '../../../01_domains/transaction';
import {
  fetchTransactions,
  countTransactions,
  saveTransaction,
  deleteTransaction,
  confirmTransaction,
  updateTransaction,
  getTransactionById,
  type FetchTransactionsOptions,
  type UpdateTransactionFields,
} from '../adapters';
import { emit, on } from '../../../00_kernel/eventBus';
import { logger, EVENTS } from '../../../00_kernel/telemetry';
import { fileService } from '../../capture';
import { transactionStore } from '../stores/transactionStore';

// Re-export types for views/hooks (Pillar I: Firewall)
export type { FetchTransactionsOptions, UpdateTransactionFields };

class TransactionService {
  private initialized = false;
  private userId: UserId | null = null;
  private cleanupTransactionListener: (() => void) | null = null;

  store = transactionStore;

  /**
   * Initialize transaction service
   * Called once at app startup
   */
  init(): void {
    if (this.initialized) {
      logger.warn(EVENTS.SERVICE_INITIALIZED, { service: 'TransactionService', status: 'already_initialized' });
      return;
    }
    this.initialized = true;

    // Listen for transaction mutations (confirmed, updated, deleted)
    // Reload transactions after operations complete
    this.cleanupTransactionListener = on('transaction:confirmed', () => {
      if (this.userId) {
        logger.debug(EVENTS.STATE_CHANGED, { trigger: 'transaction_confirmed' });
        this.loadTransactions();
      }
    });

    logger.info(EVENTS.SERVICE_INITIALIZED, { service: 'TransactionService' });
  }

  /**
   * Set current user and load their transactions
   */
  async setUser(userId: UserId | null): Promise<void> {
    logger.debug('TRANSACTION_SET_USER', { userId });
    this.userId = userId;

    if (userId) {
      await this.loadTransactions();
    } else {
      // Clear store when user logs out
      this.store.getState().setTransactions([]);
      this.store.getState().setStatus('idle');
    }
  }

  /**
   * Load transactions for current user
   * IO-First Pattern: Complete fetch first, then update store
   */
  async loadTransactions(options: FetchTransactionsOptions = {}): Promise<void> {
    if (!this.userId) {
      logger.warn('TRANSACTION_LOAD_NO_USER', {});
      return;
    }

    logger.info('TRANSACTION_LOAD_START', { userId: this.userId });
    this.store.getState().setStatus('loading');

    try {
      // 1. Fetch transactions from adapter
      const transactions = await fetchTransactions(this.userId, options);

      // 2. Fetch total count for pagination
      const totalCount = await countTransactions(this.userId, {
        startDate: options.startDate,
        endDate: options.endDate,
      });

      // 3. Update store (triggers UI update via React subscribers)
      this.store.getState().setTransactions(transactions);
      this.store.getState().setTotalCount(totalCount);
      this.store.getState().setStatus('success');
      this.store.getState().setError(null);

      logger.info(EVENTS.STATE_CHANGED, {
        action: 'transactions_loaded',
        count: transactions.length,
        total: totalCount,
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.error(EVENTS.APP_ERROR, {
        context: 'transaction_load',
        userId: this.userId,
        error: errorMessage,
      });
      this.store.getState().setStatus('error');
      this.store.getState().setError(errorMessage);
    }
  }

  /**
   * Save a new transaction
   * IO-First Pattern: Complete DB operation, then update store
   */
  async saveTransaction(transaction: Transaction): Promise<void> {
    logger.debug('TRANSACTION_SAVE_START', { id: transaction.id });
    this.store.getState().setStatus('saving');

    try {
      // 1. Save to DB
      await saveTransaction(transaction);

      // 2. Update store
      this.store.getState().addTransaction(transaction);
      this.store.getState().setStatus('success');
      this.store.getState().setError(null);

      logger.info(EVENTS.STATE_CHANGED, { action: 'transaction_saved', id: transaction.id });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.error(EVENTS.APP_ERROR, { context: 'transaction_save', error: errorMessage });
      this.store.getState().setStatus('error');
      this.store.getState().setError(errorMessage);
      throw e;
    }
  }

  /**
   * Delete a transaction and its associated image
   * IO-First Pattern: Complete operations, then update store
   * Issue #86: Emits event for auto-sync (debounced)
   */
  async removeTransaction(id: TransactionId): Promise<void> {
    const traceId = createTraceId();
    logger.debug('TRANSACTION_REMOVE_START', { id });

    try {
      // 1. Get transaction to find associated imageId
      const transaction = await getTransactionById(id);

      // 2. Delete associated image (local DB, file, queue)
      if (transaction?.imageId) {
        await fileService.deleteImageComplete(ImageId(transaction.imageId), traceId);
      }

      // 3. Soft delete transaction (marks status='deleted', dirty_sync=1)
      await deleteTransaction(id);

      // 4. Update store
      this.store.getState().removeTransaction(id);
      this.store.getState().setError(null);

      // 5. Emit event for AutoSyncService (debounced sync)
      emitSyncEvent(id, 'deleted');

      logger.info(EVENTS.STATE_CHANGED, { action: 'transaction_deleted', id });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.error(EVENTS.APP_ERROR, { context: 'transaction_remove', id, error: errorMessage });
      this.store.getState().setError(errorMessage);
      throw e;
    }
  }

  /**
   * Confirm a transaction
   * IO-First Pattern: Complete DB operation, then update store
   * Issue #86: Emits event for auto-sync (debounced)
   */
  async confirmTransaction(id: TransactionId): Promise<void> {
    logger.debug('TRANSACTION_CONFIRM_START', { id });

    try {
      // 1. Update DB
      await confirmTransaction(id);

      // 2. Update store
      this.store.getState().confirmTransaction(id);
      this.store.getState().setError(null);

      // 3. Emit event for AutoSyncService
      emitSyncEvent(id, 'confirmed');

      logger.info(EVENTS.STATE_CHANGED, { action: 'transaction_confirmed', id });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.error(EVENTS.APP_ERROR, { context: 'transaction_confirm', id, error: errorMessage });
      this.store.getState().setError(errorMessage);
      throw e;
    }
  }

  /**
   * Update transaction fields (Issue #116: Transaction editing)
   * IO-First Pattern: Complete DB operation, then update store
   * Issue #86: Emits event for auto-sync (debounced)
   */
  async updateTransaction(id: TransactionId, fields: UpdateTransactionFields): Promise<void> {
    logger.debug('TRANSACTION_UPDATE_START', { id });

    try {
      // 1. Update DB
      await updateTransaction(id, fields);

      // 2. Update store
      this.store.getState().updateTransaction(id, fields);
      this.store.getState().setError(null);

      // 3. Emit event for AutoSyncService
      emitSyncEvent(id, 'updated');

      logger.info(EVENTS.STATE_CHANGED, { action: 'transaction_updated', id });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.error(EVENTS.APP_ERROR, { context: 'transaction_update', id, error: errorMessage });
      this.store.getState().setError(errorMessage);
      throw e;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.cleanupTransactionListener?.();
    this.initialized = false;
  }
}

/**
 * Emit event to trigger auto-sync (debounced by AutoSyncService)
 * Issue #86: Uses event-driven pattern for decoupled sync triggering
 * @private
 */
function emitSyncEvent(id: TransactionId, operation: 'confirmed' | 'updated' | 'deleted'): void {
  emit(`transaction:${operation}`, { id });
}

export const transactionService = new TransactionService();
