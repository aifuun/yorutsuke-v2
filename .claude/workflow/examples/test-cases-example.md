# Test Cases Example

> Detailed example for Step 4: Create Test Cases

**Feature**: Shopping Cart State Management

---

## Complete Test Cases

```markdown
# Feature: Shopping Cart State - Test Cases

## Test Case Format
```
TC-N.M: [Title]
├─ Given: [Initial state]
├─ When: [User action or trigger]
└─ Then: [Expected result with checkboxes]
```

## Step 1: Redux Slice Tests

### TC-1.1: Add item to empty cart
- Given: Cart is empty []
- When: dispatch addItem({id: "coffee", name: "Coffee", price: 5, qty: 2})
- Then:
  - [ ] Redux state contains 1 item
  - [ ] Item has: id="coffee", qty=2, price=5
  - [ ] Cart total = 10 (price × qty)

### TC-1.2: Add duplicate item (same ID)
- Given: Cart has [{id: "coffee", qty: 2}]
- When: dispatch addItem({id: "coffee", qty: 1})
- Then:
  - [ ] Cart still has 1 item (not 2)
  - [ ] Item qty updated to 3
  - [ ] No duplicates created

### TC-1.3: Remove item
- Given: Cart has [{id: "coffee", qty: 2}, {id: "tea", qty: 1}]
- When: dispatch removeItem("coffee")
- Then:
  - [ ] Coffee removed from state
  - [ ] Tea remains in cart
  - [ ] Cart length = 1

### TC-1.4: Update quantity
- Given: Cart has [{id: "coffee", qty: 2}]
- When: dispatch updateQuantity({id: "coffee", qty: 5})
- Then:
  - [ ] Quantity updated to 5
  - [ ] Item still in cart
  - [ ] No duplicates

## Step 2: localStorage Persistence Tests

### TC-2.1: Cart saves to localStorage on add
- Given: Cart is empty
- When: dispatch addItem({id: "coffee", qty: 2})
- Then:
  - [ ] localStorage["cart"] contains the item
  - [ ] Data is JSON stringified
  - [ ] Can be parsed back to object

### TC-2.2: Cart loads from localStorage on app init
- Given: localStorage has {"cart": "[{id: \"coffee\", qty: 2}]"}
- When: App initializes and cart middleware loads
- Then:
  - [ ] Redux state populated from localStorage
  - [ ] Cart shows 1 item with qty=2
  - [ ] No errors in console

### TC-2.3: Corrupted localStorage handled gracefully
- Given: localStorage["cart"] = "invalid json"
- When: App initializes
- Then:
  - [ ] No crash
  - [ ] Cart starts empty
  - [ ] Error logged to console

## Step 3: Integration Tests

### TC-3.1: Add → Persist → Reload → Verify
- Given: App running, localStorage empty
- When:
  1. Add Coffee (qty: 2)
  2. Add Tea (qty: 1)
  3. Reload page
- Then:
  - [ ] After reload, cart has 2 items
  - [ ] Coffee qty still 2
  - [ ] Tea qty still 1
  - [ ] No data loss

### TC-3.2: Remove → Persist → Reload → Verify
- Given: Cart has Coffee and Tea
- When:
  1. Remove Coffee
  2. Reload page
- Then:
  - [ ] After reload, only Tea in cart
  - [ ] Coffee gone
  - [ ] localStorage updated

## Coverage Matrix

| Acceptance Criterion | Test Cases | Status |
|-------------------|-----------|--------|
| Add item with qty | TC-1.1, TC-2.1 | ✅ |
| Prevent duplicates | TC-1.2 | ✅ |
| Remove item | TC-1.3, TC-3.2 | ✅ |
| Update quantity | TC-1.4 | ✅ |
| Persist to storage | TC-2.1, TC-3.1 | ✅ |
| Load from storage | TC-2.2, TC-3.1 | ✅ |
| Handle errors | TC-2.3 | ✅ |

**Coverage**: 9 test cases covering all acceptance criteria (100%)
```

---

## Test Case Template

Use this format for test cases:

```markdown
# Feature: [Name] - Test Cases

## Test Case Format
```
TC-N.M: [Title]
├─ Given: [Initial state]
├─ When: [User action]
└─ Then: [Expected results with checkboxes]
```

## Step N: [Component] Tests

### TC-N.1: [Test name]
- Given: [initial state]
- When: [action]
- Then:
  - [ ] Expected result 1
  - [ ] Expected result 2

## Coverage Matrix

| Acceptance Criterion | Test Cases | Status |
|-------------------|-----------|--------|
| Criterion 1 | TC-1.1, TC-2.1 | ✅ |
| Criterion 2 | TC-1.2 | ✅ |

**Coverage**: N test cases covering all criteria (100%)
```

---

## Why Coverage Matrix Matters

- ✅ Ensures every acceptance criterion is tested
- ✅ Shows which tests cover which requirements
- ✅ Makes gaps visible immediately
- ✅ 100% coverage required before implementation
