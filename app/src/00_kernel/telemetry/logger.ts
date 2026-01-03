// Pillar R: Semantic Observability - structured JSON logs
// All logs are machine-readable with semantic event names

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
  CIRCUIT_OPENED: 'CIRCUIT_OPENED',
  CIRCUIT_CLOSED: 'CIRCUIT_CLOSED',

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
    userId: ctx?.userId,
    ...data,
  };
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
      console.debug(JSON.stringify(createLogEntry('debug', event, data)));
    }
  },

  info: (event: string, data?: Record<string, unknown>) => {
    console.info(JSON.stringify(createLogEntry('info', event, data)));
  },

  warn: (event: string, data?: Record<string, unknown>) => {
    console.warn(JSON.stringify(createLogEntry('warn', event, data)));
  },

  error: (event: string, data?: Record<string, unknown>) => {
    console.error(JSON.stringify(createLogEntry('error', event, data)));
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
