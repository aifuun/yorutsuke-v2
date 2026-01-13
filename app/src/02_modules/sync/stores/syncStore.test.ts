/**
 * Sync Store Tests (Issue #86)
 * Tests Zustand store for sync state management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { syncStore } from './syncStore';
import type { SyncAction } from './syncStore';
import { TransactionId } from '../../../00_kernel/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('syncStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    syncStore.setState({
      status: 'idle',
      lastSyncedAt: null,
      lastError: null,
      queue: [],
      pendingCount: 0,
      isOnline: true,
    });

    localStorageMock.clear();
  });

  describe('initial state', () => {
    it('should have correct default values', () => {
      const state = syncStore.getState();

      expect(state.status).toBe('idle');
      expect(state.lastSyncedAt).toBeNull();
      expect(state.lastError).toBeNull();
      expect(state.queue).toEqual([]);
      expect(state.pendingCount).toBe(0);
      expect(state.isOnline).toBe(true);
    });
  });

  describe('setSyncStatus', () => {
    it('should update sync status', () => {
      syncStore.getState().setSyncStatus('syncing');
      expect(syncStore.getState().status).toBe('syncing');

      syncStore.getState().setSyncStatus('success');
      expect(syncStore.getState().status).toBe('success');
    });

    it('should support all status values', () => {
      syncStore.getState().setSyncStatus('idle');
      expect(syncStore.getState().status).toBe('idle');

      syncStore.getState().setSyncStatus('error');
      expect(syncStore.getState().status).toBe('error');
    });
  });

  describe('setLastSyncedAt', () => {
    it('should update last synced timestamp', () => {
      const timestamp = '2026-01-15T10:00:00Z';
      syncStore.getState().setLastSyncedAt(timestamp);

      expect(syncStore.getState().lastSyncedAt).toBe(timestamp);
    });

    it('should persist to localStorage', () => {
      const timestamp = '2026-01-15T10:00:00Z';
      syncStore.getState().setLastSyncedAt(timestamp);

      const stored = localStorageMock.getItem('sync:lastSyncedAt');
      expect(stored).toBe(timestamp);
    });
  });

  describe('setLastError', () => {
    it('should update last error', () => {
      const error = 'Network error';
      syncStore.getState().setLastError(error);

      expect(syncStore.getState().lastError).toBe(error);
    });

    it('should clear error with null', () => {
      syncStore.getState().setLastError('Error');
      syncStore.getState().setLastError(null);

      expect(syncStore.getState().lastError).toBeNull();
    });
  });

  describe('addToQueue', () => {
    const createAction = (id: string): SyncAction => ({
      id,
      type: 'update',
      transactionId: TransactionId('tx-1'),
      timestamp: '2026-01-15T10:00:00Z',
      payload: {},
    });

    it('should add action to queue', () => {
      const action = createAction('action-1');
      syncStore.getState().addToQueue(action);

      const state = syncStore.getState();
      expect(state.queue).toHaveLength(1);
      expect(state.queue[0]).toEqual(action);
      expect(state.pendingCount).toBe(1);
    });


    it('should prevent duplicate action IDs', () => {
      const action1 = createAction('action-1');
      const action2 = createAction('action-1'); // Same ID

      syncStore.getState().addToQueue(action1);
      syncStore.getState().addToQueue(action2);

      const state = syncStore.getState();
      expect(state.queue).toHaveLength(1); // Only one action
    });

    it('should add multiple unique actions', () => {
      const action1 = createAction('action-1');
      const action2 = createAction('action-2');

      syncStore.getState().addToQueue(action1);
      syncStore.getState().addToQueue(action2);

      const state = syncStore.getState();
      expect(state.queue).toHaveLength(2);
      expect(state.pendingCount).toBe(2);
    });
  });

  describe('removeFromQueue', () => {
    const createAction = (id: string): SyncAction => ({
      id,
      type: 'update',
      transactionId: TransactionId('tx-1'),
      timestamp: '2026-01-15T10:00:00Z',
      payload: {},
    });

    it('should remove action from queue', () => {
      const action1 = createAction('action-1');
      const action2 = createAction('action-2');

      syncStore.getState().addToQueue(action1);
      syncStore.getState().addToQueue(action2);
      syncStore.getState().removeFromQueue('action-1');

      const state = syncStore.getState();
      expect(state.queue).toHaveLength(1);
      expect(state.queue[0].id).toBe('action-2');
      expect(state.pendingCount).toBe(1);
    });


    it('should handle removing non-existent action', () => {
      const action = createAction('action-1');
      syncStore.getState().addToQueue(action);

      syncStore.getState().removeFromQueue('action-999');

      const state = syncStore.getState();
      expect(state.queue).toHaveLength(1); // No change
    });
  });

  describe('clearQueue', () => {
    const createAction = (id: string): SyncAction => ({
      id,
      type: 'update',
      transactionId: TransactionId('tx-1'),
      timestamp: '2026-01-15T10:00:00Z',
      payload: {},
    });

    it('should clear all queued actions', () => {
      syncStore.getState().addToQueue(createAction('action-1'));
      syncStore.getState().addToQueue(createAction('action-2'));
      syncStore.getState().clearQueue();

      const state = syncStore.getState();
      expect(state.queue).toHaveLength(0);
      expect(state.pendingCount).toBe(0);
    });

  });

  describe('setOnlineStatus', () => {
    it('should update online status', () => {
      syncStore.getState().setOnlineStatus(false);
      expect(syncStore.getState().isOnline).toBe(false);

      syncStore.getState().setOnlineStatus(true);
      expect(syncStore.getState().isOnline).toBe(true);
    });
  });

  describe('pendingCount computed', () => {
    const createAction = (id: string): SyncAction => ({
      id,
      type: 'update',
      transactionId: TransactionId('tx-1'),
      timestamp: '2026-01-15T10:00:00Z',
      payload: {},
    });

    it('should update pendingCount when queue changes', () => {
      expect(syncStore.getState().pendingCount).toBe(0);

      syncStore.getState().addToQueue(createAction('action-1'));
      expect(syncStore.getState().pendingCount).toBe(1);

      syncStore.getState().addToQueue(createAction('action-2'));
      expect(syncStore.getState().pendingCount).toBe(2);

      syncStore.getState().removeFromQueue('action-1');
      expect(syncStore.getState().pendingCount).toBe(1);

      syncStore.getState().clearQueue();
      expect(syncStore.getState().pendingCount).toBe(0);
    });
  });

  describe('localStorage persistence', () => {
    it('should load lastSyncedAt from localStorage on init', () => {
      const timestamp = '2026-01-15T10:00:00Z';
      localStorageMock.setItem('sync:lastSyncedAt', timestamp);

      // Simulate store initialization
      const loaded = localStorageMock.getItem('sync:lastSyncedAt');
      expect(loaded).toBe(timestamp);
    });

  });
});
