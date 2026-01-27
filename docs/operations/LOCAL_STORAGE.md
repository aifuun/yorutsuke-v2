# Yorutsuke v2 本地存储架构指南

> 面向新工程师的完整存储说明

---

## 目录结构

### 存储根目录

根据操作系统，Yorutsuke 使用 Tauri 的 `appDataDir()` API 确定存储位置：

| 操作系统 | 存储路径 |
|---------|---------|
| **macOS** | `~/Library/Application Support/com.yorutsuke.app/` |
| **Linux** | `~/.local/share/com.yorutsuke.app/` |
| **Windows** | `C:\Users\<user>\AppData\Local\com.yorutsuke.app\` |

### 完整目录结构

```
com.yorutsuke.app/                    ← appDataDir (根目录)
├── images/                            ← 压缩后的图片文件
│   ├── img-abc123.jpg
│   ├── img-def456.jpg
│   └── ...
├── logs/                              ← JSON 日志文件
│   ├── 2026-01-27.jsonl
│   ├── 2026-01-26.jsonl
│   └── ...
├── yorutsuke.db                       ← 生产数据库 (SQLite)
├── yorutsuke-mock.db                  ← Mock 数据库 (开发/测试)
└── .migration_v1_complete             ← 迁移完成标记文件
```

---

## 数据库 (SQLite)

### 数据库文件

**位置**: `{appDataDir}/yorutsuke.db` (生产) / `yorutsuke-mock.db` (Mock)

**管理文件**: `app/src/00_kernel/storage/db.ts`

### 双数据库模式

Yorutsuke 使用**双数据库模式**：

| 数据库 | 文件名 | 用途 | 何时使用 |
|--------|--------|------|---------|
| **Production DB** | `yorutsuke.db` | 真实用户数据 | 正常运行时 |
| **Mock DB** | `yorutsuke-mock.db` | 测试数据 | Mock 模式时 |

#### 动态切换

```typescript
// app/src/00_kernel/storage/db.ts

export async function getDb(): Promise<Database> {
  // 根据 mock 模式动态返回数据库
  if (isMockMode()) {
    return mockDb;  // 返回 mock 数据库
  }
  return productionDb;  // 返回生产数据库
}
```

**优势**：无需重启应用即可切换数据库。

### 主要数据表

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| **images** | 图片元数据 | `id`, `compressed_path`, `original_path`, `md5`, `uploaded_at` |
| **transactions** | 交易记录 | `id`, `amount`, `category`, `date`, `created_at` |
| **transactions_cache** | 交易缓存 | 用于提升查询性能 |
| **morning_report_cache** | 早报缓存 | 用于提升仪表盘性能 |
| **analytics** | 分析数据 | 统计和趋势数据 |
| **settings** | 应用设置 | `key`, `value` (如 `language`, `theme`, `mock_mode`) |

### 数据库操作

#### 初始化

```typescript
// app/src/main.tsx 或 App.tsx
import { initDb } from './00_kernel/storage/db';

// 应用启动时初始化
await initDb();
```

#### 查询数据

```typescript
import { getDb } from './00_kernel/storage/db';

// 获取数据库连接
const db = await getDb();

// 查询数据
const images = await db.select<ImageRow[]>('SELECT * FROM images WHERE uploaded_at > ?', [timestamp]);
```

#### 插入数据

```typescript
const db = await getDb();

await db.execute(
  'INSERT INTO images (id, compressed_path, md5, uploaded_at) VALUES (?, ?, ?, ?)',
  [imageId, path, md5Hash, Date.now()]
);
```

#### 清除数据

```typescript
import { clearBusinessData, clearSettings } from './00_kernel/storage/db';

// 清除业务数据（保留设置）
const results = await clearBusinessData();
// Returns: { images: 100, transactions: 50, ... }

// 清除设置（保留 schema_version）
await clearSettings();
```

---

## 图片存储

### 存储位置

**目录**: `{appDataDir}/images/`

**示例路径** (macOS):
```
~/Library/Application Support/com.yorutsuke.app/images/img-abc123.jpg
```

### 图片处理流程

```
用户上传原始图片
    ↓
Tauri 压缩图片 (Rust 后端)
    ├─ 最大尺寸: 1536px (长边)
    ├─ 转为灰度图 (OCR 友好，减少 60% 文件大小)
    ├─ JPEG 75% 质量
    └─ 保存到 images/ 目录
    ↓
返回压缩结果到前端
    ↓
前端保存元数据到数据库
```

### 图片命名规则

格式: `{imageId}.jpg`

- `imageId` 由前端生成（通常使用 `nanoid`）
- 示例: `img-abc123xyz.jpg`

### 图片元数据表 (images)

**表结构** (简化版):

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT PRIMARY KEY | 图片 ID |
| `compressed_path` | TEXT | 压缩后的文件路径 |
| `original_path` | TEXT | 原始文件路径（可选）|
| `md5` | TEXT | MD5 哈希（防重复上传）|
| `file_size` | INTEGER | 压缩后的文件大小 (bytes) |
| `original_size` | INTEGER | 原始文件大小 (bytes) |
| `width` | INTEGER | 图片宽度 (px) |
| `height` | INTEGER | 图片高度 (px) |
| `uploaded_at` | INTEGER | 上传时间戳 (ms) |
| `user_id` | TEXT | 用户 ID (device-xxx 或 user-xxx) |

### 图片操作

#### 1. 压缩图片 (Rust IPC)

**文件**: `app/src-tauri/src/lib.rs`

```typescript
// 前端调用
import { invoke } from '@tauri-apps/api/core';

const result = await invoke<CompressResult>('compress_image', {
  inputPath: '/path/to/original.jpg',
  imageId: 'img-abc123'
});

// 返回结果
interface CompressResult {
  success: boolean;
  id: string;
  original_path: string;
  output_path: string;       // {appDataDir}/images/img-abc123.jpg
  original_size: number;
  compressed_size: number;
  width: number;
  height: number;
  md5: string;
}
```

#### 2. 保存图片元数据 (TypeScript)

**文件**: `app/src/02_modules/capture/adapters/imageDb.ts`

```typescript
import { saveImageRecord } from './adapters/imageDb';

await saveImageRecord({
  id: 'img-abc123',
  compressed_path: '/path/to/com.yorutsuke.app/images/img-abc123.jpg',
  original_path: '/path/to/original.jpg',
  md5: 'abc123...',
  file_size: 245600,
  original_size: 1024000,
  width: 1536,
  height: 2048,
  uploaded_at: Date.now(),
  user_id: 'device-xxx'
});
```

#### 3. 查询图片

```typescript
import { getDb } from './00_kernel/storage/db';

const db = await getDb();

// 查询所有图片
const images = await db.select<ImageRow[]>('SELECT * FROM images ORDER BY uploaded_at DESC');

// 查询单个图片
const image = await db.select<ImageRow[]>('SELECT * FROM images WHERE id = ?', [imageId]);
```

#### 4. 删除图片

**问题**: 当前实现只删除数据库记录，**不删除文件**（Issue #178）

```typescript
// 当前实现 (db.ts)
await db.execute('DELETE FROM images WHERE id = ?', [imageId]);
// ❌ 文件仍然在 images/ 目录中

// 正确实现 (需要修复)
// 1. 查询图片路径
const image = await db.select<ImageRow[]>('SELECT compressed_path FROM images WHERE id = ?', [imageId]);

// 2. 删除文件
await deleteFile(image[0].compressed_path);

// 3. 删除数据库记录
await db.execute('DELETE FROM images WHERE id = ?', [imageId]);
```

---

## 日志存储

### 日志位置

**目录**: `{appDataDir}/logs/`

**命名**: `YYYY-MM-DD.jsonl` (JSON Lines 格式)

**示例**:
```
~/Library/Application Support/com.yorutsuke.app/logs/2026-01-27.jsonl
```

### 日志格式 (JSON Lines)

每一行是一个 JSON 对象：

```json
{"timestamp":"2026-01-27T10:30:45.123Z","level":"info","event":"IMAGE_UPLOADED","imageId":"img-abc123","fileSize":245600}
{"timestamp":"2026-01-27T10:30:46.456Z","level":"debug","event":"DB_QUERY","table":"images","duration":12}
```

### 日志操作

#### 写入日志

```typescript
import { logger, EVENTS } from './00_kernel/telemetry/logger';

logger.info(EVENTS.IMAGE_UPLOADED, { 
  imageId: 'img-abc123', 
  fileSize: 245600 
});
```

#### 读取日志

```bash
# 查看今日日志
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | jq .

# 查看最近 50 条
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | tail -50 | jq .

# 按事件过滤
cat ~/.yorutsuke/logs/$(date +%Y-%m-%d).jsonl | jq 'select(.event == "IMAGE_UPLOADED")'
```

---

## 常见操作示例

### 1. 获取所有图片列表

```typescript
import { getDb } from './00_kernel/storage/db';

async function getAllImages() {
  const db = await getDb();
  const images = await db.select<ImageRow[]>(
    'SELECT * FROM images ORDER BY uploaded_at DESC'
  );
  return images;
}
```

### 2. 检查图片是否已存在 (通过 MD5)

```typescript
async function imageExists(md5: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.select<ImageRow[]>(
    'SELECT id FROM images WHERE md5 = ?',
    [md5]
  );
  return result.length > 0;
}
```

### 3. 清除所有数据

```typescript
import { clearBusinessData } from './00_kernel/storage/db';

async function clearAll() {
  // 清除数据库
  const results = await clearBusinessData();
  console.log('Deleted:', results);  // { images: 100, transactions: 50, ... }
  
  // ⚠️ 需要手动删除图片文件（Issue #178）
  // TODO: 实现文件删除逻辑
}
```

### 4. 获取存储使用情况

```typescript
async function getStorageStats() {
  const db = await getDb();
  
  // 图片数量
  const imageCount = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM images'
  );
  
  // 总文件大小
  const totalSize = await db.select<{ total: number }[]>(
    'SELECT SUM(file_size) as total FROM images'
  );
  
  return {
    imageCount: imageCount[0].count,
    totalSize: totalSize[0].total,
    formattedSize: formatBytes(totalSize[0].total)
  };
}
```

---

## 迁移和版本管理

### Schema 版本

**存储位置**: `settings` 表，key = `schema_version`

**管理文件**: `app/src/00_kernel/storage/migrations.ts`

### 迁移流程

```typescript
// app/src/00_kernel/storage/migrations.ts

export async function runMigrations(db: Database): Promise<void> {
  const currentVersion = await getSchemaVersion();
  
  // 按顺序执行迁移
  if (currentVersion < 1) {
    await migration_001_create_images_table(db);
  }
  if (currentVersion < 2) {
    await migration_002_add_user_id_column(db);
  }
  
  await setSchemaVersion(LATEST_VERSION);
}
```

### 数据迁移标记

**文件**: `{appDataDir}/.migration_v1_complete`

用于标记从旧版本到新版本的一次性数据迁移是否完成。

---

## 故障排查

### 数据库锁定

**症状**: "database is locked" 错误

**原因**: SQLite 不支持并发写入

**解决**:
```typescript
// 使用事务
await db.execute('BEGIN TRANSACTION');
try {
  await db.execute('INSERT INTO images ...');
  await db.execute('INSERT INTO transactions ...');
  await db.execute('COMMIT');
} catch (error) {
  await db.execute('ROLLBACK');
  throw error;
}
```

### 图片文件丢失

**症状**: 数据库有记录，但文件不存在

**诊断**:
```bash
# 检查文件是否存在
ls -la ~/Library/Application\ Support/com.yorutsuke.app/images/

# 对比数据库记录数和文件数
sqlite3 yorutsuke.db "SELECT COUNT(*) FROM images;"
ls -1 ~/Library/Application\ Support/com.yorutsuke.app/images/ | wc -l
```

### Mock 模式不生效

**症状**: 切换 Mock 模式后仍使用生产数据

**原因**: `getDb()` 缓存了数据库连接

**解决**: 确保在切换模式后重新调用 `getDb()`

---

## 安全和隐私

### 数据加密

**当前状态**: ❌ 未加密

- SQLite 数据库是明文存储
- 图片文件是明文存储

**未来计划**: 考虑使用 SQLCipher 加密数据库

### 数据备份

**当前状态**: ❌ 无自动备份

**手动备份**:
```bash
# 备份数据库
cp ~/Library/Application\ Support/com.yorutsuke.app/yorutsuke.db ~/backups/

# 备份图片
cp -r ~/Library/Application\ Support/com.yorutsuke.app/images/ ~/backups/images/
```

---

## 相关文件索引

| 文件 | 功能 |
|------|------|
| `app/src-tauri/src/lib.rs` | 图片压缩、目录管理 (Rust) |
| `app/src/00_kernel/storage/db.ts` | 数据库连接、操作 |
| `app/src/00_kernel/storage/migrations.ts` | Schema 迁移 |
| `app/src/02_modules/capture/adapters/imageDb.ts` | 图片数据库操作 |
| `app/src/00_kernel/telemetry/logger.ts` | 日志系统 |

---

## 快速参考

### 路径获取

```typescript
// 前端 (通过 Tauri API)
import { appDataDir } from '@tauri-apps/api/path';
const dataDir = await appDataDir();
```

### 数据库连接

```typescript
import { getDb } from './00_kernel/storage/db';
const db = await getDb();  // 自动根据 mock 模式选择数据库
```

### 图片压缩

```typescript
import { invoke } from '@tauri-apps/api/core';
const result = await invoke('compress_image', { inputPath, imageId });
```

### 日志记录

```typescript
import { logger, EVENTS } from './00_kernel/telemetry/logger';
logger.info(EVENTS.IMAGE_UPLOADED, { imageId, fileSize });
```

---

## 相关文档

- **架构概述**: [architecture/STORAGE.md](../architecture/STORAGE.md) - 存储策略和生命周期
- **数据模型**: [architecture/SCHEMA.md](../architecture/SCHEMA.md) - 数据库表结构
- **日志系统**: [operations/LOGGING.md](./LOGGING.md) - 日志设计和查询
- **配额管理**: [operations/QUOTA.md](./QUOTA.md) - 配额限制和计算

---

**Last Updated**: 2026-01-27
**Status**: 基于当前 development 分支代码

