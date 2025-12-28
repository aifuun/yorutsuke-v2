# Pillar Query Command

View detailed information about a specific Pillar.

## Usage

```
*pillar <X>       # View Pillar X (e.g., *pillar A, *pillar M)
*pillar list      # List all 18 Pillars
```

## Workflow

### *pillar list

Output summary of all Pillars:

```markdown
## AI_DEV_PROT v15 Pillars

### Q1: Data Integrity
| ID | Name | Rule |
|----|------|------|
| A | Nominal Typing | No primitives for IDs |
| B | Airlock | Validate at boundary |
| C | Mocking | Generate from schema |
| D | FSM | No boolean flags |

### Q2: Flow & Concurrency
| ID | Name | Rule |
|----|------|------|
| E | Orchestration | Match tier to pattern |
| F | Concurrency | CAS before writes |
| Q | Idempotency | Intent-ID for T3 |

### Q3: Structure & Boundaries
| ID | Name | Rule |
|----|------|------|
| G | Traceability | @trigger/@listen comments |
| H | Policy | Auth separate from flow |
| I | Firewalls | No deep imports |
| J | Locality | State near usage |
| K | Testing | Pyramid by layer |
| L | Headless | Logic ≠ UI |

### Q4: Resilience & Observability
| ID | Name | Rule |
|----|------|------|
| M | Saga | Every step has undo |
| N | Context | TraceID everywhere |
| O | Async | Long ops → 202 + poll |
| P | Circuit | Fail fast on errors |
| R | Observability | JSON semantic logs |
```

### *pillar <X>

1. Read all files in `.prot/pillar-{X}/`:
   - `{name}.md` - Core documentation
   - `{name}.ts` - Code template
   - `checklist.md` - Detailed checks
   - `audit.ts` - Audit script (if exists)

2. Output structured summary:

```markdown
## Pillar X: [Name]

**Rule**: [One-line summary from documentation]

### Quick Reference
[Key points from .md file]

### Good Example
```typescript
[From documentation]
```

### Bad Example (Anti-Pattern)
```typescript
[From documentation]
```

### Template
Copy from: `.prot/pillar-X/{name}.ts`

### Checklist Highlights
- [ ] Key check 1
- [ ] Key check 2
- [ ] Key check 3

### Audit
Run: `npx tsx .prot/pillar-X/audit.ts`
Checks: [What the audit verifies]
```

## Example: *pillar L

```markdown
## Pillar L: Headless

**Rule**: Logic hooks must not return JSX. UI stays in views/.

### Quick Reference
- Headless hooks return `{ state, actions }`
- No JSX, no React components in headless/
- Views consume headless hooks

### Good Example
```typescript
function useCartLogic() {
  const [state, dispatch] = useReducer(reducer, initial);
  const addItem = (id: ItemId) => dispatch({ type: 'ADD', id });
  return { state, addItem };
}
```

### Bad Example
```typescript
function useCart() {
  return <div>Cart</div>; // FORBIDDEN
}
```

### Template
Copy from: `.prot/pillar-l/headless.ts`

### Checklist Highlights
- [ ] No JSX returned from hook
- [ ] Returns { state, actions } pattern
- [ ] No React component imports

### Audit
Run: `npx tsx .prot/pillar-l/audit.ts`
Checks: Scans headless/*.ts for JSX patterns
```
