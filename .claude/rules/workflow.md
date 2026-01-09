---
paths:
  - .claude/TODO.md
---

# Workflow Rule - MVP, Issues, TODO 协同机制

> **详细指南**: `.claude/WORKFLOW.md` (index & cheatsheet)
> **Two-Step Planning**: `.claude/workflow/planning.md`

## TODO.md 战术层 (Tactics)

当你编辑 `.claude/TODO.md` 时，请使用模板结构：

**Template**: `.claude/workflow/templates/TEMPLATE-todo.md`

**关键原则**:
- 只跟踪当前 Session 的 1-3 个活跃 Issue
- 从 Feature Plan 复制子任务到 TODO
- 实时更新进度（打勾）
- Session 结束后清理，重要决策归档到 MEMORY.md

**结构**:
```markdown
## Current Session
### Active Issue: #xxx [Title]
**状态**: 开发中 | Plan: `plans/active/#xxx.md`
- [x] 完成的步骤
- [ ] **正在做** ← 当前
- [ ] 下一步
```

## 核心原则

**以 Issues 为核心的三层工作流**：

```
MVP 文件 (路标)  →  GitHub Issues (施工图)  →  TODO.md (今日清单)
     ↓                    ↓                         ↓
  目标/验收           技术任务/实现细节        Session 活跃任务
```

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

## 3. TODO.md 层 (Session Tracking)

**位置**: `.claude/TODO.md`

**职责**:
- 记录当前 Session 正在处理的 1-3 个 Issue
- Session 的进度追踪（子任务打勾）
- Session 结束后归档

**格式示例**:
```markdown
## Current Session [2026-01-07]

### Active Issues
- [x] #101 Presign URL 集成 (已完成)
- [ ] #102 S3 字节流上传验证 (进行中...)
  - [x] 实现基础 PUT 逻辑
  - [x] 添加超时保护
  - [ ] 大文件压力测试
- [ ] #103 配额 API 云端同步 (待开始)

### Next Steps
1. 完成 #102 的压力测试
2. 启动 #103 的 Lambda 对接
```

**原则**:
- 极简（只关注"现在"）
- 不是 Issues 的镜像副本
- Session 结束后清空，核心决策归档到 MEMORY.md

## AI 工作流程

### 阶段 1: 规划新的 MVP
1. 创建/更新 `docs/dev/MVP*.md`
2. 在 MVP 文件中列出功能范围
3. 拆解为 GitHub Issues（每个 Issue 一个技术焦点）
4. 在 MVP 文件中添加 Issues 的超链接引用

### 阶段 2: 执行 Session 开发
1. 从 GitHub Issues 中选择 1-3 个活跃任务
2. 在 TODO.md 中记录当前 Session 的活跃 Issue
3. 专注完成这些 Issue，标记子任务进度
4. 完成后在 GitHub 关闭 Issue

### 阶段 3: Session 收尾
1. 将重要的技术决策归档到 MEMORY.md
2. 更新 MVP 文件的验收标准（打勾）
3. 清空 TODO.md 的 Active Issues 部分
4. Commit 代码并关联 Issue ID

## *next 命令 - 智能任务导航

`*next` 命令实现了三级瀑布式任务推荐系统，让 AI 能够自动找到下一个应该执行的任务。

### 执行逻辑

**Level 1: 检查 TODO.md**
- 如果有活跃任务 → 继续执行下一个子任务
- 如果任务完成 → 提示关闭 Issue，进入 Level 2

**Level 2: 推荐 Issues**
- 从当前 MVP 文件读取未完成的 Issues
- 推荐优先级最高（P1）的 Issue
- 用户确认后，在 TODO.md 创建新的活跃任务

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
- TODO.md 是临时的，不是持久化存储

**避免三处同步**:
- Issue 完成 → 关闭 Issue（GitHub 自动记录时间）
- MVP 验收 → 在 MVP 文件中打勾
- Session 结束 → 清空 TODO.md

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
   # TODO.md
   ## Current Session
   - [ ] #101 Presign URL 集成 (进行中)
   ```

4. **完成 Issue**:
   - 关闭 GitHub Issue #101
   - 更新 MEMORY.md（如果有架构决策）
   - Commit: `feat: integrate real presign URL (#101)`

5. **验收 MVP**:
   - 当所有 Issues 完成后
   - 在 MVP2_UPLOAD.md 中打勾验收标准
   - 标记 MVP2 为 [Complete]

## Paths 触发条件

此规则应在以下场景自动加载：
- 处理 `docs/dev/MVP*.md` 文件时
- 处理 `.claude/TODO.md` 文件时
- 开始新的 Session 规划时

## 参考

- 原 TODO.md 结构（已归档为参考）
- GitHub Issues 最佳实践
- Pillar E: Explicit Over Implicit
