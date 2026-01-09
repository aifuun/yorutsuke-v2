# .claude Directory Structure

Master index for all `.claude` directory contents. This directory contains configuration, planning, workflow, and context information for Claude Code development sessions.

---

## 📁 Directory Organization

```
.claude/
├── 📋 Index & Navigation
│   ├── README.md (this file)
│   ├── WORKFLOW.md (master workflow reference)
│   ├── MEMORY.md (key decisions & context)
│   └── TODO.md (current session tasks)
│
├── 📑 Session Context
│   ├── INBOX.md (quick notes, ideas, feedback)
│   └── OPEN-QUESTIONS-CLARIFIED.md (Q&A log)
│
├── 📊 Plans (Feature/Issue Planning)
│   ├── README.md (plans directory guide)
│   ├── TEMPLATE-feature-plan.md (use for new features)
│   ├── TEMPLATE-issue-triage.md (use for issue triage)
│   ├── active/ (current development plans)
│   │   └── plan.md (current MVP/sprint plans)
│   ├── backlog/ (future features)
│   └── archive/ (completed features)
│       ├── batch-orchestrator-COMPLETED.md
│       ├── batch-orchestrator-PILLAR-FIXES.md
│       ├── batch-result-handler-PLAN.md
│       └── IMPLEMENTATION-COMPLETE-#99.md
│
├── 🔄 Workflow (Process Guides)
│   ├── README.md (workflow overview)
│   ├── planning.md (two-step planning index)
│   ├── planning-mvp.md (MVP-level decomposition, 40 min)
│   ├── planning-feature.md (Feature-level planning, 1-2h)
│   ├── planning-reference.md (Complete Steps 0-8)
│   ├── feature-development.md (4-phase lifecycle)
│   ├── development.md (Phase C guidance)
│   ├── docs.md (Phase A guidance)
│   ├── release.md (Phase D guidance)
│   ├── architecture.md (3-layer architecture index)
│   ├── architecture-core.md (deep dive)
│   └── quick-reference.md (visual one-pager)
│
├── ⚙️ Configuration
│   ├── settings.json (shared settings)
│   └── settings.local.json (local overrides)
│
├── 🛠️ Commands (Reusable Scripts)
│   ├── (20+ command scripts)
│   └── [see commands/README.md for details]
│
├── 📚 Rules (Context Rules)
│   ├── (rule files organized by feature/area)
│   └── [see rules/README.md for details]
│
└── 📦 Archive (Previous Session Context)
    ├── 2025-12.md (December 2025 summary)
    └── 2026-01-TODO-archive.md (archived tasks)
```

---

## 🎯 Quick Navigation

### I need to...

**Plan a new feature**
→ Copy `plans/TEMPLATE-feature-plan.md` to `plans/active/#[number]-feature.md`  
→ Reference: [plans/README.md](plans/README.md)

**Triage an issue**
→ Copy `plans/TEMPLATE-issue-triage.md` to `plans/active/#[number]-issue.md`  
→ Reference: [plans/README.md](plans/README.md)

**Understand the MVP structure**
→ Read: [workflow/planning.md](workflow/planning.md) (two-step overview)  
→ Deep dive: [workflow/planning-mvp.md](workflow/planning-mvp.md) (Step 1, 40 min)

**Plan a feature in detail**
→ Read: [workflow/planning-feature.md](workflow/planning-feature.md) (Step 2, 1-2h)  
→ Reference: [workflow/planning-reference.md](workflow/planning-reference.md) (all steps)

**Develop a feature**
→ Read: [workflow/development.md](workflow/development.md) (Phase C guide)  
→ Lifecycle overview: [workflow/feature-development.md](workflow/feature-development.md)

**Understand project architecture**
→ Quick overview: [workflow/architecture.md](workflow/architecture.md) (3 layers)  
→ Deep dive: [workflow/architecture-core.md](workflow/architecture-core.md)

**Check what I should be working on**
→ Read: [TODO.md](TODO.md) (current session tasks)  
→ See also: [MEMORY.md](MEMORY.md) (key context)

**Remember why we made a decision**
→ Read: [MEMORY.md](MEMORY.md) (decision log)  
→ Also check: [OPEN-QUESTIONS-CLARIFIED.md](OPEN-QUESTIONS-CLARIFIED.md) (Q&A)

**Quick reference for entire workflow**
→ Visual: [workflow/quick-reference.md](workflow/quick-reference.md) (one-pager)  
→ Master: [WORKFLOW.md](WORKFLOW.md) (index)

---

## 📋 File Purposes

### Session Context (Update Regularly)

| File | Purpose | Frequency |
|------|---------|-----------|
| `TODO.md` | Current session tasks, blockers, next steps | Daily |
| `INBOX.md` | Quick notes, ideas, feedback | As needed |
| `MEMORY.md` | Key decisions, important context, learnings | Weekly |
| `OPEN-QUESTIONS-CLARIFIED.md` | Q&A log, clarifications from user | As needed |

### Planning

| Directory | Purpose |
|-----------|---------|
| `plans/active/` | Current development features and plans |
| `plans/backlog/` | Future features not yet started |
| `plans/archive/` | Completed features and historical plans |

### Workflow (Reference Only)

| File | Purpose | Type |
|------|---------|------|
| `WORKFLOW.md` | Master workflow index | Reference |
| `workflow/planning-mvp.md` | MVP-level decomposition guide | Guide |
| `workflow/planning-feature.md` | Feature-level planning guide | Guide |
| `workflow/planning-reference.md` | Complete Steps 0-8 reference | Reference |
| `workflow/development.md` | Development phase execution | Guide |
| `workflow/feature-development.md` | Complete 4-phase lifecycle | Overview |
| `workflow/architecture.md` | 3-layer architecture index | Reference |

---

## 🔄 Workflow Phases

```
Phase A: Documentation
├─ workflow/docs.md

Phase B: Planning
├─ Step 1: MVP Decomposition (40 min)
│  └─ workflow/planning-mvp.md
├─ Step 2: Feature Planning (1-2h per feature)
│  └─ workflow/planning-feature.md
└─ Reference
   └─ workflow/planning-reference.md

Phase C: Development
├─ workflow/development.md
└─ workflow/feature-development.md

Phase D: Release
└─ workflow/release.md
```

---

## 📊 Key Statistics

| Category | Count | Location |
|----------|-------|----------|
| Planning workflows | 4 files | `workflow/planning-*.md` |
| Architecture docs | 2 files | `workflow/architecture*.md` |
| Development guides | 2 files | `workflow/development.md`, `feature-development.md` |
| Plan templates | 2 templates | `plans/TEMPLATE-*.md` |
| Current plans | 1 | `plans/active/` |
| Archived plans | 4 | `plans/archive/` |
| Session context | 4 files | `TODO.md`, `INBOX.md`, etc. |

---

## ✅ Maintenance Checklist

**Weekly**:
- [ ] Review and update `TODO.md` with new tasks
- [ ] Update `MEMORY.md` with key decisions from the week
- [ ] Archive completed plans from `plans/active/` → `plans/archive/`
- [ ] Promote ready features from `plans/backlog/` → `plans/active/`

**Monthly**:
- [ ] Review `OPEN-QUESTIONS-CLARIFIED.md` for clarification needs
- [ ] Update `MEMORY.md` with monthly summary
- [ ] Archive old session context (move previous month to `archive/`)
- [ ] Review workflow documents for accuracy

**As Needed**:
- [ ] Update `INBOX.md` with quick notes and ideas
- [ ] Create new plans using templates in `plans/`
- [ ] Update `MEMORY.md` when important decisions are made
- [ ] Update `WORKFLOW.md` if workflow changes

---

## 🔗 Related Documents

**Master Index**: [WORKFLOW.md](WORKFLOW.md)  
**Two-Step Planning**: [docs/dev/TWO_STEP_PLANNING.md](../docs/dev/TWO_STEP_PLANNING.md)  
**Plans Guide**: [plans/README.md](plans/README.md)  

---

## 📝 Tips

1. **Use this directory wisely**: Session context files (TODO, MEMORY, INBOX) are your notes; keep them current
2. **Plans are living documents**: Update plans as you develop, move them as they complete
3. **Templates are starting points**: Customize the templates for your team's needs
4. **Archive regularly**: Keep `plans/active/` focused on current work by archiving completed plans
5. **Cross-reference**: Link plans to GitHub Issues (#100, #101, etc.) and workflow docs

---

## 🚀 Getting Started

### For First Session:
1. Read [WORKFLOW.md](WORKFLOW.md) (5 min)
2. Read [TODO.md](TODO.md) (5 min)
3. Review [MEMORY.md](MEMORY.md) (10 min)
4. Check [workflow/quick-reference.md](workflow/quick-reference.md) (5 min)
5. Start work with clear context

### For Planning a Feature:
1. Read [workflow/planning-feature.md](workflow/planning-feature.md) (5 min)
2. Copy `plans/TEMPLATE-feature-plan.md` to `plans/active/`
3. Fill in the template (1-2 hours)
4. Start development using the plan

### For MVPs:
1. Read [workflow/planning-mvp.md](workflow/planning-mvp.md) (5 min)
2. Follow the 40-minute decomposition process
3. Create GitHub Issues for each feature
4. Use `workflow/planning-feature.md` for each feature when ready

