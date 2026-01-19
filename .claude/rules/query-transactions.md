# DynamoDB Transactions Query Guide

> Quick reference for querying the latest transactions from DynamoDB

## Quick Start

```bash
# Navigate to infra directory
cd infra

# Get latest 10 transactions from dev
npm run txn:latest

# Get latest 10 transactions from production
npm run txn:latest:prod

# Get custom number of transactions
npm run txn:query dev 20

# Get transactions with full JSON data
node ../scripts/query-latest-transactions.mjs dev 10 dev --json
```

## Available Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `npm run txn:latest` | Get 10 latest from dev | `cd infra && npm run txn:latest` |
| `npm run txn:latest:prod` | Get 10 latest from prod | `cd infra && npm run txn:latest:prod` |
| `npm run txn:query` | Custom env + count | `cd infra && npm run txn:query dev 20` |
| Direct script | Full control | `node ../scripts/query-latest-transactions.mjs dev 10 dev --json` |

## Parameters

```
query-latest-transactions.mjs [env] [limit] [profile] [--json]

env       - Environment: 'dev' or 'prod'          (default: 'dev')
limit     - Number of transactions to fetch      (default: 10)
profile   - AWS CLI profile                       (default: 'dev')
--json    - Output raw JSON data                 (optional flag)
```

## Output Fields

Each transaction displays:
- **Transaction ID**: Unique identifier
- **User ID**: Owner of the transaction
- **Amount**: Total amount in JPY (¥)
- **Category**: Type of transaction
- **Date**: Transaction date (YYYY-MM-DD)
- **Created**: ISO timestamp when created
- **Status**: Current status (confirmed, pending, etc.)
- **Models**: AI model comparison results with confidence scores

## Example Output

```
📊 Fetching latest 10 transactions from: yorutsuke-transactions-us-dev

✅ Found 10 recent transactions:

────────────────────────────────────────────────────────────────────────────────

[1] Transaction ID: txn-abc123
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

[2] Transaction ID: txn-xyz456
    ...
```

## Prerequisites

```bash
# 1. Configure AWS credentials
aws configure --profile dev

# 2. Verify credentials work
aws sts get-caller-identity --profile dev

# 3. Install dependencies (one-time)
cd infra && npm install

# 4. Run the query
npm run txn:latest
```

## Troubleshooting

### "Cannot find module" error
```bash
# Reinstall AWS SDK packages
cd infra && npm install @aws-sdk/client-dynamodb @aws-sdk/util-dynamodb --save
```

### "AccessDenied" or "User is not authorized" error
```bash
# Check AWS credentials
aws sts get-caller-identity --profile dev

# Verify DynamoDB permissions
aws dynamodb describe-table \
  --table-name yorutsuke-transactions-us-dev \
  --profile dev

# If table doesn't exist, it means that environment isn't deployed yet
```

### "The DynamoDB module has not been provided" error
```bash
# Table doesn't exist for that environment
# Deploy infrastructure first
npm run deploy
```

## Common Use Cases

### 1. Check latest transactions after deployment
```bash
cd infra
npm run deploy
npm run txn:latest
```

### 2. Debug specific user's transactions
```bash
# Get 20 transactions, then filter locally
npm run txn:query dev 20 dev --json | jq '.[] | select(.userId == "user-xxx")'
```

### 3. Verify model comparison is working
```bash
# Get transactions with JSON output
npm run txn:query dev 5 dev --json | jq '.[] | .modelComparison'
```

### 4. Monitor production transactions
```bash
# Get latest 20 from production
npm run txn:query prod 20
```

## File Locations

- **Script**: `scripts/query-latest-transactions.mjs`
- **NPM scripts**: `infra/package.json` (lines 14-16)
- **Documentation**: `scripts/README.md`

## Performance Notes

- Query uses DynamoDB Scan (not Query)
- Fetches ~2x limit to ensure enough valid items
- Sorts locally by creation date
- Network latency: ~1-2 seconds

## Related Files

- Script: `scripts/query-latest-transactions.mjs`
- Config: `infra/lib/yorutsuke-stack.ts` (DynamoDB table definition)
- Documentation: `scripts/README.md` (detailed guide)
- Deployment: `.claude/rules/cdk-deploy.md`
