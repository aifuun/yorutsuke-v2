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
| `UPLOAD_ENQUEUED` | Added to queue | `imageId`, `intentId` |
| `UPLOAD_STARTED` | Upload initiated | `imageId`, `size` |
| `UPLOAD_COMPLETED` | Upload successful | `imageId`, `s3Key` |
| `UPLOAD_FAILED` | Upload failed | `imageId`, `error`, `errorType` |
| `UPLOAD_QUEUE_RESUMED` | Queue resumed | `reason` |
| `UPLOAD_QUEUE_PAUSED` | Queue paused | `reason` |

### Image Processing
| Event | Description | Data |
|-------|-------------|------|
| `IMAGE_DROPPED` | Files dropped | `count` |
| `IMAGE_REJECTED` | Invalid files | `count`, `paths` |
| `IMAGE_COMPRESSED` | Compression done | `imageId`, `originalSize`, `compressedSize` |
| `IMAGE_COMPRESSION_FAILED` | Compression failed | `imageId`, `error` |
| `IMAGE_SAVED` | Saved to database | `imageId`, `md5` |
| `IMAGE_DUPLICATE` | Duplicate detected | `imageId`, `existingId`, `md5` |

### Quota
| Event | Description | Data |
|-------|-------------|------|
| `QUOTA_CHECKED` | Quota verified | `used`, `limit`, `remaining` |
| `QUOTA_REFRESHED` | Quota fetched | `trigger` |
| `QUOTA_LIMIT_REACHED` | Limit exceeded | `used`, `limit` |

### Authentication
| Event | Description | Data |
|-------|-------------|------|
| `AUTH_LOGIN_STARTED` | Login initiated | `method` |
| `AUTH_LOGIN_SUCCESS` | Login successful | `userId` |
| `AUTH_LOGIN_FAILED` | Login failed | `error` |
| `AUTH_LOGOUT` | User logged out | - |
| `AUTH_TOKEN_REFRESHED` | Token refreshed | - |

### Settings
| Event | Description | Data |
|-------|-------------|------|
| `SETTINGS_LOADED` | Settings loaded | `language`, `theme` |
| `SETTINGS_UPDATED` | Setting changed | `key`, `value` |

### System
| Event | Description | Data |
|-------|-------------|------|
| `APP_STARTED` | Application started | `version` |
| `APP_INITIALIZED` | App ready | `userId` |
| `APP_ERROR` | Unhandled error | `error`, `stack` |
| `SERVICE_INITIALIZED` | Service ready | `service` |

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

## Implementation Files

| File | Purpose |
|------|---------|
| `app/src/00_kernel/telemetry/logger.ts` | Logger + EVENTS + Debug UI bridge |
| `app/src/00_kernel/telemetry/traceContext.tsx` | TraceId context provider |
| `app/src/02_modules/debug/headless/debugLog.ts` | Debug UI log store |
| `app/src-tauri/src/logging.rs` | Tauri log_write command |

## Related Pillars

- **Pillar R**: Observability - JSON semantic logs
- **Pillar N**: Context - TraceId propagation
- **Pillar G**: Traceability - Event flow tracking
- **Pillar D**: FSM - State transition logging
