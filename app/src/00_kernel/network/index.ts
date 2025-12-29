/**
 * @module Network
 * @exposes [useNetworkStatus, useIsOnline, getNetworkState, isNetworkOnline, setupNetworkListeners]
 * @triggers [network:changed]
 * @depends [EventBus]
 *
 * Network status detection with EventBus integration.
 * Uses browser online/offline events.
 */

export { useNetworkStatus, useIsOnline } from './useNetworkStatus';
export {
  getNetworkState,
  isNetworkOnline,
  emitNetworkChanged,
  setupNetworkListeners,
} from './networkStatus';
export type { NetworkState, NetworkStatusResult } from './types';
