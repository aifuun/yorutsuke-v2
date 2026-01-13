/**
 * i18n constants for sync module tests
 *
 * Purpose: Avoid magic strings in tests. Use translation keys instead.
 * Benefits:
 * - Type-safe: Compiler catches typos
 * - Maintainable: Change text in one place (i18n files)
 * - Localization-ready: Tests work in any language
 */

// Import actual translations (English as base for tests)
import en from '../../../i18n/locales/en.json';

/**
 * Recovery prompt translations
 */
export const RECOVERY_I18N = {
  TITLE: en.sync.recovery.title,
  LOCAL_CHANGES: en.sync.recovery.localChanges,
  QUEUED_ITEMS: en.sync.recovery.queuedItems,
  LAST_SYNCED: en.sync.recovery.lastSynced,
  HINT: en.sync.recovery.hint,
  SYNC_NOW: en.sync.recovery.syncNow,
  SYNC_NOW_LOADING: en.sync.recovery.syncNowLoading,
  DISCARD: en.sync.recovery.discard,
  DISCARD_LOADING: en.sync.recovery.discardLoading,
  ERROR_SYNC: en.sync.recovery.errorSync,
  ERROR_DISCARD: en.sync.recovery.errorDiscard,
} as const;

/**
 * Sync status indicator translations
 */
export const STATUS_I18N = {
  ONLINE: en.sync.status.online,
  OFFLINE: en.sync.status.offline,
  SYNCING: en.sync.status.syncing,
  JUST_NOW: en.sync.status.justNow,
} as const;

/**
 * Helper: Format pending count message
 * Matches actual implementation logic
 */
export function formatPendingCount(count: number): string {
  const plural = count !== 1 ? 's' : '';
  return `You have ${count} pending change${plural} that haven't been synced to the cloud.`;
}

/**
 * Helper: Format pending indicator
 */
export function formatPending(count: number): string {
  return `${count} pending`;
}

/**
 * Helper: Format time ago
 */
export function formatTimeAgo(minutes: number): string {
  if (minutes < 1) return STATUS_I18N.JUST_NOW;
  if (minutes < 60) {
    return minutes === 1
      ? `${minutes} minute ago`
      : `${minutes} minutes ago`;
  }
  const hours = Math.floor(minutes / 60);
  return hours === 1
    ? `${hours} hour ago`
    : `${hours} hours ago`;
}
