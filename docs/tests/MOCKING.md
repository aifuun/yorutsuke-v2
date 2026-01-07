# Mocking Strategy

> Design strategy and implementation patterns for mock mode.
>
> **Pillar C**: Generate mock data from schema for consistent testing.

## Overview

Mock mode enables UI development and testing without AWS backend dependencies.

```
┌─────────────────────────────────────────────────────────────┐
│                        App Layer                             │
├─────────────────────────────────────────────────────────────┤
│  React Components → Services → Adapters                     │
│                                    ↓                        │
│                          ┌─────────────────┐                │
│                          │   MockMode ?    │                │
│                          └────────┬────────┘                │
│                                   │                         │
│                    ┌──────────────┼──────────────┐          │
│                    ↓              ↓              ↓          │
│                  'off'       'online'       'offline'       │
│                Real API     Mock Data     Network Fail      │
└─────────────────────────────────────────────────────────────┘
```

## Mock Modes

| Mode | Value | Behavior | Use Case |
|------|-------|----------|----------|
| **Off** | `'off'` | Real API calls | Production, integration testing |
| **Online** | `'online'` | Mock API responses | UI development |
| **Offline** | `'offline'` | Simulated network failure | Session recovery testing |

### Runtime Toggle

Mock mode can be changed at runtime via Debug tab:

```
Debug → Mock Mode → [Off (Real API) / Online (Mock API) / Offline (Network Fail)]
```

---

## Design Decisions

### Centralized Configuration

**Decision**: Single source of truth for mock state with runtime toggle.

```typescript
// 00_kernel/config/mock.ts
export type MockMode = 'off' | 'online' | 'offline';

// Initial mode based on environment
const INITIAL_MODE: MockMode =
  import.meta.env.VITE_USE_MOCK === 'true'
    ? 'online'
    : HAS_REAL_BACKEND
      ? 'off'
      : 'online';

// Runtime state
let _mockMode: MockMode = INITIAL_MODE;

// Check functions
export function isMockEnabled(): boolean {
  return _mockMode === 'online';
}

export function isOfflineEnabled(): boolean {
  return _mockMode === 'offline';
}

// Runtime toggle
export function setMockMode(mode: MockMode): void {
  _mockMode = mode;
  // ... notify listeners
}
```

**Trigger conditions for initial mode**:
1. Explicit: `VITE_USE_MOCK=true` → starts in `'online'` mode
2. No Lambda URLs configured → starts in `'online'` mode (fallback)
3. Lambda URLs configured → starts in `'off'` mode

### Per-Adapter Mocking

**Decision**: Mock at adapter function level, not at service level.

```
❌ Service level (too high)
   → Hard to test real service logic with mock data

❌ HTTP client level (too low)
   → Requires complex request matching

✅ Adapter function level (just right)
   → Each function decides mock vs real
   → Easy to add/remove mocks
   → Clear separation
```

### Simulated Latency

**Decision**: Add artificial delay to mock responses.

```typescript
export function mockDelay(ms?: number): Promise<void> {
  const delay = ms ?? Math.floor(Math.random() * 300) + 200;
  return new Promise(resolve => setTimeout(resolve, delay));
}
```

**Rationale**:
- UI should handle loading states correctly
- Prevents "works in mock, fails in prod" issues
- 200-500ms simulates realistic network conditions

---

## Implementation Pattern

### Adding Mock to New Adapter

```typescript
// adapters/someApi.ts
import { isMockEnabled, mockDelay } from '00_kernel/config/mock';

// 1. Define mock data generator
function createMockData(): SomeResponse {
  return {
    id: `mock-${Date.now()}`,
    value: Math.random() * 100,
  };
}

// 2. Check isMockEnabled() at function start (runtime check)
export async function fetchSomething(id: string): Promise<SomeResponse> {
  if (isMockEnabled()) {
    await mockDelay();
    console.log('[Mock] fetchSomething:', id);
    return createMockData();
  }

  // Real implementation
  const response = await fetch(`${API_URL}/something/${id}`);
  return SomeResponseSchema.parse(await response.json());
}
```

### Offline Mode in Services

For services that need to test network failure scenarios:

```typescript
// services/uploadService.ts
import { isOfflineEnabled } from '00_kernel/config/mock';

async function processUpload(file: File): Promise<void> {
  // Check offline mode BEFORE network operations
  if (isOfflineEnabled()) {
    throw new Error('Offline mode enabled (debug)');
  }

  // Proceed with upload...
}
```

### Mock Data Guidelines

| Guideline | Example |
|-----------|---------|
| Use realistic values | `amount: 1234` not `amount: 999999` |
| Include edge cases | Empty arrays, null fields |
| Add randomness | `Math.random()` for variety |
| Log mock calls | `console.log('[Mock]', ...)` |

---

## Current Coverage

| Adapter | Mock Status | Mock Behavior |
|---------|-------------|---------------|
| `uploadApi.ts` | ✅ Complete | Fake presign URL, simulated S3 upload |
| `quotaApi.ts` | ✅ Complete | Queries local DB (real count), mock tier |
| `reportApi.ts` | ✅ Complete | 8 random transactions |
| `authApi.ts` | ⚠️ Partial | Guest mode only |
| `imageIpc.ts` | ❌ None | Uses real Rust IPC (local) |

### What's NOT Mocked

| Component | Reason |
|-----------|--------|
| Rust IPC (compress) | Local operation, no network |
| SQLite | Local database, always real |
| Tauri events | System events, always real |

---

## MVP Testing Matrix

| MVP | Mock Mode | Real Backend | Notes |
|-----|-----------|--------------|-------|
| MVP0 | ✅ Full | Not needed | Architecture refactor only |
| MVP1 | ✅ Full | Not needed | Local compression, dedup |
| MVP2 | ⚠️ Partial | Recommended | Upload mocked, can't verify S3 |
| MVP3 | ❌ Limited | Required | AI processing needs Bedrock |
| MVP3.5 | ❌ Limited | Required | Cloud sync needs DynamoDB |
| MVP4 | ❌ Limited | Required | Auth needs Cognito |

---

## Usage

### Enable Mock Mode (Development)

```bash
cd app

# Option 1: Explicit
echo "VITE_USE_MOCK=true" > .env.local
npm run tauri dev

# Option 2: Implicit (no Lambda URLs)
echo "" > .env.local
npm run tauri dev
```

### Runtime Toggle (Debug Tab)

1. Open app → Debug tab
2. Find "Mock Mode" dropdown
3. Select mode:
   - **Off (Real API)**: Use real backend
   - **Online (Mock API)**: Use mock responses
   - **Offline (Network Fail)**: Simulate network failure

### Verify Mock Mode Active

1. **Console**: Look for `[Mock] Mode: ENABLED` at startup
2. **UI**: Orange banner at top: "MOCK MODE - Data is simulated"
3. **Logs**: API calls prefixed with `[Mock]`

### Test Session Recovery (SC-501)

1. Set Mock Mode to **"Offline (Network Fail)"**
2. Drop a receipt image
3. Image compresses → upload fails → stays in queue
4. Close app (Cmd+Q)
5. Reopen → queue should restore with pending item

### Disable Mock Mode

```bash
# Configure real Lambda URLs
cat > .env.local << EOF
VITE_LAMBDA_PRESIGN_URL=https://xxx.lambda-url.ap-northeast-1.on.aws
VITE_LAMBDA_QUOTA_URL=https://yyy.lambda-url.ap-northeast-1.on.aws
EOF

npm run tauri dev
```

---

## API Reference

```typescript
// 00_kernel/config/mock.ts

// Types
type MockMode = 'off' | 'online' | 'offline';

// Read state
function getMockMode(): MockMode;
function isMockEnabled(): boolean;      // true when 'online'
function isOfflineEnabled(): boolean;   // true when 'offline'

// Write state
function setMockMode(mode: MockMode): void;

// React integration
function subscribeMockMode(listener: () => void): () => void;
function getMockSnapshot(): MockMode;  // for useSyncExternalStore

// Utility
function mockDelay(ms?: number): Promise<void>;

// Legacy (deprecated)
const USE_MOCK: boolean;  // Use isMockEnabled() instead
function setMockEnabled(enabled: boolean): void;  // Use setMockMode() instead
```

---

## References

- [README.md](../README.md) - Quick start for mock mode
- [INTERFACES.md](../architecture/INTERFACES.md) - API specifications being mocked
- [MVP_PLAN.md](../dev/MVP_PLAN.md) - Testing phases

---

*Last updated: 2026-01-07*
