# CDK Deploy Workflow

> Automated sync of CDK outputs to environment variables

## Quick Command

```bash
cd infra && npm run deploy
```

This will:
1. ✅ Deploy CDK stacks to AWS
2. ✅ Automatically sync outputs to `.env` files
3. ✅ Print summary of updated values

## What Gets Synced

After CDK deployment completes, this script automatically extracts:

| Output | File | Variable | Usage |
|--------|------|----------|-------|
| AdminUserPoolId | `admin/.env` | `VITE_COGNITO_USER_POOL_ID` | Cognito auth |
| AdminUserPoolClientId | `admin/.env` | `VITE_COGNITO_CLIENT_ID` | Cognito client |
| AdminApiUrl | `admin/.env` | `VITE_ADMIN_API_URL` | API endpoint |
| ConfigLambdaUrl | `app/.env.local` | `VITE_LAMBDA_CONFIG_URL` | Lambda config |

## Manual Sync

If you need to sync outputs without re-deploying:

```bash
cd infra && npm run sync-outputs
```

## If Sync Fails

The sync script requires:
1. AWS credentials configured (`aws configure --profile dev`)
2. CloudFormation stacks exist (`Yorutsuke2Stack-dev` and `Yorutsuke2AdminStack-dev`)
3. `jq` installed for JSON parsing

If it fails:
```bash
# Manual approach
AWS_PROFILE=dev aws cloudformation describe-stacks --stack-name Yorutsuke2AdminStack-dev --region us-east-1 --query 'Stacks[0].Outputs'
```

Then manually update:
- `admin/.env` with Cognito values
- `app/.env.local` with Lambda URL

## After Deployment Checklist

- [ ] Sync script ran successfully
- [ ] Check terminal output for updated values
- [ ] Rebuild admin panel: `npm run build --workspace admin`
- [ ] Redeploy admin to S3: `npm run s3-deploy --workspace admin`
- [ ] Clear CloudFront: `npm run cf-invalidate --workspace admin`

## Related Files

- **Script**: `scripts/sync-cdk-outputs.sh`
- **Config**: `admin/.env`, `app/.env.local`
- **CDK**: `infra/package.json` (deploy script)

## AI Reminder

**Important for Claude**:

Every time you run CDK deployment or update infrastructure:

1. After `npm run deploy` finishes, the sync script runs automatically
2. Check terminal for `🎉 CDK outputs synced successfully!` message
3. If deploying with `--require-approval never`, the sync runs silently
4. Always check that `.env` files were updated before rebuilding frontend

**Workflow**:
```bash
# 1. Deploy infrastructure (with auto-sync)
npm run deploy

# 2. Rebuild frontend with new values
npm run build --workspace admin

# 3. Deploy frontend
npm run s3-deploy --workspace admin
npm run cf-invalidate --workspace admin
```

If you see Cognito errors or "User pool client does not exist", it means:
- CDK deploy succeeded but sync didn't run
- Run: `npm run sync-outputs` manually
- Then rebuild + redeploy frontend
