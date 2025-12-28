/**
 * Pillar R: Semantic Observability Template
 *
 * Logs must be machine-readable and describe state transitions.
 *
 * ⚠️ AI DEVELOPMENT NOTE:
 * - ALL logs must be JSON formatted
 * - Event names are semantic: NOUN_VERB (ORDER_CREATED, SAGA_FAILED)
 * - Always include traceId in every log
 * - Include intentId for T3 operations
 * - Log state transitions with from/to
 * - Never log PII (passwords, SSN, etc.)
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Log levels.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

/**
 * Base log entry structure.
 * All logs must conform to this interface.
 */
export interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly event: string;
  readonly traceId: string;
  readonly spanId?: string;
  readonly userId?: string;
  readonly [key: string]: unknown;
}

/**
 * Logger interface.
 */
export interface Logger {
  debug(event: string, data?: Record<string, unknown>): void;
  info(event: string, data?: Record<string, unknown>): void;
  warn(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
  critical(event: string, data?: Record<string, unknown>): void;
}

/**
 * Context provider interface.
 * Implement to provide traceId, userId, etc.
 */
export interface ContextProvider {
  getOptional(): { traceId: string; spanId?: string; userId?: string } | null;
}

// =============================================================================
// SEMANTIC EVENT NAMES
// =============================================================================

/**
 * Standard event name patterns.
 *
 * ⚠️ AI NOTE: Always use NOUN_VERB format.
 * This enables machine parsing and alerting.
 */
export const EVENT_NAMES = {
  // Entity lifecycle
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_UPDATED: 'ORDER_UPDATED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGGED_IN: 'USER_LOGGED_IN',
  PAYMENT_PROCESSED: 'PAYMENT_PROCESSED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',

  // State transitions
  STATE_TRANSITION: 'STATE_TRANSITION',

  // Saga events
  SAGA_STARTED: 'SAGA_STARTED',
  SAGA_STEP_STARTED: 'SAGA_STEP_STARTED',
  SAGA_STEP_COMPLETED: 'SAGA_STEP_COMPLETED',
  SAGA_COMPLETED: 'SAGA_COMPLETED',
  SAGA_FAILED: 'SAGA_FAILED',
  COMPENSATION_STARTED: 'COMPENSATION_STARTED',
  COMPENSATION_COMPLETED: 'COMPENSATION_COMPLETED',
  COMPENSATION_FAILED: 'COMPENSATION_FAILED',

  // System events
  CIRCUIT_OPENED: 'CIRCUIT_OPENED',
  CIRCUIT_CLOSED: 'CIRCUIT_CLOSED',
  CACHE_HIT: 'CACHE_HIT',
  CACHE_MISS: 'CACHE_MISS',

  // Errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  AUTHORIZATION_DENIED: 'AUTHORIZATION_DENIED',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

export type EventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];

// =============================================================================
// LOGGER IMPLEMENTATION
// =============================================================================

/**
 * Create a semantic logger.
 *
 * @example
 * ```typescript
 * const logger = createLogger(contextStore);
 *
 * logger.info('ORDER_CREATED', {
 *   orderId: order.id,
 *   userId: order.userId,
 *   total: order.total,
 * });
 * ```
 */
export function createLogger(contextProvider?: ContextProvider): Logger {
  const log = (
    level: LogLevel,
    event: string,
    data: Record<string, unknown> = {}
  ): void => {
    const ctx = contextProvider?.getOptional();

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      traceId: ctx?.traceId ?? 'no-trace',
      spanId: ctx?.spanId,
      userId: ctx?.userId,
      ...data,
    };

    // Output as JSON (single line for log aggregators)
    const output = JSON.stringify(entry);

    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
      case 'critical':
        console.error(output);
        break;
    }
  };

  return {
    debug: (event, data) => log('debug', event, data),
    info: (event, data) => log('info', event, data),
    warn: (event, data) => log('warn', event, data),
    error: (event, data) => log('error', event, data),
    critical: (event, data) => log('critical', event, data),
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Log a state transition.
 *
 * @example
 * ```typescript
 * logStateTransition(logger, {
 *   entity: 'Order',
 *   entityId: order.id,
 *   from: 'pending',
 *   to: 'confirmed',
 * });
 * ```
 */
export function logStateTransition(
  logger: Logger,
  params: {
    entity: string;
    entityId: string;
    from: string;
    to: string;
    [key: string]: unknown;
  }
): void {
  const { entity, entityId, from, to, ...rest } = params;
  logger.info('STATE_TRANSITION', {
    entity,
    entityId,
    from,
    to,
    ...rest,
  });
}

/**
 * Log saga lifecycle events.
 *
 * @example
 * ```typescript
 * const sagaLogger = createSagaLogger(logger, 'Checkout', cmd.intentId);
 * sagaLogger.started({ orderId: cmd.orderId });
 * sagaLogger.stepStarted('RESERVE_INVENTORY');
 * sagaLogger.stepCompleted('RESERVE_INVENTORY', { reservationId });
 * sagaLogger.completed({ duration: 1234 });
 * ```
 */
export function createSagaLogger(
  logger: Logger,
  sagaName: string,
  intentId: string
) {
  const startTime = Date.now();

  return {
    started(data?: Record<string, unknown>): void {
      logger.info('SAGA_STARTED', {
        saga: sagaName,
        intentId,
        ...data,
      });
    },

    stepStarted(step: string, data?: Record<string, unknown>): void {
      logger.info('SAGA_STEP_STARTED', {
        saga: sagaName,
        step,
        intentId,
        ...data,
      });
    },

    stepCompleted(step: string, data?: Record<string, unknown>): void {
      logger.info('SAGA_STEP_COMPLETED', {
        saga: sagaName,
        step,
        intentId,
        ...data,
      });
    },

    completed(data?: Record<string, unknown>): void {
      logger.info('SAGA_COMPLETED', {
        saga: sagaName,
        intentId,
        duration: Date.now() - startTime,
        result: 'success',
        ...data,
      });
    },

    failed(step: string, error: Error, data?: Record<string, unknown>): void {
      logger.error('SAGA_FAILED', {
        saga: sagaName,
        step,
        intentId,
        duration: Date.now() - startTime,
        errorType: error.constructor.name,
        errorMessage: error.message,
        ...data,
      });
    },

    compensationStarted(stepsToCompensate: number): void {
      logger.info('COMPENSATION_STARTED', {
        saga: sagaName,
        intentId,
        stepsToCompensate,
      });
    },

    compensationCompleted(): void {
      logger.info('COMPENSATION_COMPLETED', {
        saga: sagaName,
        intentId,
        duration: Date.now() - startTime,
      });
    },

    compensationFailed(
      step: string,
      error: Error,
      data?: Record<string, unknown>
    ): void {
      logger.critical('COMPENSATION_FAILED', {
        saga: sagaName,
        step,
        intentId,
        errorType: error.constructor.name,
        errorMessage: error.message,
        requiresManualIntervention: true,
        ...data,
      });
    },
  };
}

/**
 * Log external service errors with full context.
 *
 * @example
 * ```typescript
 * logExternalError(logger, {
 *   service: 'stripe',
 *   operation: 'charge',
 *   error: stripeError,
 *   requestId: stripeRequestId,
 *   retryable: true,
 * });
 * ```
 */
export function logExternalError(
  logger: Logger,
  params: {
    service: string;
    operation: string;
    error: Error & { code?: string; type?: string };
    requestId?: string;
    retryable?: boolean;
    [key: string]: unknown;
  }
): void {
  const { service, operation, error, requestId, retryable, ...rest } = params;
  logger.error('EXTERNAL_SERVICE_ERROR', {
    service,
    operation,
    requestId,
    errorCode: error.code,
    errorType: error.type ?? error.constructor.name,
    errorMessage: error.message,
    retryable: retryable ?? false,
    ...rest,
  });
}

// =============================================================================
// SENSITIVE DATA FILTER
// =============================================================================

/**
 * Fields that should never be logged.
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'ssn',
  'creditCard',
  'credit_card',
  'cardNumber',
  'card_number',
  'cvv',
  'pin',
]);

/**
 * Redact sensitive fields from an object.
 *
 * @example
 * ```typescript
 * const safeData = redactSensitive({
 *   userId: 'user_123',
 *   password: 'secret123',  // Will be redacted
 * });
 * // { userId: 'user_123', password: '[REDACTED]' }
 * ```
 */
export function redactSensitive<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };

  for (const key of Object.keys(result)) {
    if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
      (result as Record<string, unknown>)[key] = '[REDACTED]';
    } else if (typeof result[key] === 'object' && result[key] !== null) {
      (result as Record<string, unknown>)[key] = redactSensitive(
        result[key] as Record<string, unknown>
      );
    }
  }

  return result;
}

/**
 * Create a logger that automatically redacts sensitive data.
 */
export function createSafeLogger(contextProvider?: ContextProvider): Logger {
  const baseLogger = createLogger(contextProvider);

  const safeLog =
    (method: keyof Logger) =>
    (event: string, data?: Record<string, unknown>) => {
      baseLogger[method](event, data ? redactSensitive(data) : undefined);
    };

  return {
    debug: safeLog('debug'),
    info: safeLog('info'),
    warn: safeLog('warn'),
    error: safeLog('error'),
    critical: safeLog('critical'),
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  createLogger as createSemanticLogger,
  createSafeLogger as createRedactingLogger,
};
