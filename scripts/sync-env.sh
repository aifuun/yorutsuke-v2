#!/bin/bash
# Sync CDK outputs to .env.local
# Usage: ./scripts/sync-env.sh [env]
# Example: ./scripts/sync-env.sh dev

set -e

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ENV=${1:-dev}
STACK_NAME="Yorutsuke2Stack-${ENV}"
OUTPUT_FILE="${PROJECT_ROOT}/app/.env.local"
REGION="us-east-1"

echo "Fetching outputs from ${STACK_NAME}..."

# Check if stack exists
if ! aws cloudformation describe-stacks --stack-name "$STACK_NAME" --profile dev --region "$REGION" &> /dev/null; then
  echo "Error: Stack ${STACK_NAME} not found"
  echo "Deploy first: cd infra && npm run deploy"
  exit 1
fi

# Fetch outputs
OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --profile dev \
  --region "$REGION" \
  --query 'Stacks[0].Outputs' \
  --output json)

# Extract values
get_output() {
  echo "$OUTPUTS" | jq -r ".[] | select(.OutputKey==\"$1\") | .OutputValue"
}

# Generate .env.local
cat > "$OUTPUT_FILE" << EOF
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
VITE_LAMBDA_ADMIN_DELETE_URL=$(get_output "AdminDeleteDataUrl")

# Debug Panel
VITE_DEBUG_PANEL=true
EOF

echo "Created ${OUTPUT_FILE}"
echo ""
cat "$OUTPUT_FILE"
