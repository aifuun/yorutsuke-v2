// Centralized error scenarios for "offline" mode (network failures, timeouts, server errors)
// Pillar C: Consistent error generation for testing error handling
//
// Usage: if (isMockingOffline()) throw mockNetworkError();

/**
 * Standard network error (connection refused, DNS failure, etc.)
 * Use this to simulate complete network failure
 */
export function mockNetworkError(operation?: string): Error {
  const message = operation
    ? `Network error: offline mode (${operation})`
    : 'Network error: offline mode';
  return new Error(message);
}

/**
 * Timeout error for long-running operations
 * Use this to simulate slow network or server timeout
 */
export function mockTimeoutError(operation: string, timeoutMs: number = 5000): Error {
  return new Error(`Timeout error: ${operation} exceeded ${timeoutMs}ms`);
}

/**
 * Server error (500, 502, 503, 504)
 * Use this to simulate server-side failures
 */
export function mockServerError(statusCode: number = 500, detail?: string): Error {
  const message = detail
    ? `Server error: ${statusCode} - ${detail}`
    : `Server error: ${statusCode}`;
  const error = new Error(message);
  (error as any).status = statusCode;
  return error;
}

/**
 * Authentication error (401, 403)
 * Use this to simulate auth failures
 */
export function mockAuthError(statusCode: 401 | 403 = 403): Error {
  const message = statusCode === 401
    ? 'Authentication required'
    : 'Forbidden: insufficient permissions';
  const error = new Error(message);
  (error as any).status = statusCode;
  return error;
}

/**
 * Rate limit error (429)
 * Use this to simulate quota/rate limit exceeded
 */
export function mockRateLimitError(retryAfter?: number): Error {
  const message = retryAfter
    ? `Rate limit exceeded. Retry after ${retryAfter}s`
    : 'Rate limit exceeded';
  const error = new Error(message);
  (error as any).status = 429;
  (error as any).retryAfter = retryAfter;
  return error;
}

/**
 * Validation error (400)
 * Use this to simulate invalid request parameters
 */
export function mockValidationError(field: string, reason: string): Error {
  const error = new Error(`Validation error: ${field} - ${reason}`);
  (error as any).status = 400;
  return error;
}

/**
 * Resource not found error (404)
 * Use this to simulate missing resources
 */
export function mockNotFoundError(resource: string, id?: string): Error {
  const message = id
    ? `Not found: ${resource} with id ${id}`
    : `Not found: ${resource}`;
  const error = new Error(message);
  (error as any).status = 404;
  return error;
}
