#!/bin/bash
# Sync CDK outputs to .env files (app/.env.local and admin/.env)
# Usage: ./scripts/sync-env.sh [env]
# Example: ./scripts/sync-env.sh dev

set -e

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ENV=${1:-dev}
STACK_NAME="Yorutsuke2Stack-${ENV}"
ADMIN_STACK_NAME="Yorutsuke2AdminStack-${ENV}"
APP_ENV_FILE="${PROJECT_ROOT}/app/.env.local"
ADMIN_ENV_FILE="${PROJECT_ROOT}/admin/.env"
REGION="us-east-1"

echo "Fetching outputs from ${STACK_NAME} and ${ADMIN_STACK_NAME}..."

# Check if stacks exist
if ! aws cloudformation describe-stacks --stack-name "$STACK_NAME" --profile dev --region "$REGION" &> /dev/null; then
  echo "Error: Stack ${STACK_NAME} not found"
  echo "Deploy first: cd infra && npm run deploy"
  exit 1
fi

if ! aws cloudformation describe-stacks --stack-name "$ADMIN_STACK_NAME" --profile dev --region "$REGION" &> /dev/null; then
  echo "Error: Stack ${ADMIN_STACK_NAME} not found"
  echo "Deploy first: cd infra && npm run deploy"
  exit 1
fi

# Fetch outputs from both stacks
OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --profile dev \
  --region "$REGION" \
  --query 'Stacks[0].Outputs' \
  --output json)

ADMIN_OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name "$ADMIN_STACK_NAME" \
  --profile dev \
  --region "$REGION" \
  --query 'Stacks[0].Outputs' \
  --output json)

# Extract values
get_output() {
  echo "$OUTPUTS" | jq -r ".[] | select(.OutputKey==\"$1\") | .OutputValue"
}

get_admin_output() {
  echo "$ADMIN_OUTPUTS" | jq -r ".[] | select(.OutputKey==\"$1\") | .OutputValue"
}

# Generate app/.env.local
cat > "$APP_ENV_FILE" << EOF
# Auto-generated from CDK stack: ${STACK_NAME}
# Generated at: $(date -Iseconds)
# Do not edit manually - run ./scripts/sync-env.sh to refresh

# AWS Region
VITE_AWS_REGION=us-east-1

# Cognito
VITE_USER_POOL_ID=$(get_output "UserPoolId")
VITE_USER_POOL_CLIENT_ID=$(get_output "UserPoolClientId")

# Lambda URLs
VITE_LAMBDA_PRESIGN_URL=$(get_output "PresignLambdaUrl")
VITE_LAMBDA_SYNC_URL=$(get_output "TransactionsLambdaUrl")
VITE_LAMBDA_CONFIG_URL=$(get_output "ConfigLambdaUrl")
VITE_LAMBDA_TRANSACTIONS_URL=$(get_output "TransactionsLambdaUrl")
VITE_LAMBDA_REPORT_URL=$(get_output "ReportLambdaUrl")
VITE_LAMBDA_QUOTA_URL=$(get_output "QuotaLambdaUrl")
VITE_LAMBDA_ISSUE_PERMIT_URL=$(get_output "IssuePermitLambdaUrl")
VITE_LAMBDA_ADMIN_DELETE_URL=$(get_output "AdminDeleteDataUrl")
VITE_DIAGNOSTIC_LAMBDA_URL=$(get_output "DiagnosticLambdaUrl")

# Debug Panel
VITE_DEBUG_PANEL=true
EOF

# Generate admin/.env
cat > "$ADMIN_ENV_FILE" << EOF
# Auto-generated from CDK stack: ${ADMIN_STACK_NAME}
# Generated at: $(date -Iseconds)
# Do not edit manually - run ./scripts/sync-env.sh to refresh

# AWS Region
VITE_AWS_REGION=us-east-1

# Admin API URL (from CDK deploy output)
VITE_ADMIN_API_URL=$(get_admin_output "AdminApiUrl")

# Cognito Configuration (from CDK deploy output)
VITE_COGNITO_USER_POOL_ID=$(get_admin_output "AdminUserPoolId")
VITE_COGNITO_CLIENT_ID=$(get_admin_output "AdminUserPoolClientId")
EOF

echo "✅ Created ${APP_ENV_FILE}"
echo "✅ Created ${ADMIN_ENV_FILE}"
echo ""
echo "📋 app/.env.local:"
cat "$APP_ENV_FILE"
echo ""
echo "📋 admin/.env:"
cat "$ADMIN_ENV_FILE"
