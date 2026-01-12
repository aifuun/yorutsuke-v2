/**
 * Sync Store (Issue #86)
 * Manages cloud sync state, offline queue, and network status
 *
 * Pillar D: FSM - No boolean flags, use union types for state
 * Pillar J: Locality - State near usage (sync module owns sync state)
 * ADR-001: Service Pattern - Vanilla store for Service layer access
 */

import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { TransactionId } from '../../../00_kernel/types';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncAction {
  id: string; // Unique action ID
  type: 'confirm' | 'update' | 'delete';
  transactionId: TransactionId;
  timestamp: string;
  payload?: unknown; // Can be any type (Transaction, partial updates, etc.)
}

// Separate State and Actions interfaces (Store pattern)
export interface SyncState {
  // Sync status (Pillar D: FSM - single state source)
  status: SyncStatus;
  lastSyncedAt: string | null;
  lastError: string | null;

  // Offline queue
  queue: SyncAction[];
  pendingCount: number;

  // Network status
  isOnline: boolean;
}

export interface SyncActions {
  // State setters
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncedAt: (timestamp: string) => void;
  setLastError: (error: string | null) => void;

  // Queue operations
  addToQueue: (action: SyncAction) => void;
  removeFromQueue: (actionId: string) => void;
  clearQueue: () => void;

  // Network status
  setOnlineStatus: (online: boolean) => void;

  // Getters for Service layer (Vanilla store pattern)
  getStatus: () => SyncStatus;
  getQueue: () => SyncAction[];
  getIsOnline: () => boolean;
}

export type SyncStore = SyncState & SyncActions;

export const syncStore = createStore<SyncStore>((set, get) => ({
  // Initial state
  status: 'idle',
  lastSyncedAt: loadLastSyncedAt(),
  lastError: null,

  queue: [],
  pendingCount: 0,

  isOnline: navigator.onLine,

  // Action implementations
  setSyncStatus: (status) => {
    console.log('[syncStore] setSyncStatus:', status, new Error().stack?.split('\n')[2]);
    set({ status });
  },

  setLastSyncedAt: (timestamp) => {
    console.log('[syncStore] setLastSyncedAt:', timestamp, new Error().stack?.split('\n')[2]);
    // Persist to localStorage
    localStorage.setItem('sync:lastSyncedAt', timestamp);
    set({ lastSyncedAt: timestamp });
  },

  setLastError: (error) => {
    console.log('[syncStore] setLastError:', error);
    set({ lastError: error });
  },

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

  // Getters for Service layer (Vanilla store pattern)
  getStatus: () => get().status,
  getQueue: () => get().queue,
  getIsOnline: () => get().isOnline,
}));

// React bridge for components (ADR-001 pattern)
export const useSyncStore = <T,>(selector: (state: SyncStore) => T): T => {
  return useStore(syncStore, selector);
};

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
