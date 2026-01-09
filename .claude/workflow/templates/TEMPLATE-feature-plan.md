# Feature Plan Template

**Status**: [Not Started | In Progress | In Review | Completed]  
**GitHub Issue**: #[number]  
**Assignee**: @[username]  
**Target Date**: [YYYY-MM-DD]  
**Estimated Hours**: [8h | 16h | 32h | etc.]  

> **Where to use**: Step 2 of two-step planning (planning-feature.md)  
> **When**: Before developing a specific feature  
> **File location**: `plans/active/#[number]-feature-name.md`

---

## 📋 Overview

### Feature Goal
Clear, one-sentence description of what this feature accomplishes.

### Why This Matters
- User benefit: ...
- Business value: ...
- Technical debt addressed: ... (if applicable)

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
- [ ] All tests passing
- [ ] Documentation updated

---

## 🏗️ Implementation Plan

### Architecture Changes
- **Files to create**: [List new files]
- **Files to modify**: [List existing files with specific changes]
- **Files to delete**: [If applicable]
- **Dependencies**: [Libraries, services, or other features this depends on]

### Implementation Steps
1. **Setup** (X hours)
   - [ ] Subtask 1
   - [ ] Subtask 2
   
2. **Core Implementation** (X hours)
   - [ ] Subtask 1
   - [ ] Subtask 2
   
3. **Testing** (X hours)
   - [ ] Subtask 1
   - [ ] Subtask 2
   
4. **Documentation** (X hours)
   - [ ] Update code comments
   - [ ] Update README
   - [ ] Update API docs (if applicable)

---

## 🧪 Test Cases

### Unit Tests
| Test Case | Input | Expected Output | Priority |
|-----------|-------|-----------------|----------|
| TC-1: [Name] | | | High |
| TC-2: [Name] | | | High |
| TC-3: [Name] | | | Medium |

### Integration Tests
| Test Case | Setup | Steps | Expected | Priority |
|-----------|-------|-------|----------|----------|
| TC-I1: [Name] | | | | High |
| TC-I2: [Name] | | | | High |

### Edge Cases
| Edge Case | Behavior | Test |
|-----------|----------|------|
| Null/empty input | Should handle gracefully | |
| Large dataset | Should not timeout | |
| Concurrent requests | Should not race | |

---

## 📊 Files Involved

| File | Change Type | Details |
|------|-------------|---------|
| `src/path/file.ts` | Modify | Add new function `foo()`, update `bar()` |
| `src/path/new-file.ts` | Create | New module for [purpose] |
| `src/path/old-file.ts` | Delete | Merged into file.ts |

---

## ⚠️ Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| [Risk description] | High/Medium/Low | [Mitigation plan] |

---

## 🔗 Dependencies

### Blocks
- [ ] Feature #[number] (must be completed first)
- [ ] Feature #[number] (must be completed first)

### Blocked By
- [ ] Feature #[number] (blocking)
- [ ] Feature #[number] (blocking)

### Related Features
- [ ] Feature #[number] (similar work)
- [ ] Feature #[number] (uses this)

---

## 📝 Notes

### Learning Points from Previous Features
- [Any learnings that affect this feature's plan]

### Known Constraints
- [Deployment constraints, browser compatibility, etc.]

### Open Questions
- [ ] Question 1? → Answer
- [ ] Question 2? → Answer

---

## ✅ Completion Checklist

- [ ] All tests passing locally
- [ ] Code reviewed and approved
- [ ] PR merged to main
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] Tested in staging
- [ ] Deployed to production
- [ ] Production validation complete
- [ ] Close GitHub Issue

---

## 📈 Progress Tracking

| Date | Status | Notes |
|------|--------|-------|
| 2026-01-15 | Not Started | Plan created |
| | In Progress | [Date] - Started implementation |
| | In Review | [Date] - PR submitted |
| | Completed | [Date] - Deployed |

---

## 🎯 Success Metrics

- [ ] Feature works as described in acceptance criteria
- [ ] No regressions in existing tests
- [ ] Code coverage maintained/improved
- [ ] Performance baseline: [metric] ≤ [threshold]
- [ ] User feedback: [success criteria]

