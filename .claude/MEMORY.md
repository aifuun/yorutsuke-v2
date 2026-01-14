# Memory - Architecture Decision Records

This document is a pure index of architectural decisions. All implementation details and rationale are in the linked ADR files.

## ADR Index

### Core Architecture Patterns

- [001-service-pattern.md](../docs/architecture/ADR/001-service-pattern.md) - Pure TypeScript service layer
- [002-strictmode-fix.md](../docs/architecture/ADR/002-strictmode-fix.md) - Event listener initialization
- [003-image-compression.md](../docs/architecture/ADR/003-image-compression.md) - Image processing pipeline
- [004-upload-queue-fsm.md](../docs/architecture/ADR/004-upload-queue-fsm.md) - Upload queue state machine
- [005-traceid-intentid.md](../docs/architecture/ADR/005-traceid-intentid.md) - Observability patterns

### Recent Architectural Decisions

- [006-mock-database-isolation.md](../docs/architecture/ADR/006-mock-database-isolation.md) - Dual-database mock pattern
- [007-transaction-cloud-sync.md](../docs/architecture/ADR/007-transaction-cloud-sync.md) - Cloud-to-local sync
- [008-component-library.md](../docs/architecture/ADR/008-component-library.md) - Component library design
- [009-branch-first-workflow.md](../docs/architecture/ADR/009-branch-first-workflow.md) - Git workflow rule
- [010-three-layer-task-tracking.md](../docs/architecture/ADR/010-three-layer-task-tracking.md) - TODO/MEMORY migration (pure ADR index)
- [011-bidirectional-cloud-sync.md](../docs/architecture/ADR/011-bidirectional-cloud-sync.md) - Bidirectional cloud sync (Issue #86)
- [012-bedrock-model-ids.md](../docs/architecture/ADR/012-bedrock-model-ids.md) - Bedrock inference profiles and model IDs
- [013-environment-based-secrets.md](../docs/architecture/ADR/013-environment-based-secrets.md) - Never hardcode API keys; load from environment
- [015-sdk-over-rest-api.md](../docs/architecture/ADR/015-sdk-over-rest-api.md) - Use official SDKs over raw REST API for third-party integrations
- [016-lambda-local-first-testing.md](../docs/architecture/ADR/016-lambda-local-first-testing.md) - Test Lambda code locally before deploying

## References

- **Workflow**: `.claude/WORKFLOW.md`, `.claude/rules/workflow.md`
- **Architecture**: `docs/architecture/`, `.prot/`
- **Active Plans**: `.claude/plans/active/` (current issue work)

---

**Last Updated**: 2026-01-14 (ADR-016 added - Lambda Local-First Testing Strategy)
**Purpose**: Pure ADR index (no project tracking)
**Update Rule**: Add ADR link when closing major architectural issues
