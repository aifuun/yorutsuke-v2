# Admin Panel Design Plan

> Based on yorutsuke-v2 existing app and OPERATIONS.md requirements

## Overview

独立的 Admin Web 应用，用于监控和管理 yorutsuke-v2 系统。

**设计原则**：
- 最小化实现，只构建当前需要的功能
- 复用现有 CDK 资源，避免重复建设
- 无独立认证，使用 AWS IAM + API Gateway IAM Authorizer

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Web App                             │
│  (React SPA hosted on S3 + CloudFront)                       │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              API Gateway (REST API)                          │
│              IAM Authorization                               │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐   ┌───────────────┐
│ admin-stats   │  │ admin-control │   │ admin-costs   │
│   Lambda      │  │   Lambda      │   │   Lambda      │
└───────────────┘  └───────────────┘   └───────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
  ┌──────────┐       ┌──────────┐       ┌──────────┐
  │CloudWatch│       │ DynamoDB │       │   Cost   │
  │ Metrics  │       │  Control │       │ Explorer │
  └──────────┘       └──────────┘       └──────────┘
```

## Pages (4 total)

### 1. Dashboard (/)

**Purpose**: System health overview at a glance

**Metrics to show**:
| Card | Source | Description |
|------|--------|-------------|
| Active Users | Cognito | 今日活跃用户数 |
| Images Today | S3 | 今日上传图片数 |
| Batch Status | Lambda logs | 最近批处理结果 |
| Daily Cost | Cost Explorer | 今日预估费用 |
| Emergency | DynamoDB | 紧急停止状态 |

**Implementation**:
- Single Lambda function `admin-stats`
- Aggregates data from CloudWatch, S3, DynamoDB

### 2. Control (/control)

**Purpose**: Emergency stop switch (FR-003 requirement)

**Features**:
- 🔴 Emergency Stop toggle (ON/OFF)
- Current status display
- Activation history log
- Reason input field

**Implementation**:
- Lambda `admin-control`
- DynamoDB table `yorutsuke-control-{env}` (new)

### 3. Costs (/costs)

**Purpose**: AWS cost monitoring and budget control

**Features**:
- Daily cost trend chart (7/30 days)
- Service breakdown pie chart
- Budget limit display (¥1,000/day)
- Cost alerts status

**Implementation**:
- Lambda `admin-costs`
- AWS Cost Explorer API
- Similar to bak-yoru/admin/src/pages/Costs.tsx

### 4. Batch (/batch)

**Purpose**: Monitor nightly batch processing

**Features**:
- Last batch execution time
- Processed / Failed / Skipped counts
- Recent batch logs
- Manual batch trigger button

**Implementation**:
- Lambda `admin-batch`
- CloudWatch Logs for batch-process Lambda
- EventBridge for manual trigger

## Authentication Strategy

**Use AWS SigV4 (IAM Authorization)**:
- No separate Cognito pool needed
- Admin uses AWS CLI credentials
- Frontend uses `@aws-sdk/client-sts` to assume role

```typescript
// Admin uses IAM credentials (already have dev profile)
// Frontend signs requests with SigV4
import { SignatureV4 } from '@aws-sdk/signature-v4';
```

**Pros**:
- Zero additional infrastructure
- Leverages existing AWS IAM
- No password management

**Cons**:
- Requires AWS credentials on client
- Desktop/CLI only (not for mobile)

## New AWS Resources

| Resource | Type | Purpose |
|----------|------|---------|
| `yorutsuke-admin-api-{env}` | API Gateway | Admin API endpoints |
| `yorutsuke-control-{env}` | DynamoDB | Emergency stop state |
| `admin-stats-{env}` | Lambda | Dashboard metrics |
| `admin-control-{env}` | Lambda | Emergency toggle |
| `admin-costs-{env}` | Lambda | Cost data |
| `admin-batch-{env}` | Lambda | Batch monitoring |
| `yorutsuke-admin-{env}` | S3 + CloudFront | Static hosting |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS (same as main app) |
| Charts | Recharts (same as bak-yoru) |
| API Client | AWS SDK v3 + SigV4 |
| Infrastructure | AWS CDK (extend existing stack) |

## Directory Structure

```
yorutsuke-v2/
├── admin/                    # New admin web app
│   ├── src/
│   │   ├── api/              # API clients with SigV4
│   │   ├── components/       # Shared UI components
│   │   ├── pages/            # Dashboard, Control, Costs, Batch
│   │   └── hooks/            # Data fetching hooks
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── infra/
│   ├── lib/
│   │   ├── yorutsuke-stack.ts      # Existing
│   │   └── yorutsuke-admin-stack.ts # New admin resources
│   └── lambda/
│       └── admin/            # New admin Lambda functions
│           ├── stats/
│           ├── control/
│           ├── costs/
│           └── batch/
```

## Implementation Order

### Phase 1: Core Infrastructure
1. Create `yorutsuke-admin-stack.ts`
2. Add Control DynamoDB table
3. Create API Gateway with IAM auth
4. Deploy 4 Lambda functions

### Phase 2: Frontend Foundation
1. Scaffold admin React app
2. Configure Tailwind CSS
3. Implement SigV4 API client
4. Create Layout component

### Phase 3: Pages
1. Dashboard page (stats Lambda)
2. Control page (emergency toggle)
3. Costs page (cost explorer)
4. Batch page (batch monitoring)

### Phase 4: Deployment
1. S3 bucket for static hosting
2. CloudFront distribution
3. Deployment scripts

## Cost Impact

| Resource | Monthly Cost (Estimated) |
|----------|--------------------------|
| API Gateway | $0 (< 1M requests free) |
| Lambda (4 functions) | $0 (< 1M requests free) |
| DynamoDB (control table) | $0 (< 25GB free) |
| S3 (static hosting) | $0.02 |
| CloudFront | $0 (< 1TB free) |
| Cost Explorer API | $0.01/request × ~100 = $1 |
| **Total** | ~$1/month |

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| IAM credential exposure | Use temporary STS credentials, short TTL |
| Cost Explorer quota | Cache results, limit to 1 request/hour |
| Emergency stop misuse | Require confirmation, audit log |

## Out of Scope (Future)

- User management (use Cognito Console)
- Transaction editing (use main app)
- Audit logs (use CloudTrail)
- Alerts configuration (use CloudWatch Console)

## Questions for User

None - design is minimal and focused on OPERATIONS.md requirements.
