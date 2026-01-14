# Secret Management Rules

> **Golden Rule**: Never hardcode secrets in code. Always load from environment.

See full decision: [ADR-013](../docs/architecture/ADR/013-environment-based-secrets.md)

---

## Quick Reference

### ❌ What NOT to Do

```typescript
// WRONG - Hardcoded in code
const API_KEY = "sk-xxx...";

// WRONG - Committed to git
export const SECRETS = {
  azureKey: "...",
  dbPassword: "...",
};

// WRONG - Visible in diff
environment: {
  API_KEY: "sk-xxx..."
}
```

### ✅ What TO Do

```typescript
// RIGHT - From environment
const apiKey = process.env.AZURE_DI_API_KEY;

// RIGHT - Conditional inclusion
environment: {
  ...(apiKey && { AZURE_DI_API_KEY: apiKey }),
}

// RIGHT - Logged safely
logger.info("Service enabled", { configured: !!apiKey });
```

---

## Setup for Third-Party Services

### Step 1: Create Example File
```bash
# infra/.env.example (commit to git)
# DO NOT PUT REAL VALUES HERE!
AZURE_DI_ENDPOINT=https://resource.cognitiveservices.azure.com/
AZURE_DI_API_KEY=your-api-key-here
```

### Step 2: Add to .gitignore
```
# .gitignore (already done)
.env
.env.local
.env.*.local
```

### Step 3: Load in CDK
```typescript
// infra/lib/yorutsuke-stack.ts
const azureDiEndpoint = process.env.AZURE_DI_ENDPOINT;
const azureDiApiKey = process.env.AZURE_DI_API_KEY;

const lambda = new lambda.Function(..., {
  environment: {
    ...(azureDiEndpoint && { AZURE_DI_ENDPOINT: azureDiEndpoint }),
    ...(azureDiApiKey && { AZURE_DI_API_KEY: azureDiApiKey }),
  },
});
```

### Step 4: Deploy with Credentials
```bash
# Option A: Set in shell
export AZURE_DI_API_KEY=xxx
npm run deploy --context env=dev

# Option B: Use .env file
source .env && npm run deploy --context env=dev

# Option C: Inline
AZURE_DI_API_KEY=xxx npm run deploy --context env=dev
```

---

## Rules by Context

### During Development

| Action | Rule |
|--------|------|
| **Need new API key?** | Add to your `.env` (local only) |
| **Share credentials?** | ❌ NEVER in Slack, email, PR. Use secure vault or verbal/1-1 |
| **Check what's deployed?** | Use AWS console, not by reading code |
| **Accidental commit?** | Revoke key immediately, rotate in vault |

### Code Review

| Check | Rule |
|-------|------|
| **Hardcoded secrets?** | ❌ Reject with "Use environment variable" |
| **String literals?** | Check for suspicious base64, long strings |
| **Config files?** | Ensure `.env*` files in `.gitignore` |
| **Logs?** | Ensure secrets NOT logged (check logger output) |

### Deployment

| Action | Rule |
|--------|------|
| **Local dev?** | Use `.env` file (git-ignored) |
| **Staging?** | Pass via environment variables |
| **Production?** | Use AWS Secrets Manager (future) |

---

## Common Scenarios

### Scenario 1: Adding Azure Document Intelligence

```bash
# Create .env
cd infra/
cat > .env << 'EOF'
AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
AZURE_DI_API_KEY=your-real-key-here
EOF

# Deploy
source .env && npm run deploy --context env=dev --profile dev

# Verify
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev \
  | jq '.Environment.Variables | keys'
```

### Scenario 2: Rotating a Key

```bash
# 1. Get new key from Azure portal
# 2. Update local .env
vim infra/.env

# 3. Redeploy
source .env && npm run deploy --context env=dev --profile dev

# 4. Verify in AWS
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev \
  | jq '.Environment.Variables.AZURE_DI_API_KEY'
```

### Scenario 3: Accidental Commit

```bash
# If you accidentally committed a secret:
# 1. Immediately revoke the key (Azure portal, GitHub, etc.)
# 2. Generate new key
# 3. Update .env
# 4. Redeploy
# 5. Check git history - ask team to do `git pull --force` to remove history

# Example with Azure
# 1. Go to Azure Portal → Document Intelligence → Keys
# 2. Regenerate the key
# 3. Update local .env
# 4. Redeploy
```

---

## Environment Variables Available

| Variable | Service | Where | Dev | Prod |
|----------|---------|-------|-----|------|
| `AZURE_DI_ENDPOINT` | Azure Document Intelligence | infra/.env | ✅ Optional | ✅ Secrets Manager |
| `AZURE_DI_API_KEY` | Azure Document Intelligence | infra/.env | ✅ Optional | ✅ Secrets Manager |
| `AWS_PROFILE` | AWS CLI | Shell | ✅ dev | ✅ prod |
| `AWS_REGION` | AWS | Shell/CDK | ✅ ap-northeast-1 | ✅ ap-northeast-1 |

---

## Security Checklist

Before committing, check:

- [ ] No API keys in code
- [ ] No `.env` file in git (check `.gitignore`)
- [ ] `.env.example` has placeholder values only
- [ ] Environment variables used with `process.env.XXX`
- [ ] Conditional inclusion with `...(key && { KEY: key })`
- [ ] No secrets in log output
- [ ] No secrets in error messages
- [ ] No secrets in comments

---

## Migration Path

### Phase 1 (Now) ✅
- Environment variables from `.env` file
- Works for: Local development, manual deployment

### Phase 2 (Next)
- CI/CD with GitHub Actions
- GitHub Secrets for credentials
- Automated deployment

### Phase 3 (Future)
- AWS Secrets Manager for production
- Lambda reads secrets at runtime
- Automatic rotation support

---

## Related Documentation

- **Full ADR**: [ADR-013: Environment-Based Secrets](../docs/architecture/ADR/013-environment-based-secrets.md)
- **Deployment Guide**: [AZURE_DI_DEPLOYMENT.md](../AZURE_DI_DEPLOYMENT.md)
- **AWS Best Practices**: [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)

---

## Quick Commands

```bash
# Check what's in Lambda environment
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev \
  | jq '.Environment.Variables'

# Load .env and deploy
cd infra/ && source .env && npm run deploy --context env=dev --profile dev

# Check if key is properly set
echo $AZURE_DI_API_KEY  # Should show key (if exported)

# Export for deployment
export $(cat infra/.env | xargs)
npm run deploy --context env=dev --profile dev
```

---

**Last Updated**: 2026-01-14
**Status**: Active Policy
