# Architecture Decision Records

> Documenting significant architectural decisions

## What is an ADR?

An Architecture Decision Record captures a single decision along with its context and consequences. ADRs help:
- New team members understand why decisions were made
- AI assistants follow established patterns
- Prevent re-debating settled issues

## ADR Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [001](./001-service-pattern.md) | Service Layer Pattern | Accepted | 2025-01 |
| [002](./002-strictmode-fix.md) | React StrictMode Fix | Accepted | 2025-01 |
| [003](./003-image-compression.md) | Image Compression Strategy | Accepted | 2025-12 |
| [004](./004-upload-queue-fsm.md) | Upload Queue FSM | Accepted | 2025-12 |
| [005](./005-traceid-intentid.md) | TraceId vs IntentId | Accepted | 2026-01 |
| [006](./006-mock-database-isolation.md) | Mock Database Isolation | Accepted | 2026-01 |
| [007](./007-transaction-cloud-sync.md) | Transaction Cloud Sync | Accepted | 2026-01 |
| [008](./008-component-library.md) | Component Library | Accepted | 2026-01 |
| [009](./009-branch-first-workflow.md) | Branch-First Workflow | Accepted | 2026-01 |
| [010](./010-three-layer-task-tracking.md) | Three-Layer Task Tracking | Accepted | 2026-01 |
| [011](./011-bidirectional-cloud-sync.md) | Bidirectional Cloud Sync | Implemented | 2026-01 |
| [012](./012-zustand-selector-safety.md) | Zustand Selector Safety | Accepted | 2026-01 |
| [013](./013-environment-based-secrets.md) | Environment-Based Secret Management | Accepted | 2026-01 |
| [014](./014-lambda-layer-version-management.md) | Lambda Layer Version Management | Accepted | 2026-01 |
| [015](./015-sdk-over-rest-api.md) | SDK Over REST API | Accepted | 2026-01 |
| [016](./016-lambda-local-first-testing.md) | Lambda Local-First Testing | Accepted | 2026-01 |
| [018](./018-cdk-watch-cloud-driven-testing.md) | cdk watch Cloud-Driven Testing | Accepted | 2026-01 |

## ADR Template

```markdown
# ADR-XXX: Title

**Status**: Proposed | Accepted | Deprecated | Superseded
**Date**: YYYY-MM

## Context

What is the issue that we're seeing that is motivating this decision?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

What becomes easier or more difficult to do because of this change?
```

## Related

- [LAYERS.md](../LAYERS.md) - Architecture overview
- [PATTERNS.md](../PATTERNS.md) - Implementation patterns

---

*Created per #94 Phase 3*
