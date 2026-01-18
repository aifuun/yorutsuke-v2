/**
 * Quota Domain - Public API
 *
 * Exports:
 * - LocalQuota class (singleton for quota management)
 * - Type definitions for Permit and usage tracking
 */

export {
  LocalQuota,
  localQuota,
  type UploadPermit,
  type LocalQuotaData,
  type CanUploadResult,
  type UsageStats,
} from './LocalQuota';
