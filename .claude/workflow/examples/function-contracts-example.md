# Function Contracts Example

> Detailed example for Step 1: Define Key Functions + Unit Tests

**Feature**: Daily Statistics Dashboard

---

## Function Contract Example

### calculateDailyStats

```typescript
// Function contract
function calculateDailyStats(
  transactions: Transaction[],  // Branded type (Pillar A)
  date: Date                     // Local timezone
): DailyStats {
  // Returns: { income: number, expense: number, net: number }
  // Pre: transactions array (may be empty), date is valid Date object
  // Post: All amounts in cents (integer), net = income - expense
  // Side effects: None (pure function)
}
```

### Unit Test Specifications

```typescript
// Unit tests (executable specification)
describe('calculateDailyStats', () => {
  it('should calculate stats for mixed transactions', () => {
    const txs = [
      { type: 'income', amount: 50000, date: '2026-01-12' },
      { type: 'expense', amount: 30000, date: '2026-01-12' }
    ];
    expect(calculateDailyStats(txs, new Date('2026-01-12')))
      .toEqual({ income: 50000, expense: 30000, net: 20000 });
  });

  it('should return zeros for empty transactions', () => {
    expect(calculateDailyStats([], new Date('2026-01-12')))
      .toEqual({ income: 0, expense: 0, net: 0 });
  });

  it('should filter by date correctly', () => {
    const txs = [
      { type: 'income', amount: 10000, date: '2026-01-11' },
      { type: 'income', amount: 20000, date: '2026-01-12' }
    ];
    expect(calculateDailyStats(txs, new Date('2026-01-12')))
      .toEqual({ income: 20000, expense: 0, net: 20000 });
  });

  it('should throw on invalid date', () => {
    expect(() => calculateDailyStats([], new Date('invalid')))
      .toThrow('Invalid date parameter');
  });
});
```

---

## Output Format Template

```markdown
## Key Functions

### calculateDailyStats
- **Signature**: `(transactions: Transaction[], date: Date) => DailyStats`
- **Pre**: transactions may be empty, date must be valid
- **Post**: All amounts are integers (cents), net = income - expense
- **Side effects**: None (pure function)
- **Tests**: 4 test cases (mixed, empty, filter, error)

### loadTransactionsFromDB
- **Signature**: `(userId: UserId, date: Date) => Promise<Transaction[]>`
- **Pre**: userId is valid branded type, date is valid
- **Post**: Returns array (may be empty), all transactions validated with Zod
- **Side effects**: SQLite query
- **Tests**: 3 test cases (found, empty, error)
```

---

## Why This Matters

**Tests define behavior**: All tests passing = feature complete
**Prevents scope creep**: Contract is clear upfront
**TDD approach**: Write tests before implementation
**Acceptance criteria**: Tests serve as executable specifications
