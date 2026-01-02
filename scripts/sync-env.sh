#!/bin/bash
# Sync CDK outputs to .env.local
# Usage: ./scripts/sync-env.sh [env]
# Example: ./scripts/sync-env.sh dev

set -e

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ENV=${1:-dev}
STACK_NAME="YorutsukeStack-${ENV}"
OUTPUT_FILE="${PROJECT_ROOT}/app/.env.local"
REGION="ap-northeast-1"

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
VITE_AWS_REGION=ap-northeast-1

# Cognito
VITE_USER_POOL_ID=$(get_output "UserPoolId")
VITE_USER_POOL_CLIENT_ID=$(get_output "UserPoolClientId")

# Lambda URLs (API Gateway endpoints)
VITE_LAMBDA_PRESIGN_URL=$(get_output "PresignApiUrl")
VITE_LAMBDA_CONFIG_URL=$(get_output "ConfigApiUrl")
VITE_LAMBDA_TRANSACTIONS_URL=$(get_output "TransactionsApiUrl")

# Auth URLs
VITE_AUTH_LOGIN_URL=$(get_output "AuthLoginUrl")
VITE_AUTH_REGISTER_URL=$(get_output "AuthRegisterUrl")
VITE_AUTH_VERIFY_URL=$(get_output "AuthVerifyUrl")
VITE_AUTH_REFRESH_URL=$(get_output "AuthRefreshUrl")
EOF

echo "Created ${OUTPUT_FILE}"
echo ""
cat "$OUTPUT_FILE"
