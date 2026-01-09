# Plans Directory

Organized storage for feature plans, issue plans, and related planning documents.

---

## 📁 Structure

```
plans/
├── README.md (this file)
├── active/ (current development)
│   ├── #100-feature-name.md (use template from workflow/templates/)
│   └── ...
├── backlog/ (future features)
│   └── ...
└── archive/ (completed)
    └── ...
```

**Templates are stored in**: [workflow/templates/](../workflow/templates/)
- `TEMPLATE-feature-plan.md` - for feature planning
- `TEMPLATE-issue-triage.md` - for issue triage
```

---

## 🚀 Usage Guide

### Creating a Feature Plan

1. Copy template from `workflow/templates/TEMPLATE-feature-plan.md`
2. Save to `active/#[number]-[feature-name].md`
3. Fill in all sections following the template
4. Use during development to track progress
5. Move to `archive/` when completed

**Example**:
```bash
cp ../workflow/templates/TEMPLATE-feature-plan.md active/#100-auth-system.md
# Edit active/#100-auth-system.md
```

### Triaging an Issue

1. Copy template from `workflow/templates/TEMPLATE-issue-triage.md`
2. Save to `active/#[number]-issue.md`
3. Analyze and decide: Needs Clarification | Ready for Planning | Duplicate | Won't Fix
4. Move to `archive/` when resolved

**Example**:
```bash
cp ../workflow/templates/TEMPLATE-issue-triage.md active/#99-issue.md
# Edit and triage active/#99-bug-report.md
```

---

## 📋 File Naming Convention

| Type | Format | Example |
|------|--------|---------|
| Feature Plan | `active/#[number]-[name].md` | `#100-auth-system.md` |
| Issue Triage | `active/#[number]-issue.md` | `#99-issue.md` |
| Completed | `archive/#[number]-[name].md` | `archive/#100-auth-system.md` |
| Backlog | `backlog/#[number]-[name].md` | `backlog/#150-future-feature.md` |

---

## ✅ States

### Active Plans
- Currently being developed or planned
- Stored in `active/` folder
- Updated regularly during development
- Transition to `archive/` when completed

### Backlog Plans
- Future features not yet started
- Stored in `backlog/` folder
- Can be promoted to `active/` when prioritized
- Move to `active/` when starting development

### Archived Plans
- Completed features (deployed to production)
- Stored in `archive/` folder
- Reference only
- Kept for historical context and learnings

---

## 📊 When to Create Plans

### Feature Plans (Full Template)
- [ ] New feature for current MVP (step 2 of planning)
- [ ] Significant enhancement to existing feature
- [ ] Cross-team work requiring coordination
- [ ] Complex implementation needing detailed breakdown

### Quick Notes (Simplified)
- [ ] Small bug fixes (use comment in GitHub Issue)
- [ ] Typo/documentation fixes (use comment in GitHub Issue)
- [ ] Minor refactoring with clear scope

---

## 🔗 Related Documents

- **Planning Workflows**: [.claude/workflow/planning-mvp.md](../workflow/planning-mvp.md)
- **Feature Development**: [.claude/workflow/planning-feature.md](../workflow/planning-feature.md)
- **Development Guide**: [.claude/workflow/development.md](../workflow/development.md)
- **Workflow Index**: [.claude/WORKFLOW.md](../WORKFLOW.md)

---

## 📝 Tips

1. **Keep it current**: Update the plan as you develop, don't just update at the end
2. **Be specific**: "Add authentication" is vague; "Implement OAuth2 with Google provider" is clear
3. **Track progress**: Use checkboxes to show what's done
4. **Link related issues**: Help others understand dependencies
5. **Archive early**: Move completed plans to archive/ to keep active/ clean

---

## 🎯 Quick Start

```bash
# Create a new feature plan
cp ../workflow/templates/TEMPLATE-feature-plan.md active/#100-my-feature.md

# Create a new issue triage
cp ../workflow/templates/TEMPLATE-issue-triage.md active/#99-issue.md

# Move completed plan to archive
mv active/#100-my-feature.md archive/#100-my-feature.md
```

