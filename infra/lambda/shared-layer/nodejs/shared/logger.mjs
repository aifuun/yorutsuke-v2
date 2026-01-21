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

  // P2: Presign
  PRESIGN_STARTED: 'PRESIGN_STARTED',
  PRESIGN_COMPLETED: 'PRESIGN_COMPLETED',
  PRESIGN_FAILED: 'PRESIGN_FAILED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  EMERGENCY_STOP: 'EMERGENCY_STOP',

  // P2: Quota
  QUOTA_CHECKED: 'QUOTA_CHECKED',
  QUOTA_CHECK_FAILED: 'QUOTA_CHECK_FAILED',

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
};

/**
 * Log levels with numeric precedence
 * @constant
 */
export const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Get current log level from environment (P1: log level control)
 * @returns {string} Log level: 'debug', 'info', 'warn', or 'error'
 */
function getLogLevel() {
  const level = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return LOG_LEVELS[level] !== undefined ? level : 'info';
}

/**
 * Check if a log should be output based on level (P1: log level control)
 * @param {string} level - Log level to check
 * @returns {boolean} True if log should be output
 * @private
 */
function shouldLog(level) {
  const currentLevel = getLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

/**
 * Keys that indicate sensitive data (P1: sensitive data filtering)
 * @constant
 * @private
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
 * @param {unknown} data - Data to filter
 * @param {number} depth - Current recursion depth (max 5)
 * @returns {unknown} Filtered data
 * @private
 */
function filterSensitiveData(data, depth = 0) {
  // Prevent infinite recursion
  if (depth > 5 || !data) return data;

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => filterSensitiveData(item, depth + 1));
  }

  // Handle objects
  if (typeof data === 'object' && data !== null) {
    const filtered = {};
    for (const [key, value] of Object.entries(data)) {
      const keyLower = key.toLowerCase();
      // Check if key contains sensitive keywords
      const isSensitive = SENSITIVE_KEYS.some(sensitiveKey =>
        keyLower.includes(sensitiveKey)
      );

      if (isSensitive) {
        filtered[key] = '[REDACTED]';  // Hide sensitive values
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

// Current request context (set per invocation)
// ⚠️ Global state - see note above
let currentContext = { traceId: 'no-trace' };

/**
 * Set context for current Lambda invocation
 * @param {object} ctx - Context fields to merge (e.g., { traceId, userId, requestId })
 * @returns {void}
 * @throws {TypeError} If ctx is not an object
 */
export function setContext(ctx) {
  if (!ctx || typeof ctx !== 'object') {
    throw new TypeError(`setContext expects an object, got ${typeof ctx}`);
  }
  currentContext = { ...currentContext, ...ctx };
}

/**
 * Get traceId from request headers or generate new one
 * Priority: x-trace-id header > x-trace-id (lowercase) > generate new
 *
 * @param {object} event - Lambda event object
 * @returns {string} Trace ID in format: "lambda-{timestamp}-{random}" or from headers
 * @example
 * const traceId = getTraceId(event);
 * // Returns: "lambda-1768973230100-abc123" or "trace-xxx" (if from header)
 */
export function getTraceId(event) {
  // Try to get from headers (propagated from frontend)
  const headers = event?.headers || {};
  const traceId = headers['x-trace-id'] || headers['X-Trace-Id'];
  if (traceId) return traceId;

  // Generate new for this invocation
  // Format: lambda-{timestamp}-{random}
  // Example: lambda-1768973230100-a1b2c3d4
  return `lambda-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Initialize logger context from Lambda event
 * Call at the start of each handler
 * @param {object} event - Lambda event
 * @param {string|null} explicitTraceId - Optional explicit traceId (e.g., from S3 metadata)
 * @returns {object} Updated context
 * @throws {Error} Only if event structure is fundamentally broken
 */
export function initContext(event, explicitTraceId = null) {
  // Priority: explicit > header > generated
  const traceId = explicitTraceId || getTraceId(event);

  // Safely parse body (P0 fix: handle JSON parse errors)
  let body = {};
  try {
    body = typeof event.body === 'string'
      ? JSON.parse(event.body || '{}')
      : event.body || {};
  } catch (error) {
    // Log parse error to console, don't throw
    console.warn('Logger: Failed to parse event.body', {
      error: error.message,
      bodyType: typeof event.body,
      bodyPreview: String(event.body).substring(0, 100),
    });
    body = {};
  }

  setContext({
    traceId,
    userId: body.userId || null,
    requestId: event.requestContext?.requestId || null,
  });

  return currentContext;
}

/**
 * Create structured log entry with filtering (P1: sensitive data filtering)
 * @param {string} level - Log level (debug, info, warn, error)
 * @param {string} event - Semantic event name
 * @param {object} data - Additional data
 * @returns {string} JSON-formatted log entry
 * @private
 */
function createLogEntry(level, event, data = {}) {
  // Filter sensitive data from user-provided data
  const filteredData = filterSensitiveData(data);

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
 * Extract error information from Error object or use as-is
 * @param {Error|object} data - Error object or data object
 * @returns {object} Normalized data with error fields if Error
 * @private
 */
function normalizeErrorData(data) {
  if (!data) return {};

  // If it's an Error object, extract message and stack (P0 fix)
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
 * Logger with semantic events
 * All logs are automatically JSON-formatted with traceId, userId, requestId
 *
 * Features:
 * - Automatic Error stack extraction (P0)
 * - Sensitive data filtering (P1)
 * - Log level control via LOG_LEVEL env var (P1)
 *
 * @example
 * logger.info('TRANSACTION_CREATED', { txId: 'tx-123', amount: 1000 });
 * // Outputs: {"timestamp":"...","level":"info","event":"TRANSACTION_CREATED","traceId":"trace-xxx",...}
 *
 * @example
 * try {
 *   await processImage();
 * } catch (error) {
 *   logger.error('PROCESSING_FAILED', error);  // Error stack auto-extracted
 * }
 *
 * @example
 * // Sensitive data is auto-filtered
 * logger.info('AUTH', { password: 'secret123', username: 'user' });
 * // Output: {...,"password":"[REDACTED]","username":"user"}
 *
 * @example
 * // Control log level with env var
 * process.env.LOG_LEVEL = 'warn';  // Only WARN and ERROR logs output
 */
export const logger = {
  /**
   * Log debug message (only if LOG_LEVEL=debug)
   * @param {string} event - Semantic event name
   * @param {object} [data] - Additional data (sensitive fields auto-filtered)
   */
  debug: (event, data) => {
    if (shouldLog('debug')) {
      console.debug(createLogEntry('debug', event, normalizeErrorData(data)));
    }
  },

  /**
   * Log info message (default minimum level)
   * @param {string} event - Semantic event name
   * @param {object} [data] - Additional data (sensitive fields auto-filtered)
   */
  info: (event, data) => {
    if (shouldLog('info')) {
      console.info(createLogEntry('info', event, normalizeErrorData(data)));
    }
  },

  /**
   * Log warning message
   * @param {string} event - Semantic event name
   * @param {object} [data] - Additional data (sensitive fields auto-filtered)
   */
  warn: (event, data) => {
    if (shouldLog('warn')) {
      console.warn(createLogEntry('warn', event, normalizeErrorData(data)));
    }
  },

  /**
   * Log error with automatic stack trace extraction
   * @param {string} event - Semantic event name
   * @param {Error|object} [data] - Error object or data object (sensitive fields auto-filtered)
   */
  error: (event, data) => {
    if (shouldLog('error')) {
      console.error(createLogEntry('error', event, normalizeErrorData(data)));
    }
  },
};

/**
 * Create a performance timer for measuring function execution time (P1: performance monitoring)
 * @returns {object} Timer object with duration() and logDuration() methods
 *
 * @example
 * const timer = createTimer();
 * await processLargeFile();
 * timer.logDuration('FILE_PROCESSING_COMPLETED', { fileSize: 1024000 });
 * // Logs with automatic duration field
 *
 * @example
 * const timer = createTimer();
 * const halfway = timer.duration();  // Get current duration without logging
 * logger.info('MIDPOINT_REACHED', { elapsed: halfway });
 */
export function createTimer() {
  const startTime = Date.now();

  return {
    /**
     * Get elapsed time in milliseconds
     * @returns {number} Elapsed milliseconds
     */
    duration: () => Date.now() - startTime,

    /**
     * Log event with automatic duration calculation
     * @param {string} event - Semantic event name
     * @param {object} [data] - Additional data
     */
    logDuration: (event, data = {}) => {
      logger.info(event, {
        duration: Date.now() - startTime,
        ...data,
      });
    },

    /**
     * Log with specific level and automatic duration
     * @param {string} level - Log level (debug, info, warn, error)
     * @param {string} event - Semantic event name
     * @param {object} [data] - Additional data
     */
    log: (level, event, data = {}) => {
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
