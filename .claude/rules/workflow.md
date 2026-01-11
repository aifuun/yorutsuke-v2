---
paths:
  - .claude/plans/active/
  - .claude/MEMORY.md
---

# Workflow Rule - MVP, Issues, Plans 协同机制

> **详细指南**: `.claude/WORKFLOW.md` (index & cheatsheet)
> **Two-Step Planning**: `.claude/workflow/planning.md`

## Issue Plans 战术层 (Tactics)

当你处理一个 Issue 时，使用 `.claude/plans/active/#XXX.md` 追踪任务：

**Template**: `.claude/workflow/templates/TEMPLATE-feature-plan.md`

**关键原则**:
- 每个 GitHub Issue 对应一个 `.claude/plans/active/#XXX.md` 计划文件
- 从 Feature Plan 复制子任务到计划文件
- 实时更新进度（打勾）
- Issue 完成后存档计划文件，重要决策创建 ADR

**结构**:
```markdown
---
issue: XXX
status: in-progress
---

# Issue #XXX: Title

### Steps
- [x] 完成的步骤
- [ ] **正在做** ← 当前
- [ ] 下一步
```

## 核心原则

**以 Issues 为核心的三层工作流**：

```
MVP 文件 (路标)  →  GitHub Issues (施工图)  →  Issue Plans (日常清单)
     ↓                    ↓                         ↓
  目标/验收           技术任务/实现细节        当前 Session 活跃任务
```

## Branch-First Rule (CRITICAL)

**BEFORE starting ANY code changes, ALWAYS create a feature branch.**

### Branch Naming Convention
```
feature/#XXX-short-description   (new features)
bugfix/#XXX-short-description    (bug fixes)
hotfix/#XXX-short-description    (urgent production fixes)
```

### Checklist (MUST verify before coding)
- [ ] NOT on `development` or `master` branch
- [ ] Branch name follows convention
- [ ] Created from latest `development`

### Example Workflow
```bash
# 1. Check current branch
git branch --show-current

# 2. If on development/master, create feature branch
git checkout development
git pull origin development
git checkout -b feature/115-unified-filter-bar

# 3. NOW start coding
```

**Why?** Feature branches allow safe experimentation, easy rollback, clean history, and parallel development.

**When to branch?** When `*next` picks up a new issue, IMMEDIATELY create a branch BEFORE planning or coding.

## Branch-Cleanup Rule (CRITICAL)

**AFTER issue is closed, ALWAYS delete the feature branch (locally AND on GitHub).**

### Cleanup Checklist (MUST verify after `*issue close`)
- [ ] Feature branch deleted locally: `git branch -d feature/XXX-*`
- [ ] Feature branch deleted on GitHub: `git push origin --delete feature/XXX-*`
- [ ] Stale branches cleaned: `git branch -v | grep "gone" | awk '{print $1}' | xargs git branch -d`
- [ ] Plan file archived: `plans/active/#XXX.md` → `plans/archive/`

### Why Clean Up Branches?

| Reason | Impact |
|--------|--------|
| **Prevents clutter** | Too many branches = confusion about active work |
| **Clear history** | Only merged branches remain = reflects actual timeline |
| **Easier `*resume`** | No stale branches to skip over |
| **Better PR hygiene** | Feature branch = one PR = one issue (clear causality) |
| **Saves CI/CD resources** | GitHub doesn't run workflows on deleted branches |

### Auto-Cleanup (in `*issue close` command)
When you run `*issue close #XXX`, the command automatically:
1. ✅ Merges feature/XXX-* to development
2. ✅ Deletes feature/XXX-* (local + GitHub)
3. ✅ Archives issue plan: plans/active/ → plans/archive/
4. ✅ Closes GitHub issue

**No manual work needed** - but verify completion!


## Two-Step Planning (新增)

**Step 1: MVP-Level Decomposition** (40 min)
- 分析 MVP 目标，识别功能模块
- 快速创建 GitHub Issues (rough sizing)
- 建立依赖关系图

**Step 2: Feature-Level Planning** (1-2h per feature)
- 在开发前进行详细规划
- 创建 Dev Plan + Test Cases
- Just-in-time planning，可根据前序 feature 学习调整

## 1. MVP 文件层 (Vision & Acceptance)

**位置**: `docs/dev/MVP*.md`

**职责**:
- 定义业务目标（一句话概括）
- 列出核心验收标准（Acceptance Criteria）
- 关联相关 Issues（超链接，不重复细节）
- 记录环境配置和依赖

**格式示例**:
```markdown
# MVP2 - 云端上传验证

> **目标**: 实现真实的 S3 上传和 Quota 管理

## 验收标准
- [ ] 上传 5 张图片到 S3，全部成功
- [ ] 断网后自动暂停，恢复后继续
- [ ] Quota 正确显示 (used/limit)

## 相关 Issues
- #101 Presign URL 集成
- #102 S3 字节流上传验证
- #103 配额 API 云端同步

## 环境配置
```bash
# Lambda URL
echo "VITE_LAMBDA_PRESIGN_URL=..." >> .env.local
```
```

**原则**:
- 保持精简（≤200 行）
- 不包含代码实现细节
- 作为对外沟通和验收的"合同"

## 2. GitHub Issues 层 (Technical Tasks)

**位置**: GitHub Issues 或 `.github/issues/`

**职责**:
- 详细的技术任务描述
- 代码改动范围（哪些文件、哪些函数）
- 关联的测试场景（SC-xxx）
- 技术决策和实现方案
- 讨论记录和变更历史

**格式示例**:
```markdown
## Issue #101: Presign URL 集成

**关联 MVP**: MVP2 - 云端上传验证
**测试场景**: SC-300~303 (Offline Handling)
**优先级**: P1

### 任务描述
修改 `uploadApi.ts`，从 Mock 模式切换到真实 Lambda 调用。

### 实现要点
1. 移除 `isMockingOnline()` 分支
2. 实现真实的 `fetch(PRESIGN_URL)`
3. 使用 Zod 验证响应 (Pillar B)
4. 处理 403/429/500 错误

### 修改文件
- `app/src/02_modules/capture/adapters/uploadApi.ts`
- `app/src/02_modules/capture/services/uploadService.ts`

### 测试验证
- [ ] SC-300: 离线启动，本地功能正常
- [ ] SC-301: 上传中断网，暂停并显示 offline
```

**原则**:
- 一个 Issue 一个技术焦点
- 包含足够的上下文让 AI 独立完成
- 完成后关闭 Issue，归档到 MEMORY.md

## 3. Issue Plans 层 (Session Tracking)

**位置**: `.claude/plans/active/#XXX.md`

**职责**:
- 记录当前正在处理的 Issue 的详细执行计划
- 追踪 Issue 的子任务进度（打勾）
- Issue 完成后移到 `.claude/plans/archive/`

**格式示例**:
```markdown
---
issue: 102
status: in-progress
---

# Issue #102: S3 字节流上传验证

### Steps
- [x] 实现基础 PUT 逻辑
- [x] 添加超时保护
- [ ] **进行中**: 大文件压力测试
- [ ] 写入集成测试

### Related
- Depends on: #101
- Blocks: #103
```

**原则**:
- 一个 Issue 一个计划文件
- 清晰的子任务列表和依赖关系
- Issue 完成后存档，核心决策创建 ADR

## AI 工作流程

### 阶段 1: 规划新的 MVP
1. 创建/更新 `docs/dev/MVP*.md`
2. 在 MVP 文件中列出功能范围
3. 拆解为 GitHub Issues（每个 Issue 一个技术焦点）
4. 在 MVP 文件中添加 Issues 的超链接引用

### 阶段 2: 执行 Session 开发
1. 从 GitHub Issues 中选择一个 Issue
2. 创建 `.claude/plans/active/#XXX.md` 或检查现有计划文件
3. 专注完成这个 Issue，标记子任务进度
4. 完成后在 GitHub 关闭 Issue

### 阶段 3: Session 收尾
1. 将重要的技术决策创建为 ADR（`docs/architecture/ADR/NNN-*.md`）
2. 在 MEMORY.md 中链接新的 ADR
3. 归档完成的计划文件到 `.claude/plans/archive/`
4. 更新 MVP 文件的验收标准（打勾）
5. Commit 代码并关联 Issue ID

## *next 命令 - 智能任务导航

`*next` 命令实现了三级瀑布式任务推荐系统，让 AI 能够自动找到下一个应该执行的任务。

### 执行逻辑

**Level 1: 检查活跃计划文件**
- 如果有 `.claude/plans/active/` 中的计划 → 继续执行下一个子任务
- 如果任务完成 → 提示关闭 Issue，进入 Level 2

**Level 2: 推荐 Issues**
- 从当前 MVP 文件读取未完成的 Issues
- 推荐优先级最高（P1）的 Issue
- 用户确认后，创建新的 `.claude/plans/active/#XXX.md` 计划文件

**Level 3: 推荐 MVP**
- 如果当前 MVP 所有 Issues 都完成 → 检查下一个 MVP
- 推荐下一个未开始的 MVP（MVP1 → MVP2 → MVP3...）
- 提示执行 `*plan` 拆解新的 Issues

### 示例对话

```
用户: *next

AI: 检测到活跃任务：

#101 Presign URL 集成 [进行中]
- [x] 移除 Mock 分支
- [x] 实现真实 fetch
- [ ] Zod 响应验证
- [ ] 错误处理 (403/429/500)

下一步：实现 Zod 响应验证

继续执行吗？(yes/no/switch)
```

详细说明见：`.claude/commands/next.md`

## 维护成本最小化

**单一真相源原则**:
- 技术细节只在 Issues 中维护
- MVP 文件只做索引，不重复描述
- 计划文件是临时的，Issue 完成后存档

**避免三处同步**:
- Issue 完成 → 关闭 Issue（GitHub 自动记录时间）
- MVP 验收 → 在 MVP 文件中打勾
- 计划完成 → 存档计划文件到 `.claude/plans/archive/`

**决策归档**:
- 关键 Bug 的修复 → MEMORY.md
- 架构决策 → docs/architecture/ADR/
- 日常进度 → Git commit message（关联 Issue）

## 示例工作流

假设我们要完成 MVP2：

1. **创建 MVP 文件**:
   ```bash
   # 创建 docs/dev/MVP2_UPLOAD.md
   # 列出目标、验收标准、关联 Issues
   ```

2. **拆解 Issues**:
   ```
   #101 Presign URL 集成
   #102 S3 字节流上传验证
   #103 配额 API 云端同步
   #104 网络状态管理
   #105 指数退避重试
   #106 Presigned URL 过期处理
   #107 Quota Widget UI
   #108 上传状态反馈
   ```

3. **开始 Session**:
   ```markdown
   # .claude/plans/active/2-presign-url-integration.md
   ---
   issue: 101
   status: in-progress
   ---
   
   ## Issue #101: Presign URL 集成
   - [ ] 实现基础逻辑
   - [ ] 添加错误处理
   ```

4. **完成 Issue**:
   - 关闭 GitHub Issue #101
   - 如果有架构决策，创建 ADR 并在 MEMORY.md 中链接
   - 存档计划文件到 `.claude/plans/archive/`
   - Commit: `feat: integrate real presign URL (#101)`

5. **验收 MVP**:
   - 当所有 Issues 完成后
   - 在 MVP2_UPLOAD.md 中打勾验收标准
   - 标记 MVP2 为 [Complete]

## Paths 触发条件

此规则应在以下场景自动加载：
- 处理 `docs/dev/MVP*.md` 文件时
- 处理 `.claude/plans/active/` 文件时
- 开始新的 Session 规划时

## 参考

- GitHub Issues 最佳实践
- ADR 模式 (`docs/architecture/ADR/`)
- Pillar E: Explicit Over Implicit
