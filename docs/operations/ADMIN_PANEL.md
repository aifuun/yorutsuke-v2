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
│  Last Batch: 10:30 JST (Success, 15 images)               │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Control

Emergency controls for system operation:

| Control | Description | Use Case |
|---------|-------------|----------|
| Pause Uploads | Stop accepting new uploads | Cost overrun |
| Pause Batch | Skip batch processing | LLM issues |
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

### Batch (Receipt Processing)

**Renamed to "Receipt Processing"** with mode-aware UI:

#### Header
- Dynamic mode indicator badge (⚡ Instant / 📦 Batch / 🔄 Hybrid)
- Subtitle changes based on current mode behavior

#### Stats Cards
| Card | Shows | Context |
|------|-------|---------|
| Queued Images | Pending count | Threshold info in Batch mode |
| Last Run | Processed count | Timestamp of last processing |
| Failed | Error count | Severity indicator |

#### Manual Processing Section
- Mode-aware button: "Reprocess Failed" (Instant) / "Process Now" (Batch)
- Disabled when no action needed
- Two-step confirmation

#### Processing Modes Info
Visual three-card comparison at bottom:
- ⚡ Instant: Green, immediate processing
- 📦 Batch: Amber, queue until threshold
- 🔄 Hybrid: Blue, batch first then instant

### Processing Settings

Configure processing mode, triggers, and LLM model:

```
┌────────────────────────────────────────────────────────────┐
│  Processing Settings                                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Processing Mode                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ● Instant (On-Demand)         ← MVP3 推荐            │ │
│  │   每张上传后立即处理，无最低限制                       │ │
│  │                                                       │ │
│  │ ○ Batch Only (50% Discount)                          │ │
│  │   累积 >= 100 张后批处理，最省钱                       │ │
│  │                                                       │ │
│  │ ○ Hybrid                                              │ │
│  │   >= 100 张用 Batch，超时用 On-Demand                 │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Batch/Hybrid Settings (仅 Batch/Hybrid 模式显示)          │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Image Threshold: [100   ] images  (range: 100-500)  │ │
│  │ Timeout:         [120   ] minutes (range: 30-480)   │ │
│  │                  ↑ 仅 Hybrid 模式使用                 │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ⚠️ AWS Batch Inference 要求最少 100 条记录               │
│                                                            │
│  LLM Model                                                 │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ● Nova Lite (Recommended - Low Cost)                 │ │
│  │ ○ Nova Pro (Higher Accuracy)                         │ │
│  │ ○ Claude 3 Haiku (Alternative)                       │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Current Config                                            │
│  Mode: Instant | Last updated: 2026-01-08 by admin        │
│                                                            │
│  [Save Changes]                                            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

| Setting | Default | Range | Applies To | Description |
|---------|---------|-------|------------|-------------|
| `processingMode` | instant | instant/batch/hybrid | All | Processing mode selection |
| `imageThreshold` | 100 | 100-500 | Batch/Hybrid | Trigger batch when N images (AWS min: 100) |
| `timeoutMinutes` | 120 | 30-480 | Hybrid only | Fallback to On-Demand after M minutes |
| `modelId` | Nova Lite | See list | All | LLM for OCR processing |

**Processing Modes**:

| Mode | API | Min Images | Cost | Use Case |
|------|-----|------------|------|----------|
| `instant` | On-Demand | 1 | Full price | Early stage, low volume |
| `batch` | Batch Inference | 100 | **50% off** | High volume, cost-sensitive |
| `hybrid` | Mixed | 1 | Mixed | Balanced cost & latency |

**Available Models**:
- `amazon.nova-lite-v1:0` - Recommended, low cost
- `amazon.nova-pro-v1:0` - Higher accuracy
- `anthropic.claude-3-haiku-20240307-v1:0` - Alternative

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
