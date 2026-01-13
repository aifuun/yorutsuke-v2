/**
 * Sync Status Indicator (Issue #86 Phase 2)
 * Shows online/offline status, pending sync queue count, and last synced timestamp
 *
 * Pillar L: Pure JSX, data from syncStore
 *
 * IMPORTANT: Uses manual subscription to avoid infinite re-render loop.
 * Object selectors with useSyncStore cause new reference every render.
 * Manual subscription with useState is the safest pattern for vanilla stores.
 */

import { useState, useEffect } from 'react';
import { syncStore, type SyncState } from '../stores/syncStore';
import './sync-status.css';

interface SyncStatusIndicatorProps {
  /** Hide when no pending items (default: false) */
  hideWhenIdle?: boolean;
}

/**
 * Extract only the primitive values we need from store state.
 * This function is called once per store update, not during render.
 */
function selectSyncData(state: SyncState) {
  return {
    isOnline: state.isOnline,
    pendingCount: state.pendingCount,
    lastSyncedAt: state.lastSyncedAt,
    status: state.status,
  };
}

export function SyncStatusIndicator({ hideWhenIdle = false }: SyncStatusIndicatorProps) {
  // Manual subscription pattern - safest for vanilla stores
  // useState with initializer function runs once
  const [syncData, setSyncData] = useState(() => selectSyncData(syncStore.getState()));

  // Subscribe to store changes
  useEffect(() => {
    // Subscribe returns unsubscribe function
    const unsubscribe = syncStore.subscribe((state) => {
      setSyncData(selectSyncData(state));
    });

    return unsubscribe;
  }, []);

  const { isOnline, pendingCount, lastSyncedAt, status } = syncData;
  const isSyncing = status === 'syncing';

  // Hide if idle and hideWhenIdle is true
  if (hideWhenIdle && pendingCount === 0 && isOnline) {
    return null;
  }

  // Format last synced time
  const formattedTime = lastSyncedAt
    ? formatRelativeTime(new Date(lastSyncedAt))
    : null;

  return (
    <div className={`sync-status ${isOnline ? 'sync-status--online' : 'sync-status--offline'}`}>
      {/* Online/Offline indicator */}
      <div className="sync-status__icon" title={isOnline ? 'Online' : 'Offline'}>
        {isOnline ? '🟢' : '🔴'}
      </div>

      {/* Syncing indicator */}
      {isSyncing && (
        <span className="sync-status__text sync-status__text--syncing">
          ⟳ Syncing...
        </span>
      )}

      {/* Pending count */}
      {!isSyncing && pendingCount > 0 && (
        <span className="sync-status__text sync-status__text--pending">
          {pendingCount} pending
        </span>
      )}

      {/* Last synced */}
      {!isSyncing && pendingCount === 0 && formattedTime && (
        <span className="sync-status__text sync-status__text--synced">
          {formattedTime}
        </span>
      )}
    </div>
  );
}

/**
 * Format relative time (e.g., "2m ago", "1h ago")
 */
function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const elapsed = now - date.getTime();

  if (elapsed < 60_000) {
    return 'just now';
  }

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
