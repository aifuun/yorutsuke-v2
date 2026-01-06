# MVP Plan

> Incremental testing plan for manual verification

**Version**: 3.0.0
**Last Updated**: 2026-01-05

## Architecture Context

> See [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) for full details.

### Implementation Strategy

**MVP0 先完成架构重构，后续 MVP 基于 Service 模式验证功能。**

| Aspect | Before MVP0 | After MVP0 |
|--------|-------------|------------|
| Orchestration | React headless hooks | Pure TS Services |
| State Management | useReducer | Zustand vanilla stores |
| Event Listeners | useEffect | Service.init() |
| Tauri Events | Component lifecycle | App startup (once) |

### Module Tiers

| Module | Tier | Pattern | Refactor In | Test In |
|--------|------|---------|-------------|---------|
| capture | T2 | FSM + Queue | MVP0 | MVP1, MVP2 |
| report | T1 | Fetch + Render | MVP3 | MVP3 |
| transaction | T2 | CRUD + Confirm | MVP3 | MVP3, MVP3.5 |
| batch | T3 | Saga (AWS) | N/A | MVP3 |
| auth | T2 | Login + Migration | MVP4 | MVP4 |

### ID Strategy

| ID Type | Purpose | Tested In |
|---------|---------|-----------|
| `imageId` | Entity identifier | SC-700 |
| `traceId` | Log correlation | SC-701 |
| `intentId` | Idempotency (retry-safe) | SC-702 |
| `md5` | Content deduplication | SC-703, SC-020~023 |

---

## Overview

逐步验证产品功能，从架构重构开始，每个 MVP 阶段都可独立验证。

```
MVP0 (Refactor) → MVP1 (Local) → MVP2 (Upload) → MVP3 (Batch) → MVP3.5 (Sync) → MVP4 (Auth)
   架构重构          纯本地         上传云端        夜间处理        确认回写        完整认证
```

### 阶段说明

| 阶段 | 类型 | 目标 |
|------|------|------|
| MVP0 | 重构 | headless hooks → Service pattern |
| MVP1 | 功能 | 本地拖放、压缩、队列、去重 |
| MVP2 | 功能 | S3 上传、网络处理、配额 |
| MVP3 | 功能 | 批处理、报告、交易管理 |
| MVP3.5 | 功能 | 确认回写、数据恢复 |
| MVP4 | 功能 | 认证、Tier、数据迁移 |

### 数据流向

```
MVP0:   无数据流变化（纯重构）
MVP1-2: 本地 ────────────────────────────► 云端 (图片上传)
MVP3:   本地 ◄──────────────────────────── 云端 (AI 结果拉取)
MVP3.5: 本地 ────────────────────────────► 云端 (确认回写)
MVP4:   本地 ◄──────────────────────────► 云端 (完整双向)
```

---

## MVP0 - 架构重构 (Service Pattern)

> **目标**: 将 capture 模块从 headless hooks 迁移到 Service 模式，解决 #82 StrictMode 问题

### 重构范围

| 当前文件 | 目标文件 | 说明 | 状态 |
|----------|----------|------|------|
| `useDragDrop.ts` | `captureService.ts` | Tauri 事件监听移到 Service.init() | [x] |
| `useCaptureLogic.ts` | `fileService.ts` | 压缩、去重、DB 操作 | [x] |
| `useUploadQueue.ts` | `uploadService.ts` | 上传队列、重试逻辑 | [x] |
| React `useReducer` | Zustand vanilla store | `captureStore.ts`, `uploadStore.ts` | [x] |
| `emit()` in hooks | `eventBus.emit()` in Service | 一次性通知 | [x] |

### 目录结构变化

```
app/src/02_modules/capture/
├── headless/                    # [删除] 迁移后删除
│   ├── useDragDrop.ts          → services/captureService.ts
│   ├── useCaptureLogic.ts      → services/fileService.ts
│   └── useUploadQueue.ts       → services/uploadService.ts
│
├── services/                    # [新增] 业务逻辑
│   ├── captureService.ts        # Tauri 监听 + 流程编排
│   ├── fileService.ts           # 压缩 + 去重 + DB
│   └── uploadService.ts         # 上传队列 + 重试
│
├── stores/                      # [新增] 状态管理
│   ├── captureStore.ts          # 拖放队列状态
│   └── uploadStore.ts           # 上传队列状态
│
├── hooks/                       # [新增] React 桥接
│   ├── useCaptureState.ts       # useStore(captureStore)
│   └── useUploadState.ts        # useStore(uploadStore)
│
├── adapters/                    # [保留] 无变化
│   ├── imageIpc.ts
│   ├── imageDb.ts
│   └── uploadApi.ts
│
└── views/                       # [保留] 调用方式变化
    └── CaptureView.tsx          # service.method() 替代 hook()
```

### 重构步骤

#### Phase 1: 创建 Stores

```typescript
// stores/captureStore.ts
import { createStore } from 'zustand/vanilla';

interface CaptureState {
  status: 'idle' | 'processing' | 'error';
  queue: QueuedImage[];
  currentId: ImageId | null;
}

export const captureStore = createStore<CaptureState>(() => ({
  status: 'idle',
  queue: [],
  currentId: null,
}));
```

- [x] 创建 `captureStore.ts`
- [x] 创建 `uploadStore.ts`
- [x] 定义状态类型（从 useReducer 提取）

#### Phase 2: 创建 Services

```typescript
// services/captureService.ts
class CaptureService {
  private initialized = false;

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // 一次性注册，不受 React 生命周期影响
    listen('tauri://drag-drop', this.handleDrop.bind(this));
  }

  async handleDrop(event: TauriDropEvent) {
    // 业务逻辑...
    captureStore.setState({ ... });
    eventBus.emit('file:dropped', { ... });
  }
}

export const captureService = new CaptureService();
```

- [x] 创建 `captureService.ts` (Tauri 监听)
- [x] 创建 `fileService.ts` (压缩 + 去重)
- [x] 创建 `uploadService.ts` (上传队列)
- [x] 在 `main.tsx` 调用 `captureService.init()`

#### Phase 3: 创建 React Hooks

```typescript
// hooks/useCaptureState.ts
import { useStore } from 'zustand';
import { captureStore } from '../stores/captureStore';

export function useCaptureState() {
  return useStore(captureStore);
}

export function useCaptureActions() {
  return {
    handleDrop: captureService.handleDrop.bind(captureService),
    // ...
  };
}
```

- [x] 创建 `useCaptureState.ts`
- [x] 创建 `useUploadState.ts`
- [x] View 组件改用新 hooks

#### Phase 4: 迁移 View 组件

```typescript
// views/CaptureView.tsx
function CaptureView() {
  // 读取状态
  const { queue, status } = useCaptureState();

  // 触发动作（不再是 hook 返回的函数）
  const handleRetry = () => uploadService.retry(id);

  // 一次性事件
  useAppEvent('file:duplicate', ({ id }) => {
    toast.info('重复图片已跳过');
  });

  return <DropZone>...</DropZone>;
}
```

- [x] 更新 `CaptureView.tsx`
- [x] 更新 `UploadProgress.tsx` (暂无，队列显示在 CaptureView)
- [x] 移除旧 headless hooks 引用

#### Phase 5: 清理

- [x] 删除 `headless/` 目录 (保留 useQuota.ts)
- [x] 更新 barrel exports (`index.ts`)
- [x] 运行 TypeScript 检查
- [ ] 关闭 #82

### 验收标准

| 检查项 | 验证方法 | 状态 |
|--------|----------|------|
| StrictMode 无双重注册 | Dev 模式下拖放一次只触发一次 | [ ] |
| 状态持久化 | 关闭 Modal 再打开，队列状态保留 | [ ] |
| 事件监听一次性 | App 启动只注册一次 Tauri 监听 | [ ] |
| TypeScript 编译通过 | `npm run typecheck` | [ ] |
| 现有功能不变 | 拖放→压缩→显示缩略图 | [ ] |

### 不包含

- ❌ 新功能开发
- ❌ 新测试场景（复用 MVP1 场景验证）
- ❌ report/transaction 模块重构（在各自 MVP 阶段进行）

### 环境配置

```bash
# 开发模式（StrictMode 开启）
cd app
npm run tauri dev

# 验证 StrictMode 问题已解决
# 1. 拖放图片
# 2. 检查控制台无重复日志
# 3. 检查队列只有一个条目
```

### 依赖

- 无后端依赖
- 无新 npm 包（zustand 已安装）

### 参考

- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) - 四层模型、状态归属
- [INTERFACES.md](../architecture/INTERFACES.md) - Service 接口定义
- [PROGRAM_PATHS.md](../operations/PROGRAM_PATHS.md) - 当前代码流程（重构后需更新）

---

## MVP1 - 纯本地 (Local Only)

> **目标**: 验证本地捕获流程，无需任何后端

### 功能范围

| 功能 | 说明 | 状态 |
|------|------|------|
| 拖放图片 | Drag & drop 到应用窗口 | [ ] |
| 点击选择 | 点击 Drop Zone 打开文件选择器 | [ ] |
| 粘贴图片 | Ctrl+V / Cmd+V 粘贴剪贴板图片 | [ ] |
| 图片压缩 | JPEG/PNG → WebP (<500KB) | [ ] |
| 队列显示 | 显示 pending/compressed 状态 | [ ] |
| 本地存储 | SQLite 存储图片元数据 | [ ] |
| 重复检测 | MD5 去重 | [ ] |
| 缩略图 | 显示压缩后预览 | [ ] |

### 测试场景

从 [FRONTEND.md](../tests/FRONTEND.md) 选取：

#### 1.1 Happy Path
| ID | 场景 | 预期 |
|----|------|------|
| SC-001 | 单张图片拖放 | 压缩成功，状态 compressed |
| SC-002 | 多张图片拖放 | 顺序处理 |
| SC-003 | 大图 (>5MB) | 压缩到 <500KB |
| SC-004 | 小图 (<100KB) | 仍压缩为 WebP |
| SC-005 | 点击选择单张图片 | 文件选择器打开，选择后处理 |
| SC-006 | 点击选择多张图片 | 支持多选，顺序处理 |
| SC-007 | 粘贴截图 (Cmd+V) | 剪贴板图片处理 |
| SC-008 | 粘贴单张图片文件 | 文件数据处理 |
| SC-009 | 粘贴多张图片文件 | 顺序处理所有文件 |

#### 1.2 File Validation
| ID | 场景 | 预期 |
|----|------|------|
| SC-010 | 有效格式 (JPG/PNG/HEIC) | 全部接受 |
| SC-011 | 无效格式 (.txt/.pdf) | 拒绝并提示 |
| SC-012 | 损坏图片 | 错误: "Failed to open image" |
| SC-013 | 空文件 | 优雅处理错误 |

#### 1.3 Duplicate Detection
| ID | 场景 | 预期 |
|----|------|------|
| SC-020 | 同文件两次 | 第二次检测为重复 |
| SC-021 | 相同内容不同名 | MD5 检测为重复 |
| SC-022 | 相似但不同 | 两张都处理 (MD5 不同) |
| SC-023 | 快速双击 | 只处理一次 |

#### 6.1 App Lifecycle - Startup
| ID | 场景 | 预期 |
|----|------|------|
| SC-500 | 全新安装 | DB 初始化，guest 模式 |
| SC-501 | 恢复会话 | 关闭后重开，队列恢复 |
| SC-502 | 恢复 pending | 崩溃后重开，pending 重新处理 |
| SC-503 | 恢复 uploading | 崩溃后重开，重置为 compressed |

#### 8. Data Integrity
| ID | 场景 | 预期 |
|----|------|------|
| SC-700 | ImageId 唯一 | 拖放 100 张，ID 都唯一 |
| SC-701 | TraceId 追踪 | 拖放→压缩→日志，traceId 一致 |
| SC-702 | IntentId 幂等 | 上传→重试，intentId 不变 |
| SC-703 | MD5 准确 | 同图两次，MD5 相同 |
| SC-710 | 队列-DB 同步 | 拖放→压缩→检查 DB，数据一致 |
| SC-711 | 状态转换 | 遵循允许的状态转换路径 |
| SC-712 | 无孤儿记录 | 处理多张图片，DB 无孤儿 |

#### 14. Performance (NFR)
| ID | 场景 | 预期 |
|----|------|------|
| SC-1400 | App bundle 大小 | < 5MB |
| SC-1410 | 小图压缩 (<1MB) | < 1 秒 |
| SC-1411 | 中图压缩 (1-5MB) | < 2 秒 |
| SC-1412 | 大图压缩 (>5MB) | < 3 秒 |
| SC-1420 | 冷启动 | < 3 秒 |

### 环境配置

```bash
# Mock 模式 - 跳过所有网络请求
cd app
cp .env.mock .env.local
npm run tauri dev
```

### 验收标准

- [ ] 拖放 10 张不同图片，全部压缩成功
- [ ] 拖放重复图片，正确检测并跳过
- [ ] 重启应用后，队列状态从 SQLite 恢复
- [ ] 无网络环境下正常工作
- [ ] 所有 SC-001~023 通过
- [ ] 所有 SC-500~503 通过
- [ ] 所有 SC-700~712 通过
- [ ] 所有 SC-1400, SC-1410~1412, SC-1420 通过 (Performance)

### 依赖

- 无后端依赖
- Mock 模式启用

---

## MVP2 - 上传云端 (Upload)

> **目标**: 验证图片上传到 S3

### 功能范围

| 功能 | 说明 | 状态 |
|------|------|------|
| Presigned URL | 从 Lambda 获取上传 URL | [ ] |
| S3 上传 | 上传 WebP 到 S3 | [ ] |
| 网络状态 | 显示 online/offline | [ ] |
| 上传重试 | 失败自动重试 (最多 3 次) | [ ] |
| 离线队列 | 离线时暂停，恢复后继续 | [ ] |
| Quota 显示 | 显示今日使用量/限额 | [ ] |

### 测试场景

从 [FRONTEND.md](../tests/FRONTEND.md) 选取：

#### 4.1 Network - Offline Handling
| ID | 场景 | 预期 |
|----|------|------|
| SC-300 | 离线启动 | 本地功能正常 |
| SC-301 | 上传中断网 | 暂停并显示 offline |
| SC-302 | 恢复网络 | 自动继续上传 |
| SC-303 | 离线指示器 | UI 显示离线状态 |

> **Note**: SC-304~307 (离线交易操作) 移至 MVP3，因为交易数据需要 AI 批处理后才存在。

#### 5.2 Error Recovery - Database
| ID | 场景 | 预期 |
|----|------|------|
| SC-410 | DB 写入失败 | 压缩 OK → DB 锁定，清理临时文件 |
| SC-411 | DB 损坏 | 打开应用，重置或报错 |
| SC-412 | 迁移失败 | 打开应用，回滚或报错 |

#### 4.2 Network - Instability
| ID | 场景 | 预期 |
|----|------|------|
| SC-310 | 不稳定连接 | 模拟丢包，指数退避重试 |
| SC-311 | 超时处理 | 慢网络 (>15s) 压缩超时 |
| SC-312 | 上传重试 | 自动重试最多 3 次 |
| SC-313 | 永久失败 | 状态 failed，可手动重试 |

#### 4.3 Network - Race Conditions
| ID | 场景 | 预期 |
|----|------|------|
| SC-320 | 上传中断网 | 保持 paused 状态，非 idle |
| SC-321 | 重试中恢复 | 恢复后正常完成 |

#### 5.1 Error Recovery - Compression
| ID | 场景 | 预期 |
|----|------|------|
| SC-400 | 源文件删除 | 报错，其他图片继续 |
| SC-401 | 磁盘满 | 清晰错误消息 |
| SC-402 | 内存压力 | 优雅降级 |

#### 5.3 Error Recovery - Upload
| ID | 场景 | 预期 |
|----|------|------|
| SC-420 | URL 过期 | 获取新 URL 重试 |
| SC-421 | S3 访问拒绝 | 报错，不重试 |
| SC-422 | 配额超限 (服务端) | 暂停队列，显示消息 |
| SC-423 | 服务限制 | 显示"服务暂时不可用" |

#### 6.2 App Lifecycle - Background/Foreground
| ID | 场景 | 预期 |
|----|------|------|
| SC-510 | 切到后台 | 上传继续 (Tauri) |
| SC-511 | 回到前台 | 状态同步显示 |
| SC-512 | 长时间后台 | 后台 1 小时后返回，配额刷新 |

### 环境配置

```bash
# 需要部署 presign Lambda
cd infra
cdk deploy YorutsukePresignStack --profile dev

# 配置 Lambda URL
cd app
echo "VITE_LAMBDA_PRESIGN_URL=https://xxx.lambda-url.ap-northeast-1.on.aws" >> .env.local
npm run tauri dev
```

### 验收标准

- [ ] 上传 5 张图片到 S3，全部成功
- [ ] 断网后上传暂停，恢复后自动继续
- [ ] 上传失败后自动重试
- [ ] Quota 正确显示 (used/limit)
- [ ] 所有 SC-300~303 通过 (Offline Handling)
- [ ] 所有 SC-410~412 通过 (Database Errors)
- [ ] 所有 SC-310~313 通过 (Instability)
- [ ] 所有 SC-320~321 通过 (Race Conditions)
- [ ] 所有 SC-400~402 通过 (Compression Errors)
- [ ] 所有 SC-420~423 通过 (Upload Errors)
- [ ] 所有 SC-510~512 通过 (Background/Foreground)

### 依赖

- Lambda: `presign`
- S3: `yorutsuke-images-dev`

---

## MVP3 - 夜间处理 (Batch + Report)

> **目标**: 验证完整 AI 处理流程

### 功能范围

| 功能 | 说明 | 状态 |
|------|------|------|
| 批处理触发 | 02:00 JST 自动运行 | [ ] |
| Nova Lite OCR | AI 提取金额/商户/分类 | [ ] |
| 晨报展示 | 昨日收支汇总 | [ ] |
| 交易列表 | 显示 AI 提取的交易 | [ ] |
| 确认/编辑 | 确认或修改交易 | [ ] |
| 历史日历 | 按日期查看历史 | [ ] |
| 分类统计 | 按分类汇总 | [ ] |

### 测试场景

从 [FRONTEND.md](../tests/FRONTEND.md) 和 [BACKEND.md](../tests/BACKEND.md) 选取：

#### Backend: Batch Processing (SB-2xx)
| ID | 场景 | 预期 |
|----|------|------|
| SB-200 | 定时触发 | EventBridge 02:00 JST 触发 |
| SB-201 | 手动触发 | Lambda 直接调用成功 |
| SB-202 | 空队列 | 无 pending 图片时跳过 |
| SB-210 | 清晰收据 | 提取商户、金额、分类 |
| SB-211 | 模糊收据 | 低置信度 (<0.7) |
| SB-220 | 创建交易 | OCR 结果写入 DynamoDB |
| SB-221 | 去重 | 同图不创建重复交易 |

#### Frontend: Dashboard (SC-9xx)
| ID | 场景 | 预期 |
|----|------|------|
| SC-900 | 加载仪表盘 | 显示今日汇总 |
| SC-901 | 空日期 | 无交易显示零值 |
| SC-902 | 收入显示 | 正确收入金额 |
| SC-903 | 支出显示 | 正确支出金额 |
| SC-904 | 净利润 | 净值 = 收入 - 支出 |
| SC-910 | 待确认数 | 正确显示待确认数量 |
| SC-920 | 队列空 | 显示"Ready"状态 |
| SC-921 | 队列活跃 | 显示数量和状态 |

#### Frontend: Transaction/Ledger (SC-8xx)
| ID | 场景 | 预期 |
|----|------|------|
| SC-800 | 加载交易 | 按日期降序显示 |
| SC-801 | 空状态 | 显示"无记录" |
| SC-805 | 按类型筛选 | 选择 income/expense | 只显示该类型 |
| SC-806 | 按分类筛选 | 选择 sale/purchase 等 | 只显示该分类 |
| SC-807 | 组合筛选 | 年+月+类型 | 全部正确应用 |
| SC-810 | 确认交易 | confirmedAt 设置，标签移除 |
| SC-811 | 删除交易 | 确认对话框后删除 |
| SC-820 | 收入合计 | 正确收入总和 |
| SC-821 | 支出合计 | 正确支出总和 |

#### Frontend: Report History (SC-9xx)
| ID | 场景 | 预期 |
|----|------|------|
| SC-930 | 日历视图 | 显示带交易指示的日历 |
| SC-931 | 选择历史日期 | 点击日历日期显示该日报告 |
| SC-932 | 月度汇总 | 点击月份头部显示月汇总 |
| SC-933 | 月份导航 | 点击前/后箭头切换月份 |
| SC-934 | 空日期 | 点击无交易日期显示空状态 |

#### Offline CRUD (SC-3xx, 从 MVP2 移入)
| ID | 场景 | 预期 |
|----|------|------|
| SC-304 | 离线查看交易 | 断网→打开 Ledger，本地交易显示 |
| SC-305 | 离线查看仪表盘 | 断网→打开 Dashboard，本地汇总显示 |
| SC-306 | 离线确认交易 | 断网→确认交易，本地 DB 更新，同步队列 |
| SC-307 | 离线删除交易 | 断网→删除交易，本地删除，同步队列 |

### 环境配置

```bash
# 部署完整后端
cd infra
cdk deploy --all --profile dev

# 手动触发批处理 (测试用)
aws lambda invoke \
  --function-name yorutsuke-batch-dev \
  --profile dev \
  /tmp/out.json
```

### 验收标准

- [ ] 上传的收据被 AI 正确解析
- [ ] 晨报显示昨日汇总
- [ ] 可以确认/编辑/删除交易 (**本地确认，云端同步在 MVP3.5**)
- [ ] 历史日历可以查看过去 7 天
- [ ] 所有 SB-200~221 通过 (Backend Batch)
- [ ] 所有 SC-304~307 通过 (Offline CRUD)
- [ ] 所有 SC-800~821 通过 (Transaction/Ledger)
- [ ] 所有 SC-900~921 通过 (Dashboard)
- [ ] 所有 SC-930~934 通过 (Report History)

> **Note**: MVP3 中的确认/编辑/删除只写入本地 SQLite。云端同步（写入 DynamoDB）在 MVP3.5 实现。

### 依赖

- Lambda: `presign`, `batch`, `batch-process`
- S3: `yorutsuke-images-dev`
- DynamoDB: `yorutsuke-transactions-dev` (只读，AI 写入)
- Bedrock: Nova Lite

---

## MVP3.5 - 确认回写 (Cloud Sync)

> **目标**: 验证用户确认的交易同步到云端，支持数据恢复

### 背景

```
当前问题：
- 图片已上传到 S3 ✓
- AI 结果存在 DynamoDB ✓
- 用户确认只存本地 SQLite ✗ ← 设备丢失 = 数据丢失

解决方案：
- 确认交易时同步到 DynamoDB
- 新设备登录时可恢复已确认交易
```

### 功能范围

| 功能 | 说明 | 状态 |
|------|------|------|
| 确认回写 | 确认交易时同步到 DynamoDB | [ ] |
| 编辑回写 | 修改金额/分类后同步 | [ ] |
| 删除回写 | 删除交易时同步 | [ ] |
| 离线队列 | 离线时暂存，恢复后同步 | [ ] |
| 数据恢复 | 新设备登录拉取已确认交易 | [ ] |
| 冲突处理 | Last-Write-Wins 策略 | [ ] |

### 数据流

```
确认交易时：
┌─────────────────┐                  ┌─────────────────┐
│ 用户点击确认     │                  │ DynamoDB        │
│       ↓         │                  │                 │
│ SQLite 更新     │ ──── POST ────► │ transactions/   │
│ confirmedAt     │   /confirm       │   confirmedAt   │
│                 │                  │   amount (修改) │
└─────────────────┘                  └─────────────────┘

新设备恢复时：
┌─────────────────┐                  ┌─────────────────┐
│ 登录成功        │                  │ DynamoDB        │
│       ↓         │  ◄─── GET ────  │                 │
│ 检测云端数据     │   /confirmed     │ 已确认交易列表   │
│       ↓         │                  │                 │
│ 提示恢复？      │                  │                 │
│       ↓         │                  │                 │
│ 写入 SQLite     │                  │                 │
└─────────────────┘                  └─────────────────┘
```

### API 设计

```typescript
// POST /transactions/confirm
{
  transactionId: string;
  confirmedAt: string;
  amount?: number;      // 用户修改后的金额
  category?: string;    // 用户修改后的分类
  description?: string; // 用户修改后的描述
}

// GET /transactions/confirmed?userId=xxx
{
  transactions: Transaction[];
  lastSyncAt: string;
}

// DELETE /transactions/{id}
// 标记为已删除，不物理删除
```

### 测试场景

从 [FRONTEND.md](../tests/FRONTEND.md) Section 15 选取：

#### 15.1 Confirmation Sync
| ID | 场景 | 预期 |
|----|------|------|
| SC-1500 | 确认同步到云端 | DynamoDB 有 confirmedAt |
| SC-1501 | 修改后同步 | 云端有更新后的金额 |
| SC-1502 | 删除同步到云端 | 云端标记为已删除 |
| SC-1503 | 离线确认入队 | 同步队列，显示 pending |
| SC-1504 | 恢复网络后处理 | 队列中的同步完成 |

#### 15.2 Data Recovery
| ID | 场景 | 预期 |
|----|------|------|
| SC-1510 | 新设备检测 | 显示"发现云端数据" |
| SC-1511 | 恢复确认数据 | 已确认交易恢复到 SQLite |
| SC-1512 | 拒绝恢复 | 从头开始，云端数据不变 |
| SC-1513 | 合并恢复 | 本地+云端合并，无重复 |

#### 15.3 Conflict Resolution
| ID | 场景 | 预期 |
|----|------|------|
| SC-1520 | 最后写入优先 | 两设备编辑，新时间戳覆盖 |
| SC-1521 | 离线冲突 | 离线编辑→同步→冲突，新版本生效 |

### 环境配置

```bash
# 需要新增 Lambda: transactions-sync
cd infra
cdk deploy YorutsukeTransactionSyncStack --profile dev

# 配置 Sync API
cd app
echo "VITE_LAMBDA_SYNC_URL=https://xxx.lambda-url.ap-northeast-1.on.aws" >> .env.local
npm run tauri dev
```

### 验收标准

- [ ] 确认交易后 DynamoDB 有记录
- [ ] 修改交易后云端数据更新
- [ ] 删除交易后云端标记删除
- [ ] 离线确认，恢复后自动同步
- [ ] 新设备登录可恢复已确认交易
- [ ] 本地和云端数据一致
- [ ] 所有 SC-1500~1504 通过 (Confirmation Sync)
- [ ] 所有 SC-1510~1513 通过 (Data Recovery)
- [ ] 所有 SC-1520~1521 通过 (Conflict Resolution)

### 依赖

- Lambda: `transactions-sync` (新增)
- DynamoDB: `yorutsuke-transactions-dev` (读写)
- 需要先完成 MVP3

### 实现要点

```typescript
// 1. 确认时同步 (异步，不阻塞 UI)
const confirm = async (id: TransactionId) => {
  await confirmTransaction(id);  // 本地
  dispatch({ type: 'CONFIRM_SUCCESS', id });

  // 异步同步到云端
  syncToCloud(id).catch(queueForRetry);
};

// 2. 离线队列
interface SyncQueue {
  pending: Array<{
    action: 'confirm' | 'update' | 'delete';
    transactionId: string;
    data: Partial<Transaction>;
    queuedAt: string;
  }>;
}

// 3. 恢复流程
const onLogin = async (userId: UserId) => {
  const cloudData = await fetchConfirmedTransactions(userId);
  if (cloudData.length > 0) {
    const shouldRestore = await askUser('检测到云端数据，是否恢复？');
    if (shouldRestore) {
      await mergeToLocal(cloudData);
    }
  }
};
```

---

## MVP4 - 完整认证 (Full Auth)

> **目标**: 验证用户系统和配额管理

### 功能范围

| 功能 | 说明 | 状态 |
|------|------|------|
| Guest 模式 | 无需登录即可使用 | [ ] |
| 注册流程 | Email + 验证码 | [ ] |
| 登录/登出 | Cognito 认证 | [ ] |
| Guest 数据迁移 | 登录后认领 Guest 数据 | [ ] |
| Tier 配额 | guest/free/basic/pro 限额 | [ ] |
| Token 刷新 | 自动刷新过期 Token | [ ] |
| 设置持久化 | 主题/语言/通知 | [ ] |

### 测试场景

从 [FRONTEND.md](../tests/FRONTEND.md) 选取：

#### 2.1 Quota - Guest User
| ID | 场景 | 预期 |
|----|------|------|
| SC-100 | Guest 默认配额 | limit=30, tier=guest |
| SC-101 | Guest 过期警告 | 46+ 天显示"X 天后过期" |
| SC-102 | Guest 接近限额 | 28/30 显示剩余数量 |
| SC-103 | Guest 达到限额 | 30/30 阻止上传，提示消息 |

#### 2.2 Quota - Free Tier
| ID | 场景 | 预期 |
|----|------|------|
| SC-110 | Free Tier 配额 | limit=50, 无过期警告 |
| SC-111 | Free 达到限额 | 50/50 阻止，建议升级 |
| SC-112 | Free 配额重置 | 午夜 JST 重置 |

#### 2.3 Quota - Paid Tiers
| ID | 场景 | 预期 |
|----|------|------|
| SC-120 | Basic Tier 配额 | limit=100 |
| SC-121 | Pro Tier 配额 | limit=500 或无限制 |

#### 2.4 Quota Persistence
| ID | 场景 | 预期 |
|----|------|------|
| SC-130 | 配额持久化 | 重启后 used 保持 |
| SC-131 | 跨会话配额 | 关闭重开后累计正确 |

#### 3.1 Tier Transitions - Guest → Registered
| ID | 场景 | 预期 |
|----|------|------|
| SC-200 | 注册流程 | Guest → Register → Verify → Login |
| SC-201 | 登录认领数据 | Guest 图片迁移到新账户 |
| SC-201a | 认领后配额 | 配额重置为新 Tier 限额 |
| SC-202 | 队列连续性 | 队列保留或同步 |
| SC-203 | 本地 DB 更新 | images.user_id 更新 |

#### 3.2 Tier Transitions - Upgrade
| ID | 场景 | 预期 |
|----|------|------|
| SC-210 | 会话中升级 | 支付后显示新限额 |
| SC-211 | 限额时升级 | 50/50 → 升级 → 可继续上传 |
| SC-212 | 升级生效时间 | 即时生效 |

#### 3.3 Tier Transitions - Downgrade
| ID | 场景 | 预期 |
|----|------|------|
| SC-220 | 降级配额 | 80/100 → 降级 → 显示 80/50 |
| SC-221 | 降级阻止 | 超限后阻止上传直到重置 |
| SC-222 | 降级数据保留 | 历史数据保留 |

#### 7.1 Auth - Login/Logout
| ID | 场景 | 预期 |
|----|------|------|
| SC-600 | 登录成功 | 显示用户信息 |
| SC-601 | 登录失败 | 错误消息，可重试 |
| SC-602 | 登出 | 清除 Token，返回 Guest |
| SC-603 | Session 过期 | 自动刷新或重新登录 |

### 环境配置

```bash
# 部署认证栈
cd infra
cdk deploy YorutsukeAuthStack --profile dev

# 配置 Auth API
cd app
echo "VITE_AUTH_API_URL=https://xxx.execute-api.ap-northeast-1.amazonaws.com/prod" >> .env.local
npm run tauri dev
```

### 验收标准

- [ ] Guest 用户可以使用基本功能
- [ ] 注册 → 验证 → 登录流程完整
- [ ] Guest 数据正确迁移到注册账户
- [ ] 不同 Tier 配额正确显示和限制
- [ ] 设置修改后重启仍保留
- [ ] 所有 SC-100~103 通过 (Guest Quota)
- [ ] 所有 SC-110~112 通过 (Free Tier)
- [ ] 所有 SC-120~121 通过 (Paid Tiers)
- [ ] 所有 SC-130~131 通过 (Quota Persistence)
- [ ] 所有 SC-200~222 通过 (Tier Transitions)
- [ ] 所有 SC-600~603 通过 (Auth)

### 依赖

- Cognito: User Pool
- Lambda: `auth-*`
- 完整后端部署

---

## 进度追踪

| MVP | 目标 | 开始日期 | 完成日期 | 状态 |
|-----|------|----------|----------|------|
| MVP0 | 架构重构 | 2026-01-05 | 2026-01-05 | [x] 完成 |
| MVP1 | 纯本地 | - | - | [ ] 未开始 |
| MVP2 | 上传云端 | - | - | [ ] 未开始 |
| MVP3 | 夜间处理 | - | - | [ ] 未开始 |
| MVP3.5 | 确认回写 | - | - | [ ] 未开始 |
| MVP4 | 完整认证 | - | - | [ ] 未开始 |

---

## 测试检查表

每个 MVP 完成后更新：

### MVP0 检查表
- [x] Phase 1: Stores 创建完成
- [x] Phase 2: Services 创建完成
- [x] Phase 3: React Hooks 创建完成
- [x] Phase 4: View 组件迁移完成
- [x] Phase 5: 旧代码清理完成 (删除 useCaptureLogic, useDragDrop, useUploadQueue)
- [ ] StrictMode 无双重注册 (#82) - 需手动测试
- [x] TypeScript 编译通过 (Vite 环境)
- [ ] 基本功能验证（拖放→压缩→显示）- 需手动测试
- [x] PROGRAM_PATHS.md 更新
- [x] SCHEMA.md 更新 (CaptureStore 定义)
- [x] INTERFACES.md 更新 (EventBus 事件)

### MVP1 检查表
- [ ] 所有 SC-001~004 通过 (Happy Path)
- [ ] 所有 SC-010~013 通过 (File Validation)
- [ ] 所有 SC-020~023 通过 (Duplicate Detection)
- [ ] 所有 SC-500~503 通过 (App Lifecycle)
- [ ] 所有 SC-700~712 通过 (Data Integrity)
- [ ] 所有 SC-1400~1420 通过 (Performance)
- [ ] 截图/录屏存档

### MVP2 检查表
- [ ] 所有 SC-300~303 通过 (Offline Handling)
- [ ] 所有 SC-310~313 通过 (Network Instability)
- [ ] 所有 SC-320~321 通过 (Race Conditions)
- [ ] 所有 SC-400~402 通过 (Compression Errors)
- [ ] 所有 SC-410~412 通过 (Database Errors)
- [ ] 所有 SC-420~423 通过 (Upload Errors)
- [ ] 所有 SC-510~512 通过 (Background/Foreground)
- [ ] S3 验证有上传文件
- [ ] 截图/录屏存档

### MVP3 检查表
- [ ] 所有 SB-200~221 通过 (Backend Batch)
- [ ] 所有 SC-304~307 通过 (Offline CRUD)
- [ ] 所有 SC-800~821 通过 (Transaction/Ledger)
- [ ] 所有 SC-900~921 通过 (Dashboard)
- [ ] 所有 SC-930~934 通过 (Report History)
- [ ] 批处理成功运行
- [ ] AI 提取结果正确
- [ ] 截图/录屏存档

### MVP3.5 检查表
- [ ] 所有 SC-1500~1504 通过 (Confirmation Sync)
- [ ] 所有 SC-1510~1513 通过 (Data Recovery)
- [ ] 所有 SC-1520~1521 通过 (Conflict Resolution)
- [ ] 确认交易同步到 DynamoDB
- [ ] 修改交易同步正常
- [ ] 离线同步队列正常
- [ ] 新设备恢复成功
- [ ] 截图/录屏存档

### MVP4 检查表
- [ ] 所有 SC-100~103 通过 (Guest Quota)
- [ ] 所有 SC-110~112 通过 (Free Tier)
- [ ] 所有 SC-120~121 通过 (Paid Tiers)
- [ ] 所有 SC-130~131 通过 (Quota Persistence)
- [ ] 所有 SC-200~222 通过 (Tier Transitions)
- [ ] 所有 SC-600~603 通过 (Auth)
- [ ] Cognito 用户创建成功
- [ ] 截图/录屏存档

---

## 问题记录

在测试过程中发现的问题记录到 GitHub Issues，格式：

```
标题: [MVPx] 简短描述
标签: bug, mvp1/mvp2/mvp3/mvp4
内容:
- 测试场景 ID
- 复现步骤
- 预期 vs 实际
- 截图/日志
```

---

## References

### Product & Testing
- [REQUIREMENTS.md](../product/REQUIREMENTS.md) - 功能需求
- [tests/](../tests/) - 测试场景详情
- [OPERATIONS.md](../operations/OPERATIONS.md) - 部署指南

### Architecture (for debugging)
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) - 系统设计、四层模型
- [SCHEMA.md](../architecture/SCHEMA.md) - 数据模型、Zustand stores
- [INTERFACES.md](../architecture/INTERFACES.md) - IPC/API 接口定义
- [PROGRAM_PATHS.md](../operations/PROGRAM_PATHS.md) - 代码流程追踪
