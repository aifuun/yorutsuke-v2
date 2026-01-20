# Issue #152: Diagnostic Data Export Button (Phase 1)

**Status**: In Progress 🔴
**Branch**: feature/152-diagnostic-export
**Depends On**: #151 (✅ Completed)
**Related**: #153 (Queue Mode - Phase 2)

---

## Overview

Add "Send Diagnostic Data" button to Settings panel. Users click once to collect local + cloud diagnostic data and generate a comprehensive report.

**Phase 1 Goals**:
- ✅ Manual button trigger (user-initiated)
- ✅ Local data collection (SQLite, logs, system info)
- ✅ Cloud data retrieval (Lambda → DynamoDB, S3)
- ✅ Report generation (S3 + metadata)
- ✅ S3 download link

**Future (Phase 2)**: Queue-based auto-execution when App restarts

---

## Architecture Design

### Component Stack

```
SettingsView.tsx (UI Layer)
    ↓ (onClick)
useDiagnosticExportLogic.ts (Headless Hook - Pillar L)
    ↓ (calls)
DiagnosticService.ts (Service Layer)
    ├─ invoke('collect_diagnostic_data')
    └─ invoke('upload_diagnostic_report')
    ↓
Tauri IPC ← → Rust commands
    ├─ collect_diagnostic_data()
    ├─ upload_diagnostic_report()
    └─ Lambda API call
    ↓
Lambda: yorutsuke-diagnostic-dev
    ├─ Query DynamoDB
    ├─ List S3 objects
    ├─ Generate report
    └─ Upload to S3
```

### Data Flow

```
1. User clicks "Send Diagnostic Data" button
   ↓
2. App collects local data:
   - SQLite: transactions (100), images (50), settings
   - Debug logs: last 500 entries
   - System: version, OS, locale, etc.
   ↓
3. App calls Lambda with local data + token
   ↓
4. Lambda retrieves cloud data:
   - DynamoDB: user's transactions (50)
   - S3: user's image list (50)
   - CloudWatch: last 24h errors
   ↓
5. Lambda generates JSON report
   - Combines local + cloud data
   - Embeds Markdown summary
   ↓
6. Lambda uploads to S3:
   - Path: s3://yorutsuke-diagnostics-dev/{userId}/{reportId}.json
   - Metadata to DynamoDB
   ↓
7. App shows: ✅ Complete + Download Link
```

---

## Implementation Steps

### Phase A: Frontend Service Layer (3-4 hours)

#### Step 1: Create DiagnosticService
**File**: `app/src/01_services/DiagnosticService.ts`

```typescript
export class DiagnosticService {
  // Collect local diagnostic data
  async collectLocalData(): Promise<LocalDiagnosticData>

  // Upload to cloud via Lambda
  async uploadReport(
    userId: UserId,
    token: string,
    localData: LocalDiagnosticData
  ): Promise<DiagnosticResult>

  // Main entry point
  async execute(userId: UserId, token: string): Promise<DiagnosticResult>
}
```

**Checklist**:
- [ ] Create DiagnosticService class
- [ ] Define LocalDiagnosticData type
- [ ] Define DiagnosticResult type
- [ ] Invoke Tauri IPC commands
- [ ] Error handling + retry logic

#### Step 2: Create Headless Hook
**File**: `app/src/02_modules/debug/headless/useDiagnosticExportLogic.ts`

```typescript
type State = 'idle' | 'collecting' | 'success' | 'error';

export function useDiagnosticExportLogic() {
  const [state, setState] = useState<State>('idle');
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportDiagnosticData = async () => {
    setState('collecting');
    try {
      const result = await diagnosticService.execute(userId, token);
      setState('success');
      setResult(result);
    } catch (e) {
      setState('error');
      setError(e.message);
    }
  };

  return { state, result, error, exportDiagnosticData };
}
```

**Checklist**:
- [ ] Create Hook with FSM state (idle → collecting → success | error)
- [ ] Call DiagnosticService.execute()
- [ ] Handle errors gracefully
- [ ] Return result with s3Url

#### Step 3: Update SettingsView
**File**: `app/src/02_modules/debug/views/SettingsView.tsx` (or new component)

UI Structure:
```
Settings Panel
├─ 📊 Diagnostic Tools
│  ├─ Local DB: ✅ 5 MB
│  ├─ Last Sync: 2 minutes ago
│  └─ [📤 Send Diagnostic Data]  ← Button
└─ Status display (during collection)
```

**Checklist**:
- [ ] Add diagnostic section to Settings
- [ ] Add "Send Diagnostic Data" button
- [ ] Show loading state (spinner)
- [ ] Show success with download link
- [ ] Show error with retry option

#### Step 4: Define Types
**File**: `app/src/02_modules/debug/types/diagnostic.ts`

```typescript
interface LocalDiagnosticData {
  timestamp: string;
  appVersion: string;
  platform: 'darwin' | 'linux' | 'win32';
  systemInfo: {
    osVersion: string;
    locale: string;
    timezone: string;
  };
  localStorage: {
    transactions: Transaction[];
    images: Image[];
    settings: AppSettings;
  };
  appState: {
    lastSyncTime: string;
    queuedImages: number;
    syncStatus: 'idle' | 'syncing' | 'error';
  };
  debugLogs: DebugLog[];
}

interface DiagnosticResult {
  success: boolean;
  reportId: string;
  s3Url: string;
  timestamp: string;
}
```

**Checklist**:
- [ ] Define LocalDiagnosticData
- [ ] Define DiagnosticResult
- [ ] Export from index

---

### Phase B: Tauri IPC Commands (2-3 hours)

#### Step 5: Define Tauri Commands
**File**: `app/src-tauri/src/lib.rs`

Register two IPC commands:
```rust
#[command]
async fn collect_diagnostic_data() -> Result<Value, String>

#[command]
async fn upload_diagnostic_report(
  data: Value,
  user_id: String,
  token: String
) -> Result<Value, String>
```

**Checklist**:
- [ ] Update lib.rs invoke_handler
- [ ] Register collect_diagnostic_data
- [ ] Register upload_diagnostic_report

#### Step 6: Implement collect_diagnostic_data
**File**: `app/src-tauri/src/commands/diagnostic.rs`

Collect:
1. SQLite data (transactions, images, settings)
2. App version + system info
3. Debug logs (last 500)
4. Sync status

**Checklist**:
- [ ] Query SQLite (transactions, images)
- [ ] Get app version from tauri.conf.json
- [ ] Get OS info (via sysinfo crate or std)
- [ ] Read debug log file
- [ ] Return JSON

#### Step 7: Implement upload_diagnostic_report
**File**: `app/src-tauri/src/commands/diagnostic.rs`

Call Lambda with:
- userId + token (auth)
- localData JSON
- Receive reportId + s3Url

**Checklist**:
- [ ] Build HTTP request to Lambda
- [ ] Include auth headers
- [ ] Serialize localData as JSON
- [ ] Parse Lambda response
- [ ] Error handling (timeout, network)

---

### Phase C: AWS Lambda Backend (2-3 hours)

#### Step 8: Create Lambda Function
**File**: `infra/lambda/diagnostic/index.mjs`

Function: `yorutsuke-diagnostic-dev`

**Checklist**:
- [ ] Create lambda directory
- [ ] Define handler(event)
- [ ] Extract userId + token from event
- [ ] Validate auth

#### Step 9: Implement Cloud Data Query
**File**: `infra/lambda/diagnostic/index.mjs`

Query:
1. DynamoDB: transactions for userId (50 items)
2. S3: list objects with userId prefix (50 items)
3. CloudWatch: last 24h errors

**Checklist**:
- [ ] Query DynamoDB transactions table
- [ ] List S3 image bucket
- [ ] Get CloudWatch logs
- [ ] Handle missing data gracefully

#### Step 10: Generate Diagnostic Report
**File**: `infra/lambda/diagnostic/index.mjs` or `shared-layer`

Report format:
```json
{
  "metadata": {
    "userId": "user-xxx",
    "reportId": "diag-abc123",
    "generatedAt": "2026-01-20T12:00:00Z",
    "source": "manual-button"
  },
  "localData": { ... },
  "cloudData": { ... },
  "diagnosticSummary": "## Summary\n- ✅ Local DB complete\n- ..."
}
```

**Checklist**:
- [ ] Merge local + cloud data
- [ ] Create Markdown summary
- [ ] Validate JSON schema (Zod)
- [ ] Include timestamp + userId

#### Step 11: Upload to S3 + Record Metadata
**File**: `infra/lambda/diagnostic/index.mjs`

Upload:
1. Report JSON to S3 with 90-day lifecycle
2. Metadata to DynamoDB

**Checklist**:
- [ ] Upload report to S3
- [ ] Generate pre-signed URL (7-day expiry)
- [ ] Record metadata in DynamoDB
- [ ] Return reportId + s3Url

#### Step 12: Create DynamoDB Table
**File**: `infra/lib/yorutsuke-stack.ts`

Table: `diagnostics-reports-dev`
```
PK: userId
SK: reportId

Attributes:
- source: 'manual-button' | 'auto-queue'
- createdAt: ISO 8601
- s3Url: report location
- fileSize: bytes
- status: completed | failed
- errorMessage: optional
- TTL: 90 days
```

**Checklist**:
- [ ] Define DynamoDB table in CDK
- [ ] Configure TTL
- [ ] Set IAM permissions
- [ ] Create GSI if needed

#### Step 13: Configure Lambda IAM
**File**: `infra/lib/yorutsuke-stack.ts`

Permissions:
- Read from DynamoDB transactions table
- List/Get from S3 images bucket
- Put to diagnostics-reports table
- Put to diagnostics S3 bucket
- Read CloudWatch logs

**Checklist**:
- [ ] Grant DynamoDB read
- [ ] Grant S3 read/list
- [ ] Grant DynamoDB write (diagnostics)
- [ ] Grant S3 write (diagnostics)
- [ ] Grant CloudWatch read logs

---

### Phase D: Testing (2 hours)

#### Step 14: Local Testing
```bash
# Test without Lambda (mock)
npm run test -- useDiagnosticExportLogic.test.ts
```

**Checklist**:
- [ ] Test Hook state transitions
- [ ] Test error handling
- [ ] Test async flow

#### Step 15: Integration Testing (cdk watch)
```bash
# Terminal 1: cdk watch
cd infra && cdk watch --profile dev

# Terminal 2: Run local tests
cd app && npm run test

# Terminal 3: Trigger in App
# Click button, observe logs
```

**Checklist**:
- [ ] Deploy Lambda with cdk watch
- [ ] Click button in Debug panel
- [ ] Verify local data collection
- [ ] Verify Lambda call succeeds
- [ ] Verify S3 upload
- [ ] Verify DynamoDB record
- [ ] Verify download link works

#### Step 16: End-to-End Testing
```bash
# Full flow test
1. Open Debug/Settings panel
2. Click "Send Diagnostic Data"
3. Wait for ✅ Complete
4. Click download link
5. Verify report JSON structure
```

**Checklist**:
- [ ] UI responds correctly
- [ ] Loading state shows
- [ ] Success message appears
- [ ] Download link functional
- [ ] Report contains all data
- [ ] Error handling works

---

## File Structure

```
New files to create:

app/src/
├─ 01_services/
│  └─ DiagnosticService.ts              ← Service layer
├─ 02_modules/debug/
│  ├─ headless/
│  │  └─ useDiagnosticExportLogic.ts    ← Headless hook
│  ├─ types/
│  │  └─ diagnostic.ts                  ← Type definitions
│  ├─ views/
│  │  └─ DiagnosticPanel.tsx            ← UI component (optional)
│  └─ adapters/
│     └─ diagnosticApi.ts               ← Lambda API call

app/src-tauri/src/
├─ commands/
│  └─ diagnostic.rs                     ← IPC command handlers
├─ services/
│  └─ diagnostic_service.rs             ← Rust business logic
└─ lib.rs                               ← Update invoke_handler

infra/lambda/
└─ diagnostic/
   ├─ index.mjs                         ← Lambda handler
   └─ README.md

Modified files:

app/src/02_modules/debug/views/SettingsView.tsx  ← Add button
infra/lib/yorutsuke-stack.ts                     ← Add Lambda + Table
app/src-tauri/src/lib.rs                         ← Register commands
```

---

## Success Criteria

✅ **When complete, you can**:

1. Open Settings → Diagnostic Tools
2. Click "📤 Send Diagnostic Data"
3. See loading spinner
4. See ✅ success + download link
5. Download JSON report
6. Report contains:
   - Local: transactions, images, logs, system info
   - Cloud: DynamoDB records, S3 list, Lambda logs
   - Summary: Markdown analysis

✅ **Data round-trip**:
- Cloud sync preserves diagnostic data
- Multiple diagnostics don't conflict
- Old transactions render without error

✅ **Error handling**:
- Network timeout → retry + error message
- Lambda 500 → graceful error
- Missing data → skip, continue

---

## Estimated Timeline

| Phase | Task | Duration |
|-------|------|----------|
| A | Frontend Service + Hook + UI | 3-4 h |
| B | Tauri IPC commands | 2-3 h |
| C | Lambda backend | 2-3 h |
| D | Testing | 2 h |
| **Total** | | **9-12 hours** |

---

## Dependency Chain

```
Must do in order:

1. Step 1-4: Frontend Service/Hook/UI/Types
   └─ Tests mock Lambda response

2. Step 5-7: Tauri IPC Commands
   └─ Frontend calls real IPC

3. Step 8-13: Lambda Backend
   └─ Handles real requests

4. Step 14-16: Testing
   └─ Full integration validation
```

---

## References

**Architecture**:
- Pillar L: Headless hook (no JSX)
- Pillar H: Auth validation in Lambda
- Pillar I: App calls Lambda, not AWS directly
- Pillar N: Tracing with traceId

**Related Issues**:
- #151: Model metadata (completed, dependency)
- #153: Queue mode (Phase 2, future)

**Docs**:
- `docs/architecture/README.md`: Layers
- `.claude/rules/headless.md`: Hook patterns
- `.claude/rules/design-system.md`: UI styling

---

## Notes

### Why this order?

1. **Frontend first**: Can test with mocked Lambda response
2. **Tauri middle**: Bridges frontend to backend
3. **Lambda last**: Builds on proven frontend/Tauri interface
4. **Testing concurrent**: Start local tests before Lambda ready

### Key decisions

- **Pillar L**: Headless hook contains all logic, View only renders
- **No deep import**: View → Service → Adapter → IPC
- **Error resilience**: Partial failures don't crash entire flow
- **S3 URL expiry**: 7 days (user has time to download)
- **DynamoDB TTL**: 90 days (auto-cleanup)

### Future (Phase 2)

When ready for queue mode:
- Reuse DiagnosticService.execute()
- Add DynamoDB tasks table
- App checks queue on startup
- Same Lambda function handles both

---

**Ready to start? Begin with Step 1 (DiagnosticService).**
