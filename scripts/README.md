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

## query-latest-transactions.mjs

**Purpose**: Query and display the latest transactions from DynamoDB

**Usage**:
```bash
# From infra directory - default (dev, 10 items)
cd infra && npm run txn:latest

# From infra directory - specific count
cd infra && npm run txn:query dev 20

# From infra directory - production
cd infra && npm run txn:latest:prod

# Direct usage with custom parameters
node scripts/query-latest-transactions.mjs [env] [limit] [profile]

# With JSON output
node scripts/query-latest-transactions.mjs dev 10 dev --json
```

**Examples**:
```bash
# Get 10 latest transactions from dev environment
cd infra && npm run txn:latest

# Get 20 latest transactions from prod
cd infra && npm run txn:query prod 20

# Get transactions with full JSON output
node ../scripts/query-latest-transactions.mjs dev 15 dev --json
```

**Example output**:
```
📊 Fetching latest 10 transactions from: yorutsuke-transactions-us-dev

✅ Found 10 recent transactions:

────────────────────────────────────────────────────────────────────────────────────────────────

[1] Transaction ID: txn-abc123def456
    User ID: user-xyz789
    Amount: ¥12,345
    Category: Office Supplies
    Date: 2026-01-19
    Created: 2026-01-19T10:30:45.000Z
    Status: confirmed
    Models:
      - textract: ¥12,345 (confidence: 95%)
      - nova_mini: ¥12,300 (confidence: 92%)
      - azure_di: ¥12,400 (confidence: 98%)

[2] Transaction ID: txn-xyz456abc789
    ...
```

**What it does**:
1. Connects to DynamoDB in specified environment (dev/prod)
2. Scans the transactions table
3. Sorts by creation date (newest first)
4. Displays latest N transactions with:
   - Transaction ID, User ID, Amount
   - Date, Category, Status
   - Model comparison results (if available)
5. Optionally outputs raw JSON with `--json` flag

**Prerequisites**:
- AWS credentials configured: `aws configure --profile dev`
- Permission to read DynamoDB tables
- AWS SDK packages installed: `npm install` in infra directory

**Troubleshooting**:
```bash
# Check AWS credentials
aws sts get-caller-identity --profile dev

# Verify table exists
aws dynamodb describe-table \
  --table-name yorutsuke-transactions-us-dev \
  --profile dev

# Check IAM permissions
aws dynamodb describe-limits --profile dev
```

---

**See also**: `docs/operations/CDK_DEPLOYMENT.md` and `.claude/rules/cdk-deploy.md`
