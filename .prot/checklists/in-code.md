# In-Code Checklist

> Run DURING implementation, per task

## Per-Layer Checks

### Domain Layer (`01_domains/`)

- [ ] No framework imports
- [ ] Pure functions where possible
- [ ] Branded types for all IDs (Pillar A)

→ Details: `.prot/pillar-a/checklist.md`

### Headless Layer (`02_modules/*/headless/`)

- [ ] NO JSX or HTML (Pillar L)
- [ ] Returns data and functions only
- [ ] Uses explicit FSM states (Pillar D)

→ Details: `.prot/pillar-l/checklist.md`, `.prot/pillar-d/checklist.md`

### Adapter Layer (`02_modules/*/adapters/`)

- [ ] Schema validation at boundary (Pillar B)
- [ ] Upcasting for legacy data (Pillar B)
- [ ] No deep imports from other modules (Pillar I)

→ Details: `.prot/pillar-b/checklist.md`, `.prot/pillar-i/checklist.md`

### View Layer (`02_modules/*/views/`)

- [ ] UI logic delegated to headless hooks
- [ ] Minimal local state
- [ ] Primitives converted to Domain types at boundary

## T2 Specific

- [ ] Reducer uses union type states (Pillar D)
- [ ] Optimistic updates handle rollback

→ Details: `.prot/pillar-d/checklist.md`

## T3 Specific

### Idempotency (Pillar Q)

- [ ] Intent-ID check at entry point

→ Details: `.prot/pillar-q/checklist.md`

### Concurrency (Pillar F)

- [ ] Version check before write

→ Details: `.prot/pillar-f/checklist.md`

### Saga (Pillar M)

- [ ] Compensation defined for each step

→ Details: `.prot/pillar-m/checklist.md`

### Context (Pillar N)

- [ ] TraceId propagated through calls

→ Details: `.prot/pillar-n/checklist.md`

### Observability (Pillar R)

- [ ] Semantic JSON logs at transitions

→ Details: `.prot/pillar-r/checklist.md`

## After Each Task

1. [ ] Run unit test for this code
2. [ ] Mark TODO item complete
3. [ ] No console.log left in code
