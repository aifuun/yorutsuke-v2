# Frontend Test Scenarios

> Comprehensive test scenarios for the Yorutsuke frontend.

## Directory

| Module | Document | SC Range | Description |
|--------|----------|----------|-------------|
| **Capture** | [CAPTURE.md](./CAPTURE.md) | SC-001~023 | Image drop, paste, validation |
| **Quota & Auth** | [QUOTA_AUTH.md](./QUOTA_AUTH.md) | SC-100~813 | Tiers, limits, registration |
| **Ledger & Report** | [LEDGER_REPORT.md](./LEDGER_REPORT.md) | SC-1000~1111 | Transactions, dashboards |
| **Lifecycle & Error** | [LIFECYCLE_ERROR.md](./LIFECYCLE_ERROR.md) | SC-300~712 | Network, crash recovery |
| **Others** | [PERFORMANCE_DEBUG.md](./PERFORMANCE_DEBUG.md) | SC-1200~1503| Performance, settings, i18n |

---

## Testing Principles

1. **Manual Verification**: Primary method for UI/UX scenarios.
2. **Mock Mode**: Use `isMockingOnline()` to test UI without real backend.
3. **Traceability**: Every bug report must reference a Scenario ID.
4. **Idempotency**: Verify Intent-ID prevents double processing.
