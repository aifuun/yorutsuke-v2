# Feature Plan: Template System Integration

> **Step 2 of Two-Step Planning** - 在开发前完成详细规划

| 项目 | 值 |
|------|-----|
| Issue | TBD (需创建 GitHub Issue) |
| MVP | Workflow Optimization |
| 复杂度 | T2 (Logic) |
| 预估 | 4h |
| 状态 | [x] 规划 / [ ] 开发中 / [ ] Review / [ ] 完成 |

---

## 1. 目标

**做什么**: 将优化后的模板系统（5个模板）集成到 Claude Code 的自动加载和命令系统中

**为什么**:
- **用户价值**: 自动提示相关模板，减少查找成本
- **开发价值**: 规范化工作流，提升 AI 辅助效率
- **技术价值**: 验证三层架构（战略-战役-战术）的实用性

**验收标准**:
- [ ] 编辑 MVP 文件时自动提示相关模板
- [ ] 编辑 Feature Plan 时自动提示工作流指南
- [ ] 编辑 TODO.md 时自动提示结构模板
- [ ] `*plan` 命令显示可用模板列表
- [ ] `*next` 命令集成模板推荐逻辑
- [ ] `*issue pick` 提示创建 feature plan
- [ ] 导航文件有明显的模板系统入口
- [ ] 所有 5 个验证测试通过

---

## 2. 实现方案

### 改动范围

| 文件 | 类型 | 改动 |
|------|------|------|
| `.claude/rules/planning-context.md` | 新增 | 自动加载规则（paths: MVP + plans） |
| `.claude/rules/workflow.md` | 修改 | 添加 paths: TODO.md |
| `.claude/commands/plan.md` | 修改 | 添加 "Templates Available" 部分 |
| `.claude/commands/next.md` | 修改 | 添加 "Template Integration" 部分 |
| `.claude/commands/issue.md` | 修改 | 添加 "Issue Planning Templates" 部分 |
| `.claude/README.md` | 修改 | 添加 "📋 Template System (Quick Start)" |
| `CLAUDE.md` | 修改 | 添加 "Templates & Planning" 表格 |
| `.claude/WORKFLOW.md` | 修改 | 添加 "📋 Template System Integration" |

### 实现步骤

**Phase 1: Auto-Loading Rules** (~1.5h)
- [ ] 创建 `.claude/rules/planning-context.md`
  - [ ] 添加 YAML frontmatter (paths: MVP + plans)
  - [ ] 编写 MVP 文件上下文说明
  - [ ] 编写 Feature Plan 上下文说明
  - [ ] 引用 Two-Step Planning 流程
- [ ] 更新 `.claude/rules/workflow.md`
  - [ ] 添加 `paths: .claude/TODO.md`
  - [ ] 添加 TODO.md 模板引用
  - [ ] 添加战术层说明

**Phase 2: Command Integration** (~1.5h)
- [ ] 更新 `.claude/commands/plan.md`
  - [ ] 添加 "Templates Available" section
  - [ ] 列出 MVP/Feature/Issue 模板
  - [ ] 添加使用示例
- [ ] 更新 `.claude/commands/next.md`
  - [ ] 添加 "Template Integration" section
  - [ ] Level 1: TODO 模板提示逻辑
  - [ ] Level 2: Feature plan 检查逻辑
  - [ ] Level 3: MVP 模板引用
- [ ] 更新 `.claude/commands/issue.md`
  - [ ] `*issue pick`: Feature plan 创建提示
  - [ ] `*issue new`: GitHub Issue 模板引用
  - [ ] `*issue close`: Plan 归档说明

**Phase 3: Navigation Enhancement** (~1h)
- [ ] 更新 `.claude/README.md`
  - [ ] 添加 "📋 Template System (Quick Start)" section
  - [ ] "I need to..." 格式列出 5 个模板
  - [ ] 链接到 templates/README.md
- [ ] 更新 `CLAUDE.md`
  - [ ] 在 "Workflow" section 添加 "Templates & Planning" 表格
  - [ ] 列出模板与命令的对应关系
- [ ] 更新 `.claude/WORKFLOW.md`
  - [ ] 添加 "📋 Template System Integration" section
  - [ ] 表格展示工作流 → 模板 → 输出位置

---

## 3. 测试用例

### 场景测试

| ID | 场景 | 预期 |
|----|------|------|
| IT-001 | 编辑 `docs/dev/MVP3_BATCH.md` | Claude 提示: "You are working on MVP planning. Template: TEMPLATE-mvp.md" |
| IT-002 | 编辑 `.claude/plans/active/xxx.md` | Claude 提示: "Feature planning context loaded. Template: TEMPLATE-feature-plan.md" |
| IT-003 | 编辑 `.claude/TODO.md` | Claude 提示: "Use templates/TEMPLATE-todo.md for structure" |
| IT-004 | 运行 `*plan` | 显示 "Templates Available" section 包含 3 个模板 |
| IT-005 | 运行 `*next` (TODO.md 为空) | 提示: "Copy templates/TEMPLATE-todo.md" |
| IT-006 | 运行 `*issue pick 100` (无 feature plan) | 提示: "Create feature plan? templates/TEMPLATE-feature-plan.md" |
| IT-007 | 查看 `.claude/README.md` | 看到 "📋 Template System (Quick Start)" section |
| IT-008 | 查看 `CLAUDE.md` | 看到 "Templates & Planning" 表格 |

### 手动验证

| 验证点 | 方法 | 通过标准 |
|--------|------|----------|
| Auto-loading 触发 | 用 VS Code 打开 MVP 文件 | Claude 自动提示模板 |
| Command 引用正确 | 运行所有 3 个更新的命令 | 显示模板引用 section |
| 导航可达性 | 从 CLAUDE.md 导航到模板 | 3 跳内到达模板文件 |
| 模板路径正确 | 检查所有文件路径 | 无 404，所有路径可用 |

---

## 4. 风险 & 依赖

**风险**:
| 风险 | 级别 | 应对 |
|------|------|------|
| Rules 不自动加载 | 中 | 测试 paths frontmatter，必要时手动触发 |
| 导航链路复杂 | 低 | 简化到 3 跳内，添加 quick reference |
| 模板路径引用错误 | 中 | 统一使用相对路径，验证所有链接 |
| 用户学习成本高 | 中 | 提供 Quick Start，渐进式引导 |

**依赖**:
- [ ] 前置: 模板系统已创建完成（已完成 ✅）
- [ ] 前置: Three-layer 架构已定义（已完成 ✅）
- [ ] 工具: Claude Code 的 paths frontmatter 功能
- [ ] 工具: Markdown 文件编辑

---

## 5. 进度

| 日期 | 状态 | 备注 |
|------|------|------|
| 2026-01-09 | 规划完成 | 使用 TEMPLATE-feature-plan.md 创建 |
| | 待开始 | 等待用户批准 |

---

## 附录：文件内容示例

### 示例 1: `.claude/rules/planning-context.md`

```markdown
---
paths:
  - docs/dev/MVP*.md
  - .claude/plans/active/*.md
---

# Planning Context

You are working on planning documents. Relevant templates and workflows:

## MVP Files (docs/dev/MVP*.md)

**Template**: `.claude/workflow/templates/TEMPLATE-mvp.md`
**Workflow**: `.claude/workflow/planning-mvp.md` (Step 1: 40 min)
**Process**: MVP decomposition → GitHub Issues

**Key principles**:
- Define goals and acceptance criteria
- List features with rough sizing
- Create dependency graph
- Generate GitHub Issues

## Feature Plans (.claude/plans/active/*.md)

**Template**: `.claude/workflow/templates/TEMPLATE-feature-plan.md`
**Workflow**: `.claude/workflow/planning-feature.md` (Step 2: 1-2h)
**Process**: Detailed implementation plan → Ready to code

**Key principles**:
- Detailed implementation steps
- Test cases with coverage
- Risk assessment
- Created WHEN needed (just-in-time)

## Architecture

战略 (Strategy) → MVP 文件 → 整体方向
战役 (Campaign) → Feature Plans → 达成目标的系列任务
战术 (Tactics) → TODO.md → 当前执行的动作
```

### 示例 2: `.claude/commands/plan.md` 更新

在现有内容后添加：

```markdown
## Templates Available

When creating a plan, use the appropriate template:

### MVP Planning
**Template**: `.claude/workflow/templates/TEMPLATE-mvp.md`
- **Copy to**: `docs/dev/MVPX_NAME.md`
- **See**: `workflow/planning-mvp.md` for Step 1 guidance (40 min)
- **Process**: Analyze goal → Identify features → Create Issues

### Feature Planning
**Template**: `.claude/workflow/templates/TEMPLATE-feature-plan.md`
- **Copy to**: `.claude/plans/active/#xxx-name.md`
- **See**: `workflow/planning-feature.md` for Step 2 guidance (1-2h)
- **Process**: Detailed plan → Test cases → Ready to code

### Issue Creation
**Template**: `.claude/workflow/templates/TEMPLATE-github-issue.md`
- **Use during**: Step 1 MVP decomposition
- **Format**: Lightweight Issue with links to detailed plan

## Workflow

1. **Determine plan type**: MVP-level or Feature-level?
2. **Copy appropriate template**
3. **Follow guidance** from workflow files
4. **Execute** two-step planning process
```

### 示例 3: `.claude/README.md` 更新

在 "Quick Navigation" section 后添加：

```markdown
## 📋 Template System (Quick Start)

### I need to...

**Plan a new MVP**
→ Copy: `workflow/templates/TEMPLATE-mvp.md`
→ Save to: `docs/dev/MVPX_NAME.md`
→ Guide: `workflow/planning-mvp.md` (Step 1: 40 min)

**Plan a feature (Step 2)**
→ Copy: `workflow/templates/TEMPLATE-feature-plan.md`
→ Save to: `plans/active/#xxx-name.md`
→ Guide: `workflow/planning-feature.md` (1-2h)

**Create GitHub Issues (Step 1)**
→ Use: `workflow/templates/TEMPLATE-github-issue.md`
→ Guide: `workflow/planning-mvp.md`

**Track session tasks**
→ Use: `workflow/templates/TEMPLATE-todo.md`
→ Update: `TODO.md` during session

**Triage external issue**
→ Copy: `workflow/templates/TEMPLATE-issue-triage.md`
→ Save to: `plans/active/#xxx-triage.md`

**See all templates**: `workflow/templates/README.md`
```

---

*开发前确认*:
- [x] 方案已确认，无 open questions
- [x] 依赖已就绪（模板已创建）
- [x] 测试用例覆盖完整（8 个场景测试）
