# Project Structure Specification

> Complete directory structure for Tauri + React + AWS CDK projects

## Project Root

```
ROOT/
├── src-tauri/              # Tauri backend (Rust)
│   ├── src/
│   │   ├── main.rs         # Entry point
│   │   └── commands/       # IPC command handlers
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/                    # React frontend
│   ├── 00_kernel/          # Context, Telemetry, base types
│   │   ├── context/        # React context providers
│   │   ├── telemetry/      # Logging, tracing
│   │   └── types/          # Shared branded types
│   │
│   ├── 01_domains/         # Pure business logic (no UI, no IO)
│   │   └── {domain}/       # e.g., order/, user/, inventory/
│   │       ├── types.ts    # Domain types
│   │       ├── rules.ts    # Business rules (pure functions)
│   │       └── index.ts    # Public exports
│   │
│   ├── 02_modules/         # Feature modules
│   │   └── {module}/       # e.g., cart/, checkout/, profile/
│   │       ├── adapters/   # IO: API, IPC, storage
│   │       ├── headless/   # Logic hooks (no JSX)
│   │       ├── workflows/  # Sagas (T3 only)
│   │       ├── views/      # React components (JSX)
│   │       └── index.ts    # Public interface
│   │
│   ├── 03_migrations/      # Data upcasters (schema evolution)
│   │
│   ├── App.tsx             # Root component
│   └── main.tsx            # Entry point
│
├── infra/                  # AWS CDK
│   ├── bin/
│   │   └── app.ts          # CDK app entry
│   ├── lib/
│   │   ├── stacks/         # Stack definitions
│   │   ├── constructs/     # Reusable constructs
│   │   └── config/         # Environment configs
│   └── cdk.json
│
├── docs/                   # Source of Truth documentation
│   ├── REQUIREMENTS.md     # What to build (features, user stories)
│   ├── ARCHITECTURE.md     # How to organize (modules, flow)
│   ├── SCHEMA.md           # Data model (local + cloud)
│   ├── DESIGN.md           # UI/UX design (screens, interactions)
│   └── INTERFACES.md       # Interface definitions (IPC + Cloud API)
│
├── tests/                  # Test files
│   ├── unit/               # Unit tests (domains, headless)
│   ├── integration/        # Integration tests (adapters, workflows)
│   └── e2e/                # End-to-end tests
│
├── .claude/                # Claude Code config
│   ├── MEMORY.md           # Long-term decisions
│   ├── TODO.md             # Current tasks
│   ├── WORKFLOW.md         # Development workflow
│   ├── commands/           # Custom commands
│   └── rules/              # Path-specific rules
│
├── .prot/                  # AI_DEV_PROT v15 assets
│   └── (see below)
│
├── CLAUDE.md               # Project entry point
├── package.json
└── tsconfig.json
```

## docs/ by Product Type

| Product Type | Required | Optional |
|--------------|----------|----------|
| **Web Frontend** | REQUIREMENTS, ARCHITECTURE, SCHEMA, DESIGN | - |
| **Backend API** | REQUIREMENTS, ARCHITECTURE, SCHEMA, INTERFACES | - |
| **Full-stack** | REQUIREMENTS, ARCHITECTURE, SCHEMA, DESIGN, INTERFACES | - |
| **CLI Tool** | REQUIREMENTS, ARCHITECTURE | SCHEMA |
| **Desktop App (Tauri)** | REQUIREMENTS, ARCHITECTURE, SCHEMA, DESIGN, INTERFACES | - |
| **Enterprise** | All | - |

## Module Structure by Tier

```
T1 (Direct):        adapters/ + views/
T2 (Logic):         adapters/ + headless/ + views/
T3 (Saga):          adapters/ + headless/ + workflows/ + views/
```

---

## .prot/ Directory

```
.prot/
├── CHEATSHEET.md              # [Quick Ref] One-page index
├── STRUCTURE.md               # [Meta] This file
│
├── checklists/                # [Validation] Phase-based checklists
│   ├── pre-code.md            # Before coding
│   ├── in-code.md             # During coding
│   └── post-code.md           # After coding
│
└── pillar-{a~r}/              # 18 Pillars (A-R)
    ├── {name}.md              # Core documentation
    ├── {name}.ts              # Code template
    ├── checklist.md           # Detailed checklist
    └── audit.ts               # Auto audit (optional)
```

## Pillar Overview

| Quadrant | Pillars | Theme |
|----------|---------|-------|
| Q1 | A, B, C, D | Data Integrity |
| Q2 | E, F, Q | Flow & Concurrency |
| Q3 | G, H, I, J, K, L | Structure & Boundaries |
| Q4 | M, N, O, P, R | Resilience & Observability |

### AI-First Design

Each Pillar is a self-contained knowledge unit:
- **Single reference**: `@pillar-x/` gets all related assets
- **Locality**: Docs, templates, checklists in same directory
- **Self-contained**: No cross-directory lookups needed

## Pillar Document Template

Each pillar follows this atomic structure:

```markdown
# Pillar X: [Name]

> One-line summary

## Rule
[The law - what MUST/MUST NOT be done]

## Purpose
[Why this rule exists]

## Implementation
[How to implement in this tech stack]

### Good Example
```typescript
// Correct implementation
```

### Bad Example
```typescript
// Anti-pattern
```

## Anti-Patterns
- [Common mistakes to avoid]

## Exceptions
- [When this rule can be relaxed]

## Checklist
- [ ] [Verification item 1]
- [ ] [Verification item 2]

## References
- [Related pillars]
- [External docs]
```

## Checklist Hierarchy

```
checklists/pre-code.md     ──┐
checklists/in-code.md      ──┼── Quick phase checks
checklists/post-code.md    ──┘
         │
         │ → Details:
         ▼
pillar-*/checklist.md      ──── Deep pillar-specific checks
```

## Integration Points

### CLAUDE.md
```markdown
## Protocol
@.prot/CHEATSHEET.md
```

### .claude/rules/
```markdown
# When writing code
@.prot/checklists/pre-code.md
```

### .claude/TODO.md
```markdown
## Current Task
- [ ] Implement feature X
  - Tier: T2 (ref: .prot/CHEATSHEET.md)
  - Pillars: A, L, D (ref: .prot/pillar-a/, pillar-l/, pillar-d/)
```
