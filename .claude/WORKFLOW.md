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

## 📚 Complete Workflow Documentation

### Phase A: Documentation
**When**: Documentation updates required  
**File**: `@workflow/docs.md`  
**Use case**: Adding/updating requirements, architecture, design docs

### Phase B: Planning (Feature Development) ⭐ Most Important
**When**: Planning new features or releases  
**Main guide**: `@workflow/planning.md` (Two-step process)  
**Architecture**: `@workflow/architecture.md` (MVP → Issues → TODO flow)  
**Quick ref**: `@workflow/quick-reference.md` (one-pager with visuals)  

**Two-step process**:

**Step 1: MVP-Level Decomposition** (40 minutes)
→ `@workflow/planning-mvp.md`
- When: Starting new MVP release
- Output: GitHub Issues + dependency graph
- 1. Analyze MVP goal
- 2. Identify features (rough sizing)
- 3. Map dependencies
- 4. Create GitHub Issues (minimal info)

**Step 2: Feature-Level Planning** (1-2 hours)
→ `@workflow/planning-feature.md`
- When: Ready to develop a specific feature
- Output: Dev Plan + Test Cases (in GitHub Issue)
- 1. Validate requirements
- 2. Create detailed development plan
- 3. Create test cases with coverage
- 4. Add to issue + apply labels

**Complete Reference** (all 8 steps):
→ `@workflow/planning-reference.md`

### Phase C: Development (Coding & Execution)
**When**: Writing code, following implementation plan  
**File**: `@workflow/development.md`  
**Commands**: `*tier`, `*next`, `*review`  
**Phases**: Pre-code → In-code → Tests → Post-code review

### Phase D: Release
**When**: Publishing version  
**File**: `@workflow/release.md`

### Feature Development Guide
**New feature from start to finish**:  
`@workflow/feature-development.md`  
(Complete lifecycle: from feature request to testing ready)

---

## 🔄 Three-Layer Architecture

```
Layer 1: MVP (Strategic)
  ↓ [Planning workflow Steps 0-8]
Layer 2: GitHub Issues (Tactical)  
  ↓ [*issue pick]
Layer 3: TODO.md (Operational)
  ↓ [*next command]
Code Execution
```

**Detailed breakdown**: See `@workflow/architecture.md`

---

## 📋 Session Commands Cheatsheet

| Command | Purpose | When |
|---------|---------|------|
| `*status` | Git + issue overview | Start of session |
| `*resume` | Pull + load MEMORY.md | Session start |
| `*issue pick <N>` | Start working on #N | Beginning of feature work |
| `*tier` | Classify complexity | Optional, for complex tasks |
| `*next` | Show next step | During coding (Phase 1-4) |
| `*review` | Final audit | Before `*issue close` |
| `*issue close <N>` | Complete issue | End of feature |
| `*sync` | Commit + push | End of session |

---

## 📁 Context Files (in `.claude/`)

| File | Purpose | Update |
|------|---------|--------|
| `TODO.md` | Active session tasks (1-3 issues) | Per session |
| `MEMORY.md` | Key decisions, learnings | When notable |
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
  (TODO.md cleared, decision archived to MEMORY.md)

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
2. Read `@workflow/quick-reference.md` - visual overview

**Before planning a feature** (30 min):
1. Read `@workflow/planning.md` - understand 8 steps
2. Review `@workflow/architecture.md` - understand MVP/Issues/TODO flow

**When coding** (on-demand):
1. Load `@workflow/development.md` - phase guidance
2. Use `*next` command - AI will guide you

**For deep understanding** (optional, 1-2 hours):
1. `@workflow/architecture.md` - complete mental model
2. `@workflow/feature-development.md` - real example walkthrough

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

1. **Always start with `*resume`** - loads context from MEMORY.md
2. **Use `*next` liberally** - it's the intelligent task navigator
3. **Keep TODO.md minimal** - only 1-3 active issues per session
4. **Update MEMORY.md on findings** - captures learning for future sessions
5. **Reference workflow files with `@`** - system loads them automatically

---

**Last updated**: 2026-01-09  
**Status**: Ready for team use
