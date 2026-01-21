# Command: *deploy

## Purpose
Deploy infrastructure to AWS and sync environment variables

## Usage
```bash
*deploy              # Deploy both stacks (App + Admin) to dev
*deploy --stack app  # Deploy only App stack
*deploy --stack admin # Deploy only Admin stack
*deploy --env prod   # Deploy to production
```

## Workflow

### Step 1: Build TypeScript
```bash
cd infra
npm run build:all    # Build CDK + Lambda TypeScript
```

### Step 2: Deploy to AWS
```bash
# Deploy both stacks
npx cdk deploy --all --profile dev --require-approval never

# Or deploy specific stack
npx cdk deploy "Yorutsuke2Stack-dev" --profile dev --require-approval never
npx cdk deploy "Yorutsuke2AdminStack-dev" --profile dev --require-approval never
```

**Deployment time**: ~3-5 minutes per stack

### Step 3: Sync Environment Variables
```bash
cd /Users/woo/dev/yorutsuke-v2-2
npm run env:sync
```

This extracts CDK outputs and updates:
- `admin/.env` (Cognito User Pool ID, Client ID, API URL)
- `app/.env.local` (Lambda Config URL)

### Step 4: Verify Deployment
```bash
# Check Lambda Layer version
aws lambda list-layer-versions \
  --layer-name yorutsuke-shared-dev \
  --profile dev | jq '.LayerVersions[0]'

# Check Lambda function configuration
aws lambda get-function-configuration \
  --function-name yorutsuke-instant-processor-us-dev \
  --profile dev | jq '.Layers[0].Arn'
```

## Output Format

```markdown
## Deployment Status

### Build
✅ CDK TypeScript compiled
✅ Lambda TypeScript compiled (15 functions)

### Deploy (App Stack)
✅ Lambda Layer published (version 60)
✅ S3 buckets updated
✅ Lambda functions deployed (10 functions)
✅ DynamoDB tables configured

### Deploy (Admin Stack)
✅ Cognito User Pool configured
✅ API Gateway updated
✅ Lambda functions deployed (6 functions)
✅ CloudFront distribution updated

### Environment Sync
✅ admin/.env updated (3 variables)
✅ app/.env.local updated (1 variable)

**Deployment complete** → Total time: 8m 30s
```

## Error Handling

### Build Fails
```bash
# TypeScript compilation error
npm run build:all
# Fix TypeScript errors, then retry
```

### Deploy Fails (Stack rollback)
```bash
# Check CloudFormation events
aws cloudformation describe-stack-events \
  --stack-name Yorutsuke2Stack-dev \
  --profile dev | jq '.StackEvents[0:5]'

# Common issues:
# 1. Lambda timeout → Increase timeout in CDK
# 2. IAM permissions → Check role policies
# 3. Resource limits → Check AWS quotas
```

### Sync Fails
```bash
# Manually check CDK outputs
aws cloudformation describe-stacks \
  --stack-name Yorutsuke2AdminStack-dev \
  --profile dev | jq '.Stacks[0].Outputs'

# Manually update .env files if needed
```

## Stack Details

### App Stack (Yorutsuke2Stack-dev)
- **Lambda Functions**: 10 (presign, quota, issue-permit, config, transactions, report, instant-processor, admin-delete-data, admin-purge-all-data, diagnostic)
- **Lambda Layer**: yorutsuke-shared-dev
- **S3 Buckets**: images, diagnostics
- **DynamoDB**: transactions table
- **CloudWatch**: log groups

### Admin Stack (Yorutsuke2AdminStack-dev)
- **Lambda Functions**: 6 (admin/stats, admin/control, admin/costs, admin/model-config, admin/azure-credentials)
- **Lambda Layer**: yorutsuke-shared-dev (shared)
- **Cognito**: User Pool + Client
- **API Gateway**: HTTP API
- **CloudFront**: Admin panel distribution

## Post-Deployment Checklist

- [ ] Verify Lambda functions exist in AWS Console
- [ ] Check Lambda Layer version is latest
- [ ] Test one Lambda function (e.g., config)
- [ ] Verify environment variables synced correctly
- [ ] Check CloudWatch logs for errors
- [ ] Test admin panel loads (if Admin stack deployed)

## Quick Commands

```bash
# Full deployment (most common)
*deploy

# Deploy only App stack (faster, for Lambda changes)
*deploy --stack app

# Deploy to production (requires confirmation)
*deploy --env prod

# Rollback if needed
cd infra
npx cdk destroy --all --profile dev
```

## Related
- **CDK Deploy Rules**: `.claude/rules/cdk-deploy.md`
- **Lambda Layer**: `.claude/rules/lambda-layer-deployment.md`
- **Secrets Management**: `.claude/rules/secrets.md`
- **Environment Sync**: `scripts/sync-env.sh`

## Notes

- Always run from repository root or infra directory
- Deployment requires AWS credentials configured (`aws configure --profile dev`)
- Lambda Layer version increments automatically on changes
- Environment sync runs automatically after successful deployment
- Use `--require-approval never` for automated deployments
- Check CloudWatch logs if Lambda functions fail after deployment
