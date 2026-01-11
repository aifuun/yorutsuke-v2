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

## Documentation

- **Project Guide**: `CLAUDE.md`
- **Workflow Details**: `.claude/WORKFLOW.md`
- **Branch Strategy**: `.claude/workflow/branch-strategy.md`
