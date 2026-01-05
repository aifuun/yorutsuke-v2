# Test Scenarios

> Manual and automated test scenarios for Yorutsuke v2.

## Documents

| Document | Scope | ID Prefix | Scenarios |
|----------|-------|-----------|-----------|
| [FRONTEND.md](./FRONTEND.md) | Tauri + React | SC-xxx | 95+ |
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
| SC-9xx | Report/Dashboard | SC-900 ~ SC-922 |
| SC-10xx | Settings | SC-1000 ~ SC-1021 |
| SC-11xx | Debug | SC-1100 ~ SC-1141 |
| SC-12xx | i18n | SC-1200 ~ SC-1212 |
| SB-1xx | Presign Lambda | SB-100 ~ SB-122 |
| SB-2xx | Batch Processing | SB-200 ~ SB-233 |
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

- [Program Paths](../PROGRAM_PATHS.md) - Code flow traces
- [Interfaces](../INTERFACES.md) - API specifications
- [Architecture](../ARCHITECTURE.md) - System design

---

*Last updated: 2026-01-05*
