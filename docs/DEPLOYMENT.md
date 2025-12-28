# DEPLOYMENT.md

> Deployment guide - How to build and deploy

## Overview

**Environments**: dev, staging, prod
**Region**: ap-northeast-1 (Tokyo)
**Last Updated**: 2025-12-28

---

## Prerequisites

### Required Tools

```bash
# Node.js 20+
node --version  # v20.x.x

# Rust (for Tauri)
rustc --version  # 1.70+

# AWS CLI v2
aws --version

# AWS CDK
npm install -g aws-cdk
cdk --version  # 2.170+

# GitHub CLI (optional)
gh --version
```

### AWS Setup

```bash
# Configure AWS profile
aws configure --profile dev
# Enter: Access Key, Secret Key, Region (ap-northeast-1), Output (json)

# Verify access
aws sts get-caller-identity --profile dev
```

---

## Local Development

### 1. Clone and Setup

```bash
git clone git@github.com:aifuun/yorutsuke-v2.git
cd yorutsuke-v2
```

### 2. Frontend Setup

```bash
cd app
npm install

# Create .env.local (get values from CDK outputs)
cat > .env.local << EOF
VITE_LAMBDA_PRESIGN_URL=https://xxx.lambda-url.ap-northeast-1.on.aws
VITE_LAMBDA_CONFIG_URL=https://xxx.lambda-url.ap-northeast-1.on.aws
VITE_COGNITO_CLIENT_ID=xxx
VITE_COGNITO_USER_POOL_ID=ap-northeast-1_xxx
EOF
```

### 3. Run Development Server

```bash
# React only (fast)
npm run dev

# Full Tauri app (with Rust backend)
npm run tauri dev
```

---

## Infrastructure Deployment

### 1. First-time Setup

```bash
cd infra
npm install

# Bootstrap CDK (once per account/region)
cdk bootstrap aws://{ACCOUNT_ID}/ap-northeast-1 --profile dev
```

### 2. Deploy Stack

```bash
# Preview changes
npm run diff

# Deploy
npm run deploy

# Or with explicit profile
cdk deploy --profile dev --require-approval broadening
```

### 3. Get Outputs

```bash
# After deploy, get Lambda URLs for .env.local
aws cloudformation describe-stacks \
  --stack-name YorutsukeStack-dev \
  --query 'Stacks[0].Outputs' \
  --profile dev
```

---

## Desktop App Build

### macOS

```bash
cd app
npm run tauri build

# Output: src-tauri/target/release/bundle/dmg/Yorutsuke_0.1.0_aarch64.dmg
```

### Windows

```bash
# On Windows machine or cross-compile
npm run tauri build

# Output: src-tauri/target/release/bundle/msi/Yorutsuke_0.1.0_x64_en-US.msi
```

### Linux

```bash
npm run tauri build

# Output: src-tauri/target/release/bundle/appimage/yorutsuke_0.1.0_amd64.AppImage
```

---

## Environment Configuration

### dev

| Setting | Value |
|---------|-------|
| Stack Name | YorutsukeStack-dev |
| S3 Bucket | yorutsuke-images-dev-{account} |
| DynamoDB | yorutsuke-transactions-dev |
| User Pool | yorutsuke-users-dev |
| Cost Limit | ¥1,000/day |

### staging

| Setting | Value |
|---------|-------|
| Stack Name | YorutsukeStack-staging |
| S3 Bucket | yorutsuke-images-staging-{account} |
| DynamoDB | yorutsuke-transactions-staging |
| User Pool | yorutsuke-users-staging |
| Cost Limit | ¥1,000/day |

### prod

| Setting | Value |
|---------|-------|
| Stack Name | YorutsukeStack-prod |
| S3 Bucket | yorutsuke-images-prod-{account} |
| DynamoDB | yorutsuke-transactions-prod |
| User Pool | yorutsuke-users-prod |
| Cost Limit | ¥10,000/day |
| Removal Policy | RETAIN |

---

## Deployment Checklist

### Before Deploy

- [ ] All tests passing
- [ ] Version bumped in package.json
- [ ] CHANGELOG.md updated
- [ ] `cdk diff` reviewed
- [ ] No secrets in code

### After Deploy

- [ ] Smoke test Lambda URLs
- [ ] Check CloudWatch for errors
- [ ] Verify Cognito working
- [ ] Test S3 upload flow
- [ ] Update .env in team docs

---

## Rollback

### CDK Rollback

```bash
# CDK automatically rolls back on failure
# To manually rollback to previous version:
cdk deploy --rollback --profile dev
```

### Emergency: Delete Stack

```bash
# WARNING: This deletes all resources!
# Only use in dev environment
cdk destroy --profile dev
```

### App Rollback

```bash
# Revert to previous commit
git revert HEAD
git push

# Rebuild and redistribute app
npm run tauri build
```

---

## CI/CD (Future)

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Deploy CDK
        run: |
          cd infra
          npm ci
          npx cdk deploy --require-approval never
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### Release Process

1. Create release branch: `release/v0.2.0`
2. Update version in `app/package.json`, `app/src-tauri/tauri.conf.json`
3. Update `CHANGELOG.md`
4. Create PR → Review → Merge
5. Tag release: `git tag v0.2.0 && git push --tags`
6. Build desktop apps on each platform
7. Create GitHub Release with binaries

---

## Troubleshooting

### CDK Deploy Fails

```bash
# Check CloudFormation events
aws cloudformation describe-stack-events \
  --stack-name YorutsukeStack-dev \
  --profile dev \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'
```

### Lambda Cold Start Issues

```bash
# Check if provisioned concurrency needed
aws lambda get-function-configuration \
  --function-name yorutsuke-dev-presign \
  --profile dev
```

### Tauri Build Fails

```bash
# Clean and rebuild
cd app
rm -rf node_modules src-tauri/target
npm install
npm run tauri build
```

---

## References

- Architecture: `./ARCHITECTURE.md`
- Operations: `./OPERATIONS.md`
- CDK Stack: `infra/lib/yorutsuke-stack.ts`
- Tauri Config: `app/src-tauri/tauri.conf.json`
