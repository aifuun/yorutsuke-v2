# Test Scenarios

> Manual and automated test scenarios for Yorutsuke v2.

## MVP Testing Phases

| Phase | Scope | Key Scenarios | Dependencies |
|-------|-------|---------------|--------------|
| MVP0 | Architecture Refactor | (No new scenarios - reuses MVP1) | None |
| MVP1 | Local Only | SC-001~023, SC-500~503, SC-700~712 | None |
| MVP2 | Upload | SC-300~321, SC-400~423, SC-510~512 | Lambda: presign |
| MVP3 | Batch + Report | SB-200~221, SC-304~307, SC-800~934 | Full backend |
| MVP3.5 | Cloud Sync | SC-1500~1521 | Lambda: transactions-sync |
| MVP4 | Full Auth | SC-100~131, SC-200~222, SC-600~603 | Cognito |

> **MVP0 验收**: Service pattern 迁移完成后，运行 MVP1 场景验证功能不变。
> 特别关注 #82 (StrictMode 双重监听) 是否修复。

See [MVP_PLAN.md](../planning/MVP_PLAN.md) for detailed test checklists.

## Documents

| Document | Scope | ID Prefix | Scenarios |
|----------|-------|-----------|-----------|
| [FRONTEND.md](./FRONTEND.md) | Tauri + React | SC-xxx | 115+ |
| [BACKEND.md](./BACKEND.md) | Lambda, AWS | SB-xxx | 50+ |

## ID Conventions

| Prefix | Meaning | Range |
|--------|---------|-------|
| SC-0xx | Capture Module | SC-001 ~ SC-023 |
| SC-1xx | Quota | SC-100 ~ SC-131 |
| SC-2xx | Tier Transitions | SC-200 ~ SC-222 |
| SC-3xx | Network | SC-300 ~ SC-321 |
| SC-4xx | Error Recovery | SC-400 ~ SC-423 |
| SC-5xx | App Lifecycle | SC-500 ~ SC-512 |
| SC-6xx | Authentication | SC-600 ~ SC-611 |
| SC-7xx | Data Integrity | SC-700 ~ SC-712 |
| SC-8xx | Transaction/Ledger | SC-800 ~ SC-833 |
| SC-9xx | Report/Dashboard | SC-900 ~ SC-934 |
| SC-10xx | Settings | SC-1000 ~ SC-1021 |
| SC-11xx | Debug | SC-1100 ~ SC-1141 |
| SC-12xx | i18n | SC-1200 ~ SC-1212 |
| SC-14xx | Performance (NFR) | SC-1400 ~ SC-1432 |
| SC-15xx | Cloud Sync | SC-1500 ~ SC-1521 |
| SB-1xx | Presign Lambda | SB-100 ~ SB-122 |
| SB-2xx | Batch Processing | SB-200 ~ SB-241 |
| SB-3xx | Cost Control | SB-300 ~ SB-314 |
| SB-4xx | Data Lifecycle | SB-400 ~ SB-412 |
| SB-5xx | Data Integrity | SB-500 ~ SB-512 |
| SB-6xx | Auth & Authz | SB-600 ~ SB-612 |

## Status Legend

| Symbol | Meaning |
|--------|---------|
| `[ ]` | Not tested |
| `[x]` | Passed |
| `[!]` | Failed (link to issue) |
| `[-]` | Blocked / Not applicable |

## Quick Links

- [Program Paths](../architecture/PROGRAM_PATHS.md) - Code flow traces
- [Interfaces](../architecture/INTERFACES.md) - API specifications
- [Architecture](../architecture/ARCHITECTURE.md) - System design

---

*Last updated: 2026-01-05*
