# Workflow Architecture - MVP → Issues → TODO 的完整图景

**澄清 Planning/Development Workflow 与 MVP/Issues/TODO 三层架构的关系，以及 \*next 命令的作用**

---

## 📐 整体架构图

```
┌──────────────────────────────────────────────────────────────────────┐
│                    COMPLETE DEVELOPMENT LIFECYCLE                    │
└──────────────────────────────────────────────────────────────────────┘

PHASE A: Documentation           PHASE B: Planning              PHASE C: Dev
(docs/)                         (workflow/planning.md)        (workflow/development.md)
    │                                   │                              │
    ▼                                   ▼                              ▼
┌─────────────┐     ┌──────────────────────────────────┐    ┌─────────────────┐
│ REQUIREMENTS│     │      FEATURE PLANNING            │    │   CODING        │
│ ARCHITECTURE│────→│  (0. Docs check                  │───→│ (Tier, Phases)  │
│ SCHEMA      │     │   1. Analyze requirements        │    │                 │
│ DESIGN      │     │   2. Open Issues                 │    │ *next command   │
│             │     │   3. Decompose                   │    │   executes      │
└─────────────┘     │   4. Plan (detailed steps)       │    │   Phase 1-4     │
                    │   5. Evaluate                    │    │                 │
                    │   6. Confirm → GitHub Issue      │    │ Updates TODO.md │
                    │   7. Test Cases                  │    │ as you code     │
                    │   8. Assess & Prioritize)        │    │                 │
                    └──────────────────────────────────┘    └─────────────────┘
                              ▼
                    ┌─────────────────────┐
                    │  GitHub Issues      │
                    │  (Plan + Test       │
                    │   Cases added       │
                    │   to comments)      │
                    └─────────────────────┘


═════════════════════════════════════════════════════════════════════════════════

LONG-TERM ORGANIZATION        SESSION TRACKING               EXECUTION GUIDANCE
(Strategic)                   (Tactical)                     (Operational)
    │                             │                              │
    ▼                             ▼                              ▼

MVP 文件 (路标)          GitHub Issues           TODO.md (今日清单)    Development
docs/dev/MVP*.md        + Dev Plan Comments     .claude/TODO.md      Workflow
     │                        │                       │              commands
     ├─ 业务目标          ├─ Issue #N            ├─ Current    (*tier, *next,
     ├─ 验收标准         │  (Title)             │   Issue     *review,
     ├─ 相关 Issues       │  ├─ Description      │              *sync)
     └─ 环境配置         │  ├─ Acceptance       │   ├─ Steps  
                          │  │   Criteria       │   │  Checklist
                          │  ├─ Dev Plan        │   │  (with ☐)
                          │  │   Comment        │   │
                          │  ├─ Test Cases      │   └─ Progress
                          │  │   Comment        │      Tracking
                          │  └─ Labels          │
                          │     (tier,          │  
                          │      pillar,        │  
                          │      status)        │
                          │                     │
                          └─────────────────────┴─ *next 推荐下一步
```

---

## 🔄 Three-Layer Hierarchy

### Layer 1: MVP 文件 (Strategic Vision)

**位置**: `docs/dev/MVP*.md`
**所有者**: Product/Tech Lead
**更新频率**: Per release (v0.1, v0.2, v1.0)
**生命周期**: 一周到一个月

```
MVP3 - 批处理上传
├─ Goal: Process batched Bedrock results, write to DynamoDB
├─ Acceptance Criteria:
│  ├─ [x] 1000 items processed in < 10s (6x speedup)
│  ├─ [x] Idempotent transactionId generation
│  └─ [ ] CloudWatch metrics + alarms
├─ Related Issues:
│  └─ #99 batch-result-handler
└─ Environment:
   └─ Lambda timeout: 10min
```

**MVP 文件的职责**:
- ✅ 定义业务目标
- ✅ 列出验收标准（可打勾）
- ✅ 超链接引用相关 Issues（不重复内容）
- ✅ 记录环境配置和依赖
- ❌ 不包含代码实现细节
- ❌ 不包含测试场景

**与 Workflow 的关系**:
- `workflow/planning.md` Step 0: 检查 MVP 中的需求
- `workflow/planning.md` Step 5: Plan 文档与 MVP 验收标准对齐

---

### Layer 2: GitHub Issues (Technical Tasks)

**位置**: GitHub Issues 或 `.github/issues/` 目录
**所有者**: Tech Lead / AI
**更新频率**: When planning or working on issue
**生命周期**: 一周内（从创建到关闭）

```
Issue #99: batch-result-handler - 4 core improvements

Description: Process S3 Bedrock output, write to DynamoDB
Acceptance Criteria:
  ☐ Improvement #1: Idempotency
  ☐ Improvement #4: Streaming + BatchWriteItem
  ☐ Improvement #5: S3 key mapping
  ☐ Improvement #7: IAM least privilege

Comments:
  1️⃣ Development Plan (from workflow/planning.md Step 4):
     └─ .claude/batch-result-handler-PLAN.md content

  2️⃣ Test Cases (from workflow/planning.md Step 7):
     └─ .claude/batch-result-handler-TEST-CASES.md content

  3️⃣ Implementation Progress:
     └─ Step 1: [x] Idempotency
     └─ Step 2: [x] Streaming + BatchWriteItem
     └─ ...

Labels: status/planned, tier/t3, pillar/b, pillar/q, pillar/r
```

**GitHub Issues 的职责**:
- ✅ 技术任务的完整描述
- ✅ 代码改动范围（哪些文件）
- ✅ 开发计划（从 workflow/planning.md Step 4-7 复制）
- ✅ 测试用例（从 workflow/planning.md Step 7 复制）
- ✅ 讨论记录和变更历史
- ✅ 标签（tier, pillar, status, priority）

**与 Workflow 的关系**:
- `workflow/planning.md` Step 2: 创建或找到 Issue #N
- `workflow/planning.md` Step 6: 在 Issue 中添加 Dev Plan + Test Cases
- `workflow/planning.md` Step 8: 应用标签
- `workflow/development.md` *issue pick: 加载 Issue 细节（包括计划和测试）

---

### Layer 3: TODO.md (Session Tracking)

**位置**: `.claude/TODO.md`
**所有者**: AI
**更新频率**: Per session (every coding session)
**生命周期**: 当日（Session 结束清空或关闭 Issues）

```markdown
## Current Session [2026-01-09]

### Active Issues
- [x] #99 batch-result-handler (已完成)
  - [x] Step 1: Fix timestamp bug (idempotency)
  - [x] Step 2: Create MVP3.1 roadmap
  - [x] Step 3: [next step]

- [ ] #102 SQS + DLQ Configuration (in progress)
  - [x] Design architecture
  - [ ] Implement CDK stack
  - [ ] Test event flow

### Next Up (from MVP3.1)
- [ ] #103 trace propagation (2-3h)
- [ ] #104 migrateImageFiles (4-6h)

### Blocked
- None
```

**TODO.md 的职责**:
- ✅ 记录当前 Session 的 1-3 个活跃 Issue
- ✅ Session 内的进度追踪（子任务打勾）
- ✅ 记录下一个要开始的 Issue
- ✅ 标记任何阻塞项
- ❌ 不是 GitHub Issues 的镜像副本（只记录当前进度）
- ❌ Session 结束后清空

**与 Workflow 的关系**:
- `workflow/development.md` *issue pick: 创建 TODO.md 条目
- `workflow/development.md` *next: 推荐下一个 Sub-task 或 Issue

---

## 🔗 Workflow 如何连接三层架构

### PHASE B: Planning → GitHub Issues (Step 0-8)

```
Step 0: Check Docs
  ↓
  🔍 检查 MVP 文件的需求是否清晰
  🔍 检查 REQUIREMENTS/ARCHITECTURE/SCHEMA/DESIGN
  ↓
Step 1: Analyze Requirements
  ↓
  📋 从 MVP 或 Feature Request 提取需求
  ↓
Step 2: Open Issues
  ↓
  ✅ 检查 GitHub 是否已有相关 Issue
  ✅ 创建或复用 Issue #N
  ↓
Step 3-8: Plan → Evaluate → Confirm → Test Cases → Prioritize
  ↓
  📝 创建 .claude/*-PLAN.md (implemention steps)
  📝 创建 .claude/*-TEST-CASES.md (test matrix)
  💬 在 Issue #N 的评论中添加这两个文档
  🏷️ 应用标签: status/planned, tier/*, pillar/*
  ↓
GitHub Issue #N is now READY
```

### PHASE C: Development → TODO.md (Execution)

```
*issue pick #N
  ↓
  📂 加载 Issue #N 的详细信息（来自 GitHub）
     ├─ Acceptance Criteria
     ├─ Dev Plan Comment (从 .claude/*-PLAN.md)
     └─ Test Cases Comment (从 .claude/*-TEST-CASES.md)
  ↓
  📝 在 TODO.md 创建活跃任务条目
     ├─ Issue Title
     ├─ Acceptance Criteria (打勾列表)
     └─ Steps from Dev Plan (打勾列表)
  ↓
*tier (if needed)
  ↓
  🎯 分类复杂度 → 更新 TODO.md tier
  ↓
*next (Phase 1: Pre-Code)
  ↓
  ✓ Load .prot/checklists/pre-code.md
  ✓ Check TODO.md steps and tier
  ✓ Run audits
  ↓
*next (Phase 2: In-Code)
  ↓
  🔨 For each step in dev plan:
     1. Check Pillar from TODO.md
     2. Copy template
     3. Verify rule compliance
     4. Run tests
     5. Mark step complete in TODO.md
  ↓
*review (Phase 4: Post-Code)
  ↓
  ✓ Final verification
  ↓
*issue close #N
  ↓
  ✅ Close Issue in GitHub
  ✅ Commit with Issue ID
  ✅ Archive decision to MEMORY.md
  ✅ Clear TODO.md entry
```

---

## 🎮 The *next Command Flow

### What does *next do?

`*next` 是一个**智能任务导航**命令，实现三级推荐系统：

```
*next
  │
  ├─ Level 1: Check TODO.md
  │  ├─ Active issue?
  │  │  ├─ Yes → Show next sub-task from dev plan
  │  │  │        Execute Phase 1-4
  │  │  └─ No → Go to Level 2
  │  └─ Mark steps complete as you go
  │
  ├─ Level 2: Check GitHub Issues (from current MVP)
  │  ├─ Uncompleted issues?
  │  │  ├─ Yes → Recommend highest priority issue
  │  │  │        Prompt: "Start #N? (y/n)"
  │  │  │        Create TODO.md entry on confirm
  │  │  └─ No → Go to Level 3
  │  └─ Pull plan from Issue comments
  │
  └─ Level 3: Check next MVP
     ├─ All issues done?
     │  ├─ Yes → Recommend next MVP
     │  │        Prompt: "MVP3.1 ready? (y/n)"
     │  │        Suggest *plan for new decomposition
     │  └─ No → Done
     └─ Load MVP file
```

### Example Flow

```bash
# Session 1: Start working on #99
$ *issue pick 99
# Creates in TODO.md:
# ### Active Issues
# - [ ] #99 batch-result-handler
#   - [ ] Step 1: Fix timestamp bug
#   - [ ] Step 2: Create roadmap
#   - [ ] Step 3: ...

# Start Phase 1 (Pre-code)
$ *next
# Shows: Load pre-code checklist, check pillars, prepare environment

# Continue to Phase 2 (In-code)
$ *next
# Shows: Execute Step 1 from dev plan
#        (File edits, follow template, run tests)

# After Step 1 is done
$ *next
# Shows: Execute Step 2
# (You check the box manually or AI marks it)

# After Step 3 complete
$ *next
# Shows: Run Phase 4 review/audit

# After review
$ *issue close 99
# Closes GitHub Issue, clears TODO.md

# Session 2: New day
$ *resume
$ *next
# Looks at GitHub Issues for MVP3.1
# Shows: Recommend #102 "SQS configuration"
# Prompt: "Start #102? (y/n)"
```

---

## 📊 Complete Example: Shopping Cart Feature

### Step 1: MVP File (Strategic)

**File**: `docs/dev/MVP2_CART.md`

```markdown
# MVP2 - Shopping Cart

Goal: Enable users to add/remove items from cart with persistence

## Acceptance Criteria
- [ ] User can add item with quantity
- [ ] User can remove item from cart
- [ ] Cart count displays correctly
- [ ] Cart persists after page reload

## Related Issues
- #42 Cart state management
- #43 Cart UI components
- #44 Cart persistence

## Environment
- Redux store configured
- localStorage API available
```

### Step 2: Planning Workflow (Planning Phase)

**Step 2.1**: Check docs ✓
**Step 2.2**: Analyze requirement ✓
**Step 2.3**: Open Issues → Create #42, #43, #44 ✓
**Step 2.4-2.8**: Create detailed plans

**File**: `.claude/shopping-cart-PLAN.md`

```markdown
# Shopping Cart - Development Plan

## Step 1: Redux State Management (2h)
- Files: src/redux/cart.slice.ts
- Actions: addItem, removeItem, updateQuantity
- Pillar L: Logic separated from UI

## Step 2: UI Components (3h)
- Files: src/components/CartIcon, CartDrawer
- Display badge with count
- Pillar A: Modular components

## Step 3: Persistence (1h)
- Files: src/middleware/cartPersistence.ts
- localStorage save/load
- Pillar Q: Idempotent load
```

**File**: `.claude/shopping-cart-TEST-CASES.md`

```markdown
# Shopping Cart - Test Cases

## Step 1: Redux

TC-1.1: Add item
- Given: Empty cart
- When: Add Coffee, qty=2
- Then: State shows 1 item, qty=2 ✓

TC-1.2: Duplicate add
- Given: Cart has Coffee, qty=2
- When: Add Coffee, qty=1
- Then: Qty updates to 3 ✓

## Step 2: UI

TC-2.1: Badge count
- Given: Cart has 3 items
- When: Icon renders
- Then: Badge shows "3" ✓

## Coverage Matrix

| Criterion | Tests |
|-----------|-------|
| Add item | TC-1.1, TC-2.1 |
| Remove item | TC-1.3, TC-2.2 |
| Persistence | TC-3.1 |

Coverage: 100% ✓
```

### Step 3: GitHub Issues (Tactical)

**Issue #42**: Cart state management

```markdown
## Goal
Implement Redux slice for cart state

## Acceptance Criteria
- [ ] addItem action
- [ ] removeItem action
- [ ] Selectors for cart items

## Development Plan
[Content from .claude/shopping-cart-PLAN.md Step 1]

## Test Cases
[Content from .claude/shopping-cart-TEST-CASES.md Step 1]

Labels: status/planned, tier/t2, pillar/l
```

### Step 4: Development Session (Tactical)

```bash
$ *issue pick 42

# TODO.md created:
## Current Session
### Active Issues
- [ ] #42 Cart state management
  - [ ] Implement addItem action
  - [ ] Implement removeItem action
  - [ ] Create selectors

$ *next
# Phase 1: Pre-code checklist
# - Check Pillar L template
# - Review ARCHITECTURE.md for Redux pattern
# Ready? *next

$ *next
# Phase 2: In-code
# Execute Step 1 from .claude/shopping-cart-PLAN.md
# File: src/redux/cart.slice.ts
# [coding...]

# (After completing action implementations)
$ *next
# Execute selectors
# [coding...]

$ *next
# Phase 3: Tests
# Run: npm test src/redux/cart.slice.test.ts

$ *review
# Phase 4: Final check

$ *issue close 42
# Closes Issue, updates TODO.md, commits
```

---

## 🎯 Summary: Three Layers in Action

| Layer | File | When | Owner | Lifecycle |
|-------|------|------|-------|-----------|
| **MVP** | `docs/dev/MVP*.md` | Planning release | Tech Lead | 1-4 weeks |
| **Issues** | GitHub #N + comments | Planning feature | AI/Tech Lead | 1-7 days |
| **TODO** | `.claude/TODO.md` | Development session | AI | Same day |

### Data Flow

```
MVP (big picture)
  ↓
  Planning Workflow (Phase B)
  ↓
GitHub Issues (detailed plan + tests)
  ↓
*issue pick
  ↓
TODO.md (today's work)
  ↓
*next (execute steps)
  ↓
*issue close
  ↓
MVP updated (acceptance criteria checked)
```

### Command Progression

```
Development Session Flow:

*resume
  ↓ (load .claude/MEMORY.md, .claude/TODO.md)
*issue pick #N
  ↓ (load GitHub Issue + comments)
*next (Phase 1)
  ↓ (pre-code checklist)
*next (Phase 2)
  ↓ (execute dev plan steps)
*next (Phase 3)
  ↓ (tests)
*review (Phase 4)
  ↓ (final audit)
*issue close #N
  ↓ (commit, close GitHub issue)
*sync
  ↓ (push to remote)
```

