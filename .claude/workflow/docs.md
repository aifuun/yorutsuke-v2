# Phase A: Documentation

> Load when updating docs/, README, or specification documents

## When to Use

- Updating project documentation
- Writing/revising specifications
- Creating architecture documents
- API documentation updates

## Workflow

1. **Identify scope**
   - Which docs need update?
   - Is it new or revision?

2. **Check source of truth**
   - `docs/REQUIREMENTS.md` - Product requirements (features, user stories)
   - `docs/ARCHITECTURE.md` - System design (modules, flow)
   - `docs/SCHEMA.md` - Data models (local + cloud)
   - `docs/DESIGN.md` - UI/UX design (screens, interactions)
   - `docs/INTERFACES.md` - Interface definitions (IPC + Cloud API)
   - `README.md` - Project overview

3. **Update documentation**
   - Keep consistent with code
   - Update version/date headers
   - Cross-reference related docs

4. **Verify**
   - Links work
   - Examples are current
   - No outdated information

## Commands

| Command | Description |
|---------|-------------|
| `*sync` | Save and push changes |
| `*diff` | Review changes |

## Best Practices

- Update docs alongside code changes
- Keep examples executable
- Date major revisions
- Link to related docs

## Document Creation Order

Create documents in dependency order:

```
REQUIREMENTS.md     # 1. What to build (input from stakeholders)
       │
       ▼
ARCHITECTURE.md     # 2. How to organize (system design)
       │
       ├────────────────┐
       ▼                ▼
SCHEMA.md          DESIGN.md      # 3. Data model & UI design (parallel)
       │                │
       └────────┬───────┘
                ▼
        INTERFACES.md              # 4. IPC + API contracts (depends on schema & UI)
```

**Update triggers**:
| When... | Update... |
|---------|-----------|
| Requirements change | REQUIREMENTS → cascade to others |
| New entity added | SCHEMA → INTERFACES |
| New screen added | DESIGN → INTERFACES |
| Architecture refactor | ARCHITECTURE → all downstream |

## Templates

When creating new documentation, copy from templates:

| Document | Template |
|----------|----------|
| REQUIREMENTS.md | `docs/templates/REQUIREMENTS.md` |
| ARCHITECTURE.md | `docs/templates/ARCHITECTURE.md` |
| SCHEMA.md | `docs/templates/SCHEMA.md` |
| DESIGN.md | `docs/templates/DESIGN.md` |
| INTERFACES.md | `docs/templates/INTERFACES.md` |

**Usage**:
```bash
cp docs/templates/REQUIREMENTS.md docs/REQUIREMENTS.md
```

Then fill in the placeholders and remove unused sections.

## Doc-Code Linkage

When documentation requires code changes (e.g., SCHEMA.md update):

1. **Create linked issues**:
   - Issue A: "Update SCHEMA.md" (docs)
   - Issue B: "Implement schema changes" (code)
   - Note dependency in issue body

2. **Execution order**:
   - Design-first: Update docs → Implement code
   - Or: Implement code → Update docs to match

3. **Verify consistency**: Docs match actual implementation

## Handoff to Planning (Phase B)

When documentation is ready, transition to planning:

**Checklist before Phase B**:
- [ ] REQUIREMENTS.md has user stories with acceptance criteria
- [ ] ARCHITECTURE.md defines module boundaries
- [ ] SCHEMA.md lists entities (for decomposition)
- [ ] DESIGN.md has screen inventory (for UI tasks)

**Handoff**:
```
Phase A: Documentation ──► Phase B: Planning
                           │
                           ├─ Extract features from REQUIREMENTS
                           ├─ Map to modules from ARCHITECTURE
                           └─ Create issues by entity/screen
```

See `workflow/planning.md` for next steps.
