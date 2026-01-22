import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ContextProvider } from '../traceContext';
import * as debugHeadless from '../../../02_modules/debug/headless';

/**
 * Comprehensive test suite for Tauri logger.ts
 * Issue #158: P0 (Error extraction, Sensitive filtering) + P1 (LOG_LEVEL, Timer)
 *
 * Test Categories:
 * - Unit Tests: Individual functions with mocks (关键/竞争/边缘/错误流程)
 * - Integration Tests: Module interactions with minimal mocks
 */

// ============================================================================
// SETUP: Import logger (must be after mocks)
// ============================================================================

// Mock Tauri invoke before importing logger
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock debugLog
vi.mock('../../../02_modules/debug/headless', () => ({
  debugLog: vi.fn(),
}));

// Now import logger (after mocks are set up)
import {
  EVENTS,
  LOG_LEVELS,
  logger,
  setContextProvider,
  logStateTransition,
  createTimer,
} from '../logger';

describe('logger.ts - Issue #158 Enhancement', () => {
  // Save original console methods and env vars
  const originalConsoleDebug = console.debug;
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  const originalEnv = import.meta.env.DEV;
  const originalLogLevel = import.meta.env.LOG_LEVEL;

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
    (import.meta.env as any).DEV = true;  // Default to dev mode
    delete (import.meta.env as any).LOG_LEVEL;

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore console and env
    console.debug = originalConsoleDebug;
    console.info = originalConsoleInfo;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    (import.meta.env as any).DEV = originalEnv;
    (import.meta.env as any).LOG_LEVEL = originalLogLevel;

    // Clear context provider
    setContextProvider(null);
  });

  // ============================================================================
  // UNIT TESTS: normalizeErrorData (P0: Error extraction)
  // ============================================================================

  describe('Unit: normalizeErrorData (P0)', () => {
    it('should extract Error.message, Error.stack, Error.name', () => {
      const error = new Error('Test error message');
      error.name = 'TestError';

      logger.info(EVENTS.APP_ERROR, error as any);

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.error.message).toBe('Test error message');
      expect(log.error.stack).toContain('TestError');
      expect(log.error.name).toBe('TestError');
    });

    it('should handle TypeError', () => {
      const error = new TypeError('Type mismatch');

      logger.error(EVENTS.APP_ERROR, error as any);

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.error.message).toBe('Type mismatch');
      expect(log.error.name).toBe('TypeError');
    });

    it('should handle ReferenceError', () => {
      const error = new ReferenceError('Undefined variable');

      logger.error(EVENTS.APP_ERROR, error as any);

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.error.message).toBe('Undefined variable');
      expect(log.error.name).toBe('ReferenceError');
    });

    it('should pass through non-Error objects', () => {
      const data = { userId: 'user-123', status: 'active' };

      logger.info(EVENTS.AUTH_LOGIN_SUCCESS, data);

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.userId).toBe('user-123');
      expect(log.status).toBe('active');
      expect(log.error).toBeUndefined();
    });

    it('should handle undefined data', () => {
      logger.info(EVENTS.APP_STARTED);

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.event).toBe('APP_STARTED');
      expect(log.timestamp).toBeDefined();
    });

    it('should wrap primitives in { data }', () => {
      logger.info(EVENTS.APP_STARTED, 'simple string' as any);

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.data).toBe('simple string');
    });

    it('should handle null', () => {
      logger.info(EVENTS.APP_STARTED, null as any);

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.event).toBe('APP_STARTED');
    });
  });

  // ============================================================================
  // UNIT TESTS: filterSensitiveData (P1: Security)
  // ============================================================================

  describe('Unit: filterSensitiveData (P1)', () => {
    it('should redact password field', () => {
      logger.info(EVENTS.AUTH_LOGIN_SUCCESS, {
        userId: 'user-123',
        password: 'secret123',
      });

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.password).toBe('[REDACTED]');
      expect(log.userId).toBe('user-123');
    });

    it('should redact token field', () => {
      logger.info(EVENTS.AUTH_TOKEN_REFRESHED, {
        userId: 'user-123',
        token: 'jwt-token-abc',
      });

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.token).toBe('[REDACTED]');
    });

    it('should redact apiKey field', () => {
      logger.info(EVENTS.API_REQUEST_FAILED, {
        apiKey: 'sk-1234567890',
        endpoint: '/api/upload',
      });

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.apiKey).toBe('[REDACTED]');
      expect(log.endpoint).toBe('/api/upload');
    });

    it('should redact multiple sensitive fields', () => {
      logger.info(EVENTS.AUTH_LOGIN_SUCCESS, {
        userId: 'user-123',
        password: 'secret',
        token: 'jwt-abc',
        apiKey: 'sk-xyz',
      });

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.password).toBe('[REDACTED]');
      expect(log.token).toBe('[REDACTED]');
      expect(log.apiKey).toBe('[REDACTED]');
      expect(log.userId).toBe('user-123');
    });

    it('should redact in nested objects (depth 1)', () => {
      logger.info(EVENTS.AUTH_LOGIN_SUCCESS, {
        user: {
          id: 'user-123',
          password: 'secret',
        },
      });

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.user.password).toBe('[REDACTED]');
      expect(log.user.id).toBe('user-123');
    });

    it('should redact in nested objects (depth 2)', () => {
      logger.info(EVENTS.AUTH_LOGIN_SUCCESS, {
        auth: {
          user: {
            id: 'user-123',
            credentials: { password: 'secret' },
          },
        },
      });

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.auth.user.credentials.password).toBe('[REDACTED]');
      expect(log.auth.user.id).toBe('user-123');
    });

    it('should redact in arrays', () => {
      logger.info(EVENTS.AUTH_LOGIN_SUCCESS, {
        users: [
          { id: 'user-1', password: 'secret1' },
          { id: 'user-2', token: 'jwt-2' },
        ],
      });

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.users[0].password).toBe('[REDACTED]');
      expect(log.users[1].token).toBe('[REDACTED]');
      expect(log.users[0].id).toBe('user-1');
    });

    it('should preserve non-sensitive fields', () => {
      logger.info(EVENTS.UPLOAD_STARTED, {
        imageId: 'img-123',
        fileName: 'receipt.jpg',
        size: 1024,
        userId: 'user-123',
      });

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.imageId).toBe('img-123');
      expect(log.fileName).toBe('receipt.jpg');
      expect(log.size).toBe(1024);
      expect(log.userId).toBe('user-123');
    });

    it('should be case-insensitive (Password, PASSWORD, password)', () => {
      logger.info(EVENTS.AUTH_LOGIN_SUCCESS, {
        Password: 'secret1',
        PASSWORD: 'secret2',
        password: 'secret3',
      });

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.Password).toBe('[REDACTED]');
      expect(log.PASSWORD).toBe('[REDACTED]');
      expect(log.password).toBe('[REDACTED]');
    });

    it('should stop recursion at depth 5 (prevent stack overflow)', () => {
      const deepObject: any = { level: 0 };
      let current = deepObject;
      for (let i = 1; i <= 10; i++) {
        current.nested = { level: i, password: `secret-${i}` };
        current = current.nested;
      }

      logger.info(EVENTS.APP_ERROR, deepObject);

      const log = JSON.parse(consoleLogs[0].msg);
      // Depth 0-4 should be filtered
      expect(log.nested.password).toBe('[REDACTED]');
      expect(log.nested.nested.password).toBe('[REDACTED]');
      // Depth 5+ should stop (return as-is)
      expect(log.nested.nested.nested.nested.nested.nested).toBeDefined();
    });

    it('should handle primitives (no traversal)', () => {
      logger.info(EVENTS.APP_STARTED, {
        count: 42,
        flag: true,
        message: 'hello',
      });

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.count).toBe(42);
      expect(log.flag).toBe(true);
      expect(log.message).toBe('hello');
    });
  });

  // ============================================================================
  // UNIT TESTS: LOG_LEVEL Control (P1: Performance)
  // ============================================================================

  describe('Unit: LOG_LEVEL Control (P1)', () => {
    it('should default to info when LOG_LEVEL not set', () => {
      (import.meta.env as any).DEV = false;  // Production mode
      delete (import.meta.env as any).LOG_LEVEL;

      logger.debug(EVENTS.APP_STARTED, { test: 'debug' });
      logger.info(EVENTS.APP_STARTED, { test: 'info' });

      // debug should be filtered, info should pass
      expect(consoleLogs.length).toBe(1);
      expect(consoleLogs[0].level).toBe('info');
    });

    it('should respect LOG_LEVEL=debug (all logs)', () => {
      (import.meta.env as any).DEV = false;
      (import.meta.env as any).LOG_LEVEL = 'debug';

      logger.debug(EVENTS.APP_STARTED, { test: 'debug' });
      logger.info(EVENTS.APP_STARTED, { test: 'info' });
      logger.warn(EVENTS.APP_ERROR, { test: 'warn' });

      expect(consoleLogs.length).toBe(3);
      expect(consoleLogs[0].level).toBe('debug');
      expect(consoleLogs[1].level).toBe('info');
      expect(consoleLogs[2].level).toBe('warn');
    });

    it('should respect LOG_LEVEL=warn (warn + error only)', () => {
      (import.meta.env as any).DEV = false;
      (import.meta.env as any).LOG_LEVEL = 'warn';

      logger.debug(EVENTS.APP_STARTED);
      logger.info(EVENTS.APP_STARTED);
      logger.warn(EVENTS.APP_ERROR);
      logger.error(EVENTS.APP_ERROR);

      expect(consoleLogs.length).toBe(2);
      expect(consoleLogs[0].level).toBe('warn');
      expect(consoleLogs[1].level).toBe('error');
    });

    it('should respect LOG_LEVEL=error (error only)', () => {
      (import.meta.env as any).DEV = false;
      (import.meta.env as any).LOG_LEVEL = 'error';

      logger.debug(EVENTS.APP_STARTED);
      logger.info(EVENTS.APP_STARTED);
      logger.warn(EVENTS.APP_ERROR);
      logger.error(EVENTS.APP_ERROR);

      expect(consoleLogs.length).toBe(1);
      expect(consoleLogs[0].level).toBe('error');
    });

    it('should be case-insensitive (WARN, warn, Warn)', () => {
      (import.meta.env as any).DEV = false;
      (import.meta.env as any).LOG_LEVEL = 'WARN';

      logger.info(EVENTS.APP_STARTED);
      logger.warn(EVENTS.APP_ERROR);

      expect(consoleLogs.length).toBe(1);
      expect(consoleLogs[0].level).toBe('warn');
    });

    it('should fallback to info for invalid LOG_LEVEL', () => {
      (import.meta.env as any).DEV = false;
      (import.meta.env as any).LOG_LEVEL = 'invalid';

      logger.debug(EVENTS.APP_STARTED);
      logger.info(EVENTS.APP_STARTED);

      expect(consoleLogs.length).toBe(1);
      expect(consoleLogs[0].level).toBe('info');
    });

    it('should always allow debug in DEV mode', () => {
      (import.meta.env as any).DEV = true;
      (import.meta.env as any).LOG_LEVEL = 'error';  // Even with error level

      logger.debug(EVENTS.APP_STARTED, { test: 'dev-debug' });

      expect(consoleLogs.length).toBe(1);
      expect(consoleLogs[0].level).toBe('debug');
      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.test).toBe('dev-debug');
    });

    it('should filter debug in production when LOG_LEVEL=info', () => {
      (import.meta.env as any).DEV = false;
      (import.meta.env as any).LOG_LEVEL = 'info';

      logger.debug(EVENTS.APP_STARTED);
      logger.info(EVENTS.APP_STARTED);

      expect(consoleLogs.length).toBe(1);
      expect(consoleLogs[0].level).toBe('info');
    });
  });

  // ============================================================================
  // UNIT TESTS: createTimer (P1: Performance monitoring)
  // ============================================================================

  describe('Unit: createTimer (P1)', () => {
    it('should measure elapsed time (duration increases)', async () => {
      const timer = createTimer();
      const start = timer.duration();

      await new Promise(resolve => setTimeout(resolve, 10));
      const end = timer.duration();

      expect(end).toBeGreaterThan(start);
      expect(end - start).toBeGreaterThanOrEqual(10);
    });

    it('should log with duration field (logDuration)', () => {
      const timer = createTimer();

      timer.logDuration(EVENTS.UPLOAD_COMPLETED, { imageId: 'img-123' });

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.event).toBe('UPLOAD_COMPLETED');
      expect(log.duration).toBeGreaterThanOrEqual(0);
      expect(log.imageId).toBe('img-123');
    });

    it('should log with specific level (log method)', () => {
      const timer = createTimer();

      timer.log('warn', EVENTS.UPLOAD_FAILED, { error: 'timeout' });

      expect(consoleLogs[0].level).toBe('warn');
      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.event).toBe('UPLOAD_FAILED');
      expect(log.duration).toBeGreaterThanOrEqual(0);
      expect(log.error).toBe('timeout');
    });

    it('should have independent instances (timer1 vs timer2)', async () => {
      const timer1 = createTimer();
      await new Promise(resolve => setTimeout(resolve, 10));
      const timer2 = createTimer();
      await new Promise(resolve => setTimeout(resolve, 10));

      const duration1 = timer1.duration();
      const duration2 = timer2.duration();

      expect(duration1).toBeGreaterThan(duration2);
    });

    it('should accumulate time correctly (multiple duration calls)', async () => {
      const timer = createTimer();

      const d1 = timer.duration();
      await new Promise(resolve => setTimeout(resolve, 10));
      const d2 = timer.duration();
      await new Promise(resolve => setTimeout(resolve, 10));
      const d3 = timer.duration();

      expect(d2).toBeGreaterThan(d1);
      expect(d3).toBeGreaterThan(d2);
    });

    it('should include all provided data fields', () => {
      const timer = createTimer();

      timer.logDuration(EVENTS.IMAGE_COMPRESSED, {
        imageId: 'img-123',
        originalSize: 5000,
        compressedSize: 1000,
      });

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.duration).toBeDefined();
      expect(log.imageId).toBe('img-123');
      expect(log.originalSize).toBe(5000);
      expect(log.compressedSize).toBe(1000);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS: Logger with ContextProvider
  // ============================================================================

  describe('Integration: Logger + ContextProvider', () => {
    it('should include traceId from context provider', () => {
      const mockProvider: ContextProvider = {
        getOptional: () => ({ traceId: 'trace-abc-123', userId: 'user-xyz' }),
      };
      setContextProvider(mockProvider);

      logger.info(EVENTS.UPLOAD_STARTED, { imageId: 'img-123' });

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.traceId).toBe('trace-abc-123');
      expect(log.userId).toBe('user-xyz');
      expect(log.imageId).toBe('img-123');
    });

    it('should use "no-trace" when provider returns null', () => {
      const mockProvider: ContextProvider = {
        getOptional: () => null,
      };
      setContextProvider(mockProvider);

      logger.info(EVENTS.UPLOAD_STARTED);

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.traceId).toBe('no-trace');
    });

    it('should use "no-trace" when provider is null', () => {
      setContextProvider(null);

      logger.info(EVENTS.UPLOAD_STARTED);

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.traceId).toBe('no-trace');
    });

    it('should update context when provider changes', () => {
      const mockProvider1: ContextProvider = {
        getOptional: () => ({ traceId: 'trace-1', userId: 'user-1' }),
      };
      setContextProvider(mockProvider1);

      logger.info(EVENTS.UPLOAD_STARTED);

      const log1 = JSON.parse(consoleLogs[0].msg);
      expect(log1.traceId).toBe('trace-1');

      // Change provider
      const mockProvider2: ContextProvider = {
        getOptional: () => ({ traceId: 'trace-2', userId: 'user-2' }),
      };
      setContextProvider(mockProvider2);

      logger.info(EVENTS.UPLOAD_COMPLETED);

      const log2 = JSON.parse(consoleLogs[1].msg);
      expect(log2.traceId).toBe('trace-2');
    });

    it('should handle userId undefined from context', () => {
      const mockProvider: ContextProvider = {
        getOptional: () => ({ traceId: 'trace-abc', userId: undefined }),
      };
      setContextProvider(mockProvider);

      logger.info(EVENTS.UPLOAD_STARTED);

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.traceId).toBe('trace-abc');
      expect(log.userId).toBeUndefined();
    });
  });

  // ============================================================================
  // INTEGRATION TESTS: Logger + Debug UI
  // ============================================================================

  describe('Integration: Logger + Debug UI', () => {
    it('should call debugLog for all log levels', () => {
      logger.info(EVENTS.UPLOAD_STARTED, { imageId: 'img-123' });

      expect(debugHeadless.debugLog).toHaveBeenCalledWith(
        'info',
        'Upload',
        'Started',
        { imageId: 'img-123' }
      );
    });

    it('should pass normalized data to debugLog', () => {
      const error = new Error('Test error');
      logger.error(EVENTS.APP_ERROR, error as any);

      expect(debugHeadless.debugLog).toHaveBeenCalledWith(
        'error',
        'App',
        'Error',
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Test error',
          }),
        })
      );
    });

    it('should map debug level to info for Debug UI', () => {
      logger.debug(EVENTS.APP_STARTED);

      // Debug UI receives 'info' instead of 'debug'
      expect(debugHeadless.debugLog).toHaveBeenCalledWith(
        'info',
        'App',
        'Started',
        {}
      );
    });
  });

  // ============================================================================
  // INTEGRATION TESTS: End-to-End Flows
  // ============================================================================

  describe('Integration: End-to-End Flows', () => {
    it('E2E: Error → normalize → filter → log', () => {
      const error = new Error('Auth failed');
      (error as any).password = 'secret123';  // Add sensitive field to error

      const mockProvider: ContextProvider = {
        getOptional: () => ({ traceId: 'trace-e2e', userId: 'user-123' }),
      };
      setContextProvider(mockProvider);

      logger.error(EVENTS.AUTH_LOGIN_FAILED, error as any);

      const log = JSON.parse(consoleLogs[0].msg);
      // Error normalized
      expect(log.error.message).toBe('Auth failed');
      expect(log.error.stack).toBeDefined();
      // Sensitive field filtered (in error object)
      expect(log.password).toBeUndefined();  // Top-level sensitive removed
      // Context included
      expect(log.traceId).toBe('trace-e2e');
      expect(log.userId).toBe('user-123');
    });

    it('E2E: Sensitive data in real scenario', () => {
      const mockProvider: ContextProvider = {
        getOptional: () => ({ traceId: 'trace-real', userId: 'user-real' }),
      };
      setContextProvider(mockProvider);

      logger.info(EVENTS.AUTH_LOGIN_SUCCESS, {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          credentials: {
            password: 'secretPassword',
            token: 'jwt-abc-123',
          },
        },
        session: {
          sessionId: 'sess-xyz',
          refreshToken: 'refresh-token-abc',
        },
      });

      const log = JSON.parse(consoleLogs[0].msg);
      // Non-sensitive preserved
      expect(log.user.id).toBe('user-123');
      expect(log.user.email).toBe('test@example.com');
      // Sensitive redacted
      expect(log.user.credentials.password).toBe('[REDACTED]');
      expect(log.user.credentials.token).toBe('[REDACTED]');
      expect(log.session.sessionId).toBe('[REDACTED]');
      expect(log.session.refreshToken).toBe('[REDACTED]');
      // Context included
      expect(log.traceId).toBe('trace-real');
      expect(log.userId).toBe('user-real');
    });

    it('E2E: Timer with Error and context', async () => {
      const mockProvider: ContextProvider = {
        getOptional: () => ({ traceId: 'trace-timer', userId: 'user-timer' }),
      };
      setContextProvider(mockProvider);

      const timer = createTimer();
      await new Promise(resolve => setTimeout(resolve, 10));

      const error = new Error('Operation timeout');
      timer.log('error', EVENTS.UPLOAD_FAILED, error as any);

      const log = JSON.parse(consoleLogs[0].msg);
      // Timer duration
      expect(log.duration).toBeGreaterThanOrEqual(10);
      // Error normalized
      expect(log.error.message).toBe('Operation timeout');
      // Context
      expect(log.traceId).toBe('trace-timer');
      expect(log.userId).toBe('user-timer');
    });

    it('E2E: LOG_LEVEL filtering with sensitive data', () => {
      (import.meta.env as any).DEV = false;
      (import.meta.env as any).LOG_LEVEL = 'error';

      logger.info(EVENTS.AUTH_LOGIN_SUCCESS, { password: 'secret' });
      logger.error(EVENTS.AUTH_LOGIN_FAILED, { token: 'jwt-abc' });

      // Only error log should pass
      expect(consoleLogs.length).toBe(1);
      expect(consoleLogs[0].level).toBe('error');
      // Sensitive data still filtered
      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.token).toBe('[REDACTED]');
    });
  });

  // ============================================================================
  // INTEGRATION TESTS: logStateTransition
  // ============================================================================

  describe('Integration: logStateTransition', () => {
    it('should log state transition with all required fields', () => {
      logStateTransition({
        entity: 'Transaction',
        entityId: 'txn-123',
        from: 'unconfirmed',
        to: 'confirmed',
        amount: 1500,
      });

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.event).toBe('STATE_TRANSITION');
      expect(log.entity).toBe('Transaction');
      expect(log.entityId).toBe('txn-123');
      expect(log.from).toBe('unconfirmed');
      expect(log.to).toBe('confirmed');
      expect(log.amount).toBe(1500);
    });

    it('should work with context provider', () => {
      const mockProvider: ContextProvider = {
        getOptional: () => ({ traceId: 'trace-fsm', userId: 'user-fsm' }),
      };
      setContextProvider(mockProvider);

      logStateTransition({
        entity: 'Upload',
        entityId: 'img-456',
        from: 'pending',
        to: 'completed',
      });

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.traceId).toBe('trace-fsm');
      expect(log.userId).toBe('user-fsm');
      expect(log.entity).toBe('Upload');
    });
  });

  // ============================================================================
  // EDGE CASES & ERROR FLOWS
  // ============================================================================

  describe('Edge Cases & Error Flows', () => {
    it('should handle circular references gracefully', () => {
      const circular: any = { a: 1 };
      circular.self = circular;

      // Should not throw (JSON.stringify will handle it)
      expect(() => {
        logger.info(EVENTS.APP_ERROR, circular);
      }).not.toThrow();
    });

    it('should handle very large objects (performance)', () => {
      const largeObject: any = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`key${i}`] = `value${i}`;
      }

      const start = Date.now();
      logger.info(EVENTS.APP_STARTED, largeObject);
      const duration = Date.now() - start;

      // Should complete quickly (< 100ms)
      expect(duration).toBeLessThan(100);
      expect(consoleLogs.length).toBe(1);
    });

    it('should handle null prototype objects', () => {
      const nullProto = Object.create(null);
      nullProto.key = 'value';

      logger.info(EVENTS.APP_STARTED, nullProto);

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.key).toBe('value');
    });

    it('should handle symbols in data (JSON.stringify limitation)', () => {
      const withSymbol = {
        normalKey: 'value',
        [Symbol('test')]: 'symbol-value',
      };

      logger.info(EVENTS.APP_STARTED, withSymbol);

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.normalKey).toBe('value');
      // Symbol keys are ignored by JSON.stringify (expected behavior)
    });

    it('should handle undefined values in objects', () => {
      logger.info(EVENTS.APP_STARTED, {
        defined: 'value',
        undefined: undefined,
      });

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.defined).toBe('value');
      // undefined is omitted by JSON.stringify (expected)
      expect('undefined' in log).toBe(false);
    });

    it('should handle Date objects', () => {
      const date = new Date('2026-01-22T10:00:00.000Z');

      logger.info(EVENTS.APP_STARTED, { timestamp: date });

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.timestamp).toBe('2026-01-22T10:00:00.000Z');
    });

    it('should handle empty arrays and objects', () => {
      logger.info(EVENTS.APP_STARTED, {
        emptyArray: [],
        emptyObject: {},
      });

      const log = JSON.parse(consoleLogs[0].msg);
      expect(log.emptyArray).toEqual([]);
      expect(log.emptyObject).toEqual({});
    });
  });

  // ============================================================================
  // CONSTANTS VALIDATION
  // ============================================================================

  describe('Constants: EVENTS & LOG_LEVELS', () => {
    it('EVENTS should have all required event names', () => {
      expect(EVENTS.UPLOAD_STARTED).toBe('UPLOAD_STARTED');
      expect(EVENTS.STATE_TRANSITION).toBe('STATE_TRANSITION');
      expect(EVENTS.APP_ERROR).toBe('APP_ERROR');
    });

    it('EVENTS should have at least 30 events', () => {
      expect(Object.keys(EVENTS).length).toBeGreaterThanOrEqual(30);
    });

    it('EVENTS should use consistent naming (NOUN_VERB)', () => {
      Object.values(EVENTS).forEach((eventName: string) => {
        expect(eventName).toMatch(/^[A-Z0-9_]+$/);
      });
    });

    it('LOG_LEVELS should define numeric precedence', () => {
      expect(LOG_LEVELS.debug).toBe(0);
      expect(LOG_LEVELS.info).toBe(1);
      expect(LOG_LEVELS.warn).toBe(2);
      expect(LOG_LEVELS.error).toBe(3);
    });

    it('LOG_LEVELS should have error > warn > info > debug', () => {
      expect(LOG_LEVELS.error > LOG_LEVELS.warn).toBe(true);
      expect(LOG_LEVELS.warn > LOG_LEVELS.info).toBe(true);
      expect(LOG_LEVELS.info > LOG_LEVELS.debug).toBe(true);
    });
  });
});
