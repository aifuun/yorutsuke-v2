# Architecture Documentation

> System design documents for Yorutsuke v2

## Document Overview

| Document | Purpose | Answers |
|----------|---------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design overview | "How is the system organized? How does data flow?" |
| [SCHEMA.md](./SCHEMA.md) | Data model | "What data is stored? Where? In what format?" |
| [INTERFACES.md](./INTERFACES.md) | Interface definitions | "How do modules communicate? What do APIs look like?" |
| [PROGRAM_PATHS.md](./PROGRAM_PATHS.md) | Code flow traces | "How does code execute? Where to look when debugging?" |

## Document Responsibilities

```
ARCHITECTURE.md        SCHEMA.md              INTERFACES.md          PROGRAM_PATHS.md
───────────────        ──────────             ─────────────          ────────────────
WHY & HOW              WHAT (Data)            HOW (Contracts)        WHERE (Debug)

├─ Four-layer model    ├─ SQLite tables       ├─ Tauri IPC           ├─ Happy path traces
├─ Design principles   ├─ DynamoDB tables     ├─ Lambda API          ├─ Error path traces
├─ State management    ├─ S3 structure        ├─ Service interfaces  ├─ Bug markers
├─ Control flow        ├─ Zustand stores      ├─ EventBus events     ├─ Line references
└─ Evolution roadmap   └─ Branded types       └─ Zod schemas         └─ FSM diagrams
```

## Architecture Fundamentals

Three pillars of architecture documentation:

```
┌─────────────────────────────────────────────────────────┐
│  1. Structure        → ARCHITECTURE.md                  │
│     Layers, modules, component relationships            │
│                                                         │
│  2. Data             → SCHEMA.md                        │
│     Entities, relationships, storage locations          │
│                                                         │
│  3. Behavior         → INTERFACES.md + PROGRAM_PATHS.md │
│     Interface contracts, runtime flows                  │
└─────────────────────────────────────────────────────────┘
```

## Reading Order

1. **ARCHITECTURE.md** - Start here for the big picture
2. **SCHEMA.md** - Understand the data model
3. **INTERFACES.md** - Learn module communication
4. **PROGRAM_PATHS.md** - Deep dive for debugging

## Source of Truth

**ARCHITECTURE.md is the primary source of truth.**

When conflicts arise between documents:
- ARCHITECTURE.md > other docs
- docs/ > code comments
- Explicit > implicit

## Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| ARCHITECTURE.md | ✅ Current | 2026-01-05 |
| SCHEMA.md | ✅ Current | 2026-01-05 |
| INTERFACES.md | ✅ Current | 2026-01-05 |
| PROGRAM_PATHS.md | ✅ Current | 2026-01-05 |

---

*Last updated: 2026-01-05*
