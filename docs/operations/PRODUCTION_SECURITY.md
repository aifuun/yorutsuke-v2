# Production Security - Debug Panel

## 自动禁用机制

Debug panel 在 production builds 中**自动禁用**，无需手动配置。

---

## 🔒 3 层安全保障

### Layer 1: 编译时强制禁用（主保护）

**位置**: `app/src/00_kernel/config/debug.ts:18-22`

```typescript
export function isDebugEnabled(): boolean {
  if (import.meta.env.PROD) {
    return false;  // 🔒 Production 永远返回 false
  }
  return import.meta.env.VITE_DEBUG_PANEL === 'true';
}
```

**保障**：
- Vite 编译时优化为 `return false;`（死代码消除）
- 即使 `.env` 中有 `VITE_DEBUG_PANEL=true`，也会被忽略
- Production bundle 中不包含环境变量检查逻辑

---

### Layer 2: 组件级 Tree-shaking

**位置**: `app/src/App.tsx:68-72`

```typescript
{IS_DEVELOPMENT && (
  <div className="view-panel">
    <DebugView />  {/* 🌲 Production 时整个分支被移除 */}
  </div>
)}
```

**保障**：
- `IS_DEVELOPMENT = !import.meta.env.PROD`
- Production build 时，条件永远为 `false`
- Rollup/Vite 的 Tree-shaking 会移除整个 `<DebugView />` 代码
- 最终 bundle 中不包含 DebugView 组件

---

### Layer 3: Sidebar 隐藏

**位置**: `app/src/App.tsx:29`

```typescript
const isDebugUnlocked = isDebugEnabled();  // Production = false
```

**保障**：
- Sidebar 不会显示 debug 按钮
- 即使用户尝试手动导航到 `/debug`，也无法访问（组件未渲染）

---

## ✅ 验证步骤

### Quick Check（构建前）

```bash
# 检查当前环境
cd app
node -e "console.log('PROD:', process.env.NODE_ENV === 'production')"

# 确认 vite build 命令存在
npm run build --dry-run
```

### Build & Verify（推荐）

```bash
# 1. 清理旧构建产物
rm -rf app/dist

# 2. Production build
cd app && npm run build

# 3. 检查 bundle 中是否包含 debug 代码
grep -r "DebugView" dist/assets/*.js && echo "❌ FAIL: Debug code found" || echo "✅ PASS: Clean"

# 4. 预览 production build
npm run preview
# 访问 http://localhost:4173 检查是否有 debug 按钮
```

### Full Tauri Build（完整验证）

```bash
# 1. 完整构建
cd app && npm run tauri build

# 2. 运行生成的应用
# macOS
open src-tauri/target/release/bundle/macos/yorutsuke-v2.app

# Windows
./src-tauri/target/release/yorutsuke-v2.exe

# Linux
./src-tauri/target/release/yorutsuke-v2

# 3. 检查 Sidebar 是否有 Debug 选项 → 应该没有
```

### Automated Check（CI/CD）

```bash
# 运行安全验证脚本
cd app && ./scripts/verify-production-security.sh
```

脚本会自动检查：
- ✅ DebugView 组件是否被 tree-shaking 移除
- ✅ VITE_DEBUG_PANEL 引用是否被消除
- ✅ debug-panel 相关 class 是否存在

---

## 🚨 常见误区

### ❌ 错误认知 1：需要在 .env.production 中设置

```bash
# ❌ 不需要这样做
VITE_DEBUG_PANEL=false  # 无效配置
```

**真相**：`import.meta.env.PROD` 检查优先级最高，环境变量会被忽略。

---

### ❌ 错误认知 2：需要手动删除代码

```typescript
// ❌ 不需要手动注释
// {IS_DEVELOPMENT && <DebugView />}
```

**真相**：Vite/Rollup 自动进行 Tree-shaking，无需手动操作。

---

### ❌ 错误认知 3：用户可以通过修改 localStorage 启用

```javascript
// ❌ 无效操作
localStorage.setItem('debug', 'true');
```

**真相**：Debug 配置是编译时确定，运行时无法修改。

---

## 🔍 技术原理

### Vite 的 Production Mode

```bash
# Development mode
npm run tauri dev
→ vite serve
→ import.meta.env.PROD = false
→ import.meta.env.DEV = true

# Production mode
npm run tauri build
→ vite build
→ import.meta.env.PROD = true
→ import.meta.env.DEV = false
```

### 代码优化示例

**开发模式编译结果**：
```javascript
function isDebugEnabled() {
  if (false) {  // import.meta.env.PROD = false
    return false;
  }
  return import.meta.env.VITE_DEBUG_PANEL === 'true';
}
```

**生产模式编译结果**：
```javascript
function isDebugEnabled() {
  return false;  // 死代码消除，整个 if 分支被移除
}
```

### Tree-shaking 原理

**源代码**：
```typescript
{IS_DEVELOPMENT && <DebugView />}
// IS_DEVELOPMENT = !import.meta.env.PROD
```

**Production 编译后**：
```javascript
{false && /* ... */}  // 永远不执行，整个分支被 Rollup 删除
```

---

## 📋 Release Checklist

在发布前执行以下检查：

- [ ] 运行 `npm run build` 无错误
- [ ] 检查 `dist/assets/*.js` 不包含 "DebugView"
- [ ] 运行 `npm run preview` 验证无 debug 按钮
- [ ] （可选）运行 `npm run tauri build` 生成完整应用
- [ ] （可选）在真实设备上测试最终应用

---

## 🎯 结论

**无需任何手动操作，debug panel 在 production builds 中自动禁用。**

- ✅ 编译时强制禁用（Layer 1）
- ✅ 组件代码被 Tree-shaking 移除（Layer 2）
- ✅ UI 按钮不显示（Layer 3）

**安全性**：即使攻击者修改客户端代码，也无法启用 debug panel（代码已被移除）。
