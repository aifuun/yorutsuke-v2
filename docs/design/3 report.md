这是为你生成的 **Yorutsuke V2 - Report (财务统计报表) 模块**。

在这个模块中，我们将“硬核”风格推向了极致：利用**像素化的条形图**、**高对比度的状态卡片**以及**数据可视化面板**，将复杂的财务收支转化为极具冲击力的“数据驾驶舱”。

### 📊 Report 模块设计文档 (Design Specification)

#### 1. 核心功能说明 (App Functionality)

* **Balance_Engine**: 顶部的总览区，实时显示资产净值、总收入与总支出。
* **Category_Distribution**: 支出分类统计。不使用圆润的饼图，而是使用**硬边矩形条**，通过颜色块的面积比例直观显示各维度占比（如：伙食、办公、设备）。
* **Monthly_Traffic**: 柱状图展示过去六个月的收支对比。
* **AI_Insight**: 右侧的 Live Trace 升级为“智能顾问”，实时分析流水并给出建议（例如：“设备开支本月激增 120%，建议核查”）。

#### 2. 视觉设计细节 (Visual Design)

* **阴影的极致应用**：卡片根据其重要程度，阴影颜色在蓝色（积极/行动）和黑色（稳健/基础）之间切换。
* **数据网格**：背景隐约可见的网格线（Grid Pattern），模拟精密坐标纸。

---

### 💻 Report 模块 HTML 完整代码

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yorutsuke V2 - Financial Report</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #F1F5F9; color: #1E293B; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .hard-border { border: 2px solid #0F172A; }
        
        /* 侧边栏交互 */
        .nav-item { transition: all 0.2s; border-radius: 8px; color: #94A3B8; }
        .nav-item:hover { background: rgba(255,255,255,0.05); color: white; }
        .nav-item.active { background: #3B82F6; color: white; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }

        /* 报表特有：像素网格背景 */
        .report-grid-bg {
            background-image: radial-gradient(#0f172a 1px, transparent 1px);
            background-size: 24px 24px;
            background-color: #F8FAFC;
        }

        /* 进度条动画 */
        @keyframes grow { from { width: 0; } to { width: 100%; } }
        .animate-grow { animation: grow 1s ease-out forwards; }
    </style>
</head>
<body class="flex h-screen overflow-hidden">

    <aside class="w-64 bg-[#0F172A] text-slate-400 flex flex-col z-20 shadow-2xl">
        <div class="p-8 flex items-center gap-3">
            <div class="w-7 h-7 bg-blue-500 flex items-center justify-center text-white font-black text-sm rounded">Y</div>
            <span class="text-white font-extrabold tracking-tighter text-xl uppercase italic">Yorutsuke</span>
        </div>
        <nav class="flex-1 px-4 py-4 space-y-1">
            <a href="#" class="nav-item flex items-center gap-4 px-4 py-3 text-xs font-bold uppercase tracking-widest">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16m-7 6h7" stroke-width="2"/></svg>
                <span>Capture</span>
            </a>
            <a href="#" class="nav-item flex items-center gap-4 px-4 py-3 text-xs font-bold uppercase tracking-widest">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke-width="2"/></svg>
                <span>Ledger</span>
            </a>
            <a href="#" class="nav-item active flex items-center gap-4 px-4 py-3 text-xs font-bold uppercase tracking-widest">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" stroke-width="2"/></svg>
                <span>Report</span>
            </a>
            <a href="#" class="nav-item flex items-center gap-4 px-4 py-3 text-xs font-bold uppercase tracking-widest">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066" stroke-width="2"/></svg>
                <span>Setting</span>
            </a>
        </nav>
        <div class="p-4 border-t border-slate-800/50">
            <div class="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40">
                <div class="w-9 h-9 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-sm">U</div>
                <div class="flex-1 overflow-hidden">
                    <div class="text-[11px] font-bold text-slate-200 uppercase tracking-tighter">Premium User</div>
                </div>
            </div>
        </div>
    </aside>

    <main class="flex-1 flex flex-col overflow-hidden report-grid-bg">
        <header class="h-16 bg-white border-b border-slate-200 px-10 flex items-center justify-between">
            <div class="mono text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Analysis_Engine / <span class="text-slate-900">Fiscal_Report_2026</span></div>
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-2 mono text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded border border-emerald-200">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    AUTO_UPDATE_ON
                </div>
            </div>
        </header>

        <div class="flex-1 overflow-y-auto p-10 no-scrollbar">
            <div class="max-w-7xl mx-auto space-y-10">
                
                <div class="grid grid-cols-12 gap-8">
                    <div class="col-span-12 md:col-span-4 bg-white hard-border p-8 shadow-[8px_8px_0px_#0F172A]">
                        <p class="mono text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total_Net_Worth</p>
                        <h2 class="text-4xl font-black tracking-tighter text-slate-900">¥2,840,500</h2>
                        <p class="mono text-[10px] text-emerald-600 font-bold mt-4">+12.4% FROM LAST MONTH</p>
                    </div>
                    <div class="col-span-12 md:col-span-4 bg-white hard-border p-8 shadow-[8px_8px_0px_#3B82F6]">
                        <p class="mono text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fiscal_Inflow</p>
                        <h2 class="text-4xl font-black tracking-tighter text-blue-600">¥450,200</h2>
                        <div class="h-1 w-full bg-slate-100 mt-4"><div class="h-full bg-blue-600 w-full"></div></div>
                    </div>
                    <div class="col-span-12 md:col-span-4 bg-white hard-border p-8 shadow-[8px_8px_0px_#F43F5E]">
                        <p class="mono text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fiscal_Outflow</p>
                        <h2 class="text-4xl font-black tracking-tighter text-rose-500">¥128,400</h2>
                        <div class="h-1 w-full bg-slate-100 mt-4"><div class="h-full bg-rose-500 w-1/3"></div></div>
                    </div>
                </div>

                <div class="grid grid-cols-12 gap-8">
                    <div class="col-span-12 lg:col-span-7 bg-white hard-border p-8">
                        <h3 class="mono text-[12px] font-black uppercase mb-8 border-b-2 border-slate-900 pb-2 italic">Expense_Structure</h3>
                        <div class="space-y-6">
                            <div>
                                <div class="flex justify-between mono text-[11px] mb-2 uppercase"><span>Shi-ire (Stock)</span><span class="font-black">65%</span></div>
                                <div class="h-6 bg-slate-900 hard-border flex"><div class="h-full bg-blue-500 border-r-2 border-slate-900" style="width: 65%"></div></div>
                            </div>
                            <div>
                                <div class="flex justify-between mono text-[11px] mb-2 uppercase"><span>Equipment</span><span class="font-black">20%</span></div>
                                <div class="h-6 bg-slate-900 hard-border flex"><div class="h-full bg-emerald-500 border-r-2 border-slate-900" style="width: 20%"></div></div>
                            </div>
                            <div>
                                <div class="flex justify-between mono text-[11px] mb-2 uppercase"><span>Utility</span><span class="font-black">15%</span></div>
                                <div class="h-6 bg-slate-900 hard-border flex"><div class="h-full bg-amber-500 border-r-2 border-slate-900" style="width: 15%"></div></div>
                            </div>
                        </div>
                    </div>

                    <div class="col-span-12 lg:col-span-5 bg-[#0F172A] rounded-2xl p-8 relative overflow-hidden shadow-2xl">
                        <div class="relative z-10">
                            <h3 class="mono text-[10px] font-black text-blue-400 uppercase tracking-[.2em] mb-6 flex items-center gap-2">
                                <span class="w-2 h-2 bg-blue-400 rounded-full animate-ping"></span>
                                AI_Insights_Engine
                            </h3>
                            <div class="space-y-6 mono text-[11px]">
                                <div class="p-4 bg-white/5 border-l-4 border-blue-500">
                                    <p class="text-slate-300 leading-relaxed italic">"Detection: Equipment costs increased by 120% this week. Correlated with AMZN_INV_9901."</p>
                                </div>
                                <div class="p-4 bg-white/5 border-l-4 border-emerald-500">
                                    <p class="text-slate-300 leading-relaxed italic">"Optimization: Switching to annual billing for 'Cloud Utility' could save ¥12,400/yr."</p>
                                </div>
                                <div class="text-[9px] text-slate-500 pt-4 border-t border-white/10 uppercase">
                                    Model: Finance_LLM_v4 / Accuracy: 99.2%
                                </div>
                            </div>
                        </div>
                        <div class="absolute -right-8 -bottom-8 opacity-10">
                            <svg class="w-48 h-48 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14H11V21L20 10H13Z"/></svg>
                        </div>
                    </div>
                </div>

                <div class="bg-white hard-border p-8">
                    <h3 class="mono text-[12px] font-black uppercase mb-6 flex justify-between items-center">
                        Trend_Analysis_Log
                        <span class="text-[10px] text-blue-600 font-bold underline cursor-pointer">DOWNLOAD_DETAILED_PDF</span>
                    </h3>
                    <div class="grid grid-cols-6 gap-2">
                        <div class="flex flex-col items-center gap-2">
                            <div class="w-full bg-slate-100 h-32 relative flex flex-col justify-end">
                                <div class="bg-slate-900 w-full h-2/3"></div>
                            </div>
                            <span class="mono text-[9px] font-bold">JUL</span>
                        </div>
                        <div class="flex flex-col items-center gap-2">
                            <div class="w-full bg-slate-100 h-32 relative flex flex-col justify-end">
                                <div class="bg-slate-900 w-full h-1/2"></div>
                            </div>
                            <span class="mono text-[9px] font-bold">AUG</span>
                        </div>
                        <div class="flex flex-col items-center gap-2">
                            <div class="w-full bg-slate-100 h-32 relative flex flex-col justify-end">
                                <div class="bg-slate-900 w-full h-3/4"></div>
                            </div>
                            <span class="mono text-[9px] font-bold">SEP</span>
                        </div>
                        <div class="flex flex-col items-center gap-2">
                            <div class="w-full bg-slate-100 h-32 relative flex flex-col justify-end">
                                <div class="bg-blue-600 w-full h-full animate-grow"></div>
                            </div>
                            <span class="mono text-[9px] font-bold text-blue-600 font-black tracking-tighter underline">OCT (NOW)</span>
                        </div>
                        <div class="flex flex-col items-center gap-2 opacity-20">
                            <div class="w-full bg-slate-100 h-32"></div><span class="mono text-[9px] font-bold">NOV</span>
                        </div>
                        <div class="flex flex-col items-center gap-2 opacity-20">
                            <div class="w-full bg-slate-100 h-32"></div><span class="mono text-[9px] font-bold">DEC</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </main>

</body>
</html>

```

