# *next Command - Example Scenarios

Detailed dialogue examples for the `*next` intelligent task navigator.

## Scenario 1: Active Task with Pending Steps

**Context**: TODO.md has an active issue with uncompleted sub-tasks

```
AI: Detected active task:

#101 Presign URL Integration [In Progress]
- [x] Remove Mock branch
- [x] Implement real fetch
- [ ] Zod response validation
- [ ] Error handling (403/429/500)

Next step: Implement Zod response validation

Continue? (yes/no/switch)
```

**User**: yes

```
AI: Loading Pillar B (Airlock) template...

Starting Zod response validation:
1. Read @.prot/pillar-b/airlock.ts
2. Define PresignResponseSchema with Zod
3. Add .parse() validation in uploadApi.ts

Proceeding...
```

---

## Scenario 2: TODO Empty, Recommend Issue

**Context**: TODO.md has no active tasks, current MVP has open issues

```
AI: TODO.md currently has no active tasks.

Detected MVP2 (Cloud Upload) with uncompleted issues:

Recommend: #102 S3 Byte Stream Upload Verification [P1]
- Related tests: SC-310~313
- Estimated complexity: T2
- Files to modify: uploadApi.ts, uploadService.ts

Other options:
- #103 Quota API Cloud Sync [P1]
- #104 Network State Management [P2]

Start #102? (yes/103/104/show-all)
```

**User**: yes

```
AI: Loading Issue #102 details from GitHub...

Creating TODO.md entry:

## Current Session
### Active Issue: #102 - S3 Byte Stream Upload Verification

**Tier**: T2 (Logic)
**Pillars**: A, B, D, L

### Steps
- [ ] Implement basic PUT logic
- [ ] Add timeout protection
- [ ] Large file stress test

Starting first step...
```

---

## Scenario 3: Current MVP Complete, Recommend Next MVP

**Context**: All issues in current MVP are closed

```
AI: 🎉 MVP2 (Cloud Upload) all tasks complete!

Detected next MVP:

MVP3 - Batch Processing (Batch Processing)
Goal: Implement nightly AI batch processing and morning reports
Status: Not started
Estimated: 2-3 weeks

Core features:
- [ ] Nova Lite OCR integration
- [ ] Batch processing queue management
- [ ] Morning report generator
- [ ] Transaction data extraction

Suggested actions:
1. Run `*plan MVP3` to decompose into Issues
2. Or view `docs/dev/MVP3_BATCH.md` directly

Select action: (plan/view/defer)
```

**User**: plan

```
AI: Entering planning mode for MVP3...

Reading MVP3_BATCH.md for requirements...

Identified core features:
1. Nova Lite OCR Integration (T2)
2. Batch Queue Management (T2)
3. Morning Report Generator (T1)
4. Transaction Data Extraction (T2)

Would you like me to:
A) Create GitHub Issues now
B) Show detailed breakdown first
C) Use Two-Step Planning workflow

Select: (a/b/c)
```

---

## Scenario 4: Multiple Active Issues (Edge Case)

**Context**: User has multiple active issues in TODO.md (not recommended)

```
AI: Warning: Multiple active issues detected in TODO.md

#101 Presign URL Integration [In Progress]
- [x] Remove Mock branch
- [ ] Zod validation

#102 S3 Upload Verification [In Progress]
- [x] Basic PUT logic
- [ ] Timeout protection

Recommendation: Focus on one issue at a time for better efficiency.

Select primary issue: (101/102/list-all)
```

---

## Scenario 5: Issue Complete, Suggest Review

**Context**: All sub-tasks of active issue are complete

```
AI: Issue #101 Presign URL Integration - All steps complete!

- [x] Remove Mock branch
- [x] Implement real fetch
- [x] Zod response validation
- [x] Error handling (403/429/500)

Next actions:
1. Run `*review` - Execute post-code checklist
2. Run `*audit` - Automated Pillar checks (optional)
3. Close issue: `*issue close 101`

Recommendation: Run *review first to ensure quality.

Proceed with *review? (yes/no/defer)
```

---

## Scenario 6: No Open Issues, MVP Not Complete

**Context**: All issues closed but MVP acceptance criteria not met

```
AI: Current MVP2 (Cloud Upload) status check:

All GitHub Issues: Closed ✅

MVP Acceptance Criteria:
- [x] Upload 5 images to S3, all success
- [x] Auto-pause on disconnect, resume on reconnect
- [ ] Quota correctly displayed (used/limit)  ⚠️

Warning: Issue #103 (Quota API) is closed but acceptance criteria not met.

Suggested actions:
1. Verify quota display manually
2. Reopen #103 if issue persists
3. Create new issue if different problem

Check quota display now? (yes/no)
```

---

## Scenario 7: Switching Tasks Mid-Session

**Context**: User wants to switch from current issue to another

```
AI: Current active issue:

#101 Presign URL Integration [In Progress]
- [x] Remove Mock branch
- [ ] Zod validation (current step)

Switch to different task? (yes/no)
```

**User**: yes

```
AI: Pausing #101...

Available actions:
1. Pick different issue from current MVP
2. Start new issue from backlog
3. Resume later (keep #101 in TODO.md as paused)

Select: (1/2/3)
```

**User**: 1

```
AI: Showing all open issues for MVP2:

1. #102 S3 Upload Verification [P1]
2. #103 Quota API Sync [P1]
3. #104 Network State Management [P2]

Select: (102/103/104)
```

---

## Notes

- **Cascade logic**: Level 1 → Level 2 → Level 3 (waterfall)
- **Single focus**: Encourage one active issue at a time
- **Smart suggestions**: Always show next logical action
- **Context preservation**: Keep TODO.md as session tracker

**Reference**: See `.claude/commands/next.md` for workflow specification.
