# Code Review Command

Run post-code checklist and optional audits before closing an issue.

## Usage

```
*review           # Review current issue
*review --audit   # Review + run all applicable audits
```

## Workflow

1. **Read TODO.md** to get current issue context
   - Tier classification
   - Applicable Pillars

2. **Load post-code checklist**: @.prot/checklists/post-code.md

3. **Verify each checklist item**:
   - Check code against Pillar rules
   - Mark items as pass/fail

4. **Ask about audits**:
   - "Run automated audits? (recommended for T2/T3)"
   - If yes, run `*audit` for applicable Pillars

5. **Output review summary**

## Output Format

```markdown
## Review Summary

**Issue**: #N - Title
**Tier**: T[X] - [Direct/Logic/Saga]
**Pillars Checked**: [A, D, L, ...]

### Checklist Results

#### Structure (Pillar I, L)
- [x] No deep imports
- [x] Headless/View separation maintained
- [ ] ⚠️ Issue: JSX found in headless hook

#### Types (Pillar A, B)
- [x] Branded types used for IDs
- [x] Airlock validation at boundaries

#### State (Pillar D)
- [x] FSM pattern used
- [x] No boolean flag combinations

#### T3 Specific (if applicable)
- [x] Idempotency barrier present
- [x] Compensation defined for all steps
- [ ] ⚠️ Missing version check in updateCart

### Audit Results (if run)
| Pillar | Status | Violations |
|--------|--------|------------|
| A | ✅ Pass | 0 |
| D | ❌ Fail | 2 |
| L | ✅ Pass | 0 |

### Summary

**Status**: PASS / NEEDS_FIX

**Issues Found**:
1. JSX in headless hook (src/modules/cart/headless/useCart.ts:25)
2. Missing version check (src/modules/cart/workflows/cartSaga.ts:48)

**Recommendations**:
- Move JSX to views/CartView.tsx
- Add `if (cart.version !== expected)` check before write
```

## After Review

- If **PASS**: Ready for `*issue close <n>`
- If **NEEDS_FIX**: Create fix tasks in TODO.md, then re-run `*review`
