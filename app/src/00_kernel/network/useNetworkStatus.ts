// Network Status React Hook
// Pillar L: Headless - No JSX, returns data only
// Pillar D: FSM States - Uses NetworkState union type

import { useState, useEffect, useCallback } from 'react';
import { getNetworkState, setupNetworkListeners } from './networkStatus';
import type { NetworkState, NetworkStatusResult } from './types';

/**
 * Hook to detect network status changes
 *
 * @listen network:changed (indirectly via setupNetworkListeners)
 *
 * Pillar L: Returns data and functions only, no JSX
 * Pillar D: Uses FSM state instead of boolean flags
 *
 * @example
 * function UploadQueue() {
 *   const { state, isOnline, justReconnected } = useNetworkStatus();
 *
 *   useEffect(() => {
 *     if (justReconnected) {
 *       // Resume uploads after reconnection
 *       resumeUploads();
 *     }
 *   }, [justReconnected]);
 *
 *   if (!isOnline) {
 *     return <OfflineIndicator />;
 *   }
 *   // ...
 * }
 */
export function useNetworkStatus(): NetworkStatusResult {
  const [state, setState] = useState<NetworkState>(() => getNetworkState());
  const [prevState, setPrevState] = useState<NetworkState>(state);

  // Track state changes to detect reconnection
  const handleStateChange = useCallback((newState: NetworkState, oldState: NetworkState) => {
    setPrevState(oldState);
    setState(newState);
  }, []);

  useEffect(() => {
    // Set initial state
    const initialState = getNetworkState();
    setState(initialState);

    // Setup listeners with callback
    const cleanup = setupNetworkListeners(handleStateChange);

    return cleanup;
  }, [handleStateChange]);

  // Calculate derived values
  const isOnline = state === 'online';
  const justReconnected = state === 'online' && prevState === 'offline';

  // Reset justReconnected after it's been read
  useEffect(() => {
    if (justReconnected) {
      const timer = setTimeout(() => {
        setPrevState('online');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [justReconnected]);

  return {
    state,
    isOnline,
    justReconnected,
  };
}

/**
 * Simplified hook that only returns online status
 * Use when you don't need reconnection detection
 *
 * @example
 * const isOnline = useIsOnline();
 */
export function useIsOnline(): boolean {
  const { isOnline } = useNetworkStatus();
  return isOnline;
}
