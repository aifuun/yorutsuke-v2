# Time Handling Rules

> Storage and computation use UTC. Display and selection use local timezone.

## Core Principle

```
Storage      →  UTC (ISO 8601)
Computation  →  UTC (database queries, calculations)
Display      →  Local timezone (showing to user)
Selection    →  Local timezone (user input, then convert to UTC)
```

## Implementation

### JavaScript/TypeScript

```typescript
// ✅ Storage: Always UTC
const timestamp = new Date().toISOString();  // "2026-01-07T15:30:00.000Z"

// ✅ Display time: Convert to local
const displayTime = new Date(utcString).toLocaleString();

// ✅ Display "today" date: Use local date
const today = new Date().toLocaleDateString('sv-SE');  // "2026-01-07" in local TZ
// Or: format with Intl.DateTimeFormat for locale-specific format

// ❌ WRONG: UTC date for "today" display
const today = new Date().toISOString().split('T')[0];  // Wrong near midnight!
```

### User Input (Date Pickers)

```typescript
// User selects date in local timezone
const selectedDate = "2026-01-07";  // From date picker (local)

// Convert to UTC for storage/query
const startOfDay = new Date(`${selectedDate}T00:00:00`);  // Local midnight
const utcTimestamp = startOfDay.toISOString();  // Convert to UTC
```

### SQLite - Computation

```sql
-- ✅ Rolling 24-hour window (UTC computation, no TZ issues)
SELECT COUNT(*) FROM images
WHERE uploaded_at >= datetime('now', '-24 hours');

-- ✅ If you need date-based query, compute range in JS first
-- JS: const start = new Date('2026-01-07T00:00:00').toISOString();
-- JS: const end = new Date('2026-01-07T23:59:59.999').toISOString();
SELECT * FROM images WHERE uploaded_at BETWEEN ? AND ?;
```

## Checklist

Before writing time-related code:

- [ ] Storage: Using `toISOString()` (UTC)?
- [ ] Computation: Using UTC or relative time?
- [ ] Display date: Using local date (not UTC split)?
- [ ] User input: Treating as local, converting to UTC before storage?

## Common Mistakes

```typescript
// ❌ Using UTC date for "today" display
const today = new Date().toISOString().split('T')[0];

// ✅ Using local date for "today" display
const today = new Date().toLocaleDateString('sv-SE');  // YYYY-MM-DD format
```

## Rationale

1. **UTC for data**: Consistent, portable, no DST issues
2. **Local for UI**: Users think in local time
3. **Clear boundary**: Conversion happens at UI layer only
