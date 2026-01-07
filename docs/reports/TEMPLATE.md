# Weekly Report Template

> Copy this template for new weekly reports. Name: `YYYY-WNN.md` (e.g., `2026-W01.md`)

---

# Weekly Development Report

**Project**: Yorutsuke v2
**Period**: YYYY-MM-DD ~ YYYY-MM-DD (Week N)
**Status**: On Track / At Risk / Blocked

---

## Product Overview

**Yorutsuke (夜付け)** - AI Accounting Assistant for Second-hand Business

A local-first desktop application that automates bookkeeping for Mercari/Yahoo Auctions sellers. Users drag receipt images into the app, AI processes them overnight, and morning reports show transaction summaries.

**Core Flow**:
```
Receipt Drop → Local Compress → S3 Upload → Nightly AI (02:00) → Morning Report
```

**Target Users**: Budget-conscious second-hand computer sellers
**Tech Stack**: Tauri 2 + React 19 + TypeScript + AWS (S3, Lambda, Bedrock Nova Lite)

---

## Project Progress

### Milestone Overview

| Milestone | Description | Status |
|-----------|-------------|--------|
| MVP0 | Architecture Foundation | ✅ Complete |
| MVP1 | Local Processing (compress, queue, dedup) | 🔄 In Progress |
| MVP2 | Cloud Upload (S3, quota) | ⏳ Planned |
| MVP3 | Batch Processing (AI OCR, reports) | ⏳ Planned |
| MVP3.5 | Sync (confirmation writeback) | ⏳ Planned |
| MVP4 | Authentication (Cognito, tiers) | ⏳ Planned |

### Current Phase

**MVP[N]**: [Phase Name]
- Progress: X%
- Key deliverables this phase: ...

---

## This Week's Achievements

### 1. [Category]

- Achievement 1
- Achievement 2

### 2. [Category]

- Achievement 1
- Achievement 2

---

## Metrics

| Metric | Value |
|--------|-------|
| Commits | N |
| Files Changed | N |
| Lines Added | ~N |
| Lines Removed | ~N |

---

## Next Week Plan

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

---

## Risks & Blockers

| Risk | Impact | Mitigation |
|------|--------|------------|
| None | - | - |

---

*Report generated: YYYY-MM-DD*
