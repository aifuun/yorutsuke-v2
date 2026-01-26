/**
 * Sync State Hooks
 * Hook Bridge Layer (Layer 1.5) per ADR-020
 *
 * Three Identities:
 * 1. Connector: Bridge Vanilla Zustand → React (useStore)
 * 2. Selector: Extract primitives (ADR-012 compliance)
 * 3. Orchestrator: Coordinate services, UI-specific logic
 */

import { useStore } from 'zustand';
import { useCallback } from 'react';
import { syncStore } from '../stores/syncStore';
import type { SyncStatus } from '../stores/syncStore';
import { manualSyncService } from '../services/manualSyncService';
import { transactionPushService } from '../services/transactionPushService';
import { pullTransactions } from '../services/syncCoordinator';
import type { UserId } from '../../../00_kernel/types';

// ============================================================================
// Identity 1 & 2: Connector + Selector (Primitive Returns)
// ============================================================================

/**
 * Get current sync status
 * @returns Sync status: 'idle' | 'syncing' | 'success' | 'error'
 */
export function useSyncStatus(): SyncStatus {
  return useStore(syncStore, (s) => s.status);
}

/**
 * Check if network is online
 * @returns True if online, false if offline
 */
export function useIsOnline(): boolean {
  return useStore(syncStore, (s) => s.isOnline);
}

/**
 * Get last sync timestamp
 * @returns ISO timestamp of last successful sync, null if never synced
 */
export function useLastSyncedAt(): string | null {
  return useStore(syncStore, (s) => s.lastSyncedAt);
}

/**
 * Get pending queue count
 * @returns Number of items in sync queue
 */
export function usePendingCount(): number {
  return useStore(syncStore, (s) => s.queue.length);
}

/**
 * Check if currently syncing
 * @returns True if sync in progress
 */
export function useIsSyncing(): boolean {
  return useStore(syncStore, (s) => s.status === 'syncing');
}

/**
 * Check if sync has error
 * @returns True if last sync failed
 */
export function useHasError(): boolean {
  return useStore(syncStore, (s) => s.status === 'error');
}

/**
 * Get last error message
 * @returns Error message if status is 'error', null otherwise
 */
export function useSyncError(): string | null {
  return useStore(syncStore, (s) => s.lastError);
}

// ============================================================================
// Manual Sync Service Store Hooks (ADR-020)
// ============================================================================

/**
 * Get manual sync status
 * @returns Manual sync status: 'idle' | 'syncing' | 'success' | 'error'
 */
export function useManualSyncStatus(): 'idle' | 'syncing' | 'success' | 'error' {
  return useStore(manualSyncService.store, (s) => s.status);
}

/**
 * Get manual sync last synced timestamp
 * @returns ISO timestamp of last manual sync, null if never synced
 */
export function useManualSyncLastSyncedAt(): string | null {
  return useStore(manualSyncService.store, (s) => s.lastSyncedAt);
}

/**
 * Check if manual sync is in progress
 * @returns True if manual sync in progress
 */
export function useIsManualSyncing(): boolean {
  return useStore(manualSyncService.store, (s) => s.status === 'syncing');
}

/**
 * Get manual sync error message
 * @returns Error message if manual sync failed, null otherwise
 */
export function useManualSyncError(): string | null {
  const state = useStore(manualSyncService.store);
  return state.status === 'error' ? state.error : null;
}

// ============================================================================
// Identity 3: Orchestrator (Coordinates Services)
// ============================================================================

/**
 * Sync actions for UI components
 * Orchestrates sync services with user-provided context
 *
 * Note: All actions require userId from auth context
 */
export interface SyncActions {
  /**
   * Trigger full bidirectional sync (push + pull)
   * @param userId - User ID
   */
  triggerFullSync: (userId: UserId) => Promise<void>;

  /**
   * Trigger push sync only (Local → Cloud)
   * @param userId - User ID
   */
  triggerPushSync: (userId: UserId) => Promise<void>;

  /**
   * Trigger pull sync only (Cloud → Local)
   * @param userId - User ID
   * @param startDate - Optional start date filter (YYYY-MM-DD)
   * @param endDate - Optional end date filter (YYYY-MM-DD)
   */
  triggerPullSync: (userId: UserId, startDate?: string, endDate?: string) => Promise<void>;

  /**
   * Clear sync queue
   */
  clearQueue: () => void;
}

/**
 * Hook for sync actions (Orchestrator identity)
 * Provides UI-triggered sync operations
 *
 * @returns Sync action functions
 */
export function useSyncActions(): SyncActions {
  const triggerFullSync = useCallback(async (userId: UserId) => {
    await manualSyncService.sync(userId);
  }, []);

  const triggerPushSync = useCallback(async (userId: UserId) => {
    const traceId = `push-${Date.now()}`;
    await transactionPushService.syncDirtyTransactions(userId, traceId as any);
  }, []);

  const triggerPullSync = useCallback(async (
    userId: UserId,
    startDate?: string,
    endDate?: string
  ) => {
    await pullTransactions(userId, startDate, endDate);
  }, []);

  const clearQueue = useCallback(() => {
    transactionPushService.clearQueue();
  }, []);

  return {
    triggerFullSync,
    triggerPushSync,
    triggerPullSync,
    clearQueue,
  };
}
