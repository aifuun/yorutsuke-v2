# Project Snapshot

将项目所有文本文件收集到一个 Markdown 文件中，便于分享或存档。

## Usage

```
*snapshot [filename]
```

- 默认输出: `snapshots/snapshot-YYYY-MM-DD.md`
- 示例: `*snapshot context.md` 输出到 `snapshots/context.md`

## Workflow

1. **扫描**: 递归扫描当前目录所有文本文件
2. **过滤**: 自动排除 node_modules、.git、dist 等目录
3. **生成目录树**: 创建可视化的文件结构
4. **收集内容**: 将每个文件内容嵌入代码块
5. **输出**: 保存为单一 Markdown 文件

## 执行命令

```bash
node $(npm root -g)/long-term-dev/src/collect-files.js . PROJECT_SNAPSHOT.md
```

或者如果本地安装:

```bash
npx long-term-dev snapshot
```

## Output Format

文件保存在 `snapshots/` 目录下（已加入 .gitignore）：

```
snapshots/
├── snapshot-2025-01-15.md
├── snapshot-2025-01-16.md
└── custom-name.md
```

内容格式：
```markdown
# Project Snapshot: project-name

> Generated: 2025-01-15T00:00:00.000Z
> Total files: 42

## Directory Structure
├── src/
│   └── index.js
└── package.json

## File Contents

### src/index.js
\`\`\`js
// file content
\`\`\`
```

## 自动忽略

- `node_modules/`, `.git/`, `dist/`, `build/`
- `__pycache__/`, `.venv/`, `venv/`
- `*.log`, `*.lock`, `package-lock.json`
- `.DS_Store`, `.env`

## Notes

- 仅收集文本文件 (js, ts, py, md, json 等)
- 二进制文件自动跳过
- 大型项目建议先清理无用文件
