---
issue: debug/clear-all-data
type: bugfix
---

# Bugfix: Debug Clear All Data HTTP Scope Error

## Problem
When clicking "全部清除" (Clear All Data) in debug panel, request fails with:
```
Error: url not allowed on the configured scope
URL: https://uf65y54k774qe6zpuvaybiopva0kfmsn.lambda-url.us-east-1.on.aws/
```

This is a **Tauri HTTP scope error** - the Lambda URL is not in the allowed CORS scope.

## Root Cause Analysis ✅

### Root Cause Found
- `adminApi.ts` uses Tauri's `@tauri-apps/plugin-http` fetch plugin
- Lambda URL (`*.lambda-url.us-east-1.on.aws`) not in Tauri's HTTP scope
- `tauri.conf.json` was missing HTTP plugin scope configuration

### Solution
Add HTTP scope to `tauri.conf.json` to allow AWS Lambda and API Gateway URLs:
```json
"plugins": {
  "http": {
    "scope": [
      "https://*.execute-api.us-east-1.amazonaws.com",
      "https://*.lambda-url.us-east-1.on.aws"
    ]
  }
}
```

## Implementation

### Steps
- [x] Identify root cause (HTTP scope not configured)
- [x] Implement fix (add http plugin scope in tauri.conf.json)
- [ ] Verify fix locally (test clear-all-data in debug panel)
- [ ] Commit and push

## Verification Checklist (Before Finish)
- [ ] "全部清除" button works without HTTP scope error
- [ ] Data is actually cleared (check localStorage, SQLite, DynamoDB)
- [ ] No console errors related to HTTP scope
- [ ] Lambda receives request successfully (check CloudWatch logs)
