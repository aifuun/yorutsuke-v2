# ADR-021: TypeScript Migrations as Schema Truth

**Status**: Accepted
**Date**: 2026-01-23
**Issue**: #180
**Related**: #184

## Context

Tauri SQL plugin v2 requires Rust-side migrations to properly initialize file-based SQLite databases. Without Rust migrations, the database file is created but remains at 0 bytes with no schema written to disk.

This creates a tension between two approaches:

1. **Option A**: Move all schema definitions to Rust migrations
   - ✅ Single source of truth in one language
   - ❌ Violates AI_DEV_PROT v15 Schema-First principle
   - ❌ Requires Rust changes for every schema update

2. **Option B**: Keep TypeScript migrations, add minimal Rust bootstrap
   - ✅ Maintains Schema-First architecture
   - ✅ Business logic stays in TypeScript
   - ❌ Dual-layer migration system

## Decision

**We choose Option B**: Keep TypeScript migrations as the source of truth for business schema, with minimal Rust-side bootstrap migration.

### Rust Layer Responsibility
```rust
// Minimal bootstrap: Only create physical database file
let migrations = vec![
    Migration {
        version: 0,
        description: "create_settings_table",
        sql: "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)",
        kind: MigrationKind::Up,
    },
];
```

**Role**: Physical file initialization only. This is a technical adapter for Tauri SQL plugin v2's requirement.

### TypeScript Layer Responsibility
```typescript
// Full schema management: All business tables and migrations
async function runMigrations(db: Database): Promise<void> {
  await createCoreTables(db);  // images, transactions, etc.

  if (version < 1) await migration_v1(db);  // Add indexes
  if (version < 2) await migration_v2(db);  // Add trace_id
  // ... all business schema evolution
}
```

**Role**: Business schema definition and evolution. This is the single source of truth referenced in `docs/architecture/SCHEMA.md`.

## Consequences

### Positive

1. **Architectural Clarity**
   - Rust handles infrastructure (file initialization)
   - TypeScript handles business logic (schema definition)
   - Clear separation of concerns

2. **Schema-First Alignment**
   - `SCHEMA.md` → TypeScript migrations → Database
   - Maintains AI_DEV_PROT v15 Pillar B (Airlock)
   - AI-assisted development can focus on one language

3. **Flexibility**
   - Schema changes don't require Rust compilation
   - Rapid iteration on business logic
   - Easier to test and mock

### Negative

1. **Dual-Layer Complexity**
   - Two migration systems to understand
   - Potential confusion for new developers
   - Must ensure Rust migration doesn't conflict with TypeScript

2. **Bootstrap Dependency**
   - TypeScript migrations depend on Rust bootstrap completing
   - If Rust migration fails, TypeScript layer silently uses in-memory DB
   - Requires careful error handling

### Mitigation Strategies

1. **Documentation**
   - This ADR clearly defines responsibilities
   - Comments in code explain the pattern
   - README.md includes section on migration architecture

2. **Validation**
   - TypeScript verifies table count after migrations
   - WAL checkpoint ensures data persists to disk
   - Startup logs clearly show both layers executing

3. **Future Optimization** (Issue #184)
   - Consider using `_initialization_marker` table instead of `settings`
   - Makes Rust layer's bootstrap role more explicit
   - Reduces overlap with TypeScript migrations

## Alternatives Considered

### Alternative 1: Pure Rust Migrations

**Rejected** because:
- Violates Schema-First principle (SCHEMA.md is TypeScript-oriented)
- Requires Rust expertise for schema changes
- Breaks AI_DEV_PROT v15 architecture
- Makes rapid iteration harder

### Alternative 2: Schema Code Generation

Generate Rust migrations from SCHEMA.md:
- **Rejected** because: Adds complexity, tooling overhead, and doesn't solve the fundamental architectural question

### Alternative 3: In-Memory Database Only

Use SQLite in-memory mode to avoid file initialization issue:
- **Rejected** because: Loses persistence, not suitable for production app

## Implementation Notes

### Current State (Post #180)
```
Rust:       Creates settings table (version 0)
            ↓
TypeScript: Creates all business tables (version 1-12)
            Runs all migrations
            Verifies table count
```

### Future State (Issue #184)
```
Rust:       Creates _initialization_marker table (version 1)
            ↓
TypeScript: Creates settings + all business tables (version 1-12)
            Runs all migrations
            Verifies table count
```

## References

- **Issue #180**: Database file 0 bytes bug
- **Issue #184**: Path unification and bootstrap optimization
- **AI_DEV_PROT v15**: Pillar B (Airlock - Schema-First)
- **Tauri SQL Plugin**: [v2 Documentation](https://v2.tauri.app/plugin/sql/)
- **SCHEMA.md**: `docs/architecture/SCHEMA.md`

## Review History

- **2026-01-23**: Initial decision (Issue #180 fix)
- **Future**: Revisit after Issue #184 (bootstrap optimization)

---

**Decision Maker**: Development Team
**Stakeholders**: Frontend, Backend, DevOps
**Next Review**: After MVP4 completion
