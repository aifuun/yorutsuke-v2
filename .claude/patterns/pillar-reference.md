# Pillar Quick Reference

Quick lookup for AI_DEV_PROT v15 Pillars, templates, and audits.

## By Tier

| Tier | Pillars | Key Templates |
|------|---------|---------------|
| **T1** (Direct) | A, I, L | branded.ts, headless.ts |
| **T2** (Logic) | A, D, I, J, L | + fsm-reducer.ts |
| **T3** (Saga) | All (A-R) | + saga.ts, idempotency.ts |

## Template Locations

| Pillar | Name | Template | Checklist |
|--------|------|----------|-----------|
| **A** | Nominal Types | .prot/pillar-a/branded.ts | pillar-a/checklist.md |
| **B** | Airlock | .prot/pillar-b/airlock.ts | pillar-b/checklist.md |
| **C** | Mocking | .prot/pillar-c/mock-factory.ts | pillar-c/checklist.md |
| **D** | FSM | .prot/pillar-d/fsm-reducer.ts | pillar-d/checklist.md |
| **E** | Orchestration | .prot/pillar-e/tier*.ts | pillar-e/checklist.md |
| **F** | Concurrency | .prot/pillar-f/optimistic-lock.ts | pillar-f/checklist.md |
| **G** | Traceability | .prot/pillar-g/traceability.ts | pillar-g/checklist.md |
| **H** | Policy | .prot/pillar-h/policy.ts | pillar-h/checklist.md |
| **I** | Firewalls | .prot/pillar-i/firewalls.ts | pillar-i/checklist.md |
| **J** | Locality | .prot/pillar-j/locality.ts | pillar-j/checklist.md |
| **K** | Testing | .prot/pillar-k/testing.ts | pillar-k/checklist.md |
| **L** | Headless | .prot/pillar-l/headless.ts | pillar-l/checklist.md |
| **M** | Saga | .prot/pillar-m/saga.ts | pillar-m/checklist.md |
| **N** | Context | .prot/pillar-n/context.ts | pillar-n/checklist.md |
| **O** | Async | .prot/pillar-o/async.ts | pillar-o/checklist.md |
| **P** | Circuit | .prot/pillar-p/circuit.ts | pillar-p/checklist.md |
| **Q** | Idempotency | .prot/pillar-q/idempotency.ts | pillar-q/checklist.md |
| **R** | Observability | .prot/pillar-r/observability.ts | pillar-r/checklist.md |

## Audit Scripts

Run automated checks:

| Tier | Audits to Run | Command |
|------|---------------|---------|
| T1 | A, I, L | `*audit a i l` |
| T2 | A, D, I, L | `*audit a d i l` |
| T3 | A, B, D, I, L, M, Q, R | `*audit --all` |

## Quick Links

- **Full specs**: @.prot/CHEATSHEET.md
- **Pre-code checklist**: @.prot/checklists/pre-code.md
- **In-code checklist**: @.prot/checklists/in-code.md
- **Post-code checklist**: @.prot/checklists/post-code.md

## Usage in Commands

Reference this pattern:
```markdown
## Workflow
1. **Load applicable Pillars**: @.claude/patterns/pillar-reference.md
2. **Copy templates**: See Tier row in table above
3. ...
```

Used by:
- `tier.md` - Classification and template selection
- `audit.md` - Tier-based audit selection
- `review.md` - Checklist loading
- `scaffold.md` - Module template generation
- `next.md` - Template quick reference
