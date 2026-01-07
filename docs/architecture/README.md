# Architecture Documentation

> System architecture for Yorutsuke v2

## Overview

**Architecture**: Local-First + Cloud-Sync
**Pattern**: AI_DEV_PROT v15 (Tauri + React + AWS CDK)

## Document Index

| Document | Description | When to Read |
|----------|-------------|--------------|
| [LAYERS.md](./LAYERS.md) | Four-layer architecture definition | Understanding system structure |
| [PATTERNS.md](./PATTERNS.md) | Core patterns: Service, State, Events | Writing new code |
| [FLOWS.md](./FLOWS.md) | Data flow diagrams | Debugging, feature planning |
| [SCHEMA.md](./SCHEMA.md) | Data model (entities, tables) | Database work |
| [MODELS.md](./MODELS.md) | Row vs Domain mappings | Type safety at boundaries |
| [STORES.md](./STORES.md) | Zustand runtime state | State management |
| [STORAGE.md](./STORAGE.md) | Local disk usage strategy | Files & persistence |
| [INTERFACES.md](./INTERFACES.md) | API specifications (IPC, REST) | Integration work |
| [PROGRAM_PATHS.md](./PROGRAM_PATHS.md) | Directory structure | Finding files |
| [ADR/](./ADR/) | Architecture Decision Records | Understanding past decisions |

## Quick Reference

### Core Principle

```
Service 指挥 (Orchestrate)
Tauri 执行 (Execute)
AWS 审计 (Validate)
React 展示 (Display)
```

### Layer Summary

| Layer | Position | Responsibility |
|-------|----------|----------------|
| React | View | UI rendering, subscribe to state |
| Service | Orchestrator | Business logic, global listeners |
| Adapter | Bridge | IPC/API abstraction |
| Tauri/AWS | Executor | Native ops, cloud authority |

### Module Tiers

| Module | Tier | Pattern |
|--------|------|---------|
| capture | T2 | View → Service → Adapter |
| report | T1 | View → Service → Adapter |
| transaction | T2 | View → Service → Adapter |
| batch | T3 | Saga (in Service) |

## Navigation

```
docs/architecture/
├── README.md           # This file (navigation)
├── LAYERS.md           # Four-layer architecture ✅
├── PATTERNS.md         # Core patterns ✅
├── FLOWS.md            # Data flows ✅
├── SCHEMA.md           # Data model
├── MODELS.md           # Row vs Domain mapping
├── STORES.md           # Zustand stores
├── STORAGE.md          # Disk structure
├── INTERFACES.md       # API specs
├── PROGRAM_PATHS.md    # Directory structure (Redirect)
└── ADR/                # Decision records ✅
    ├── README.md       # ADR index
    ├── 001-service-pattern.md
    └── 002-strictmode-fix.md
```

## Related

- Protocol: `../../.prot/CHEATSHEET.md`
- Test Scenarios: `../tests/`
- MVP Plan: `../dev/MVP_PLAN.md`

---

*Refactored from ARCHITECTURE.md per #94*
