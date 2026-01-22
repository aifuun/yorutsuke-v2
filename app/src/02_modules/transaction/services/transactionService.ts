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
  private static instance: TransactionService | null = null;

  private userId: UserId | null = null;
  private cleanupTransactionListener: (() => void) | null = null;
  private currentLoadSignature: string | null = null;  // Track current load request signature

  store = transactionStore;

  /**
   * Private constructor - enforces singleton pattern
   * Initialization happens automatically in constructor, not via init()
   */
  private constructor() {
    this._initialize();
  }

  /**
   * Get or create the singleton instance
   * @internal - Used only for module exports, not for app code
   */
  static getInstance(): TransactionService {
    if (!TransactionService.instance) {
      TransactionService.instance = new TransactionService();
    }
    return TransactionService.instance;
  }

  /**
   * Private initialization (called automatically from constructor)
   * Sets up event listeners for transaction mutations
   */
  private _initialize(): void {
    logger.info('TRANSACTION_SERVICE_INITIALIZED', { service: 'TransactionService' });

    // Listen for transaction mutations (confirmed, updated, deleted)
    // Reload transactions after operations complete
    this.cleanupTransactionListener = on('transaction:confirmed', () => {
      if (this.userId) {
        logger.debug(EVENTS.STATE_TRANSITION, { entity: 'TransactionService', entityId: 'global', from: 'loaded', to: 'reloading', trigger: 'transaction_confirmed' });
        this.loadTransactions();
      }
    });
  }

  /**
   * Set current user and load their transactions with optional filters
   */
  async setUser(userId: UserId | null, options?: FetchTransactionsOptions): Promise<void> {
    const stackTrace = new Error().stack?.split('\n').slice(1, 4).join(' <- ') || 'unknown';
    logger.debug('TRANSACTION_SET_USER_START', {
      userId,
      hasOptions: !!options,
      optionKeys: options ? Object.keys(options) : [],
      callStack: stackTrace
    });
    this.userId = userId;

    if (userId) {
      logger.debug('TRANSACTION_SET_USER_LOADING', { userId, options });
      await this.loadTransactions(options || {});
      logger.debug('TRANSACTION_SET_USER_LOADED', { userId });
    } else {
      // Clear store when user logs out
      logger.debug('TRANSACTION_SET_USER_CLEARING', { userId: null });
      this.store.getState().setTransactions([]);
      this.store.getState().setStatus('idle');
      logger.debug('TRANSACTION_SET_USER_CLEARED');
    }
  }

  /**
   * Load transactions for current user
   * IO-First Pattern: Complete fetch first, then update store
   *
   * Prevents duplicate loads for the same filter options (Issue #89)
   * but allows different filter options to be loaded (supports filtering)
   */
  async loadTransactions(options: FetchTransactionsOptions = {}): Promise<void> {
    if (!this.userId) {
      logger.warn('TRANSACTION_LOAD_NO_USER', {});
      return;
    }

    // Create a signature of current load request to detect duplicates
    const loadSignature = JSON.stringify({ userId: this.userId, options });

    // Skip if already loading the same request
    if (this.currentLoadSignature === loadSignature) {
      logger.warn('TRANSACTION_LOAD_SKIPPED', {
        userId: this.userId,
        reason: 'same_request_already_loading',
        signature: loadSignature,
      });
      return;
    }

    // Update signature to mark this request as current
    this.currentLoadSignature = loadSignature;

    logger.info('TRANSACTION_LOAD_START', {
      userId: this.userId,
      options: {
        startDate: options.startDate,
        endDate: options.endDate,
        statusFilter: options.statusFilter,
        typeFilter: options.typeFilter,
        categoryFilter: options.categoryFilter,
        sortBy: options.sortBy,
        sortOrder: options.sortOrder,
        limit: options.limit,
        offset: options.offset,
      },
    });
    this.store.getState().setStatus('loading');

    try {
      // 1. Fetch transactions from adapter
      logger.debug('TRANSACTION_LOAD_FETCH_START', { userId: this.userId });
      const transactions = await fetchTransactions(this.userId, options);
      logger.debug('TRANSACTION_LOAD_FETCH_SUCCESS', {
        userId: this.userId,
        count: transactions.length
      });

      // 2. Fetch total count for pagination
      logger.debug('TRANSACTION_LOAD_COUNT_START', { userId: this.userId });
      const totalCount = await countTransactions(this.userId, {
        startDate: options.startDate,
        endDate: options.endDate,
      });
      logger.debug('TRANSACTION_LOAD_COUNT_SUCCESS', {
        userId: this.userId,
        totalCount
      });

      // 3. Update store (triggers UI update via React subscribers)
      logger.debug('TRANSACTION_LOAD_UPDATE_STORE', {
        userId: this.userId,
        transactionCount: transactions.length,
        totalCount
      });
      this.store.getState().setTransactions(transactions);
      this.store.getState().setTotalCount(totalCount);
      this.store.getState().setStatus('idle');
      this.store.getState().setError(null);

      logger.info(EVENTS.STATE_TRANSITION, {
        entity: 'TransactionService',
        entityId: `user-${this.userId}`,
        from: 'loading',
        to: 'idle',
        count: transactions.length,
        total: totalCount,
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const errorStack = e instanceof Error ? e.stack : undefined;
      logger.error(EVENTS.APP_ERROR, {
        context: 'transaction_load',
        userId: this.userId,
        error: errorMessage,
        stack: errorStack,
      });
      this.store.getState().setStatus('error');
      this.store.getState().setError(errorMessage);
    } finally {
      // Clear signature to allow new requests (both success and error cases)
      this.currentLoadSignature = null;
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
      this.store.getState().setStatus('idle');
      this.store.getState().setError(null);

      logger.info(EVENTS.STATE_TRANSITION, { entity: 'TransactionService', entityId: transaction.id, from: 'saving', to: 'idle', action: 'transaction_saved' });
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

      logger.info(EVENTS.TRANSACTION_DELETED, { id });
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

      logger.info(EVENTS.TRANSACTION_CONFIRMED, { id });
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

      logger.info(EVENTS.STATE_TRANSITION, { entity: 'TransactionService', entityId: id, from: 'modifying', to: 'idle', action: 'transaction_updated' });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.error(EVENTS.APP_ERROR, { context: 'transaction_update', id, error: errorMessage });
      this.store.getState().setError(errorMessage);
      throw e;
    }
  }

  /**
   * Cleanup resources and reset singleton
   * Note: Only use for testing. In production, the singleton lives for entire app lifetime.
   * After calling destroy(), the next getInstance() will create a fresh instance.
   */
  destroy(): void {
    this.cleanupTransactionListener?.();
    this.userId = null;
    TransactionService.instance = null;
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

/**
 * Singleton instance - guaranteed to be created only once
 * Automatically initialized when first accessed
 * Other modules must use this instance, cannot create new instances
 */
export const transactionService = TransactionService.getInstance();
