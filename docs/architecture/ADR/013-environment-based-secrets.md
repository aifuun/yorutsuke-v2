# ADR-013: Environment-Based Secret Management

**Status**: Accepted
**Date**: 2026-01

## Context

When integrating third-party services (AWS Bedrock, Azure Document Intelligence, etc.) that require API keys and credentials, we face a security challenge:

| Approach | Security | Maintainability | Risk |
|----------|----------|-----------------|------|
| Hardcoded in code | ❌ Critical breach | ✅ Easy | Leaked to git |
| .env file committed | ❌ Critical breach | ✅ Easy | Public repository leak |
| Environment variables | ✅ Secure | ⚠️ Manual | Requires discipline |
| AWS Secrets Manager | ✅✅ Secure | ✅ Automated | Cost, complexity |

Previous approach: Azure Document Intelligence API key was hardcoded in `infra/lib/yorutsuke-stack.ts`. This violates security best practices.

## Decision

Adopt a **three-tier secret management strategy** based on deployment environment:

### Tier 1: Development (Local)
Use environment variables loaded from local `.env` file:
- Store credentials in `infra/.env` (git-ignored)
- Load via `process.env` at CDK deployment time
- Safe because `.env` is added to `.gitignore`

```typescript
// infra/lib/yorutsuke-stack.ts
const azureDiApiKey = process.env.AZURE_DI_API_KEY;

const lambda = new lambda.Function(..., {
  environment: {
    ...(azureDiApiKey && { AZURE_DI_API_KEY: azureDiApiKey }),
  },
});
```

### Tier 2: Staging/Production (Manual)
Use environment variables passed at deployment:
```bash
AZURE_DI_API_KEY=xxx npm run deploy --context env=prod --profile prod
```

### Tier 3: Production (Automated - Future)
Migrate to AWS Secrets Manager:
```typescript
const secret = new secretsmanager.Secret(this, "AzureDiSecret", {
  secretName: "yorutsuke/azure-di",
});

secret.grantRead(lambda);

// Lambda reads at runtime (not deployment)
```

## Implementation Rules

### Rule 1: Never Hardcode Secrets
```typescript
// ❌ WRONG - Exposed in git
const API_KEY = "xxx...";

// ✅ RIGHT - From environment
const API_KEY = process.env.AZURE_DI_API_KEY;
```

### Rule 2: Add to .gitignore
```
# .gitignore
.env           # Never commit
.env.local
.env.*.local
```

### Rule 3: Create .env.example Template
```bash
# infra/.env.example (committed to git)
# DANGER: Do NOT put real values here!
AZURE_DI_ENDPOINT=https://resource.cognitiveservices.azure.com/
AZURE_DI_API_KEY=your-api-key-here
```

### Rule 4: Conditional Environment Variables
```typescript
// Only include in Lambda if credentials provided
const lambda = new lambda.Function(..., {
  environment: {
    ...(apiKey && { API_KEY: apiKey }),
    // If apiKey is undefined, key won't be in environment
  },
});
```

### Rule 5: Load Early, Log Late
```typescript
// ✅ Load at CDK synthesis time
const secret = process.env.AZURE_DI_API_KEY;

// ✅ Log non-sensitive info only
logger.info("Azure DI enabled", { endpoint: secret ? "configured" : "missing" });

// ❌ NEVER log the actual secret
logger.info("Secret is: " + secret); // WRONG!
```

## Consequences

### Positive
- ✅ **No secrets in git** - Repository stays clean
- ✅ **Flexible deployment** - Same code, different credentials per environment
- ✅ **Audit trail** - Shell history shows what was deployed
- ✅ **Easy onboarding** - New devs copy `.env.example` and fill in blanks
- ✅ **Zero hardcoding** - Credentials never embedded in CDK

### Negative
- ⚠️ **Manual management** - Each developer maintains their own `.env`
- ⚠️ **No CI/CD yet** - Requires manual deployment with secrets
- ⚠️ **Rotation effort** - Changing keys requires re-deployment

### Migration Path
- Phase 1 (Now): Environment variables + `.env.example`
- Phase 2 (Next): CI/CD with GitHub Actions secrets
- Phase 3 (Future): AWS Secrets Manager for production

## Application to Yorutsuke

### Azure Document Intelligence Integration
```bash
# Setup (done once)
cd infra/
cat > .env << 'EOF'
AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
AZURE_DI_API_KEY=<REDACTED_SECRET>
EOF

# Deployment
source .env && npm run deploy --context env=dev --profile dev
```

### What Gets Deployed
- ✅ Credentials passed to Lambda environment
- ✅ `.env` file stays local (never uploaded)
- ✅ Code clean, no secrets visible
- ✅ Git repository safe

## Related

- [AZURE_DI_DEPLOYMENT.md](../../AZURE_DI_DEPLOYMENT.md) - Deployment guide
- [secrets.md](../../.claude/rules/secrets.md) - Developer quick reference
- Issue #XXX - Azure Document Intelligence integration

---

*Established to secure third-party API integrations while maintaining developer experience*
