# CDK Deployment Workflow

## Overview

Every time you deploy CDK infrastructure, environment variables must be synced to keep the frontend configuration current.

This is **automated** - but here's what happens behind the scenes.

## Standard Deployment Flow

### 1. Deploy Infrastructure

```bash
cd infra
npm run deploy
```

**What happens**:
- CDK synthesizes and deploys stacks to AWS
- CloudFormation creates/updates resources
- Stack outputs are generated (API URLs, Cognito IDs, etc.)

### 2. Auto-Sync Outputs (Automatic)

After deployment completes, this runs automatically:

```bash
npm run sync-outputs
```

**What it does**:
- Extracts CDK stack outputs from CloudFormation
- Updates `.env` files with new values
- Prints summary of changes

**Output**:
```
✅ Extracted values:
   AdminUserPoolId: us-east-1_xxxxxx
   AdminUserPoolClientId: 5otc7ulrshm23acll
   AdminApiUrl: https://xxxxx.execute-api.us-east-1.amazonaws.com/prod/
   ConfigLambdaUrl: https://xxxxx.lambda-url.us-east-1.on.aws/

✅ admin/.env updated
✅ app/.env.local updated

🎉 CDK outputs synced successfully!
```

### 3. Rebuild Frontend

```bash
npm run build --workspace admin
```

The new environment variables are baked into the build.

### 4. Deploy Frontend

```bash
npm run s3-deploy --workspace admin
npm run cf-invalidate --workspace admin
```

Frontend is now deployed with updated configuration.

## Files Updated by Sync Script

| File | Updated Variables | Purpose |
|------|-------------------|---------|
| `admin/.env` | `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_ADMIN_API_URL` | Admin panel authentication & API |
| `app/.env.local` | `VITE_LAMBDA_CONFIG_URL` | Main app config Lambda URL |

## Common Issues

### Problem: "User pool client does not exist"

**Cause**: Frontend .env not updated after CDK deployment

**Solution**:
```bash
cd infra
npm run sync-outputs

# Then rebuild and redeploy admin
npm run build --workspace admin
npm run s3-deploy --workspace admin
npm run cf-invalidate --workspace admin
```

### Problem: "CORS error on fetch"

**Cause**: API URL in .env is outdated

**Solution**:
```bash
cd infra
npm run sync-outputs
# Check that VITE_ADMIN_API_URL in admin/.env matches CloudFormation AdminApiUrl output
```

### Problem: Sync script fails

**Prerequisites**:
- AWS credentials: `aws configure --profile dev`
- CloudFormation stacks exist: `Yorutsuke2Stack-dev`, `Yorutsuke2AdminStack-dev`
- `jq` installed: `brew install jq` (macOS) or `apt install jq` (Linux)

**Manual fallback**:
```bash
# Get stack outputs
AWS_PROFILE=dev aws cloudformation describe-stacks \
  --stack-name Yorutsuke2AdminStack-dev \
  --region us-east-1 \
  --query 'Stacks[0].Outputs'

# Manually update admin/.env with values
```

## Automation Details

### Script Location
`scripts/sync-cdk-outputs.sh`

### How It's Integrated
```json
{
  "scripts": {
    "deploy": "cdk deploy --profile dev && npm run sync-outputs",
    "sync-outputs": "bash ../scripts/sync-cdk-outputs.sh dev dev"
  }
}
```

After `npm run deploy` in infra/, sync runs automatically.

### Environment Support
Script supports any environment via parameters:
```bash
bash scripts/sync-cdk-outputs.sh dev dev      # Sync dev environment
bash scripts/sync-cdk-outputs.sh prod prod    # Sync prod environment
```

## Checklist for Deployment

- [ ] Code changes committed
- [ ] `cd infra && npm run deploy` (with sync auto-run)
- [ ] Verify terminal shows `🎉 CDK outputs synced successfully!`
- [ ] `npm run build --workspace admin`
- [ ] `npm run s3-deploy --workspace admin`
- [ ] `npm run cf-invalidate --workspace admin`
- [ ] Hard refresh admin panel: `Cmd+Shift+R`
- [ ] Verify no Cognito errors

## Related Rules

See `.claude/rules/cdk-deploy.md` for AI development guidelines.

---

**Last Updated**: 2026-01-17
**Version**: 1.0
