# AI_DEV_PROT v15 Cheatsheet

> Quick reference for Tauri + React + AWS CDK

## Tier Classification

```
T1 Direct    │ Read-only, simple UI       │ View → Adapter
T2 Logic     │ Forms, local state, FSM    │ View → Headless → Adapter
T3 Saga      │ Distributed writes, $$$    │ View → Saga → [Adapters]
```

## 18 Pillars Quick Reference

### Q1: Data Integrity
| ID | Name | Rule | Check |
|----|------|------|-------|
| A | Nominal Typing | No primitives for IDs | `UserId = string & {...}` |
| B | Airlock | Validate + upcast at boundary | Schema.parse() |
| C | Mocking | Generate from schema | zod-mock, faker |
| D | FSM | No boolean flags | `'idle'\|'loading'\|'error'` |

### Q2: Flow & Concurrency
| ID | Name | Rule | Check |
|----|------|------|-------|
| E | Orchestration | Match tier to pattern | T1/T2/T3 |
| F | Concurrency | CAS before T3 writes | `ver === expected` |
| Q | Idempotency | Intent-ID for T3 | `Cache.has(intentId)` |

### Q3: Structure & Boundaries
| ID | Name | Rule | Check |
|----|------|------|-------|
| G | Traceability | `@trigger/@listen` comments | AI can follow |
| H | Policy | Auth separate from flow | `Policy.assert()` |
| I | Firewalls | No deep imports | `import from '../index'` |
| J | Locality | State near usage | No global pollution |
| K | Testing | Pyramid by layer | Domain=Unit, Saga=Int |
| L | Headless | Logic ≠ UI | No JSX in hooks |

### Q4: Resilience & Observability
| ID | Name | Rule | Check |
|----|------|------|-------|
| M | Saga | Every step has undo | `compensationStack` |
| N | Context | TraceID everywhere | `ctx.traceId` |
| O | Async | Long ops → 202 + poll | Job-ID pattern |
| P | Circuit | Fail fast on errors | Safe mode fallback |
| R | Observability | JSON semantic logs | `{saga,from,to,traceId}` |

## Key Concepts (AI Reference)

### traceId vs intentId (BUG-002)

```
┌─────────────────────────────────────────────────────────────┐
│ traceId                                                     │
│ - Scope: Single HTTP/IPC request                            │
│ - Purpose: Log correlation, distributed tracing             │
│ - Created: Once per request (middleware)                    │
│ - Example: "trace-abc-123"                                  │
├─────────────────────────────────────────────────────────────┤
│ intentId                                                    │
│ - Scope: Single user action (may span retries)              │
│ - Purpose: Idempotency, prevent duplicate operations        │
│ - Created: Once per command (client-side)                   │
│ - Example: "intent-xyz-789"                                 │
└─────────────────────────────────────────────────────────────┘

Multiple requests can share same intentId (retries).
Multiple commands can share same traceId (batch).
```

## T3 Entry Template

```typescript
async function processSaga(cmd: Command) {
  // 1. Idempotency (Pillar Q)
  const cached = await Cache.get(`intent:${cmd.intentId}`);
  if (cached) return cached;

  // 2. Concurrency (Pillar F)
  const entity = await Repo.get(cmd.entityId);
  if (entity.version !== cmd.expectedVersion) {
    throw new StaleDataError();
  }

  // 3. Saga (Pillar M)
  const compensations = [];
  try {
    compensations.push(() => undoStep1());
    await step1();
    // ...
  } catch (e) {
    while (compensations.length) await compensations.pop()();
    throw e;
  }

  // 4. Cache result
  await Cache.set(`intent:${cmd.intentId}`, result);
  return result;
}
```

## Checklist Locations

| Phase | File |
|-------|------|
| Before coding | `.prot/checklists/pre-code.md` |
| During coding | `.prot/checklists/in-code.md` |
| After coding | `.prot/checklists/post-code.md` |

## Command Integration

```
*tier    → Classify task complexity
*next    → Execute with in-code checks
*issue close → Run post-code review
```

## Anti-Patterns (Never Do)

```typescript
// ❌ Primitive ID
function getUser(id: string) { }

// ❌ Boolean flags
const [isLoading, setIsLoading] = useState(false);

// ❌ Deep import
import { Button } from '../auth/components/internal/Button';

// ❌ T3 without idempotency
async function pay(amount) { await charge(amount); }

// ❌ Text logs
log.info("Payment failed");
```

## Quick Commands

```bash
# Tauri
npm run tauri dev

# CDK
cd infra && cdk diff --profile dev
cd infra && cdk deploy --profile dev
```
