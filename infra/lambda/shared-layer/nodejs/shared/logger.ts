/**
 * Pillar R: Semantic Logger for Lambda Functions
 * All logs are JSON-formatted with traceId for observability
 *
 * ⚠️ CRITICAL ARCHITECTURE NOTE:
 * - currentContext is GLOBAL and shared per Lambda container
 * - SAFE: Lambda is configured with single request per container
 * - RISK: If Lambda ever enables concurrency on same container, data will leak
 * - MITIGATION: Always call initContext() at handler start
 * - FUTURE: Consider thread-local storage or AsyncLocalStorage if concurrency enabled
 *
 * FEATURES:
 * - P0: Error stack extraction, JSON parse safety, input validation
 * - P1: Sensitive data filtering, log level control, performance monitoring
 */

/**
 * Semantic event names
 * ✅ TypeScript Compile-Time Enforcement: Using 'as const' ensures only these values are valid
 */
export const EVENTS = {
  // Presign
  PRESIGN_STARTED: 'PRESIGN_STARTED',
  PRESIGN_COMPLETED: 'PRESIGN_COMPLETED',
  PRESIGN_FAILED: 'PRESIGN_FAILED',
  PRESIGN_CACHED: 'PRESIGN_CACHED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  EMERGENCY_STOP: 'EMERGENCY_STOP',

  // Quota
  QUOTA_CHECKED: 'QUOTA_CHECKED',
  QUOTA_CHECK_FAILED: 'QUOTA_CHECK_FAILED',

  // Batch processing
  BATCH_STARTED: 'BATCH_STARTED',
  BATCH_COMPLETED: 'BATCH_COMPLETED',
  BATCH_FAILED: 'BATCH_FAILED',
  IMAGE_PROCESSING_STARTED: 'IMAGE_PROCESSING_STARTED',
  IMAGE_PROCESSING_COMPLETED: 'IMAGE_PROCESSING_COMPLETED',
  IMAGE_PROCESSING_FAILED: 'IMAGE_PROCESSING_FAILED',
  OCR_COMPLETED: 'OCR_COMPLETED',
  OCR_PARSE_FAILED: 'OCR_PARSE_FAILED',
  TRANSACTION_CREATED: 'TRANSACTION_CREATED',

  // Admin operations - delete-data
  ADMIN_DELETE_DATA_REQUEST: 'ADMIN_DELETE_DATA_REQUEST',
  DELETE_USER_TRANSACTIONS_STARTED: 'DELETE_USER_TRANSACTIONS_STARTED',
  DELETE_USER_TRANSACTIONS_FOUND: 'DELETE_USER_TRANSACTIONS_FOUND',
  DELETE_USER_TRANSACTIONS_BATCH_COMPLETED: 'DELETE_USER_TRANSACTIONS_BATCH_COMPLETED',
  DELETE_USER_IMAGES_STARTED: 'DELETE_USER_IMAGES_STARTED',
  DELETE_USER_IMAGES_FOUND: 'DELETE_USER_IMAGES_FOUND',
  DELETE_USER_IMAGES_BATCH_COMPLETED: 'DELETE_USER_IMAGES_BATCH_COMPLETED',
  ADMIN_DELETE_DATA_START: 'ADMIN_DELETE_DATA_START',
  ADMIN_DELETE_DATA_COMPLETED: 'ADMIN_DELETE_DATA_COMPLETED',
  ADMIN_DELETE_DATA_ERROR: 'ADMIN_DELETE_DATA_ERROR',

  // Admin operations - purge-all-data
  ADMIN_PURGE_ALL_DATA_REQUEST: 'ADMIN_PURGE_ALL_DATA_REQUEST',
  PURGE_ALL_TRANSACTIONS_STARTED: 'PURGE_ALL_TRANSACTIONS_STARTED',
  PURGE_ALL_TRANSACTIONS_FOUND: 'PURGE_ALL_TRANSACTIONS_FOUND',
  PURGE_ALL_TRANSACTIONS_SCAN_BATCH: 'PURGE_ALL_TRANSACTIONS_SCAN_BATCH',
  PURGE_ALL_TRANSACTIONS_BATCH_COMPLETED: 'PURGE_ALL_TRANSACTIONS_BATCH_COMPLETED',
  PURGE_ALL_IMAGES_STARTED: 'PURGE_ALL_IMAGES_STARTED',
  PURGE_ALL_IMAGES_FOUND: 'PURGE_ALL_IMAGES_FOUND',
  PURGE_ALL_IMAGES_LIST_BATCH: 'PURGE_ALL_IMAGES_LIST_BATCH',
  PURGE_ALL_IMAGES_BATCH_COMPLETED: 'PURGE_ALL_IMAGES_BATCH_COMPLETED',
  ADMIN_PURGE_ALL_DATA_INITIATED: 'ADMIN_PURGE_ALL_DATA_INITIATED',
  ADMIN_PURGE_ALL_DATA_COMPLETED: 'ADMIN_PURGE_ALL_DATA_COMPLETED',
  ADMIN_PURGE_ALL_DATA_ERROR: 'ADMIN_PURGE_ALL_DATA_ERROR',
  ADMIN_PURGE_UNAUTHORIZED: 'ADMIN_PURGE_UNAUTHORIZED',
  AUDIT_LOG_WRITE_FAILED: 'AUDIT_LOG_WRITE_FAILED',

  // Admin operations - control
  ADMIN_CONTROL_REQUEST: 'ADMIN_CONTROL_REQUEST',
  ADMIN_CONTROL_GET_HISTORY_FAILED: 'ADMIN_CONTROL_GET_HISTORY_FAILED',
  EMERGENCY_STOP_STATUS_CHANGED: 'EMERGENCY_STOP_STATUS_CHANGED',
  ADMIN_CONTROL_HANDLER_ERROR: 'ADMIN_CONTROL_HANDLER_ERROR',

  // P1: Config
  CONFIG_REQUEST: 'CONFIG_REQUEST',
  MAINTENANCE_MODE_FETCH_FAILED: 'MAINTENANCE_MODE_FETCH_FAILED',
  CONFIG_ERROR: 'CONFIG_ERROR',

  // P1: Issue Permit
  PERMIT_SECRET_FETCH_FAILED: 'PERMIT_SECRET_FETCH_FAILED',
  PERMIT_ISSUED: 'PERMIT_ISSUED',
  PERMIT_ISSUE_FAILED: 'PERMIT_ISSUE_FAILED',

  // P1: Report
  REPORT_GENERATED: 'REPORT_GENERATED',
  REPORT_ERROR: 'REPORT_ERROR',
  REPORT_HISTORY_FETCHED: 'REPORT_HISTORY_FETCHED',
  REPORT_HISTORY_ERROR: 'REPORT_HISTORY_ERROR',
  REPORT_HANDLER_ERROR: 'REPORT_HANDLER_ERROR',

  // P1: Transactions
  TRANSACTION_QUERY_ERROR: 'TRANSACTION_QUERY_ERROR',
  TRANSACTION_UPDATE_ERROR: 'TRANSACTION_UPDATE_ERROR',
  TRANSACTION_DELETE_ERROR: 'TRANSACTION_DELETE_ERROR',
  TRANSACTION_FETCH_ERROR: 'TRANSACTION_FETCH_ERROR',
  S3_IMAGE_SKIP_DELETE: 'S3_IMAGE_SKIP_DELETE',
  S3_IMAGE_DELETED: 'S3_IMAGE_DELETED',
  S3_IMAGE_DELETE_FAILED: 'S3_IMAGE_DELETE_FAILED',
  SYNC_STARTED: 'SYNC_STARTED',
  SYNC_SUCCESS: 'SYNC_SUCCESS',
  SYNC_SKIPPED: 'SYNC_SKIPPED',
  SYNC_FAILED: 'SYNC_FAILED',
  SYNC_COMPLETED: 'SYNC_COMPLETED',
  TRANSACTION_HANDLER_ERROR: 'TRANSACTION_HANDLER_ERROR',

  // P1: Admin Costs
  ADMIN_COSTS_REQUEST: 'ADMIN_COSTS_REQUEST',
  ADMIN_COSTS_FETCH_ERROR: 'ADMIN_COSTS_FETCH_ERROR',
  ADMIN_COSTS_HANDLER_ERROR: 'ADMIN_COSTS_HANDLER_ERROR',

  // P1: Admin Stats
  ADMIN_STATS_REQUEST: 'ADMIN_STATS_REQUEST',
  ADMIN_STATS_EMERGENCY_ERROR: 'ADMIN_STATS_EMERGENCY_ERROR',
  ADMIN_STATS_IMAGES_ERROR: 'ADMIN_STATS_IMAGES_ERROR',
  ADMIN_STATS_USERS_ERROR: 'ADMIN_STATS_USERS_ERROR',
  ADMIN_STATS_BATCH_ERROR: 'ADMIN_STATS_BATCH_ERROR',
  ADMIN_STATS_HANDLER_ERROR: 'ADMIN_STATS_HANDLER_ERROR',

  // P2: Instant Processor
  IMAGE_FORMAT_DETECTED: 'IMAGE_FORMAT_DETECTED',
  AZURE_CREDENTIALS_REQUIRED_BUT_UNAVAILABLE: 'AZURE_CREDENTIALS_REQUIRED_BUT_UNAVAILABLE',
  BATCH_CONFIG_LOAD_FAILED: 'BATCH_CONFIG_LOAD_FAILED',
  MERCHANT_LIST_CACHE_HIT: 'MERCHANT_LIST_CACHE_HIT',
  MERCHANT_LIST_LOADED: 'MERCHANT_LIST_LOADED',
  MERCHANT_LIST_LOAD_FAILED: 'MERCHANT_LIST_LOAD_FAILED',
  TRACE_ID_RECOVERED: 'TRACE_ID_RECOVERED',
  TRACE_ID_NOT_FOUND_IN_METADATA: 'TRACE_ID_NOT_FOUND_IN_METADATA',
  TRACE_ID_RECOVERY_FAILED: 'TRACE_ID_RECOVERY_FAILED',
  OCR_ANALYSIS_STARTED: 'OCR_ANALYSIS_STARTED',
  AZURE_DI_ANALYSIS_STARTED: 'AZURE_DI_ANALYSIS_STARTED',
  AZURE_DI_ANALYSIS_COMPLETED: 'AZURE_DI_ANALYSIS_COMPLETED',
  BEDROCK_ANALYSIS_STARTED: 'BEDROCK_ANALYSIS_STARTED',
  BEDROCK_ANALYSIS_COMPLETED: 'BEDROCK_ANALYSIS_COMPLETED',
  OCR_PARSING_FAILED: 'OCR_PARSING_FAILED',
  TRANSACTION_SAVE_STARTED: 'TRANSACTION_SAVE_STARTED',
  TRANSACTION_SAVE_COMPLETED: 'TRANSACTION_SAVE_COMPLETED',
  TRANSACTION_SAVE_FAILED: 'TRANSACTION_SAVE_FAILED',
  INSTANT_PROCESSOR_ERROR: 'INSTANT_PROCESSOR_ERROR',

  // P2: Admin Azure Credentials
  AZURE_CREDENTIALS_UPDATE_ATTEMPT: 'AZURE_CREDENTIALS_UPDATE_ATTEMPT',
  AZURE_SECRET_ARN_NOT_CONFIGURED: 'AZURE_SECRET_ARN_NOT_CONFIGURED',
  AZURE_CREDENTIALS_UPDATED: 'AZURE_CREDENTIALS_UPDATED',
  AZURE_CREDENTIALS_VALIDATION_FAILED: 'AZURE_CREDENTIALS_VALIDATION_FAILED',
  AZURE_CREDENTIALS_HANDLER_ERROR: 'AZURE_CREDENTIALS_HANDLER_ERROR',

  // P2: Admin Model Config
  DEFAULT_CONFIG_INITIALIZED: 'DEFAULT_CONFIG_INITIALIZED',
  CONFIG_RETRIEVED: 'CONFIG_RETRIEVED',
  MIGRATED_MODEL_ID_TO_PRIMARY: 'MIGRATED_MODEL_ID_TO_PRIMARY',
  CONFIG_UPDATED: 'CONFIG_UPDATED',
  CONFIG_VALIDATION_FAILED: 'CONFIG_VALIDATION_FAILED',
  ADMIN_MODEL_CONFIG_ERROR: 'ADMIN_MODEL_CONFIG_ERROR',

  // P2: Diagnostic
  API_REQUEST_RECEIVED: 'API_REQUEST_RECEIVED',
} as const;

/**
 * EventName type derived from EVENTS constant
 * ✅ Compile-time validation: Only values from EVENTS are allowed
 */
export type EventName = typeof EVENTS[keyof typeof EVENTS];

/**
 * Log levels with numeric precedence
 */
export const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;

/**
 * Get current log level from environment (P1: log level control)
 */
function getLogLevel(): LogLevel {
  const level = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return LOG_LEVELS[level as LogLevel] !== undefined ? (level as LogLevel) : 'info';
}

/**
 * Check if a log should be output based on level (P1: log level control)
 */
function shouldLog(level: LogLevel): boolean {
  const currentLevel = getLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

/**
 * Keys that indicate sensitive data (P1: sensitive data filtering)
 */
const SENSITIVE_KEYS = [
  'password', 'passwd', 'pwd',
  'token', 'jwt', 'bearer',
  'apikey', 'api_key', 'secret', 'api_secret',
  'credential', 'credentials',
  'auth', 'authorization',
  'key', 'private', 'private_key',
  'access_token', 'refresh_token',
  'aws_secret_access_key',
  'session', 'sessionid', 'session_id',
  'code', 'confirmation_code', 'otp',
];

/**
 * Filter sensitive data from log objects (P1: sensitive data filtering)
 *
 * Design decisions:
 * - Max depth 5: Prevents stack overflow on deeply nested objects
 *   (Most log objects are 2-3 levels deep; 5 is sufficient for edge cases)
 * - Case-insensitive matching: Catches 'Password', 'password', 'PASSWORD'
 *   (Handles inconsistent casing from various sources)
 * - Returns '[REDACTED]': Clear indicator without exposing data length
 *   (Unlike '***', doesn't hint at original value length)
 * - Short-circuits on primitives: Performance optimization for common cases
 *   (Strings, numbers, booleans don't need recursion)
 *
 * Trade-offs:
 * - May miss deeply nested secrets (>5 levels)
 *   Rationale: Acceptable for security/performance balance; real-world logs rarely exceed 5 levels
 * - Field name matching only, doesn't scan values
 *   Rationale: Prevents false positives (e.g., user description: "My password was wrong")
 * - No encryption, just removal
 *   Rationale: CloudWatch logs are encrypted at rest; removal sufficient for Lambda logs
 *
 * @param data - Log data to filter (any type)
 * @param depth - Current recursion depth (internal use)
 * @returns Filtered data with sensitive fields replaced by '[REDACTED]'
 */
function filterSensitiveData(data: unknown, depth = 0): unknown {
  // Prevent infinite recursion (max depth check)
  if (depth > 5 || !data) return data;

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => filterSensitiveData(item, depth + 1));
  }

  // Handle objects
  if (typeof data === 'object' && data !== null) {
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const keyLower = key.toLowerCase();
      // Check if key contains sensitive keywords
      const isSensitive = SENSITIVE_KEYS.some(sensitiveKey =>
        keyLower.includes(sensitiveKey)
      );

      if (isSensitive) {
        filtered[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        filtered[key] = filterSensitiveData(value, depth + 1);
      } else {
        filtered[key] = value;
      }
    }
    return filtered;
  }

  return data;
}

/**
 * Logger context fields
 */
interface LoggerContext {
  traceId: string;
  userId?: string | null;
  requestId?: string | null;
}

// Current request context (set per invocation)
// ⚠️ Global state - see note above
let currentContext: LoggerContext = { traceId: 'no-trace' };

/**
 * Set context for current Lambda invocation
 */
export function setContext(ctx: Partial<LoggerContext>): void {
  if (!ctx || typeof ctx !== 'object') {
    throw new TypeError(`setContext expects an object, got ${typeof ctx}`);
  }
  currentContext = { ...currentContext, ...ctx };
}

/**
 * Lambda event with optional headers and body
 */
interface LambdaEvent {
  headers?: Record<string, string> | null;
  body?: string | Record<string, unknown> | null;
  requestContext?: {
    requestId?: string;
  };
}

/**
 * Get traceId from request headers or generate new one
 * Priority: x-trace-id header > x-trace-id (lowercase) > generate new
 */
export function getTraceId(event: LambdaEvent): string {
  // Try to get from headers (propagated from frontend)
  const headers = event?.headers || {};
  const traceId = headers['x-trace-id'] || headers['X-Trace-Id'];
  if (traceId) return traceId;

  // Generate new for this invocation
  // Format: lambda-{timestamp}-{random}
  return `lambda-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Initialize logger context from Lambda event
 * Call at the start of each handler
 */
export function initContext(event: LambdaEvent, explicitTraceId: string | null = null): LoggerContext {
  // Priority: explicit > header > generated
  const traceId = explicitTraceId || getTraceId(event);

  // Safely parse body (P0 fix: handle JSON parse errors)
  let body: Record<string, unknown> = {};
  try {
    body = typeof event.body === 'string'
      ? JSON.parse(event.body || '{}')
      : (event.body as Record<string, unknown>) || {};
  } catch (error) {
    // Log parse error to console, don't throw
    console.warn('Logger: Failed to parse event.body', {
      error: error instanceof Error ? error.message : String(error),
      bodyType: typeof event.body,
      bodyPreview: String(event.body).substring(0, 100),
    });
    body = {};
  }

  setContext({
    traceId,
    userId: (body.userId as string) || null,
    requestId: event.requestContext?.requestId || null,
  });

  return currentContext;
}

/**
 * Create structured log entry with automatic context and filtering
 *
 * Design decisions:
 * - JSON structure (not plain text): Enables CloudWatch Insights queries and log parsing
 *   (Can query: fields @timestamp | filter event = 'PRESIGN_STARTED' | stats count() by userId)
 * - ISO 8601 timestamps: Universal format, sortable, includes timezone
 *   (YYYY-MM-DDTHH:mm:ss.sssZ format works across all tools)
 * - Context fields always included: traceId, userId, requestId for correlation
 *   (Even if null, consistent structure makes querying easier)
 * - Spread user data last: Allows overriding context fields if needed (rare but useful)
 *   (e.g., logger.info('EVENT', { traceId: 'custom-trace' }) works)
 * - Filter before stringify: Prevents secrets from ever reaching JSON output
 *   (filterSensitiveData runs before JSON.stringify, ensuring [REDACTED] in logs)
 *
 * Trade-offs:
 * - All logs are JSON (not human-readable in raw form)
 *   Rationale: CloudWatch/jq handle JSON better; production logs prioritize machine parsing
 * - Context fields can't be removed (always present)
 *   Rationale: Consistency > flexibility; correlation depends on these fields
 * - No log size limits (can produce large entries)
 *   Rationale: Lambda has 6 MB response limit; logs rarely approach this
 *
 * Log structure:
 * {
 *   timestamp: "2026-01-28T10:30:45.123Z",  // ISO 8601 UTC
 *   level: "info" | "debug" | "warn" | "error",
 *   event: "PRESIGN_STARTED",               // Semantic event name
 *   traceId: "lambda-1234567890-abc123",    // Request correlation
 *   userId: "device-xxx" | "user-yyy" | null,
 *   requestId: "aws-request-id" | null,     // Lambda invocation ID
 *   ...userData                             // Filtered user-provided fields
 * }
 *
 * @param level - Log level (debug, info, warn, error)
 * @param event - Semantic event name (from EVENTS constant)
 * @param data - User-provided data to include in log entry
 * @returns JSON string ready for console output
 *
 * @example
 * createLogEntry('info', 'PRESIGN_STARTED', { userId: 'user-123', fileName: 'receipt.jpg' })
 * // → '{"timestamp":"2026-01-28T10:30:45.123Z","level":"info","event":"PRESIGN_STARTED",...}'
 */
function createLogEntry(level: LogLevel, event: EventName, data: Record<string, unknown> = {}): string {
  // Filter sensitive data from user-provided data (P1: security)
  const filteredData = filterSensitiveData(data) as Record<string, unknown>;

  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    traceId: currentContext.traceId,
    userId: currentContext.userId,
    requestId: currentContext.requestId,
    ...filteredData,
  });
}

/**
 * Extract error information from Error object or normalize arbitrary data
 *
 * Design decisions:
 * - Extract stack trace from Error objects: Essential for debugging Lambda failures
 *   (CloudWatch logs are only place to see errors; stack traces are critical)
 * - Preserve error.name property: Helps distinguish error types (TypeError, ValidationError, etc.)
 * - Wrap primitives in object: Ensures consistent JSON structure for all log entries
 *   (Avoids "error: 123" vs "error: {message: '...'}" inconsistency)
 * - Pass through plain objects unchanged: Respects caller's structure
 *
 * Trade-offs:
 * - Always includes stack traces (can be verbose)
 *   Rationale: Verbosity acceptable; debugging without stack traces is extremely difficult
 * - Doesn't sanitize Error properties (e.g., no filtering of custom props)
 *   Rationale: Error objects shouldn't contain secrets; filterSensitiveData() handles user data
 * - No error serialization for circular refs
 *   Rationale: Native Error objects don't have circular refs; custom errors should avoid them
 *
 * @param data - Error object, plain object, or primitive to normalize
 * @returns Object with error details or original data wrapped in object
 *
 * @example
 * normalizeErrorData(new Error('Failed')) // → { error: { message: '...', stack: '...', name: 'Error' } }
 * normalizeErrorData({ code: 404 })       // → { code: 404 }
 * normalizeErrorData('timeout')           // → { data: 'timeout' }
 */
function normalizeErrorData(data?: Error | Record<string, unknown>): Record<string, unknown> {
  if (!data) return {};

  // If it's an Error object, extract message and stack (P0 fix: preserve debugging info)
  if (data instanceof Error) {
    return {
      error: {
        message: data.message,
        stack: data.stack,
        name: data.name,
      },
    };
  }

  // If it's already an object, return as-is (respect caller's structure)
  return typeof data === 'object' ? data : { data };
}

/**
 * Logger with semantic events
 * All logs are automatically JSON-formatted with traceId, userId, requestId
 *
 * Features:
 * - Automatic Error stack extraction (P0)
 * - Sensitive data filtering (P1)
 * - Log level control via LOG_LEVEL env var (P1)
 * - Compile-time type safety for event names (TypeScript)
 */
export const logger = {
  /**
   * Log debug message (only if LOG_LEVEL=debug)
   */
  debug: (event: EventName, data?: Record<string, unknown>): void => {
    if (shouldLog('debug')) {
      console.debug(createLogEntry('debug', event, normalizeErrorData(data)));
    }
  },

  /**
   * Log info message (default minimum level)
   */
  info: (event: EventName, data?: Record<string, unknown>): void => {
    if (shouldLog('info')) {
      console.info(createLogEntry('info', event, normalizeErrorData(data)));
    }
  },

  /**
   * Log warning message
   */
  warn: (event: EventName, data?: Record<string, unknown>): void => {
    if (shouldLog('warn')) {
      console.warn(createLogEntry('warn', event, normalizeErrorData(data)));
    }
  },

  /**
   * Log error with automatic stack trace extraction
   */
  error: (event: EventName, data?: Error | Record<string, unknown>): void => {
    if (shouldLog('error')) {
      console.error(createLogEntry('error', event, normalizeErrorData(data)));
    }
  },
};

/**
 * Performance timer for measuring function execution time (P1: performance monitoring)
 */
interface Timer {
  duration: () => number;
  logDuration: (event: EventName, data?: Record<string, unknown>) => void;
  log: (level: LogLevel, event: EventName, data?: Record<string, unknown>) => void;
}

/**
 * Create a performance timer for measuring function execution time (P1: performance monitoring)
 */
export function createTimer(): Timer {
  const startTime = Date.now();

  return {
    /**
     * Get elapsed time in milliseconds
     */
    duration: (): number => Date.now() - startTime,

    /**
     * Log event with automatic duration calculation
     */
    logDuration: (event: EventName, data: Record<string, unknown> = {}): void => {
      logger.info(event, {
        duration: Date.now() - startTime,
        ...data,
      });
    },

    /**
     * Log with specific level and automatic duration
     */
    log: (level: LogLevel, event: EventName, data: Record<string, unknown> = {}): void => {
      const logFn = logger[level];
      if (logFn) {
        logFn(event, {
          duration: Date.now() - startTime,
          ...data,
        });
      }
    },
  };
}
