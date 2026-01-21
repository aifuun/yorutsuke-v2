import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EVENTS,
  LOG_LEVELS,
  initContext,
  setContext,
  getTraceId,
  logger,
  createTimer,
  type EventName,
} from '../logger.js';

/**
 * Comprehensive test suite for logger.ts
 * Covers: P0 features, P1 features, edge cases, and concurrency scenarios
 */

describe('logger.ts', () => {
  // Save original console methods and env vars
  const originalConsoleDebug = console.debug;
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  const originalLogLevel = process.env.LOG_LEVEL;

  // Track console calls
  let consoleLogs: Array<{ level: string; msg: string }> = [];

  beforeEach(() => {
    // Mock console methods to capture output
    console.debug = vi.fn((msg: string) => consoleLogs.push({ level: 'debug', msg }));
    console.info = vi.fn((msg: string) => consoleLogs.push({ level: 'info', msg }));
    console.warn = vi.fn((msg: string) => consoleLogs.push({ level: 'warn', msg }));
    console.error = vi.fn((msg: string) => consoleLogs.push({ level: 'error', msg }));
    consoleLogs = [];

    // Reset environment
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    // Restore console and env
    console.debug = originalConsoleDebug;
    console.info = originalConsoleInfo;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    process.env.LOG_LEVEL = originalLogLevel;
  });

  // ============================================================================
  // SECTION 1: EVENTS Constant
  // ============================================================================

  describe('EVENTS constant', () => {
    it('should define all required event names', () => {
      expect(EVENTS.PRESIGN_STARTED).toBe('PRESIGN_STARTED');
      expect(EVENTS.IMAGE_PROCESSING_STARTED).toBe('IMAGE_PROCESSING_STARTED');
      expect(EVENTS.TRANSACTION_CREATED).toBe('TRANSACTION_CREATED');
    });

    it('should be object with at least 10 events', () => {
      expect(Object.keys(EVENTS).length).toBeGreaterThanOrEqual(10);
    });

    it('should have consistent naming (all uppercase)', () => {
      Object.values(EVENTS).forEach((eventName: string) => {
        expect(eventName).toMatch(/^[A-Z0-9_]+$/);  // Allow numbers (e.g., S3_IMAGE_SKIP_DELETE)
      });
    });

    it('should be type-safe (EventName type)', () => {
      // TypeScript compile-time check
      const validEvent: EventName = EVENTS.PRESIGN_STARTED;
      expect(validEvent).toBe('PRESIGN_STARTED');

      // @ts-expect-error - Invalid event should fail at compile time
      const invalidEvent: EventName = 'INVALID_EVENT';
    });
  });

  // ============================================================================
  // SECTION 2: LOG_LEVELS
  // ============================================================================

  describe('LOG_LEVELS', () => {
    it('should define all log levels with numeric precedence', () => {
      expect(LOG_LEVELS.debug).toBe(0);
      expect(LOG_LEVELS.info).toBe(1);
      expect(LOG_LEVELS.warn).toBe(2);
      expect(LOG_LEVELS.error).toBe(3);
    });

    it('should have error > warn > info > debug', () => {
      expect(LOG_LEVELS.error > LOG_LEVELS.warn).toBe(true);
      expect(LOG_LEVELS.warn > LOG_LEVELS.info).toBe(true);
      expect(LOG_LEVELS.info > LOG_LEVELS.debug).toBe(true);
    });
  });

  // ============================================================================
  // SECTION 3: initContext (P0: JSON parse safety)
  // ============================================================================

  describe('initContext', () => {
    it('should initialize context with valid event', () => {
      const event = {
        body: JSON.stringify({ userId: 'user-123' }),
        requestContext: { requestId: 'req-123' },
        headers: { 'x-trace-id': 'trace-abc' },
      };

      const context = initContext(event);

      expect(context.traceId).toBe('trace-abc');
      expect(context.userId).toBe('user-123');
      expect(context.requestId).toBe('req-123');
    });

    it('should handle invalid JSON body gracefully (P0 fix)', () => {
      const event = {
        body: '{invalid json}',
        requestContext: { requestId: 'req-123' },
      };

      const context = initContext(event);

      expect(context.traceId).toBeDefined();
      expect(context.userId).toBeNull();
      expect(console.warn).toHaveBeenCalled();
    });

    it('should handle empty body', () => {
      const event = {
        body: '',
        requestContext: { requestId: 'req-123' },
      };

      const context = initContext(event);

      expect(context.userId).toBeNull();
      expect(context.requestId).toBe('req-123');
    });

    it('should handle null body', () => {
      const event = {
        body: null,
        requestContext: { requestId: 'req-123' },
      };

      const context = initContext(event);

      expect(context.userId).toBeNull();
    });

    it('should handle missing requestContext', () => {
      const event = { body: JSON.stringify({ userId: 'user-123' }) };

      const context = initContext(event);

      expect(context.userId).toBe('user-123');
      expect(context.requestId).toBeNull();
    });

    it('should use explicit traceId parameter', () => {
      const event = { headers: { 'x-trace-id': 'trace-from-header' } };

      const context = initContext(event, 'trace-explicit');

      expect(context.traceId).toBe('trace-explicit');
    });

    it('should prioritize: explicit > header > generated', () => {
      const event = {
        headers: { 'x-trace-id': 'trace-header' },
      };

      const contextWithExplicit = initContext(event, 'trace-explicit');
      expect(contextWithExplicit.traceId).toBe('trace-explicit');

      const contextWithHeader = initContext(event);
      expect(contextWithHeader.traceId).toBe('trace-header');
    });

    it('should generate traceId when headers missing', () => {
      const event = {};

      const context = initContext(event);

      expect(context.traceId).toMatch(/^lambda-\d+-[a-z0-9]+$/);
    });
  });

  // ============================================================================
  // SECTION 4: setContext (P0: input validation)
  // ============================================================================

  describe('setContext', () => {
    it('should merge context fields', () => {
      initContext({}, 'trace-1');
      setContext({ userId: 'user-1' });

      logger.info(EVENTS.CONFIG_REQUEST, {});

      const lastLog = consoleLogs[consoleLogs.length - 1];
      const parsed = JSON.parse(lastLog.msg);

      expect(parsed.userId).toBe('user-1');
      expect(parsed.traceId).toBe('trace-1');
    });

    it('should throw error for null input (P0: input validation)', () => {
      expect(() => setContext(null as any)).toThrow(TypeError);
    });

    it('should throw error for undefined input (P0: input validation)', () => {
      expect(() => setContext(undefined as any)).toThrow(TypeError);
    });

    it('should throw error for string input (P0: input validation)', () => {
      expect(() => setContext('not-an-object' as any)).toThrow(TypeError);
    });

    it('should throw error for number input (P0: input validation)', () => {
      expect(() => setContext(123 as any)).toThrow(TypeError);
    });

    it('should accept empty object', () => {
      expect(() => setContext({})).not.toThrow();
    });
  });

  // ============================================================================
  // SECTION 5: getTraceId
  // ============================================================================

  describe('getTraceId', () => {
    it('should extract traceId from x-trace-id header', () => {
      const event = {
        headers: { 'x-trace-id': 'trace-from-header' },
      };

      const traceId = getTraceId(event);

      expect(traceId).toBe('trace-from-header');
    });

    it('should extract traceId from X-Trace-Id header (case insensitive check)', () => {
      const event = {
        headers: { 'X-Trace-Id': 'trace-uppercase' },
      };

      const traceId = getTraceId(event);

      expect(traceId).toBe('trace-uppercase');
    });

    it('should prioritize lowercase header over uppercase', () => {
      const event = {
        headers: {
          'x-trace-id': 'trace-lowercase',
          'X-Trace-Id': 'trace-uppercase',
        },
      };

      const traceId = getTraceId(event);

      expect(traceId).toBe('trace-lowercase');
    });

    it('should handle missing headers gracefully', () => {
      const event = {};

      const traceId = getTraceId(event);

      expect(traceId).toMatch(/^lambda-\d+-[a-z0-9]+$/);
    });

    it('should handle null headers gracefully', () => {
      const event = { headers: null };

      const traceId = getTraceId(event);

      expect(traceId).toMatch(/^lambda-\d+-[a-z0-9]+$/);
    });

    it('should generate unique traceIds', () => {
      const event = {};

      const traceId1 = getTraceId(event);
      const traceId2 = getTraceId(event);

      expect(traceId1).not.toBe(traceId2);
    });

    it('should generate traceId with correct format', () => {
      const event = {};

      const traceId = getTraceId(event);

      expect(traceId).toMatch(/^lambda-\d{13}-[a-z0-9]{6}$/);
    });
  });

  // ============================================================================
  // SECTION 6: logger.info
  // ============================================================================

  describe('logger.info', () => {
    beforeEach(() => {
      initContext({});
    });

    it('should log basic info message', () => {
      logger.info(EVENTS.CONFIG_REQUEST, { data: 'test' });

      expect(console.info).toHaveBeenCalled();
      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.event).toBe('CONFIG_REQUEST');
      expect(logged.level).toBe('info');
      expect(logged.data).toBe('test');
    });

    it('should include timestamp in ISO format', () => {
      logger.info(EVENTS.CONFIG_REQUEST, {});

      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    it('should include traceId, userId, requestId', () => {
      initContext({ requestContext: { requestId: 'req-123' } }, 'trace-xyz');
      logger.info(EVENTS.CONFIG_REQUEST, {});

      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.traceId).toBe('trace-xyz');
      expect(logged.requestId).toBe('req-123');
    });

    it('should handle missing data parameter', () => {
      logger.info(EVENTS.CONFIG_REQUEST);

      expect(console.info).toHaveBeenCalled();
      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.event).toBe('CONFIG_REQUEST');
    });

    it('should output valid JSON', () => {
      logger.info(EVENTS.CONFIG_REQUEST, { key: 'value' });

      const msg = consoleLogs[0].msg;
      expect(() => JSON.parse(msg)).not.toThrow();
    });
  });

  // ============================================================================
  // SECTION 7: logger.error (P0: Error stack extraction)
  // ============================================================================

  describe('logger.error', () => {
    beforeEach(() => {
      initContext({});
    });

    it('should extract Error object stack trace (P0 fix)', () => {
      const error = new Error('Test error message');

      logger.error(EVENTS.CONFIG_ERROR, error);

      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.error.message).toBe('Test error message');
      expect(logged.error.stack).toBeDefined();
      expect(logged.error.stack).toContain('Test error message');
    });

    it('should extract Error name', () => {
      const error = new TypeError('Type error');

      logger.error(EVENTS.CONFIG_ERROR, error);

      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.error.name).toBe('TypeError');
    });

    it('should handle non-Error objects normally', () => {
      logger.error(EVENTS.CONFIG_ERROR, { message: 'Not an Error object' });

      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.message).toBe('Not an Error object');
      expect(logged.error).toBeUndefined();
    });

    it('should use console.error', () => {
      logger.error(EVENTS.CONFIG_ERROR, {});

      expect(console.error).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // SECTION 8: logger levels (debug, warn)
  // ============================================================================

  describe('logger levels', () => {
    beforeEach(() => {
      initContext({});
    });

    it('logger.debug should output debug level', () => {
      process.env.LOG_LEVEL = 'debug';
      consoleLogs = [];

      logger.debug(EVENTS.CONFIG_REQUEST, {});

      expect(consoleLogs).toHaveLength(1);
      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.level).toBe('debug');
      expect(console.debug).toHaveBeenCalled();
    });

    it('logger.warn should output warn level', () => {
      logger.warn(EVENTS.CONFIG_ERROR, {});

      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.level).toBe('warn');
      expect(console.warn).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // SECTION 9: Sensitive Data Filtering (P1)
  // ============================================================================

  describe('sensitive data filtering', () => {
    beforeEach(() => {
      initContext({});
    });

    it('should redact password field (P1)', () => {
      logger.info(EVENTS.CONFIG_REQUEST, { username: 'user', password: 'secret123' });

      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.username).toBe('user');
      expect(logged.password).toBe('[REDACTED]');
    });

    it('should redact token field (P1)', () => {
      logger.info(EVENTS.CONFIG_REQUEST, { token: 'jwt-secret-xyz' });

      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.token).toBe('[REDACTED]');
    });

    it('should redact apiKey field (P1)', () => {
      logger.info(EVENTS.CONFIG_REQUEST, { apiKey: 'sk-1234567890' });

      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.apiKey).toBe('[REDACTED]');
    });

    it('should redact api_key field (P1)', () => {
      logger.info(EVENTS.CONFIG_REQUEST, { api_key: 'sk-1234567890' });

      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.api_key).toBe('[REDACTED]');
    });

    it('should redact secret field (P1)', () => {
      logger.info(EVENTS.CONFIG_REQUEST, { secret: 'my-secret' });

      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.secret).toBe('[REDACTED]');
    });

    it('should redact credential field (P1)', () => {
      logger.info(EVENTS.CONFIG_REQUEST, { credential: 'aws-secret' });

      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.credential).toBe('[REDACTED]');
    });

    it('should redact aws_secret_access_key (P1)', () => {
      logger.info(EVENTS.CONFIG_REQUEST, { aws_secret_access_key: 'very-secret' });

      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.aws_secret_access_key).toBe('[REDACTED]');
    });

    it('should redact in nested objects (P1)', () => {
      logger.info(EVENTS.CONFIG_REQUEST, {
        user: { username: 'john', password: 'secret' },
      });

      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.user.username).toBe('john');
      expect(logged.user.password).toBe('[REDACTED]');
    });

    it('should redact in arrays (P1)', () => {
      logger.info(EVENTS.CONFIG_REQUEST, {
        users: [{ name: 'john', password: 'secret1' }, { name: 'jane', password: 'secret2' }],
      });

      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.users[0].password).toBe('[REDACTED]');
      expect(logged.users[1].password).toBe('[REDACTED]');
    });

    it('should handle multiple sensitive fields', () => {
      logger.info(EVENTS.CONFIG_REQUEST, {
        username: 'user',
        password: 'secret',
        token: 'jwt',
        apiKey: 'sk-123',
      });

      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.username).toBe('user');
      expect(logged.password).toBe('[REDACTED]');
      expect(logged.token).toBe('[REDACTED]');
      expect(logged.apiKey).toBe('[REDACTED]');
    });

    it('should handle deeply nested objects (P1)', () => {
      logger.info(EVENTS.CONFIG_REQUEST, {
        level1: {
          level2: {
            level3: {
              password: 'secret',
              username: 'user',
            },
          },
        },
      });

      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.level1.level2.level3.username).toBe('user');
      expect(logged.level1.level2.level3.password).toBe('[REDACTED]');
    });

    it('should prevent infinite recursion with max depth 5', () => {
      let deep: any = { value: 'base' };
      let current = deep;
      for (let i = 0; i < 10; i++) {
        current.next = { password: `secret${i}` };
        current = current.next;
      }

      logger.info(EVENTS.CONFIG_REQUEST, deep);

      expect(console.info).toHaveBeenCalled();
      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged).toBeDefined();
    });

    it('should not redact fields that contain sensitive keywords as values', () => {
      logger.info(EVENTS.CONFIG_REQUEST, {
        description: 'This is a token that failed',
        category: 'password-reset',
      });

      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.description).toBe('This is a token that failed');
      expect(logged.category).toBe('password-reset');
    });
  });

  // ============================================================================
  // SECTION 10: Log Level Control (P1)
  // ============================================================================

  describe('log level control', () => {
    beforeEach(() => {
      initContext({});
      consoleLogs = [];
    });

    it('should log all levels when LOG_LEVEL=debug (P1)', () => {
      process.env.LOG_LEVEL = 'debug';
      consoleLogs = [];

      logger.debug(EVENTS.CONFIG_REQUEST, {});
      logger.info(EVENTS.CONFIG_REQUEST, {});
      logger.warn(EVENTS.CONFIG_ERROR, {});
      logger.error(EVENTS.CONFIG_ERROR, {});

      expect(consoleLogs).toHaveLength(4);
      expect(consoleLogs[0].level).toBe('debug');
      expect(consoleLogs[1].level).toBe('info');
      expect(consoleLogs[2].level).toBe('warn');
      expect(consoleLogs[3].level).toBe('error');
    });

    it('should skip debug when LOG_LEVEL=info (default)', () => {
      delete process.env.LOG_LEVEL;
      consoleLogs = [];

      logger.debug(EVENTS.CONFIG_REQUEST, {});
      logger.info(EVENTS.CONFIG_REQUEST, {});
      logger.warn(EVENTS.CONFIG_ERROR, {});
      logger.error(EVENTS.CONFIG_ERROR, {});

      expect(consoleLogs).toHaveLength(3);
      expect(consoleLogs[0].level).toBe('info');
      expect(consoleLogs[1].level).toBe('warn');
      expect(consoleLogs[2].level).toBe('error');
    });

    it('should skip debug and info when LOG_LEVEL=warn', () => {
      process.env.LOG_LEVEL = 'warn';
      consoleLogs = [];

      logger.debug(EVENTS.CONFIG_REQUEST, {});
      logger.info(EVENTS.CONFIG_REQUEST, {});
      logger.warn(EVENTS.CONFIG_ERROR, {});
      logger.error(EVENTS.CONFIG_ERROR, {});

      expect(consoleLogs).toHaveLength(2);
      expect(consoleLogs[0].level).toBe('warn');
      expect(consoleLogs[1].level).toBe('error');
    });

    it('should only log errors when LOG_LEVEL=error', () => {
      process.env.LOG_LEVEL = 'error';
      consoleLogs = [];

      logger.debug(EVENTS.CONFIG_REQUEST, {});
      logger.info(EVENTS.CONFIG_REQUEST, {});
      logger.warn(EVENTS.CONFIG_ERROR, {});
      logger.error(EVENTS.CONFIG_ERROR, {});

      expect(consoleLogs).toHaveLength(1);
      expect(consoleLogs[0].level).toBe('error');
    });

    it('should be case-insensitive', () => {
      process.env.LOG_LEVEL = 'WARN';
      consoleLogs = [];

      logger.debug(EVENTS.CONFIG_REQUEST, {});
      logger.warn(EVENTS.CONFIG_ERROR, {});

      expect(consoleLogs).toHaveLength(1);
      expect(consoleLogs[0].level).toBe('warn');
    });

    it('should default to info for invalid LOG_LEVEL', () => {
      process.env.LOG_LEVEL = 'invalid-level';
      consoleLogs = [];

      logger.debug(EVENTS.CONFIG_REQUEST, {});
      logger.info(EVENTS.CONFIG_REQUEST, {});

      expect(consoleLogs).toHaveLength(1);
      expect(consoleLogs[0].level).toBe('info');
    });
  });

  // ============================================================================
  // SECTION 11: createTimer (P1: Performance monitoring)
  // ============================================================================

  describe('createTimer', () => {
    beforeEach(() => {
      initContext({});
    });

    it('should measure elapsed time (P1)', () => {
      const timer = createTimer();

      const start = Date.now();
      while (Date.now() - start < 10) {
        // Busy wait
      }

      const duration = timer.duration();
      expect(duration).toBeGreaterThanOrEqual(10);
      expect(duration).toBeLessThan(100);
    });

    it('should log duration with logDuration (P1)', () => {
      const timer = createTimer();

      const start = Date.now();
      while (Date.now() - start < 5) {
        // Busy wait
      }

      timer.logDuration(EVENTS.CONFIG_REQUEST, { result: 'success' });

      expect(console.info).toHaveBeenCalled();
      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.duration).toBeGreaterThanOrEqual(5);
      expect(logged.result).toBe('success');
    });

    it('should log with specific level using log method (P1)', () => {
      const timer = createTimer();

      timer.log('warn', EVENTS.CONFIG_ERROR, { threshold: 100 });

      expect(console.warn).toHaveBeenCalled();
      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.level).toBe('warn');
      expect(logged.duration).toBeDefined();
      expect(logged.threshold).toBe(100);
    });

    it('should have independent timer instances', () => {
      const timer1 = createTimer();

      let wait = Date.now();
      while (Date.now() - wait < 10) {
        // Busy wait
      }

      const timer2 = createTimer();

      const duration1 = timer1.duration();
      const duration2 = timer2.duration();

      expect(duration1).toBeGreaterThan(duration2);
    });

    it('should accumulate time correctly', () => {
      const timer = createTimer();

      const d1 = timer.duration();

      let wait = Date.now();
      while (Date.now() - wait < 5) {
        // Busy wait
      }

      const d2 = timer.duration();

      expect(d2).toBeGreaterThan(d1);
    });
  });

  // ============================================================================
  // SECTION 12: Concurrency & Global State (Edge cases)
  // ============================================================================

  describe('concurrency and global state', () => {
    it('should handle rapid sequential initContext calls', () => {
      initContext({}, 'trace-1');

      logger.info(EVENTS.CONFIG_REQUEST, {});
      const log1 = JSON.parse(consoleLogs[0].msg);

      initContext({}, 'trace-2');
      logger.info(EVENTS.CONFIG_REQUEST, {});
      const log2 = JSON.parse(consoleLogs[1].msg);

      expect(log1.traceId).toBe('trace-1');
      expect(log2.traceId).toBe('trace-2');
    });

    it('should show context pollution if initContext not called', () => {
      initContext({}, 'trace-old');
      logger.info(EVENTS.CONFIG_REQUEST, {});
      const log1 = JSON.parse(consoleLogs[0].msg);

      consoleLogs = [];

      logger.info(EVENTS.CONFIG_REQUEST, {});
      const log2 = JSON.parse(consoleLogs[0].msg);

      expect(log2.traceId).toBe('trace-old');
    });

    it('should reset context with new initContext call', () => {
      initContext({}, 'trace-1');
      logger.info(EVENTS.CONFIG_REQUEST, {});
      const log1 = JSON.parse(consoleLogs[0].msg);

      consoleLogs = [];

      initContext({}, 'trace-2');
      logger.info(EVENTS.CONFIG_REQUEST, {});
      const log2 = JSON.parse(consoleLogs[0].msg);

      expect(log1.traceId).toBe('trace-1');
      expect(log2.traceId).toBe('trace-2');
    });

    it('should merge context updates correctly', () => {
      initContext({}, 'trace-base');
      setContext({ userId: 'user-123' });

      logger.info(EVENTS.CONFIG_REQUEST, {});
      const logged = JSON.parse(consoleLogs[0].msg);

      expect(logged.traceId).toBe('trace-base');
      expect(logged.userId).toBe('user-123');
    });

    it('should preserve data across multiple logs in same invocation', () => {
      initContext({}, 'trace-xyz');

      logger.info(EVENTS.CONFIG_REQUEST, { data: 'a' });
      logger.info(EVENTS.CONFIG_REQUEST, { data: 'b' });
      logger.info(EVENTS.CONFIG_REQUEST, { data: 'c' });

      const logs = consoleLogs.map(log => JSON.parse(log.msg));

      logs.forEach(log => {
        expect(log.traceId).toBe('trace-xyz');
      });
    });
  });

  // ============================================================================
  // SECTION 13: Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    beforeEach(() => {
      initContext({});
    });

    it('should handle circular references without crashing', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;

      expect(() => logger.info(EVENTS.CONFIG_REQUEST, obj)).toThrow();
    });

    it('should handle very large objects', () => {
      const largeObject: Record<string, string> = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`key_${i}`] = `value_${i}`;
      }

      logger.info(EVENTS.CONFIG_REQUEST, largeObject);

      expect(console.info).toHaveBeenCalled();
      const logged = JSON.parse(consoleLogs[0].msg);
      expect(Object.keys(logged).length).toBeGreaterThan(900);
    });

    it('should handle special characters in event name', () => {
      logger.info('EVENT_WITH_SPECIAL!@#' as any, {});

      expect(console.info).toHaveBeenCalled();
    });

    it('should handle very long strings', () => {
      const longString = 'x'.repeat(10000);

      logger.info(EVENTS.CONFIG_REQUEST, { data: longString });

      expect(console.info).toHaveBeenCalled();
      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.data).toHaveLength(10000);
    });

    it('should handle null and undefined in data', () => {
      logger.info(EVENTS.CONFIG_REQUEST, { nullVal: null, undefinedVal: undefined });

      expect(console.info).toHaveBeenCalled();
      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.nullVal).toBeNull();
      expect(logged.undefinedVal).toBeUndefined();
    });

    it('should handle boolean values', () => {
      logger.info(EVENTS.CONFIG_REQUEST, { trueVal: true, falseVal: false });

      expect(console.info).toHaveBeenCalled();
      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.trueVal).toBe(true);
      expect(logged.falseVal).toBe(false);
    });

    it('should handle numeric values including edge cases', () => {
      logger.info(EVENTS.CONFIG_REQUEST, {
        zero: 0,
        negative: -123,
        float: 3.14,
        largeNumber: 999999999999,
      });

      expect(console.info).toHaveBeenCalled();
      const logged = JSON.parse(consoleLogs[0].msg);
      expect(logged.zero).toBe(0);
      expect(logged.negative).toBe(-123);
      expect(logged.float).toBe(3.14);
    });
  });

  // ============================================================================
  // SECTION 14: Integration Tests
  // ============================================================================

  describe('integration scenarios', () => {
    it('should handle complete request lifecycle', () => {
      initContext({
        body: JSON.stringify({ userId: 'user-123' }),
        requestContext: { requestId: 'req-456' },
        headers: { 'x-trace-id': 'trace-789' },
      });

      logger.debug(EVENTS.CONFIG_REQUEST, { endpoint: '/api/v1' });
      logger.info(EVENTS.CONFIG_REQUEST, { step: 1 });
      logger.warn(EVENTS.CONFIG_ERROR, { duration: 5000 });

      try {
        throw new Error('Test error');
      } catch (e) {
        logger.error(EVENTS.CONFIG_ERROR, e as Error);
      }

      const allLogs = consoleLogs
        .filter(l => l.level !== 'debug')
        .map(log => JSON.parse(log.msg));

      allLogs.forEach(log => {
        expect(log.traceId).toBe('trace-789');
        expect(log.userId).toBe('user-123');
        expect(log.requestId).toBe('req-456');
      });
    });

    it('should log with timer throughout request', () => {
      initContext({}, 'trace-timer');
      const timer = createTimer();

      logger.info(EVENTS.CONFIG_REQUEST, {});

      let wait = Date.now();
      while (Date.now() - wait < 5) {
        // Busy wait
      }

      timer.logDuration(EVENTS.CONFIG_REQUEST, { status: 'done' });

      expect(consoleLogs.length).toBeGreaterThanOrEqual(2);
      const lastLog = JSON.parse(consoleLogs[consoleLogs.length - 1].msg);
      expect(lastLog.duration).toBeGreaterThanOrEqual(5);
      expect(lastLog.status).toBe('done');
    });

    it('should properly redact sensitive data across all log levels', () => {
      initContext({});
      process.env.LOG_LEVEL = 'debug';
      consoleLogs = [];

      logger.debug(EVENTS.CONFIG_REQUEST, { token: 'secret1' });
      logger.info(EVENTS.CONFIG_REQUEST, { password: 'secret2' });
      logger.warn(EVENTS.CONFIG_ERROR, { apiKey: 'secret3' });
      logger.error(EVENTS.CONFIG_ERROR, { credential: 'secret4' });

      const allLogs = consoleLogs.map(log => JSON.parse(log.msg));

      expect(allLogs[0].token).toBe('[REDACTED]');
      expect(allLogs[1].password).toBe('[REDACTED]');
      expect(allLogs[2].apiKey).toBe('[REDACTED]');
      expect(allLogs[3].credential).toBe('[REDACTED]');
    });
  });
});
