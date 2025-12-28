# OPERATIONS.md

> Operations guide - Emergency response, cost control, monitoring

## Overview

**Purpose**: Protect the system and budget from unexpected issues
**Last Updated**: 2025-12-28

---

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

#### 1. Activate Emergency Stop

```bash
# Via Lambda
aws lambda invoke \
  --function-name yorutsuke-{env}-emergency \
  --cli-binary-format raw-in-base64-out \
  --payload '{"action":"activate","reason":"Suspicious activity detected"}' \
  --profile dev \
  /tmp/response.json && cat /tmp/response.json

# Direct DynamoDB update
aws dynamodb update-item \
  --table-name yorutsuke-{env}-control \
  --key '{"key":{"S":"global_state"}}' \
  --update-expression 'SET emergency_stop = :v, emergency_reason = :r' \
  --expression-attribute-values '{
    ":v": {"BOOL": true},
    ":r": {"S": "Manual activation"}
  }' \
  --profile dev
```

#### 2. Check Current Status

```bash
aws dynamodb get-item \
  --table-name yorutsuke-{env}-control \
  --key '{"key":{"S":"global_state"}}' \
  --query 'Item.{emergency_stop:emergency_stop.BOOL,reason:emergency_reason.S}' \
  --profile dev
```

#### 3. Deactivate Emergency Stop

> **IMPORTANT**: Confirm the issue is resolved before deactivating!

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

### Cost Breakdown (Estimated)

| Service | Cost/Unit | Daily Max |
|---------|-----------|-----------|
| Nova Lite | ¥0.015/image | ¥750 (50 users × 50 images × ¥0.015) |
| S3 Storage | ¥0.025/GB/month | ¥50 |
| DynamoDB | Pay-per-request | ¥100 |
| Lambda | ¥0.20/1M requests | ¥50 |
| Data Transfer | ¥15/GB | ¥50 |

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

# Check S3 bucket size
aws s3 ls s3://yorutsuke-images-dev-{account} --recursive --summarize \
  --profile dev | tail -2
```

### Cost Optimization

1. **Image Compression**: WebP < 100KB reduces S3/transfer costs
2. **Batch Processing**: 02:00 JST batch reduces Lambda cold starts
3. **S3 Lifecycle**: 30-day expiration prevents unbounded storage growth
4. **Intelligent-Tiering**: Auto-move infrequent access objects

---

## Monitoring

### CloudWatch Dashboards

Create dashboard with these widgets:

| Widget | Metrics |
|--------|---------|
| Lambda Errors | `AWS/Lambda` Errors by function |
| Lambda Duration | `AWS/Lambda` Duration P50, P99 |
| API Latency | `AWS/Lambda` Duration for presign |
| Batch Success | Custom metric: processed vs failed |
| Daily Cost | Billing EstimatedCharges |

### Alarms

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

## Incident Response Checklist

### When Alert Fires

- [ ] Check CloudWatch for error pattern
- [ ] Check recent deployments
- [ ] Activate emergency stop if needed
- [ ] Notify team in Slack/Discord
- [ ] Document timeline in incident report

### After Resolution

- [ ] Deactivate emergency stop
- [ ] Write post-mortem
- [ ] Create issue for prevention
- [ ] Update runbook if needed

---

## Runbook: Common Issues

### Issue: Batch Processing Failed

```bash
# 1. Check batch Lambda logs
aws logs tail /aws/lambda/yorutsuke-dev-batch --since 1h --profile dev

# 2. Check DynamoDB for stuck items
aws dynamodb scan \
  --table-name yorutsuke-transactions-dev \
  --filter-expression "status = :s" \
  --expression-attribute-values '{":s":{"S":"processing"}}' \
  --profile dev

# 3. Manually trigger batch (if safe)
aws lambda invoke \
  --function-name yorutsuke-dev-batch \
  --profile dev \
  /tmp/batch-response.json
```

### Issue: S3 Upload Failing

```bash
# 1. Check presign Lambda logs
aws logs tail /aws/lambda/yorutsuke-dev-presign --since 30m --profile dev

# 2. Verify bucket permissions
aws s3api get-bucket-policy --bucket yorutsuke-images-dev-{account} --profile dev

# 3. Test presign manually
curl -X POST https://{presign-url}/ \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","fileName":"test.webp","contentType":"image/webp"}'
```

### Issue: High Costs

```bash
# 1. Check which service is expensive
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --profile dev

# 2. Activate emergency stop to prevent further charges
# (See Emergency Response section above)
```

---

## Contacts

| Role | Contact |
|------|---------|
| On-call Engineer | (TBD) |
| AWS Account Owner | (TBD) |
| Emergency Slack | #yorutsuke-alerts |

## References

- Architecture: `./ARCHITECTURE.md`
- Deployment: `./DEPLOYMENT.md`
- CDK Stack: `infra/lib/yorutsuke-stack.ts`
