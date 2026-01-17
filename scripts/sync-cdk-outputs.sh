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
MAIN_CONFIG_LAMBDA=$(echo "$MAIN_OUTPUTS" | jq -r '.[] | select(.OutputKey=="ConfigLambdaUrl") | .OutputValue')

echo ""
echo "✅ Extracted values:"
echo "   AdminUserPoolId: $ADMIN_USER_POOL_ID"
echo "   AdminUserPoolClientId: $ADMIN_CLIENT_ID"
echo "   AdminApiUrl: $ADMIN_API_URL"
echo "   ConfigLambdaUrl: $MAIN_CONFIG_LAMBDA"

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

# Update app/.env if needed (for config lambda)
if [ -f "app/.env.local" ]; then
  echo ""
  echo "📝 Updating app/.env.local..."
  # Replace or add VITE_LAMBDA_CONFIG_URL
  if grep -q "VITE_LAMBDA_CONFIG_URL" app/.env.local; then
    sed -i '' "s|VITE_LAMBDA_CONFIG_URL=.*|VITE_LAMBDA_CONFIG_URL=$MAIN_CONFIG_LAMBDA|" app/.env.local
  else
    echo "VITE_LAMBDA_CONFIG_URL=$MAIN_CONFIG_LAMBDA" >> app/.env.local
  fi
  echo "✅ app/.env.local updated"
fi

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
