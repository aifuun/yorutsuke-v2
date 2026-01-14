# Azure Document Intelligence - Deployment Guide

✅ **No more hardcoded secrets!**

Credentials are loaded from environment variables at deployment time, keeping them secure.

---

## 🚀 Deploy with Azure DI Enabled

### Option 1: Set Environment Variables (Recommended for CI/CD)

```bash
cd infra/

# Set environment variables
export AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
export AZURE_DI_API_KEY=<REDACTED_SECRET>

# Deploy
npm run deploy --context env=dev --profile dev
```

### Option 2: Create Local .env File (Recommended for Local Development)

```bash
cd infra/

# Create .env file
cat > .env << 'EOF'
AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/
AZURE_DI_API_KEY=<REDACTED_SECRET>
EOF

# Load and deploy
source .env && npm run deploy --context env=dev --profile dev
```

### Option 3: One-Liner

```bash
cd infra/ && \
  AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/ \
  AZURE_DI_API_KEY=<REDACTED_SECRET> \
  npm run deploy --context env=dev --profile dev
```

---

## ✅ What Happens During Deployment

1. **CDK reads** `process.env.AZURE_DI_ENDPOINT` and `process.env.AZURE_DI_API_KEY`
2. **Credentials are passed** to Lambda environment variables
3. **Lambda uses them** to call Azure Document Intelligence API
4. **Git repository** stays clean (no secrets exposed)

---

## 🔒 Security Checklist

- ✅ Credentials NOT hardcoded in `yorutsuke-stack.ts`
- ✅ Credentials NOT committed to git
- ✅ `.env` file added to `.gitignore` (safe)
- ✅ Loaded from environment at deployment time
- ✅ Future: Migrate to AWS Secrets Manager for production

---

## 📋 Verify Deployment

After deployment, check that credentials were passed:

```bash
# View Lambda environment variables
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev \
  | jq '.Environment.Variables | {AZURE_DI_ENDPOINT, AZURE_DI_API_KEY}'
```

Expected output:
```json
{
  "AZURE_DI_ENDPOINT": "https://rj0088.cognitiveservices.azure.com/",
  "AZURE_DI_API_KEY": "<REDACTED_SECRET>"
}
```

---

## 🧪 Test End-to-End

1. **Upload receipt via app**
   ```bash
   cd app && npm run tauri dev
   # Drag & drop a receipt image
   ```

2. **Check CloudWatch logs**
   ```bash
   aws logs tail /aws/lambda/yorutsuke-instant-processor-us-dev \
     --follow --profile dev
   # Watch for: AZURE_DI_REQUEST_START, AZURE_DI_RESPONSE_RECEIVED
   ```

3. **Verify results in DynamoDB**
   ```bash
   aws dynamodb scan \
     --table-name yorutsuke-transactions-us-dev \
     --projection-expression "transactionId,modelComparison" \
     --profile dev \
     | jq '.Items[0].modelComparison.M | keys'
   ```

Expected output:
```json
[
  "azure_di",      ← NEW!
  "nova_mini",
  "nova_pro",
  "textract"
]
```

---

## ⚠️ What NOT to Do

❌ **Don't commit .env**
- Never add secrets to git

❌ **Don't hardcode in CDK**
- Credentials were in code before, now they're in environment

❌ **Don't store in git**
- .env is in .gitignore for a reason

---

## 🔐 Future: Production Setup with AWS Secrets Manager

For production deployments, migrate to AWS Secrets Manager:

```typescript
// In yorutsuke-stack.ts
const secret = new secretsmanager.Secret(this, "AzureDiSecret", {
  secretName: "yorutsuke/azure-di",
});

const instantProcessLambda = new lambda.Function(..., {
  environment: {
    AZURE_DI_SECRET_NAME: secret.secretName,
  },
});

secret.grantRead(instantProcessLambda);

// In Lambda runtime, read from secret:
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();
const secret = await secretsManager.getSecretValue({
  SecretId: process.env.AZURE_DI_SECRET_NAME
}).promise();
const { endpoint, apiKey } = JSON.parse(secret.SecretString);
```

See: `docs/operations/AZURE_DOCUMENT_INTELLIGENCE.md` (Security section)

---

## Summary

✅ **Deployment Command**:
```bash
AZURE_DI_ENDPOINT=https://rj0088.cognitiveservices.azure.com/ \
AZURE_DI_API_KEY=your-key \
npm run deploy --context env=dev --profile dev
```

✅ **Secrets stay secure** - loaded from environment, not hardcoded

✅ **Git stays clean** - no credentials in repository

Ready to deploy! 🚀
