# Pre-Code Checklist

> Run BEFORE writing any implementation code

## 1. Tier Classification

- [ ] Task tier classified (see `.prot/CHEATSHEET.md`)
- [ ] Tier determined: T1 / T2 / T3
- [ ] Appropriate pillars identified

## 2. Architecture Selection

| Tier | Pattern | Template |
|------|---------|----------|
| T1 | `View → Adapter` | `.prot/pillar-e/tier1-fetcher.ts` |
| T2 | `View → Headless → Adapter` | `.prot/pillar-e/tier2-headless.ts` |
| T3 | `View → Saga → [Adapters]` | `.prot/pillar-e/tier3-saga.ts` |

- [ ] Code belongs to correct layer
- [ ] Pattern matches tier

→ Details: `.prot/pillar-e/checklist.md`

## 3. Type Design (Pillar A)

- [ ] Domain IDs use Branded Types
- [ ] No primitive types for domain entities

→ Details: `.prot/pillar-a/checklist.md`

## 4. State Design (Pillar D)

- [ ] Using explicit FSM, NOT boolean flags

→ Details: `.prot/pillar-d/checklist.md`

## 5. Boundary Design (Pillar B)

- [ ] Schema validation planned at adapters
- [ ] Upcast strategy for legacy data

→ Details: `.prot/pillar-b/checklist.md`

## 6. Structure Design

- [ ] Headless/View separation planned (Pillar L)
- [ ] No cross-module deep imports (Pillar I)
- [ ] State locality considered (Pillar J)

→ Details: `.prot/pillar-l/checklist.md`, `.prot/pillar-i/checklist.md`

## 7. T3 Specific

If Tier 3:
- [ ] Intent-ID mechanism planned (Pillar Q)
- [ ] Version field for locking (Pillar F)
- [ ] Compensation actions defined (Pillar M)
- [ ] Context propagation planned (Pillar N)

→ Details: `.prot/pillar-q/checklist.md`, `.prot/pillar-m/checklist.md`

## Proceed When

All applicable items checked → Create TODO.md breakdown → Start coding
