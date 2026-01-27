# Hardcoded Locations Report

> 项目中硬编码位置的完整清单和修复建议

## 扫描结果

扫描日期: 2026-01-27
扫描范围: 全项目（排除 node_modules, target, dist）

---

## 🔴 Critical: 数据库名称 (必须修复)

### 问题
数据库名称 `yorutsuke.db` 和 `yorutsuke-mock.db` 在多个文件中硬编码。

### 影响
如果修改 `product.config.json` 中的 `databaseName`，这些地方不会自动更新，导致应用无法启动。

### 硬编码位置

| # | 文件 | 行号 | 内容 |
|---|------|------|------|
| 1 | `app/src-tauri/src/lib.rs` | 403 | `.add_migrations("sqlite:yorutsuke.db", vec![` |
| 2 | `app/src-tauri/src/lib.rs` | 412 | `.add_migrations("sqlite:yorutsuke-mock.db", vec![` |
| 3 | `app/src/00_kernel/storage/db.ts` | 20 | `const PRODUCTION_DB = 'sqlite:yorutsuke.db';` |
| 4 | `app/src/00_kernel/storage/db.ts` | 21 | `const MOCK_DB = 'sqlite:yorutsuke-mock.db';` |
| 5 | `app/src-tauri/tauri.conf.json` | 51 | `"preload": ["sqlite:yorutsuke.db"]` |

### 修复方案

#### 选项 A: 保持数据库名称不变 (推荐)

**理由**:
- 数据库名称通常不需要跟随产品名称改变
- 避免用户数据迁移复杂性
- 简单可靠

**操作**: 无需修改，保持现状

---

#### 选项 B: 使环境变量可配置

为 Rust 和 TypeScript 添加环境变量支持。

**步骤 1**: 修改 `app/src-tauri/src/lib.rs`

```rust
// 在文件顶部添加环境变量读取
fn get_db_name() -> String {
    std::env::var("DATABASE_NAME").unwrap_or_else(|_| "yorutsuke.db".to_string())
}

fn get_mock_db_name() -> String {
    std::env::var("MOCK_DATABASE_NAME").unwrap_or_else(|_| "yorutsuke-mock.db".to_string())
}

// 修改 line 403-420
pub fn run() {
    let db_name = format!("sqlite:{}", get_db_name());
    let mock_db_name = format!("sqlite:{}", get_mock_db_name());

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(&db_name, vec![...])
                .add_migrations(&mock_db_name, vec![...])
                .build()
        )
        // ...
}
```

**步骤 2**: 修改 `app/src/00_kernel/storage/db.ts`

```typescript
// 从 product.config.json 读取配置
import productConfig from '../../../product.config.json';

const PRODUCTION_DB = `sqlite:${productConfig.build.databaseName}`;
const MOCK_DB = `sqlite:${productConfig.build.databaseNameMock}`;
```

**步骤 3**: 更新 `scripts/sync-product-config.js`

添加 `preload` 同步：
```javascript
// Update SQL plugin preload
if (productConfig.build && productConfig.build.databaseName) {
  tauriConfig.plugins.sql.preload = [
    `sqlite:${productConfig.build.databaseName}`
  ];
}
```

---

#### 选项 C: 使用代码生成

在构建时根据 `product.config.json` 自动生成配置文件。

**实现**: 创建 `scripts/generate-db-config.js`

```javascript
#!/usr/bin/env node
import fs from 'fs';
import productConfig from '../product.config.json' assert { type: 'json' };

// 生成 TypeScript 配置
const tsConfig = `
// Auto-generated from product.config.json - DO NOT EDIT
export const PRODUCTION_DB = 'sqlite:${productConfig.build.databaseName}';
export const MOCK_DB = 'sqlite:${productConfig.build.databaseNameMock}';
`;

fs.writeFileSync('app/src/00_kernel/storage/db.config.ts', tsConfig);
console.log('✅ Generated db.config.ts');
```

在 `package.json` 中添加：
```json
{
  "scripts": {
    "prebuild": "node scripts/generate-db-config.js"
  }
}
```

---

## 🟡 Medium: 产品名称 (可选修复)

### 硬编码位置

| # | 文件 | 行号 | 内容 | 影响 |
|---|------|------|------|------|
| 1 | `app/src-tauri/src/lib.rs` | 392 | `format!("Hello, {}! Welcome to Yorutsuke.", name)` | 低 - 仅测试函数 |

### 分析
`greet` 函数是 Tauri 示例代码，实际应用中未使用。

### 修复方案

**选项 1**: 删除 `greet` 函数（推荐）

```rust
// 删除整个函数
// #[tauri::command]
// fn greet(name: &str) -> String {
//     format!("Hello, {}! Welcome to Yorutsuke.", name)
// }
```

同时从 `invoke_handler` 中移除：
```rust
.invoke_handler(tauri::generate_handler![
    // greet,  ← 删除这行
    compress_image,
    // ...
])
```

**选项 2**: 改为使用配置（如果需要保留）

```rust
#[tauri::command]
fn greet(name: &str) -> String {
    let product_name = std::env::var("PRODUCT_NAME")
        .unwrap_or_else(|_| "Yorutsuke".to_string());
    format!("Hello, {}! Welcome to {}.", name, product_name)
}
```

---

## 🟢 Low: 注释/文档 (无需修复)

### 位置

| # | 文件 | 行号 | 内容 |
|---|------|------|------|
| 1 | `app/src-tauri/src/lib.rs` | 11-13 | 注释中的路径示例 |

### 分析
这些是注释中的**示例说明**，实际代码使用 Tauri API 动态获取路径。

```rust
/// Get unified app data directory using Tauri API
/// - macOS: ~/Library/Application Support/com.yorutsuke.app/   ← 仅示例
/// - Linux: ~/.local/share/com.yorutsuke.app/
/// - Windows: C:\Users\<user>\AppData\Local\com.yorutsuke.app\
fn get_app_data_dir(app: &tauri::AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()  // ← 实际代码：动态获取
        .expect("Failed to get app data directory")
}
```

### 修复方案
**可选**: 改为通用描述

```rust
/// Get unified app data directory using Tauri API
/// - macOS: ~/Library/Application Support/{identifier}/
/// - Linux: ~/.local/share/{identifier}/
/// - Windows: C:\Users\{user}\AppData\Local\{identifier}\
```

---

## 📊 总结

### 硬编码统计

| 类型 | 数量 | 优先级 | 状态 |
|------|------|--------|------|
| 数据库名称 | 5 处 | 🔴 Critical | 需要决策 |
| 产品名称 | 1 处 | 🟡 Medium | 可选 |
| 注释/文档 | 1 处 | 🟢 Low | 无需修复 |

### 推荐方案

**短期 (推荐)**:
1. ✅ 保持数据库名称不变（`yorutsuke.db`）
2. ✅ 删除 `greet` 测试函数
3. ✅ 更新注释为通用描述

**中期 (如果需要完全可配置)**:
1. 实现选项 B：环境变量支持
2. 更新 `sync-product-config.js` 同步所有配置
3. 添加集成测试验证配置正确性

**长期 (如果频繁更换品牌)**:
1. 实现选项 C：代码生成
2. 添加 CI/CD 自动检查硬编码
3. 建立配置文件验证机制

---

## 🔍 验证方法

### 检查所有硬编码

```bash
# 搜索数据库名称
grep -r "yorutsuke\.db\|yorutsuke-mock\.db" \
  --include="*.ts" --include="*.tsx" --include="*.rs" --include="*.json" \
  --exclude-dir=node_modules --exclude-dir=target --exclude-dir=dist \
  2>/dev/null

# 搜索 identifier
grep -r "com\.yorutsuke\.app" \
  --include="*.ts" --include="*.tsx" --include="*.rs" --include="*.json" \
  --exclude-dir=node_modules --exclude-dir=target --exclude-dir=dist \
  2>/dev/null

# 搜索产品名称
grep -r "\"Yorutsuke\"" \
  --include="*.ts" --include="*.tsx" --include="*.rs" \
  --exclude-dir=node_modules --exclude-dir=target --exclude-dir=dist \
  2>/dev/null
```

### 测试配置切换

```bash
# 1. 修改 product.config.json
# 2. 运行同步
npm run config:sync

# 3. 检查生成的配置
cat app/src-tauri/tauri.conf.json | jq '.productName, .identifier'

# 4. 启动应用验证
npm run dev:app
```

---

## 📚 相关文档

- **配置指南**: `docs/dev/PRODUCT_CONFIG.md`
- **配置文件**: `product.config.json`
- **同步脚本**: `scripts/sync-product-config.js`

---

**Last Updated**: 2026-01-27
**Reviewed By**: Claude Code Assistant
**Next Review**: 在更改产品名称前
