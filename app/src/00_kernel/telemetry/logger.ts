// Pillar R: Semantic Observability - structured JSON logs
// All logs are machine-readable with semantic event names

import { invoke } from '@tauri-apps/api/core';
import type { ContextProvider } from './traceContext';

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
  UPLOAD_QUEUE_RESUMED: 'UPLOAD_QUEUE_RESUMED',
  UPLOAD_QUEUE_PAUSED: 'UPLOAD_QUEUE_PAUSED',

  // Image processing
  IMAGE_COMPRESSED: 'IMAGE_COMPRESSED',
  IMAGE_COMPRESSION_FAILED: 'IMAGE_COMPRESSION_FAILED',
  IMAGE_SAVED: 'IMAGE_SAVED',
  IMAGE_DUPLICATE: 'IMAGE_DUPLICATE',

  // Quota
  QUOTA_CHECKED: 'QUOTA_CHECKED',
  QUOTA_LIMIT_REACHED: 'QUOTA_LIMIT_REACHED',

  // Auth
  AUTH_LOGIN_STARTED: 'AUTH_LOGIN_STARTED',
  AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  AUTH_TOKEN_REFRESHED: 'AUTH_TOKEN_REFRESHED',

  // Identity
  DEVICE_ID_GENERATED: 'DEVICE_ID_GENERATED',
  DEVICE_ID_LOADED: 'DEVICE_ID_LOADED',

  // Transaction
  TRANSACTION_CREATED: 'TRANSACTION_CREATED',
  TRANSACTION_CONFIRMED: 'TRANSACTION_CONFIRMED',
  TRANSACTION_DELETED: 'TRANSACTION_DELETED',

  // Report
  REPORT_LOADED: 'REPORT_LOADED',
  REPORT_LOAD_FAILED: 'REPORT_LOAD_FAILED',

  // System
  APP_STARTED: 'APP_STARTED',
  APP_ERROR: 'APP_ERROR',

  // Circuit breaker
  CIRCUIT_OPENED: 'CIRCUIT_OPENED',
  CIRCUIT_CLOSED: 'CIRCUIT_CLOSED',
  CIRCUIT_HALF_OPEN: 'CIRCUIT_HALF_OPEN',

  // Network
  NETWORK_STATUS_CHANGED: 'NETWORK_STATUS_CHANGED',

  // Database
  DB_INITIALIZED: 'DB_INITIALIZED',
  DB_MIGRATION_APPLIED: 'DB_MIGRATION_APPLIED',

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
      persistLog(entry);
    }
  },

  info: (event: string, data?: Record<string, unknown>) => {
    const entry = createLogEntry('info', event, data);
    console.info(JSON.stringify(entry));
    persistLog(entry);
  },

  warn: (event: string, data?: Record<string, unknown>) => {
    const entry = createLogEntry('warn', event, data);
    console.warn(JSON.stringify(entry));
    persistLog(entry);
  },

  error: (event: string, data?: Record<string, unknown>) => {
    const entry = createLogEntry('error', event, data);
    console.error(JSON.stringify(entry));
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
