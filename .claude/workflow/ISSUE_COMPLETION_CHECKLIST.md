# Issue Completion Checklist

> **使用场景**: 完成任何 feature/bugfix issue 后，提交 PR 前的最终检查
> **时间**: 5-10 分钟快速过一遍
> **目的**: 确保符合项目架构规范，防止遗漏关键步骤

---

## 1. 架构合规性 (ADRs)

### 如果修改了任何模块 (Auth/Settings/Capture/Transaction/Debug/Sync)

- [ ] **ADR-001 (Service Pattern)**:
  - 全局监听器使用 Service（不用 React hooks）？
  - Service 在 `00_kernel/bootstrap.ts` 中初始化？
  - Service 拥有 vanilla Zustand store？

- [ ] **ADR-012 (Selector Safety)**:
  - Zustand selectors 返回 primitives（`string`, `boolean`, `null`）？
  - 不返回 object literals（`{a: s.a, b: s.b}`）？
  - 查看 selector 定义（通常在 `stores/xxxStore.ts` 的 `xxxSelectors`）

- [ ] **ADR-020 (Hook Bridge Layer)**:
  - Hooks 符合三个身份之一？
    - **Connector**: `useStore(store, selector)` 连接 vanilla store
    - **Selector**: `useXxxStatus()` 暴露单个 primitive
    - **Orchestrator**: `useXxxActions()` 返回 actions object
  - Hooks 文件在 `hooks/`，不在 `headless/`？

### 如果创建了新模块

- [ ] **4-Layer Architecture**:
  - Layer 0: `stores/` - Vanilla Zustand store with FSM
  - Layer 1: `services/` - Business logic orchestrator
  - Layer 1.5: `hooks/` - React bridges (ADR-020)
  - Layer 2: `views/` - Pure JSX components

- [ ] **Module Exports** (`index.ts`):
  - Exports stores: `export { xxxStore, xxxSelectors, type XxxState }`
  - Exports services: `export { xxxService }`
  - Exports hooks: `export { useXxxState, useXxxActions }`
  - Exports views: `export { XxxView }`
  - Exports types: `export type { ... }`

- [ ] **Bootstrap Integration**:
  - Service 在 `00_kernel/bootstrap.ts` 中初始化？
  - 初始化顺序正确（dependencies first）？

### 如果使用状态机 (FSM)

- [ ] **Pillar D (FSM)**:
  - 使用 discriminated union: `status: 'idle' | 'loading' | 'success' | 'error'`
  - 不使用 boolean flags: `isLoading`, `hasError`
  - 状态转换清晰、完整（覆盖所有 edge cases）

### 如果创建了 Headless Logic

- [ ] **Pillar L (Headless)**:
  - 业务逻辑在 `hooks/useXxxLogic.ts`
  - JSX 在 `views/XxxView.tsx`
  - Hook 不包含 JSX 元素
  - View 不包含业务逻辑（只调用 actions）

---

## 2. 代码质量 (Pillars)

### Type Safety

- [ ] **Pillar A (Nominal Typing)**:
  - Domain IDs 使用 Branded Types: `UserId`, `TransactionId`, `ImageId`
  - 不使用 primitive `string` for IDs

- [ ] **Pillar B (Airlock Validation)**:
  - 外部数据用 Zod schema 验证（API responses, IPC, Lambda）
  - Schema 定义在 `types.ts` 或独立 `schemas.ts`
  - 验证在边界层（adapters）

### Observability & Error Handling

- [ ] **Pillar N (Context Propagation)**:
  - 异步操作传递 `traceId`
  - TraceId 生成：`crypto.randomUUID()` or `Date.now().toString(36)`
  - Lambda/API calls 包含 traceId

- [ ] **Pillar R (Observability)**:
  - 使用 semantic JSON logs: `logger.info('EVENT_NAME', { data })`
  - 不使用 `console.log()`
  - Event names 大写、snake_case
  - 包含 traceId, userId 等上下文

### Secrets & Configuration

- [ ] **ADR-013 (Secrets Management)**:
  - 不硬编码 API keys/credentials
  - 使用环境变量: `process.env.XXX_API_KEY`
  - CDK: Conditional inclusion `...(key && { KEY: key })`

---

## 3. UI/UX (Design System)

### 如果创建了新 UI 组件

- [ ] **Design Tokens**:
  - 使用 CSS variables: `var(--space-4)`, `var(--color-primary)`
  - 不硬编码: `padding: 16px`, `color: #3b82f6`
  - Spacing: `--space-1` to `--space-12`
  - Colors: Semantic tokens (`--color-income`, `--bg-card`)
  - Shadows: `--shadow-1` to `--shadow-4`
  - Radius: `--radius-xs` to `--radius-full`

- [ ] **Design Specs Compliance**:
  - 查看相关设计文档: `docs/design/`
    - Buttons: `BUTTONS.md` + `BUTTON_ACTIONS.md`
    - Forms: `FORMS.md`
    - Feedback: `FEEDBACK.md`
    - States: `STATES.md`
  - 复制结构（不自创）

- [ ] **Accessibility (WCAG 2.1 AA/AAA)**:
  - ARIA labels: `aria-label`, `aria-labelledby`
  - Keyboard navigation: Tab, Enter, Escape
  - Focus states: `outline: 2px solid var(--color-primary)`
  - Color contrast: 4.5:1 (text), 3:1 (UI components)
  - Reduced motion: `@media (prefers-reduced-motion: reduce)`

- [ ] **Responsive Design**:
  - Mobile (< 768px) tested
  - Tablet (768px - 1024px) tested
  - Desktop (> 1024px) tested
  - Touch targets: minimum 44×44px on mobile

---

## 4. 测试覆盖

### Unit Tests

- [ ] **Stores** (`stores/*.test.ts`):
  - FSM state transitions
  - Primitive selectors return correct types
  - Store subscription behavior
  - 示例: `authStore.test.ts` (16 tests)

- [ ] **Services** (`services/*.test.ts`):
  - Business logic with mocked adapters
  - Error handling
  - State transitions via store updates
  - 示例: `authStateService.test.ts` (15 tests)

### Integration Tests

- [ ] **Full Flow** (`*.integration.test.ts`):
  - Service → Store → Hooks 端到端验证
  - Mock ONLY external boundaries (API, IPC, eventBus)
  - Use REAL store, service, hooks
  - 示例: `auth.integration.test.ts` (8 tests)

### Test Execution

- [ ] All tests passing: `npm run test`
- [ ] Coverage acceptable (>70% for critical modules)
- [ ] No skipped tests without reason

---

## 5. 文档更新

### Architecture Decision Records (ADRs)

- [ ] **创建 ADR** (如果满足条件):
  - 条件: 重要架构决策，影响多个模块
  - 文件: `docs/architecture/ADR/NNN-title.md`
  - 格式: Status, Context, Decision, Consequences
  - 链接: 添加到 `.claude/MEMORY.md` 的 ADR section

### Schema Documentation

- [ ] **更新 SCHEMA.md** (如果修改了):
  - 新 domain entities
  - API 响应格式
  - Database schema
  - Event formats

### Feature Plans

- [ ] **归档 Feature Plan**:
  - 移动: `.claude/plans/active/#N-*.md` → `.claude/plans/archive/`
  - 保留记录以备查

---

## 6. Git Workflow

### Branch & Commits

- [ ] **Branch Naming**:
  - Format: `feature/N-short-description` or `fix/N-short-description`
  - Example: `feature/168-complete-auth-architecture`

- [ ] **Commit Messages**:
  - Format: `type: description (#issue)`
  - Types: `feat`, `fix`, `test`, `refactor`, `chore`, `docs`
  - Example: `feat: complete Auth module 4-layer architecture (#168)`
  - Include: `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`

### Pull Request

- [ ] **Target Branch**: PR 目标是 `development`（**不是 `master`**）

- [ ] **PR Description Complete**:
  ```markdown
  ## Summary
  Closes #N

  Brief description of changes

  ## Implementation
  - Key change 1
  - Key change 2

  ## Testing
  - ✅ All tests passing (X/X)
  - ✅ Lint clean
  - ✅ Build successful

  ## Documentation
  - Updated XXX.md

  ## Breaking Changes
  None / List breaking changes

  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  ```

- [ ] **No Merge Conflicts** with `development`

---

## 7. 清理工作

### Code Hygiene

- [ ] 删除临时文件/注释
- [ ] 删除 `console.log()` debug 语句
- [ ] 删除注释掉的代码
- [ ] 更新/删除 TODO comments
- [ ] 移除未使用的 imports
- [ ] 移除未使用的变量

### File Organization

- [ ] 没有孤立文件在错误位置
- [ ] 所有测试文件命名正确: `*.test.ts`, `*.integration.test.ts`
- [ ] 所有组件导出通过 `index.ts`

---

## 8. 快速自检命令

```bash
# 1. 测试通过
npm run test

# 2. Lint 通过
npm run lint

# 3. TypeScript 编译通过
npm run type-check

# 4. 构建成功
npm run build

# 5. Git 状态干净
git status

# 6. Commit history 整洁
git log --oneline -10

# 7. 查看将要提交的文件
git diff development...HEAD --name-only
```

---

## 9. Issue-Specific Checks

### Feature Issues

- [ ] 所有 acceptance criteria 满足？
- [ ] Feature plan 中的所有步骤完成？
- [ ] 用户可见功能已手动测试？

### Bug Fixes

- [ ] Bug 能够复现（before fix）？
- [ ] Bug 不再出现（after fix）？
- [ ] 添加 regression test 防止再次出现？

### Refactoring

- [ ] 功能行为不变（no breaking changes）？
- [ ] 所有测试仍然通过？
- [ ] 性能没有明显下降？

---

## 快速检查清单（1 分钟版）

如果时间紧张，至少检查这些：

```
✅ Tests passing
✅ No console.log
✅ No hardcoded secrets
✅ Design tokens used (if UI)
✅ Primitive selectors (if Zustand)
✅ PR targets development
✅ Commit message format correct
```

---

## 相关文档

| 文档 | 用途 |
|------|------|
| `.prot/checklists/post-code.md` | 通用 Pillars 检查 |
| `docs/architecture/ADR/` | 架构决策记录 |
| `docs/design/` | Design system 规范 |
| `.claude/rules/design-system.md` | Design system 集成规则 |
| `TEST.md` | 测试指南 |

---

**Version**: 1.0
**Last Updated**: 2026-01-28
**Based on**: Issue #168 实践经验
