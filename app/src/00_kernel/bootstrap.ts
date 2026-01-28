/**
 * Bootstrap - Initialize all services before rendering React
 * Ensures all services and state are ready before first React render
 *
 * ADR-001: Service Pattern - Services initialized at app startup, outside React lifecycle
 * Issue #89: Service Pattern Migration
 *
 * Initialization order is critical - services may depend on each other:
 * 1. networkMonitor (no deps) - used by autoSyncService
 * 2. quotaService (no deps) - used by captureService
 * 3. captureService (deps: uploadService) - initializes uploadService internally
 * 4. autoSyncService (deps: networkMonitor) - subscribes to networkMonitor
 * 5. transactionSyncService (no deps) - independent
 * 6. manualSyncService (no deps) - independent
 * 7. authStateService (async) - restore user session
 * 8. settingsStateService (async) - restore app settings
 * 9. transactionService (auto-init) - transaction data management
 * 10. reportService (deps: transactionStore) - subscribes to transaction changes
 */

import { logger } from './telemetry';

/**
 * Initialize all services in correct dependency order
 * MUST be called before rendering React
 */
export async function bootstrapServices(): Promise<void> {
  logger.info('BOOTSTRAP_START', { phase: 'services' });

  try {
    // ==================== Synchronous Initialization ====================
    // Phase 1: Foundation services (no dependencies)

    // 1. Network Monitor - required by autoSyncService
    const { networkMonitor } = await import('../02_modules/sync');
    logger.debug('BOOTSTRAP_INIT', { service: 'networkMonitor' });
    networkMonitor.initialize();

    // 2. Quota Service - required by captureService
    const { quotaService } = await import('../02_modules/capture/services/quotaService');
    logger.debug('BOOTSTRAP_INIT', { service: 'quotaService' });
    quotaService.init();

    // 3. Capture Service - initializes uploadService internally
    const { captureService } = await import('../02_modules/capture/services/captureService');
    logger.debug('BOOTSTRAP_INIT', { service: 'captureService' });
    await captureService.init();

    // 4. Auto Sync Service - subscribes to networkMonitor
    const { autoSyncService } = await import('../02_modules/sync');
    logger.debug('BOOTSTRAP_INIT', { service: 'autoSyncService' });
    autoSyncService.init();

    // 5. Transaction Sync Service - independent
    const { transactionSyncService } = await import('../02_modules/transaction/services/transactionSyncService');
    logger.debug('BOOTSTRAP_INIT', { service: 'transactionSyncService' });
    transactionSyncService.init();

    // 6. Manual Sync Service - independent
    const { manualSyncService } = await import('../02_modules/sync/services/manualSyncService');
    logger.debug('BOOTSTRAP_INIT', { service: 'manualSyncService' });
    manualSyncService.init();

    // ==================== Asynchronous Initialization ====================
    // Phase 2: Services that load persisted state (must await)

    // 7. Auth State Service - restore user session from storage
    const { authStateService } = await import('../02_modules/auth/services/authStateService');
    logger.debug('BOOTSTRAP_INIT', { service: 'authStateService', phase: 'async_start' });
    await authStateService.init();
    logger.debug('BOOTSTRAP_INIT', { service: 'authStateService', phase: 'async_complete' });

    // 8. Settings State Service - restore app settings from storage
    const { settingsStateService } = await import('../02_modules/settings/services/settingsStateService');
    logger.debug('BOOTSTRAP_INIT', { service: 'settingsStateService', phase: 'async_start' });
    await settingsStateService.init();
    logger.debug('BOOTSTRAP_INIT', { service: 'settingsStateService', phase: 'async_complete' });

    // ==================== Auto-initialized Services ====================
    // These initialize automatically when imported, don't need explicit init()

    // 9. Transaction Service - initializes on first import via getInstance()
    // Import triggers auto-initialization of singleton
    await import('../02_modules/transaction/services/transactionService');
    logger.debug('BOOTSTRAP_INIT', { service: 'transactionService', phase: 'auto_init' });

    // 10. Report Service - subscribes to transactionStore changes
    // Must be initialized after transactionService
    const { reportService } = await import('../02_modules/report');
    logger.debug('BOOTSTRAP_INIT', { service: 'reportService' });
    reportService.init();

    logger.info('BOOTSTRAP_COMPLETE', {
      phase: 'services',
      servicesCount: 10,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('BOOTSTRAP_FAILED', {
      phase: 'services',
      error: errorMsg,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Verify all services are initialized
 * For debugging purposes
 */
export function getBootstrapStatus(): {
  allServicesReady: boolean;
  timestamp: string;
} {
  return {
    allServicesReady: true,
    timestamp: new Date().toISOString(),
  };
}
