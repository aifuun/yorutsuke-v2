// Navigation intent store - for passing context between views
import { create } from 'zustand';

export interface LedgerIntent {
  statusFilter?: 'all' | 'pending' | 'confirmed';
  quickFilter?: 'thisMonth' | 'lastMonth' | 'thisYear' | 'all';
  highlightTxId?: string;  // Issue #157: ID of transaction to highlight when navigating from Capture
}

interface NavigationState {
  ledgerIntent: LedgerIntent | null;
  setLedgerIntent: (intent: LedgerIntent | null) => void;
  clearLedgerIntent: () => void;
}

export const navigationStore = create<NavigationState>((set) => ({
  ledgerIntent: null,
  setLedgerIntent: (intent) => set({ ledgerIntent: intent }),
  clearLedgerIntent: () => set({ ledgerIntent: null }),
}));
