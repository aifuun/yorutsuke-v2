# Diagnostic Export Feature - Logging Strategy

> **Location**: `src/02_modules/debug/`
> **Logger Used**: `00_kernel/telemetry` (not console.log)
> **Log File**: `~/.yorutsuke/logs/YYYY-MM-DD.jsonl`
> **Related ADR**: ADR-020, ADR-019 (TraceId)

## Overview

The diagnostic export feature uses semantic JSON logging (Pillar R) across three layers:

1. **View Layer** (DiagnosticPanel.tsx)
2. **Service Layer** (DiagnosticService.ts)
3. **Adapter Layer** (diagnosticApi.ts)
4. **AWS Lambda** (infra/lambda/diagnostic/index.mjs)

All logs are correlated by a single `traceId` that propagates end-to-end.

---

## Log Events Reference

### View Layer Events (DiagnosticPanel.tsx)

**Import**: `import { logger } from '../../../00_kernel/telemetry'`

#### DIAGNOSTIC_DOWNLOAD_INITIATED
- **Level**: debug
- **When**: User clicks "Download Report" button
- **Fields**: hasResult, isSuccess
- **Purpose**: Track download button interaction
```json
{
  "event": "DIAGNOSTIC_DOWNLOAD_INITIATED",
  "hasResult": true,
  "isSuccess": true,
  "timestamp": "2026-01-20T20:45:00.000Z"
}
```

#### DIAGNOSTIC_DOWNLOAD_OPENING
- **Level**: info
- **When**: S3 URL is valid and window.open() is called
- **Fields**: s3Url, urlLength, reportId
- **Purpose**: Confirm download URL is being opened
```json
{
  "event": "DIAGNOSTIC_DOWNLOAD_OPENING",
  "s3Url": "https://yorutsuke-diagnostics-dev.s3.us-east-1.amazonaws.com/device-xxx/diag-yyy.json",
  "urlLength": 125,
  "reportId": "diag-yyy",
  "timestamp": "2026-01-20T20:45:00.000Z"
}
```

#### DIAGNOSTIC_DOWNLOAD_RESET
- **Level**: debug
- **When**: State machine is reset to idle after download
- **Fields**: reportId
- **Purpose**: Track state reset after successful download
```json
{
  "event": "DIAGNOSTIC_DOWNLOAD_RESET",
  "reportId": "diag-yyy",
  "timestamp": "2026-01-20T20:45:00.000Z"
}
```

#### DIAGNOSTIC_DOWNLOAD_NO_URL
- **Level**: warn
- **When**: Download clicked but s3Url is empty/missing
- **Fields**: reportId, fileSize
- **Purpose**: Detect incomplete response from Lambda
```json
{
  "event": "DIAGNOSTIC_DOWNLOAD_NO_URL",
  "reportId": "diag-yyy",
  "fileSize": 165700,
  "timestamp": "2026-01-20T20:45:00.000Z"
}
```

#### DIAGNOSTIC_DOWNLOAD_INVALID_STATE
- **Level**: error
- **When**: Download clicked but result object is invalid
- **Fields**: hasResult, isSuccess
- **Purpose**: Detect FSM state corruption
```json
{
  "event": "DIAGNOSTIC_DOWNLOAD_INVALID_STATE",
  "hasResult": false,
  "isSuccess": false,
  "timestamp": "2026-01-20T20:45:00.000Z"
}
```

---

### Service Layer Events (DiagnosticService.ts)

**Import**: `import { logger } from '../../../00_kernel/telemetry'`

#### DIAGNOSTIC_EXPORT_START
- **Level**: info
- **When**: execute() is called
- **Fields**: traceId, userId, userType, attempt
- **Purpose**: Mark beginning of export flow
```json
{
  "event": "DIAGNOSTIC_EXPORT_START",
  "traceId": "trace-abc123xyz",
  "userId": "device-xxx",
  "userType": "guest",
  "attempt": 1,
  "timestamp": "2026-01-20T20:45:00.000Z"
}
```

#### DIAGNOSTIC_STATE_TRANSITION
- **Level**: debug
- **When**: FSM transitions between states
- **Fields**: traceId, from, to, reason
- **Purpose**: Track FSM state machine transitions
```json
{
  "event": "DIAGNOSTIC_STATE_TRANSITION",
  "traceId": "trace-abc123xyz",
  "from": "idle",
  "to": "collecting",
  "reason": "execute() called by user",
  "timestamp": "2026-01-20T20:45:00.000Z"
}
```

#### DIAGNOSTIC_LOCAL_COLLECTION_START
- **Level**: info
- **When**: Starting local data collection
- **Fields**: traceId, userId
- **Purpose**: Mark beginning of Phase 1
```json
{
  "event": "DIAGNOSTIC_LOCAL_COLLECTION_START",
  "traceId": "trace-abc123xyz",
  "userId": "device-xxx",
  "timestamp": "2026-01-20T20:45:00.000Z"
}
```

#### DIAGNOSTIC_LOCAL_COLLECTION_SUCCESS
- **Level**: info
- **When**: Local data collection completes
- **Fields**: traceId, userId, dataSize, elapsedMs
- **Purpose**: Confirm Phase 1 completion
```json
{
  "event": "DIAGNOSTIC_LOCAL_COLLECTION_SUCCESS",
  "traceId": "trace-abc123xyz",
  "userId": "device-xxx",
  "dataSize": 156234,
  "elapsedMs": 1230,
  "timestamp": "2026-01-20T20:45:00.000Z"
}
```

#### DIAGNOSTIC_EXPORT_SUCCESS
- **Level**: info
- **When**: Entire flow completes successfully
- **Fields**: traceId, userId, reportId, fileSize
- **Purpose**: Mark successful flow completion
```json
{
  "event": "DIAGNOSTIC_EXPORT_SUCCESS",
  "traceId": "trace-abc123xyz",
  "userId": "device-xxx",
  "reportId": "diag-yyy",
  "fileSize": 165700,
  "timestamp": "2026-01-20T20:45:00.000Z"
}
```

#### DIAGNOSTIC_EXPORT_ERROR
- **Level**: error
- **When**: Flow encounters error
- **Fields**: traceId, userId, error, retryAttempt
- **Purpose**: Log failures for debugging
```json
{
  "event": "DIAGNOSTIC_EXPORT_ERROR",
  "traceId": "trace-abc123xyz",
  "userId": "device-xxx",
  "error": "Lambda timeout after 30s",
  "retryAttempt": 1,
  "timestamp": "2026-01-20T20:45:00.000Z"
}
```

---

### Adapter Layer Events (diagnosticApi.ts)

**Import**: `import { logger } from '../../../00_kernel/telemetry'`

#### DIAGNOSTIC_API_CALL_START
- **Level**: debug
- **When**: HTTP request to Lambda starts
- **Fields**: traceId, userId, attempt, url
- **Purpose**: Track API call initiation
```json
{
  "event": "DIAGNOSTIC_API_CALL_START",
  "traceId": "trace-abc123xyz",
  "userId": "device-xxx",
  "attempt": 1,
  "url": "https://xxx.lambda-url.amazonaws.com/",
  "timestamp": "2026-01-20T20:45:00.000Z"
}
```

#### DIAGNOSTIC_API_RESPONSE_RAW
- **Level**: debug
- **When**: HTTP response received
- **Fields**: traceId, statusCode, bodyKeys
- **Purpose**: Log raw response for validation debugging
```json
{
  "event": "DIAGNOSTIC_API_RESPONSE_RAW",
  "traceId": "trace-abc123xyz",
  "statusCode": 200,
  "bodyKeys": ["success", "reportId", "s3Url", "timestamp", "fileSize", "traceId"],
  "timestamp": "2026-01-20T20:45:00.000Z"
}
```

#### DIAGNOSTIC_API_CALL_SUCCESS
- **Level**: info
- **When**: Lambda response validated and parsed successfully
- **Fields**: traceId, reportId, hasS3Url, fileSize
- **Purpose**: Confirm successful API call and response validation
```json
{
  "event": "DIAGNOSTIC_API_CALL_SUCCESS",
  "traceId": "trace-abc123xyz",
  "reportId": "diag-yyy",
  "hasS3Url": true,
  "fileSize": 165700,
  "timestamp": "2026-01-20T20:45:00.000Z"
}
```

#### DIAGNOSTIC_S3_URL_RECEIVED
- **Level**: debug
- **When**: S3 presigned URL is received from Lambda
- **Fields**: traceId, s3Url, urlLength
- **Purpose**: Log the actual S3 URL for debugging download issues
```json
{
  "event": "DIAGNOSTIC_S3_URL_RECEIVED",
  "traceId": "trace-abc123xyz",
  "s3Url": "https://yorutsuke-diagnostics-dev.s3.us-east-1.amazonaws.com/device-xxx/diag-yyy.json",
  "urlLength": 125,
  "timestamp": "2026-01-20T20:45:00.000Z"
}
```

#### DIAGNOSTIC_API_CALL_ERROR
- **Level**: error
- **When**: API call fails (network, validation, timeout)
- **Fields**: traceId, userId, attempt, error
- **Purpose**: Log failures for retry logic and debugging
```json
{
  "event": "DIAGNOSTIC_API_CALL_ERROR",
  "traceId": "trace-abc123xyz",
  "userId": "device-xxx",
  "attempt": 1,
  "error": "Diagnostic Lambda request timeout after 30000ms",
  "timestamp": "2026-01-20T20:45:00.000Z"
}
```

---

### Lambda Events (infra/lambda/diagnostic/index.mjs)

#### DIAGNOSTIC_EXPORT_START
- **Fields**: traceId, userId, userType, attempt
- **Purpose**: Lambda begins processing
```json
{
  "event": "DIAGNOSTIC_EXPORT_START",
  "traceId": "trace-abc123xyz",
  "userId": "device-xxx",
  "userType": "guest",
  "attempt": 1
}
```

#### DIAGNOSTIC_COLLECTING_CLOUD_DATA
- **Fields**: traceId, userId
- **Purpose**: Lambda begins Phase 3 for authenticated users
```json
{
  "event": "DIAGNOSTIC_COLLECTING_CLOUD_DATA",
  "traceId": "trace-abc123xyz",
  "userId": "user-xyz"
}
```

#### DIAGNOSTIC_UPLOADING_TO_S3
- **Fields**: traceId, userId, reportId, fileSize
- **Purpose**: Lambda begins S3 upload
```json
{
  "event": "DIAGNOSTIC_UPLOADING_TO_S3",
  "traceId": "trace-abc123xyz",
  "userId": "device-xxx",
  "reportId": "diag-yyy",
  "fileSize": 165700
}
```

#### DIAGNOSTIC_UPLOAD_SUCCESS
- **Fields**: traceId, userId, reportId, s3Url
- **Purpose**: S3 upload completed successfully
```json
{
  "event": "DIAGNOSTIC_UPLOAD_SUCCESS",
  "traceId": "trace-abc123xyz",
  "userId": "device-xxx",
  "reportId": "diag-yyy",
  "s3Url": "https://yorutsuke-diagnostics-dev.s3.us-east-1.amazonaws.com/device-xxx/diag-yyy.json"
}
```

#### DIAGNOSTIC_EXPORT_SUCCESS
- **Fields**: traceId, userId, reportId, fileSize
- **Purpose**: Lambda completes flow successfully
```json
{
  "event": "DIAGNOSTIC_EXPORT_SUCCESS",
  "traceId": "trace-abc123xyz",
  "userId": "device-xxx",
  "reportId": "diag-yyy",
  "fileSize": 165700
}
```

#### DIAGNOSTIC_S3_UPLOAD_ERROR
- **Fields**: traceId, userId, error
- **Purpose**: S3 upload failed
```json
{
  "event": "DIAGNOSTIC_S3_UPLOAD_ERROR",
  "traceId": "trace-abc123xyz",
  "userId": "device-xxx",
  "error": "Access Denied: User does not have permission to s3:PutObject"
}
```

#### DIAGNOSTIC_EXPORT_ERROR
- **Fields**: traceId, error, stack
- **Purpose**: Lambda encountered unrecoverable error
```json
{
  "event": "DIAGNOSTIC_EXPORT_ERROR",
  "traceId": "trace-abc123xyz",
  "error": "Invalid userId format",
  "stack": "..."
}
```

---

## Debugging Guide

### Viewing Logs

```bash
# View today's logs
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | jq .

# View last 50 events
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | tail -50 | jq .

# Filter by traceId (from browser output)
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | jq 'select(.traceId == "trace-abc123xyz")'

# View all DIAGNOSTIC_* events
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | jq 'select(.event | startswith("DIAGNOSTIC_"))'
```

### Scenario 1: Download Button Not Working

```bash
# 1. Get today's logs
LOGS=$(cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | jq -s '.')

# 2. Find latest diagnostic events
echo "$LOGS" | jq '.[] | select(.event | startswith("DIAGNOSTIC_")) | {event, traceId, timestamp}' | tail -20

# 3. Get the latest traceId
TRACE=$(echo "$LOGS" | jq -r '.[] | select(.event | startswith("DIAGNOSTIC_")) | .traceId' | tail -1)

# 4. Follow the flow using that traceId
echo "$LOGS" | jq "select(.traceId == \"$TRACE\") | {event, level: .level, details: .}" | jq -s 'sort_by(.timestamp)'

# 5. Check for download-specific events
echo "$LOGS" | jq "select(.traceId == \"$TRACE\" and .event | startswith(\"DIAGNOSTIC_DOWNLOAD\"))"
```

Expected sequence should be:
```
DIAGNOSTIC_DOWNLOAD_INITIATED (debug)
  ↓
DIAGNOSTIC_DOWNLOAD_OPENING (info) [if s3Url present]
  ↓
DIAGNOSTIC_DOWNLOAD_RESET (debug)
```

Or error case:
```
DIAGNOSTIC_DOWNLOAD_INITIATED (debug)
  ↓
DIAGNOSTIC_DOWNLOAD_NO_URL (warn) [if s3Url missing]
```

### Scenario 2: Lambda Not Returning S3 URL

```bash
# 1. Get traceId from latest diagnostic logs
TRACE=$(cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | \
  jq -r '.[] | select(.event == "DIAGNOSTIC_API_CALL_SUCCESS") | .traceId' | tail -1)

# 2. Check if S3 URL was received
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | \
  jq "select(.traceId == \"$TRACE\" and .event == \"DIAGNOSTIC_S3_URL_RECEIVED\")"

# 3. Check Lambda logs (if available)
aws logs tail /aws/lambda/yorutsuke-diagnostic-export-dev \
  --filter-pattern "$TRACE" \
  --follow --profile dev
```

Expected:
- `DIAGNOSTIC_S3_URL_RECEIVED` event with s3Url field containing full URL
- URL format: `https://yorutsuke-diagnostics-dev.s3.us-east-1.amazonaws.com/{userId}/{reportId}.json`

### Scenario 3: Retry Logic Activated

```bash
# 1. Find DIAGNOSTIC_API_CALL_ERROR events
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | \
  jq 'select(.event == "DIAGNOSTIC_API_CALL_ERROR")'

# 2. Check retry attempts
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | \
  jq '.[] | select(.event | startswith("DIAGNOSTIC_API")) | {event, attempt, userId}' | tail -15
```

Expected:
- attempt 1 fails → DIAGNOSTIC_API_CALL_ERROR
- attempt 2 retries → DIAGNOSTIC_API_CALL_START
- attempt 3 success → DIAGNOSTIC_API_CALL_SUCCESS

---

## Log Levels

| Level | Color | Usage | Example |
|-------|-------|-------|---------|
| **debug** | Gray | Detailed flow tracking | DIAGNOSTIC_DOWNLOAD_INITIATED |
| **info** | Blue | Milestones, successful steps | DIAGNOSTIC_EXPORT_SUCCESS, DIAGNOSTIC_API_CALL_SUCCESS |
| **warn** | Yellow | Non-fatal issues, incomplete data | DIAGNOSTIC_DOWNLOAD_NO_URL |
| **error** | Red | Failures requiring retry/abort | DIAGNOSTIC_EXPORT_ERROR, DIAGNOSTIC_S3_UPLOAD_ERROR |

---

## TraceId Usage

**Single traceId generated at flow start, propagates end-to-end:**

```
Client (DiagnosticPanel)
  ↓ generates traceId: "trace-abc123xyz"
  ↓ includes in DiagnosticService.execute()
  ↓ logs FSM transitions with traceId
  ↓ passes to adapter
  ↓ includes in Lambda request body
  ↓ Lambda receives and uses
  ↓ Lambda includes in response
  ↓ Client validates response traceId matches
  ↓ logs all download events with same traceId
```

**Query all events for single request:**
```bash
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | \
  jq 'select(.traceId == "trace-abc123xyz")' | \
  jq -s 'sort_by(.timestamp) | .[] | {time: .timestamp, event, level}'
```

This shows complete flow from start to finish in one query.

---

## Related Files

- **Service**: `app/src/02_modules/debug/services/DiagnosticService.ts`
- **View**: `app/src/02_modules/debug/views/DiagnosticPanel.tsx`
- **Adapter**: `app/src/02_modules/debug/adapters/diagnosticApi.ts`
- **Lambda**: `infra/lambda/diagnostic/index.mjs`
- **Schemas**: `app/src/02_modules/debug/types/diagnostic.ts`
- **Logger**: `app/src/00_kernel/telemetry/logger.ts`
- **Logs Directory**: `~/.yorutsuke/logs/`

---

**Last Updated**: 2026-01-20
**Status**: Active - Used for debugging diagnostic export feature
**Next**: Implement cloud data collection for authenticated users (Phase 3)
