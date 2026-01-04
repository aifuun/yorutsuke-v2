这是为你精心设计的 **Yorutsuke V2 - Ledger (账单流水) 模块**。

为了延续“硬核工业风”，我将此页面设计为类似于**“审计终端”**的视觉体验。它放弃了传统表格的平淡，通过极高的信息密度、严格的对齐和“状态卡片”来展示财务流水。

### 🎨 Ledger 模块设计规范 (Design Specs)

* **交互核心**：引入了 **"Audit Highlight"**，鼠标悬停时整行会亮起电子蓝，模拟扫描仪扫描的效果。
* **状态标签**：支出类别（Categorization）采用 Mono 字体加深色底块，像工业零件上的编号。
* **实时 Trace 联动**：侧边的 Live Trace 依然存在，但现在它记录的是“数据库查询日志”（Query Logs）。

---

### 💻 Ledger 模块 HTML 完整代码

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yorutsuke V2 - Financial Ledger</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #F1F5F9; color: #1E293B; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        
        .hard-border { border: 2px solid #0F172A; }
        .thin-border { border: 1px solid rgba(15, 23, 42, 0.08); }

        /* 侧边栏交互 */
        .nav-item { transition: all 0.2s; border-radius: 8px; color: #94A3B8; }
        .nav-item:hover { background: rgba(255,255,255,0.05); color: white; }
        .nav-item.active { background: #3B82F6; color: white; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }

        /* Ledger 特有：扫描行效果 */
        .ledger-row { transition: all 0.15s; cursor: pointer; border-left: 4px solid transparent; }
        .ledger-row:hover { 
            background: #F8FAFC; 
            border-left: 4px solid #3B82F6;
            transform: translateX(4px);
        }

        .trace-panel {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        }
    </style>
</head>
<body class="flex h-screen overflow-hidden">

    <aside class="w-64 bg-[#0F172A] text-slate-400 flex flex-col z-20 shadow-2xl">
        <div class="p-8 flex items-center gap-3">
            <div class="w-7 h-7 bg-blue-500 flex items-center justify-center text-white font-black text-sm rounded">Y</div>
            <span class="text-white font-extrabold tracking-tighter text-xl uppercase italic">Yorutsuke</span>
        </div>

        <nav class="flex-1 px-4 py-4 space-y-1">
            <a href="capture.html" class="nav-item flex items-center gap-4 px-4 py-3 text-xs font-bold uppercase tracking-widest">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16m-7 6h7" stroke-width="2"/></svg>
                <span>Capture</span>
            </a>
            <a href="#" class="nav-item active flex items-center gap-4 px-4 py-3 text-xs font-bold uppercase tracking-widest">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke-width="2"/></svg>
                <span>Ledger</span>
            </a>
            <a href="#" class="nav-item flex items-center gap-4 px-4 py-3 text-xs font-bold uppercase tracking-widest">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" stroke-width="2"/></svg>
                <span>Report</span>
            </a>
            <a href="#" class="nav-item flex items-center gap-4 px-4 py-3 text-xs font-bold uppercase tracking-widest">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066" stroke-width="2"/></svg>
                <span>Setting</span>
            </a>
        </nav>

        <div class="p-4 border-t border-slate-800/50">
            <div class="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800 transition-colors cursor-pointer group">
                <div class="w-9 h-9 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">U</div>
                <div class="flex-1 overflow-hidden">
                    <div class="text-[11px] font-bold text-slate-200 truncate uppercase tracking-tighter">Premium User</div>
                    <div class="text-[9px] text-slate-500 truncate mono">pro-link_04</div>
                </div>
            </div>
        </div>
    </aside>

    <main class="flex-1 flex flex-col overflow-hidden">
        
        <header class="h-16 bg-white border-b border-slate-200 px-10 flex items-center justify-between">
            <div class="flex items-center gap-4">
                <div class="mono text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Ledger_Index /</div>
                <h1 class="text-sm font-black uppercase tracking-tighter">Financial_Log_v2.0</h1>
            </div>
            <div class="flex items-center gap-4">
                <button class="mono text-[10px] font-black bg-[#0F172A] text-white px-4 py-2 hover:bg-blue-600 transition-colors rounded">EXPORT_RAW_DATA</button>
            </div>
        </header>

        <div class="flex-1 overflow-y-auto p-10 no-scrollbar">
            <div class="max-w-7xl mx-auto grid grid-cols-12 gap-10">
                
                <div class="col-span-12 lg:col-span-9 space-y-6">
                    
                    <div class="flex items-center gap-4 mb-8">
                        <div class="flex-1 relative">
                            <input type="text" placeholder="FILTER_BY_MERCHANT_OR_CATEGORY..." class="w-full bg-white hard-border px-10 py-3 mono text-xs focus:ring-2 ring-blue-500 outline-none">
                            <svg class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke-width="3"/></svg>
                        </div>
                        <div class="bg-white hard-border px-4 py-3 flex gap-4">
                            <span class="mono text-[10px] font-bold text-blue-600 cursor-pointer hover:underline">ALL</span>
                            <span class="mono text-[10px] font-bold text-slate-400 cursor-pointer hover:text-slate-800">EXPENSE</span>
                            <span class="mono text-[10px] font-bold text-slate-400 cursor-pointer hover:text-slate-800">INCOME</span>
                        </div>
                    </div>

                    <div class="bg-white hard-border overflow-hidden shadow-[8px_8px_0px_#0F172A]">
                        <table class="w-full text-left">
                            <thead class="bg-slate-50 border-b-2 border-[#0F172A]">
                                <tr class="mono text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    <th class="px-8 py-4">Status</th>
                                    <th class="px-8 py-4">Timestamp</th>
                                    <th class="px-8 py-4">Identity / Merchant</th>
                                    <th class="px-8 py-4">Category</th>
                                    <th class="px-8 py-4 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 mono text-[11px]">
                                <tr class="ledger-row">
                                    <td class="px-8 py-5"><span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span></td>
                                    <td class="px-8 py-5 font-bold text-slate-400">2026.01.04_18:51</td>
                                    <td class="px-8 py-5 font-black text-slate-900 uppercase">7-Eleven Fuchu Branch</td>
                                    <td class="px-8 py-5"><span class="bg-[#0F172A] text-white px-2 py-1 text-[9px] font-bold">SHI-IRE</span></td>
                                    <td class="px-8 py-5 text-right font-black text-rose-500 text-sm">- ¥1,240</td>
                                </tr>
                                <tr class="ledger-row">
                                    <td class="px-8 py-5"><span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span></td>
                                    <td class="px-8 py-5 font-bold text-slate-400">2026.01.03_14:20</td>
                                    <td class="px-8 py-5 font-black text-slate-900 uppercase">Amazon Business JP</td>
                                    <td class="px-8 py-5"><span class="bg-[#0F172A] text-white px-2 py-1 text-[9px] font-bold">EQUIPMENT</span></td>
                                    <td class="px-8 py-5 text-right font-black text-rose-500 text-sm">- ¥128,000</td>
                                </tr>
                                <tr class="ledger-row">
                                    <td class="px-8 py-5"><span class="w-2 h-2 rounded-full bg-blue-500 inline-block"></span></td>
                                    <td class="px-8 py-5 font-bold text-slate-400">2026.01.02_10:00</td>
                                    <td class="px-8 py-5 font-black text-slate-900 uppercase">Stripe Payout</td>
                                    <td class="px-8 py-5"><span class="bg-blue-600 text-white px-2 py-1 text-[9px] font-bold">REVENUE</span></td>
                                    <td class="px-8 py-5 text-right font-black text-emerald-600 text-sm">+ ¥450,200</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="col-span-12 lg:col-span-3 space-y-6">
                    <div class="trace-panel rounded-2xl p-6 min-h-[400px] border border-white/10 shadow-2xl">
                        <div class="flex items-center gap-2 mb-6 pb-3 border-b border-white/10">
                            <div class="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                            <span class="mono text-[10px] font-bold text-slate-300 uppercase tracking-widest">Query_Trace</span>
                        </div>
                        <div class="mono text-[10px] space-y-4 leading-relaxed overflow-hidden">
                            <div class="text-slate-500 italic">> SELECT * FROM transactions</div>
                            <div class="text-blue-400">> Filter: ALL_TIME</div>
                            <div class="text-slate-500 italic">> Fetched 1,402 records (12ms)</div>
                            <div class="pt-4 text-emerald-400 font-bold border-t border-white/5 uppercase">
                                Audit_Hash: 8A2F_991X
                            </div>
                            <div class="text-slate-400 mt-4 opacity-40">
                                [INFO] DB connection stable. <br>
                                [INFO] Read-only mode active.
                            </div>
                        </div>
                    </div>

                    <div class="bg-white hard-border p-6">
                        <div class="mono text-[9px] font-black text-slate-400 uppercase mb-2">Month_Balance</div>
                        <div class="text-2xl font-black text-slate-900 tracking-tighter">¥322,200</div>
                        <div class="h-1 w-full bg-slate-100 mt-4">
                            <div class="h-full bg-emerald-500 w-3/4"></div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </main>

</body>
</html>

```

---

### 📘 Ledger 模块设计文档 (Module Design Doc)

#### 1. 核心功能说明 (App Functionality)

* **Transaction_Log**: 核心账目列表，支持显示支出（红）和收入（绿）。
* **Audit_Trace**: 实时显示当前数据库查询的执行逻辑。当你搜索或筛选时，右侧面板会滚动显示对应的 SQL 逻辑伪代码。
* **Category_Tags**: 每个账目自带一个黑色 Mono 风格标签，点击可快速按类别筛选。
* **Export_Raw_Data**: 顶部核心操作，允许将当前过滤后的视图导出为 CSV 或 JSON。

#### 2. 视觉元素说明 (Visual Elements)

* **Hard Shadow (硬阴影)**: 表格使用了 `shadow-[8px_8px_0px_#0F172A]`。这种“块状阴影”是近几年硬核 UI 的标志性特征，赋予页面极强的重量感。
* **Ledger Row Hover**: 每一行在鼠标悬停时会有位移（`translateX(4px)`）和蓝色的左边框，增强了操作反馈。
* **Typography**: 金额加粗并使用 `text-sm`，确保即便在复杂数据中也能第一眼定位到钱。

#### 3. CSS & Position 规范

* **Layout**: 使用 `Grid (12 cols)`，列表占 9 份，辅助信息与 Trace 占 3 份。
* **Borders**: 列表头采用 `border-b-2 border-[#0F172A]`，强调结构分层。
* **Color Logic**: 收入使用 `emerald-600` (+), 支出使用 `rose-500` (-)。

**下一模块建议：Report (财务统计)。我们可以用这种硬核风格设计一个“数据驾驶舱”，包含像素风格的支出比例分布。需要我现在为你生成吗？**