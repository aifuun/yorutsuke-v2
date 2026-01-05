# CHANGELOG.md

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Cloud Sync (fetch AI-processed results from backend)
- Batch Confirm feature (pending user behavior validation)

---

## [2.1.0] - 2026-01-02

### Added
- **Control Strategy** improvements (P1/P2 complete)
  - `withTransaction()` wrapper for SQLite (#24)
  - FSM 'retrying' state for upload queue (#25)
  - `broadcast()` function renamed from `emitSync` (#26)
  - Quota checkpoint documentation (#27)

### Changed
- Updated DESIGN.md with sidebar navigation layout (#20)
- Updated ARCHITECTURE.md with resolved issues

### Fixed
- Removed `processingRef` dual tracking race condition (#25)

---

## [2.0.0] - 2025-12-29

### Added
- **Backend Lambda Functions** (Phase 4)
  - `batch-process`: Nova Lite OCR processing (#15)
  - `report`: Daily report API (#16)
  - `transactions`: CRUD API with pagination (#17)
  - `config`: App configuration API (#18)
  - `quota`: Quota check API (#19)

- **App Shell** with sidebar navigation
  - 240px fixed sidebar with 5 nav items
  - Dark mode default (Windows 11 style)
  - Brand section with tagline

- **i18n Refactor**
  - Replaced hardcoded Japanese with i18n keys
  - Added English translations

---

## [1.1.0] - 2025-12-29

### Added
- **Transaction Filters** (#13)
  - FilterBar component with date/type/category
  - Pure `filterTransactions()` function in domain layer

- **Report History** (#14)
  - CalendarView component for date navigation
  - Monthly summary aggregation
  - ReportHistoryView with calendar + summaries

---

## [1.0.0] - 2025-12-29

### Added
- **i18n Support** (#11)
  - i18next integration
  - Japanese (ja) and English (en) locales
  - Language switcher in Settings

- **Error Recovery** (#12)
  - Circuit breaker pattern (Pillar P)
  - ErrorBoundary with ErrorFallback component
  - Graceful degradation for network errors

- **Design Improvements**
  - Context Menu for transactions (right-click delete)
  - Offline Indicator component
  - Empty States (first-use, no-data-today, no-results)
  - ESLint rules for Pillar compliance

### Changed
- Production-ready polish across all modules

---

## [0.3.0] - 2025-12-29

### Added
- **Report Views** (#8)
  - ReportView with daily summary
  - Category breakdown visualization
  - Unconfirmed transactions list
  - Date navigation

- **Transaction Management** (#9)
  - TransactionView with list display
  - TransactionEditModal for editing
  - Confirm/reject functionality
  - SQLite CRUD operations

- **Settings Module** (#10)
  - SettingsView with preferences
  - Language/Theme/Auto-upload toggles
  - Account info display
  - Logout functionality

---

## [0.2.0] - 2025-12-29

### Added
- **Tauri Drag & Drop** (#4)
  - File drop zone component
  - Extension filtering (jpg, jpeg, png, webp)
  - Visual feedback during drag

- **Image Compression** (#5)
  - WebP compression via Rust IPC
  - MD5 hash for deduplication
  - Thumbnail generation

- **Upload Queue** (#6)
  - FSM-based queue management
  - Exponential backoff retry (1s, 2s, 4s)
  - Offline pause/resume
  - Error classification (network/quota/server)

- **Auth Module** (#7)
  - Cognito integration
  - Login/Register/Verify flows
  - Token storage in SQLite
  - Auto-refresh mechanism

---

## [0.1.0] - 2025-12-28

### Added

#### Project Structure
- Initialized from `long-term-dev` tauri template
- AI_DEV_PROT v15 protocol assets (`.prot/`)
- Claude Code commands and rules (`.claude/`)

#### Kernel Layer (00_kernel/)
- **EventBus** (#1): Type-safe cross-component communication
- **SQLite + Migrations** (#2): Database connection and schema versioning
- **Network Status** (#3): Online/offline detection with EventBus integration
- **Branded Types**: UserId, ImageId, TransactionId
- **AppContext**: Auth state management
- **JSON Logger**: Structured logging for observability

#### Domain Layer (01_domains/)
- Receipt entity with status FSM
- Transaction entity with category types
- Business rules (quota, compression, calculations)

#### Infrastructure (infra/)
- AWS CDK stack with:
  - S3 bucket for images (30-day lifecycle)
  - DynamoDB tables (transactions, quotas)
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
- ROADMAP.md: Development roadmap

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
- Sidebar navigation instead of bottom tabs

### Migration Path
1. Export data from v1 SQLite
2. Run migration script (TBD)
3. Import into v2 database

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 2.1.0 | 2026-01-02 | Control Strategy improvements, DESIGN.md update |
| 2.0.0 | 2025-12-29 | Backend Lambda APIs, App Shell sidebar |
| 1.1.0 | 2025-12-29 | Transaction Filters, Report History |
| 1.0.0 | 2025-12-29 | i18n, Error Recovery, Production Ready |
| 0.3.0 | 2025-12-29 | Report, Transaction, Settings modules |
| 0.2.0 | 2025-12-29 | Capture Pipeline (Drag & Drop, Compression, Upload, Auth) |
| 0.1.0 | 2025-12-28 | Initial v2 release with new architecture |

---

## Links

- [GitHub Repository](https://github.com/aifuun/yorutsuke-v2)
- [Original yorutsuke](https://github.com/aifuun/yorutsuke)
