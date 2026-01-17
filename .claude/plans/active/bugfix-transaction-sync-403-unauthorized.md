---
issue: transaction-sync-403-unauthorized
type: bugfix
---

# Bugfix: Transaction Sync 403 Unauthorized Error

## Problem

Transaction sync fails with 403 Unauthorized error:
```json
{
  "userId": "device-9D74EBA4-BBE1-581F-99BD-4CC91CEA0D22",
  "error": "Error: 403: Unauthorized",
  "traceId": "trace-b7c3068a-9a01-42f8-b06a-77bcd6f20f2c"
}
```

The error occurs repeatedly in the logs, indicating an authentication/authorization failure in the Transaction API.

## Root Cause Analysis ✅ FOUND

### The Problem: Stale Lambda URL

**Frontend hardcoded URL** (points to ap-northeast-1):
```typescript
// app/src/02_modules/transaction/adapters/transactionApi.ts:12
const TRANSACTIONS_URL = 'https://yy2xogwnhx4sxu7tbmt6ax67r40zhzzo.lambda-url.ap-northeast-1.on.aws/';
```

**Actual Lambda deployed** (in us-east-1):
```
FunctionUrl: https://yq7fcp4d2oivugpbyapddkzyji0dvzkt.lambda-url.us-east-1.on.aws/
AuthType: NONE (no auth required)
Region: us-east-1
```

### Why 403 Error?
- Frontend tries to call ap-northeast-1 endpoint
- Endpoint doesn't exist (Lambda is in us-east-1)
- AWS rejects non-existent endpoint with 403 Unauthorized
- CloudWatch shows NO logs (request never reaches Lambda) ← confirms this
- Error occurs for ALL users (device and authenticated) trying to sync

### Root Cause: Region Mismatch
- Lambda URL hardcoded to old ap-northeast-1 region
- Actual Lambda was moved/deployed to us-east-1
- Frontend code was never updated with new URL

## Implementation

### Steps
- [x] Check CloudWatch logs for Lambda execution errors (found NO logs = request doesn't reach Lambda)
- [x] Identify root cause: Lambda URL points to wrong region (ap-northeast-1 vs us-east-1)
- [x] Update `app/src/02_modules/transaction/adapters/transactionApi.ts` line 12 with correct URL
- [ ] Use environment variable for Lambda URL instead of hardcoding (optional improvement)
- [ ] Test locally that sync works
- [ ] Verify in app that 403 error is gone

### Fix Implementation
1. **Update hardcoded URL** in `transactionApi.ts` line 12
   - Old: `https://yy2xogwnhx4sxu7tbmt6ax67r40zhzzo.lambda-url.ap-northeast-1.on.aws/`
   - New: `https://yq7fcp4d2oivugpbyapddkzyji0dvzkt.lambda-url.us-east-1.on.aws/`

2. **Or Better: Use environment variable**
   - Add `VITE_LAMBDA_TRANSACTIONS_URL` env var
   - Read from `import.meta.env.VITE_LAMBDA_TRANSACTIONS_URL`
   - Set in `.env.development`

## Verification Checklist (Before Finish)
- [ ] Transaction sync works for device users
- [ ] Transaction sync works for authenticated users
- [ ] No 403 errors in logs
- [ ] Lambda CloudWatch logs show successful requests
- [ ] API Gateway authorization working correctly
