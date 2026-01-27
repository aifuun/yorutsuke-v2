# Product Configuration Guide

> 统一管理产品名称、版本和构建配置

## 概述

项目使用 `product.config.json` 作为**单一配置源**，在构建时自动同步到 `tauri.conf.json`。

这样设计的好处：
- ✅ 单一配置文件，易于修改产品信息
- ✅ 支持多环境配置（dev/staging/production）
- ✅ 避免手动修改多个配置文件
- ✅ 易于管理应用数据目录名称

## 配置文件

### product.config.json

```json
{
  "productName": "Yorutsuke",
  "identifier": "com.yorutsuke.app",
  "version": "0.1.0",

  "environments": {
    "dev": {
      "identifier": "com.yorutsuke.app.dev",
      "productName": "Yorutsuke (Dev)"
    },
    "staging": {
      "identifier": "com.yorutsuke.app.staging",
      "productName": "Yorutsuke (Staging)"
    },
    "production": {
      "identifier": "com.yorutsuke.app",
      "productName": "Yorutsuke"
    }
  }
}
```

## 关键字段说明

| 字段 | 用途 | 示例 |
|------|------|------|
| `productName` | 应用显示名称（窗口标题、菜单） | `"Yorutsuke"` |
| `identifier` | 应用唯一标识符 | `"com.yorutsuke.app"` |
| `version` | 应用版本号 | `"0.1.0"` |

### identifier 决定的位置

`identifier` 字段决定应用数据目录名称：

| 平台 | 数据目录 |
|------|----------|
| **macOS** | `~/Library/Application Support/{identifier}/` |
| **Linux** | `~/.local/share/{identifier}/` |
| **Windows** | `C:\Users\{user}\AppData\Local\{identifier}\` |

**示例**：
```
identifier = "com.yorutsuke.app"
→ macOS: ~/Library/Application Support/com.yorutsuke.app/
    ├── images/              (图片存储)
    ├── logs/                (日志)
    ├── yorutsuke.db         (数据库)
    └── yorutsuke-mock.db    (Mock数据库)
```

## 使用方法

### 1. 修改产品名称

只需修改 `product.config.json`：

```json
{
  "productName": "MyNewProduct",
  "identifier": "com.mynewproduct.app"
}
```

### 2. 开发模式（自动同步 dev 配置）

```bash
npm run dev:app
```

自动使用 dev 环境配置：
- 产品名: `Yorutsuke (Dev)`
- 数据目录: `com.yorutsuke.app.dev`

**好处**: 开发环境和生产环境的数据完全隔离

### 3. 构建生产版本（自动同步 production 配置）

```bash
npm run build
```

自动使用 production 配置：
- 产品名: `Yorutsuke`
- 数据目录: `com.yorutsuke.app`

### 4. 手动同步配置

如果需要手动同步配置：

```bash
# 同步生产配置
npm run config:sync

# 同步开发配置
npm run config:sync:dev

# 同步预发布配置
npm run config:sync:staging
```

## 多环境数据隔离

使用不同的 `identifier` 可以让多个环境的数据完全隔离：

```
开发环境:
  identifier: com.yorutsuke.app.dev
  → ~/Library/Application Support/com.yorutsuke.app.dev/

生产环境:
  identifier: com.yorutsuke.app
  → ~/Library/Application Support/com.yorutsuke.app/
```

**优点**：
- ✅ 同一台机器可以同时运行开发版和生产版
- ✅ 不会污染生产数据
- ✅ 测试时不影响真实用户数据

## 常见场景

### 场景 1: 更改产品名称

**步骤**:
1. 修改 `product.config.json` 中的 `productName` 和 `identifier`
2. 运行 `npm run config:sync`
3. 重新构建应用

**注意**: 修改 `identifier` 会改变数据目录位置，现有用户数据不会自动迁移

### 场景 2: 添加新环境（如 beta）

编辑 `product.config.json`:

```json
{
  "environments": {
    "dev": { ... },
    "beta": {
      "identifier": "com.yorutsuke.app.beta",
      "productName": "Yorutsuke (Beta)"
    },
    "production": { ... }
  }
}
```

在 `package.json` 添加命令:

```json
{
  "scripts": {
    "config:sync:beta": "node scripts/sync-product-config.js beta",
    "build:beta": "npm run config:sync:beta && npm run -w app tauri build"
  }
}
```

### 场景 3: 多品牌构建

创建多个配置文件：

```
product.config.json           (默认品牌)
product.config.brand-a.json   (品牌 A)
product.config.brand-b.json   (品牌 B)
```

修改构建脚本支持选择配置文件。

## 技术实现

### 同步脚本

`scripts/sync-product-config.js` 负责：
1. 读取 `product.config.json`
2. 根据环境参数选择配置
3. 更新 `app/src-tauri/tauri.conf.json`
4. 输出同步结果

### 自动触发

在 `package.json` 中，所有构建命令都会先执行配置同步：

```json
{
  "dev:app": "npm run config:sync:dev && npm run -w app tauri dev",
  "build": "npm run config:sync && npm run -w app tauri build"
}
```

## 故障排查

### 配置没有生效

**检查步骤**:
1. 确认 `product.config.json` 格式正确（有效 JSON）
2. 运行 `npm run config:sync` 手动同步
3. 检查 `app/src-tauri/tauri.conf.json` 是否更新
4. 重新构建应用

### 数据目录位置不对

**确认当前 identifier**:
```bash
grep "identifier" app/src-tauri/tauri.conf.json
```

**查看实际数据目录**:
```bash
# macOS
ls -la ~/Library/Application\ Support/ | grep yorutsuke

# Linux
ls -la ~/.local/share/ | grep yorutsuke

# Windows
dir %LOCALAPPDATA%\com.yorutsuke.*
```

## 相关文件

| 文件 | 用途 |
|------|------|
| `product.config.json` | 产品配置源文件 |
| `scripts/sync-product-config.js` | 配置同步脚本 |
| `app/src-tauri/tauri.conf.json` | Tauri 配置（自动生成，不要手动编辑） |
| `package.json` | 包含配置同步命令 |

## 最佳实践

1. ✅ **修改产品信息时只编辑 `product.config.json`**
2. ✅ **不要直接修改 `tauri.conf.json` 的 productName/identifier**
3. ✅ **提交前确保 `tauri.conf.json` 使用 production 配置**
4. ✅ **开发时使用 dev 环境，避免污染生产数据**
5. ✅ **修改 identifier 后通知用户数据目录已改变**

---

**Last Updated**: 2026-01-27
**Version**: 1.0
