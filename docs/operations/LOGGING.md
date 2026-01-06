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
