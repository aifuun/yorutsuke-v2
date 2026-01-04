# Admin Panel

> Internal web console for system monitoring and emergency controls

## Overview

**URL**: https://d2m8nzedscy01y.cloudfront.net
**Auth**: Cognito User Pool (self-signup disabled)
**Purpose**: Monitor system health, control batch processing, view costs

---

## Access

### Credentials

| Resource | Value |
|----------|-------|
| User Pool | `ap-northeast-1_INc3k2PPP` |
| Admin User | `admin@yorutsuke.local` |
| Region | ap-northeast-1 |

### First-time Setup

1. Get temporary password from AWS Cognito Console
2. Navigate to CloudFront URL
3. Login with admin credentials
4. Set new password on first login

---

## Pages

### Dashboard

System overview with key metrics:

```
┌────────────────────────────────────────────────────────────┐
│  Dashboard                                                  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Active Users│  │ Today Upload│  │ Today Cost  │         │
│  │     42      │  │    1,234    │  │   ¥850     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                            │
│  System Status: ● Normal                                   │
│  Last Batch: 02:00 JST (Success)                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Control

Emergency controls for system operation:

| Control | Description | Use Case |
|---------|-------------|----------|
| Pause Uploads | Stop accepting new uploads | Cost overrun |
| Pause Batch | Skip nightly processing | LLM issues |
| Emergency Stop | Halt all operations | Critical issue |

```
┌────────────────────────────────────────────────────────────┐
│  Control                                                    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Upload Processing     [● Enabled ]  [Disable]             │
│  Batch Processing      [● Enabled ]  [Disable]             │
│                                                            │
│  ─────────────────────────────────────────────────────────│
│                                                            │
│  [!] Emergency Stop All                                    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Costs

Daily and monthly cost breakdown:

- S3 storage costs
- Lambda invocation costs
- Bedrock (Nova Lite) processing costs
- DynamoDB read/write costs

### Batch

Batch processing status and history:

| Column | Description |
|--------|-------------|
| Date | Batch run date |
| Started | Start time (JST) |
| Duration | Processing time |
| Processed | Images processed |
| Failed | Error count |
| Status | Success/Failed |

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Browser   │────▶│  CloudFront  │────▶│   S3 (Static)   │
│             │     │              │     │   React App     │
└─────────────┘     └──────────────┘     └─────────────────┘
       │
       │ JWT Token
       ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  API Call   │────▶│ API Gateway  │────▶│     Lambda      │
│             │     │ + Authorizer │     │  admin-api      │
└─────────────┘     └──────────────┘     └─────────────────┘
```

### Why Cognito (not IAM)

- Browser-friendly JWT tokens
- No SigV4 signing complexity
- Standard OAuth2 flow
- Simpler frontend implementation

---

## Security

### Access Control

- **Authentication**: Cognito User Pool
- **Self-signup**: Disabled (admin creates users)
- **MFA**: Optional (recommended for prod)
- **Session**: 1 hour token expiry

### Audit

All control actions logged to CloudWatch:
- User who performed action
- Timestamp
- Previous and new state

---

## Emergency Procedures

### Cost Overrun

1. Open Admin Panel → Control
2. Click "Disable" on Upload Processing
3. Verify status shows disabled
4. Investigate cause in Costs page

### Batch Failure

1. Open Admin Panel → Batch
2. Check error details for failed batch
3. If LLM issue: Disable Batch Processing
4. If recoverable: Wait for next batch

### Complete System Halt

1. Click "Emergency Stop All"
2. Confirm action in dialog
3. All processing halted
4. Requires manual re-enable

---

## Deployment

Admin panel is deployed as part of the main CDK stack:

```bash
cd infra
cdk deploy --profile dev
```

Resources created:
- S3 bucket for static files
- CloudFront distribution
- Cognito User Pool (admin)
- API Gateway + Lambda

---

## References

- Operations: `./OPERATIONS.md`
- CDK Stack: `infra/lib/admin-stack.ts`
- Frontend: `infra/admin/`
