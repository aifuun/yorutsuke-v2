# Image 处理架构合规性检查

> 检查日期: 2026-01-10
> 参考文档: `docs/architecture/LAYERS.md`

## 执行摘要

**状态**: ⚠️ 部分违规

| 组件 | 状态 | 问题 |
|------|------|------|
| imageIpc.ts | ✅ 合规 | 正确的 Adapter 实现 |
| imageDb.ts | ✅ 合规 | 正确的 Adapter 实现 |
| imageService.ts | ❌ 违规 | Service 层直接调用 Tauri/AWS API |
| imageSyncService.ts | ❌ 违规 | Service 层直接调用 Tauri/DB |

---

## 4 层架构定义

```
Layer 1: React (View)        - UI 渲染，订阅状态
Layer 2: Service (Logic)     - 业务编排，调用 Adapter
Layer 3: Adapter (Bridge)    - IPC/API 封装
Layer 4: Tauri/AWS (Executor) - 能力执行
```

### 关键边界规则

- ❌ Service 不能直接调用 Tauri API
- ❌ Service 不能直接调用 AWS API
- ❌ Service 不能直接操作数据库
- ✅ Service 只能调用 Adapter 方法

---

## 违规详情

### 1. imageService.ts (Service 层)

**文件**: `app/src/02_modules/transaction/services/imageService.ts`

#### 违规 1.1: 直接调用 Tauri API

```typescript
// Line 44: ❌ 违规
const fileExists = await exists(imageRow.compressed_path);

// Line 46: ❌ 违规
const url = convertFileSrc(imageRow.compressed_path);
```

**问题**: Service 层直接导入和调用 `@tauri-apps/plugin-fs` 的 `exists()` 函数。

**影响**:
- 违反分层架构
- 降低可测试性（需要 mock Tauri API）
- 紧耦合到 Tauri 实现

**应该**:
```typescript
// 创建 imageAdapter.ts
export async function checkFileExists(path: string): Promise<boolean> {
  return exists(path);
}

export async function getLocalImageUrl(path: string): string {
  return convertFileSrc(path);
}

// imageService.ts 中调用
const fileExists = await imageAdapter.checkFileExists(imageRow.compressed_path);
const url = await imageAdapter.getLocalImageUrl(imageRow.compressed_path);
```

#### 违规 1.2: 直接调用 AWS API

```typescript
// Line 64-82: ❌ 违规
const response = await fetch(presignUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'download',
    s3Key: imageRow.s3_key,
  }),
});
```

**问题**: Service 层直接调用 AWS presign Lambda。

**影响**:
- 违反分层架构
- 重复代码（如果多个 Service 需要 presign）
- 难以切换 API 实现

**应该**:
```typescript
// 创建 presignAdapter.ts
export async function getS3DownloadUrl(s3Key: string): Promise<string> {
  const presignUrl = import.meta.env.VITE_LAMBDA_PRESIGN_URL;
  if (!presignUrl) {
    throw new Error('Presign Lambda URL not configured');
  }

  const response = await fetch(presignUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'download',
      s3Key,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get presigned URL: ${response.statusText}`);
  }

  const data = await response.json();
  return data.url;
}

// imageService.ts 中调用
const url = await presignAdapter.getS3DownloadUrl(imageRow.s3_key);
```

---

### 2. imageSyncService.ts (Service 层)

**文件**: `app/src/02_modules/transaction/services/imageSyncService.ts`

#### 违规 2.1: 直接调用 Tauri API

```typescript
// Line 48: ❌ 违规
const fileExists = await exists(localImage.compressed_path);
```

**问题**: 与 imageService.ts 相同的违规。

**应该**: 使用 `imageAdapter.checkFileExists()`

#### 违规 2.2: 直接调用数据库

```typescript
// Line 65-68: ❌ 违规
await execute(
  'UPDATE images SET s3_key = ? WHERE id = ?',
  [transaction.s3Key, String(imageId)]
);

// Line 90-102: ❌ 违规
await execute(
  `INSERT INTO images (
    id, user_id, trace_id, s3_key, status, created_at
  ) VALUES (?, ?, ?, ?, ?, ?)`,
  [...]
);
```

**问题**: Service 层直接调用 `execute()` 操作数据库。

**影响**:
- 违反分层架构
- SQL 分散在多个文件
- 数据库逻辑无法复用

**应该**:
```typescript
// 扩展 imageDb.ts
export async function updateImageS3Key(
  imageId: ImageIdType,
  s3Key: string
): Promise<void> {
  await execute(
    'UPDATE images SET s3_key = ? WHERE id = ?',
    [s3Key, String(imageId)]
  );
}

export async function createImageRecord(params: {
  id: ImageIdType;
  userId: UserId;
  traceId: TraceId;
  s3Key: string;
  createdAt: string;
}): Promise<void> {
  await execute(
    `INSERT INTO images (
      id, user_id, trace_id, s3_key, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      String(params.id),
      String(params.userId),
      String(params.traceId),
      params.s3Key,
      'uploaded',
      params.createdAt,
    ]
  );
}

// imageSyncService.ts 中调用
await imageDb.updateImageS3Key(imageId, transaction.s3Key);
await imageDb.createImageRecord({ id: imageId, userId, traceId, s3Key, createdAt });
```

---

## 正确实现示例

### ✅ imageIpc.ts (Adapter 层)

```typescript
// 正确的 Adapter 实现
export async function compressImage(
  inputPath: string,
  imageId: ImageId,
): Promise<ImageCompressResult> {
  const rawResult = await invoke<CompressResult>('compress_image', {
    inputPath,
    imageId: String(imageId),
  });

  // Pillar B: Validate at boundary
  const result = validateCompressResult(rawResult);

  return {
    id: imageId,
    originalPath: result.original_path,
    outputPath: result.output_path,
    // ...
  };
}
```

**为什么正确**:
- ✅ 只封装 Tauri IPC 调用
- ✅ 做边界验证（Pillar B）
- ✅ 没有业务逻辑
- ✅ 返回领域类型（Branded types）

### ✅ imageDb.ts (Adapter 层)

```typescript
// 正确的 Adapter 实现
export async function findImageByMd5(
  md5: string,
  traceId: TraceId,
): Promise<ImageIdType | null> {
  const rows = await select<Array<{ id: string }>>(
    'SELECT id FROM images WHERE md5 = ? LIMIT 1',
    [md5],
  );

  if (rows.length > 0) {
    return ImageId(rows[0].id);
  }

  return null;
}
```

**为什么正确**:
- ✅ 只封装数据库操作
- ✅ 没有业务逻辑
- ✅ 返回领域类型（Branded types）
- ✅ 数据库细节不泄露到 Service 层

---

## 修复建议

### 优先级 P1: 立即修复

1. **创建 `imageAdapter.ts`** (Adapter 层)
   ```typescript
   // app/src/02_modules/transaction/adapters/imageAdapter.ts
   export async function checkFileExists(path: string): Promise<boolean>
   export async function getLocalImageUrl(path: string): Promise<string>
   ```

2. **创建 `presignAdapter.ts`** (Adapter 层)
   ```typescript
   // app/src/02_modules/transaction/adapters/presignAdapter.ts
   export async function getS3DownloadUrl(s3Key: string): Promise<string>
   ```

3. **扩展 `imageDb.ts`** (Adapter 层)
   ```typescript
   // app/src/02_modules/capture/adapters/imageDb.ts
   export async function updateImageS3Key(imageId: ImageIdType, s3Key: string): Promise<void>
   export async function createImageRecord(params: ImageRecordParams): Promise<void>
   ```

4. **重构 Service 层**
   - `imageService.ts`: 移除所有 Tauri/AWS API 调用
   - `imageSyncService.ts`: 移除所有 Tauri/DB 调用
   - 只调用 Adapter 方法

### 优先级 P2: 优化改进

5. **添加单元测试**
   - Adapter 层：Mock Tauri/AWS API
   - Service 层：Mock Adapter 方法
   - 验证分层隔离

6. **文档更新**
   - 更新 `INTERFACES.md` 记录新增 Adapter 接口

---

## 架构图对比

### ❌ 当前实现 (违规)

```
React Component
    │
    ▼
imageService.ts ──────┐
    │                │
    ├─ getImageById() ────→ imageDb.ts (Adapter) ✅
    │                │
    ├─ exists() ─────┼────→ Tauri API 直接调用 ❌
    │                │
    └─ fetch() ──────┴────→ AWS Lambda 直接调用 ❌
```

### ✅ 应该的实现 (合规)

```
React Component
    │
    ▼
imageService.ts (Service)
    │
    ├─ getImageById() ────→ imageDb.ts (Adapter)
    │                           │
    │                           └──→ SQLite
    │
    ├─ checkFileExists() ─→ imageAdapter.ts (Adapter)
    │                           │
    │                           └──→ Tauri API
    │
    └─ getS3DownloadUrl() ─→ presignAdapter.ts (Adapter)
                                │
                                └──→ AWS Lambda
```

---

## 检查清单

### Service 层检查

- [ ] ❌ 无直接 `import { exists } from '@tauri-apps/plugin-fs'`
- [ ] ❌ 无直接 `import { fetch } from '@tauri-apps/plugin-http'`
- [ ] ❌ 无直接 `import { execute } from '00_kernel/storage'`
- [ ] ✅ 只调用 Adapter 方法
- [ ] ✅ 包含业务逻辑编排

### Adapter 层检查

- [x] ✅ 只封装 IPC/API/DB 调用
- [x] ✅ 做边界验证（Pillar B）
- [x] ✅ 返回领域类型（Branded types）
- [x] ✅ 无业务逻辑

---

## 相关文档

- [LAYERS.md](../../docs/architecture/LAYERS.md) - 4 层架构定义
- [PATTERNS.md](../../docs/architecture/PATTERNS.md) - Service 模式
- [ADR-001](../../docs/architecture/ADR/001-service-pattern.md) - Service Pattern 决策

---

## 下一步行动

1. 阅读完整报告
2. 确认修复优先级
3. 创建 GitHub Issue 跟踪重构
4. 逐步重构，保持功能不变

**估算工作量**: 2-3 小时
- 创建新 Adapter: 30 min
- 重构 Service 层: 1 hour
- 测试验证: 1 hour
