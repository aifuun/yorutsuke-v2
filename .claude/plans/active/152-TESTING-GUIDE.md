# Issue #152: Diagnostic Export Testing Guide

**Status**: Testing Phase
**Date**: 2026-01-20

---

## Overview

完整的测试流程分为三个阶段：
1. **单元测试** - DiagnosticService 业务逻辑（Vitest）
2. **集成测试** - 前端 + 适配器 + Mock 数据（应用运行）
3. **端到端测试** - 完整用户流程（手动测试）

---

## Part 1: 单元测试（Unit Tests）

### 运行测试

```bash
# 进入 app 目录
cd /Users/woo/dev/yorutsuke-v2-2/app

# 运行所有诊断服务测试
npm run test -- DiagnosticService.test.ts

# 或者用 watch 模式（自动重新运行）
npm run test -- DiagnosticService.test.ts --watch

# 查看测试覆盖率
npm run test -- DiagnosticService.test.ts --coverage
```

### 单元测试清单（15 个测试）

#### ✅ 成功路径测试

**Test 1: 完整诊断工作流**
```
功能: 从本地采集 → 云端上传 → 返回 S3 URL
预期:
  - collectLocalDiagnosticData 被调用 1 次
  - uploadDiagnosticReportIpc 被调用 1 次
  - 返回 success: true
  - 返回报告 ID 和 S3 URL
```

**Test 2: 生成唯一的 traceId**
```
功能: 每次执行都生成不同的 traceId
预期:
  - 第一次执行: traceId = "trace-xxx-1"
  - 第二次执行: traceId = "trace-yyy-2"
  - 两个 traceId 不相同
```

**Test 3: Context 状态跟踪**
```
功能: 服务维护内部 context 状态
预期:
  - 执行前: getContext() = null
  - 执行中: getContext().state = "collecting" or "uploading"
  - 执行后: getContext().state = "success"
  - context 包含 traceId 和 startTime
```

#### ❌ 错误处理测试

**Test 4: 本地数据采集失败**
```
功能: SQLite 或系统信息采集失败
场景:
  - collectLocalDiagnosticData 抛出 "SQLite error"
预期:
  - 返回 success: false
  - error.code = "LOCAL_COLLECTION_FAILED"
  - error.retryable = true
  - 不调用 uploadDiagnosticReportIpc
```

**Test 5: 暂时性故障重试成功**
```
功能: Lambda 超时后恢复
场景:
  - 第 1 次 uploadDiagnosticReportIpc: 抛出 "timeout"
  - 第 2 次 uploadDiagnosticReportIpc: 返回成功
预期:
  - uploadDiagnosticReportIpc 被调用 2 次
  - 最终返回 success: true
  - 显示自动重试成功
```

**Test 6: 重试次数耗尽**
```
功能: 暂时性故障无法恢复
场景:
  - collectLocalDiagnosticData: 成功
  - uploadDiagnosticReportIpc: 全部失败（3 次尝试）
预期:
  - uploadDiagnosticReportIpc 被调用 3 次
  - 返回 success: false
  - error.message 包含 "attempt 3/3"
  - error.retryable = false
```

**Test 7: 网络错误（timeout）分类**
```
功能: 错误分类为 retryable
场景:
  - collectLocalDiagnosticData: 成功
  - uploadDiagnosticReportIpc: 抛出 "Request timeout after 30000ms"
预期:
  - isRetryableError() = true
  - 应该进行重试（调用 2 次）
  - 而不是立即失败
```

**Test 8: 网络错误（connection）分类**
```
功能: 错误分类为 retryable
场景:
  - uploadDiagnosticReportIpc: 抛出 "econnrefused"
预期:
  - isRetryableError() = true
  - 应该进行重试
```

#### 🔄 状态管理测试

**Test 9: FSM 状态转换**
```
功能: 状态机正确转换
场景:
  - 执行诊断导出
  - 在 collectLocalDiagnosticData 中检查: state = "collecting"
  - 在 uploadDiagnosticReportIpc 中检查: state = "uploading"
  - 完成后检查: state = "success"
预期:
  - 状态按正确顺序转换
  - 不会跳过任何状态
```

**Test 10: Context 重置**
```
功能: reset() 清除状态
场景:
  - 执行诊断导出成功
  - 调用 reset()
预期:
  - getContext() = null
  - 可以开始新的执行
```

**Test 11: 错误状态下的 Context**
```
功能: 错误时也维护 context
场景:
  - collectLocalDiagnosticData 抛出错误
预期:
  - getContext().state = "error"
  - getContext().traceId 存在
  - 可以重试
```

#### 📊 输入验证测试

**Test 12: 缺少 userId**
```
功能: Hook 层应该验证输入
注意: Service 层假设有效输入，验证在 Hook 完成
```

**Test 13: 缺少 token**
```
功能: Hook 层应该验证输入
注意: Service 层假设有效输入，验证在 Hook 完成
```

#### 🔍 边界情况测试

**Test 14: 多次连续执行**
```
功能: 支持多次导出
场景:
  - 第一次执行诊断导出
  - 第二次执行诊断导出
预期:
  - 两次都成功
  - 生成不同的 traceId
  - 不相互影响
```

**Test 15: 错误后重新执行**
```
功能: 从错误状态恢复
场景:
  - 第一次执行失败
  - reset()
  - 第二次执行成功
预期:
  - 两次都正确处理
  - 不相互干扰
```

---

## Part 2: 集成测试（Integration Tests - 应用运行）

### 环境准备

```bash
# Terminal 1: 启动应用
cd /Users/woo/dev/yorutsuke-v2-2/app
npm run tauri dev

# 应用启动后，等待 Settings 面板加载
```

### 集成测试清单

#### 🎯 Test Suite 1: Mock 模式在线（Online Mode）

**Test A1: 完整流程 - 成功**
```
步骤:
1. 打开 Debug 面板（快捷键: 输入 "debug"）
2. 找到 "Mock Mode" 选项
3. 选择 "Online" 模式
4. 导航到 Settings → Diagnostic Tools
5. 点击 "📤 Send Diagnostic Data" 按钮

验证:
□ 按钮 disabled → 加载状态出现
□ 显示旋转图标 (spinner)
□ 状态文本显示 "Collecting local data..."
□ 1-2 秒后状态变为 "Uploading to cloud..."
□ 显示成功消息 "✅ Diagnostic export complete"
□ 显示报告详情:
  - Report ID: diag-xxx
  - File Size: 100 KB
  - Expiry: 7 days
□ 显示 "📥 Download Report" 按钮（可点击）
□ 显示 "Send New Export" 按钮
```

**Test A2: 下载链接有效性**
```
步骤:
1. 完成 Test A1
2. 点击 "📥 Download Report" 按钮

验证:
□ 浏览器开始下载 JSON 文件
□ 文件名格式: diagnostic-diag-xxx.json
□ 文件大小 > 0 bytes
□ JSON 格式有效（可用文本编辑器打开）
```

**Test A3: 重新导出**
```
步骤:
1. 完成 Test A1
2. 点击 "Send New Export" 按钮

验证:
□ UI 返回 idle 状态
□ 按钮可点击
□ 可以再次执行导出
□ 生成新的 Report ID
```

**Test A4: 快速响应（Mock 数据）**
```
步骤:
1. Mock Mode = "Online"
2. 点击导出按钮
3. 记录时间

验证:
□ 从点击到显示成功 < 2 秒
□ 明显快于真实的 Lambda 调用（应该 < 1 秒）
□ 证明使用了 Mock 数据而非真实 API
```

#### 🎯 Test Suite 2: Mock 模式离线（Offline Mode）

**Test B1: 网络错误模拟**
```
步骤:
1. Mock Mode = "Offline"
2. 导航到 Diagnostic 面板
3. 点击 "Send Diagnostic Data" 按钮

验证:
□ 显示加载状态（spinner）
□ 约 1-2 秒后显示错误
□ 错误信息包含 "Network error"
□ 显示 "🔄 Retry" 按钮（红色）
□ 显示 "Cancel" 按钮
```

**Test B2: 离线模式下重试**
```
步骤:
1. 完成 Test B1（显示错误）
2. 保持 Mock Mode = "Offline"
3. 点击 "Retry" 按钮

验证:
□ 返回到加载状态
□ 等待 1-2 秒
□ 再次显示错误（因为仍在离线模式）
□ 重试机制工作正常
```

**Test B3: 从离线恢复到在线**
```
步骤:
1. 完成 Test B2（显示错误）
2. 点击 "Cancel" 按钮
3. Mock Mode 改为 "Online"
4. 点击 "Send Diagnostic Data"

验证:
□ Cancel 后 UI 返回 idle 状态
□ 切换模式后立即重新导出
□ 这次成功（因为现在是 Online 模式）
□ 证明模式切换有效
```

**Test B4: 错误消息清晰**
```
步骤:
1. Mock Mode = "Offline"
2. 点击导出按钮
3. 等待错误出现

验证:
□ 错误消息清晰可读
□ 不显示技术细节（堆栈跟踪）
□ 用户能理解"网络问题"
□ 建议"重试"或"稍后再试"
```

#### 🎯 Test Suite 3: 生产模式（Production Mode - 无 Mock）

**Test C1: 生产模式状态**
```
步骤:
1. Mock Mode = "Off"
2. 导航到 Diagnostic 面板

验证:
□ 按钮显示 "Send Diagnostic Data"
□ 按钮 enabled（可点击）
□ 没有任何 "mock" 标示
□ UI 应该等待真实的 Tauri 调用
```

**Test C2: 生产模式超时（预期失败）**
```
步骤:
1. Mock Mode = "Off"
2. 点击 "Send Diagnostic Data" 按钮

预期结果:
⚠️ 会失败，因为 Tauri 命令还未实现
错误信息: "Unknown IPC Error" 或类似

这是正常的！证明代码会尝试调用真实的 Tauri IPC。
```

---

## Part 3: 端到端测试（E2E Manual Testing）

### 测试完整的用户旅程

**Test D1: 首次用户流程**
```
假设: 用户首次打开应用

步骤:
1. 打开应用（npm run tauri dev）
2. 登录或以 guest 身份使用
3. 导航到 Settings
4. 找到 "📊 Diagnostic Tools" 部分
5. 读取描述文本
6. 点击 "Send Diagnostic Data" 按钮
7. 观察加载状态
8. 等待完成
9. 查看报告详情
10. 下载报告文件

验证:
□ 每一步 UI 都清晰可用
□ 按钮禁用/启用状态正确
□ 加载动画顺畅
□ 错误信息清晰（如果有）
□ 成功消息鼓励（✅ 符号等）
□ 下载链接有效
```

**Test D2: 可访问性检查**
```
步骤:
1. 使用 Tab 键导航到按钮
2. 按 Enter 启动诊断
3. Tab 键导航到下载链接
4. 尝试用键盘操作所有按钮

验证:
□ 按钮有焦点框（outline）
□ 焦点顺序合理
□ 所有交互元素可键盘访问
□ 没有在 tabindex 中迷失
```

**Test D3: 响应式设计**
```
步骤:
1. 在桌面尺寸测试（> 1024px）
2. 调整到平板尺寸（768px - 1024px）
3. 调整到手机尺寸（< 768px）
4. 每个尺寸都执行诊断导出

验证:
□ 所有尺寸上按钮可点击（触摸目标 > 44px）
□ 文本清晰易读
□ 布局不重叠或崩溃
□ 加载动画在所有尺寸上都看得见
```

**Test D4: 快速连续导出**
```
步骤:
1. Mock Mode = "Online"
2. 点击 "Send Diagnostic Data"
3. 导出完成前，立即再次点击
4. 第二个导出完成后，点击第三次

验证:
□ 第一个导出成功
□ 第二次点击被忽略（按钮应该 disabled）
□ 或者如果允许，第二个导出成功
□ 没有崩溃或数据混乱
□ 每个导出有不同的 Report ID
```

**Test D5: 导出后返回**
```
步骤:
1. 完成成功的诊断导出
2. 点击 "Send New Export"
3. 立即再次点击 "Send Diagnostic Data"

验证:
□ 按钮正确返回 idle 状态
□ 第二次导出不受第一次影响
□ 两个导出有独立的 traceId
□ UI 状态干净转换
```

---

## Part 4: 性能测试

### 测试响应时间

**Test E1: Mock 数据响应时间**
```
步骤:
1. Mock Mode = "Online"
2. 点击导出，记录开始时间
3. 观察完成，记录结束时间
4. 计算耗时

验证:
□ 完成时间 < 1 秒
□ 应该快速，没有明显延迟
□ mockDelay() 添加 100-200ms 模拟网络
□ 总时间 ~200ms 是合理的
```

**Test E2: 错误响应时间**
```
步骤:
1. Mock Mode = "Offline"
2. 点击导出，记录开始时间
3. 错误出现，记录结束时间

验证:
□ 错误出现 < 1 秒
□ 不要让用户等待太久看到错误
□ 应该立即反应
```

---

## Part 5: 边界情况测试

### 异常场景

**Test F1: 重复点击导出按钮**
```
步骤:
1. 快速连续点击导出按钮 5 次（< 1 秒）

验证:
□ 只启动一次导出
□ 其他点击被忽略
□ 没有多次并发调用
```

**Test F2: 导出中关闭/刷新应用**
```
步骤:
1. 点击导出按钮
2. 加载中按 Cmd+W（关闭）或 F5（刷新）

验证:
□ 应用优雅处理（可能显示警告）
□ 不会损坏状态
□ 重新打开后正常工作
```

**Test F3: 切换模式中途**
```
步骤:
1. 点击导出（Mock Mode = Online）
2. 加载中切换 Mock Mode → Offline
3. 继续观察

验证:
□ 行为合理（可能继续完成，或错误）
□ 不要崩溃
□ 后续导出使用新模式
```

---

## 测试数据验证

### 验证 Mock 数据结构

**Test G1: 返回的 Mock 数据格式**
```bash
# 打开浏览器 DevTools
# Console 标签页
# 运行诊断导出后，检查日志：

// 应该看到类似日志
{
  "timestamp": "2026-01-20T...",
  "appVersion": "0.1.0-alpha.11",
  "platform": "darwin",
  "systemInfo": {
    "osVersion": "14.2",
    "locale": "en-US",
    "timezone": "UTC+9"
  },
  "localStorage": {
    "transactions": [...],
    "images": [...],
    "settings": {...}
  },
  "appState": {
    "lastSyncTime": "2026-01-20T...",
    "queuedImages": 0,
    "syncStatus": "idle",
    "dbSize": "5.2 MB"
  },
  "debugLogs": [...]
}
```

**验证**:
```
□ timestamp 是有效的 ISO 8601 格式
□ appVersion 匹配 package.json 版本
□ platform 是 darwin/linux/win32 之一
□ systemInfo 所有字段存在
□ localStorage 包含 transactions 数组
□ localStorage 包含 images 数组
□ appState 所有字段存在
□ debugLogs 是数组
```

**Test G2: S3 URL 格式**
```
验证返回的 S3 URL:

□ 格式: https://yorutsuke-diagnostics-dev.s3.us-east-1.amazonaws.com/...
□ 包含查询参数: X-Amz-Expires=604800（7 天）
□ reportId 在 URL 中
□ 可以在浏览器中粘贴测试（会下载或显示 JSON）
```

---

## 快速参考：完整测试流程（20 分钟）

```bash
# 1. 单元测试（5 分钟）
cd app
npm run test -- DiagnosticService.test.ts

# 结果：应该看到 "PASS" 和 "15 passed"
# ✅ 如果通过，继续

# 2. 启动应用进行集成测试（5 分钟）
npm run tauri dev

# 应用启动后在浏览器中：

# 3. 在线模式测试（5 分钟）
# - 打开 Debug 面板（输入 "debug"）
# - Mock Mode = "Online"
# - 点击 "Send Diagnostic Data"
# - 验证成功完成
# - 点击下载，验证文件

# 4. 离线模式测试（3 分钟）
# - Mock Mode = "Offline"
# - 点击 "Send Diagnostic Data"
# - 验证错误显示
# - 点击 Retry，再次失败
# - 改为 Mock Mode = "Online"
# - Retry 成功

# 5. 生产模式测试（2 分钟）
# - Mock Mode = "Off"
# - 点击导出（预期失败，因为 Tauri 未实现）
```

---

## 测试检查清单

### ✅ 所有测试通过标准

```
单元测试:
□ npm test 返回 "15 passed"
□ 没有警告或错误
□ 覆盖率 > 80%

集成测试:
□ 在线模式：成功 + 下载有效
□ 离线模式：错误 + 重试正常
□ 生产模式：尝试调用 IPC（预期失败）
□ 模式切换：无缝工作

端到端测试:
□ 按钮可访问（键盘 + 鼠标）
□ 响应式设计（桌面 + 平板 + 手机）
□ 性能良好（< 1 秒响应）
□ 错误处理清晰
□ 数据格式正确
```

### 🚫 已知故障（预期）

```
生产模式导出会失败:
- ❌ "Unknown IPC error"
- ✅ 这是正常的，Tauri 命令在 Phase B 实现
```

---

## 下一步

当所有集成测试通过后：

```
Phase A (Frontend) ✅ COMPLETE
  - Service layer tested
  - Hook tested
  - UI tested
  - Mocks working

Phase B (Tauri) → 实现 Rust IPC handlers
Phase C (Lambda) → 实现 AWS Lambda 后端
```

