---
name: tidy
category: workflow
requires: [MEMORY.md, TODO.md]
---

# Command: *tidy

## Purpose
Clean up memory and todo files by archiving old entries

## MEMORY.md

1. Read .claude/MEMORY.md, count entries in each section
2. Check if cleanup needed (any section >10 entries, or entries >3 months old)
3. Cleanup actions:
   - Move expired/redundant content to .claude/archive/YYYY-MM.md
   - Merge similar entries
   - Remove outdated content
   - Keep valuable core information
4. Report results: how many removed, how many kept

## TODO.md

1. Read .claude/TODO.md, count tasks by status
2. Check if cleanup needed:
   - Completed tasks >5 in "Recently Completed"
   - Stale tasks (no progress >2 weeks)
3. Cleanup actions:
   - Archive completed tasks older than 1 week to .claude/archive/YYYY-MM.md
   - Flag stale tasks for review
   - Remove duplicates
4. Report results: archived, flagged, kept

## ADR Promotion

1. Review Architecture Decisions in MEMORY.md (current + archive)
2. Identify ADR candidates:
   - Affects overall architecture
   - Has clear trade-offs
   - Needs long-term adherence
   - Other developers need to know
3. Compare with existing ADRs in docs/architecture/ADR/
4. Suggest new ADRs (list candidates, ask for approval)
5. If approved, create ADR files and update ADR/README.md

## CLAUDE.md Review

1. Check file size and structure
2. Suggest simplifications:
   - Move lengthy sections to separate files
   - Remove outdated references
   - Consolidate duplicate information
   - Keep core instructions concise (<200 lines ideal)
3. Verify @references are valid

## Large Docs Check

1. Find files >40KB in docs/ directory: `find docs -type f -size +40k`
2. For each large file:
   - Report file path and size
   - Suggest splitting into smaller documents
   - Check if content is duplicated elsewhere
3. Target: Each doc file <40KB for AI readability

## Related
- Commands: *resume, *update
- Files: @.claude/MEMORY.md, @.claude/TODO.md
- Patterns: Memory protection rules
