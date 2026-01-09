# GitHub Issue Template

> **Step 1 输出** - MVP 分解时创建，Step 2 时补充详细 Plan

---

## Issue 标题格式

```
[MVP3] feat: implement batch-orchestrator Lambda
[MVP3] fix: presign URL expiry handling
[MVP3] refactor: extract upload service
```

---

## Issue Body (复制到 GitHub)

```markdown
## 概要

[一句话说明做什么]

**关联**: MVP[X] | 复杂度: T[1/2/3] | 预估: Xh

## 背景

[为什么要做这个？解决什么问题？]

## 验收标准

- [ ] 标准1
- [ ] 标准2
- [ ] 测试场景 SC/SB-xxx 通过

## 技术要点

- 改动文件: `path/file.ts`
- 依赖: #xxx (blocked by)
- 注意: [特殊注意事项]

## 测试场景

| ID | 场景 | 预期 |
|----|------|------|
| SC-xxx | 描述 | 预期 |

---

**详细规划**: `.claude/plans/active/#xxx-feature-name.md` (Step 2 补充)
```

---

## Labels 建议

| Label | 用途 |
|-------|------|
| `mvp3` | 关联 MVP |
| `tier:T2` | 复杂度 |
| `backend` / `frontend` | 领域 |
| `blocked` | 有依赖未完成 |
| `ready` | 可以开始开发 |

---

## 使用流程

**Step 1 (MVP 分解, 40min)**:
1. 用此模板创建 GitHub Issue
2. 填写概要、背景、验收标准
3. 设置 Labels 和依赖关系

**Step 2 (Feature 规划, 1-2h)**:
1. 创建 `.claude/plans/active/#xxx-feature-name.md`
2. 使用 `TEMPLATE-feature-plan.md`
3. 在 Issue 中添加链接
4. 移除 `blocked` 添加 `ready`

**开发完成后**:
1. 关闭 Issue
2. 移动 plan 到 `plans/archive/`
