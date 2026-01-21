# ADR-020: Diagnostic Export - All Users Upload to S3

**Date**: 2026-01-20
**Status**: ACCEPTED
**Decision Maker**: User requirement clarification
**Related Issues**: #152 - Diagnostic Export UI/UX

## Context

The diagnostic export feature is designed as a developer tool (Debug Panel) to help collect system state for troubleshooting. Initial implementation differentiated between guest users (device-*) and authenticated users (user-*), with only authenticated users receiving S3 download URLs.

This created a feature gap: guest users could see diagnostic data collection complete but couldn't download the full diagnostic report, reducing utility of the tool for debugging guest user issues.

## Decision

**ALL users (both guest device-* and authenticated user-*) upload diagnostic reports to S3 and receive presigned download URLs.**

### Key Changes

1. **Lambda Upload Logic** (`infra/lambda/diagnostic/index.mjs`):
   - BEFORE: Conditional upload based on userType
     ```javascript
     if (userType === "authenticated") {
       // upload to S3
     } else {
       return { reportId, s3Url: "", timestamp, fileSize };
     }
     ```
   - AFTER: Unconditional upload for all users
     ```javascript
     // Upload to S3 for all users (guest + authenticated)
     // Access control via userId prefix + IAM policies
     const s3Key = `${userId}/${reportId}.json`;
     await s3Client.send(new PutObjectCommand({...}));
     const s3Url = `https://${DIAGNOSTICS_BUCKET}.s3.${region}.amazonaws.com/${s3Key}`;
     ```

2. **Access Control Model**:
   - IAM policies use userId prefix-based access:
     - `device-*` users can only read objects under `s3://bucket/device-*/`
     - `user-*` users can only read objects under `s3://bucket/user-*/`
   - S3 bucket policy enforces this partition

3. **UI Update**:
   - DiagnosticPanel now always shows Download/Copy Link buttons after successful export
   - No longer hides download UI based on user type

## Rationale

1. **Debugging Utility**: Debug Panel is a developer tool. Complete diagnostic data (local + cloud state) is needed regardless of user authentication status.

2. **Consistent Experience**: Guest users should have feature parity with authenticated users for diagnostic collection.

3. **Simplified Code**: Removes conditional branching in Lambda, making flow simpler and more maintainable.

4. **Access Control Preserved**: IAM policies still enforce data isolation by userId prefix - no security regression.

## Consequences

### Positive
- ✅ Guest users can now debug their issues with complete diagnostic data
- ✅ Simplified Lambda logic (no conditional branches)
- ✅ Consistent UX across user types
- ✅ All S3 uploads are uniform and predictable

### Negative
- ⚠️ Guest users will see S3 URLs in download UI (no functional risk due to IAM policies)
- ⚠️ S3 quota may increase slightly (guest diagnostic data now persisted)

## Implementation Details

### Deployment
- Lambda CodeSha256: `81b0da5b`
- Deployed: 2026-01-20 20:45:07 UTC
- Rollback: Change `generateAndUploadReport()` to check `userType` again

### Testing
- Guest user flow:
  1. Start diagnostic collection with `device-*` userId
  2. Verify Lambda logs: `DIAGNOSTIC_UPLOADING_TO_S3` for guest user
  3. Verify s3Url is returned (not empty string)
  4. Verify presigned URL is downloadable
  5. Verify s3Url matches pattern: `https://bucket/device-{uuid}/diag-{id}.json`

### Logging
- Event: `DIAGNOSTIC_UPLOADING_TO_S3` (info level)
  - Fields: traceId, userId, reportId, fileSize
- Event: `DIAGNOSTIC_UPLOAD_SUCCESS` (info level)
  - Fields: traceId, userId, reportId, s3Url
- Event: `DIAGNOSTIC_S3_URL_RECEIVED` (debug level)
  - Fields: traceId, s3Url, urlLength

## Alternatives Considered

### Option 1: Guest-only Local Storage (REJECTED)
- Store guest diagnostic data locally in SQLite only
- **Problem**: Can't correlate with AWS Lambda logs for cloud issues

### Option 2: Guest → Authenticated Migration Flow (REJECTED)
- Migrate guest diagnostic data to user-* account when user authenticates
- **Problem**: Adds complexity, doesn't solve the immediate debugging need

### Option 3: Shared S3 Bucket, User-Specific Prefix (ACCEPTED - Current)
- All users upload to S3, IAM policies partition by userId prefix
- **Benefit**: Simple, consistent, secure via IAM

## Related Decisions

- **ADR-013**: Environment-based secret management (S3 credentials via env vars)
- **ADR-019**: TraceId distributed tracing (diagnostic report correlation)
- **Pillar B**: Airlock - DiagnosticExportResponseSchema validates all Lambda responses
- **Pillar L**: Headless - DiagnosticPanel (View) subscribes to diagnosticStore (Service vanilla Zustand)

## Monitoring & Alerts

- CloudWatch Metric: S3 PutObject count for diagnostic bucket
- Alert: If S3 upload fails, Lambda retries 3x then fails with error state
- Log Query: Filter `DIAGNOSTIC_UPLOAD_SUCCESS` events by userId prefix to monitor guest vs authenticated distribution

---

**Decision Made**: User requirement clarification (2026-01-20)
**Rationale Recorded**: All users need complete diagnostic data for effective debugging
