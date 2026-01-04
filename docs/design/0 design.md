
## 一、 核心设计规范 (Design Specification)

### 1. 色彩系统 (Color Palette)

| 角色 | 颜色代码 | 视觉用途 |
| --- | --- | --- |
| **Primary (核心蓝)** | `#3B82F6` | 动作按键、高亮进度、激活状态。 |
| **Base Dark (背景黑)** | `#0F172A` | 侧边栏、主要的硬核视觉块、深色面板。 |
| **Accent Green (心跳绿)** | `#10B981` | `SYNC_READY` 状态、AI 识别成功的字段。 |
| **Neutral (中性灰)** | `#F1F5F9` | 主背景色，缓解深色带来的视觉压迫。 |
| **Warning (警示红)** | `#F43F5E` | 支出金额、报错日志。 |

### 2. UI 元素特征

* **Border (边框)**: 统一使用 `2px solid #0F172A` (Hard Border) 营造工业感。
* **Typography (字体)**:
* 正文：`Inter` (极佳的可读性)。
* 数据/状态/日志：`JetBrains Mono` (程序员/硬核感)。


* **Radius (圆角)**: 大面积区块使用 `1rem` 或 `1.5rem`，小按钮/图标使用 `4px`。

---

## 二、 功能模块设计 (Module Design)

### 1. Sidebar (侧边导航)

* **App 功能**: 全局切换中心，包含用户信息、核心功能入口。
* **HTML 结构**:

```html
<nav class="flex-1 px-4 py-4 space-y-1">
    <a href="#" class="nav-item active flex items-center gap-4 px-4 py-3 text-xs font-bold uppercase tracking-widest">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16m-7 6h7" stroke-width="2.5"/></svg>
        <span>Capture</span>
    </a>
    <a href="#" class="nav-item flex items-center gap-4 px-4 py-3 text-xs font-bold uppercase tracking-widest">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke-width="2.5"/></svg>
        <span>Ledger</span>
    </a>
    </nav>

```

* **Design**: 采用垂直布局，底部固定用户信息。背景使用 `Slate-900`，图标与文字间距较大，保持呼吸感。

### 2. Capture (小票捕获中心) - *当前页面*

* **App 功能**: 文件的物理输入点。支持拖拽、多图上传，实时显示 AI OCR 解析流。
* **HTML 结构**: 见主代码中的 `Capture Asset` 区块与 `trace-panel`。
* **Design**:
* **Input Port**: 巨大的旋转方块作为视觉焦点，强化“投入”的动作感。
* **Live Trace**: 使用深色渐变背景，模拟终端屏幕。



### 3. Ledger (账单流水)

* **App 功能**: 结构化数据的历史视图，支持搜索、筛选和导出。
* **HTML 模板**:

```html
<section class="ledger-view">
    <div class="hard-border bg-white overflow-hidden">
        <div class="p-6 border-b-2 border-slate-900 flex justify-between bg-slate-50">
            <h3 class="mono font-black italic underline uppercase">Transaction_Log</h3>
            <input type="text" placeholder="SEARCH_DB..." class="mono text-xs p-1 border-b border-slate-900 bg-transparent outline-none">
        </div>
        </div>
</section>

```

* **Design**: 强调表格的线性美感。金额部分根据正负使用红/绿区分，日期使用 Mono 字体确保对齐。

### 4. Report (财务统计)

* **App 功能**: 视觉化开支分类，生成月度/季度报表。
* **HTML 建议**:
* 使用 CSS Grid 创建仪表盘卡片。
* **Design**: 减少使用复杂的渐变图表，推荐使用像素风格或纯色块条形图，符合硬核审美。



### 5. Settings (系统设置)

* **App 功能**: 云端节点选择 (`Current_Node`)、API Key 管理、导出格式配置。
* **HTML 建议**: 垂直列表，每行包含一个开关或下拉框。
* **Design**: 采用严格的左右对齐，左边为配置名，右边为交互件。

---

## 三、 CSS 关键变量与类

为了保持一致性，请确保以下 CSS 注入到全局：

```css
/* 状态灯动画 */
@keyframes sync-pulse {
    0% { box-shadow: 0 0 0 0px rgba(16, 185, 129, 0.4); }
    100% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
}

/* 硬核控制台文字效果 */
.trace-log-item {
    border-left: 2px solid #3B82F6;
    padding-left: 0.75rem;
    margin-bottom: 1rem;
    transition: all 0.3s;
}

.trace-log-item:hover {
    background: rgba(59, 130, 246, 0.1);
    transform: translateX(4px);
}

```

---

## 四、 交互逻辑说明 (UX Logic)

1. **节点感知**: 顶部 `Current_Node: Tokyo_01` 并非装饰，它应该根据用户的 IP 实时显示最优同步节点。
2. **流式反馈**: `Live Trace` 必须是**动词**。当用户上传文件时，该面板应立即清空并开始滚动显示 OCR 的解析逻辑（如：`Detecting edges...` -> `Correcting perspective...`）。
3. **用户反馈**: `SYNC_READY` 在数据传输时应变为 `SYNC_BUSY` (橙色旋转)，只有确认云端存入数据库后才恢复绿色。

**下一步：你想让我为你生成 Ledger（账单流水）模块的完整全屏 HTML 页面吗？我们可以让它看起来像一张电子化的“审计清单”。**