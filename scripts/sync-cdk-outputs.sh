#!/bin/bash

# Sync CDK outputs to environment variables
# Run after every: npm run deploy

set -e

ENV="${1:-dev}"
PROFILE="${2:-dev}"
REGION="us-east-1"

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

# Update admin/.env
echo ""
echo "📝 Updating admin/.env..."
cat > admin/.env << EOF
# Admin API URL (from CDK deploy output: AdminApiUrl)
VITE_ADMIN_API_URL=$ADMIN_API_URL

# AWS Region
VITE_AWS_REGION=$REGION

# Cognito Configuration (from CDK deploy output)
VITE_COGNITO_USER_POOL_ID=$ADMIN_USER_POOL_ID
VITE_COGNITO_CLIENT_ID=$ADMIN_CLIENT_ID
EOF

echo "✅ admin/.env updated"

# Update app/.env.local with all Lambda URLs
echo ""
echo "📝 Updating app/.env.local..."
cat > app/.env.local << EOF
# Lambda Function URLs (from CDK deploy)
VITE_LAMBDA_CONFIG_URL=$MAIN_CONFIG_LAMBDA
VITE_LAMBDA_PRESIGN_URL=$MAIN_PRESIGN_LAMBDA
VITE_LAMBDA_QUOTA_URL=$MAIN_QUOTA_LAMBDA
VITE_LAMBDA_SYNC_URL=$MAIN_TRANSACTIONS_LAMBDA
VITE_LAMBDA_ISSUE_PERMIT_URL=$MAIN_ISSUE_PERMIT_LAMBDA
VITE_LAMBDA_ADMIN_DELETE_URL=$MAIN_ADMIN_DELETE_LAMBDA
EOF

echo "✅ app/.env.local updated"

echo ""
echo "🎉 CDK outputs synced successfully!"
echo ""
echo "📋 Summary:"
echo "   Environment: $ENV"
echo "   Profile: $PROFILE"
echo "   Region: $REGION"
echo ""
echo "Next steps:"
echo "   1. Rebuild admin:  npm run build --workspace admin"
echo "   2. Deploy admin:   npm run s3-deploy --workspace admin"
echo "   3. Invalidate CF:  npm run cf-invalidate --workspace admin"
