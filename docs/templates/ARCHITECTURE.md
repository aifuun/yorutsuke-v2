# ARCHITECTURE.md Template

> System architecture - How to organize

## Overview

**System**: [System name]
**Version**: [Version]
**Last Updated**: [Date]

## System Context

```
┌─────────────────────────────────────────────────────────┐
│                      User                               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Desktop App (Tauri)                    │
│  ┌─────────────────┐         ┌─────────────────┐        │
│  │  React Frontend │ ◄─IPC─► │  Rust Backend   │        │
│  └─────────────────┘         └─────────────────┘        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ HTTPS
┌─────────────────────────────────────────────────────────┐
│                    AWS Backend                          │
│  (API Gateway, Lambda, DynamoDB, S3, ...)              │
└─────────────────────────────────────────────────────────┘
```

## Layer Structure

| Layer | Purpose | Location |
|-------|---------|----------|
| Kernel | Shared context, types, telemetry | `src/00_kernel/` |
| Domains | Pure business logic | `src/01_domains/` |
| Modules | Feature modules | `src/02_modules/` |
| Migrations | Data upcasters | `src/03_migrations/` |

## Module Structure

```
src/02_modules/{module}/
├── adapters/       # IO: API, IPC, storage
├── headless/       # Logic hooks (no JSX)
├── workflows/      # Sagas (T3 only)
├── views/          # React components
└── index.ts        # Public interface
```

## Key Components

### Component A: [Name]
**Responsibility**: [What it does]
**Dependencies**: [What it depends on]
**Interface**: [Key methods/props]

---

### Component B: [Name]
...

## Data Flow

### Flow 1: [Flow name]
```
User action → View → Headless → Adapter → Backend → Response
```

1. [Step 1 description]
2. [Step 2 description]
3. ...

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend | React + TypeScript | [Why] |
| Desktop | Tauri | [Why] |
| Backend | Rust | [Why] |
| Cloud | AWS CDK | [Why] |
| State | [Choice] | [Why] |

## Security Architecture

- **Authentication**: [Method]
- **Authorization**: [Method]
- **Data Protection**: [Method]

## Deployment Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Dev      │ ──► │   Staging   │ ──► │    Prod     │
└─────────────┘     └─────────────┘     └─────────────┘
```

## References

- [Related ADRs]
- [External documentation]
