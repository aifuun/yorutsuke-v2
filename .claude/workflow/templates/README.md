# Planning Templates

Standardized templates for feature planning and issue triage.

---

## 📋 Available Templates

### TEMPLATE-feature-plan.md
**Purpose**: Comprehensive planning guide for implementing new features

**When to Use**:
- Planning a new feature for current MVP (Step 2 of two-step planning)
- Significant enhancement to existing feature
- Cross-team work requiring coordination
- Complex implementation needing detailed breakdown

**Sections**:
- Overview (goal, why it matters, acceptance criteria)
- Implementation plan (architecture, steps, subtasks)
- Test cases (unit, integration, edge cases)
- Files involved (what changes)
- Risks & mitigations
- Dependencies
- Progress tracking
- Success metrics

**Usage**:
```bash
cp workflow/templates/TEMPLATE-feature-plan.md plans/active/#100-feature-name.md
# Then edit and complete the plan
```

**Related**: See [planning-feature.md](planning-feature.md) for Step 2 of planning process

---

### TEMPLATE-issue-triage.md
**Purpose**: Structured issue analysis and decision making

**When to Use**:
- Evaluating new GitHub issues
- Determining if issue is ready for planning
- Assessing severity and complexity
- Deciding on issue resolution (Ready | Needs Clarification | Duplicate | Won't Fix)

**Sections**:
- Issue type & severity classification
- Complexity assessment
- Clarification questions
- Triage decision with reasoning
- Action items

**Usage**:
```bash
cp workflow/templates/TEMPLATE-issue-triage.md plans/active/#99-issue.md
# Then analyze and make triage decision
```

**Related**: Part of Phase B (Planning) workflow

---

## 🔄 When to Use Each

### Feature Planning
1. **Situation**: Ready to start development on a feature
2. **Steps**:
   - Copy [TEMPLATE-feature-plan.md](TEMPLATE-feature-plan.md)
   - Create: `plans/active/#100-feature-name.md`
   - Fill in sections following the template
   - Use during development to track progress
   - Move to `plans/archive/` when completed

### Issue Triage
1. **Situation**: New GitHub issue needs evaluation
2. **Steps**:
   - Copy [TEMPLATE-issue-triage.md](TEMPLATE-issue-triage.md)
   - Create: `plans/active/#99-issue.md`
   - Analyze and make triage decision
   - Document action items
   - Close triage document when issue is resolved

---

## 📚 Integration with Workflow

These templates are part of Phase B (Planning):

**MVP-Level Decomposition** (40 min)
→ [planning-mvp.md](planning-mvp.md)
- Fast feature identification

**Feature-Level Planning** (1-2h)
→ [planning-feature.md](planning-feature.md)
- Use [TEMPLATE-feature-plan.md](TEMPLATE-feature-plan.md) here
- Detailed implementation planning

**Issue Triage** (as needed)
- Use [TEMPLATE-issue-triage.md](TEMPLATE-issue-triage.md)
- Before feature planning or during issue evaluation

---

## 💡 Customization

Feel free to customize these templates for your team's needs:
- Add sections specific to your architecture
- Adjust estimation granularity
- Add team-specific quality criteria
- Modify acceptance criteria categories

---

## 🔗 See Also

- [planning.md](planning.md) - Two-step planning overview
- [planning-mvp.md](planning-mvp.md) - Step 1: MVP decomposition
- [planning-feature.md](planning-feature.md) - Step 2: Feature planning
- [../plans/README.md](../plans/README.md) - Plans directory guide

