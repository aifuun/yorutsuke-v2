# Lambda TypeScript ESM 规则

> 一次性配置已完成。新增 Lambda 函数时遵循此模式即可。

## 核心规则

### 1. TypeScript 源码：使用 `.js` 扩展名

```typescript
// ✅ 正确 - TypeScript ESM 约定
import { logger } from './logger.js';
import { schema } from './schema.js';
```

**原因**：TypeScript ESM 规范要求源码中写 `.js`（Node.js 加载时的实际扩展名）

### 2. 编译输出：自动转换为 `.mjs`

编译后自动变成：
```javascript
import { logger } from './logger.mjs';  // ✅ esbuild plugin 自动重写
```

**机制**：`infra/scripts/build-lambdas.mjs` 中的 `rewriteImportsPlugin` 自动处理

### 3. 部署：使用编译后的代码

```bash
# ✅ 正确流程
npm run build:lambdas              # 编译到 .lambda-dist/
cd .lambda-dist/shared-layer && zip ...  # 从编译输出打包
aws lambda publish-layer-version ...     # 发布 Layer
```

**错误**：❌ 从 `lambda/shared-layer/` 源码目录打包（会包含 `.ts` 文件）

## 快速检查清单

新增 TypeScript Lambda 时：

- [ ] 源码导入使用 `.js` 扩展名
- [ ] 运行 `npm run build:lambdas` 编译
- [ ] 检查 `.lambda-dist/` 中的导入路径是 `.mjs`
- [ ] 从 `.lambda-dist/` 打包部署（不是源码目录）

## 故障排查

### 症状：`Cannot find module '/opt/nodejs/shared/xxx.js'`

**原因**：编译输出中的导入路径仍然是 `.js`

**检查**：
```bash
# 查看编译后的导入语句
grep "from.*\.js" infra/.lambda-dist/shared-layer/nodejs/shared/*.mjs
```

**修复**：确认 `build-lambdas.mjs` 使用了 `rewriteImportsPlugin`

## 技术细节

| 工具 | 作用 | 限制 |
|------|------|------|
| TypeScript | 编译 `.ts` → `.js` | 不改变导入路径 |
| esbuild `outExtension` | 输出文件改名 `.js` → `.mjs` | 不改变代码内容 |
| esbuild `rewriteImportsPlugin` | 重写代码中的导入路径 | ✅ 完整解决方案 |

## 相关文档

- **Build Script**: `infra/scripts/build-lambdas.mjs`
- **Issue**: #179 - Lambda Layer module loading fix
- **PR**: #182

---

**一句话总结**：TypeScript 源码写 `.js`，esbuild plugin 自动转 `.mjs`，从 `.lambda-dist/` 部署。
