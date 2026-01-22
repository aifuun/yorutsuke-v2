# Logging System Design

> Pillar R: Semantic Observability - Structured JSON Logs

## Overview

Yorutsuke uses a **unified logging system** with multiple output targets:

```
logger.info(EVENTS.UPLOAD_STARTED, { imageId, size })
    │
    ├──► Console (JSON)
    ├──► Debug UI Panel (human-readable)
    └──► Local File (~/.yorutsuke/logs/)
```

| Output | Format | Persistence | Purpose |
|--------|--------|-------------|---------|
| Console | JSON | Session | Development debugging |
| Debug UI | Human-readable | Memory (100 entries) | Real-time monitoring |
| File | JSON Lines | 7 days | Post-mortem analysis |

## Usage

### Basic Logging

```typescript
import { logger, EVENTS } from '@/00_kernel/telemetry/logger';

// Info level - normal operations
logger.info(EVENTS.UPLOAD_STARTED, { imageId: 'img-001', size: 1024 });

// Warn level - recoverable issues
logger.warn(EVENTS.QUOTA_LIMIT_REACHED, { used: 50, limit: 50 });

// Error level - failures
logger.error(EVENTS.UPLOAD_FAILED, { imageId: 'img-001', error: 'timeout' });

// Debug level - verbose (DEV only)
logger.debug(EVENTS.QUEUE_AUTO_PROCESS, { phase: 'polling' });
```

### Error Object Extraction (P0)

Error objects are automatically normalized for structured logging:

```typescript
try {
  await processImage(imageId);
} catch (error) {
  // Error properties (message, stack, name) are automatically extracted
  logger.error(EVENTS.IMAGE_PROCESSING_FAILED, error);
  // Logs: { event: "IMAGE_PROCESSING_FAILED", error: { message: "...", stack: "...", name: "..." } }
}
```

**How it works**:
- Error objects are detected and normalized to `{ error: { message, stack, name } }`
- Non-Error objects are passed through unchanged
- Handles TypeError, ReferenceError, and custom Error subclasses

### Sensitive Data Filtering (P0)

Sensitive fields are automatically redacted from logs:

```typescript
// Sensitive data is automatically redacted
logger.info(EVENTS.AUTH_LOGIN_SUCCESS, {
  userId: 'user-123',
  token: 'Bearer abc123',  // → '[REDACTED]'
  password: 'secret',      // → '[REDACTED]'
  email: 'user@example.com'  // Preserved (not sensitive)
});
```

**Protected fields** (case-insensitive):
- Passwords: `password`, `passwd`, `pwd`
- Tokens: `token`, `jwt`, `bearer`, `access_token`, `refresh_token`
- API Keys: `apikey`, `api_key`, `secret`, `api_secret`, `private_key`
- Credentials: `credential`, `credentials`
- Auth: `auth`, `authorization`
- AWS: `aws_secret_access_key`
- Session: `session`, `sessionid`, `session_id`
- OTP: `code`, `confirmation_code`, `otp`

**How it works**:
- Recursively scans objects (max depth: 5)
- Redacts primitive sensitive values with `'[REDACTED]'`
- Recursively filters objects with sensitive keys
- Handles circular references, Date objects, and arrays

### LOG_LEVEL Control (P1)

Control log output with `LOG_LEVEL` environment variable:

```typescript
// Set LOG_LEVEL in environment
// LOG_LEVEL=debug → Show all logs (debug, info, warn, error)
// LOG_LEVEL=info  → Show info, warn, error (default)
// LOG_LEVEL=warn  → Show warn, error only
// LOG_LEVEL=error → Show error only

logger.debug(EVENTS.QUEUE_AUTO_PROCESS, { phase: 'polling' });  // Filtered if LOG_LEVEL=info
logger.info(EVENTS.UPLOAD_STARTED, { imageId });                // Shown if LOG_LEVEL=info
logger.warn(EVENTS.QUOTA_LIMIT_REACHED, { used: 50 });         // Always shown (unless LOG_LEVEL=error)
logger.error(EVENTS.UPLOAD_FAILED, { imageId });                // Always shown
```

**How it works**:
- Reads `LOG_LEVEL` from `import.meta.env.LOG_LEVEL` or `window.ENV.LOG_LEVEL`
- Defaults to `'info'` if not set
- `debug` logs are always shown in development mode (`import.meta.env.DEV`)
- Invalid LOG_LEVEL values fallback to `'info'`

### Performance Timer (P1)

Track elapsed time for operations:

```typescript
import { createTimer } from '@/00_kernel/telemetry/logger';

// Basic usage
const timer = createTimer();
await someOperation();
console.log(`Elapsed: ${timer.duration()}ms`);

// Log with automatic duration
const timer = createTimer();
await processImage(imageId);
timer.logDuration(EVENTS.IMAGE_PROCESSING_COMPLETED, { imageId });
// Logs: { event: "IMAGE_PROCESSING_COMPLETED", imageId: "...", duration: 1234 }

// Log with specific level and duration
const timer = createTimer();
try {
  await uploadImage(imageId);
  timer.log('info', EVENTS.UPLOAD_COMPLETED, { imageId });
} catch (error) {
  timer.log('error', EVENTS.UPLOAD_FAILED, error);
  // Logs: { event: "UPLOAD_FAILED", error: { message: "..." }, duration: 5678 }
}
```

**Methods**:
- `timer.duration()` - Get elapsed time in milliseconds
- `timer.logDuration(event, data)` - Log at `info` level with duration
- `timer.log(level, event, data)` - Log at specific level with duration

**How it works**:
- Independent timer instances (each has its own start time)
- Duration is automatically calculated and merged with log data
- Handles Error objects (automatically normalized before merging duration)

### State Transitions

```typescript
import { logStateTransition } from '@/00_kernel/telemetry/logger';

logStateTransition({
  entity: 'UploadQueue',
  entityId: 'queue-main',
  from: 'idle',
  to: 'processing',
  taskCount: 5
});
```

## Log Levels

| Level | Debug UI | Console | File | Use Case |
|-------|----------|---------|------|----------|
| `debug` | Verbose ON | DEV only | DEV only | Internal details |
| `info` | Verbose ON | Always | Always | Normal operations |
| `warn` | Always | Always | Always | Recoverable issues |
| `error` | Always | Always | Always | Failures |

### Debug UI Visibility

- `warn` and `error` are **always visible** in Debug panel
- `info` and `debug` require **Verbose mode ON**

## Event Naming Convention

### Format: `NOUN_VERB` or `NOUN_VERB_RESULT`

```typescript
// ✅ GOOD: Semantic event names
logger.info(EVENTS.UPLOAD_STARTED, { imageId });
logger.info(EVENTS.UPLOAD_COMPLETED, { imageId, s3Key });
logger.error(EVENTS.UPLOAD_FAILED, { imageId, error });

// ❌ BAD: Prose-style descriptions
logger.info('Starting upload...', { imageId });
logger.info('[Upload] Complete', { imageId });
```

### Rules

1. **Use UPPERCASE_SNAKE_CASE**
2. **Noun first**: What entity is affected
3. **Verb second**: What happened to it
4. **Result optional**: SUCCESS/FAILED/COMPLETED for outcomes

## Log Entry Structure

Every log entry contains:

```typescript
interface LogEntry {
  timestamp: string;    // ISO 8601: "2025-01-04T12:34:56.789Z"
  level: LogLevel;      // "debug" | "info" | "warn" | "error"
  event: string;        // Semantic event name: "UPLOAD_STARTED"
  traceId: string;      // Request correlation: "trace-abc123"
  userId?: string;      // User identifier (if authenticated)
  [key: string]: any;   // Custom data fields
}
```

Example output:
```json
{"timestamp":"2025-01-04T12:34:56.789Z","level":"info","event":"UPLOAD_STARTED","traceId":"trace-abc123","userId":"device-xyz789","imageId":"img-001","size":102400}
```

## Event Catalog

### Upload Lifecycle
| Event | Description | Data |
|-------|-------------|------|
| `UPLOAD_ENQUEUED` | Added to queue | `imageId`, `intentId`, `traceId` |
| `UPLOAD_STARTED` | Upload initiated | `imageId` |
| `UPLOAD_COMPLETED` | Upload successful | `imageId`, `traceId`, `s3Key` |
| `UPLOAD_FAILED` | Upload failed | `imageId`, `traceId`, `error`, `errorType` |
| `UPLOAD_QUEUE_RESUMED` | Queue resumed | `reason` |
| `UPLOAD_QUEUE_PAUSED` | Queue paused | `reason` |

### Image Processing
| Event | Description | Data |
|-------|-------------|------|
| `IMAGE_DROPPED` | Files dropped | `count` |
| `IMAGE_REJECTED` | Invalid files | `count`, `paths` |
| `IMAGE_PROCESSING_STARTED` | Processing begun | `imageId`, `traceId` |
| `IMAGE_PROCESSING_SKIPPED` | Processing skipped | `imageId`, `reason` |
| `IMAGE_COMPRESSED` | Compression done | `imageId`, `originalSize`, `compressedSize` |
| `IMAGE_COMPRESSION_FAILED` | Compression failed | `imageId`, `error` |
| `IMAGE_SAVED` | Saved to database | `imageId`, `md5` |
| `IMAGE_DUPLICATE` | Duplicate detected | `imageId`, `existingId`, `md5` |
| `IMAGE_CLEANUP` | Old images cleaned | `count` |

### Queue Management
| Event | Description | Data |
|-------|-------------|------|
| `QUEUE_RESTORED` | Queue restored from DB | `count` |
| `QUEUE_AUTO_PROCESS` | Auto-processing triggered | `phase`, `imageId` |
| `QUEUE_AUTO_UPLOAD` | Auto-upload triggered | `imageId`, `traceId` |

### Quota
| Event | Description | Data |
|-------|-------------|------|
| `QUOTA_CHECKED` | Quota verified | `used`, `limit`, `remaining` |
| `QUOTA_REFRESHED` | Quota fetched | `trigger` |
| `QUOTA_LIMIT_REACHED` | Limit exceeded | `reason`, `used`, `limit` |

### Authentication
| Event | Description | Data |
|-------|-------------|------|
| `AUTH_LOGIN_STARTED` | Login initiated | `method` |
| `AUTH_LOGIN_SUCCESS` | Login successful | `userId` |
| `AUTH_LOGIN_FAILED` | Login failed | `error` |
| `AUTH_LOGOUT` | User logged out | - |
| `AUTH_TOKEN_REFRESHED` | Token refreshed | - |
| `AUTH_SESSION_RESTORED` | Session restored | `userId` |
| `AUTH_GUEST_DATA_CLAIMED` | Guest data claimed | `count`, `oldUserId`, `newUserId` |
| `AUTH_REGISTER_STARTED` | Registration started | `email` |
| `AUTH_VERIFY_STARTED` | Verification started | `email` |
| `AUTH_LOAD_FAILED` | Auth load failed | `error` |
| `TOKEN_SAVED` | Token persisted | - |
| `USER_SAVED` | User persisted | - |
| `AUTH_DATA_CLEARED` | Auth data cleared | - |

### API
| Event | Description | Data |
|-------|-------------|------|
| `API_NOT_CONFIGURED` | API URL missing | - |
| `API_REQUEST_FAILED` | API request failed | `error` |
| `API_PARSE_FAILED` | Response parse failed | `error` |

### Drag-Drop
| Event | Description | Data |
|-------|-------------|------|
| `DRAG_ENTER` | Drag entered window | - |
| `DRAG_LEAVE` | Drag left window | - |
| `DRAG_DROP` | Files dropped | `count` |
| `DRAG_LISTENERS_REGISTERED` | Listeners set up | - |
| `DRAG_LISTENERS_REMOVED` | Listeners removed | - |

### Identity
| Event | Description | Data |
|-------|-------------|------|
| `DEVICE_ID_GENERATED` | Device ID created | `deviceId` |
| `DEVICE_ID_LOADED` | Device ID loaded | `deviceId` |

### Transaction
| Event | Description | Data |
|-------|-------------|------|
| `TRANSACTION_CREATED` | Transaction created | `transactionId` |
| `TRANSACTION_CONFIRMED` | Transaction confirmed | `transactionId` |
| `TRANSACTION_DELETED` | Transaction deleted | `transactionId` |

### Settings
| Event | Description | Data |
|-------|-------------|------|
| `SETTINGS_LOADED` | Settings loaded | `language`, `theme` |
| `SETTINGS_UPDATED` | Setting changed | `key`, `value` |
| `SETTINGS_SAVE_FAILED` | Save failed | `key`, `error` |

### Seed Data (Dev)
| Event | Description | Data |
|-------|-------------|------|
| `SEED_STARTED` | Seeding started | `scenario` |
| `SEED_COMPLETED` | Seeding completed | `count` |
| `SEED_FAILED` | Seeding failed | `error` |
| `SEED_CLEARED` | Seed data cleared | `count` |

### Mock Mode (Dev)
| Event | Description | Data |
|-------|-------------|------|
| `MOCK_MODE_CHANGED` | Mock mode toggled | `enabled` |

### Debug (Dev)
| Event | Description | Data |
|-------|-------------|------|
| `DEBUG_MENU_UNLOCKED` | Debug menu access | - |

### Report
| Event | Description | Data |
|-------|-------------|------|
| `REPORT_LOADED` | Report loaded | `date`, `count` |
| `REPORT_LOAD_FAILED` | Report load failed | `date`, `error` |

### System
| Event | Description | Data |
|-------|-------------|------|
| `APP_STARTED` | Application started | `version` |
| `APP_INITIALIZED` | App ready | `userId` |
| `APP_ERROR` | Unhandled error | `context`, `error` |
| `SERVICE_INITIALIZED` | Service ready | `service` |

### Network
| Event | Description | Data |
|-------|-------------|------|
| `NETWORK_STATUS_CHANGED` | Network state changed | `status` |

### Circuit Breaker
| Event | Description | Data |
|-------|-------------|------|
| `CIRCUIT_OPENED` | Circuit breaker opened | `failures`, `threshold` |
| `CIRCUIT_CLOSED` | Circuit breaker closed | - |
| `CIRCUIT_HALF_OPEN` | Circuit testing | - |

### Database
| Event | Description | Data |
|-------|-------------|------|
| `DB_INITIALIZED` | Database ready | `version` |
| `DB_MIGRATION_APPLIED` | Migration ran | `version`, `name` |
| `DATA_MIGRATED` | Data migrated | `count` |

### EventBus
| Event | Description | Data |
|-------|-------------|------|
| `EVENT_EMITTED` | Event emitted | `eventName` |
| `EVENT_SUBSCRIBED` | Event subscribed | `eventName` |

### State Transitions (FSM)
| Event | Description | Data |
|-------|-------------|------|
| `STATE_TRANSITION` | State machine change | `entity`, `entityId`, `from`, `to` |

## File Persistence

### Location
```
~/.yorutsuke/logs/
├── 2025-01-04.jsonl    # Today's logs
├── 2025-01-03.jsonl    # Yesterday
└── ...                 # 7 days retained
```

### Format: JSON Lines (.jsonl)
One JSON object per line for easy parsing:
```
{"timestamp":"...","level":"info","event":"APP_STARTED",...}
{"timestamp":"...","level":"info","event":"UPLOAD_STARTED",...}
```

### Rotation Policy
- One file per day
- Automatic cleanup of files older than 7 days
- Cleanup runs on app startup

## Viewing Logs

### Debug UI Panel
In-app Debug tab shows real-time logs with human-readable format.

### From Log Files
```bash
# View today's logs
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | jq .

# Filter by event
cat ~/.yorutsuke/logs/2025-01-04.jsonl | jq 'select(.event == "UPLOAD_FAILED")'

# Filter by traceId
cat ~/.yorutsuke/logs/2025-01-04.jsonl | jq 'select(.traceId == "trace-abc123")'

# Count events
cat ~/.yorutsuke/logs/2025-01-04.jsonl | jq -s 'group_by(.event) | map({event: .[0].event, count: length})'
```

## Best Practices

### DO ✅
```typescript
// Use semantic event names
logger.info(EVENTS.UPLOAD_STARTED, { imageId });

// Pass Error objects directly (auto-normalized)
logger.error(EVENTS.UPLOAD_FAILED, error);

// Use timer for performance tracking
const timer = createTimer();
await operation();
timer.logDuration(EVENTS.OPERATION_COMPLETED, { id });

// Log state transitions with logStateTransition
logStateTransition({ entity: 'Queue', entityId: 'main', from: 'idle', to: 'processing' });
```

### DON'T ❌
```typescript
// Don't use prose-style messages
logger.info('Starting upload...', { imageId });  // ❌

// Don't manually extract Error properties
logger.error(EVENTS.UPLOAD_FAILED, { message: error.message });  // ❌

// Don't log sensitive data without filtering
logger.info('User logged in', { password: 'secret' });  // ❌ (auto-filtered anyway)

// Don't ignore timer instances
const timer = createTimer();
await operation();
// Never used timer.duration() or timer.logDuration()  // ❌
```

## Troubleshooting

### Issue: Debug logs not showing
**Problem**: `logger.debug()` calls don't appear in console or Debug UI

**Solutions**:
1. Check if in production mode: `debug` logs are DEV-only by default
2. Set `LOG_LEVEL=debug` in environment variables
3. Verify Debug UI Verbose mode is ON

### Issue: Sensitive data still visible
**Problem**: API keys or passwords appear in logs

**Solutions**:
1. Check field naming: Must include sensitive keywords (e.g., `password`, `token`, `apiKey`)
2. Check depth: Filtering stops at depth 5
3. Submit PR to add new sensitive keyword to `SENSITIVE_KEYS` array

### Issue: Error object shows as empty
**Problem**: `logger.error(EVENTS.FAILED, error)` logs `{}`

**Solution**: This should not happen (auto-normalized). If it does:
1. Check if `error` is actually an Error instance: `error instanceof Error`
2. Check if error has enumerable properties (non-standard Error)
3. File a bug report with reproduction steps

### Issue: Timer duration is 0
**Problem**: `timer.duration()` returns 0 or very small values

**Solutions**:
1. Check if operation is synchronous (no `await`)
2. Check if using correct timer instance
3. Verify operation actually takes time (add artificial delay for testing)

### Issue: Circular reference crash
**Problem**: `JSON.stringify()` throws "Converting circular structure to JSON"

**Solution**: This should not happen (auto-handled with WeakSet). If it does:
1. Check logger version (should be post-Issue #158)
2. File a bug report with reproduction case

## Testing

The logging system has comprehensive test coverage (58 tests):

### Unit Tests
- **normalizeErrorData** (7 tests): Error extraction, TypeError, ReferenceError, non-Error objects, primitives
- **filterSensitiveData** (11 tests): Password, token, apiKey, nested objects, arrays, case-insensitive, depth limit
- **LOG_LEVEL Control** (8 tests): Default level, debug/warn/error levels, invalid level, DEV mode override
- **createTimer** (6 tests): Duration tracking, logDuration, log method, independent instances

### Integration Tests
- **Logger + ContextProvider** (5 tests): TraceId propagation, undefined context, provider changes
- **Logger + Debug UI** (3 tests): Debug log calls, normalized data, level mapping
- **End-to-End Flows** (4 tests): Error→normalize→filter→log, Timer+Error+context, LOG_LEVEL filtering
- **logStateTransition** (2 tests): Required fields, context integration

### Edge Cases
- **Error Flows** (8 tests): Circular references, large objects, null prototype, symbols, Date objects
- **Constants** (5 tests): Event names, count, naming convention, numeric precedence

Run tests:
```bash
npm test -- logger.test.ts
```

## Implementation Files

| File | Purpose |
|------|---------|
| `app/src/00_kernel/telemetry/logger.ts` | Logger + EVENTS + Debug UI bridge |
| `app/src/00_kernel/telemetry/__tests__/logger.test.ts` | Comprehensive test suite (58 tests) |
| `app/src/00_kernel/telemetry/traceContext.tsx` | TraceId context provider |
| `app/src/02_modules/debug/headless/debugLog.ts` | Debug UI log store |
| `app/src-tauri/src/logging.rs` | Tauri log_write command |

## Related Pillars

- **Pillar R**: Observability - JSON semantic logs
- **Pillar N**: Context - TraceId propagation
- **Pillar G**: Traceability - Event flow tracking
- **Pillar D**: FSM - State transition logging
