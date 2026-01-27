# 配置系统完整说明

> 单一配置源 → 自动同步到所有文件

## ✅ 配置已完全自动化

修改 `product.config.json` 后，运行 `npm run dev:app` 或 `npm run build`，会自动更新：

### 自动同步的文件（6个）

| # | 文件 | 更新内容 |
|---|------|----------|
| 1 | `app/src-tauri/tauri.conf.json` | productName, identifier, version, windowTitle |
| 2 | `app/src-tauri/Cargo.toml` | name, version, description |
| 3 | `app/package.json` | name, version, description |
| 4 | `app/src/i18n/locales/en.json` | app.name |
| 5 | `app/src/i18n/locales/ja.json` | app.name (使用 productNameJa) |
| 6 | `app/src/i18n/locales/zh.json` | app.name |

---

## 📝 当前配置

### product.config.json

```json
{
  "productName": "Recie",
  "productNameJa": "レシエ",
  "version": "0.1.0",
  "identifier": "com.recie.app",

  "environments": {
    "dev": {
      "identifier": "com.recie.app.dev",
      "productName": "Recie"
    },
    "production": {
      "identifier": "com.recie.app",
      "productName": "Recie"
    }
  }
}
```

---

## 🔄 工作流程

### 开发模式

```bash
npm run dev:app
```

**自动执行**：
1. ✅ `config:sync:dev` - 同步开发配置
2. ✅ 更新 6 个文件
3. ✅ 启动 Tauri 应用

**结果**：
- 窗口标题: "Recie"
- 侧边栏标题: "Recie" / "レシエ" (根据语言)
- 数据目录: `~/Library/Application Support/com.recie.app.dev/`

---

### 生产构建

```bash
npm run build
```

**自动执行**：
1. ✅ `config:sync` - 同步生产配置
2. ✅ 更新 6 个文件
3. ✅ 编译应用

**结果**：
- 安装包名称: `Recie.app`, `Recie.dmg`
- 数据目录: `~/Library/Application Support/com.recie.app/`

---

## 🎯 修改产品名称（完整流程）

### 场景：改名为 "MyApp"

**步骤 1**: 编辑 `product.config.json`

```json
{
  "productName": "MyApp",
  "productNameJa": "マイアプリ",
  "identifier": "com.myapp.app",

  "environments": {
    "dev": {
      "identifier": "com.myapp.app.dev",
      "productName": "MyApp"
    },
    "production": {
      "identifier": "com.myapp.app",
      "productName": "MyApp"
    }
  }
}
```

**步骤 2**: 同步配置

```bash
npm run config:sync:dev  # 开发环境
# 或
npm run config:sync      # 生产环境
```

**步骤 3**: 清理缓存（首次改名需要）

```bash
cd app/src-tauri && cargo clean
```

**步骤 4**: 启动应用

```bash
npm run dev:app
```

**完成！** 所有地方都会显示 "MyApp" / "マイアプリ"。

---

## 📊 同步结果验证

运行同步后，你会看到：

```
🔧 Syncing product config for environment: dev
📦 Product Name: MyApp
🔑 Identifier: com.myapp.app.dev
📌 Version: 0.1.0
✅ Successfully updated tauri.conf.json
✅ Successfully updated Cargo.toml
✅ Successfully updated app/package.json
✅ Successfully updated en.json
✅ Successfully updated ja.json
✅ Successfully updated zh.json
📁 App data directory will be: ~/Library/Application Support/com.myapp.app.dev/
```

---

## 🌍 多语言支持

### productName vs productNameJa

```json
{
  "productName": "Recie",       // 英文、中文界面使用
  "productNameJa": "レシエ"     // 日语界面使用
}
```

**同步逻辑**：
- `en.json`: 使用 `productName` → "Recie"
- `ja.json`: 使用 `productNameJa` → "レシエ"
- `zh.json`: 使用 `productName` → "Recie"

**用户体验**：
- 中文界面: 窗口 "Recie" + 侧边栏 "Recie"
- 日语界面: 窗口 "Recie" + 侧边栏 "レシエ"
- 英文界面: 窗口 "Recie" + 侧边栏 "Recie"

---

## ⚙️ 技术细节（用户看不到）

这些**不会**被配置影响（故意保持不变）：

| 项目 | 值 | 原因 |
|------|----|----|
| 数据库名 | `yorutsuke.db` | 避免数据迁移 |
| 日志路径 | `~/.yorutsuke/logs/` | 历史兼容性 |
| localStorage key | `yorutsuke:quota` | 避免重置用户设置 |

**好处**：
- ✅ 改名不影响用户数据
- ✅ 无需数据迁移
- ✅ 升级无感知

---

## 🚫 常见错误

### 错误 1: 只修改了配置，没有同步

```bash
# ❌ 错误
vim product.config.json
npm run tauri:dev  # 不会自动同步（旧版本）

# ✅ 正确
vim product.config.json
npm run dev:app    # 自动同步
```

### 错误 2: 修改了 tauri.conf.json 而不是 product.config.json

```bash
# ❌ 错误 - 下次同步会被覆盖
vim app/src-tauri/tauri.conf.json

# ✅ 正确 - 单一配置源
vim product.config.json
npm run config:sync
```

### 错误 3: 修改后没有清理缓存

```bash
# 首次改名或改 identifier 后
cd app/src-tauri && cargo clean  # 必须清理缓存
npm run dev:app
```

---

## 📝 快速参考

### 命令速查

| 命令 | 用途 |
|------|------|
| `npm run config:sync` | 同步生产配置 |
| `npm run config:sync:dev` | 同步开发配置 |
| `npm run dev:app` | 开发模式（自动同步） |
| `npm run build` | 生产构建（自动同步） |

### 文件位置

| 文件 | 用途 |
|------|------|
| `product.config.json` | 单一配置源（唯一需要手动编辑的） |
| `scripts/sync-product-config.js` | 同步脚本 |
| `app/src-tauri/tauri.conf.json` | Tauri 配置（自动生成） |
| `app/src-tauri/Cargo.toml` | Rust 配置（自动生成） |
| `app/package.json` | NPM 配置（自动生成） |
| `app/src/i18n/locales/*.json` | 翻译文件（自动生成） |

---

## ✅ 配置系统优点

1. **单一配置源** - 只需修改 `product.config.json`
2. **自动同步** - 运行 dev/build 自动更新所有文件
3. **多环境支持** - dev/staging/production 独立配置
4. **多语言支持** - 不同语言显示不同产品名
5. **零风险改名** - 技术标识符保持不变，无需数据迁移

---

**Last Updated**: 2026-01-27
**Status**: 配置系统完全自动化 ✅
