# CHANGELOG.md

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- User authentication (Cognito integration)
- Nightly batch processing (Nova Lite OCR)
- Admin dashboard
- Multi-language support (ja, zh, en)

---

## [0.1.0] - 2025-12-28

### Added

#### Project Structure
- Initialized from `long-term-dev` tauri template
- AI_DEV_PROT v15 protocol assets (`.prot/`)
- Claude Code commands and rules (`.claude/`)

#### Frontend (app/)
- **Kernel layer**: Branded types (UserId, ImageId, TransactionId)
- **Kernel layer**: AppContext for auth state
- **Kernel layer**: JSON logger for observability

- **Domain layer**: Receipt entity with status FSM
- **Domain layer**: Transaction entity with category types
- **Domain layer**: Business rules (quota, compression, calculations)

- **Capture module** (T2): Image compression via Tauri IPC
- **Capture module** (T2): S3 upload with presigned URLs
- **Capture module** (T2): Queue management with FSM

- **Report module** (T1): Morning report fetch and display
- **Report module** (T1): Daily summary with category breakdown

- **Transaction module** (T2): SQLite CRUD operations
- **Transaction module** (T2): Confirmation flow
- **Transaction module** (T2): Transaction list view

#### Infrastructure (infra/)
- AWS CDK stack with:
  - S3 bucket for images (30-day lifecycle)
  - DynamoDB table for transactions
  - Cognito User Pool
  - Lambda for presigned URLs

#### Documentation (docs/)
- REQUIREMENTS.md: User stories and requirements
- ARCHITECTURE.md: System design and data flows
- SCHEMA.md: Database tables and types
- DESIGN.md: UI/UX specifications
- INTERFACES.md: IPC and API definitions
- OPERATIONS.md: Emergency response and monitoring
- DEPLOYMENT.md: Build and deploy guide
- CHANGELOG.md: Version history (this file)

### Technical Decisions
- **Tauri 2**: Chosen for small app size (< 5MB)
- **React 19**: Latest stable with Hooks
- **SQLite**: Local-first data storage
- **AI_DEV_PROT v15**: Structured development protocol

---

## Migration from yorutsuke v1

### Breaking Changes
- Complete project restructure
- New module organization (00_kernel → 03_migrations)
- Branded types required for all IDs

### Migration Path
1. Export data from v1 SQLite
2. Run migration script (TBD)
3. Import into v2 database

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 0.1.0 | 2025-12-28 | Initial v2 release with new architecture |

---

## Links

- [GitHub Repository](https://github.com/aifuun/yorutsuke-v2)
- [Original yorutsuke](https://github.com/aifuun/yorutsuke)
