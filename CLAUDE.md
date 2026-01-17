# Yorutsuke v2 (夜付け)

Local-first AI accounting assistant for second-hand business users. Drag receipts → configurable AI processing (instant/batch/hybrid) → transaction reports.

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

### Debugging Rules

**排查顺序**: 本地 Logs → 云端 Logs → 模拟代码流程 → 最小复现

详见 `.claude/rules/debugging.md`

### Time Handling

**存储和运算用 UTC，显示和选择用本地时区** → 详见 `.claude/rules/time-handling.md`

### Work Flow

**MVP → Issues → TODO 的协同机制**

| 文档 | 用途 |
|------|------|
| `.claude/WORKFLOW.md` | 工作流索引 & 速查表 (主入口) |
| `.claude/rules/workflow.md` | 核心原则 (三层架构) |
| `.claude/workflow/planning.md` | Two-Step Planning 详细指南 |

**三层架构**:
- **MVP 文件** (`docs/dev/MVP*.md`)：目标和验收标准（路标）
- **GitHub Issues + Issue Plans** (`.claude/plans/active/`)：详细的技术任务和实现方案（施工图）
- **MEMORY.md** (ADR index only)：长期知识和架构决策（备忘）

**Two-Step Planning**:
1. **Step 1** (40 min): MVP 分解 → 创建 Issues + 依赖图
2. **Step 2** (1-2h): Feature 详细规划 → Dev Plan + Test Cases (just-in-time)

**Templates & Planning**:

| 层级 | Template | Use Case | Command |
|------|----------|----------|---------|
| 战略 | `TEMPLATE-mvp.md` | New MVP release | `*plan` |
| 战役 | `TEMPLATE-feature-plan.md` | Before coding | `*issue pick` |
| 战役 | `TEMPLATE-github-issue.md` | Step 1 issues | `*issue new` |
| 战术 | Issue Plan files | Session work | `.claude/plans/active/#XXX.md` |

Templates location: `.claude/workflow/templates/`
Complete guide: `.claude/workflow/templates/README.md`

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
日間採集 (Day)          処理 (Configurable)         結果確認
──────────────────────────────────────────────────────────────────────────────────
Receipt Drop  →  Local SQLite  →  S3 Upload  →  Nova Lite OCR  →  Transaction Result
     ↓              ↓              ↓                                    ↓
  WebP圧縮      Queue管理   Instant/Batch/Hybrid                  確認/編集
```

**処理方式**: Admin で設定可能（即座処理/バッチ/ハイブリッド）

## Project Structure

```
yorutsuke-v2/
├── app/src/                # React frontend
│   ├── 00_kernel/          # EventBus, Logger, Context, Types
│   ├── 01_domains/         # Pure business logic (receipt/, transaction/)
│   ├── 02_modules/         # Feature modules
│   │   ├── capture/        # Image capture & upload (T2)
│   │   ├── report/         # Morning report (T1)
│   │   ├── transaction/    # Transaction management (T2)
│   │   └── settings/       # User settings
│   └── 03_migrations/      # Data upcasters
├── app/src-tauri/          # Rust backend (IPC commands)
├── infra/                  # AWS CDK (lib/, lambda/)
├── docs/                   # Source of Truth
├── .claude/                # Claude Code config (commands/, rules/)
└── .prot/                  # AI_DEV_PROT v15 (CHEATSHEET.md)
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

## Test Assets

测试图片：`/private/tmp/yorutsuke-test/` → 详见 `docs/tests/TEST_ASSETS.md`

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

## Architecture Decisions

**Before coding**: Check past decisions → `docs/architecture/ADR/`
- **ADR-001**: Service Pattern (global listeners, Zustand stores)
- **ADR-005**: TraceId vs IntentId (log correlation vs idempotency)

Full list: `docs/architecture/ADR/README.md`

## Rules

**MUST**:
- Classify task tier before implementation
- Use Branded Types for IDs (Pillar A)
- Validate all Lambda responses with Zod (Pillar B)
- Separate UI from logic (Pillar L: Headless) → See ADR-001
- Use Service Pattern for global listeners (not React hooks) → ADR-001
- Add Intent-ID for batch operations (Pillar Q) → See ADR-005
- When calling external AWS services (Lambda, API Gateway): update `app/src-tauri/tauri.conf.json` http.scope **before** code review

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
| Lambda | `yorutsuke-batch-{env}` | Batch Processing (configurable mode) |
| Bedrock | Nova Lite | Receipt OCR (~¥0.015/image) |

## Cost Controls

| Level | Limit | Enforcement |
|-------|-------|-------------|
| Global | ¥1,000/day | Lambda hard stop |
| User | 50 images/day | Quota check |
| Rate | 1 image/2sec | MIN_UPLOAD_INTERVAL_MS |

## Logging

日志位置：`~/.yorutsuke/logs/YYYY-MM-DD.jsonl` → 详见 `docs/operations/LOGGING.md`

```bash
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | jq .  # View today's logs
```

## Design System Integration

**Read before developing ANY UI component**: `.claude/rules/design-system.md`

### Pre-Development Checklist
- [ ] Read relevant design doc from `docs/design/`
- [ ] Identify required tokens (Color, Typography, Spacing, etc.)
- [ ] Check accessibility requirements (WCAG AA/AAA)
- [ ] Follow implementation pattern (no hard-coded values)
- [ ] Verify component in design spec before coding

### Design System Structure
| Layer | Location | Coverage |
|-------|----------|----------|
| **Tokens** | `docs/design/COLOR.md`, `TYPOGRAPHY.md`, `SPACING.md`, etc. | 25-color palette, font scales, animations |
| **Components** | `docs/design/BUTTONS.md`, `FORMS.md`, `FEEDBACK.md`, `ICONS.md` | 15+ UI components verified |
| **Views** | `docs/design/0X-*.md` | 5 complete screen specifications |
| **A11y** | `docs/design/ACCESSIBILITY.md` | WCAG 2.1 AA/AAA compliance |

### Token Usage Rules
1. **No hard-coded values** - use `--color-*`, `--space-*`, `--text-*` tokens only
2. **Semantic colors** - use `--color-primary`, `--text-default`, not `--blue-500`
3. **Copy structure directly** - don't invent, follow design spec exactly
4. **Include accessibility** - ARIA labels, focus states, reduced motion support

### Quick Start
```bash
# Read design system rules
cat .claude/rules/design-system.md

# Check specific component
cat docs/design/BUTTONS.md        # For buttons
cat docs/design/FORMS.md          # For form inputs
cat docs/design/FEEDBACK.md       # For toast/modal

# Verify tokens
grep "^--color" app/src/styles.css
grep "^--space" app/src/styles.css
```

## Memory & Context

- **Active issue plans**: `.claude/plans/active/#XXX.md`
- **Long-term memory**: `.claude/MEMORY.md` (ADR index only, English)
- **Workflow guide**: `.claude/WORKFLOW.md`
- **Design rules**: `.claude/rules/design-system.md` (read before UI coding)

## Key Documentation

| Category | File | Description |
|----------|------|-------------|
| **Architecture** | `docs/architecture/README.md` | Index → LAYERS, PATTERNS, FLOWS, SCHEMA, ADR |
| **Requirements** | `docs/product/REQUIREMENTS.md` | Feature specs, acceptance criteria |
| **MVP Plan** | `docs/dev/MVP_PLAN.md` | Roadmap & current phase |
| **Design System** | `docs/design/` | 19 specs: Foundation (6), Components (7), Views (5), A11y (1) → See `.claude/rules/design-system.md` |
| **Operations** | `docs/operations/` | LOGGING.md, QUOTA.md |

---
@.prot/CHEATSHEET.md

<!-- yorutsuke-v2 v0.1.0 -->
