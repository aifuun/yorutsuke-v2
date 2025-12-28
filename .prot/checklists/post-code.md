# Post-Code Checklist

> Run AFTER all tasks complete, before issue close

## 1. Structural Integrity

### Module Boundaries (Pillar I)

- [ ] No deep imports
- [ ] Cross-module access via `index.ts` only
- [ ] No circular dependencies

→ Details: `.prot/pillar-i/checklist.md`

### State Locality (Pillar J)

- [ ] State lives near its usage
- [ ] Global state only for: Session, Theme, Locale

→ Details: `.prot/pillar-j/checklist.md`

### Headless Separation (Pillar L)

- [ ] All business logic in `headless/` or `01_domains/`
- [ ] No JSX in headless files

→ Details: `.prot/pillar-l/checklist.md`

## 2. Type Safety

### Nominal Types (Pillar A)

- [ ] All IDs are Branded Types
- [ ] No `string` for domain identifiers

→ Details: `.prot/pillar-a/checklist.md`

### FSM States (Pillar D)

- [ ] No boolean flag combinations
- [ ] States are explicit union types

→ Details: `.prot/pillar-d/checklist.md`

## 3. Boundary Validation (Pillar B)

- [ ] All external data parsed through schemas
- [ ] Error responses mapped to domain errors

→ Details: `.prot/pillar-b/checklist.md`

## 4. T3 Verification

If Tier 3 was implemented:

### Idempotency (Pillar Q)

- [ ] Intent-ID checked at saga entry
- [ ] Result cached after success

→ Details: `.prot/pillar-q/checklist.md`

### Concurrency (Pillar F)

- [ ] Version check before every write
- [ ] StaleDataError thrown on conflict

→ Details: `.prot/pillar-f/checklist.md`

### Saga Compensation (Pillar M)

- [ ] Every step has defined undo
- [ ] Compensation failures logged as CRITICAL

→ Details: `.prot/pillar-m/checklist.md`

### Context (Pillar N)

- [ ] TraceId flows through all calls

→ Details: `.prot/pillar-n/checklist.md`

### Observability (Pillar R)

- [ ] All state transitions logged as JSON
- [ ] Logs include: traceId, intentId, saga, from, to

→ Details: `.prot/pillar-r/checklist.md`

## 5. Test Coverage (Pillar K)

| Layer | Required |
|-------|----------|
| Domain (`01_domains/`) | Unit 100% |
| Headless | Unit High |
| Adapters | Contract |
| Workflows (T3) | Integration |

→ Details: `.prot/pillar-k/checklist.md`

## 6. Traceability (Pillar G)

- [ ] Complex flows have `@trigger/@listen` comments

→ Details: `.prot/pillar-g/checklist.md`

## 7. Security Quick Check

- [ ] No secrets in code
- [ ] Input validated at boundaries
- [ ] No SQL/command injection risks

## Final Verdict

```
□ PASS - Ready for *issue close
□ NEEDS_FIX - Create fix tasks
```
