# Workflow Templates

> 优化后的模板系统，与 Two-Step Planning 完全契合

## 模板一览

| 模板 | 用途 | 何时使用 | 行数 |
|------|------|----------|------|
| [TEMPLATE-mvp.md](TEMPLATE-mvp.md) | MVP 里程碑规划 | 新 MVP 启动时 | ~80 |
| [TEMPLATE-feature-plan.md](TEMPLATE-feature-plan.md) | Feature 详细规划 | Step 2: 开发前 | ~95 |
| [TEMPLATE-github-issue.md](TEMPLATE-github-issue.md) | GitHub Issue 模板 | Step 1: MVP 分解 | ~60 |
| [TEMPLATE-todo.md](TEMPLATE-todo.md) | Session 任务跟踪 | 每个 Session | ~45 |
| [TEMPLATE-issue-triage.md](TEMPLATE-issue-triage.md) | Issue 分类评估 | 外部 Issue 评估 | ~100 |

---

## 工作流整合

```
┌─────────────────────────────────────────────────────────────────┐
│                    Two-Step Planning Flow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  MVP 启动                                                        │
│  └─→ TEMPLATE-mvp.md                                            │
│       └─→ docs/dev/MVPX_NAME.md                                 │
│                                                                 │
│  Step 1: MVP 分解 (40 min)                                       │
│  └─→ TEMPLATE-github-issue.md                                   │
│       └─→ GitHub Issues #100-#108                               │
│                                                                 │
│  Step 2: Feature 规划 (1-2h per feature)                         │
│  └─→ TEMPLATE-feature-plan.md                                   │
│       └─→ .claude/plans/active/#100-feature.md                  │
│                                                                 │
│  Session 开发 (执行层)                                            │
│  └─→ TEMPLATE-todo.md                                           │
│       └─→ .claude/TODO.md (实时更新进度)                          │
│                                                                 │
│  外部 Issue 评估                                                  │
│  └─→ TEMPLATE-issue-triage.md                                   │
│       └─→ Ready / Needs Clarification / Won't Fix               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 使用场景

### 场景 1: 启动新 MVP

```bash
# 1. 复制 MVP 模板
cp TEMPLATE-mvp.md ../../docs/dev/MVP4_AUTH.md

# 2. 填写目标、功能范围、架构图
# 3. 执行 Step 1 分解为 Issues
```

### 场景 2: Step 1 - MVP 分解 (40 min)

```bash
# 1. 阅读 MVP 文件，理解功能范围
# 2. 用 TEMPLATE-github-issue.md 在 GitHub 创建 Issues
# 3. 设置依赖关系和 Labels
# 4. 在 MVP 文件中记录 Issue 列表
```

### 场景 3: Step 2 - Feature 规划 (1-2h)

```bash
# 1. 选择要开发的 Issue
# 2. 复制 Feature Plan 模板
cp TEMPLATE-feature-plan.md ../../plans/active/#100-auth-login.md

# 3. 完成详细规划（实现方案、测试用例、风险）
# 4. 在 GitHub Issue 中添加 Plan 链接
# 5. 开始开发
```

### 场景 4: 评估外部 Issue

```bash
# 1. 复制 Triage 模板
cp TEMPLATE-issue-triage.md ../../plans/active/#99-triage.md

# 2. 评估 Issue 类型、复杂度
# 3. 做出决定：Ready / Needs Clarification / Won't Fix
# 4. 执行相应 Action Items
```

---

## 模板关系图（军事类比）

```
战略 (Strategy) - 整体方向
───────────────────────────
TEMPLATE-mvp.md
├── 定义目标和功能范围
├── 包含 Issues 列表 (Step 1 输出)
└── 存储: docs/dev/MVPX.md

战役 (Campaign) - 达成目标的系列任务
───────────────────────────
TEMPLATE-github-issue.md
├── Step 1 创建轻量 Issue
├── 包含概要、验收标准
└── 存储: GitHub Issues

TEMPLATE-feature-plan.md
├── Step 2 详细规划
├── 包含实现方案、测试用例
└── 存储: plans/active/#xxx.md

战术 (Tactics) - 当前执行的动作
───────────────────────────
TEMPLATE-todo.md
├── Session 任务跟踪
├── 从 Feature Plan 复制子任务
├── 实时更新进度
└── 存储: .claude/TODO.md

辅助
───────────────────────────
TEMPLATE-issue-triage.md
├── 外部 Issue 评估
└── 决定是否进入 Planning
```

---

## 文件存储位置

| 层级 | 内容 | 位置 |
|------|------|------|
| 战略 | MVP 文档 | `docs/dev/MVPX_NAME.md` |
| 战役 | GitHub Issues | GitHub 仓库 |
| 战役 | Feature Plans (活跃) | `.claude/plans/active/#xxx-name.md` |
| 战役 | Feature Plans (归档) | `.claude/plans/archive/#xxx-name.md` |
| 战术 | Session Tasks | `.claude/TODO.md` |
| 辅助 | Issue Triage | `.claude/plans/active/#xxx-triage.md` |

---

## 模板设计原则

1. **精简优先**: 每个模板 < 100 行
2. **单一职责**: 一个模板解决一个问题
3. **流程契合**: 与 Two-Step Planning 对齐
4. **渐进详细**: Step 1 轻量 → Step 2 详细

---

## 参考

- [planning.md](../planning.md) - Two-Step Planning 概述
- [planning-mvp.md](../planning-mvp.md) - Step 1 详细指南
- [planning-feature.md](../planning-feature.md) - Step 2 详细指南
- [../../plans/README.md](../../plans/README.md) - Plans 目录说明
