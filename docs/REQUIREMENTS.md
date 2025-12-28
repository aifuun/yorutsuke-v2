# REQUIREMENTS.md

> Product requirements - What to build

## Overview

**Product**: Yorutsuke (夜付け) - AI Accounting Assistant
**Version**: 0.1.0
**Last Updated**: 2025-12-28

## Problem Statement

中古パソコン業者（メルカリ・ヤフオク販売者）は日々の仕入れ・販売を記録する必要があるが、
手作業での記帳は面倒で続かない。レシートを撮影するだけで自動的に記帳してほしい。

**Target Users**: Budget-conscious second-hand computer users who:
- Sell on Mercari/Yahoo Auctions
- Need simple expense tracking
- Use older/low-spec computers
- Value offline-first experience

## User Stories

### US-001: Receipt Capture
**As a** seller
**I want** to drag and drop receipt images
**So that** I can quickly record expenses without manual entry

**Acceptance Criteria**:
- [ ] Drag & drop images into app window
- [ ] Images compressed to WebP (< 100KB)
- [ ] Visual feedback on drop
- [ ] Queue shows pending uploads

---

### US-002: Nightly AI Processing
**As a** seller
**I want** receipts processed overnight by AI
**So that** I don't wait for processing during work hours

**Acceptance Criteria**:
- [ ] Batch processing at 02:00 JST
- [ ] AI extracts: amount, merchant, category, date
- [ ] Results available in morning report

---

### US-003: Morning Report
**As a** seller
**I want** a daily summary of my transactions
**So that** I can track my business performance

**Acceptance Criteria**:
- [ ] Shows yesterday's income/expense
- [ ] Net profit calculation
- [ ] Category breakdown
- [ ] Unconfirmed transactions highlighted

---

### US-004: Transaction Confirmation
**As a** seller
**I want** to confirm/edit AI-extracted transactions
**So that** I can ensure accuracy

**Acceptance Criteria**:
- [ ] View all transactions
- [ ] Edit amount, category, description
- [ ] Confirm/reject transactions
- [ ] Delete incorrect entries

---

### US-005: Offline Usage
**As a** seller
**I want** to use the app without internet
**So that** I can record receipts anywhere

**Acceptance Criteria**:
- [ ] All data stored locally (SQLite)
- [ ] Works without network connection
- [ ] Syncs when online

## Functional Requirements

### FR-001: Image Compression
**Priority**: Must
**Description**: Compress images to WebP format before upload to minimize bandwidth and storage costs.

### FR-002: Quota Management
**Priority**: Must
**Description**: Limit uploads to 50 images/day per user to control cloud costs.

### FR-003: Cost Control
**Priority**: Must
**Description**: Hard stop at ¥1,000/day total AWS spend. Emergency stop switch in admin panel.

### FR-004: Multi-language Support
**Priority**: Should
**Description**: Support Japanese, Chinese, and English interfaces.

### FR-005: Authentication
**Priority**: Must
**Description**: User registration and login via AWS Cognito.

## Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-001 | Performance | App size < 5MB (for old computers) |
| NFR-002 | Performance | Image compression < 2 seconds |
| NFR-003 | Security | All data encrypted at rest (S3, DynamoDB) |
| NFR-004 | Usability | Works offline (Local-First) |
| NFR-005 | Cost | AI processing cost < ¥0.02/image |
| NFR-006 | Reliability | 99.9% batch processing success rate |

## Constraints

- **Technical**: Must use Tauri 2 for small app size
- **Technical**: AWS ap-northeast-1 region (Tokyo) for low latency
- **Business**: ¥1,000/day hard cost limit
- **Business**: Free tier must be sustainable

## Out of Scope

- Payment/subscription system (Phase 2)
- Mobile app (Phase 2)
- Real-time OCR (batch only)
- Multi-device sync (single device per user for now)
- Advanced analytics/ML predictions

## References

- Original yorutsuke PRD: `../yorutsuke/docs/final-prd.html`
- Schema design: `./SCHEMA.md`
- Architecture: `./ARCHITECTURE.md`
