/**
 * Network Monitor (Issue #86)
 * Monitors online/offline status and triggers sync queue processing
 *
 * Pillar R: Observability - Log network status changes
 * Pillar N: Context - Include context in logs
 */

import { syncStore } from '../stores/syncStore';
import { logger } from '../../../00_kernel/telemetry/logger';

class NetworkMonitor {
  private isInitialized = false;
  private listeners: Array<(online: boolean) => void> = [];

  /**
   * Initialize network monitoring
   * Call once on app startup
   */
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    // Set initial status
    syncStore.getState().setOnlineStatus(navigator.onLine);

    // Listen to browser online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    this.isInitialized = true;

    logger.info('Network monitor initialized', {
      module: 'sync',
      event: 'NETWORK_MONITOR_INIT',
      isOnline: navigator.onLine,
    });
  }

  /**
   * Cleanup event listeners
   * Call on app unmount (if needed)
   */
  cleanup(): void {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.isInitialized = false;
  }

  private handleOnline = (): void => {
    logger.info('Network status changed: ONLINE', {
      module: 'sync',
      event: 'NETWORK_ONLINE',
    });

    syncStore.getState().setOnlineStatus(true);

    // Notify listeners
    this.listeners.forEach((fn) => fn(true));

    // Trigger queue processing (will be implemented in syncService)
    // syncService.processQueue() will be called by listeners
  };

  private handleOffline = (): void => {
    logger.info('Network status changed: OFFLINE', {
      module: 'sync',
      event: 'NETWORK_OFFLINE',
    });

    syncStore.getState().setOnlineStatus(false);

    // Notify listeners
    this.listeners.forEach((fn) => fn(false));
  };

  /**
   * Subscribe to network status changes
   * Returns unsubscribe function
   */
  subscribe(fn: (online: boolean) => void): () => void {
    this.listeners.push(fn);

    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  /**
   * Get current network status
   */
  getStatus(): boolean {
    return syncStore.getState().isOnline;
  }
}

export const networkMonitor = new NetworkMonitor();
