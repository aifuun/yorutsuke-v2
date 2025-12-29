# Session Tasks

Source of truth: GitHub Issues. This file tracks session breakdown.

## Current Focus: #3 - Network Status (00_kernel/network)

Status: ✅ COMPLETE

### Tasks
- [x] Create `types.ts` - NetworkState FSM type
- [x] Create `networkStatus.ts` - Core detection + EventBus
- [x] Create `useNetworkStatus.ts` - React hook (Pillar L)
- [x] Create `index.ts` and update kernel exports
- [x] TypeScript build passes

### Files Created

```
app/src/00_kernel/network/
├── types.ts           # NetworkState, NetworkStatusResult
├── networkStatus.ts   # getNetworkState(), setupNetworkListeners()
├── useNetworkStatus.ts # useNetworkStatus(), useIsOnline()
└── index.ts           # Module exports
```

### Pillars Applied
- **D**: FSM States - `NetworkState = 'online' | 'offline' | 'unknown'`
- **G**: Traceability - `@trigger network:changed` annotations
- **L**: Headless - Hook returns data only, no JSX
- **R**: Observability - State change logging

## Phase 0: Core Kernel ✅

| Issue | Title | Status |
|-------|-------|--------|
| #1 | EventBus | ✅ Complete |
| #2 | SQLite + Migrations | ✅ Complete |
| #3 | Network Status | ✅ Complete |

## Phase 1: Capture Pipeline

| Issue | Title | Status |
|-------|-------|--------|
| #4 | Tauri Drag & Drop | 🟡 Ready |
| #5 | Image Compression | 🟡 Ready |
| #6 | Upload Queue | 🟡 Ready (deps: #3 ✅) |
| #7 | Auth (Cognito) | 🟡 Ready |

## Backlog

Small tasks not worth an issue:

- [ ] Setup ESLint rules for Pillar compliance

## Recently Completed

<!-- Format: Task (date) -->
- #3 Network Status implemented (2025-12-29)
- #2 SQLite + Migrations implemented (2025-12-29)
- #1 EventBus implemented (2025-12-29)
- Created ROADMAP.md (2025-12-28)
- Created GitHub Issues #1-#7 (2025-12-28)
