# Yorutsuke v2 (夜付け)

Local-first AI accounting assistant for second-hand business users. Drag receipts → nightly AI batch processing → morning reports.

> "你只管赚钱，记账交给电脑里的 AI"

## AI-First Development Principles

> **This project is designed for AI-assisted development. All code, templates, and patterns prioritize AI readability and reliability.**

### Core Principles

| Principle | Rationale |
|-----------|-----------|
| **Explicit > Abstract** | AI doesn't remember implicit conventions between sessions |
| **Clear > DRY** | AI can generate repetitive code quickly; clarity prevents errors |
| **Concrete > Generic** | Generic types weaken type inference, causing AI mistakes |
| **Simple > Clever** | AI understands straightforward patterns more reliably |

### Guidelines for AI

1. **Copy templates directly** - Don't try to abstract or generalize
2. **Follow explicit patterns** - Each pillar has one recommended way
3. **Check checklists** - Use `.prot/checklists/` before and after coding
4. **Avoid generic factories** - Use explicit functions (e.g., `parseUser` not `createParser`)

### When in Doubt

```
Readable code > Shorter code
Explicit types > Inferred types
Copy-paste > Abstraction
One way > Multiple options
```

---

## Overview

- **Tech Stack**: Tauri 2, React 19, TypeScript, AWS CDK
- **Architecture**: AI_DEV_PROT v15
- **Current Version**: 0.1.0
- **Target Users**: Budget-conscious second-hand computer users (Mercari/Yahoo Auctions sellers)
- **Migration**: 本项目是迁移项目，原项目参考 `../yorutsuke`，参考功能和使用方法，架构完全改变

### Refer to Yorutsuke

参考原项目时的原则：

1. **先看原项目了解"做什么"** - 功能需求、边界条件、已踩过的坑
2. **再按新架构决定"怎么做"** - 遵循 Pillars、分层规范
3. **不直接复制，而是重写** - 适配 AI_DEV_PROT v15 架构

| 参考内容 | 价值 | 说明 |
|----------|------|------|
| Rust 逻辑 | ✅ 高 | 压缩参数、IPC 实现已调优 |
| 业务规则 | ✅ 高 | MD5 去重、quota 限制已验证 |
| 错误处理 | ✅ 高 | 异常场景已踩过坑 |
| 代码结构 | ⚠️ 低 | 架构完全不同，勿复制 |
| React hooks | ⚠️ 低 | 需适配 Pillar L headless |

## Core Flow

```
日間採集 (Day)        夜間処理 (02:00 JST)     朝報告 (Morning)
───────────────────────────────────────────────────────────────
Receipt Drop  →  Local SQLite  →  S3 Upload  →  Nova Lite OCR  →  Morning Report
     ↓              ↓                                                    ↓
  WebP圧縮      Queue管理                                          Transaction確認
```

## Project Structure

```
yorutsuke-v2/
├── app/                    # Tauri desktop application
│   ├── src/                # React frontend
│   │   ├── 00_kernel/      # EventBus, Logger, Context
│   │   ├── 01_domains/     # Pure business logic
│   │   │   ├── receipt/    # Receipt entity & rules
│   │   │   └── transaction/# Transaction entity & rules
│   │   ├── 02_modules/     # Feature modules
│   │   │   ├── capture/    # Image capture & upload
│   │   │   ├── report/     # Morning report
│   │   │   ├── transaction/# Transaction management
│   │   │   └── settings/   # User settings
│   │   └── 03_migrations/  # Data upcasters
│   └── src-tauri/          # Rust backend
│       └── src/            # IPC commands
│
├── infra/                  # AWS CDK
│   ├── lib/                # Stack definitions
│   ├── lambda/             # Lambda functions
│   │   ├── presign/        # S3 presigned URLs
│   │   ├── batch/          # Nightly batch trigger
│   │   └── batch-process/  # Nova Lite OCR
│   └── bin/
│
├── docs/                   # Source of Truth
│   ├── product/            # REQUIREMENTS, ROADMAP, CHANGELOG
│   ├── architecture/       # ARCHITECTURE, SCHEMA, INTERFACES, PROGRAM_PATHS
│   ├── design/             # UI mockups (HTML)
│   ├── operations/         # DEPLOYMENT, OPERATIONS, QUOTA, LOGGING
│   ├── planning/           # MVP_PLAN
│   └── tests/              # FRONTEND, BACKEND test scenarios
│
├── .claude/                # Claude Code config
│   ├── commands/
│   ├── workflow/
│   └── rules/
│
└── .prot/                  # AI_DEV_PROT v15 assets
    ├── CHEATSHEET.md
    └── pillar-{a-r}/
```

## Commands

```bash
# Development
cd app && npm run tauri dev    # Run Tauri app
cd app && npm run dev          # Run React only

# Build
cd app && npm run tauri build  # Build desktop app
cd app && npm run build        # Build React

# Infrastructure
cd infra && npm run diff       # Preview CDK changes
cd infra && npm run deploy     # Deploy to AWS (--profile dev)

# Test
cd app && npm test             # Run tests
```

## Workflow

### Core Commands

| Command | Description |
|---------|-------------|
| `*status` | Project overview (git, issues, progress) |
| `*resume` | Resume session (pull, load context) |
| `*sync` | Save progress and sync (commit, push) |
| `*next` | Execute next task |
| `*approve` | Approve pending action |

### Task Management

| Command | Description |
|---------|-------------|
| `*issue` | Manage GitHub issues |
| `*plan` | Create implementation plan |
| `*tier` | Classify task complexity (T1/T2/T3) |
| `*scaffold` | Generate module structure |

### Infrastructure

| Command | Description |
|---------|-------------|
| `*cdk` | AWS CDK operations (status/diff/deploy) |

### Protocol

| Command | Description |
|---------|-------------|
| `*review` | Post-code review |
| `*audit` | Run automated checks |
| `*pillar <X>` | Query Pillar details |

## Complexity Tiers (AI_DEV_PROT v15)

| Tier | Classification | Yorutsuke Example |
|------|---------------|-------------------|
| **T1** | Direct | Fetch transactions, render report |
| **T2** | Logic | Image queue, upload management |
| **T3** | Saga | Batch processing, payment (future) |

## Domain Entities

| Entity | Branded Type | Description |
|--------|--------------|-------------|
| `ImageId` | `string & { __brand: 'ImageId' }` | Receipt image identifier |
| `TransactionId` | `string & { __brand: 'TransactionId' }` | Transaction identifier |
| `UserId` | `string & { __brand: 'UserId' }` | User identifier |

## Rules

**MUST**:
- Classify task tier before implementation
- Use Branded Types for IDs (Pillar A)
- Validate all Lambda responses with Zod (Pillar B)
- Separate UI from logic (Pillar L: Headless)
- Add Intent-ID for batch operations (Pillar Q)

**MUST NOT**:
- Use primitive types for domain entities
- Mix JSX in headless hooks
- Trust raw API/IPC responses without parsing
- Skip quota checks before upload

## AWS Resources

| Service | Resource | Purpose |
|---------|----------|---------|
| S3 | `yorutsuke-images-{env}` | Receipt image storage (30-day lifecycle) |
| DynamoDB | `yorutsuke-transactions-{env}` | Transaction records |
| Cognito | `yorutsuke-users-{env}` | User authentication |
| Lambda | `yorutsuke-presign-{env}` | S3 upload URLs |
| Lambda | `yorutsuke-batch-{env}` | Nightly batch (02:00 JST) |
| Bedrock | Nova Lite | Receipt OCR (~¥0.015/image) |

## Cost Controls

| Level | Limit | Enforcement |
|-------|-------|-------------|
| Global | ¥1,000/day | Lambda hard stop |
| User | 50 images/day | Quota check |
| Rate | 1 image/10sec | MIN_UPLOAD_INTERVAL_MS |

## Memory & Context

- **Session tasks**: `.claude/TODO.md`
- **Long-term memory**: `.claude/MEMORY.md` (write in English only)
- **Workflow guide**: `.claude/WORKFLOW.md`

## Architecture Layers

| Layer | Directory | Purpose |
|-------|-----------|---------|
| **CC** | `.claude/` | Commands, workflows, behavior rules |
| **AI** | `.prot/` | Protocol, templates, code patterns |
| **Dev** | `docs/` | Project documentation |

---
@.prot/CHEATSHEET.md
@.claude/rules/tauri-stack.md

<!-- yorutsuke-v2 v0.1.0 -->
