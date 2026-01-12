/**
 * Sync Store (Issue #86)
 * Manages cloud sync state, offline queue, and network status
 *
 * Pillar D: FSM - No boolean flags, use union types for state
 * Pillar J: Locality - State near usage (sync module owns sync state)
 */

import { create } from 'zustand';
import type { TransactionId } from '../../../00_kernel/types';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncAction {
  id: string; // Unique action ID
  type: 'confirm' | 'update' | 'delete';
  transactionId: TransactionId;
  timestamp: string;
  payload?: unknown; // Can be any type (Transaction, partial updates, etc.)
}

interface SyncStore {
  // Sync status
  status: SyncStatus;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;

  // Offline queue
  queue: SyncAction[];
  pendingCount: number;

  // Network status
  isOnline: boolean;

  // Actions
  setSyncStatus: (status: SyncStatus) => void;
  setIsSyncing: (syncing: boolean) => void;
  setLastSyncedAt: (timestamp: string) => void;
  setLastError: (error: string | null) => void;

  addToQueue: (action: SyncAction) => void;
  removeFromQueue: (actionId: string) => void;
  clearQueue: () => void;

  setOnlineStatus: (online: boolean) => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  // Initial state
  status: 'idle',
  isSyncing: false,
  lastSyncedAt: loadLastSyncedAt(),
  lastError: null,

  queue: [],
  pendingCount: 0,

  isOnline: navigator.onLine,

  // Action implementations
  setSyncStatus: (status) => set({ status }),

  setIsSyncing: (isSyncing) => set({ isSyncing }),

  setLastSyncedAt: (timestamp) => {
    // Persist to localStorage
    localStorage.setItem('sync:lastSyncedAt', timestamp);
    set({ lastSyncedAt: timestamp });
  },

  setLastError: (error) => set({ lastError: error }),

  addToQueue: (action) =>
    set((state) => {
      // Check if action already in queue (idempotency)
      if (state.queue.some((a) => a.id === action.id)) {
        return state;
      }

      const newQueue = [...state.queue, action];
      return {
        queue: newQueue,
        pendingCount: newQueue.length,
      };
    }),

  removeFromQueue: (actionId) =>
    set((state) => {
      const newQueue = state.queue.filter((a) => a.id !== actionId);
      return {
        queue: newQueue,
        pendingCount: newQueue.length,
      };
    }),

  clearQueue: () =>
    set({
      queue: [],
      pendingCount: 0,
    }),

  setOnlineStatus: (isOnline) => set({ isOnline }),
}));

/**
 * Load lastSyncedAt from localStorage
 * Used to restore sync state across app restarts
 */
function loadLastSyncedAt(): string | null {
  try {
    return localStorage.getItem('sync:lastSyncedAt');
  } catch {
    return null;
  }
}
