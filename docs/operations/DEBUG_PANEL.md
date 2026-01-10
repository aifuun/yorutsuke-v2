# Debug Panel

> Developer-only tools for testing and troubleshooting.

**IMPORTANT**: The Debug panel is **NOT visible to end users** in release builds. It is only accessible to developers during development.

## Access

### Development Mode

**Configuration**: Add to `.env.local` (gitignored):

```bash
VITE_DEBUG_PANEL=true
```

**Steps**:
1. Open or create `app/.env.local`
2. Add line: `VITE_DEBUG_PANEL=true`
3. Restart dev server: `npm run tauri dev`
4. Debug icon appears in sidebar

**Template**: See `app/.env.local.example` for configuration template.

### Release Mode (Production)

Debug panel is **automatically disabled** in production builds:
- ✅ Compile-time check: `import.meta.env.PROD` forces `isDebugEnabled()` to return `false`
- ✅ Tree-shaking: DebugView component code is completely removed from bundle
- ✅ UI hidden: Sidebar doesn't show debug button

**No action required** - the panel is automatically disabled when you run:
```bash
npm run tauri build
```

See [PRODUCTION_SECURITY.md](PRODUCTION_SECURITY.md) for detailed security architecture.

---

## Sections

### 1. Dev Actions

Developer tools for testing:

| Action | Description |
|--------|-------------|
| **Seed Data** | Generate mock transactions for testing |
| **Mock Mode** | Control API behavior (off/online/offline) |
| **Reset Quota** | Move today's uploads to yesterday |
| **Clear Business Data** | Delete all local data (SQLite) |
| **Clear Cloud Data** | Delete all cloud data (DynamoDB + S3) |
| **Clear Settings** | Reset settings to defaults |

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

## Clear Cloud Data

**Issue**: #110

Deletes user data from AWS cloud storage (DynamoDB + S3).

### Prerequisites

**Development/Testing**:
- Enable Mock Mode (online) in Debug Panel to test UI without real backend
- OR deploy Lambda and configure URL (see below)

**Production Use**:
- Lambda must be deployed via CDK
- Add Lambda URL to `.env.local`:
  ```bash
  VITE_LAMBDA_ADMIN_DELETE_URL=https://xxx.lambda-url.ap-northeast-1.on.aws/
  ```

### What Gets Deleted

| Resource | Scope | Filter |
|----------|-------|--------|
| **Transactions** | DynamoDB table | `userId = :userId` |
| **Images** | S3 bucket | `uploads/{userId}/` prefix |

### Security

- **User isolation**: Only deletes data for the current user
- **Backend validation**: Lambda validates userId in request
- **DynamoDB**: Uses `KeyConditionExpression` to filter by userId
- **S3**: Uses prefix `uploads/{userId}/` to scope deletion
- **Double confirmation**: Requires checkbox to enable delete button

### Confirmation Dialog

When you click "Clear Cloud" button:

1. **Title**: "Clear Cloud Data?"
2. **Message**: Warning about permanent deletion
3. **Checkbox**: "I understand this is irreversible and will delete all my cloud data"
4. **Buttons**:
   - Cancel (default focus, safe)
   - Delete from Cloud (disabled until checkbox checked)

### Result

Shows deletion count:
```
Deleted 15 transactions and 8 images from cloud
```

### Use Cases

| Scenario | Use Clear Cloud Data |
|----------|----------------------|
| Testing cloud sync | Yes |
| Clean up test accounts | Yes |
| Reset production data | **NO** - use Admin Panel |
| Privacy compliance | Yes (GDPR right to be forgotten) |

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
| Access Control | Environment variable (`VITE_DEBUG_PANEL=true` in `.env.local`) |
| Development | Per-developer config (`.env.local` gitignored) |
| Release Builds | Automatically disabled (3-layer protection) |
| Code Removal | Tree-shaking removes DebugView from production bundle |
| Runtime Safety | Compile-time check, zero runtime overhead |
| Data Safety | Clear Storage requires confirmation dialog |
| Mock Mode | Automatically disabled in production builds |

**Multi-layer Protection**:
1. **Compile-time**: `import.meta.env.PROD` check returns `false`
2. **Tree-shaking**: DebugView component code removed from bundle
3. **UI**: Sidebar button hidden in production

See [PRODUCTION_SECURITY.md](PRODUCTION_SECURITY.md) for attack surface analysis.

---

## Related

- [MOCKING.md](../tests/MOCKING.md) - Mock mode implementation details
- [LOGGING.md](LOGGING.md) - Logging system documentation
- [PRODUCTION_SECURITY.md](PRODUCTION_SECURITY.md) - Production build security architecture
- [DEBUG.md](../../app/DEBUG.md) - Quick configuration guide for developers

---

*Last updated: 2026-01-10*
