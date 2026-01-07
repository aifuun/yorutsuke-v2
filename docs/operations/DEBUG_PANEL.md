# Debug Panel

> Developer-only tools for testing and troubleshooting.

**IMPORTANT**: The Debug panel is **NOT visible to end users** in release builds. It is only accessible to developers during development.

## Access

### Development Mode

Debug tab appears in sidebar after entering secret code:
- Type `debug` anywhere in the app
- Debug icon appears in navigation

### Release Mode

Debug panel is **completely hidden**. End users cannot access it.

---

## Sections

### 1. Dev Actions

Developer tools for testing:

| Action | Description |
|--------|-------------|
| **Seed Data** | Generate mock transactions for testing |
| **Mock Mode** | Control API behavior (off/online/offline) |
| **Reset Quota** | Move today's uploads to yesterday |
| **Clear Storage** | Delete all local data |

### 2. System & Config

Current app state (read-only):

| Field | Description |
|-------|-------------|
| User | Current user ID |
| Tier | Subscription tier |
| Quota | Upload usage (used/limit) |
| Theme | Current theme |
| Lang | Current language |
| DB | Schema version |

### 3. Logs

Real-time application logs:

- Toggle **Verbose** for detailed logging
- **Clear** to reset log buffer
- Color-coded by level (info/warn/error)

---

## Mock Mode

Controls how API calls behave:

| Mode | Value | Behavior |
|------|-------|----------|
| **Off** | `'off'` | Real API calls to AWS backend |
| **Online** | `'online'` | Mock responses, no network calls |
| **Offline** | `'offline'` | Simulated network failure |

### Persistence

Mock mode setting is **persisted to SQLite**:
- Survives app restart (development only)
- Per-device setting
- **Production builds**: Always `'off'`, DB is never read

### Use Cases

| Mode | Use Case |
|------|----------|
| Off | Integration testing with real backend |
| Online | UI development without AWS |
| Offline | Testing error handling, retry logic |

---

## Seed Data Scenarios

| Scenario | Transactions | Description |
|----------|--------------|-------------|
| `default` | 8 | Mix of income/expense |
| `empty` | 0 | No transactions |
| `heavy` | 50 | Stress test |
| `income-only` | 10 | Only income transactions |
| `expense-only` | 10 | Only expense transactions |

---

## Security

| Aspect | Implementation |
|--------|----------------|
| Access Control | Secret code required (`debug`) |
| Release Builds | Panel completely hidden |
| Data Safety | Clear Storage requires confirmation |
| Mock Mode | Disabled in production |

---

## Related

- [MOCKING.md](../tests/MOCKING.md) - Mock mode implementation details
- [LOGGING.md](LOGGING.md) - Logging system documentation

---

*Last updated: 2025-01*
