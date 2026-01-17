/**
 * Pillar R: Semantic Logger for Lambda Functions
 * All logs are JSON-formatted with traceId for observability
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
let currentContext = { traceId: 'no-trace' };

/**
 * Set context for current Lambda invocation
 * @param {object} ctx - { traceId, userId, ... }
 */
export function setContext(ctx) {
  currentContext = { ...currentContext, ...ctx };
}

/**
 * Get current traceId from request headers or generate new
 * @param {object} event - Lambda event
 * @returns {string} traceId
 */
export function getTraceId(event) {
  // Try to get from headers (propagated from frontend)
  const headers = event?.headers || {};
  const traceId = headers['x-trace-id'] || headers['X-Trace-Id'];
  if (traceId) return traceId;

  // Generate new for this invocation
  return `lambda-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Initialize logger context from Lambda event
 * Call at the start of each handler
 * @param {object} event - Lambda event
 * @param {string|null} explicitTraceId - Optional explicit traceId (e.g., from S3 metadata)
 */
export function initContext(event, explicitTraceId = null) {
  // Priority: explicit > header > generated
  const traceId = explicitTraceId || getTraceId(event);
  const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body || {};

  setContext({
    traceId,
    userId: body.userId || null,
    requestId: event.requestContext?.requestId || null,
  });

  return currentContext;
}

/**
 * Create log entry
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
 * Logger with semantic events
 */
export const logger = {
  debug: (event, data) => console.debug(createLogEntry('debug', event, data)),
  info: (event, data) => console.info(createLogEntry('info', event, data)),
  warn: (event, data) => console.warn(createLogEntry('warn', event, data)),
  error: (event, data) => console.error(createLogEntry('error', event, data)),
};
