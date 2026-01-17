# Utility Scripts

## sync-cdk-outputs.sh

**Purpose**: Sync CDK stack outputs to environment variables after deployment

**Usage**:
```bash
# Automatic (runs after npm run deploy)
cd infra && npm run deploy

# Manual
cd infra && npm run sync-outputs

# Or directly
bash scripts/sync-cdk-outputs.sh dev dev
```

**What it updates**:
- `admin/.env` - Cognito User Pool ID, Client ID, API URL
- `app/.env.local` - Config Lambda URL

**When to use**:
- After every CDK deployment
- If you see "User pool client does not exist" errors
- If frontend APIs return 403/404 (outdated URLs)

**Example output**:
```
✅ Extracted values:
   AdminUserPoolId: us-east-1_o54Ki3ABd
   AdminUserPoolClientId: 5otc7ulrshm23acll34ju7598s
   AdminApiUrl: https://q5exxtu422.execute-api.us-east-1.amazonaws.com/prod/
   ConfigLambdaUrl: https://ar3464shhk2nidnsgabqrza6cm0knbhn.lambda-url.us-east-1.on.aws/

🎉 CDK outputs synced successfully!
```

## Deployment Checklist

After running scripts:

```bash
# 1. Deploy infrastructure (with auto-sync)
cd infra && npm run deploy

# 2. Rebuild frontend with new env values
npm run build --workspace admin

# 3. Deploy frontend to S3 + CloudFront
npm run s3-deploy --workspace admin
npm run cf-invalidate --workspace admin

# 4. Test
# - Hard refresh admin panel: Cmd+Shift+R
# - Should not see Cognito errors
```

## Quick Reference

| Task | Command |
|------|---------|
| Deploy infra + auto-sync | `cd infra && npm run deploy` |
| Manual sync only | `cd infra && npm run sync-outputs` |
| Full deployment cycle | See "Deployment Checklist" above |
| Check what will be synced | `AWS_PROFILE=dev aws cloudformation describe-stacks --stack-name Yorutsuke2AdminStack-dev --region us-east-1 --query 'Stacks[0].Outputs'` |

---

**See also**: `docs/operations/CDK_DEPLOYMENT.md` and `.claude/rules/cdk-deploy.md`
