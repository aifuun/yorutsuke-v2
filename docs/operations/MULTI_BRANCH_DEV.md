# Multi-Branch Development Guide

> 如何在一台电脑上同时测试多个分支的 Tauri 应用

## 问题

Tauri 开发模式默认使用固定端口 `1420`，导致无法同时运行多个分支。

## 解决方案

使用不同端口启动不同分支的应用。

---

## 快速使用

### 方式 1：默认端口（1420）

```bash
cd app
npm run tauri:dev
```

### 方式 2：指定端口

```bash
# Terminal 1: development 分支（端口 1420）
cd /path/to/yorutsuke-v2/app
npm run tauri:dev

# Terminal 2: feature 分支（端口 1422）
cd /path/to/yorutsuke-v2-feature/app
npm run tauri:1422

# Terminal 3: bugfix 分支（端口 1424）
cd /path/to/yorutsuke-v2-bugfix/app
npm run tauri:1424
```

---

## 可用命令

| 命令 | 端口 | 用途 |
|------|------|------|
| `npm run dev` | 1420 | Vite only (默认) |
| `npm run dev:1422` | 1422 | Vite only |
| `npm run dev:1424` | 1424 | Vite only |
| `npm run dev:1426` | 1426 | Vite only |
| `npm run tauri:dev` | 1420 | Tauri + Vite (默认) |
| `npm run tauri:1422` | 1422 | Tauri + Vite |
| `npm run tauri:1424` | 1424 | Tauri + Vite |
| `npm run tauri:1426` | 1426 | Tauri + Vite |

---

## 工作流示例

### 场景 1：对比两个分支

**需求**：同时运行 `development` 和 `issue/115` 分支，对比 UI 变化。

```bash
# Terminal 1: development 分支
cd ~/dev/yorutsuke-v2
git checkout development
cd app && npm run tauri:dev

# Terminal 2: issue/115 分支（克隆一份或使用 worktree）
cd ~/dev/yorutsuke-v2-feature
git checkout issue/115
cd app && npm run tauri:1422
```

### 场景 2：三分支并行测试

**需求**：测试 `development`、`feature-A`、`feature-B` 三个分支的表现。

```bash
# Terminal 1: development
cd ~/dev/yorutsuke-dev && cd app && npm run tauri:dev

# Terminal 2: feature-A
cd ~/dev/yorutsuke-feature-a && cd app && npm run tauri:1422

# Terminal 3: feature-B
cd ~/dev/yorutsuke-feature-b && cd app && npm run tauri:1424
```

### 场景 3：使用 Git Worktree（推荐）

Git worktree 允许在同一仓库的不同目录中切换到不同分支：

```bash
# 创建 worktree
cd ~/dev/yorutsuke-v2
git worktree add ../yorutsuke-feature-115 issue/115
git worktree add ../yorutsuke-bugfix bugfix/readme-update

# 同时运行
cd ~/dev/yorutsuke-v2/app && npm run tauri:dev          # main
cd ~/dev/yorutsuke-feature-115/app && npm run tauri:1422  # feature
cd ~/dev/yorutsuke-bugfix/app && npm run tauri:1424       # bugfix

# 清理 worktree
git worktree remove ../yorutsuke-feature-115
git worktree remove ../yorutsuke-bugfix
```

---

## 技术实现

### 1. vite.config.ts

读取 `VITE_PORT` 环境变量：

```typescript
const port = parseInt(process.env.VITE_PORT || "1420");

export default defineConfig({
  server: {
    port,
    strictPort: true,
    // HMR 端口 = Vite 端口 + 1
    hmr: { port: port + 1 }
  }
});
```

### 2. package.json

预定义不同端口的脚本：

```json
{
  "scripts": {
    "tauri:1422": "VITE_PORT=1422 tauri dev",
    "tauri:1424": "VITE_PORT=1424 tauri dev"
  }
}
```

### 3. Tauri 自动适配

Tauri 2 会自动读取 Vite 的端口配置，无需修改 `tauri.conf.json`。

---

## 注意事项

### 1. 端口选择

- 默认：`1420` (development)
- 建议间隔：`+2`（为 HMR 预留 `+1` 端口）
- 可用端口：`1422`, `1424`, `1426`, `1428`...

### 2. 数据隔离

**SQLite 数据库**：所有分支共享同一数据库位置 `~/.yorutsuke/yorutsuke.db`

- ✅ 优点：测试时不需要重新上传数据
- ⚠️ 风险：Schema migration 冲突

**解决方案**：
1. 开发时避免修改 Schema
2. 如需测试 migration，使用独立测试数据库：
   ```bash
   # 备份生产数据
   cp ~/.yorutsuke/yorutsuke.db ~/.yorutsuke/yorutsuke.db.backup

   # 测试完成后恢复
   cp ~/.yorutsuke/yorutsuke.db.backup ~/.yorutsuke/yorutsuke.db
   ```

### 3. 环境变量

所有分支共享 `.env.local`，包括：
- AWS Lambda URLs
- API Keys
- Feature flags

如需隔离，复制 `.env.local` 并手动加载：
```bash
cp .env.local .env.feature-115
# 编辑 .env.feature-115
VITE_PORT=1422 ENV_FILE=.env.feature-115 npm run tauri:1422
```

### 4. 性能影响

同时运行多个 Tauri 实例会占用大量资源：
- **内存**：每个实例 ~500MB
- **CPU**：Vite HMR + Rust 编译

建议最多同时运行 **2-3 个实例**。

---

## 故障排查

### 问题 1：端口被占用

```
Error: Port 1422 is already in use
```

**解决方式 1：一键清理所有端口（推荐）**：
```bash
cd app
npm run clean:ports
```

**解决方式 2：清理单个端口**：
```bash
# 方式 A: 使用脚本
cd app
bash scripts/kill-port.sh 1422

# 方式 B: 手动清理
lsof -i :1422        # 查看占用端口的进程
kill -9 <PID>        # 杀掉进程
```

### 问题 2：Tauri 窗口无法打开

**现象**：Vite 启动成功，但 Tauri 窗口不出现。

**解决**：
```bash
# 检查 Vite 是否在正确端口运行
curl http://localhost:1422

# 重新构建 Tauri
cd app
npm run tauri build --debug
```

### 问题 3：数据库冲突

**现象**：不同分支的 Schema 不兼容。

**解决**：
```bash
# 查看当前 Schema 版本
sqlite3 ~/.yorutsuke/yorutsuke.db "PRAGMA user_version;"

# 删除数据库重新初始化（丢失数据！）
rm ~/.yorutsuke/yorutsuke.db
```

---

## 扩展端口

如果需要更多端口（超过 4 个分支），修改 `app/package.json`：

```json
{
  "scripts": {
    "dev:1428": "VITE_PORT=1428 vite",
    "tauri:1428": "VITE_PORT=1428 tauri dev",
    "dev:1430": "VITE_PORT=1430 vite",
    "tauri:1430": "VITE_PORT=1430 tauri dev"
  }
}
```

---

## 相关文档

- **Vite 配置**: `app/vite.config.ts`
- **Tauri 配置**: `app/src-tauri/tauri.conf.json`
- **Git Worktree**: [官方文档](https://git-scm.com/docs/git-worktree)

---

**Last Updated**: 2026-01-11
**Version**: 1.0
