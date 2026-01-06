# OPERATIONS.md

> Deployment, operations, emergency response, cost control, monitoring

## Overview

**Environments**: dev, staging, prod
**Region**: ap-northeast-1 (Tokyo)
**Last Updated**: 2025-01

---

# Part 1: Deployment

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
# Output: src-tauri/target/release/bundle/dmg/Yorutsuke_2.1.0_aarch64.dmg
```

### Windows

```bash
npm run tauri build
# Output: src-tauri/target/release/bundle/msi/Yorutsuke_2.1.0_x64_en-US.msi
```

### Linux

```bash
npm run tauri build
# Output: src-tauri/target/release/bundle/appimage/yorutsuke_2.1.0_amd64.AppImage
```

---

## Environment Configuration

| Environment | Stack Name | S3 Bucket | Cost Limit |
|-------------|------------|-----------|------------|
| dev | YorutsukeStack-dev | yorutsuke-images-dev-{account} | ¥1,000/day |
| staging | YorutsukeStack-staging | yorutsuke-images-staging-{account} | ¥1,000/day |
| prod | YorutsukeStack-prod | yorutsuke-images-prod-{account} | ¥10,000/day |

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

---

## Rollback

### CDK Rollback

```bash
# CDK automatically rolls back on failure
# To manually rollback:
cdk deploy --rollback --profile dev
```

### Emergency: Delete Stack

```bash
# WARNING: This deletes all resources! Only use in dev
cdk destroy --profile dev
```

---

# Part 2: Operations

## Emergency Response

### Emergency Stop Mechanism

```
Normal State                    Emergency State
───────────                     ─────────────
emergency_stop = false          emergency_stop = true
       ↓                              ↓
All services running            All APIs return 503
Batch processing active         Batch processing halted
```

### Auto-Trigger Conditions

| Alert | Threshold | Action |
|-------|-----------|--------|
| Lambda Errors | > 100 / 5 min | Auto-activate emergency_stop |
| Lambda Invocations | > 5000 / hour | Auto-activate emergency_stop |
| Daily AWS Spend | > ¥1,000 | Auto-activate emergency_stop |

### Manual Operations

#### Activate Emergency Stop

```bash
aws lambda invoke \
  --function-name yorutsuke-{env}-emergency \
  --cli-binary-format raw-in-base64-out \
  --payload '{"action":"activate","reason":"Suspicious activity"}' \
  --profile dev \
  /tmp/response.json
```

#### Check Status

```bash
aws dynamodb get-item \
  --table-name yorutsuke-{env}-control \
  --key '{"key":{"S":"global_state"}}' \
  --query 'Item.{emergency_stop:emergency_stop.BOOL,reason:emergency_reason.S}' \
  --profile dev
```

#### Deactivate Emergency Stop

```bash
aws lambda invoke \
  --function-name yorutsuke-{env}-emergency \
  --cli-binary-format raw-in-base64-out \
  --payload '{"action":"deactivate","reason":"Issue resolved"}' \
  --profile dev \
  /tmp/response.json
```

---

## Cost Control

### Budget Limits

| Level | Limit | Enforcement |
|-------|-------|-------------|
| Global Daily | ¥1,000 | Lambda hard stop |
| Per User Daily | 50 images | Quota check in presign |
| Per Image | ¥0.02 max | Nova Lite pricing |
| S3 Storage | 30 days | Lifecycle auto-delete |

### Cost Monitoring

```bash
# Check today's Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=yorutsuke-dev-batch \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 86400 \
  --statistics Sum \
  --profile dev
```

---

## Monitoring

### CloudWatch Alarms

| Alarm | Condition | Action |
|-------|-----------|--------|
| HighErrorRate | Errors > 10/min | SNS → Email |
| HighLatency | P99 > 5000ms | SNS → Email |
| CostSpike | Daily > ¥800 | SNS → Email |
| BatchFailure | Failures > 5 | SNS → Emergency Lambda |

### Log Queries

```sql
-- Find errors in batch processing
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 50

-- Find slow requests
fields @timestamp, @duration, @requestId
| filter @duration > 3000
| sort @duration desc
| limit 20
```

---

## Incident Response

### When Alert Fires

- [ ] Check CloudWatch for error pattern
- [ ] Check recent deployments
- [ ] Activate emergency stop if needed
- [ ] Notify team
- [ ] Document timeline

### After Resolution

- [ ] Deactivate emergency stop
- [ ] Write post-mortem
- [ ] Create issue for prevention

---

## Runbook: Common Issues

### Batch Processing Failed

```bash
# 1. Check logs
aws logs tail /aws/lambda/yorutsuke-dev-batch --since 1h --profile dev

# 2. Check stuck items
aws dynamodb scan \
  --table-name yorutsuke-transactions-dev \
  --filter-expression "status = :s" \
  --expression-attribute-values '{":s":{"S":"processing"}}' \
  --profile dev
```

### S3 Upload Failing

```bash
# 1. Check presign logs
aws logs tail /aws/lambda/yorutsuke-dev-presign --since 30m --profile dev

# 2. Test presign manually
curl -X POST https://{presign-url}/ \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","fileName":"test.webp","contentType":"image/webp"}'
```

### High Costs

```bash
# Check which service is expensive
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --profile dev
```

---

## CI/CD (Future)

### Release Process

1. Create release branch: `release/v0.2.0`
2. Update version in `package.json`, `tauri.conf.json`
3. Update `CHANGELOG.md`
4. Create PR → Review → Merge
5. Tag: `git tag v0.2.0 && git push --tags`
6. Build desktop apps
7. Create GitHub Release with binaries

---

## References

- Architecture: `../architecture/ARCHITECTURE.md`
- Quota Details: `./QUOTA.md`
- Logging: `./LOGGING.md`
- CDK Stack: `infra/lib/yorutsuke-stack.ts`
