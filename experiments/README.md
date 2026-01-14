# Experiments Folder

## Purpose

Local testing environment for new features and API integrations before deploying to production (AWS Lambda).

**Goal**: Reduce deployment cycles by verifying changes locally first.

---

## Folders

### `azure-di/` - Azure Document Intelligence Testing

**Status**: ✅ Completed

**What it does**:
- Tests different Azure Document Intelligence REST API formats
- Compares v4.0 (latest), v3.1, v3.0, and incorrect formats
- Identifies the correct API endpoint and version

**Key Findings**:
- ✅ v4.0 format is correct (2024-11-30)
- ❌ document-models with hyphen is wrong (returns 404)
- API path: `/documentintelligence/documentModels/{modelId}:analyze?api-version=2024-11-30`

**Files**:
- `test-azure-di.mjs` - Main test script
- `package.json` - Dependencies
- `README.md` - Usage guide
- `RESULTS.md` - Test results & findings

**How to use**:
```bash
cd azure-di
npm test
```

**Time saved**: ~30 minutes of Lambda redeploys avoided by local testing

---

## Experiments Workflow

### For Future Integrations

1. **Create folder** in `experiments/`
   ```bash
   mkdir experiments/new-feature
   touch experiments/new-feature/{test.mjs,package.json,README.md}
   ```

2. **Write local test** (don't touch Lambda yet)
   - Mock the API call
   - Test different formats/versions
   - Find the correct approach

3. **Document results** in `RESULTS.md`
   - What works
   - What doesn't
   - Recommendations

4. **Once verified**, apply to Lambda
   - Update `infra/lambda/.../code.mjs`
   - Publish Layer
   - Deploy Lambda

5. **Move to archive** (optional)
   ```bash
   mv experiments/feature-name experiments/archive/
   ```

---

## Benefits

| Aspect | Local Testing | AWS Deployment |
|--------|---|---|
| **Time per test** | 10 seconds | 3-5 minutes |
| **Cost** | $0 | $0.001-0.01 |
| **Feedback** | Immediate | Delayed |
| **Debugging** | Easy (full logs) | Hard (CloudWatch logs) |
| **Iterations** | Quick | Slow |

---

## Best Practices

1. **Use Node.js built-ins** - fetch (v18+), JSON, etc.
2. **Document configuration** - How to set API keys
3. **Test multiple formats** - Compare versions side-by-side
4. **Clear output** - Show what passed/failed
5. **Save results** - RESULTS.md for future reference

---

## Related Documentation

- `.claude/rules/lambda-layer-deployment.md` - Lambda deployment guide
- `docs/operations/AZURE_DOCUMENT_INTELLIGENCE.md` - Azure DI setup
- `infra/lambda/shared-layer/nodejs/shared/model-analyzer.mjs` - Production code

---

*Last Updated: 2026-01-14*
