# Logging System Design

> Pillar R: Semantic Observability - Structured JSON Logs

## Overview

Yorutsuke uses a semantic logging system designed for machine parsing and debugging. All logs are JSON-formatted with consistent structure across frontend and backend.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  logger.info(EVENTS.UPLOAD_STARTED, { imageId, traceId })   │
└─────────────────────────┬───────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            │                           │
            ▼                           ▼
    ┌───────────────┐          ┌────────────────┐
    │   Console     │          │  Tauri IPC     │
    │   (always)    │          │  log_write     │
    └───────────────┘          └───────┬────────┘
                                       │
                                       ▼
                          ┌────────────────────────┐
                          │     Local File         │
                          │ ~/.yorutsuke/logs/     │
                          │ YYYY-MM-DD.jsonl       │
                          └────────────────────────┘
```

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

Example:
```json
{"timestamp":"2025-01-04T12:34:56.789Z","level":"info","event":"UPLOAD_STARTED","traceId":"trace-abc123","userId":"device-xyz789","imageId":"img-001","size":102400}
```

## Event Naming Convention

### Format: `NOUN_VERB` or `NOUN_VERB_RESULT`

| Pattern | Example | Use Case |
|---------|---------|----------|
| `NOUN_VERB` | `UPLOAD_STARTED` | Operation started |
| `NOUN_VERB_RESULT` | `AUTH_LOGIN_FAILED` | Operation with outcome |
| `STATE_TRANSITION` | `STATE_TRANSITION` | FSM state change (with `from`/`to`) |

### Rules

1. **Use UPPERCASE_SNAKE_CASE**
2. **Noun first**: What entity is affected
3. **Verb second**: What happened to it
4. **Result optional**: SUCCESS/FAILED/COMPLETED for outcomes

### Anti-patterns

```typescript
// ❌ BAD: Prose-style descriptions
logger.info('[Identity] Generated new Device ID', { deviceId });
logger.info('[CircuitBreaker] Closed - service recovered');

// ✅ GOOD: Semantic event names
logger.info(EVENTS.DEVICE_ID_GENERATED, { deviceId });
logger.info(EVENTS.CIRCUIT_CLOSED);
```

## Event Catalog

### Upload Lifecycle
| Event | Description | Data |
|-------|-------------|------|
| `UPLOAD_STARTED` | Upload initiated | `imageId`, `size` |
| `UPLOAD_COMPLETED` | Upload successful | `imageId`, `s3Key` |
| `UPLOAD_FAILED` | Upload failed | `imageId`, `error`, `errorType` |
| `UPLOAD_QUEUE_RESUMED` | Queue resumed | `pendingCount` |
| `UPLOAD_QUEUE_PAUSED` | Queue paused | `reason` |

### Image Processing
| Event | Description | Data |
|-------|-------------|------|
| `IMAGE_COMPRESSED` | Compression done | `imageId`, `originalSize`, `compressedSize` |
| `IMAGE_COMPRESSION_FAILED` | Compression failed | `imageId`, `error` |
| `IMAGE_SAVED` | Saved to database | `imageId`, `md5` |
| `IMAGE_DUPLICATE` | Duplicate detected | `imageId`, `existingId`, `md5` |

### Quota
| Event | Description | Data |
|-------|-------------|------|
| `QUOTA_CHECKED` | Quota verified | `used`, `limit`, `remaining` |
| `QUOTA_LIMIT_REACHED` | Limit exceeded | `used`, `limit` |

### Authentication
| Event | Description | Data |
|-------|-------------|------|
| `AUTH_LOGIN_STARTED` | Login initiated | `method` |
| `AUTH_LOGIN_SUCCESS` | Login successful | `userId` |
| `AUTH_LOGIN_FAILED` | Login failed | `error` |
| `AUTH_LOGOUT` | User logged out | - |
| `AUTH_TOKEN_REFRESHED` | Token refreshed | - |

### Identity
| Event | Description | Data |
|-------|-------------|------|
| `DEVICE_ID_GENERATED` | New device ID | `deviceId` |
| `DEVICE_ID_LOADED` | Existing device ID loaded | `deviceId` |

### Transaction
| Event | Description | Data |
|-------|-------------|------|
| `TRANSACTION_CREATED` | Transaction created | `transactionId`, `amount` |
| `TRANSACTION_CONFIRMED` | User confirmed | `transactionId` |
| `TRANSACTION_DELETED` | Transaction deleted | `transactionId` |

### Report
| Event | Description | Data |
|-------|-------------|------|
| `REPORT_LOADED` | Report fetched | `date`, `count` |
| `REPORT_LOAD_FAILED` | Report fetch failed | `date`, `error` |

### System
| Event | Description | Data |
|-------|-------------|------|
| `APP_STARTED` | Application started | `version` |
| `APP_ERROR` | Unhandled error | `error`, `stack` |
| `CIRCUIT_OPENED` | Circuit breaker opened | `failures`, `threshold` |
| `CIRCUIT_CLOSED` | Circuit breaker closed | - |
| `CIRCUIT_HALF_OPEN` | Circuit testing | - |

### Network
| Event | Description | Data |
|-------|-------------|------|
| `NETWORK_STATUS_CHANGED` | Online/offline change | `online` |

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
├── 2025-01-02.jsonl
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

### Tauri Command
```rust
#[tauri::command]
fn log_write(entry: LogEntry) -> Result<(), String>
```

## Usage Examples

### Basic Logging
```typescript
import { logger, EVENTS } from '@/00_kernel/telemetry/logger';

// Info level
logger.info(EVENTS.UPLOAD_STARTED, { imageId: 'img-001', size: 1024 });

// Error with details
logger.error(EVENTS.UPLOAD_FAILED, {
  imageId: 'img-001',
  error: 'Network timeout',
  errorType: 'network'
});
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

### With TraceId Context
```typescript
// TraceId is automatically injected from TraceProvider context
// No need to pass explicitly
logger.info(EVENTS.IMAGE_COMPRESSED, {
  imageId: 'img-001',
  originalSize: 2048000,
  compressedSize: 512000
});
// Output includes traceId from context
```

## Log Levels

| Level | Console | File | Use Case |
|-------|---------|------|----------|
| `debug` | DEV only | DEV only | Verbose debugging |
| `info` | Always | Always | Normal operations |
| `warn` | Always | Always | Recoverable issues |
| `error` | Always | Always | Failures requiring attention |

## Viewing Logs

### During Development
Logs appear in browser DevTools console as JSON strings.

### From Log Files
```bash
# View today's logs
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | jq .

# Filter by event
cat ~/.yorutsuke/logs/2025-01-04.jsonl | jq 'select(.event == "UPLOAD_FAILED")'

# Filter by traceId
cat ~/.yorutsuke/logs/2025-01-04.jsonl | jq 'select(.traceId == "trace-abc123")'
```

## Implementation Files

| File | Purpose |
|------|---------|
| `app/src/00_kernel/telemetry/logger.ts` | Frontend logger + EVENTS |
| `app/src/00_kernel/telemetry/traceContext.tsx` | TraceId context provider |
| `app/src-tauri/src/logging.rs` | Tauri log_write command |
| `infra/lambda/shared/logger.mjs` | Lambda logger (mirrors frontend) |

## Related Pillars

- **Pillar R**: Observability - JSON semantic logs
- **Pillar N**: Context - TraceId propagation
- **Pillar G**: Traceability - Event flow tracking
- **Pillar D**: FSM - State transition logging
