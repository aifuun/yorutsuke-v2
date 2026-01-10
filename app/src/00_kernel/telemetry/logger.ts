// Pillar R: Semantic Observability - structured JSON logs
// All logs are machine-readable with semantic event names
// Outputs to: Console (JSON) + Debug UI (human-readable) + File (JSON Lines)

import { invoke } from '@tauri-apps/api/core';
import type { ContextProvider } from './traceContext';
import { debugLog } from '../../02_modules/debug/headless';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Semantic log entry structure.
 * All logs conform to this interface for machine parsing.
 */
interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly event: string;
  readonly traceId: string;
  readonly userId?: string;
  readonly [key: string]: unknown;
}

/**
 * Semantic event names for Yorutsuke.
 * Format: NOUN_VERB for machine parsing and alerting.
 */
export const EVENTS = {
  // Upload lifecycle
  UPLOAD_STARTED: 'UPLOAD_STARTED',
  UPLOAD_COMPLETED: 'UPLOAD_COMPLETED',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  UPLOAD_ENQUEUED: 'UPLOAD_ENQUEUED',
  UPLOAD_QUEUE_RESUMED: 'UPLOAD_QUEUE_RESUMED',
  UPLOAD_QUEUE_PAUSED: 'UPLOAD_QUEUE_PAUSED',

  // Image processing
  IMAGE_DROPPED: 'IMAGE_DROPPED',
  IMAGE_REJECTED: 'IMAGE_REJECTED',
  IMAGE_PROCESSING_STARTED: 'IMAGE_PROCESSING_STARTED',
  IMAGE_PROCESSING_SKIPPED: 'IMAGE_PROCESSING_SKIPPED',
  IMAGE_COMPRESSED: 'IMAGE_COMPRESSED',
  IMAGE_COMPRESSION_FAILED: 'IMAGE_COMPRESSION_FAILED',
  IMAGE_SAVED: 'IMAGE_SAVED',
  IMAGE_DUPLICATE: 'IMAGE_DUPLICATE',
  IMAGE_CLEANUP: 'IMAGE_CLEANUP',
  IMAGE_ORPHANED: 'IMAGE_ORPHANED',  // Transaction has imageId but no s3Key
  IMAGE_SYNC_ORPHANS_DETECTED: 'IMAGE_SYNC_ORPHANS_DETECTED',  // Summary of orphaned images

  // Queue
  QUEUE_RESTORED: 'QUEUE_RESTORED',
  QUEUE_AUTO_PROCESS: 'QUEUE_AUTO_PROCESS',
  QUEUE_AUTO_UPLOAD: 'QUEUE_AUTO_UPLOAD',

  // Quota
  QUOTA_CHECKED: 'QUOTA_CHECKED',
  QUOTA_REFRESHED: 'QUOTA_REFRESHED',
  QUOTA_LIMIT_REACHED: 'QUOTA_LIMIT_REACHED',

  // Auth
  AUTH_LOGIN_STARTED: 'AUTH_LOGIN_STARTED',
  AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  AUTH_TOKEN_REFRESHED: 'AUTH_TOKEN_REFRESHED',
  AUTH_SESSION_RESTORED: 'AUTH_SESSION_RESTORED',
  AUTH_GUEST_DATA_CLAIMED: 'AUTH_GUEST_DATA_CLAIMED',
  AUTH_REGISTER_STARTED: 'AUTH_REGISTER_STARTED',
  AUTH_VERIFY_STARTED: 'AUTH_VERIFY_STARTED',
  AUTH_LOAD_FAILED: 'AUTH_LOAD_FAILED',
  TOKEN_SAVED: 'TOKEN_SAVED',
  USER_SAVED: 'USER_SAVED',
  AUTH_DATA_CLEARED: 'AUTH_DATA_CLEARED',

  // API
  API_NOT_CONFIGURED: 'API_NOT_CONFIGURED',
  API_REQUEST_FAILED: 'API_REQUEST_FAILED',
  API_PARSE_FAILED: 'API_PARSE_FAILED',

  // Drag-drop
  DRAG_ENTER: 'DRAG_ENTER',
  DRAG_LEAVE: 'DRAG_LEAVE',
  DRAG_DROP: 'DRAG_DROP',
  DRAG_LISTENERS_REGISTERED: 'DRAG_LISTENERS_REGISTERED',
  DRAG_LISTENERS_REMOVED: 'DRAG_LISTENERS_REMOVED',

  // Identity
  DEVICE_ID_GENERATED: 'DEVICE_ID_GENERATED',
  DEVICE_ID_LOADED: 'DEVICE_ID_LOADED',

  // Transaction
  TRANSACTION_CREATED: 'TRANSACTION_CREATED',
  TRANSACTION_CONFIRMED: 'TRANSACTION_CONFIRMED',
  TRANSACTION_DELETED: 'TRANSACTION_DELETED',

  // Settings
  SETTINGS_LOADED: 'SETTINGS_LOADED',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  SETTINGS_SAVE_FAILED: 'SETTINGS_SAVE_FAILED',

  // Seed Data
  SEED_STARTED: 'SEED_STARTED',
  SEED_COMPLETED: 'SEED_COMPLETED',
  SEED_FAILED: 'SEED_FAILED',
  SEED_CLEARED: 'SEED_CLEARED',

  // Mock Mode
  MOCK_MODE_CHANGED: 'MOCK_MODE_CHANGED',

  // Debug
  DEBUG_MENU_UNLOCKED: 'DEBUG_MENU_UNLOCKED',

  // Report
  REPORT_LOADED: 'REPORT_LOADED',
  REPORT_LOAD_FAILED: 'REPORT_LOAD_FAILED',

  // System
  APP_STARTED: 'APP_STARTED',
  APP_INITIALIZED: 'APP_INITIALIZED',
  APP_ERROR: 'APP_ERROR',
  SERVICE_INITIALIZED: 'SERVICE_INITIALIZED',

  // Circuit breaker
  CIRCUIT_OPENED: 'CIRCUIT_OPENED',
  CIRCUIT_CLOSED: 'CIRCUIT_CLOSED',
  CIRCUIT_HALF_OPEN: 'CIRCUIT_HALF_OPEN',

  // Network
  NETWORK_STATUS_CHANGED: 'NETWORK_STATUS_CHANGED',

  // Database
  DB_INITIALIZED: 'DB_INITIALIZED',
  DB_MIGRATION_APPLIED: 'DB_MIGRATION_APPLIED',
  DATA_MIGRATED: 'DATA_MIGRATED',

  // EventBus
  EVENT_EMITTED: 'EVENT_EMITTED',
  EVENT_SUBSCRIBED: 'EVENT_SUBSCRIBED',

  // State transitions
  STATE_TRANSITION: 'STATE_TRANSITION',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

// Global context provider (set by TraceProvider)
let globalContextProvider: ContextProvider | null = null;

/**
 * Set the global context provider.
 * Called by TraceProvider on mount.
 */
export function setContextProvider(provider: ContextProvider | null): void {
  globalContextProvider = provider;
}

/**
 * Create a log entry with context.
 */
function createLogEntry(
  level: LogLevel,
  event: string,
  data?: Record<string, unknown>
): LogEntry {
  const ctx = globalContextProvider?.getOptional();

  return {
    timestamp: new Date().toISOString(),
    level,
    event,
    traceId: ctx?.traceId ?? 'no-trace',
    userId: ctx?.userId ?? undefined,
    ...data,
  };
}

/**
 * Write log entry to local file via Tauri IPC.
 * Fire-and-forget: errors are silently ignored to avoid log recursion.
 */
function persistLog(entry: LogEntry): void {
  // Skip persistence in browser-only mode
  if (typeof window === 'undefined' || !('__TAURI__' in window)) {
    return;
  }

  invoke('log_write', { entry }).catch(() => {
    // Silently ignore - we can't log errors about logging
  });
}

/**
 * Extract tag from event name for Debug UI display.
 * UPLOAD_STARTED -> Upload
 * IMAGE_COMPRESSION_FAILED -> Image
 */
function extractTag(event: string): string {
  const parts = event.split('_');
  if (parts.length === 0) return 'Log';
  // Capitalize first letter, lowercase rest
  const noun = parts[0];
  return noun.charAt(0).toUpperCase() + noun.slice(1).toLowerCase();
}

/**
 * Format event name for human-readable display.
 * UPLOAD_STARTED -> Started
 * IMAGE_COMPRESSION_FAILED -> Compression failed
 */
function formatEventMessage(event: string): string {
  const parts = event.split('_');
  if (parts.length <= 1) return event;
  // Remove noun prefix, join rest with spaces, capitalize first
  const rest = parts.slice(1).join(' ').toLowerCase();
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/**
 * Output to Debug UI panel.
 */
function outputToDebugUI(level: LogLevel, event: string, data?: Record<string, unknown>): void {
  const tag = extractTag(event);
  const message = formatEventMessage(event);
  const debugLevel = level === 'debug' ? 'info' : level;
  debugLog(debugLevel, tag, message, data);
}

/**
 * Semantic logger with traceId support.
 *
 * Usage:
 * ```typescript
 * logger.info(EVENTS.UPLOAD_STARTED, { imageId, size: 1024 });
 * logger.error(EVENTS.UPLOAD_FAILED, { imageId, error: 'timeout' });
 * ```
 */
export const logger = {
  debug: (event: string, data?: Record<string, unknown>) => {
    if (import.meta.env.DEV) {
      const entry = createLogEntry('debug', event, data);
      console.debug(JSON.stringify(entry));
      outputToDebugUI('debug', event, data);
      persistLog(entry);
    }
  },

  info: (event: string, data?: Record<string, unknown>) => {
    const entry = createLogEntry('info', event, data);
    console.info(JSON.stringify(entry));
    outputToDebugUI('info', event, data);
    persistLog(entry);
  },

  warn: (event: string, data?: Record<string, unknown>) => {
    const entry = createLogEntry('warn', event, data);
    console.warn(JSON.stringify(entry));
    outputToDebugUI('warn', event, data);
    persistLog(entry);
  },

  error: (event: string, data?: Record<string, unknown>) => {
    const entry = createLogEntry('error', event, data);
    console.error(JSON.stringify(entry));
    outputToDebugUI('error', event, data);
    persistLog(entry);
  },
};

/**
 * Log a state transition (Pillar D: FSM).
 */
export function logStateTransition(params: {
  entity: string;
  entityId: string;
  from: string;
  to: string;
  [key: string]: unknown;
}): void {
  const { entity, entityId, from, to, ...rest } = params;
  logger.info(EVENTS.STATE_TRANSITION, {
    entity,
    entityId,
    from,
    to,
    ...rest,
  });
}

/**
 * Initialize logging system.
 * - Cleans up old log files (> 7 days)
 * Call once at app startup.
 */
export async function initLogger(): Promise<void> {
  // Skip in browser-only mode
  if (typeof window === 'undefined' || !('__TAURI__' in window)) {
    return;
  }

  try {
    const deleted = await invoke<number>('log_cleanup', { retentionDays: 7 });
    if (deleted > 0) {
      logger.info(EVENTS.APP_STARTED, { logFilesCleanedUp: deleted });
    }
  } catch {
    // Silently ignore cleanup errors
  }
}

/**
 * Get the path to today's log file (for debugging).
 */
export async function getLogFilePath(): Promise<string | null> {
  if (typeof window === 'undefined' || !('__TAURI__' in window)) {
    return null;
  }

  try {
    return await invoke<string>('log_get_path');
  } catch {
    return null;
  }
}
