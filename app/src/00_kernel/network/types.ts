// Network Status Type Definitions
// Pillar D: FSM States - explicit union types, no booleans

/**
 * Network state FSM
 * - unknown: Initial state, before first check
 * - online: Network available
 * - offline: Network unavailable
 */
export type NetworkState = 'online' | 'offline' | 'unknown';

/**
 * Network status return type for hook
 */
export interface NetworkStatusResult {
  /** Current FSM state */
  state: NetworkState;
  /** Convenience boolean derived from state */
  isOnline: boolean;
  /** True if just reconnected (was offline, now online) */
  justReconnected: boolean;
}
