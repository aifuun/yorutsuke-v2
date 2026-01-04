这是根据你提供的结构，为 **Yorutsuke V2** 重新打造的**“工业控制面板”级设置界面**。

在这个设计中，我将普通的菜单项转化为**实体拨杆开关**和**选择块**，并保留了核心的“硬阴影”与“工业黑”视觉语言。

---

### 💻 重新设计的 Setting 模块

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yorutsuke V2 - System Configuration</title>
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

        /* 硬核物理选择器 */
        .option-box { border: 2px solid #0F172A; transition: all 0.15s; cursor: pointer; }
        .option-box.active { background: #0F172A; color: white; box-shadow: 4px 4px 0px #3B82F6; }

        /* 硬核拨杆开关 */
        .toggle-switch { width: 48px; height: 24px; background: #E2E8F0; border: 2px solid #0F172A; position: relative; cursor: pointer; }
        .toggle-switch.on { background: #10B981; }
        .toggle-handle { width: 16px; height: 16px; background: #0F172A; position: absolute; top: 2px; left: 2px; transition: 0.2s; }
        .toggle-switch.on .toggle-handle { left: 26px; background: white; }
    </style>
</head>
<body class="flex h-screen overflow-hidden">

    <aside class="w-64 bg-[#0F172A] text-slate-400 flex flex-col z-20 shadow-2xl">
        <div class="p-8 flex items-center gap-3">
            <div class="w-7 h-7 bg-blue-500 flex items-center justify-center text-white font-black text-sm rounded text-center">Y</div>
            <span class="text-white font-extrabold tracking-tighter text-xl uppercase italic">Yorutsuke</span>
        </div>
        <nav class="flex-1 px-4 py-4 space-y-1">
            <a href="#" class="nav-item flex items-center gap-4 px-4 py-3 text-xs font-bold uppercase tracking-widest">
                <span>Capture</span>
            </a>
            <a href="#" class="nav-item flex items-center gap-4 px-4 py-3 text-xs font-bold uppercase tracking-widest">
                <span>Ledger</span>
            </a>
            <a href="#" class="nav-item flex items-center gap-4 px-4 py-3 text-xs font-bold uppercase tracking-widest">
                <span>Report</span>
            </a>
            <a href="#" class="nav-item active flex items-center gap-4 px-4 py-3 text-xs font-bold uppercase tracking-widest">
                <span>Setting</span>
            </a>
        </nav>
    </aside>

    <main class="flex-1 flex flex-col overflow-hidden bg-[#F8FAFC]">
        <header class="h-16 bg-white border-b border-slate-200 px-10 flex items-center justify-between">
            <div class="mono text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 underline underline-offset-8 decoration-blue-500">System_Control / Settings</div>
            <div class="mono text-[10px] font-bold text-slate-400 uppercase tracking-widest">Node: <span class="text-blue-600">Global_v2.1</span></div>
        </header>

        <div class="flex-1 overflow-y-auto p-12 no-scrollbar">
            <div class="max-w-3xl mx-auto space-y-16">
                
                <section class="space-y-8">
                    <div class="flex items-center gap-4">
                        <span class="mono text-[11px] font-black bg-slate-900 text-white px-2 py-0.5">01</span>
                        <h3 class="mono text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Preferences</h3>
                    </div>

                    <div class="bg-white hard-border p-10 space-y-10 shadow-[8px_8px_0px_rgba(15,23,42,0.05)]">
                        <div class="flex items-center justify-between">
                            <div class="mono text-xs font-bold uppercase tracking-tighter text-slate-800">Theme_Engine</div>
                            <div class="flex gap-2">
                                <div class="option-box px-4 py-2 mono text-[10px] font-black uppercase">Light</div>
                                <div class="option-box active px-4 py-2 mono text-[10px] font-black uppercase">Dark</div>
                            </div>
                        </div>

                        <div class="flex items-center justify-between">
                            <div class="mono text-xs font-bold uppercase tracking-tighter text-slate-800">Language_Local</div>
                            <div class="flex gap-2">
                                <div class="option-box active px-4 py-2 mono text-[10px] font-black uppercase tracking-widest">日本語</div>
                                <div class="option-box px-4 py-2 mono text-[10px] font-black uppercase tracking-widest">English</div>
                            </div>
                        </div>

                        <div class="flex items-center justify-between pt-4 border-t border-slate-100">
                            <div class="mono text-xs font-bold uppercase tracking-tighter text-slate-800">Push_Notifications</div>
                            <div class="toggle-switch on"><div class="toggle-handle"></div></div>
                        </div>
                    </div>
                </section>

                <section class="space-y-8">
                    <div class="flex items-center gap-4">
                        <span class="mono text-[11px] font-black bg-slate-900 text-white px-2 py-0.5">02</span>
                        <h3 class="mono text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Developer</h3>
                    </div>
                    <div class="bg-white hard-border p-10 flex justify-between items-center shadow-[8px_8px_0px_rgba(15,23,42,0.05)]">
                        <div class="mono text-xs font-bold uppercase tracking-tighter text-slate-800">Debug_Mode</div>
                        <div class="toggle-switch"><div class="toggle-handle"></div></div>
                    </div>
                </section>

                <section class="space-y-8">
                    <div class="flex items-center gap-4">
                        <span class="mono text-[11px] font-black bg-slate-900 text-white px-2 py-0.5">03</span>
                        <h3 class="mono text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">System_Info</h3>
                    </div>
                    <div class="space-y-4">
                        <div class="flex justify-between items-center p-6 bg-slate-100/50 hard-border border-dashed">
                            <div class="mono text-[10px] font-bold text-slate-500">VERSION_HASH</div>
                            <div class="mono text-[10px] font-black text-slate-800">0.1.0-STABLE</div>
                        </div>
                        <button class="w-full bg-rose-50 border-2 border-rose-500 text-rose-600 mono text-xs font-black py-4 uppercase tracking-[0.4em] hover:bg-rose-500 hover:text-white transition-all shadow-[4px_4px_0px_#E11D48] hover:shadow-none hover:translate-x-1 hover:translate-y-1">
                            Logout_Session
                        </button>
                    </div>
                </section>

            </div>
        </div>
    </main>

</body>
</html>

```

---

### 📘 Setting 模块设计细节说明

#### 1. 布局结构 (Structure)

* **分级编号**：每个大板块（Preferences, Developer, About）左侧增加了 `01`, `02` 这种数字标签。这在工业说明书中很常见，增加了系统的“仪式感”。
* **块状化菜单**：不再使用列表，而是使用 `hard-border` 包裹的卡片。

#### 2. 交互元素 (Interactive Design)

* **Theme & Language**: 弃用了传统的下拉框，改为 **“硬质切换块” (Option Box)**。激活项拥有深蓝色的硬阴影 (`shadow-[4px_4px_0px_#3B82F6]`)。
* **Toggle Switch**: 纯正的工业拨杆样式。只有在 `on` 状态下才会显色，符合物理开关的直觉。

#### 3. 退出按钮 (Logout Design)

* **警示色系统**：使用 `rose-500` (玫瑰红)。
* **反向阴影**：按钮自带一个红色的硬阴影，点击时通过 `hover:shadow-none` 和位移效果，模拟物理按钮被按下去的真实手感。

#### 4. Debug Mode

* 放在一个独立的卡片中，并采用较简单的布局，暗示这属于“进阶功能”。

**这个设计完美融合了你提供的设置项列表和 Yorutsuke V2 的核心工业美学。你觉得这一版设置页面的清晰度如何？如果有任何其他功能细节（比如个人资料修改）需要加入，请告诉我。**

温馨提示：如要解锁所有应用的完整功能，请开启 [Gemini 应用活动记录](https://myactivity.google.com/product/gemini)。