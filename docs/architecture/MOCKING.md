# Mocking Strategy

> Design strategy and implementation patterns for mock mode.
>
> **Pillar C**: Generate mock data from schema for consistent testing.

## Overview

Mock mode enables UI development without AWS backend dependencies.

```
┌─────────────────────────────────────────────────────────────┐
│                        App Layer                             │
├─────────────────────────────────────────────────────────────┤
│  React Components → Services → Adapters                     │
│                                    ↓                        │
│                          ┌─────────────────┐                │
│                          │   USE_MOCK ?    │                │
│                          └────────┬────────┘                │
│                                   │                         │
│                    ┌──────────────┴──────────────┐          │
│                    ↓                             ↓          │
│             Mock Response                  Real API         │
│             (local data)                   (Lambda/S3)      │
└─────────────────────────────────────────────────────────────┘
```

## Design Decisions

### Centralized Configuration

**Decision**: Single source of truth for mock state.

```typescript
// 00_kernel/config/mock.ts
export const USE_MOCK =
  import.meta.env.VITE_USE_MOCK === 'true' ||
  (!import.meta.env.VITE_LAMBDA_PRESIGN_URL &&
   !import.meta.env.VITE_LAMBDA_QUOTA_URL &&
   !import.meta.env.VITE_LAMBDA_CONFIG_URL);
```

**Trigger conditions**:
1. Explicit: `VITE_USE_MOCK=true` in `.env.local`
2. Implicit: No Lambda URLs configured (fallback for new developers)

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
import { USE_MOCK, mockDelay } from '00_kernel/config/mock';

// 1. Define mock data generator
function createMockData(): SomeResponse {
  return {
    id: `mock-${Date.now()}`,
    value: Math.random() * 100,
  };
}

// 2. Check USE_MOCK at function start
export async function fetchSomething(id: string): Promise<SomeResponse> {
  if (USE_MOCK) {
    await mockDelay();
    console.log('[Mock] fetchSomething:', id);
    return createMockData();
  }

  // Real implementation
  const response = await fetch(`${API_URL}/something/${id}`);
  return SomeResponseSchema.parse(await response.json());
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
| `quotaApi.ts` | ✅ Complete | Random usage (0-10), fixed limits |
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

### Enable Mock Mode

```bash
cd app

# Option 1: Explicit
echo "VITE_USE_MOCK=true" > .env.local
npm run tauri dev

# Option 2: Implicit (no Lambda URLs)
echo "" > .env.local
npm run tauri dev
```

### Verify Mock Mode Active

1. **Console**: Look for `[Mock] Mode: ENABLED` at startup
2. **UI**: Orange banner at top: "MOCK MODE - Data is simulated"
3. **Logs**: API calls prefixed with `[Mock]`

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

## References

- [README.md](../README.md) - Quick start for mock mode
- [INTERFACES.md](./INTERFACES.md) - API specifications being mocked
- [MVP_PLAN.md](../planning/MVP_PLAN.md) - Testing phases

---

*Last updated: 2026-01-05*
