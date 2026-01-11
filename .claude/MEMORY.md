# Memory - Architecture Decision Records

This document provides a lean index of architectural decisions documented in formal ADRs. For detailed decision context, see the linked ADR files.

## ADR Index

### Core Architecture

- [001-service-pattern.md](../docs/architecture/ADR/001-service-pattern.md) - Pure TypeScript service layer (React = dumb display)
- [002-strictmode-fix.md](../docs/architecture/ADR/002-strictmode-fix.md) - Event listener initialization outside React
- [003-image-compression.md](../docs/architecture/ADR/003-image-compression.md) - Image processing pipeline
- [004-upload-queue-fsm.md](../docs/architecture/ADR/004-upload-queue-fsm.md) - Upload queue state machine
- [005-traceid-intentid.md](../docs/architecture/ADR/005-traceid-intentid.md) - Observability: TraceId vs IntentId
- [006-mock-database-isolation.md](../docs/architecture/ADR/006-mock-database-isolation.md) - Dual-database mock pattern
- [007-transaction-cloud-sync.md](../docs/architecture/ADR/007-transaction-cloud-sync.md) - Cloud-to-local sync with conflict resolution
- [008-component-library.md](../docs/architecture/ADR/008-component-library.md) - Material Design 3 component library
- [009-branch-first-workflow.md](../docs/architecture/ADR/009-branch-first-workflow.md) - Pre-coding branch creation rule

### Recent Decisions (2026-01)

| Issue | Decision | ADR |
|-------|----------|-----|
| #138 | Mock Database Isolation | [006](../docs/architecture/ADR/006-mock-database-isolation.md) |
| #108 | Transaction Cloud Sync | [007](../docs/architecture/ADR/007-transaction-cloud-sync.md) |
| #126-131 | Component Library | [008](../docs/architecture/ADR/008-component-library.md) |
| #122 | Border Radius Token Migration | See GitHub issue #122 |
| #105 | Code Commands Optimization | See `.claude/commands/` |
| #94 | Architecture Documentation Refactoring | See `docs/architecture/` |
| #82 | React = Dumb Display | [001](../docs/architecture/ADR/001-service-pattern.md) |

## Key Learnings

### Service Layer Pattern (Pillar L)
- React components only subscribe to events and render
- All orchestration logic in pure TypeScript services
- Services own Zustand vanilla stores
- Event listeners registered once at app startup

### State Management
- FSM (Finite State Machines) for complex flows
- Zustand vanilla stores for shared state
- No global context (encourages explicit passing)
- Subscribe to stores for reactive updates

### Cloud Integration
- Pull-only sync from cloud (source of truth)
- Conflict resolution with clear priority order
- Idempotent operations (safe to retry)
- 3-second debounce after upload events

### Testing & Mock Data
- Centralized mock data generators (mockOnline.ts, mockOffline.ts)
- Empty mock database by default (users manually seed)
- Auto-reload views when switching mock modes
- Mock DB and production DB completely isolated

### Design System
- Material Design 3 foundation (70%) + Yorutsuke pragmatism (30%)
- Design tokens for all values (colors, spacing, typography)
- WCAG 2.1 AA compliance built-in
- Co-located CSS (Component.tsx + Component.css)

### Git Workflow
- Always create feature branch BEFORE code changes
- Branch naming: feature/#XXX, bugfix/#XXX, hotfix/#XXX
- One issue → one branch → one PR
- Clear separation between development branches and main

## Solved Issues & Bug Fixes

### Critical Bugs (2026-01)
- **#45-49**: Capture pipeline FSM fixes (2026-01-03)
- **#101**: Admin config API implementation (2026-01-08)
- **Bug-003**: Foreign key constraint in cloud sync (2026-01) → ADR-007
- **Bug-004**: Date filter default hiding historical data (2026-01) → ADR-007
- **#006**: SQLite "database is locked" → IO-First Pattern (`.claude/rules/service-layer.md`)
- **#007a**: Debug "Clear All Data" freeze → Fixed (service cleanup)
- **#007b**: Paste interaction permission error → Tauri capability fix
- **#007c**: Tauri 2 HTTP fetch "Load failed" → Use @tauri-apps/plugin-http

## References

**Key Documentation**:
- `.claude/WORKFLOW.md` - Workflow index & cheatsheet
- `.claude/rules/workflow.md` - Three-layer architecture (MVP → Issues → Plans)
- `.claude/workflow/planning.md` - Two-step planning methodology
- `.prot/STRUCTURE.md` - Project structure overview

**Design System**:
- `docs/design/` - 7 design specifications (buttons, forms, states, accessibility, etc.)

**Development Guides**:
- `docs/architecture/` - Modular architecture documentation
- `docs/tests/MOCKING.md` - Mock mode usage

**Pillars & Patterns**:
- `.prot/` - AI_DEV_PROT v15 (18 pillars, checklists)
- `.claude/rules/` - Core engineering rules (service layer, time handling, debugging, etc.)

## Active Issues

Currently tracking: `#139` (this migration)

See `.claude/plans/active/` for detailed issue plans.

## Historical Context

This project is a complete rewrite of the original Yorutsuke (in `../yorutsuke`). Key differences:

| Aspect | Original | v2 |
|--------|----------|-----|
| Architecture | Ad-hoc monolith | AI_DEV_PROT v15 (18 pillars) |
| State | Redux | Zustand vanilla stores + services |
| Components | React Hooks + Context | Headless patterns (logic in hooks, UI in views) |
| Testing | Limited | Service layer enables easy unit testing |
| Documentation | Comprehensive | ADRs, design specs, rules |
| Mock Data | None | Centralized generators (mockOnline, mockOffline) |
| Workflow | Informal | Three-layer: MVP → Issues → Plans |

---

**Last Updated**: 2026-01-11  
**Format**: ADR index with links (lean, maintainable)  
**Total Size**: ~120 lines (reduced from 451)  
**Maintenance**: Update when closing major issues (create new ADRs, link from Recent Decisions)
