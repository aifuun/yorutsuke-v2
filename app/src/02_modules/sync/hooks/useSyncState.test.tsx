/**
 * Sync State Hooks Tests
 * Tests Hook Bridge Layer (Layer 1.5) per ADR-020
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { syncStore } from '../stores/syncStore';
import {
  useSyncStatus,
  useIsOnline,
  useLastSyncedAt,
  usePendingCount,
  useIsSyncing,
  useHasError,
  useSyncError,
  useSyncActions,
} from './useSyncState';
import { UserId } from '../../../00_kernel/types';
import * as manualSyncService from '../services/manualSyncService';
import * as transactionPushService from '../services/transactionPushService';
import * as syncCoordinator from '../services/syncCoordinator';

// Mock services
vi.mock('../services/manualSyncService', () => ({
  manualSyncService: {
    sync: vi.fn(),
  },
}));

vi.mock('../services/transactionPushService', () => ({
  transactionPushService: {
    syncDirtyTransactions: vi.fn(),
    clearQueue: vi.fn(),
  },
}));

vi.mock('../services/syncCoordinator', () => ({
  pullTransactions: vi.fn(),
}));

describe('Sync State Hooks', () => {
  beforeEach(() => {
    // Reset store to initial state
    syncStore.setState({
      status: 'idle',
      isOnline: true,
      lastSyncedAt: null,
      lastError: null,
      queue: [],
      pendingCount: 0,
      setSyncStatus: syncStore.getState().setSyncStatus,
      setOnlineStatus: syncStore.getState().setOnlineStatus,
      setLastSyncedAt: syncStore.getState().setLastSyncedAt,
      setLastError: syncStore.getState().setLastError,
      addToQueue: syncStore.getState().addToQueue,
      removeFromQueue: syncStore.getState().removeFromQueue,
      clearQueue: syncStore.getState().clearQueue,
      getStatus: syncStore.getState().getStatus,
      getQueue: syncStore.getState().getQueue,
      getIsOnline: syncStore.getState().getIsOnline,
    });
    vi.clearAllMocks();
  });

  describe('Identity 1 & 2: Connector + Selector (Primitives)', () => {
    it('useSyncStatus should return current sync status', () => {
      const { result, rerender } = renderHook(() => useSyncStatus());

      expect(result.current).toBe('idle');

      act(() => {
        syncStore.getState().setSyncStatus('syncing');
      });
      rerender();

      expect(result.current).toBe('syncing');
    });

    it('useIsOnline should return network status', () => {
      const { result, rerender } = renderHook(() => useIsOnline());

      expect(result.current).toBe(true);

      act(() => {
        syncStore.getState().setOnlineStatus(false);
      });
      rerender();

      expect(result.current).toBe(false);
    });

    it('useLastSyncedAt should return last sync timestamp', () => {
      const { result, rerender } = renderHook(() => useLastSyncedAt());

      expect(result.current).toBeNull();

      const timestamp = '2026-01-22T10:00:00.000Z';
      act(() => {
        syncStore.getState().setLastSyncedAt(timestamp);
      });
      rerender();

      expect(result.current).toBe(timestamp);
    });

    it('usePendingCount should return queue length', () => {
      const { result, rerender } = renderHook(() => usePendingCount());

      expect(result.current).toBe(0);

      act(() => {
        syncStore.getState().addToQueue({
          id: 'action-1',
          type: 'update',
          transactionId: 'txn-123' as any,
          timestamp: '2026-01-22T10:00:00.000Z',
          payload: {} as any,
        });
      });
      rerender();

      expect(result.current).toBe(1);
    });

    it('useIsSyncing should return true when status is syncing', () => {
      const { result, rerender } = renderHook(() => useIsSyncing());

      expect(result.current).toBe(false);

      act(() => {
        syncStore.getState().setSyncStatus('syncing');
      });
      rerender();

      expect(result.current).toBe(true);
    });

    it('useHasError should return true when status is error', () => {
      const { result, rerender } = renderHook(() => useHasError());

      expect(result.current).toBe(false);

      act(() => {
        syncStore.getState().setSyncStatus('error');
      });
      rerender();

      expect(result.current).toBe(true);
    });

    it('useSyncError should return error message when status is error', () => {
      const { result, rerender } = renderHook(() => useSyncError());

      expect(result.current).toBeNull();

      act(() => {
        syncStore.getState().setSyncStatus('error');
        syncStore.getState().setLastError('Network timeout');
      });
      rerender();

      expect(result.current).toBe('Network timeout');
    });
  });

  describe('Identity 3: Orchestrator (Actions)', () => {
    const mockUserId = UserId('user-123');

    it('should provide triggerFullSync action', async () => {
      const { result } = renderHook(() => useSyncActions());

      await act(async () => {
        await result.current.triggerFullSync(mockUserId);
      });

      expect(manualSyncService.manualSyncService.sync).toHaveBeenCalledWith(mockUserId);
    });

    it('should provide triggerPushSync action', async () => {
      const { result } = renderHook(() => useSyncActions());

      await act(async () => {
        await result.current.triggerPushSync(mockUserId);
      });

      expect(transactionPushService.transactionPushService.syncDirtyTransactions)
        .toHaveBeenCalledWith(mockUserId, expect.any(String));
    });

    it('should provide triggerPullSync action', async () => {
      const { result } = renderHook(() => useSyncActions());

      await act(async () => {
        await result.current.triggerPullSync(mockUserId, '2026-01-01', '2026-01-31');
      });

      expect(syncCoordinator.pullTransactions)
        .toHaveBeenCalledWith(mockUserId, '2026-01-01', '2026-01-31');
    });

    it('should provide clearQueue action', () => {
      const { result } = renderHook(() => useSyncActions());

      act(() => {
        result.current.clearQueue();
      });

      expect(transactionPushService.transactionPushService.clearQueue).toHaveBeenCalled();
    });

    it('actions should be stable across renders', () => {
      const { result, rerender } = renderHook(() => useSyncActions());

      const firstRenderActions = result.current;
      rerender();
      const secondRenderActions = result.current;

      expect(firstRenderActions.triggerFullSync).toBe(secondRenderActions.triggerFullSync);
      expect(firstRenderActions.triggerPushSync).toBe(secondRenderActions.triggerPushSync);
      expect(firstRenderActions.triggerPullSync).toBe(secondRenderActions.triggerPullSync);
      expect(firstRenderActions.clearQueue).toBe(secondRenderActions.clearQueue);
    });
  });

  describe('ADR-012 Compliance: Primitives Only', () => {
    it('all selector hooks should return primitives', () => {
      const primitiveHooks = [
        useSyncStatus,      // string
        useIsOnline,        // boolean
        useLastSyncedAt,    // string | null
        usePendingCount,    // number
        useIsSyncing,       // boolean
        useHasError,        // boolean
        useSyncError,       // string | null
      ];

      primitiveHooks.forEach((hook) => {
        const { result } = renderHook(hook);
        const value = result.current;
        const type = typeof value;

        // Must be primitive: string, number, boolean, or null
        expect(['string', 'number', 'boolean', 'object'].includes(type)).toBe(true);
        if (type === 'object') {
          expect(value).toBeNull(); // Only null allowed as object
        }
      });
    });
  });
});
