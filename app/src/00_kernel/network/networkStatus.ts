// Network Status Detection
// Pillar G: Traceability - @trigger annotations for event flow

import { emit } from '../eventBus';
import { logger, EVENTS } from '../telemetry';
import type { NetworkState } from './types';

/**
 * Get current network state from browser API
 */
export function getNetworkState(): NetworkState {
  if (typeof navigator === 'undefined') {
    return 'unknown';
  }
  return navigator.onLine ? 'online' : 'offline';
}

/**
 * Check if network is online
 */
export function isNetworkOnline(): boolean {
  return getNetworkState() === 'online';
}

/**
 * @trigger network:changed
 * @emits { online: boolean }
 *
 * Emit network changed event via EventBus
 */
export function emitNetworkChanged(online: boolean): void {
  logger.info(EVENTS.NETWORK_STATUS_CHANGED, { online });
  emit('network:changed', { online });
}

/**
 * Setup global network event listeners
 * Returns cleanup function
 *
 * @trigger network:changed
 *
 * @example
 * const cleanup = setupNetworkListeners();
 * // Later: cleanup();
 */
export function setupNetworkListeners(
  onStateChange?: (state: NetworkState, prevState: NetworkState) => void
): () => void {
  let currentState = getNetworkState();

  /**
   * @trigger network:changed
   */
  const handleOnline = () => {
    const prevState = currentState;
    currentState = 'online';

    logger.debug('browser_online_event');
    emitNetworkChanged(true);

    onStateChange?.(currentState, prevState);
  };

  /**
   * @trigger network:changed
   */
  const handleOffline = () => {
    const prevState = currentState;
    currentState = 'offline';

    logger.debug('browser_offline_event');
    emitNetworkChanged(false);

    onStateChange?.(currentState, prevState);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  logger.debug('network_listeners_registered', { initialState: currentState });

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    logger.debug('network_listeners_removed');
  };
}
