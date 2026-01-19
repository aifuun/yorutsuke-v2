#!/bin/bash

# Deploy Admin Panel to S3 + CloudFront
# Usage: ./scripts/deploy-admin.sh [env]

set -e

ENV="${1:-dev}"
PROFILE="${ENV}"
REGION="us-east-1"

echo "🚀 Deploying Admin Panel for environment: $ENV"

# Step 1: Build admin panel
echo ""
echo "📦 Building admin panel..."
cd admin
npm run build

# Step 2: Get S3 bucket name from CDK outputs
echo ""
echo "📊 Fetching CDK stack outputs..."
cd ../infra
ADMIN_BUCKET=$(AWS_PROFILE=$PROFILE aws cloudformation describe-stacks \
  --stack-name "Yorutsuke2AdminStack-$ENV" \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`AdminBucketName`].OutputValue' \
  --output text)

echo "   S3 Bucket: $ADMIN_BUCKET"

# Step 3: Upload to S3
echo ""
echo "📤 Uploading files to S3..."
cd ../admin
AWS_PROFILE=$PROFILE aws s3 sync dist/ s3://$ADMIN_BUCKET/ --delete --region $REGION

echo "✅ Files uploaded to S3"

# Step 4: Get CloudFront distribution ID
echo ""
echo "🔍 Finding CloudFront distribution..."
DISTRIBUTION_ID=$(AWS_PROFILE=$PROFILE aws cloudfront list-distributions \
  --query "DistributionList.Items[?Origins.Items[0].DomainName=='$ADMIN_BUCKET.s3.us-east-1.amazonaws.com'].Id" \
  --output text)

echo "   Distribution ID: $DISTRIBUTION_ID"

# Step 5: Invalidate CloudFront cache
echo ""
echo "🔄 Invalidating CloudFront cache..."
INVALIDATION=$(AWS_PROFILE=$PROFILE aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*" \
  --region $REGION \
  --query 'Invalidation.Id' \
  --output text)

echo "   Invalidation ID: $INVALIDATION"

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📋 Summary:"
echo "   Environment: $ENV"
echo "   S3 Bucket: $ADMIN_BUCKET"
echo "   CloudFront Distribution: $DISTRIBUTION_ID"
echo "   Invalidation: $INVALIDATION (will complete in 2-5 minutes)"
echo ""
echo "🌐 Your admin panel will be updated shortly at:"
echo "   https://admin.yoru.rolligen.com/"
