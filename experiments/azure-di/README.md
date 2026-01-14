# Azure Document Intelligence - Local Testing

## Purpose

This folder contains local testing tools for Azure Document Intelligence API before deploying to Lambda.

**Why local testing?**
- ✅ Fast feedback (seconds, not minutes)
- ✅ No need to deploy Lambda Layer
- ✅ Easy to debug API format issues
- ✅ Test different API versions side-by-side
- ✅ Save AWS API costs during development

**Workflow**:
1. Run local tests → find correct API format
2. Apply fix to Lambda code
3. Deploy to AWS → verify in production

---

## Quick Start

### 1. Run Tests

```bash
cd /Users/woo/dev/yorutsuke-v2-1/experiments/azure-di
npm test
```

### 2. What It Tests

The script tests 4 different API formats:
- ✅ **v4.0 (Latest)**: `documentModels` + `:analyze` + `2024-11-30`
- ✅ **v3.1 (GA)**: `formrecognizer` + `:analyze` + `2023-07-31`
- ⚠️ **v3.0 (GA)**: `formrecognizer` + `:analyze` + `2022-08-31`
- ❌ **Incorrect**: `document-models` (with hyphen) - will fail

### 3. Expected Output

A successful test (202 Accepted) looks like:
```
================================================================================
Testing: v4.0 (Latest GA - 2024-11-30)
Official format: documentModels (camelCase) + :analyze (colon)
URL: https://rj0088.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=2024-11-30
================================================================================
Status: 202 Accepted
Headers:
  operation-location: https://rj0088.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-invoice/analyzeResults/...
✅ SUCCESS: Got 202 Accepted - API format is CORRECT
```

A failed test (404 Not Found) looks like:
```
Status: 404 Not Found
❌ FAILED: 404 Not Found - endpoint path may be incorrect
```

---

## Environment Variables

Set these before running tests:

```bash
export AZURE_DI_ENDPOINT="https://rj0088.cognitiveservices.azure.com/"
export AZURE_DI_API_KEY="<REDACTED_SECRET>"

# Then run
npm test
```

Or pass inline:
```bash
AZURE_DI_ENDPOINT="..." AZURE_DI_API_KEY="..." npm test
```

---

## How to Use Test Results

### If All Tests Pass

Great! Check which format returned **202 Accepted**.
Example: If v4.0 passes, use this in Lambda:

```javascript
const apiUrl = `${endpoint.replace(/\/$/, '')}/documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=2024-11-30`;
```

### If Tests Fail With 404

The endpoint path is wrong. Check:
1. ✅ Is `documentModels` camelCase (NOT `document-models`)?
2. ✅ Is separator `:analyze` (NOT `/analyze`)?
3. ✅ Is API version correct (latest GA, NOT preview)?

### If Tests Fail With 401/403

Authentication issue:
1. ✅ Check `AZURE_DI_API_KEY` is correct
2. ✅ Check `AZURE_DI_ENDPOINT` is correct
3. ✅ Check key is still valid (not expired/revoked)

---

## Testing Checklist

Before applying local test results to Lambda:

- [ ] Ran local test with correct credentials
- [ ] Got **202 Accepted** response
- [ ] Noted the correct API format
- [ ] Checked `operation-location` header is present
- [ ] Ready to update Lambda code with correct format

---

## After Successful Local Test

1. Update Lambda code in `infra/lambda/shared-layer/nodejs/shared/model-analyzer.mjs`
2. Publish new Layer version
3. Update Lambda function to use new Layer
4. Upload test receipt in Tauri app
5. Verify `modelComparison.azure_di` appears in DynamoDB

---

## Reference

- **Official Docs**: https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/quickstarts/get-started-sdks-rest-api?view=doc-intel-4.0.0
- **REST API Reference**: https://learn.microsoft.com/en-us/rest/api/aiservices/document-intelligence/operation-groups
- **Supported Models**: https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/concept-model-overview

---

## Troubleshooting

### Error: `Cannot find module 'fetch'`

Node.js v18+ has native `fetch`. If you're on older Node, add:

```bash
npm install node-fetch
```

Then add to top of script:
```javascript
import fetch from 'node-fetch';
```

### Error: `ENOTFOUND`

Network issue:
- Check internet connection
- Check firewall allows outbound HTTPS to Azure
- Try with `curl` first:

```bash
curl -v -X POST "https://rj0088.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=2024-11-30" \
  -H "Content-Type: application/json" \
  -H "Ocp-Apim-Subscription-Key: YOUR_KEY" \
  -d '{"urlSource":"https://..."}'
```

### Unexpected Status Code

Run with verbose output:
```bash
npm run test:verbose
```

---

## Files

- `test-azure-di.mjs` - Main test script
- `package.json` - Dependencies & scripts
- `README.md` - This file

---

## Next Steps

Once you find the correct API format locally:

1. **Update Lambda** → `infra/lambda/shared-layer/nodejs/shared/model-analyzer.mjs`
2. **Publish Layer** → `aws lambda publish-layer-version ...`
3. **Deploy Lambda** → Update function config with new Layer ARN
4. **Test in Tauri** → Upload receipt and verify results

---

*Last Updated: 2026-01-14*
