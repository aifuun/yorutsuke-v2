# ARCHITECTURE.md

> System architecture - How to organize

## Overview

**Architecture**: Local-First + Cloud-Sync
**Pattern**: AI_DEV_PROT v15 (Tauri + React + AWS CDK)
**Last Updated**: 2025-12-28

## System Context

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User Device                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     Yorutsuke Desktop App                              │  │
│  │  ┌─────────────────┐           ┌─────────────────┐                    │  │
│  │  │  React Frontend │◄─────────►│  Tauri (Rust)   │                    │  │
│  │  │                 │    IPC    │  - Compression  │                    │  │
│  │  │  - UI/Views     │           │  - File I/O     │                    │  │
│  │  │  - Headless     │           │  - SQLite       │                    │  │
│  │  │  - Adapters     │           │                 │                    │  │
│  │  └─────────────────┘           └─────────────────┘                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTPS
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Cognito   │  │   Lambda    │  │     S3      │  │     DynamoDB        │ │
│  │   (Auth)    │  │  (Presign)  │  │  (Images)   │  │   (Transactions)    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                          │                                    ▲              │
│                          │ 02:00 JST                          │              │
│                          ▼                                    │              │
│                   ┌─────────────┐                             │              │
│                   │   Lambda    │─────────────────────────────┘              │
│                   │   (Batch)   │                                            │
│                   │  + Bedrock  │                                            │
│                   │  Nova Lite  │                                            │
│                   └─────────────┘                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Layer Structure

### Frontend Layers (app/src/)

```
app/src/
├── 00_kernel/          # Infrastructure (no business logic)
│   ├── types/          # Branded types (UserId, ImageId, etc.)
│   ├── context/        # React Context (Auth, App state)
│   └── telemetry/      # Logging, error tracking
│
├── 01_domains/         # Pure business logic (no I/O, no UI)
│   ├── receipt/        # Receipt entity, status FSM, rules
│   └── transaction/    # Transaction entity, calculations
│
├── 02_modules/         # Feature modules
│   ├── capture/        # T2: Image capture & upload queue
│   │   ├── adapters/   # IPC + S3 API
│   │   ├── headless/   # useCaptureLogic
│   │   └── views/      # DropZone, Queue UI
│   ├── report/         # T1: Morning report display
│   │   ├── adapters/   # Report API
│   │   └── views/      # ReportView
│   └── transaction/    # T2: Transaction management
│       ├── adapters/   # SQLite DB
│       ├── headless/   # useTransactionLogic
│       └── views/      # TransactionView
│
└── 03_migrations/      # Data version upcasters
```

### Infrastructure Layer (infra/)

```
infra/
├── lib/
│   └── yorutsuke-stack.ts    # Main CDK stack
├── lambda/
│   ├── presign/              # S3 presigned URL generation
│   ├── batch/                # Nightly batch trigger
│   └── batch-process/        # Nova Lite OCR processing
└── bin/
    └── infra.ts              # CDK entry point
```

## Data Flow

### 1. Receipt Capture Flow

```
User drops image
      │
      ▼
┌─────────────────┐
│ Tauri: Compress │  WebP, < 100KB
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ SQLite: Save    │  status = 'pending'
│ images table    │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Lambda: Presign │  Get S3 upload URL
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ S3: Upload      │  status = 'uploaded'
└─────────────────┘
```

### 2. Nightly Batch Flow (02:00 JST)

```
EventBridge trigger
      │
      ▼
┌─────────────────┐
│ Check limits    │  ¥1,000/day, 50/user
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Scan S3 bucket  │  Today's uploads
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Bedrock: OCR    │  Nova Lite Vision
│ ~¥0.015/image   │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ DynamoDB: Write │  transactions table
└─────────────────┘
```

### 3. Morning Report Flow

```
App launch
      │
      ▼
┌─────────────────┐
│ Check local     │  transactions_cache
└─────────────────┘
      │ miss
      ▼
┌─────────────────┐
│ Fetch from API  │  Lambda → DynamoDB
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Cache locally   │  SQLite
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Render report   │  ReportView
└─────────────────┘
```

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Desktop Framework | Tauri 2 | < 5MB app size, Rust performance |
| Frontend | React 19 | Familiar, good ecosystem |
| Local DB | SQLite | Offline-first, simple |
| Cloud Storage | S3 | Cost-effective, lifecycle rules |
| Cloud DB | DynamoDB | Serverless, pay-per-request |
| Auth | Cognito | Managed, secure |
| AI | Bedrock Nova Lite | Cheap (~¥0.015/image), good OCR |
| IaC | AWS CDK | TypeScript, type-safe |

## Module Tiers

| Module | Tier | Pattern | Complexity |
|--------|------|---------|------------|
| capture | T2 | View → Headless → Adapter | Queue management, FSM |
| report | T1 | View → Adapter | Simple fetch/render |
| transaction | T2 | View → Headless → Adapter | CRUD, confirmation flow |
| batch | T3 | Saga | Compensation, idempotency |

## Security

- **Auth**: Cognito JWT tokens
- **Data at rest**: S3 + DynamoDB encryption
- **Data in transit**: HTTPS only
- **CSP**: Strict content security policy
- **IAM**: Least privilege Lambda roles

## Cost Control

| Control | Limit | Enforcement |
|---------|-------|-------------|
| Global daily | ¥1,000 | Lambda hard stop |
| Per-user daily | 50 images | Quota check in presign |
| Rate limit | 1 image/10s | Frontend throttle |
| S3 lifecycle | 30 days | Auto-delete old images |

## References

- Schema: `./SCHEMA.md`
- Interfaces: `./INTERFACES.md`
- AI_DEV_PROT: `.prot/CHEATSHEET.md`
