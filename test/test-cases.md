# Workflow Test Cases

> 每个阶段 5 个测试用例，模拟真实开发场景

---

## Phase A: Documentation (docs.md)

### A1: 更新 API 文档
**场景**: 新增了一个 REST endpoint，需要更新 API 文档
**步骤**:
1. `*resume`
2. 打开 `docs/API.md`
3. 添加新 endpoint 描述
4. `*sync`

**预期**: 文档更新完成，无需 tier 分类

---

### A2: 修正 README 错误
**场景**: 用户报告 README 中的安装命令有误
**步骤**:
1. `*issue pick 15` (README 安装命令错误)
2. Quick assessment: NO (纯文本)
3. 修改 README.md
4. `*issue close 15`
5. `*sync`

**预期**: 跳过 tier，直接修复

---

### A3: 创建架构设计文档
**场景**: 新功能需要先写设计文档
**步骤**:
1. `*resume`
2. 创建 `docs/FEATURE-X-DESIGN.md`
3. 使用模板结构
4. `*sync`

**预期**: 文档创建完成

---

### A4: 更新 SCHEMA.md
**场景**: 数据库表结构变更，需要更新 schema 文档
**步骤**:
1. `*issue pick 20` (更新用户表结构)
2. Quick assessment: 这是文档还是代码？
3. 更新 `docs/SCHEMA.md`
4. `*issue close 20`

**预期**: 应区分"文档更新"和"代码更改"

---

### A5: 翻译文档
**场景**: 将英文文档翻译成中文
**步骤**:
1. `*resume`
2. 创建 `docs/zh/README.md`
3. 翻译内容
4. `*sync`

**预期**: 完成翻译

---

## Phase B: Planning (planning.md)

### B1: 大功能分解
**场景**: 收到需求 "实现用户认证系统"
**步骤**:
1. `*issue new "用户认证系统"`
2. 分析需求范围
3. 分解为子 issues:
   - 登录页面 UI
   - JWT token 管理
   - 权限校验中间件
4. 为每个子 issue 创建 GitHub issue

**预期**: 生成多个可追踪的子 issues

---

### B2: 评估技术方案
**场景**: 需要选择状态管理库
**步骤**:
1. `*plan "选择状态管理方案"`
2. 对比 Redux vs Zustand vs Jotai
3. 记录决策到 MEMORY.md
4. 更新 TODO.md

**预期**: 决策被记录，可追溯

---

### B3: Sprint 规划
**场景**: 新 sprint 开始，需要规划工作
**步骤**:
1. `*issue` 查看所有 open issues
2. 按优先级排序
3. 选择本 sprint 目标
4. 更新 milestone

**预期**: Sprint 目标明确

---

### B4: 依赖分析
**场景**: 功能 A 依赖功能 B，需要确定顺序
**步骤**:
1. `*issue 10` 查看功能 A
2. `*issue 11` 查看功能 B
3. 确定依赖关系
4. 调整优先级

**预期**: 依赖关系清晰

---

### B5: 估算复杂度
**场景**: PM 要求估算开发时间
**步骤**:
1. `*issue pick 25`
2. `*tier` 分类
3. 根据 Tier 估算

**预期**: 有基于 Tier 的复杂度参考

---

## Phase C: Development (development.md)

### C1: T1 - 显示用户列表
**场景**: 实现简单的用户列表页面
**步骤**:
1. `*issue pick 30` (显示用户列表)
2. Quick assessment: 只读 → 跳过 tier
3. 创建 `adapters/userApi.ts`
4. 创建 `views/UserListView.tsx`
5. `*issue close 30`

**预期**: T1 模式，View → Adapter

---

### C2: T2 - 购物车功能
**场景**: 实现购物车添加/删除/数量修改
**步骤**:
1. `*issue pick 31` (购物车功能)
2. Quick assessment: 状态管理 → YES
3. `*tier` → T2
4. 创建 `headless/useCartLogic.ts` (Pillar L, D)
5. 创建 `views/CartView.tsx`
6. `*audit d l`
7. `*issue close 31`

**预期**: 使用 FSM，无 boolean flags

---

### C3: T3 - 订单支付
**场景**: 实现 Stripe 支付流程
**步骤**:
1. `*issue pick 32` (支付功能)
2. Quick assessment: 支付 → YES
3. `*tier` → T3
4. 创建 `workflows/checkoutSaga.ts`
5. 实现:
   - Idempotency barrier (Pillar Q)
   - Optimistic lock (Pillar F)
   - Compensation (Pillar M)
6. `*audit q m`
7. `*review`
8. `*issue close 32`

**预期**: 完整 T3 Saga 模式

---

### C4: 修复 Bug - 表单提交
**场景**: 用户报告表单重复提交
**步骤**:
1. `*issue pick 33` (表单重复提交)
2. Quick assessment: 数据写入 → YES
3. `*tier` → T2 或 T3?
4. 分析问题原因
5. 添加 loading 状态 (Pillar D)
6. `*issue close 33`

**预期**: 正确识别需要 FSM

---

### C5: 重构 - 拆分大组件
**场景**: 一个 500 行的组件需要拆分
**步骤**:
1. `*issue pick 34` (重构 UserProfile)
2. Quick assessment: 无状态变更 → NO?
3. 拆分为:
   - `headless/useUserProfile.ts`
   - `views/UserProfileView.tsx`
4. `*audit l i`
5. `*issue close 34`

**预期**: 遵循 Pillar L (Headless)

---

## Phase D: Release (release.md)

### D1: Patch 发布
**场景**: 修复了 3 个 bug，发布 patch 版本
**步骤**:
1. `*release patch`
2. 检查 pre-release checklist
3. 更新 CHANGELOG
4. Tag & push
5. npm publish

**预期**: 0.1.0 → 0.1.1

---

### D2: Minor 发布
**场景**: 完成了新功能，发布 minor 版本
**步骤**:
1. 确认所有 milestone issues 关闭
2. `*release minor`
3. 更新 CHANGELOG (Added section)
4. 创建 GitHub release

**预期**: 0.1.1 → 0.2.0

---

### D3: Major 发布
**场景**: Breaking changes，发布 major 版本
**步骤**:
1. 确认 breaking changes 文档
2. `*release major`
3. 更新 CHANGELOG (Breaking section)
4. 通知用户迁移指南

**预期**: 0.2.0 → 1.0.0

---

### D4: CDK 部署
**场景**: 新功能需要部署基础设施
**步骤**:
1. `*cdk diff` 预览变更
2. Review 变更
3. `*cdk deploy`
4. 验证部署

**预期**: 基础设施更新成功

---

### D5: Hotfix 发布
**场景**: 生产环境紧急 bug
**步骤**:
1. 从 main 创建 hotfix 分支
2. 修复 bug
3. `*release patch`
4. 合并回 main
5. 立即部署

**预期**: 快速修复流程

---

## Test Execution Log

| Case | 执行结果 | 发现问题 |
|------|---------|---------|
| A1 | ✅ | - |
| A2 | ✅ | - |
| A3 | ✅ | - |
| A4 | ⚠️ | docs.md 缺少"文档与代码联动"场景 |
| A5 | ✅ | - |
| B1 | ✅ | - |
| B2 | ⚠️ | `*plan` 没提到更新 MEMORY.md |
| B3 | ✅ | - |
| B4 | ⚠️ | 依赖分析无具体方法 |
| B5 | ⚠️ | planning.md 仍有 "External IO" 未同步修复 |
| C1 | ⚠️ | 跳过 tier 后，next.md 仍要求 "Check Tier info" |
| C2 | ✅ | - |
| C3 | ✅ | - |
| C4 | ⚠️ | Bug fix 的 tier 分类不明确 |
| C5 | ⚠️ | 重构任务的 tier 判断不明确 |
| D1 | ✅ | - |
| D2 | ✅ | - |
| D3 | ✅ | - |
| D4 | ✅ | - |
| D5 | ⚠️ | 缺少 hotfix 分支工作流 |

---

## 问题汇总

| # | 问题 | 严重性 | 状态 |
|---|------|--------|------|
| 3 | docs.md 缺少"文档与代码联动"场景 | 低 | ✅ 已修复 |
| 4 | planning.md "External IO" 未同步修复 | 中 | ✅ 已修复 |
| 5 | `*plan` 命令未提及更新 MEMORY.md | 低 | ✅ 已修复 |
| 6 | next.md "Check Tier info" 与跳过 tier 冲突 | 中 | ✅ 已修复 |
| 7 | tier.md 缺少 bug fix/refactoring 指导 | 中 | ✅ 已修复 |
| 8 | release.md 缺少 hotfix 流程 | 低 | ✅ 已修复 |

---

## 测试统计

- **总用例**: 20
- **通过**: 12 (60%)
- **警告**: 8 (40%)
- **失败**: 0 (0%)
