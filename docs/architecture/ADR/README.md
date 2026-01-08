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
