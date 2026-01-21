/**
 * Permit Migration from localStorage to SQLite (Issue #154)
 *
 * One-time migration that runs on app startup.
 * Moves permits from localStorage to SQLite (ADR-017 compliance).
 *
 * Pattern: Idempotent - safe to call multiple times.
 * If no localStorage data exists, quietly returns.
 */

import { logger } from '../../00_kernel/telemetry/logger';
import { validatePermitFormat } from './permitValidation';
import * as permitDb from './permitDb';
import type { LocalQuotaData } from './LocalQuota';

const STORAGE_KEY = 'yorutsuke:quota';

/**
 * Migrate permit from localStorage to SQLite
 *
 * Runs once per app session (idempotent - safe to retry).
 *
 * Flow:
 * 1. Check if permit exists in localStorage
 * 2. Validate permit format
 * 3. If valid, save to SQLite
 * 4. Clear localStorage (cleanup)
 *
 * If migration fails, logs error but doesn't throw (non-blocking).
 */
export async function migratePermitToSQLite(): Promise<void> {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    logger.info('permit_migration_skipped', { reason: 'no_data' });
    return;
  }

  try {
    const data = JSON.parse(stored) as LocalQuotaData;

    if (!data.permit) {
      logger.info('permit_migration_skipped', { reason: 'no_permit' });
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    // Validate permit before migrating
    const validation = validatePermitFormat(data.permit);

    if (validation.valid) {
      // Save to SQLite
      await permitDb.savePermit(data.permit);
      logger.info('permit_migrated_to_sqlite', {
        userId: data.permit.userId,
        tier: data.permit.tier,
        totalLimit: data.permit.totalLimit,
      });
    } else {
      logger.warn('permit_migration_skipped_invalid', {
        reason: validation.reason,
        tier: data.permit?.tier,
      });
    }

    // Clear localStorage after migration (successful or failed)
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    logger.error('permit_migration_failed', {
      error: String(error),
    });
    // Don't throw - allow app to continue
  }
}
