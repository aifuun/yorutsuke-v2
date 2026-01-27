# 产品改名完整示例

> 演示如何使用配置系统改变产品名称和用户体验

## 场景：从 "Yorutsuke" 改名为 "夜付け"

### 步骤 1: 修改配置文件

编辑 `product.config.json`:

```json
{
  "productName": "夜付け",
  "productNameJa": "夜付け",
  "version": "0.2.0",
  "identifier": "com.yorutsuke.app",  // ← 保持不变，避免数据迁移

  "environments": {
    "production": {
      "identifier": "com.yorutsuke.app",
      "productName": "夜付け"
    }
  }
}
```

**重要决策**:
- ✅ `productName` 改为新名称 → 用户可见
- ✅ `identifier` 保持不变 → 数据目录不变，避免用户数据丢失

---

### 步骤 2: 同步配置

```bash
npm run config:sync
```

**输出**:
```
🔧 Syncing product config for environment: production
📦 Product Name: 夜付け
🔑 Identifier: com.yorutsuke.app
📌 Version: 0.2.0
✅ Successfully updated tauri.conf.json
📁 App data directory will be: ~/Library/Application Support/com.yorutsuke.app/
```

---

### 步骤 3: 构建应用

```bash
npm run build
```

**自动执行**:
1. ✅ 同步配置（production）
2. ✅ 编译 Tauri 应用
3. ✅ 生成安装包

---

## 用户体验对比

### 改名前（Yorutsuke）

```
🖥️ 用户看到：
┌─────────────────────────┐
│ ● ○ ○   Yorutsuke      │  ← 窗口标题
├─────────────────────────┤
│ Yorutsuke | 文件 | 编辑  │  ← macOS 菜单栏
├─────────────────────────┤
│                         │
│   [应用内容]            │
│                         │
└─────────────────────────┘

📁 数据目录（用户不知道）:
~/Library/Application Support/com.yorutsuke.app/
├── images/
├── logs/
└── yorutsuke.db
```

---

### 改名后（夜付け）

```
🖥️ 用户看到：
┌─────────────────────────┐
│ ● ○ ○   夜付け          │  ← 新窗口标题 ✅
├─────────────────────────┤
│ 夜付け | ファイル | 編集 │  ← 新菜单栏名称 ✅
├─────────────────────────┤
│                         │
│   [应用内容]            │
│                         │
└─────────────────────────┘

📁 数据目录（用户不知道，仍然在原位置）:
~/Library/Application Support/com.yorutsuke.app/  ← 不变 ✅
├── images/
├── logs/
└── yorutsuke.db  ← 文件名不变 ✅
```

**关键点**:
- ✅ 用户看到新名称"夜付け"
- ✅ 用户数据自动保留（目录位置不变）
- ✅ 无需数据迁移
- ✅ 用户无感知升级

---

## 技术细节（用户完全看不到）

### 改名前的 tauri.conf.json

```json
{
  "productName": "Yorutsuke",
  "identifier": "com.yorutsuke.app"
}
```

### 改名后的 tauri.conf.json

```json
{
  "productName": "夜付け",
  "identifier": "com.yorutsuke.app"
}
```

### 数据库文件（从未改变）

```
~/Library/Application Support/com.yorutsuke.app/
├── yorutsuke.db         ← 文件名保持不变
└── yorutsuke-mock.db    ← 文件名保持不变
```

**为什么数据库名不变？**
1. ✅ 用户完全看不到数据库文件
2. ✅ 避免数据迁移的复杂性
3. ✅ 降低出错风险
4. ✅ 业界常见做法（Chrome, Firefox, VS Code 都这样）

---

## 真实世界类比

### 例子 1: Google Chrome 改名

```
产品名称: Google Chrome → Chromium
数据目录: ~/Library/Application Support/Google/Chrome/  ← 不变
数据库: History.db, Cookies.db  ← 不变
```

### 例子 2: Slack 改名

```
产品名称: Slack → Salesforce Slack
Bundle ID: com.tinyspeck.slackmacgap  ← 不变（tinyspeck 是原公司名）
数据目录: 保持不变
```

**结论**: 产品名称改变，但技术标识符（identifier、数据库名）通常保持不变。

---

## 极端场景：需要完全改变

如果你确实需要改变 identifier 和数据库名（如白标产品）：

### 步骤 1: 修改配置

```json
{
  "productName": "BrandNew",
  "identifier": "com.brandnew.app",
  "build": {
    "databaseName": "brandnew.db",
    "databaseNameMock": "brandnew-mock.db"
  }
}
```

### 步骤 2: 创建数据迁移脚本

```typescript
// 在应用启动时检测旧数据
async function migrateFromOldApp() {
  const oldDir = '~/Library/Application Support/com.yorutsuke.app/';
  const newDir = '~/Library/Application Support/com.brandnew.app/';

  if (await exists(oldDir) && !await exists(newDir)) {
    // 复制数据到新目录
    await copyDirectory(oldDir, newDir);
    // 重命名数据库文件
    await rename('yorutsuke.db', 'brandnew.db');
  }
}
```

### 步骤 3: 通知用户

```
首次启动对话框：
"检测到旧版本数据，是否导入？"
[是] [否]
```

**复杂度**: 🔴 高 - 需要完善的测试和错误处理

---

## 推荐策略

### ✅ 推荐（简单）

```json
{
  "productName": "新产品名",  // ← 改这个
  "identifier": "com.yorutsuke.app"  // ← 不变
}
```

**优点**:
- ✅ 零风险
- ✅ 用户无感知
- ✅ 无需数据迁移
- ✅ 5 分钟完成改名

---

### ⚠️ 高级（复杂）

```json
{
  "productName": "新产品名",  // ← 改这个
  "identifier": "com.newproduct.app"  // ← 也改
}
```

**缺点**:
- ⚠️ 需要数据迁移代码
- ⚠️ 需要完善测试
- ⚠️ 有数据丢失风险
- ⚠️ 需要 1-2 周开发时间

**适用场景**: 白标产品、多品牌构建

---

## 快速参考

### 改名检查清单

- [ ] 修改 `product.config.json` 中的 `productName`
- [ ] 运行 `npm run config:sync`
- [ ] 检查 `tauri.conf.json` 是否更新
- [ ] 运行 `npm run build`
- [ ] 测试安装包，验证窗口标题
- [ ] 验证用户数据仍在原位置
- [ ] 提交代码

### 验证命令

```bash
# 1. 检查当前配置
cat app/src-tauri/tauri.conf.json | jq '.productName, .identifier'

# 2. 检查数据目录
ls -la ~/Library/Application\ Support/com.yorutsuke.app/

# 3. 启动应用验证窗口标题
npm run dev:app
```

---

## 总结

| 项目 | 用户可见 | 可以改名 | 推荐改吗 |
|------|----------|----------|----------|
| 窗口标题 | ✅ 是 | ✅ 是 | ✅ 改 |
| 菜单栏名称 | ✅ 是 | ✅ 是 | ✅ 改 |
| identifier | ❌ 否 | ✅ 是 | ❌ 不改 |
| 数据库名 | ❌ 否 | ✅ 是 | ❌ 不改 |
| 数据目录 | ❌ 否 | ✅ 是 | ❌ 不改 |

**关键原则**: 改用户看得到的，不改用户看不到的。

---

**Last Updated**: 2026-01-27
**Purpose**: 演示完整的产品改名流程
