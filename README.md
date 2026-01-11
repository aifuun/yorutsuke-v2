# Yorutsuke v2 (夜付け)

Local-first AI accounting assistant for second-hand business users.

## Quick Start

```bash
# Development
cd app && npm run tauri dev

# Build
cd app && npm run tauri build
```

## Git Workflow (Git Flow)

### Branch Structure

```
main (production)
 │
 ├── hotfix/* ──────────────┐
 │                          │
development (default) ◄─────┘
 │
 ├── issue/*
 ├── feature/*
 └── bugfix/*
```

### Daily Development

```bash
# 1. Start working on an issue
git checkout development
git pull origin development
git checkout -b issue/123-feature-name

# 2. Develop and commit
git add -A
git commit -m "feat: add feature (#123)"
git push origin issue/123-feature-name

# 3. Before merge: sync with development
git checkout development
git pull origin development
git checkout issue/123-feature-name
git merge development

# 4. Merge back to development
git checkout development
git merge --no-ff issue/123-feature-name
git push origin development

# 5. Delete branch
git branch -d issue/123-feature-name
git push origin --delete issue/123-feature-name
```

### Branch Types

| Branch | Base | Purpose |
|--------|------|---------|
| `main` | - | Production releases |
| `development` | main | Integration (default branch) |
| `issue/<n>-desc` | development | Feature work |
| `bugfix/<desc>` | development | Bug fixes |
| `hotfix/<desc>` | main | Production hotfixes |

### Release

```bash
git checkout main
git merge --no-ff development -m "Release v1.0.0"
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin main --tags

# Sync back to development
git checkout development
git merge main
git push origin development
```

### Hotfix (Production Bug)

```bash
# Create from main
git checkout main
git checkout -b hotfix/critical-fix

# After fix, merge to main AND development
git checkout main
git merge --no-ff hotfix/critical-fix
git push origin main

git checkout development
git merge main
git push origin development
```

### Using Claude Commands for Git Flow

Claude 提供了一套命令来简化 Git Flow 操作，自动处理分支创建、合并和清理。

#### 完整开发流程

```bash
# 1. 开始会话
*resume                           # 拉取最新代码，加载上下文

# 2. 查看可用的 issues
*issue                            # 列出所有开放的 issues

# 3. 开始处理某个 issue
*issue pick 123                   # 自动创建 issue/123-<desc> 分支
                                  # 加载或创建开发计划
                                  # 更新 TODO.md

# 4. 开发过程中保存进度
*sync                             # 提交并推送到当前分支

# 5. 完成开发
*review                           # 运行代码审查检查
*issue close 123                  # 合并到 development
                                  # 删除 feature 分支
                                  # 关闭 GitHub issue
```

#### Bug 修复流程

**Development 环境 Bug**:
```bash
*bugfix start fix-login-error     # 创建 bugfix/fix-login-error 分支
# ... 修复 bug ...
*sync                             # 保存进度
*bugfix finish                    # 合并到 development，删除分支
```

**Production 环境 Bug (紧急)**:
```bash
*hotfix start critical-auth-fix   # 从 main 创建 hotfix 分支
# ... 修复关键问题 ...
*sync                             # 保存进度
*hotfix finish                    # 合并到 main 和 development
                                  # 可选：创建 patch 版本 tag
```

#### 版本发布流程

```bash
# 1. 确认准备发布
*status                           # 检查当前状态

# 2. 发布新版本
*release                          # 交互式选择版本类型
# 或
*release minor                    # 直接指定版本类型 (patch/minor/major)

# 自动执行：
# - 合并 development → main
# - 更新版本号
# - 创建 git tag
# - 创建 GitHub release
# - 同步回 development
```

#### 命令速查表

| 命令 | 用途 | Git Flow 对应 |
|------|------|---------------|
| `*resume` | 开始会话 | `git pull` + 加载上下文 |
| `*issue pick <n>` | 开始开发 issue | `git checkout -b issue/<n>-<desc>` |
| `*sync` | 保存进度 | `git add -A && git commit && git push` |
| `*issue close <n>` | 完成 issue | `git merge --no-ff` + 分支清理 |
| `*bugfix start` | 修复 dev bug | `git checkout -b bugfix/<desc>` |
| `*bugfix finish` | 完成 bugfix | 合并到 development |
| `*hotfix start` | 修复生产 bug | `git checkout -b hotfix/<desc>` 从 main |
| `*hotfix finish` | 完成 hotfix | 合并到 main 和 development |
| `*release` | 发布版本 | 合并 + 打标签 + GitHub release |

#### 优势

相比手动 Git 命令，Claude 命令提供：

- ✅ **自动分支命名** - 基于 issue 标题自动生成规范的分支名
- ✅ **上下文管理** - 自动更新 TODO.md 和 MEMORY.md
- ✅ **错误预防** - 合并前自动检查和更新
- ✅ **完整流程** - 一个命令完成多个 Git 操作
- ✅ **任务追踪** - 与 GitHub Issues 集成

#### 更多信息

- **完整命令列表**: `.claude/WORKFLOW.md`
- **命令详细说明**: `.claude/commands/`
- **分支策略**: `.claude/workflow/branch-strategy.md`

## Documentation

- **Project Guide**: `CLAUDE.md`
- **Workflow Details**: `.claude/WORKFLOW.md`
- **Branch Strategy**: `.claude/workflow/branch-strategy.md`
