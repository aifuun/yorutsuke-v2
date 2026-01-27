# Yorutsuke 硬编码位置完整报告

> 扫描日期: 2026-01-27
> 扫描范围: 全项目（排除 node_modules, target, dist, .git）

---

## 📊 总结

| 类型 | 数量 | 优先级 | 建议 |
|------|------|--------|------|
| **用户可见** | 0 | - | ✅ 已全部通过配置管理 |
| **AWS 资源名** | ~30 | 🟡 Medium | 保持不变（生产环境已部署） |
| **技术标识符** | ~15 | 🟢 Low | 保持不变（用户看不到） |
| **文档/注释** | ~20 | 🟢 Low | 可选更新 |

---

## ✅ 用户可见部分（已完全配置化）

所有用户可见的内容已通过 `product.config.json` 管理：

| 位置 | 配置源 | 状态 |
|------|--------|------|
| 窗口标题 | `productName` | ✅ 已配置化 |
| 侧边栏标题 | `i18n/*.json` (自动同步) | ✅ 已配置化 |
| macOS 菜单 | `productName` | ✅ 已配置化 |
| 应用图标名称 | `productName` | ✅ 已配置化 |

**结论**: ✅ 用户完全看不到 "Yorutsuke" 了！

---

## 🟡 AWS 资源名称（建议保持）

### Infra CDK 代码

**位置**: `infra/bin/infra.ts`, `infra/lib/*.ts`

```typescript
// Stack 名称
new YorutsukeStack(app, `Yorutsuke2Stack-${env}`)
new YorutsukeAdminStack(app, `Yorutsuke2AdminStack-${env}`)

// 资源名称
imageBucketName: `yorutsuke-images-us-${env}-${account}`
transactionsTableName: `yorutsuke-transactions-us-${env}`
quotasTableName: `yorutsuke-quotas-us-${env}`
```

**影响**:
- 🔴 如果改名，AWS 资源会被重新创建
- 🔴 生产数据会丢失
- 🔴 需要数据迁移脚本

**建议**: ⚠️ **保持不变**

**原因**:
1. 生产环境已部署，改名会导致资源重建
2. S3、DynamoDB 数据需要迁移
3. 用户完全看不到这些名称
4. 业界惯例（Twitter 改 X，但 API 仍是 twitter.com）

---

## 🟢 技术标识符（建议保持）

### 1. 数据库文件名

**位置**: `app/src/00_kernel/storage/db.ts`

```typescript
const PRODUCTION_DB = 'sqlite:yorutsuke.db';
const MOCK_DB = 'sqlite:yorutsuke-mock.db';
```

**位置**: `app/src-tauri/src/lib.rs`

```rust
.add_migrations("sqlite:yorutsuke.db", vec![...])
.add_migrations("sqlite:yorutsuke-mock.db", vec![...])
```

**影响**: 用户看不到，文件在应用数据目录内

**建议**: ✅ **保持不变**（避免数据迁移）

---

### 2. localStorage 键名

**位置**: `app/src/01_domains/quota/LocalQuota.ts`

```typescript
const STORAGE_KEY = 'yorutsuke:quota';
```

**影响**: 用户看不到，改名会丢失配额设置

**建议**: ✅ **保持不变**

---

### 3. 日志目录

**位置**: `app/src/00_kernel/telemetry/logger.ts`

```typescript
// ~/.yorutsuke/logs/YYYY-MM-DD.jsonl
```

**位置**: `app/src-tauri/src/lib.rs`

```rust
let legacy_logs = home.join(".yorutsuke").join("logs");
```

**影响**: 用户看不到（隐藏目录）

**建议**: ✅ **保持不变**（历史兼容性）

---

### 4. Rust 库名

**位置**: `app/src-tauri/Cargo.toml`

```toml
[lib]
name = "yorutsuke_v2_lib"
```

**影响**: 仅编译时使用，用户看不到

**建议**:
- 🔄 可选更新为 `recie_lib`
- ✅ 或保持不变（不影响用户）

**如果要改**:
```bash
# 在 sync-product-config.js 中添加
cargoContent = cargoContent.replace(
  /^name = "yorutsuke_v2_lib"$/m,
  'name = "recie_lib"'
);
```

---

### 5. 迁移路径检测

**位置**: `app/src-tauri/src/lib.rs:445-460`

```rust
// Legacy location: data_local_dir/yorutsuke-v2/images/
let legacy_images = base.join("yorutsuke-v2").join("images");

// Legacy location: ~/.yorutsuke/logs/
let legacy_logs = home.join(".yorutsuke").join("logs");
```

**用途**: 一次性数据迁移（从旧位置迁移到新位置）

**建议**: ✅ **保持不变**（历史兼容性）

---

## 🟢 文档和注释（可选更新）

### 1. 代码注释

**位置**: `app/src-tauri/src/lib.rs:11-13`

```rust
/// - macOS: ~/Library/Application Support/com.yorutsuke.app/
/// - Linux: ~/.local/share/com.yorutsuke.app/
/// - Windows: C:\Users\<user>\AppData\Local\com.yorutsuke.app\
```

**建议**: 🔄 可选改为通用描述

```rust
/// - macOS: ~/Library/Application Support/{identifier}/
/// - Linux: ~/.local/share/{identifier}/
/// - Windows: C:\Users\<user>\AppData\Local\{identifier}\
```

---

### 2. 测试文件

**位置**: `app/src/02_modules/debug/adapters/__mocks__/*.ts`

```typescript
s3Url: `https://yorutsuke-diagnostics-dev.s3.us-east-1.amazonaws.com/...`
```

**建议**: ✅ **保持不变**（仅测试代码，不影响用户）

---

### 3. 操作文档

**位置**: `infra/scripts/SYNC-LAYER-GUIDE.md`, `app/DEBUG_MODE.md`, 等

包含示例命令和路径：
```bash
cd /Users/woo/dev/yorutsuke-v2
aws s3 cp ~/test.jpg s3://yorutsuke-images-us-dev/...
```

**建议**: 🔄 可选更新（开发文档，团队内部使用）

---

## 🎯 推荐行动计划

### 立即行动（已完成 ✅）
- [x] 用户可见内容全部配置化
- [x] 窗口标题、侧边栏使用配置
- [x] 翻译文件自动同步

### 短期（可选）
- [ ] 更新代码注释中的路径示例
- [ ] 更新操作文档中的示例命令
- [ ] Rust 库名改为 `recie_lib`

### 长期（不推荐）
- [ ] ❌ 修改 AWS 资源名称（需要数据迁移）
- [ ] ❌ 修改数据库文件名（需要数据迁移）
- [ ] ❌ 修改日志目录（破坏历史兼容性）

---

## 📝 详细位置清单

### TypeScript/JavaScript 文件

| 文件 | 行号 | 内容 | 类型 | 建议 |
|------|------|------|------|------|
| `app/src/01_domains/quota/LocalQuota.ts` | 19 | `'yorutsuke:quota'` | localStorage key | 保持 |
| `app/src/00_kernel/storage/db.ts` | 20 | `'sqlite:yorutsuke.db'` | DB 文件名 | 保持 |
| `app/src/00_kernel/storage/db.ts` | 21 | `'sqlite:yorutsuke-mock.db'` | DB 文件名 | 保持 |
| `app/src/00_kernel/telemetry/logger.ts` | 注释 | `~/.yorutsuke/logs/` | 日志路径 | 保持 |
| `infra/bin/infra.ts` | 多处 | AWS 资源名 | AWS 资源 | 保持 |

### Rust 文件

| 文件 | 行号 | 内容 | 类型 | 建议 |
|------|------|------|------|------|
| `app/src-tauri/Cargo.toml` | 9 | `yorutsuke_v2_lib` | 库名 | 可选改 |
| `app/src-tauri/src/lib.rs` | 11-13 | 路径注释 | 注释 | 可选改 |
| `app/src-tauri/src/lib.rs` | 403 | `sqlite:yorutsuke.db` | DB 文件名 | 保持 |
| `app/src-tauri/src/lib.rs` | 412 | `sqlite:yorutsuke-mock.db` | DB 文件名 | 保持 |
| `app/src-tauri/src/lib.rs` | 448 | `yorutsuke-v2` | 迁移路径 | 保持 |
| `app/src-tauri/src/lib.rs` | 451 | `.yorutsuke` | 迁移路径 | 保持 |

### 配置文件

| 文件 | 内容 | 类型 | 建议 |
|------|------|------|------|
| `infra/package.json` | `yorutsuke-v2-infra` | NPM 包名 | 可选改 |

### 文档文件

| 文件 | 内容 | 建议 |
|------|------|------|
| `infra/scripts/SYNC-LAYER-GUIDE.md` | 示例命令 | 可选更新 |
| `app/DEBUG_MODE.md` | 示例路径 | 可选更新 |
| `app/TEST-DIAGNOSTIC.md` | 示例路径 | 可选更新 |

---

## 🔍 验证命令

### 搜索所有 yorutsuke 出现位置

```bash
# TypeScript/JavaScript
grep -r "yorutsuke" app/src --include="*.ts" --include="*.tsx" | grep -v test

# Rust
grep -r "yorutsuke" app/src-tauri/src --include="*.rs"

# Infra
grep -r "yorutsuke" infra/bin infra/lib --include="*.ts"

# 文档
grep -r "yorutsuke" . --include="*.md" | head -20
```

---

## 💡 最佳实践建议

### ✅ DO (推荐)

1. **用户可见内容全部配置化** ← 已完成 ✅
2. **技术标识符保持不变**（避免数据迁移）
3. **文档可选更新**（团队内部使用）

### ❌ DON'T (不推荐)

1. ❌ 修改 AWS 资源名称（生产环境已部署）
2. ❌ 修改数据库文件名（需要数据迁移）
3. ❌ 修改日志目录（破坏历史兼容性）
4. ❌ 修改 localStorage key（用户设置会丢失）

---

## 🎯 结论

### 当前状态 ✅

**用户体验**: 完全看不到 "Yorutsuke"
- ✅ 窗口标题: "Recie"
- ✅ 侧边栏: "Recie" / "レシエ"
- ✅ 菜单: "Recie"

**技术实现**: 合理保留历史标识符
- ✅ AWS 资源: `yorutsuke-*` (生产环境已部署)
- ✅ 数据库: `yorutsuke.db` (避免迁移)
- ✅ 日志: `~/.yorutsuke/` (历史兼容)

### 行业对比

| 公司 | 产品改名 | 技术标识符 |
|------|----------|-----------|
| Twitter → X | 产品名改为 "X" | API 仍是 `api.twitter.com` |
| Google Reader → Killed | 产品下线 | 数据库表仍是 `google_reader_*` |
| Facebook → Meta | 公司名改为 "Meta" | 域名仍是 `facebook.com` |

**结论**: 产品名可以改，技术标识符通常保持不变。

---

## 📚 相关文档

- **配置系统**: `docs/dev/CONFIGURATION_SUMMARY.md`
- **硬编码位置**: `docs/dev/HARDCODED_LOCATIONS.md`
- **改名示例**: `docs/dev/RENAMING_EXAMPLE.md`

---

**Last Updated**: 2026-01-27
**Status**: ✅ 用户可见部分已全部配置化
**Conclusion**: 技术标识符建议保持不变，避免数据迁移和生产环境影响
