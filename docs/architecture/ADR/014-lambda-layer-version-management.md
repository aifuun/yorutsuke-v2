# ADR-014: Lambda Layer Version Management

**Status**: Accepted
**Date**: 2026-01

## Context

Lambda Layers are immutable versioned artifacts in AWS Lambda. Each code change requires publishing a new version. The problem encountered was:

1. **Code was modified** but Lambda continued using old code
   - Modified `lambda/shared-layer/nodejs/shared/model-analyzer.mjs` (Azure DI API path fix)
   - CDK deployment showed "(no changes)" due to caching
   - Lambda Layer version was not incremented
   - Lambda function continued pointing to old version

2. **Root cause**: CDK's asset hashing caching mechanism did not detect source file changes
   - `cdk deploy` did not trigger `LayerVersion` creation
   - Layer versions are immutable; only new publishes create new versions
   - Old Lambda Layer ARN remained in function configuration

3. **Discovery through debugging**:
   - API calls returned 404 (using old API path)
   - CloudWatch logs showed Azure DI requests using incorrect endpoint
   - Checked Lambda Layer: still Version 15 (old code)
   - Checked latest Layer versions: Version 15 was latest

## Decision

Establish a two-tier Lambda Layer deployment strategy:

### Tier 1: Manual Direct Publishing (Preferred for Layer-only changes)

For changes **only to** `lambda/shared-layer/nodejs/shared/*`:

```bash
# 1. Package source
cd infra
zip -r /tmp/layer.zip lambda/shared-layer/nodejs

# 2. Publish new version (creates immutable snapshot)
aws lambda publish-layer-version \
  --layer-name yorutsuke-shared-dev \
  --zip-file fileb:///tmp/layer.zip \
  --compatible-runtimes nodejs20.x \
  --profile dev

# 3. Update all Lambda functions to new Layer ARN
aws lambda update-function-configuration \
  --function-name <lambda-name> \
  --layers arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:VERSION \
  --profile dev
```

**Advantages**:
- ✅ Deterministic - always creates new version
- ✅ Fast - 2 minutes vs 5 minutes for CDK
- ✅ Visible - explicit version numbers in commands
- ✅ Reliable - no CDK caching issues

**When to use**:
- Bug fixes (immediate deployment)
- Isolated Layer changes
- Emergency patches
- Quick verification cycles

### Tier 2: CDK Deployment (Use for complete updates)

For changes to **both** Layer + CDK configuration:

```bash
# 1. Clear CDK cache (force hash recalculation)
rm -rf cdk.out

# 2. Resynthesis (detects file changes)
npm run synth

# 3. Deploy all stacks
npm run deploy -- --profile dev --all
```

**Advantages**:
- ✅ Unified deployment
- ✅ Version-controlled infrastructure
- ✅ Consistent with CDK paradigm

**When to use**:
- Environment variable updates
- Lambda function code changes
- Complete system releases
- Infrastructure drift corrections

## Implementation Rules

### Rule 1: Always Verify After Deployment

```bash
aws lambda get-function-configuration \
  --function-name <name> \
  --profile dev | jq '.Layers[0].Arn'

# Expected: New version number at the end
# arn:aws:lambda:us-east-1:696249060859:layer:yorutsuke-shared-dev:16
#                                                                   ↑↑
#                                                              Version
```

### Rule 2: Detect Changes Correctly

```
Modified file path
    ↓
lambda/shared-layer/nodejs/shared/*.mjs?
    ├─ YES → Publish new Layer version
    ├─ YES → Update Lambda function Layer ARN
    └─ NO → CDK deploy sufficient
```

### Rule 3: Document Changes in Commit

When publishing a new Layer version:

```bash
git log --oneline -1
# Example output:
# abc1234 fix: update Azure DI API path in model-analyzer.mjs (Layer v16)

# Commit message should include:
# - What changed
# - Why it changed
# - New Layer version number
```

## Consequences

### Positive
- **Prevents silent failures**: Explicit version verification prevents "code changed but not deployed" bugs
- **Faster debugging**: Clear version numbers make CloudWatch log analysis easier
- **Flexible deployment**: Two options for different scenarios
- **Clear responsibility**: Developer must verify deployment success

### Negative
- **Two deployment paths**: Developers must choose between CDK and manual publish
- **Manual overhead**: Layer-only changes require 4 CLI commands
- **Version tracking**: Must monitor Layer versions (partial mitigation: pin in code)

### Mitigations
- **Quick reference docs**: `.claude/rules/lambda-quick-reference.md`
- **Deployment checklist**: `.prot/checklists/lambda-layer-deployment.md`
- **Detailed guide**: `.claude/rules/lambda-layer-deployment.md`

## Related Decisions

- **ADR-001**: Service Pattern (Lambda functions use shared Layer)
- **ADR-013**: Environment-Based Secrets (credentials in Layer environment variables)

## Timeline

| Date | Event |
|------|-------|
| 2026-01-14 02:00 | Azure DI API path bug discovered (404 error) |
| 2026-01-14 02:30 | Code fix applied to model-analyzer.mjs |
| 2026-01-14 02:35 | CDK deploy shows "(no changes)" - Layer not updated |
| 2026-01-14 03:00 | Root cause identified: Layer version management |
| 2026-01-14 03:05 | Published Layer v16 manually with fix |
| 2026-01-14 03:06 | Lambda updated to use v16 |
| 2026-01-14 03:07 | Verified: Lambda now uses correct Layer |

## Appendix: AWS Lambda Layer Behavior

### Why Layers Don't Auto-Update

```
Lambda Layer Versions = Immutable Snapshots
    ├─ Version 1: code_a (permanent, never changes)
    ├─ Version 2: code_b (permanent, never changes)
    └─ Version 15: code_z (current, permanent)

Lambda Function
    └─ Layers: [arn:....:layer:shared-dev:15]  ← Fixed reference

Modify source file
    ↓
CDK caches old hash
    ↓
"(no changes)" output
    ↓
Layer Version 15 unchanged ← Function still uses v15
```

### Why Manual Publishing Works

```
Modify source → zip → publish
                            ↓
                    New snapshot: Version 16
                            ↓
                    Update function: arn:....:v16
                            ↓
                    Function uses new code ✅
```

## References

- Implementation guide: `.claude/rules/lambda-layer-deployment.md`
- Quick reference: `.claude/rules/lambda-quick-reference.md`
- Deployment checklist: `.prot/checklists/lambda-layer-deployment.md`
