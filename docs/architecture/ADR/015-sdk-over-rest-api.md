# ADR-015: SDK Over REST API for Third-Party Integrations

**Status**: Accepted
**Date**: 2026-01-14

## Context

When integrating with third-party cloud services (Azure Document Intelligence, AWS Bedrock, etc.), developers face a choice between two approaches:

| Aspect | REST API | Official SDK |
|--------|----------|--------------|
| **Dependencies** | Zero (use native fetch) | +1-2 MB |
| **Type Safety** | Weak (JSON responses) | Complete TypeScript types |
| **Error Handling** | Manual (every status code) | Standardized by vendor |
| **Retries & Backoff** | Manual implementation | Built-in |
| **API Evolution** | Manual version tracking | Vendor-managed |
| **AI Development** | Harder (URL building, type inference weak) | Easier (explicit methods, types clear) |

### Previous Approach

Azure Document Intelligence was integrated using raw REST API:
- Manually constructed URLs with query parameters
- Hand-written error handling for multiple status codes
- Custom async polling logic
- Type inference limited to `fetch` Response type

This created **friction for AI-assisted development**:
- URL construction prone to typos and version mismatches
- Error handling logic spread across multiple locations
- Type system can't validate parameters or responses
- Harder for AI to understand intent (REST is implicit)

## Decision

**Prefer official SDKs over raw REST API calls for all third-party integrations.**

### Rules for Third-Party Integrations

#### Rule 1: Use Official SDK When Available
```typescript
// ✅ PREFERRED: Official SDK with types
import { DocumentIntelligenceClient, AzureKeyCredential } from "@azure/ai-document-intelligence";

const client = new DocumentIntelligenceClient(endpoint, new AzureKeyCredential(apiKey));
const poller = await client.beginAnalyzeDocument("prebuilt-invoice", { urlSource });
const result = await poller.pollUntilDone();
```

vs

```typescript
// ❌ AVOID: Raw REST API
const response = await fetch(
  `${endpoint}/documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=2024-11-30`,
  {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
    },
    body: JSON.stringify({ urlSource }),
  }
);
```

#### Rule 2: Why SDK is Better for AI Development

Aligns with **AI_DEV_PROT v15** principles:

| Principle | REST API | SDK |
|-----------|----------|-----|
| **Explicit > Abstract** | ❌ URL building, headers implicit | ✅ Clear method names, parameter types |
| **Clear > DRY** | ❌ Manual error handling repeated | ✅ Standardized error types |
| **Concrete > Generic** | ❌ Dynamic JSON, weak type inference | ✅ Complete TypeScript types |
| **Simple > Clever** | ❌ Complex async polling patterns | ✅ Vendor-managed async patterns |

**Benefits for AI**:
- LSP shows all available methods and parameters
- Type errors caught during development
- Vendor handles backward compatibility
- Easier to understand intent from code

#### Rule 3: When REST API is Acceptable

Use REST API ONLY if:
- No official SDK exists
- SDK is unmaintained/outdated
- SDK incompatible with Lambda runtime
- Layer size is critical constraint

Document the exception in code:
```typescript
// @reason: Official SDK not compatible with Lambda Node.js 20.x
// @reference: https://github.com/Azure/azure-sdk-for-js/issues/XXXXX
const result = await fetch(apiUrl, ...);
```

## Implementation for Azure DI

### Step 1: Add SDK to Lambda Layer
```bash
cd infra/lambda/shared-layer
npm install @azure/ai-document-intelligence
```

### Step 2: Update Model Analyzer
```typescript
import { DocumentIntelligenceClient, AzureKeyCredential } from "@azure/ai-document-intelligence";

async function analyzeWithAzureDI(imageUrl) {
  const client = new DocumentIntelligenceClient(
    process.env.AZURE_DI_ENDPOINT,
    new AzureKeyCredential(process.env.AZURE_DI_API_KEY)
  );

  const poller = await client.beginAnalyzeDocument("prebuilt-invoice", {
    urlSource: imageUrl,
  });

  const result = await poller.pollUntilDone();
  return extractFields(result);
}
```

### Step 3: Update Local Tests
Same SDK usage in experiments folder for consistency.

## Consequences

### Positive
- ✅ **Type Safety**: All parameters and responses are typed
- ✅ **AI-Friendly**: Clear method names and types for LSP
- ✅ **Vendor-Managed**: Backward compatibility handled automatically
- ✅ **Error Handling**: Standardized exceptions
- ✅ **Consistency**: Local tests and Lambda use identical approach
- ✅ **Maintainability**: Less custom code to maintain

### Negative
- ⚠️ **Layer Size**: +1-2 MB per SDK (not critical for Yorutsuke)
- ⚠️ **Dependencies**: Transitive dependencies need monitoring
- ⚠️ **Versioning**: SDK updates may have breaking changes

### Layer Size Impact
Current Layer: ~500 KB
With Azure SDK: ~1.5-2 MB total
Lambda limit: 250 MB
Impact: Negligible

## Implementation Checklist

- [ ] Add SDK to `infra/lambda/shared-layer/package.json`
- [ ] Update `infra/lambda/shared-layer/nodejs/shared/model-analyzer.mjs`
- [ ] Update local test scripts in `experiments/azure-di/`
- [ ] Verify Lambda Layer v21 publishes successfully
- [ ] Test end-to-end with Tauri app upload
- [ ] Document SDK usage in `docs/operations/AZURE_DOCUMENT_INTELLIGENCE.md`

## Related

- [013-environment-based-secrets.md](./013-environment-based-secrets.md) - Credential management
- `docs/operations/AZURE_DOCUMENT_INTELLIGENCE.md` - Azure DI setup guide
- `experiments/azure-di/` - Local test scripts

---

*Established to improve type safety, maintainability, and AI development ergonomics for third-party cloud service integrations.*
