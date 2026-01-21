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
};

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
 * Create structured log entry
 * @param {string} level - Log level (debug, info, warn, error)
 * @param {string} event - Semantic event name
 * @param {object} data - Additional data
 * @returns {string} JSON-formatted log entry
 * @private
 */
function createLogEntry(level, event, data = {}) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    traceId: currentContext.traceId,
    userId: currentContext.userId,
    requestId: currentContext.requestId,
    ...data,
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
 * @example
 * logger.info('TRANSACTION_CREATED', { txId: 'tx-123', amount: 1000 });
 * // Outputs: {"timestamp":"...","level":"info","event":"TRANSACTION_CREATED","traceId":"trace-xxx","userId":"user-123",...}
 *
 * @example
 * try {
 *   await processImage();
 * } catch (error) {
 *   logger.error('PROCESSING_FAILED', error);  // Error stack auto-extracted
 * }
 */
export const logger = {
  /**
   * @param {string} event - Semantic event name
   * @param {object} [data] - Additional data
   */
  debug: (event, data) => console.debug(createLogEntry('debug', event, normalizeErrorData(data))),

  /**
   * @param {string} event - Semantic event name
   * @param {object} [data] - Additional data
   */
  info: (event, data) => console.info(createLogEntry('info', event, normalizeErrorData(data))),

  /**
   * @param {string} event - Semantic event name
   * @param {object} [data] - Additional data
   */
  warn: (event, data) => console.warn(createLogEntry('warn', event, normalizeErrorData(data))),

  /**
   * Log error with automatic stack trace extraction
   * @param {string} event - Semantic event name
   * @param {Error|object} [data] - Error object or data object
   */
  error: (event, data) => console.error(createLogEntry('error', event, normalizeErrorData(data))),
};
