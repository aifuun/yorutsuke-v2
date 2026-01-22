/**
 * Pillar R: Semantic Logger for Tauri Desktop App
 * All logs are JSON-formatted with traceId for observability
 *
 * ARCHITECTURE:
 * - Context: Managed by TraceProvider (React context, not global state)
 * - Output: Console (JSON) + Debug UI (human-readable) + File (IPC persistence)
 * - Safe: React context ensures proper isolation per component tree
 *
 * DATA PROCESSING PIPELINE:
 * 1. normalizeErrorData() - Extract Error.message/stack/name (in logger methods)
 * 2. filterSensitiveData() - Redact sensitive fields (in createLogEntry)
 * 3. Spread into entry → JSON.stringify() → Multi-channel output
 *
 * FEATURES:
 * - P0: Error stack extraction, sensitive data filtering
 * - P1: LOG_LEVEL control, performance timer
 * - Tauri-specific: Debug UI integration, IPC persistence, ContextProvider
 *
 * OUTPUTS (3 channels):
 * 1. Console: JSON logs for CloudWatch-style queries
 * 2. Debug UI: Human-readable panel (dev-only, formatted)
 * 3. File: ~/.yorutsuke/logs/YYYY-MM-DD.jsonl (via Tauri IPC)
 */

import { invoke } from '@tauri-apps/api/core';
import type { ContextProvider } from './traceContext';
import { debugLog } from '../../02_modules/debug/headless';

/**
 * Log levels with numeric precedence (P1: LOG_LEVEL control)
 */
export const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;

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

  // Permit (Presign)
  PERMIT_EXPIRED_AT_PRESIGN: 'PERMIT_EXPIRED_AT_PRESIGN',
  PERMIT_REFRESHED_AT_PRESIGN: 'PERMIT_REFRESHED_AT_PRESIGN',
  PERMIT_REFRESH_FAILED_AT_PRESIGN: 'PERMIT_REFRESH_FAILED_AT_PRESIGN',
  PERMIT_REFRESH_EXHAUSTED: 'PERMIT_REFRESH_EXHAUSTED',

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

/**
 * Keys that indicate sensitive data (P1: sensitive data filtering)
 * Case-insensitive matching to catch Password, password, PASSWORD, etc.
 */
const SENSITIVE_KEYS = [
  'password', 'passwd', 'pwd',
  'token', 'jwt', 'bearer',
  'apikey', 'api_key', 'secret', 'api_secret',
  'credential', 'credentials',
  'auth', 'authorization',
  'private_key',  // Removed standalone 'key' to avoid false positives
  'access_token', 'refresh_token',
  'aws_secret_access_key',
  'session', 'sessionid', 'session_id',
  'code', 'confirmation_code', 'otp',
];

/**
 * Filter sensitive data from log objects (P1: sensitive data filtering)
 * This runs SECOND in the pipeline, after error normalization.
 *
 * Design decisions:
 * - Max depth 5: Prevents stack overflow on deeply nested objects
 * - Case-insensitive matching: Catches 'Password', 'password', 'PASSWORD'
 * - Returns '[REDACTED]': Clear indicator, doesn't expose data length
 * - Circular reference detection: Uses WeakSet to prevent infinite loops
 * - Date objects: Preserved as ISO strings
 *
 * Trade-offs:
 * - May miss deeply nested secrets (>5 levels) - acceptable for security/performance balance
 * - Field name matching only - doesn't scan values (prevents false positives)
 *
 * @param data - Data to filter (primitives, objects, arrays)
 * @param depth - Current recursion depth (internal, starts at 0)
 * @param seen - WeakSet to track visited objects (circular reference detection)
 * @returns Filtered data with sensitive fields replaced by '[REDACTED]'
 */
function filterSensitiveData(data: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
  // Prevent infinite recursion
  if (depth > 5 || !data) return data;

  // Handle arrays
  if (Array.isArray(data)) {
    // Circular reference detection
    if (seen.has(data)) return '[Circular]';
    seen.add(data);
    return data.map(item => filterSensitiveData(item, depth + 1, seen));
  }

  // Handle objects
  if (typeof data === 'object' && data !== null) {
    // Handle Date objects specially
    if (data instanceof Date) {
      return data.toISOString();
    }

    // Circular reference detection
    if (seen.has(data)) return '[Circular]';
    seen.add(data);

    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const keyLower = key.toLowerCase();
      // Check if key contains sensitive keywords
      const isSensitive = SENSITIVE_KEYS.some(sensitiveKey =>
        keyLower.includes(sensitiveKey)
      );

      if (isSensitive && typeof value !== 'object') {
        // Only redact primitive sensitive values
        filtered[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        // Recursively filter objects (including sensitive key objects)
        filtered[key] = filterSensitiveData(value, depth + 1, seen);
      } else {
        filtered[key] = value;
      }
    }
    return filtered;
  }

  return data;
}

/**
 * Get current log level from environment variable (P1: LOG_LEVEL control)
 * Defaults to 'info' if not set or invalid.
 *
 * @returns Current log level
 */
function getLogLevel(): LogLevel {
  // Check both import.meta.env and window.ENV (for runtime config)
  const level = (
    import.meta.env.LOG_LEVEL ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (typeof window !== 'undefined' && (window as any).ENV?.LOG_LEVEL) ||
    'info'
  ).toLowerCase();

  return LOG_LEVELS[level as LogLevel] !== undefined ? (level as LogLevel) : 'info';
}

/**
 * Check if a log level should be output (P1: LOG_LEVEL control)
 * Respects LOG_LEVEL environment variable with numeric precedence.
 *
 * Special case: debug logs always output when import.meta.env.DEV === true
 *
 * @param level - Log level to check
 * @returns True if this level should be logged
 */
function shouldLog(level: LogLevel): boolean {
  // Always allow debug logs in development mode
  if (import.meta.env.DEV && level === 'debug') return true;

  const currentLevel = getLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

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
 * Extract error information from Error object or use as-is (P0: Error extraction)
 * This runs FIRST in the pipeline, before sensitive filtering.
 *
 * @param data - Optional Error object or plain data object
 * @returns Normalized data with Error.message/stack/name extracted
 */
function normalizeErrorData(data?: Error | Record<string, unknown>): Record<string, unknown> {
  if (!data) return {};

  // If it's an Error object, extract message, stack, and name (P0 fix)
  if (data instanceof Error) {
    return {
      error: {
        message: data.message,
        stack: data.stack,
        name: data.name,
      },
    };
  }

  // If it's already an object, return as-is
  return typeof data === 'object' ? data : { data };
}

/**
 * Create a log entry with context.
 * Applies sensitive data filtering to protect credentials in logs.
 */
function createLogEntry(
  level: LogLevel,
  event: string,
  data?: Record<string, unknown>
): LogEntry {
  const ctx = globalContextProvider?.getOptional();

  // 2️⃣ Filter sensitive data (data is already normalized from Step 1)
  const filteredData = filterSensitiveData(data || {}) as Record<string, unknown>;

  return {
    timestamp: new Date().toISOString(),
    level,
    event,
    traceId: ctx?.traceId ?? 'no-trace',
    userId: ctx?.userId ?? undefined,
    ...filteredData,  // Spread filtered data into entry
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
    // Check both DEV mode and LOG_LEVEL
    if (!import.meta.env.DEV && !shouldLog('debug')) return;

    const normalized = normalizeErrorData(data);  // 1️⃣ Extract Error first
    const entry = createLogEntry('debug', event, normalized);
    // eslint-disable-next-line no-console
    console.debug(JSON.stringify(entry));
    outputToDebugUI('debug', event, normalized);  // Use normalized data
    persistLog(entry);
  },

  info: (event: string, data?: Record<string, unknown>) => {
    if (!shouldLog('info')) return;  // Check log level
    const normalized = normalizeErrorData(data);  // 1️⃣ Extract Error first
    const entry = createLogEntry('info', event, normalized);
    // eslint-disable-next-line no-console
    console.info(JSON.stringify(entry));
    outputToDebugUI('info', event, normalized);  // Use normalized data
    persistLog(entry);
  },

  warn: (event: string, data?: Record<string, unknown>) => {
    if (!shouldLog('warn')) return;  // Check log level
    const normalized = normalizeErrorData(data);  // 1️⃣ Extract Error first
    const entry = createLogEntry('warn', event, normalized);
    console.warn(JSON.stringify(entry));
    outputToDebugUI('warn', event, normalized);  // Use normalized data
    persistLog(entry);
  },

  error: (event: string, data?: Record<string, unknown>) => {
    if (!shouldLog('error')) return;  // Check log level
    const normalized = normalizeErrorData(data);  // 1️⃣ Extract Error first
    const entry = createLogEntry('error', event, normalized);
    console.error(JSON.stringify(entry));
    outputToDebugUI('error', event, normalized);  // Use normalized data
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

/**
 * Performance timer for measuring execution time (P1: performance monitoring)
 *
 * Usage:
 * ```typescript
 * const timer = createTimer();
 * await someOperation();
 * timer.logDuration(EVENTS.OPERATION_COMPLETED, { operationId: 'op-123' });
 * // Logs: { event: 'OPERATION_COMPLETED', duration: 1234, operationId: 'op-123' }
 * ```
 */
export interface Timer {
  /**
   * Get elapsed time in milliseconds since timer creation
   */
  duration: () => number;

  /**
   * Log event with automatic duration calculation (info level)
   */
  logDuration: (event: EventName, data?: Record<string, unknown>) => void;

  /**
   * Log with specific level and automatic duration
   */
  log: (level: LogLevel, event: EventName, data?: Record<string, unknown>) => void;
}

/**
 * Create a performance timer (P1: performance monitoring)
 *
 * @returns Timer instance with independent start time
 */
export function createTimer(): Timer {
  const startTime = Date.now();

  return {
    /**
     * Get elapsed time in milliseconds
     */
    duration: (): number => Date.now() - startTime,

    /**
     * Log event with automatic duration calculation (info level)
     */
    logDuration: (event: EventName, data: Record<string, unknown> = {}): void => {
      // If data is an Error, normalize it first (Error properties aren't enumerable)
      const normalizedData = data instanceof Error
        ? normalizeErrorData(data)
        : data;
      const dataWithDuration = Object.assign({}, normalizedData, { duration: Date.now() - startTime });
      logger.info(event, dataWithDuration);
    },

    /**
     * Log with specific level and automatic duration
     */
    log: (level: LogLevel, event: EventName, data: Record<string, unknown> = {}): void => {
      const logFn = logger[level];
      if (logFn) {
        // If data is an Error, normalize it first (Error properties aren't enumerable)
        const normalizedData = data instanceof Error
          ? normalizeErrorData(data)
          : data;
        const dataWithDuration = Object.assign({}, normalizedData, { duration: Date.now() - startTime });
        logFn(event, dataWithDuration);
      }
    },
  };
}
