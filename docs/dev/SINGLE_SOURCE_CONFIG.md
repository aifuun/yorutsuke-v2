# 单一配置源系统

> **核心理念**: 只修改 1 个字段，所有名称自动派生

## ✅ 完全实现：一次修改，全局生效

### 改名示例：从 Recie 改为 MyApp

**步骤 1: 修改 product.config.json（唯一需要手动编辑的文件）**

```json
{
  "productName": "MyApp",
  "productNameJa": "マイアプリ",
  "technicalName": "myapp",  // ← 只需修改这一个字段！
  "version": "0.1.0",
  "identifier": "com.myapp.app",
  ...
}
```

**步骤 2: 运行同步脚本**

```bash
npm run config:sync:dev
```

**结果：所有名称自动更新** ✨

```
🔄 Derived Configuration (from technicalName: "myapp"):
   Database: myapp.db, myapp-mock.db
   Storage Prefix: myapp
   Log Directory: .myapp
   Rust Lib: myapp_lib
   AWS Stack: MyApp2Stack-dev
   AWS Resources: myapp-*
```

---

## 📊 派生规则

| 配置项 | 派生规则 | 示例 (technicalName: "myapp") |
|--------|----------|-------------------------------|
| **数据库名称** | `${technicalName}.db` | `myapp.db` |
| **Mock 数据库** | `${technicalName}-mock.db` | `myapp-mock.db` |
| **LocalStorage 前缀** | `${technicalName}` | `myapp` |
| **日志目录** | `.${technicalName}` | `.myapp` |
| **Rust 库名** | `${technicalName}_lib` | `myapp_lib` |
| **AWS Stack 前缀** | `${productName}2` | `MyApp2` |
| **AWS 资源前缀** | `${technicalName}` | `myapp` |

---

## 🎯 自动生成的配置文件

运行 `npm run config:sync:dev` 后，以下文件自动生成（**无需手动编辑**）：

### 1. TypeScript 前端配置
**文件**: `app/src/generated/config.ts`

```typescript
export const DB_PRODUCTION = 'sqlite:myapp.db';
export const DB_MOCK = 'sqlite:myapp-mock.db';
export const STORAGE_PREFIX = 'myapp';
export const QUOTA_STORAGE_KEY = `myapp:quota`;
export const LOG_DIRECTORY = '.myapp';
```

### 2. Rust 后端配置
**文件**: `app/src-tauri/src/generated/config.rs`

```rust
pub const DB_PRODUCTION: &str = "myapp.db";
pub const DB_MOCK: &str = "myapp-mock.db";
pub const LOG_DIRECTORY: &str = ".myapp";
```

### 3. AWS CDK 配置
**文件**: `infra/lib/generated/config.ts`

```typescript
export const STACK_NAME_PREFIX = 'MyApp2';
export const RESOURCE_PREFIX = 'myapp';

export function getStackName(env: string, stackType: 'main' | 'admin'): string {
  return `${STACK_NAME_PREFIX}${stackType === 'admin' ? 'AdminStack' : 'Stack'}-${env}`;
}

export function getS3BucketName(type: string, region: string, env: string, accountId: string): string {
  return `${RESOURCE_PREFIX}-${type}-${region}-${env}-${accountId}`;
}

export function getDynamoTableName(tableName: string, region: string, env: string): string {
  return `${RESOURCE_PREFIX}-${tableName}-${region}-${env}`;
}
```

---

## 🔄 工作流程

```
product.config.json
    ↓ (唯一输入)
scripts/sync-product-config.js
    ↓ (自动派生)
├─→ app/src/generated/config.ts         (TypeScript)
├─→ app/src-tauri/src/generated/config.rs  (Rust)
├─→ infra/lib/generated/config.ts       (AWS CDK)
├─→ app/src-tauri/tauri.conf.json       (Tauri)
├─→ app/src-tauri/Cargo.toml            (Rust)
├─→ app/package.json                    (NPM)
└─→ app/src/i18n/locales/*.json         (多语言)
```

---

## 🚀 实际使用场景

### 场景 1: 产品改名（从 Recie 改为 MyApp）

```bash
# 1. 修改配置文件
vim product.config.json
# 修改 3 个字段:
#   - productName: "MyApp"
#   - productNameJa: "マイアプリ"
#   - technicalName: "myapp"

# 2. 同步配置
npm run config:sync:dev

# 3. 清理缓存（首次改名需要）
cd app/src-tauri && cargo clean

# 4. 启动应用
cd ../.. && npm run dev:app

# 完成！所有地方都显示 MyApp
```

---

### 场景 2: 多环境配置

```json
{
  "technicalName": "myapp",
  "environments": {
    "dev": {
      "identifier": "com.myapp.app.dev",
      "productName": "MyApp"
    },
    "staging": {
      "identifier": "com.myapp.app.staging",
      "productName": "MyApp (Staging)"
    },
    "production": {
      "identifier": "com.myapp.app",
      "productName": "MyApp"
    }
  }
}
```

**不同环境使用不同配置**:

```bash
npm run config:sync:dev       # 开发环境
npm run config:sync:staging   # 测试环境
npm run config:sync           # 生产环境
```

---

## 🔍 验证派生结果

```bash
# 运行同步脚本，查看派生的配置
npm run config:sync:dev

# 输出示例:
# 📦 Source Configuration:
#    Product Name: MyApp
#    Technical Name: myapp
#    Identifier: com.myapp.app.dev
#
# 🔄 Derived Configuration (from technicalName: "myapp"):
#    Database: myapp.db, myapp-mock.db
#    Storage Prefix: myapp
#    Log Directory: .myapp
#    Rust Lib: myapp_lib
#    AWS Stack: MyApp2Stack-dev
#    AWS Resources: myapp-*
```

---

## ⚠️ 重要规则

### ✅ DO（推荐）

1. **只修改 product.config.json**
2. **修改后立即运行 `npm run config:sync`**
3. **首次改名后运行 `cargo clean`**
4. **提交时包含生成的配置文件**

### ❌ DON'T（禁止）

1. ❌ 直接编辑 `app/src/generated/` 文件（会被覆盖）
2. ❌ 直接编辑 `infra/lib/generated/` 文件（会被覆盖）
3. ❌ 直接编辑 `app/src-tauri/src/generated/` 文件（会被覆盖）
4. ❌ 跳过 `npm run config:sync` 直接运行应用

---

## 🎯 技术名称命名规范

`technicalName` 字段应遵循：

- **小写字母** + **数字** + **连字符** (kebab-case)
- 推荐: `myapp`, `my-app`, `app123`
- 避免: `MyApp`, `my_app`, `My App`

**原因**: 此名称用于生成：
- 文件名 (`myapp.db`)
- 目录名 (`.myapp`)
- 包名 (`myapp_lib`)
- AWS 资源名 (`myapp-images-us-dev`)

---

## 📚 相关文档

- **完整配置系统**: `docs/dev/CONFIGURATION_SUMMARY.md`
- **改名示例**: `docs/dev/RENAMING_EXAMPLE.md`
- **配置源文件**: `product.config.json`
- **同步脚本**: `scripts/sync-product-config.js`

---

**Last Updated**: 2026-01-27
**Status**: ✅ 单一配置源完全实现
**核心优势**: 修改 1 个字段 → 13+ 个文件自动更新
