# Documentation

> Yorutsuke v2 - Source of Truth

## Quick Navigation

### Product (What to Build)

| Document | Purpose | Audience |
|----------|---------|----------|
| [REQUIREMENTS](./product/REQUIREMENTS.md) | User stories, specs | PM, Dev |
| [ROADMAP](./product/ROADMAP.md) | Future plans | PM, Dev |
| [CHANGELOG](./product/CHANGELOG.md) | Version history | All |

### Architecture (How it Works)

| Document | Purpose | Audience |
|----------|---------|----------|
| [README](./architecture/ARCHITECTURE.md) | Document index & status | Dev |
| [ARCHITECTURE](./architecture/ARCHITECTURE.md) | System design | Dev |
| [SCHEMA](./architecture/SCHEMA.md) | Data model | Dev |
| [INTERFACES](./architecture/INTERFACES.md) | IPC & API | Dev |
| [PROGRAM_PATHS](./operations/PROGRAM_PATHS.md) | Code flow traces | Dev |

### Design (Look & Feel)

| Document | Purpose | Audience |
|----------|---------|----------|
| [design/](./design/) | UI/UX mockups | Dev, Design |

### Operations (Run & Maintain)

| Document | Purpose | Audience |
|----------|---------|----------|
| [DEPLOYMENT](./operations/OPERATIONS.md) | Build & deploy | Dev, Ops |
| [OPERATIONS](./operations/OPERATIONS.md) | Emergency & monitoring | Ops |
| [ADMIN_PANEL](./operations/ADMIN_PANEL.md) | Admin console | Ops |
| [QUOTA](./operations/QUOTA.md) | Quota system | Dev, Ops |
| [LOGGING](./operations/LOGGING.md) | Logging design | Dev |

### Testing (Quality)

| Document | Purpose | Audience |
|----------|---------|----------|
| [tests/](./tests/) | Test scenarios | Dev, QA |

### Planning

| Document | Purpose | Audience |
|----------|---------|----------|
| [MVP_PLAN](./dev/MVP_PLAN.md) | Incremental testing | Dev |

---

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

1. **product/REQUIREMENTS.md** - Understand the product
2. **architecture/ARCHITECTURE.md** - Understand the system
3. **architecture/SCHEMA.md** - Understand the data
4. **architecture/INTERFACES.md** - Understand the APIs

### For UI/UX Work

1. **design/** - HTML mockups & design docs
2. **product/REQUIREMENTS.md** - User stories

### For Operations

1. **operations/OPERATIONS.md** - How to deploy
2. **operations/OPERATIONS.md** - How to operate
3. **operations/QUOTA.md** - Cost controls

---

## Directory Structure

```
docs/
├── README.md              # This file (index)
├── product/               # What to build
│   ├── REQUIREMENTS.md
│   ├── ROADMAP.md
│   └── CHANGELOG.md
├── architecture/          # How it works
│   ├── ARCHITECTURE.md
│   ├── SCHEMA.md
│   ├── INTERFACES.md
│   └── PROGRAM_PATHS.md
├── design/                # Look & feel
│   └── *.md               # UI mockups
├── operations/            # Run & maintain
│   # DEPLOYMENT.md merged into OPERATIONS.md
│   ├── OPERATIONS.md
│   ├── ADMIN_PANEL.md
│   ├── QUOTA.md
│   └── LOGGING.md
├── tests/                 # Quality
│   ├── FRONTEND.md
│   └── BACKEND.md
├── dev/                 # Dev planning
│   └── MVP_PLAN.md
└── archive/               # Historical docs
```

## Conventions

- **Last Updated**: Each doc has a date header
- **References**: Cross-links at bottom of each doc
- **Status**: Use checkboxes for acceptance criteria
- **Code**: Use fenced code blocks with language tags

## Related Resources

- Project README: `../README.md`
- Protocol: `../.prot/CHEATSHEET.md`
- Claude Config: `../.claude/`
- Archive: `./archive/`
