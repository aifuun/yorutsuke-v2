# Documentation

> Yorutsuke v2 - Source of Truth

## Quick Navigation

| Document | Purpose | Audience |
|----------|---------|----------|
| [REQUIREMENTS](./REQUIREMENTS.md) | What to build | PM, Dev |
| [ARCHITECTURE](./ARCHITECTURE.md) | How to organize | Dev |
| [SCHEMA](./SCHEMA.md) | Data model | Dev |
| [UI Design](./ui_design/) | UI/UX mockups | Dev, Design |
| [INTERFACES](./INTERFACES.md) | IPC & API | Dev |
| [QUOTA](./QUOTA.md) | Quota system | Dev, Ops |
| [DEPLOYMENT](./DEPLOYMENT.md) | Build & deploy | Dev, Ops |
| [OPERATIONS](./OPERATIONS.md) | Emergency & monitoring | Ops |
| [ADMIN_PANEL](./ADMIN_PANEL.md) | Admin console guide | Ops |
| [CHANGELOG](./CHANGELOG.md) | Version history | All |
| [ROADMAP](./ROADMAP.md) | Future plans | PM, Dev |
| [tests/](./tests/) | Test scenarios | Dev, QA |
| [PROGRAM_PATHS](./PROGRAM_PATHS.md) | Code flow traces | Dev |

## Development Modes

Yorutsuke supports two development modes:

### Mock Mode (UI Development)

Run the app with simulated data, no AWS backend required.

```bash
cd app

# Option 1: Use mock config
cp .env.mock .env.local
npm run tauri dev

# Option 2: Empty .env.local (auto-enables mock)
echo "" > .env.local
npm run tauri dev
```

**Indicators:**
- Orange banner at top: "MOCK MODE - Data is simulated"
- Console logs prefixed with `[Mock]`

**What's mocked:**
| Feature | Mock Behavior |
|---------|---------------|
| Quota | Returns random usage (0-10/30) |
| Upload | Simulates presign + S3 upload success |
| Report | Returns 8 random transactions |

### Real Mode (Full Stack)

Connect to AWS backend for real data.

```bash
cd app

# Sync environment from AWS CDK outputs
npm run env:sync

# Or manually configure .env.local with Lambda URLs
npm run tauri dev
```

**Requirements:**
- AWS credentials configured (`AWS_PROFILE=dev`)
- CDK stack deployed (`cd infra && npm run deploy`)

---

## Reading Order

### For New Developers

1. **REQUIREMENTS.md** - Understand the product
2. **ARCHITECTURE.md** - Understand the system
3. **SCHEMA.md** - Understand the data
4. **INTERFACES.md** - Understand the APIs

### For UI/UX Work

1. **ui_design/** - HTML mockups & design docs
2. **REQUIREMENTS.md** - User stories

### For Operations

1. **DEPLOYMENT.md** - How to deploy
2. **OPERATIONS.md** - How to operate
3. **QUOTA.md** - Cost controls

## Document Categories

```
Product (What)
├── REQUIREMENTS.md    User stories, acceptance criteria
└── ROADMAP.md         Future plans, backlog

Architecture (How)
├── ARCHITECTURE.md    System design, data flows
├── SCHEMA.md          Database tables, types
└── INTERFACES.md      IPC commands, REST APIs

Design (Look & Feel)
└── ui_design/         HTML mockups, design specs

Operations (Run & Maintain)
├── DEPLOYMENT.md      Build, deploy, rollback
├── OPERATIONS.md      Monitoring, emergency response
├── ADMIN_PANEL.md     Admin console, controls
└── QUOTA.md           Quota tiers, cost control

Testing (Quality)
├── tests/             Test scenarios (frontend & backend)
└── PROGRAM_PATHS.md   Detailed code flow traces

History
└── CHANGELOG.md       Version history
```

## Conventions

- **Last Updated**: Each doc has a date header
- **References**: Cross-links at bottom of each doc
- **Status**: Use checkboxes for acceptance criteria
- **Code**: Use fenced code blocks with language tags

## Related Resources

- Project README: `../README.md` (if exists)
- Protocol: `../.prot/CHEATSHEET.md`
- Claude Config: `../.claude/CLAUDE.md`
- Archive: `./archive/` (historical docs)
