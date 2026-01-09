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
# Edit and complete the plan
```

### Triaging an Issue

1. Copy template from `workflow/templates/TEMPLATE-issue-triage.md`
2. Save to `active/#[number]-issue.md`
3. Analyze and decide: Needs Clarification | Ready for Planning | Duplicate | Won't Fix
4. Move to `archive/` when resolved

**Example**:
```bash
cp ../workflow/templates/TEMPLATE-issue-triage.md active/#99-issue.md
# Edit and triage the issue
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

## ℹ️ Quick Guidance

See [workflow/templates/README.md](../workflow/templates/README.md) for:
- Template usage and decision tree
- Integration with planning workflow
- Tips for customizing templates

---

## 📊 Directory States

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

## 📝 Tips

1. **Keep plans current**: Update as you develop, not just at the end
2. **Be specific**: "Add authentication" is vague; "Implement OAuth2 with Google" is better
3. **Track progress**: Use checkboxes to show what's done
4. **Link dependencies**: Reference related issues (#100, #101, etc.)
5. **Archive completed plans**: Keeps active/ focused and clean

---

## 🔗 Related Documents

- **Templates & Guidance**: [workflow/templates/README.md](../workflow/templates/README.md)
- **Planning Workflows**: [workflow/planning-mvp.md](../workflow/planning-mvp.md), [planning-feature.md](../workflow/planning-feature.md)
- **Development Guide**: [workflow/development.md](../workflow/development.md)
- **Workflow Index**: [WORKFLOW.md](../WORKFLOW.md)

