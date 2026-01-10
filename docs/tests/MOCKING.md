# Mocking Strategy

> Design strategy and implementation patterns for mock mode.
>
> **Pillar C**: Generate mock data from schema for consistent testing.

## Overview

Mock mode enables UI development and testing without AWS backend dependencies.

> **Note**: Mock mode is controlled via the Debug panel. The Debug panel requires `VITE_DEBUG_PANEL=true` in `.env.local` during development and is **automatically disabled** in release builds. See [DEBUG_PANEL.md](../operations/DEBUG_PANEL.md) for access details.

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

**Decision**: Single source of truth for mock state with runtime toggle and persistence.

```typescript
// 00_kernel/config/mock.ts
export type MockMode = 'off' | 'online' | 'offline';

// Default mode is always 'off'
const DEFAULT_MODE: MockMode = 'off';

// Runtime state
let _mockMode: MockMode = DEFAULT_MODE;

// Check functions
export function isMockingOnline(): boolean {
  return _mockMode === 'online';
}

export function isMockingOffline(): boolean {
  return _mockMode === 'offline';
}

// Load from DB on startup
export async function loadMockMode(): Promise<void> {
  const saved = await getSetting('mock_mode');
  if (saved) _mockMode = saved;
}

// Set and persist to DB
export function setMockMode(mode: MockMode): void {
  _mockMode = mode;
  setSetting('mock_mode', mode);  // Persist
  // ... notify listeners
}
```

**Initialization flow**:
1. App starts with `DEFAULT_MODE = 'off'`
2. **Production**: `loadMockMode()` skips DB read, stays `'off'`
3. **Development**: `loadMockMode()` reads saved value from SQLite

**Production Safety**: In production builds (`import.meta.env.PROD`), mock mode is always `'off'` and DB is never read. This ensures end users cannot accidentally enable mock mode, even if a value was persisted during development.

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
import { isMockingOnline, isMockingOffline, mockDelay } from '00_kernel/config/mock';

// 1. Define mock data generator
function createMockData(): SomeResponse {
  return {
    id: `mock-${Date.now()}`,
    value: Math.random() * 100,
  };
}

// 2. Check modes at function start (order matters!)
export async function fetchSomething(id: string): Promise<SomeResponse> {
  // First: check offline mode (throws error)
  if (isMockingOffline()) {
    await mockDelay(100);
    throw new Error('Network error: offline mode');
  }

  // Second: check online mock mode (returns mock data)
  if (isMockingOnline()) {
    await mockDelay();
    console.log('[Mock] fetchSomething:', id);
    return createMockData();
  }

  // Third: real API call
  const response = await fetch(`${API_URL}/something/${id}`);
  return SomeResponseSchema.parse(await response.json());
}
```

### Check Order Pattern

All adapters should follow this order:

```typescript
// 1. Offline first (simulate network failure)
if (isMockingOffline()) throw new Error('Network error');

// 2. Online mock (return fake data)
if (isMockingOnline()) return mockData;

// 3. Real API call
return await realApiCall();
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

### Prerequisites: Enable Debug Panel

**First-time setup**:

1. Open or create `app/.env.local`
2. Add: `VITE_DEBUG_PANEL=true`
3. Restart dev server

See [DEBUG.md](../../app/DEBUG.md) for detailed configuration guide.

### Enable Mock Mode (Debug Panel)

1. Start the app: `npm run tauri dev`
2. Navigate to Debug tab in sidebar (debug icon)
3. Find "Mock Mode" dropdown
4. Select mode:
   - **Off (Real API)**: Use real backend
   - **Online (Mock API)**: Use mock responses
   - **Offline (Network Fail)**: Simulate network failure

The setting is **persisted to SQLite** - it will be restored on next app start (development only).

### Verify Mock Mode Active

1. **UI Banner**: Orange/red banner at top shows current mode
2. **Debug Panel**: Check "Mock Mode" dropdown value
3. **Logs**: API calls show mock behavior in Debug logs

### Test Session Recovery (SC-501)

1. Set Mock Mode to **"Offline (Network Fail)"**
2. Drop a receipt image
3. Image compresses → upload fails → stays in queue
4. Close app (Cmd+Q)
5. Reopen → queue should restore with pending item

### Use Real Backend

1. Configure Lambda URLs in `.env.local`:
   ```bash
   VITE_LAMBDA_PRESIGN_URL=https://xxx.lambda-url.ap-northeast-1.on.aws
   VITE_LAMBDA_QUOTA_URL=https://yyy.lambda-url.ap-northeast-1.on.aws
   ```
2. Set Mock Mode to **"Off (Real API)"** in Debug panel

---

## API Reference

```typescript
// 00_kernel/config/mock.ts

// Types
type MockMode = 'off' | 'online' | 'offline';

// Read state
function getMockMode(): MockMode;
function isMockingOnline(): boolean;    // true when 'online'
function isMockingOffline(): boolean;   // true when 'offline'

// Write state (persists to DB)
function setMockMode(mode: MockMode): void;

// Initialize (call on app start)
function loadMockMode(): Promise<void>;

// React integration
function subscribeMockMode(listener: () => void): () => void;
function getMockSnapshot(): MockMode;  // for useSyncExternalStore

// Utility
function mockDelay(ms?: number): Promise<void>;

// Legacy (deprecated - do not use)
const USE_MOCK = false;                     // Always false, use isMockingOnline()
const isMockEnabled = isMockingOnline;      // Alias, use isMockingOnline()
const isOfflineEnabled = isMockingOffline;  // Alias, use isMockingOffline()
```

---

## References

- [DEBUG_PANEL.md](../operations/DEBUG_PANEL.md) - Debug panel access and configuration
- [DEBUG.md](../../app/DEBUG.md) - Quick developer guide for debug panel setup
- [INTERFACES.md](../architecture/INTERFACES.md) - API specifications being mocked
- [MVP_PLAN.md](../dev/MVP_PLAN.md) - MVP Roadmap Index
- [PRODUCTION_SECURITY.md](../operations/PRODUCTION_SECURITY.md) - Production build security

---

*Last updated: 2026-01-10*
