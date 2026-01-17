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
- Debug panel calls Lambda URL in `us-east-1` region
- `capabilities/default.json` only had HTTP scope for `ap-northeast-1` region
- Missing `us-east-1` Lambda and API Gateway URLs in capability permissions

### Solution (Tauri 2 Capabilities-Based)
Add URL patterns to `app/src-tauri/capabilities/default.json` http:default permissions:
```json
{
  "identifier": "http:default",
  "allow": [
    { "url": "https://*.lambda-url.ap-northeast-1.on.aws/*" },
    { "url": "https://*.lambda-url.us-east-1.on.aws/*" },
    { "url": "https://*.execute-api.us-east-1.amazonaws.com/*" },
    { "url": "https://*.s3.ap-northeast-1.amazonaws.com/*" },
    { "url": "https://s3.ap-northeast-1.amazonaws.com/*" }
  ]
}
```

## Implementation

### Steps
- [x] Identify root cause (HTTP scope missing for us-east-1 region)
- [x] Implement fix (add us-east-1 URLs to capabilities/default.json http:default)
- [x] Update CLAUDE.md rule to reflect correct approach
- [x] Verify fix locally (Tauri compilation successful, no PluginInitialization errors)
- [x] Commit and push

## Verification Checklist (Before Finish)
- [ ] "全部清除" button works without HTTP scope error
- [ ] Data is actually cleared (check localStorage, SQLite, DynamoDB)
- [ ] No console errors related to HTTP scope
- [ ] Lambda receives request successfully (check CloudWatch logs)
