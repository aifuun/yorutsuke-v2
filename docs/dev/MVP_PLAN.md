# MVP Index

> Incremental testing roadmap

**Version**: 3.0.0
**Last Updated**: 2026-01-07

## Overview

We follow a strictly incremental validation path. Each MVP builds upon the previous one.

```
MVP0 (Refactor) → MVP1 (Local) → MVP2 (Upload) → MVP3 (Batch) → MVP3.5 (Sync) → MVP4 (Auth)
   架构重构          纯本地         上传云端        夜间处理        确认回写        完整认证
```

## Phase Index

| Phase | Type | Goal | Document | Status |
|-------|------|------|----------|--------|
| **MVP0** | Refactor | headless hooks → Service pattern | [MVP0_REFACTOR.md](./MVP0_REFACTOR.md) | ✅ Done |
| **MVP1** | Feature | Local capture, compression, queue | [MVP1_LOCAL.md](./MVP1_LOCAL.md) | 🔄 Active |
| **MVP2** | Feature | S3 upload, network handling | [MVP2_UPLOAD.md](./MVP2_UPLOAD.md) | ⏳ Pending |
| **MVP3** | Feature | Batch AI, Report, Transactions | [MVP3_BATCH.md](./MVP3_BATCH.md) | ⏳ Pending |
| **MVP3.5**| Feature | Cloud Sync (Confirmation) | [MVP3_BATCH.md](./MVP3_BATCH.md#mvp35---确认回写-cloud-sync) | ⏳ Pending |
| **MVP4** | Feature | Auth, Tiers, Migration | [MVP4_AUTH.md](./MVP4_AUTH.md) | ⏳ Pending |

## Architecture Context

> See [architecture/README.md](../architecture/README.md) for full system design.

### Module Tiers

| Module | Tier | Pattern | Refactor In | Test In |
|--------|------|---------|-------------|---------|
| capture | T2 | FSM + Queue | MVP0 | MVP1, MVP2 |
| report | T1 | Fetch + Render | MVP3 | MVP3 |
| transaction | T2 | CRUD + Confirm | MVP3 | MVP3, MVP3.5 |
| batch | T3 | Saga (AWS) | N/A | MVP3 |
| auth | T2 | Login + Migration | MVP4 | MVP4 |

### ID Strategy

| ID Type | Purpose | Tested In |
|---------|---------|-----------|
| `imageId` | Entity identifier | SC-700 |
| `traceId` | Log correlation | SC-701 |
| `intentId` | Idempotency (retry-safe) | SC-702 |
| `md5` | Content deduplication | SC-703, SC-020~023 |
