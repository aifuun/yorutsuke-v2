# Workflow Index & Cheatsheet

**Complete development workflow documentation and quick reference**

---

## 🎯 Quick Start (30 seconds)

```bash
*resume              # Pull latest, load context
*issue pick <N>      # Start working on issue #N
*next                # Follow guidance for next step
*sync                # Commit and push changes
```

---

## 📋 Template System Integration

**5 个模板，3 层架构**（军事类比）

| 层级 | Template | 输出位置 | 触发命令 |
|------|----------|----------|----------|
| 战略 (Strategy) | `TEMPLATE-mvp.md` | `docs/dev/MVPX.md` | `*plan` |
| 战役 (Campaign) | `TEMPLATE-feature-plan.md` | `plans/active/#xxx.md` | `*issue pick` |
| 战役 (Campaign) | `TEMPLATE-github-issue.md` | GitHub Issues | `*issue new` |
| 战术 (Tactics) | Issue Plan files | `.claude/plans/active/#xxx.md` | `*next` |
| 辅助 | `TEMPLATE-issue-triage.md` | `plans/active/#xxx-triage.md` | as needed |

**Quick access**: `.claude/workflow/templates/`
**Guidance**: `workflow/planning-mvp.md` (Step 1) + `planning-feature.md` (Step 2)

**Auto-loading**: 编辑 MVP/Feature Plan 文件时会自动加载相关模板提示

---

## 📚 Complete Workflow Documentation

### Phase A: Documentation
**When**: Documentation updates required  
**File**: `.claude/workflow/docs.md`  
**Use case**: Adding/updating requirements, architecture, design docs

### Phase B: Planning (Feature Development) ⭐ Most Important
**When**: Planning new features or releases  
**Main guide**: `.claude/workflow/planning.md` (Two-step process)  
**Plan templates**: `.claude/workflow/templates/` (feature plan & issue triage templates)  
**Plan storage**: `.claude/plans/active/` (current features), `.claude/plans/archive/` (completed)  
**Architecture**: `.claude/workflow/architecture.md` (MVP → Issues → TODO flow)  
**Quick ref**: `.claude/workflow/quick-reference.md` (one-pager with visuals)  

**Two-step process**:

**Step 1: MVP-Level Decomposition** (40 minutes)
→ `.claude/workflow/planning-mvp.md`
- When: Starting new MVP release
- Output: GitHub Issues + dependency graph
- 1. Analyze MVP goal
- 2. Identify features (rough sizing)
- 3. Map dependencies
- 4. Create GitHub Issues (minimal info)

**Step 2: Feature-Level Planning** (1-2 hours)
→ `.claude/workflow/planning-feature.md`
- When: Ready to develop a specific feature
- Output: Dev Plan + Test Cases (in GitHub Issue)
- 1. Validate requirements
- 2. Create detailed development plan
- 3. Create test cases with coverage
- 4. Add to issue + apply labels

**Complete Reference** (all 8 steps):
→ `.claude/workflow/planning-reference.md`

### Phase C: Development (Coding & Execution)
**When**: Writing code, following implementation plan  
**File**: `.claude/workflow/development.md`  
**Commands**: `*tier`, `*next`, `*review`  
**Phases**: Pre-code → In-code → Tests → Post-code review

### Phase D: Release
**When**: Publishing version  
**File**: `.claude/workflow/release.md`

### Feature Development Guide
**New feature from start to finish**:  
`.claude/workflow/feature-development.md`  
(Complete lifecycle: from feature request to testing ready)

---

## 🔄 Three-Layer Architecture

```
Layer 1: MVP (Strategic)
  ↓ [Planning workflow Steps 0-8]
Layer 2: GitHub Issues (Tactical)  
  ↓ [*issue pick]
Layer 3: Issue Plans (Operational)
  ↓ [*next command]
Code Execution
```

**Detailed breakdown**: See `.claude/workflow/architecture.md`

---

## 🌿 Branch Strategy (Git Flow)

```
main (production)
 │
 ├── hotfix/xxx ────────────┐
 │                          │
development (integration) ◄─┘
 │
 ├── issue/xxx ─────────────┐
 ├── feature/xxx            │
 └── bugfix/xxx ────────────┘
```

| Branch Type | Base | Command | Use Case |
|-------------|------|---------|----------|
| `issue/<n>` | development | `*issue pick <n>` | Feature work |
| `bugfix/<desc>` | development | `*bugfix start <desc>` | Dev bug fix |
| `hotfix/<desc>` | main | `*hotfix start <desc>` | Production fix |

**Full guide**: `.claude/workflow/branch-strategy.md`

---

## 📋 Session Commands Cheatsheet

| Command | Purpose | When |
|---------|---------|------|
| `*status` | Git + issue overview | Start of session |
| `*resume` | Pull + load MEMORY.md | Session start |
| `*issue pick <N>` | Start working on #N (creates branch) | Beginning of feature work |
| `*issue close <N>` | Complete issue (merges branch) | End of feature |
| `*bugfix start` | Fix bug on development | Bug in dev |
| `*hotfix start` | Fix production issue | Critical prod bug |
| `*tier` | Classify complexity | Optional, for complex tasks |
| `*next` | Show next step | During coding (Phase 1-4) |
| `*review` | Final audit | Before `*issue close` |
| `*sync` | Commit + push | End of session |
| `*release` | Merge dev → main + tag | Release time |

---

## 📁 Context Files (in `.claude/`)

| File | Purpose | Update |
|------|---------|--------|
| `.plans/active/#xxx.md` | Active issue plans | Per issue |
| `MEMORY.md` | Key decisions (ADR index only) | When creating ADR |
| `WORKFLOW.md` | This index (you are here) | Updated with process |

---

## 🗂️ What Goes Where

**In `.claude/workflow/`** (detailed documentation):
- `planning.md` - 8-step planning process with checklists
- `development.md` - Phase 1-4 execution guidance
- `docs.md` - Documentation updates workflow
- `release.md` - Release/versioning process
- `architecture.md` - Three-layer (MVP/Issues/TODO) architecture explained
- `feature-development.md` - Complete feature lifecycle example
- `quick-reference.md` - One-page visual summary

**In `.claude/`** (quick access, minimal):
- `WORKFLOW.md` - This index/cheatsheet (for quick lookup)
- `TODO.md` - Current session tasks
- `MEMORY.md` - Decisions & learnings

**In `.claude/rules/`** (standards & principles):
- `workflow.md` - Core workflow rules (MVP/Issues/TODO three-layer principle)

---

## 🚀 Typical Session Flow

```
Morning
  $ *resume
  $ *next
  → Recommends Issue #102 from MVP3.1
  $ *issue pick 102

Working on feature
  $ *next  (Phase 1: Pre-code)
  $ *next  (Phase 2-3: In-code, follow dev plan from issue)
  $ *review (Phase 4: Final check)
  $ *issue close 102

End of session
  $ *sync
  (plans archived, decisions documented in ADRs)

Next day
  $ *resume
  $ *next
  → Recommends Issue #103
  $ *issue pick 103
  ... (repeat)
```

---

## 🎓 For New Team Members

**Start here** (5 min read):
1. Read this file (WORKFLOW.md) - understand the phases
2. Read `.claude/workflow/quick-reference.md` - visual overview

**Before planning a feature** (30 min):
1. Read `.claude/workflow/planning.md` - understand 8 steps
2. Review `.claude/workflow/architecture.md` - understand MVP/Issues/TODO flow

**When coding** (on-demand):
1. Load `.claude/workflow/development.md` - phase guidance
2. Use `*next` command - AI will guide you

**For deep understanding** (optional, 1-2 hours):
1. `.claude/workflow/architecture.md` - complete mental model
2. `.claude/workflow/feature-development.md` - real example walkthrough

---

## 📖 Navigation Map

```
Need to...                          → Go to
────────────────────────────────────────────────
Understand the overall flow         → quick-reference.md
Plan a new feature                  → planning.md (Steps 0-8)
Understand MVP/Issues/TODO          → architecture.md
See a complete example              → feature-development.md
Code a feature                      → development.md (Phase 1-4)
Know what to do next                → *next command
Release a version                   → release.md
```

---

## ⚡ Pro Tips

1. **Always start with `*resume`** - loads context from MEMORY.md and active plans
2. **Use `*next` liberally** - it's the intelligent task navigator
3. **Keep issue plans focused** - one issue per `.claude/plans/active/#xxx.md` file
4. **Create ADRs for major decisions** - captures architecture knowledge for future sessions
5. **Reference workflow files with `@`** - system loads them automatically

---

**Last updated**: 2026-01-09  
**Status**: Ready for team use
