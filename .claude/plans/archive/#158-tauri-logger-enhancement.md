# Feature Plan: Issue #158 - Tauri App Logger Enhancement

**Status**: Planning
**Issue**: #158
**Branch**: `feature/158-tauri-logger-enhancement`
**Complexity**: T2 (Logic - security-critical, cross-cutting infrastructure)
**Estimated Time**: 6-8 hours

---

## Overview

Sync Lambda logger's P0 (security) and P1 (performance) features to Tauri App logger. The Tauri logger currently lacks critical safety features (error extraction, sensitive data filtering) and convenience features (LOG_LEVEL control, performance timers) that are already proven in Lambda logger.

**Goal**: Achieve feature parity between Lambda and Tauri loggers while preserving Tauri-specific integrations (Debug UI, IPC persistence, ContextProvider).

---

## Architecture Context

### Relevant ADRs

- **[ADR-019: TraceId Distributed Tracing](../../../docs/architecture/ADR/019-traceid-distributed-tracing.md)**
  - **Apply**: TraceId-based log correlation already implemented
  - **Context**: Tauri logger integrates with global ContextProvider for traceId/userId

### Applicable Pillars

- [x] **Pillar R: Semantic Observability** - Core pillar, JSON logs with semantic events
  - **Reference**: `.prot/pillar-r/observability.md`
  - **Apply**: All logs must be JSON-formatted, machine-readable, include traceId

- [x] **Pillar A: Nominal Types** - EventName type already enforced
  - **Apply**: `EVENTS` constant ensures type-safe event names

- [ ] **Pillar B: Airlock** - Not needed (logger is infrastructure, not boundary)

- [ ] **Pillar D: FSM** - Not needed (logger has no complex state machine)

### Architecture Patterns

- **Logger Pattern**: Single global logger instance with context injection
- **Context Provider Pattern**: TraceProvider manages global context (traceId, userId)
- **Tauri IPC Pattern**: persistLog() uses fire-and-forget IPC to Rust backend

### Key Constraints

1. **Preserve existing integrations**:
   - ✅ Debug UI (extractTag, formatEventMessage, debugLog)
   - ✅ Tauri IPC (persistLog via invoke)
   - ✅ ContextProvider (globalContextProvider)
   - ✅ import.meta.env.DEV check (dev-only debug logs)

2. **Backward compatibility**:
   - Existing code must continue working without changes
   - All new features are additive (no breaking changes)

3. **Security-critical**:
   - P0 features prevent credential leaks (sensitive data filtering)
   - Error extraction prevents sensitive data in stack traces

---

## Key Functions

### 1. filterSensitiveData (P1: Security)

**Signature**:
```typescript
function filterSensitiveData(data: unknown, depth?: number): unknown
```

**Pre-conditions**:
- `data` can be any type (primitives, objects, arrays, null, undefined)
- `depth` defaults to 0, max depth is 5 (prevent stack overflow)

**Post-conditions**:
- Returns filtered data with sensitive fields replaced by `'[REDACTED]'`
- Recursive filtering applies to nested objects and arrays
- Non-objects returned as-is

**Side effects**:
- None (pure function)

**Sensitive keywords** (case-insensitive match):
```typescript
['password', 'passwd', 'pwd', 'token', 'jwt', 'bearer',
 'apikey', 'api_key', 'secret', 'api_secret', 'credential',
 'credentials', 'auth', 'authorization', 'key', 'private',
 'private_key', 'access_token', 'refresh_token',
 'aws_secret_access_key', 'session', 'sessionid', 'session_id',
 'code', 'confirmation_code', 'otp']
```

**Unit Tests** (11 test cases):
1. Should redact password field
2. Should redact token field
3. Should redact apiKey field
4. Should redact multiple sensitive fields
5. Should redact in nested objects (depth 1, 2, 3)
6. Should redact in arrays
7. Should preserve non-sensitive fields
8. Should handle primitives (string, number, boolean, null)
9. Should stop recursion at depth 5 (prevent stack overflow)
10. Should handle circular references gracefully
11. Should be case-insensitive (Password, PASSWORD, password)

---

### 2. normalizeErrorData (P0: Error Extraction)

**Signature**:
```typescript
function normalizeErrorData(data?: Error | Record<string, unknown>): Record<string, unknown>
```

**Pre-conditions**:
- `data` is optional (undefined | Error | plain object)

**Post-conditions**:
- If `data` is Error: extracts { error: { message, stack, name } }
- If `data` is object: returns as-is
- If `data` is undefined: returns {}
- If `data` is primitive: wraps in { data }

**Side effects**:
- None (pure function)

**Unit Tests** (7 test cases):
1. Should extract Error.message
2. Should extract Error.stack
3. Should extract Error.name
4. Should handle TypeError, ReferenceError, etc.
5. Should pass through non-Error objects
6. Should handle undefined
7. Should wrap primitives ({ data: value })

---

### 3. getLogLevel / shouldLog (P1: LOG_LEVEL Control)

**Signature**:
```typescript
function getLogLevel(): LogLevel
function shouldLog(level: LogLevel): boolean

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const
```

**Pre-conditions**:
- `import.meta.env.LOG_LEVEL` or `process.env.LOG_LEVEL` may be set
- Valid values: 'debug', 'info', 'warn', 'error' (case-insensitive)

**Post-conditions**:
- `getLogLevel()` returns current log level (default: 'info')
- `shouldLog(level)` returns true if level >= current level

**Side effects**:
- Reads environment variable (no mutation)

**Special handling**:
- **Development mode**: Always allow debug logs when `import.meta.env.DEV === true`
- **Production mode**: Respect LOG_LEVEL setting
- **Invalid LOG_LEVEL**: Default to 'info'

**Unit Tests** (8 test cases):
1. Should default to 'info' when LOG_LEVEL not set
2. Should respect LOG_LEVEL=debug (all logs)
3. Should respect LOG_LEVEL=warn (warn + error only)
4. Should respect LOG_LEVEL=error (error only)
5. Should be case-insensitive (WARN, warn, Warn)
6. Should fallback to 'info' for invalid LOG_LEVEL
7. Should always allow debug in DEV mode (import.meta.env.DEV)
8. Should filter debug in production when LOG_LEVEL=info

---

### 4. createTimer (P1: Performance Monitoring)

**Signature**:
```typescript
interface Timer {
  duration(): number;
  logDuration(event: EventName, data?: Record<string, unknown>): void;
  log(level: LogLevel, event: EventName, data?: Record<string, unknown>): void;
}

function createTimer(): Timer
```

**Pre-conditions**:
- None

**Post-conditions**:
- Returns Timer instance with independent start time
- `duration()` returns elapsed milliseconds since creation
- `logDuration()` logs with automatic duration field (info level)
- `log()` logs with specific level and automatic duration field

**Side effects**:
- `logDuration` and `log` methods call logger (produces log output)

**Unit Tests** (6 test cases):
1. Should measure elapsed time (duration() increases)
2. Should log with duration field (logDuration)
3. Should log with specific level (log method)
4. Should have independent instances (timer1 vs timer2)
5. Should accumulate time correctly (multiple duration() calls)
6. Should include all provided data fields

---

## Implementation Steps

**⚠️ CRITICAL: Data Processing Flow**

Lambda logger uses a two-stage pipeline:
```
1️⃣ normalizeErrorData() → Extract Error.message/stack/name (in logger methods)
2️⃣ filterSensitiveData() → Redact sensitive fields (in createLogEntry)
3️⃣ spread into entry → JSON.stringify()
```

**Implementation order**: Step 1 (Error extraction) BEFORE Step 2 (Sensitive filtering)

---

### Step 1: Add Error Object Extraction (P0) ⭐ DO THIS FIRST

**Files affected**:
- `app/src/00_kernel/telemetry/logger.ts` (add normalizeErrorData function)

**Description**:
Add `normalizeErrorData()` function to automatically extract message, stack, and name from Error objects.

**Why first**: This must run BEFORE sensitive filtering, so logger methods can normalize data before passing to createLogEntry.

**Implementation**:
```typescript
// Add before createLogEntry function (around line 165)
/**
 * Extract error information from Error object or use as-is (P0: Error extraction)
 * This runs FIRST in the pipeline, before sensitive filtering
 */
function normalizeErrorData(data?: Error | Record<string, unknown>): Record<string, unknown> {
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
```

**Integration points**:
```typescript
// Update ALL 4 logger methods to call normalizeErrorData FIRST
logger.debug: (event: string, data?: Record<string, unknown>) => {
  if (import.meta.env.DEV) {
    const normalized = normalizeErrorData(data);  // 1️⃣ Extract Error first
    const entry = createLogEntry('debug', event, normalized);  // 2️⃣ Then filter + build
    console.debug(JSON.stringify(entry));
    outputToDebugUI('debug', event, normalized);  // Use normalized data
    persistLog(entry);
  }
},

// Same for info, warn, error
```

**Subtasks**:
- [ ] Implement normalizeErrorData function
- [ ] Update logger.debug to call normalizeErrorData
- [ ] Update logger.info to call normalizeErrorData
- [ ] Update logger.warn to call normalizeErrorData
- [ ] Update logger.error to call normalizeErrorData
- [ ] Update outputToDebugUI calls to use normalized data
- [ ] Write 7 unit tests

**Pillar concerns**: Pillar R (Observability) - structured error logging

---

### Step 2: Add Sensitive Data Filtering (P1) ⭐ DO THIS SECOND

**Files affected**:
- `app/src/00_kernel/telemetry/logger.ts` (add filterSensitiveData function)

**Description**:
Add `filterSensitiveData()` function to recursively filter sensitive fields from log data.

**Why second**: This runs AFTER error normalization, inside createLogEntry, to redact sensitive fields from the already-normalized data.

**Implementation**:
```typescript
// Add after EventName type (line 150+)
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
 * This runs SECOND in the pipeline, after error normalization
 */
function filterSensitiveData(data: unknown, depth = 0): unknown {
  // Prevent infinite recursion
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
```

**Integration point**:
```typescript
// Update createLogEntry to filter AFTER receiving normalized data
function createLogEntry(
  level: LogLevel,
  event: string,
  data?: Record<string, unknown>  // This data is already normalized
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
```

**Subtasks**:
- [ ] Add SENSITIVE_KEYS constant
- [ ] Implement filterSensitiveData function
- [ ] Update createLogEntry to call filterSensitiveData
- [ ] Write 11 unit tests

**Pillar concerns**: Pillar R (Observability) - prevents sensitive data in logs

---

### Step 3: Add File Header Documentation

**Files affected**:
- `app/src/00_kernel/telemetry/logger.ts` (file header comment)

**Description**:
Add comprehensive file header comment explaining architecture, similar to Lambda logger.

**Implementation**:
```typescript
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
```

**Subtasks**:
- [ ] Add file header comment
- [ ] Document data processing pipeline
- [ ] Document output channels

**Pillar concerns**: None (documentation only)

---

### Step 4: Add LOG_LEVEL Control (P1)

**Files affected**:
- `app/src/00_kernel/telemetry/logger.ts` (add normalizeErrorData function)

**Description**:
Add `normalizeErrorData()` function to automatically extract message, stack, and name from Error objects.

**Implementation**:
```typescript
// Before createLogEntry function
function normalizeErrorData(data?: Error | Record<string, unknown>): Record<string, unknown> {
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
```

**Integration**:
- Update all 4 logger methods (debug, info, warn, error) to call `normalizeErrorData(data)` before `filterSensitiveData()`
- Ensures Error objects are properly serialized in JSON logs

**Subtasks**:
- [ ] Implement normalizeErrorData function
- [ ] Update logger.debug to use normalizeErrorData
- [ ] Update logger.info to use normalizeErrorData
- [ ] Update logger.warn to use normalizeErrorData
- [ ] Update logger.error to use normalizeErrorData
- [ ] Write 7 unit tests

**Pillar concerns**: Pillar R (Observability) - structured error logging

---

### Step 4: Add LOG_LEVEL Control (P1)

**Files affected**:
- `app/src/00_kernel/telemetry/logger.ts` (add LOG_LEVELS, getLogLevel, shouldLog)

**Description**:
Add runtime log level control via environment variable, respecting numeric precedence.

**Implementation**:
```typescript
// After LogLevel type definition (line 9)
export const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;

// Helper functions
function getLogLevel(): LogLevel {
  // Check both import.meta.env and window.ENV (for runtime config)
  const level = (import.meta.env.LOG_LEVEL ||
                 (typeof window !== 'undefined' && window.ENV?.LOG_LEVEL) ||
                 'info').toLowerCase();
  return LOG_LEVELS[level as LogLevel] !== undefined ? (level as LogLevel) : 'info';
}

function shouldLog(level: LogLevel): boolean {
  // Always allow debug logs in development mode
  if (import.meta.env.DEV && level === 'debug') return true;

  const currentLevel = getLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}
```

**Integration**:
- Wrap each logger method's output with `if (shouldLog(level))` check
- **Special case**: `logger.debug` always logs in DEV mode (preserve current behavior)

**Subtasks**:
- [ ] Add LOG_LEVELS constant
- [ ] Implement getLogLevel function
- [ ] Implement shouldLog function
- [ ] Update logger.debug with shouldLog check
- [ ] Update logger.info with shouldLog check
- [ ] Update logger.warn with shouldLog check
- [ ] Update logger.error with shouldLog check
- [ ] Write 8 unit tests

**Pillar concerns**: None (utility feature)

---

### Step 5: Add Performance Timer (P1)

**Files affected**:
- `app/src/00_kernel/telemetry/logger.ts` (add Timer interface + createTimer function)

**Description**:
Add performance timer utility for measuring function execution time.

**Implementation**:
```typescript
// At end of file, after logger export
export interface Timer {
  duration: () => number;
  logDuration: (event: EventName, data?: Record<string, unknown>) => void;
  log: (level: LogLevel, event: EventName, data?: Record<string, unknown>) => void;
}

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
```

**Subtasks**:
- [ ] Add Timer interface
- [ ] Implement createTimer function
- [ ] Export Timer and createTimer
- [ ] Write 6 unit tests

**Pillar concerns**: None (utility feature)

---

### Step 6: Write Comprehensive Unit Tests

**Files affected**:
- `app/src/00_kernel/telemetry/__tests__/logger.test.ts` (new file)

**Description**:
Create comprehensive test suite mirroring Lambda logger tests (77 tests total, adapted for Tauri).

**Test Sections** (based on Lambda test suite):
1. **EVENTS constant** (4 tests) - already passing
2. **LOG_LEVELS** (2 tests) - new tests
3. **Sensitive data filtering** (11 tests) - new feature
4. **Error extraction** (7 tests) - new feature
5. **LOG_LEVEL control** (8 tests) - new feature
6. **createTimer** (6 tests) - new feature
7. **Integration with ContextProvider** (5 tests) - Tauri-specific
8. **Integration with Debug UI** (3 tests) - Tauri-specific
9. **Tauri IPC persistence** (2 tests) - Tauri-specific

**Total new tests**: ~38 (excluding existing tests)

**Testing approach**:
- Use Vitest (already configured)
- Mock console.debug/info/warn/error
- Mock ContextProvider
- Mock Tauri invoke (for persistLog)
- Test in both DEV and production modes

**Subtasks**:
- [ ] Create test file structure
- [ ] Write sensitive data filtering tests (11)
- [ ] Write error extraction tests (7)
- [ ] Write LOG_LEVEL control tests (8)
- [ ] Write createTimer tests (6)
- [ ] Write integration tests (10)
- [ ] Achieve 100% code coverage for new functions

**Pillar concerns**: Pillar K (Testing) - comprehensive unit tests

---

### Step 7: Update Documentation

**Files affected**:
- `app/src/00_kernel/telemetry/logger.ts` (JSDoc comments)
- `docs/operations/LOGGING.md` (usage examples)

**Description**:
Add JSDoc comments for new functions and update LOGGING.md with usage examples.

**Subtasks**:
- [ ] Add JSDoc to filterSensitiveData
- [ ] Add JSDoc to normalizeErrorData
- [ ] Add JSDoc to getLogLevel / shouldLog
- [ ] Add JSDoc to createTimer / Timer interface
- [ ] Update LOGGING.md with new features section
- [ ] Add LOG_LEVEL environment variable documentation
- [ ] Add Timer usage examples

**Pillar concerns**: None

---

## Technical Decisions

### Decision 1: Preserve Tauri-Specific Integrations

**Choice**: Keep Debug UI, IPC persistence, ContextProvider integration unchanged

**Rationale**:
- These are already working well and provide Tauri-specific value
- Lambda logger doesn't have these features (not needed in Lambda environment)
- Changes would require extensive testing of UI/IPC

**Trade-off**: Slightly different behavior from Lambda logger (acceptable)

---

### Decision 2: LOG_LEVEL Respects DEV Mode

**Choice**: `logger.debug()` always logs when `import.meta.env.DEV === true`, regardless of LOG_LEVEL

**Rationale**:
- Preserves current developer experience (debug logs in dev mode)
- Allows override in dev mode: `import.meta.env.LOG_LEVEL=error` still filters
- Production builds respect LOG_LEVEL strictly

**Trade-off**: Slightly different from Lambda logger (Lambda has no DEV mode concept)

---

### Decision 3: Use Same Sensitive Keywords as Lambda

**Choice**: Copy SENSITIVE_KEYS array exactly from Lambda logger (17 keywords)

**Rationale**:
- Already battle-tested in production Lambda environment
- Covers common sensitive fields (password, token, apiKey, aws_secret_access_key, etc.)
- Easy to maintain consistency between environments

**Trade-off**: May redact fields not relevant to Tauri (e.g., aws_secret_access_key)

---

## Risk Assessment

### High-Risk Areas

1. **Sensitive data filtering depth limit**
   - **Risk**: Stack overflow on deeply nested objects
   - **Mitigation**: Max depth 5 (prevents recursion)

2. **Performance impact**
   - **Risk**: filterSensitiveData() adds overhead to every log call
   - **Mitigation**: Only traverses user-provided data (not context fields), short-circuits on primitives

3. **LOG_LEVEL environment variable**
   - **Risk**: Incorrect configuration prevents logs in production
   - **Mitigation**: Default to 'info' (safe), document thoroughly

### Medium-Risk Areas

1. **Backward compatibility**
   - **Risk**: Existing code breaks if logger signature changes
   - **Mitigation**: All changes are additive (no breaking changes)

2. **Test coverage**
   - **Risk**: Edge cases not covered in tests
   - **Mitigation**: Mirror Lambda test suite (77 tests, proven comprehensive)

### Low-Risk Areas

1. **Timer implementation**
   - Simple Date.now() based timing
   - No complex state or concurrency issues

---

## Deployment Notes

### Breaking Changes

**None** - All changes are additive and backward compatible.

### Migration Required

**None** - Existing code continues to work without modification.

### Testing Strategy

1. **Unit tests**: Run full test suite (`npm test`)
2. **Manual testing**: Test in Dev Tools Debug panel
3. **Production validation**: Deploy to staging, check logs for [REDACTED] markers

### Rollback Plan

If issues arise:
1. Revert commit
2. Redeploy previous version
3. No database migrations required (logger is stateless)

---

## Success Criteria

- [x] **Architecture review complete**: ADRs + Pillars identified
- [ ] **P0 implemented**: Error extraction working in all log levels
- [ ] **P0 tested**: 7 unit tests passing for normalizeErrorData
- [ ] **P1 implemented**: Sensitive data filtering active
- [ ] **P1 tested**: 11 unit tests passing for filterSensitiveData
- [ ] **P1 implemented**: LOG_LEVEL control functional
- [ ] **P1 tested**: 8 unit tests passing for getLogLevel/shouldLog
- [ ] **P1 implemented**: createTimer utility available
- [ ] **P1 tested**: 6 unit tests passing for Timer
- [ ] **Integration preserved**: Debug UI, IPC, ContextProvider still working
- [ ] **Test coverage**: ≥90% code coverage for new functions
- [ ] **Documentation updated**: JSDoc + LOGGING.md complete
- [ ] **Manual testing**: Logs show [REDACTED] for passwords
- [ ] **Manual testing**: Error.stack appears in error logs
- [ ] **Ready to merge**: All tests passing, PR approved

---

## Estimated Timeline

| Phase | Task | Time |
|-------|------|------|
| **Phase 1** | Step 1: Error extraction (P0) ⭐ | 1h |
| | Step 2: Sensitive data filtering (P1) ⭐ | 2h |
| | Step 3: File header documentation | 0.5h |
| | Step 4: LOG_LEVEL control (P1) | 1.5h |
| | Step 5: Performance timer (P1) | 1h |
| **Phase 2** | Step 6: Write tests (38 tests) | 2h |
| | Step 7: Documentation | 0.5h |
| **Total** | | **8.5h** |

---

## Related Issues

- **Issue #159**: Logger Unification (completed - semantic logging foundation)
- **Issue #160**: Lambda TypeScript Migration (completed - Lambda logger now TypeScript)
- **Issue #155**: Tax Fields (completed - shows logger works well in production)

---

## References

- **Lambda logger**: `infra/lambda/shared-layer/nodejs/shared/logger.ts` (464 lines, P0+P1 complete)
- **Lambda tests**: `infra/lambda/shared-layer/nodejs/shared/__tests__/logger.test.ts` (962 lines, 77 tests)
- **Tauri logger**: `app/src/00_kernel/telemetry/logger.ts` (330 lines, missing P0+P1)
- **Pillar R**: `.prot/pillar-r/observability.md`
- **ADR-019**: `docs/architecture/ADR/019-traceid-distributed-tracing.md`

---

**Plan Status**: ✅ Ready for implementation
**Next Step**: Run `*approve` to start development
