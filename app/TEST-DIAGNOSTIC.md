# 诊断导出功能测试 - 快速开始

## 30 秒设置

```bash
cd /Users/woo/dev/yorutsuke-v2-2/app
npm run test -- DiagnosticService.test.ts
```

预期: ✅ 15 passed

---

## 5 分钟集成测试

### Terminal 1: 启动应用
```bash
cd /Users/woo/dev/yorutsuke-v2-2/app
npm run tauri dev
```

### 在浏览器中:

1. **打开 Debug 面板**
   - 在应用中任意位置输入: `debug`
   - 进入 Debug View

2. **启用 Mock 模式**
   - 向下滚动找到 "Mock Mode"
   - 点击 "Online"
   - 显示: "✓ Mock: Online"

3. **测试诊断导出**
   - 导航: Settings → Diagnostic Tools
   - 点击: "📤 Send Diagnostic Data"
   - 观察:
     - ⏳ Loading spinner (1-2 秒)
     - ✅ Success message
     - Report ID + File Size
     - Download link

4. **验证下载**
   - 点击 "📥 Download Report"
   - 浏览器下载 JSON 文件
   - 文件有效（可在文本编辑器打开）

5. **测试错误处理**
   - 改为 Mock Mode: "Offline"
   - 点击导出
   - 观察错误消息
   - 点击 "🔄 Retry"
   - 仍然失败（因为还是离线模式）
   - 改为 Mock Mode: "Online"
   - 再次 Retry
   - ✅ 这次成功！

---

## 测试清单

### ✅ Unit Tests (5 min)

```bash
npm run test -- DiagnosticService.test.ts --watch

# 看到所有测试通过:
# ✓ execute() - Success (3 tests)
# ✓ execute() - Errors (5 tests)
# ✓ State Management (3 tests)
# ✓ Input Validation (2 tests)
# ✓ Edge Cases (2 tests)
```

### ✅ Integration Tests (10 min)

**Online Mode**
- [ ] 点击导出成功
- [ ] 显示加载状态
- [ ] 显示成功信息 + 报告详情
- [ ] 下载链接有效

**Offline Mode**
- [ ] 点击导出显示错误
- [ ] 错误信息清晰
- [ ] 重试按钮工作
- [ ] 切换到 Online 后重试成功

**Production Mode**
- [ ] Mock Mode = "Off"
- [ ] 点击导出失败（预期，Tauri 未实现）
- [ ] 错误消息清晰

### ✅ Manual Testing (5 min)

**UI/UX**
- [ ] 按钮清晰可见
- [ ] Loading spinner 流畅
- [ ] 成功/失败消息区分明显
- [ ] 所有按钮可点击
- [ ] 没有错字

**Accessibility**
- [ ] Tab 键可导航到按钮
- [ ] Enter 可触发按钮
- [ ] 焦点框清晰可见

**Responsive**
- [ ] 桌面尺寸：正常
- [ ] 平板尺寸（768px）：正常
- [ ] 手机尺寸（375px）：正常

---

## 数据验证

### Mock 数据应该包含:

```json
{
  "timestamp": "ISO 8601",
  "appVersion": "0.1.0-alpha.11",
  "platform": "darwin|linux|win32",
  "systemInfo": {
    "osVersion": "string",
    "locale": "string",
    "timezone": "string"
  },
  "localStorage": {
    "transactions": "array",
    "images": "array",
    "settings": "object"
  },
  "appState": {
    "lastSyncTime": "ISO 8601 or null",
    "queuedImages": "number",
    "syncStatus": "idle|syncing|error",
    "dbSize": "string"
  },
  "debugLogs": "array"
}
```

### S3 URL 格式:

```
https://yorutsuke-diagnostics-dev.s3.us-east-1.amazonaws.com/user-test/diag-XXXXXXX.json?X-Amz-Expires=604800
```

✅ 包含 X-Amz-Expires=604800（7 天）

---

## 故障排查

### 问题: "Mock Mode 选项不显示"

**解决:**
```bash
# 确保输入 debug 代码
# 在应用任意位置输入: d e b u g (逐个字母)
# 应该看到 Debug View 打开
```

### 问题: "下载失败"

**解决:**
```bash
# S3 URL 是 Mock 生成的，不是真实 URL
# 在真实 Lambda 实现前，这是预期的
# 文件内容应该是有效 JSON
```

### 问题: "测试失败"

**解决:**
```bash
# 清除 node_modules 并重新安装
rm -rf node_modules
npm install

# 重新运行测试
npm run test -- DiagnosticService.test.ts
```

---

## 详细指南

完整的测试流程见: `.claude/plans/active/152-TESTING-GUIDE.md`

包含:
- 15 个单元测试详细说明
- 4 个集成测试 Suite (16 个测试)
- 端到端用户流程
- 性能和边界情况测试
- 完整的数据验证

---

## 架构: 服务层优先 (Pillar L: Headless)

### 分层设计

```
UI 层 (React)
   ↓
Service 层 (TypeScript) ← 业务逻辑聚合在此
   ↓
Adapter 层 (IPC + 数据库)
   ├─ diagnosticIpc: 原始 IO 操作 (Rust/Tauri)
   │  ├─ getSystemInfo()
   │  ├─ getDebugLogs()
   │  └─ getDirectorySize()
   └─ 数据库适配器
      ├─ fetchTransactions()
      └─ loadUnfinishedImages()
   ↓
Rust 层 (Tauri 命令) ← 仅原始 IO，无业务逻辑
```

### 为什么这样设计?

- ✅ **Pillar L (Headless)**: 业务逻辑与 UI 分离，可独立测试
- ✅ **Pillar I (Firewall)**: Rust 层隔离，只处理 IO
- ✅ **Pillar B (Airlock)**: 所有响应在 TypeScript 层验证
- ✅ **可测试**: Service 层可完全通过单元测试验证，无需 Tauri

## 当前状态

✅ Phase A 已完成:
- TypeScript 诊断服务实现
- 15 个单元测试（所有通过）
- Runtime mock 支持（online/offline/production）
- UI 集成完成

✅ Phase B 已完成 (Tauri IPC 原始操作):
- `get_system_info()` - Rust 原始 IO
- `read_debug_logs()` - Rust 原始 IO
- `get_directory_size()` - Rust 原始 IO
- 所有测试通过 (8/8)

⏳ Phase C (Lambda 云端集成):
- Lambda 函数实现（查询 DynamoDB、S3、CloudWatch）
- 生成合并报告
- 上传到 S3 返回 presigned URL
