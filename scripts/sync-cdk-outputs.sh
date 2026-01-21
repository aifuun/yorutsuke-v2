#!/bin/bash

# Sync CDK outputs to environment variables
# Run after every: npm run deploy

set -e

ENV="${1:-dev}"
PROFILE="${2:-dev}"
REGION="us-east-1"

# Get the directory where this script is located (project root)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"

echo "🔄 Syncing CDK outputs for environment: $ENV"

# Get CDK outputs as JSON
echo "📊 Fetching CDK stack outputs..."
MAIN_OUTPUTS=$(AWS_PROFILE=$PROFILE aws cloudformation describe-stacks \
  --stack-name "Yorutsuke2Stack-$ENV" \
  --region $REGION \
  --query 'Stacks[0].Outputs' \
  --output json)

ADMIN_OUTPUTS=$(AWS_PROFILE=$PROFILE aws cloudformation describe-stacks \
  --stack-name "Yorutsuke2AdminStack-$ENV" \
  --region $REGION \
  --query 'Stacks[0].Outputs' \
  --output json)

# Extract values using jq
ADMIN_USER_POOL_ID=$(echo "$ADMIN_OUTPUTS" | jq -r '.[] | select(.OutputKey=="AdminUserPoolId") | .OutputValue')
ADMIN_CLIENT_ID=$(echo "$ADMIN_OUTPUTS" | jq -r '.[] | select(.OutputKey=="AdminUserPoolClientId") | .OutputValue')
ADMIN_API_URL=$(echo "$ADMIN_OUTPUTS" | jq -r '.[] | select(.OutputKey=="AdminApiUrl") | .OutputValue')

# Main stack Lambda URLs
MAIN_CONFIG_LAMBDA=$(echo "$MAIN_OUTPUTS" | jq -r '.[] | select(.OutputKey=="ConfigLambdaUrl") | .OutputValue')
MAIN_PRESIGN_LAMBDA=$(echo "$MAIN_OUTPUTS" | jq -r '.[] | select(.OutputKey=="PresignLambdaUrl") | .OutputValue')
MAIN_QUOTA_LAMBDA=$(echo "$MAIN_OUTPUTS" | jq -r '.[] | select(.OutputKey=="QuotaLambdaUrl") | .OutputValue')
MAIN_TRANSACTIONS_LAMBDA=$(echo "$MAIN_OUTPUTS" | jq -r '.[] | select(.OutputKey=="TransactionsLambdaUrl") | .OutputValue')
MAIN_ISSUE_PERMIT_LAMBDA=$(echo "$MAIN_OUTPUTS" | jq -r '.[] | select(.OutputKey=="IssuePermitLambdaUrl") | .OutputValue')
MAIN_ADMIN_DELETE_LAMBDA=$(echo "$MAIN_OUTPUTS" | jq -r '.[] | select(.OutputKey=="AdminDeleteDataUrl") | .OutputValue')
MAIN_DIAGNOSTIC_LAMBDA=$(echo "$MAIN_OUTPUTS" | jq -r '.[] | select(.OutputKey=="DiagnosticLambdaUrl") | .OutputValue')

echo ""
echo "✅ Extracted values:"
echo "   AdminUserPoolId: $ADMIN_USER_POOL_ID"
echo "   AdminUserPoolClientId: $ADMIN_CLIENT_ID"
echo "   AdminApiUrl: $ADMIN_API_URL"
echo "   ConfigLambdaUrl: $MAIN_CONFIG_LAMBDA"
echo "   PresignLambdaUrl: $MAIN_PRESIGN_LAMBDA"
echo "   QuotaLambdaUrl: $MAIN_QUOTA_LAMBDA"
echo "   TransactionsLambdaUrl: $MAIN_TRANSACTIONS_LAMBDA"
echo "   IssuePermitLambdaUrl: $MAIN_ISSUE_PERMIT_LAMBDA"
echo "   AdminDeleteDataUrl: $MAIN_ADMIN_DELETE_LAMBDA"
echo "   DiagnosticLambdaUrl: $MAIN_DIAGNOSTIC_LAMBDA"

# Update admin/.env (with absolute path)
echo ""
echo "📝 Updating admin/.env..."
ADMIN_ENV_PATH="$PROJECT_ROOT/admin/.env"
cat > "$ADMIN_ENV_PATH" << EOF
# Auto-generated from CDK stack: Yorutsuke2AdminStack-$ENV
# Generated at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Do not edit manually - run npm run sync-outputs to refresh

# Admin API URL (from CDK deploy output: AdminApiUrl)
VITE_ADMIN_API_URL=$ADMIN_API_URL

# AWS Region
VITE_AWS_REGION=$REGION

# Cognito Configuration (from CDK deploy output)
VITE_COGNITO_USER_POOL_ID=$ADMIN_USER_POOL_ID
VITE_COGNITO_CLIENT_ID=$ADMIN_CLIENT_ID
EOF

echo "✅ admin/.env updated at: $ADMIN_ENV_PATH"

# Update app/.env.local with all Lambda URLs (with absolute path)
echo ""
echo "📝 Updating app/.env.local..."
APP_ENV_PATH="$PROJECT_ROOT/app/.env.local"
cat > "$APP_ENV_PATH" << EOF
# Auto-generated from CDK stack: Yorutsuke2Stack-$ENV
# Generated at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Do not edit manually - run npm run sync-outputs to refresh

# AWS Region
VITE_AWS_REGION=$REGION

# Cognito
VITE_USER_POOL_ID=us-east-1_cvc8ARpZN
VITE_USER_POOL_CLIENT_ID=1old25ib9bifi0os6rg8jp9h88

# Lambda URLs - Config & Presign
VITE_LAMBDA_CONFIG_URL=$MAIN_CONFIG_LAMBDA
VITE_LAMBDA_PRESIGN_URL=$MAIN_PRESIGN_LAMBDA

# Lambda URLs - Quota & Permit (Issue #154)
VITE_LAMBDA_QUOTA_URL=$MAIN_QUOTA_LAMBDA
VITE_LAMBDA_ISSUE_PERMIT_URL=$MAIN_ISSUE_PERMIT_LAMBDA

# Lambda URLs - Transactions & Cleanup
VITE_LAMBDA_SYNC_URL=$MAIN_TRANSACTIONS_LAMBDA
VITE_LAMBDA_ADMIN_DELETE_URL=$MAIN_ADMIN_DELETE_LAMBDA

# Lambda URLs - Diagnostics
VITE_DIAGNOSTIC_LAMBDA_URL=$MAIN_DIAGNOSTIC_LAMBDA

# Debug Panel
VITE_DEBUG_PANEL=true
EOF

echo "✅ app/.env.local updated at: $APP_ENV_PATH"

echo ""
echo "🎉 CDK outputs synced successfully!"
echo ""
echo "📋 Summary:"
echo "   Environment: $ENV"
echo "   Profile: $PROFILE"
echo "   Region: $REGION"
echo "   Admin .env: $ADMIN_ENV_PATH"
echo "   App .env.local: $APP_ENV_PATH"
echo ""
echo "✅ Extracted Lambda URLs:"
echo "   Permit (Issue #154): $MAIN_ISSUE_PERMIT_LAMBDA"
echo "   Quota (Issue #154): $MAIN_QUOTA_LAMBDA"
echo "   Presign: $MAIN_PRESIGN_LAMBDA"
echo "   Transactions: $MAIN_TRANSACTIONS_LAMBDA"
echo ""
echo "Next steps:"
echo "   1. Verify .env files: cat $APP_ENV_PATH | grep -E 'QUOTA|PERMIT'"
echo "   2. Restart Tauri: npm run tauri dev (from app/)"
echo "   3. Rebuild admin:  npm run build --workspace admin"
echo "   4. Deploy admin:   npm run s3-deploy --workspace admin"
echo "   5. Invalidate CF:  npm run cf-invalidate --workspace admin"
