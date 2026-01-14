# External API Integration Rules

> Principles for integrating third-party cloud services (Azure, AWS, etc.)

## Primary Rule: SDK First

**Always prefer official SDKs over raw REST API calls.**

| Scenario | Approach |
|----------|----------|
| Official SDK available | ✅ Use SDK |
| SDK not available | ⚠️ REST API with documentation |
| SDK incompatible with Lambda | ⚠️ Discuss with team, document exception |

See [ADR-015: SDK Over REST API](../docs/architecture/ADR/015-sdk-over-rest-api.md) for detailed rationale.

## Integration Checklist

### 1. Planning Phase
- [ ] Check if official SDK exists
- [ ] Verify SDK supports Node.js 20.x runtime
- [ ] Estimate Layer size impact
- [ ] Review SDK documentation (latest version)

### 2. Implementation Phase
- [ ] Add SDK to `infra/lambda/shared-layer/package.json`
- [ ] Implement in Lambda code
- [ ] Implement identical approach in local tests (`experiments/`)
- [ ] Add type annotations (use SDK types)

### 3. Testing Phase
- [ ] Test locally first (no Lambda deployments)
- [ ] Verify Layer publishes successfully
- [ ] Test end-to-end with real data
- [ ] Check CloudWatch logs

### 4. Documentation Phase
- [ ] Update `docs/operations/SERVICE_NAME.md`
- [ ] Document SDK version used
- [ ] Add troubleshooting section
- [ ] Link to official SDK docs

## Code Pattern: SDK Usage

### Template (TypeScript)
```typescript
import { Client, Credential } from "@vendor/sdk";

// Type-safe initialization
const client = new Client(
  process.env.VENDOR_ENDPOINT,
  new Credential(process.env.VENDOR_API_KEY)
);

// Type-safe operations
const result = await client.operation({
  param1: value1,
  param2: value2,
});

// Type-safe error handling
try {
  const result = await client.operation(params);
  return result;
} catch (error) {
  if (error instanceof VendorServiceError) {
    // Handle vendor-specific errors
    logger.error("Service error", { error: error.message });
  }
  throw error;
}
```

## Common Integrations

### Azure Document Intelligence

```typescript
import { DocumentIntelligenceClient, AzureKeyCredential } from "@azure/ai-document-intelligence";

const client = new DocumentIntelligenceClient(
  process.env.AZURE_DI_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_DI_API_KEY)
);

const poller = await client.beginAnalyzeDocument("prebuilt-invoice", {
  urlSource: imageUrl,
});

const result = await poller.pollUntilDone();
```

**Reference**: [Azure Document Intelligence Docs](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/)

### AWS Bedrock (Future)

When adding Bedrock models, use official `@aws-sdk/client-bedrock-runtime` instead of raw REST API.

## Environment Variables

All SDKs must load credentials from environment variables, never hardcode.

See [ADR-013: Environment-Based Secret Management](../docs/architecture/ADR/013-environment-based-secrets.md).

```typescript
// ✅ CORRECT
const endpoint = process.env.SERVICE_ENDPOINT;
const apiKey = process.env.SERVICE_API_KEY;

// ❌ WRONG
const endpoint = "https://hardcoded.endpoint.com";
```

## Layer Size Management

SDK dependencies are acceptable if:
- Total Layer size < 200 MB (Lambda limit: 250 MB)
- SDK provides significant maintainability benefit
- No alternative exists

Current sizes:
- Zod: 100 KB
- Luxon: 150 KB
- @azure/ai-document-intelligence: 400-600 KB
- Total with buffer: ~1.5 MB ✅

## Error Handling Pattern

```typescript
async function callExternalService() {
  try {
    const result = await client.operation(params);
    return result;
  } catch (error) {
    // Vendor-specific error
    if (isVendorError(error)) {
      logger.error("External service failed", {
        service: "ServiceName",
        code: error.code,
        message: error.message,
        traceId: ctx.traceId,  // From Pillar N
      });
      throw new ServiceIntegrationError(error.message);
    }
    // Network error
    throw error;
  }
}
```

## Testing Local vs Lambda

**Keep them identical**:

```bash
# Both should work the same way
experiments/azure-di/test.mjs     # Local test
infra/lambda/.../analyzer.mjs     # Lambda code

# Use same SDK version
package.json (both locations)
```

## Quick Reference

| Need | Location | When |
|------|----------|------|
| SDK Decision | ADR-015 | Planning new integration |
| Environment Secrets | ADR-013 | Storing credentials |
| Type Patterns | `.prot/` | During coding |
| Testing Guide | `experiments/` | Before deploying |

---

**Last Updated**: 2026-01-14
**Related**: ADR-013, ADR-015, docs/operations/
