# Memory

## Current Context

Update at session end, read at session start.

- **Last Progress**: [2025-12-29] v1.0.0 Production Ready - all phases complete
- **Next Steps**: Backlog items (Cloud Sync, Transaction Filters, Report History)
- **Blockers**: None

## Architecture Decisions

Record important decisions with context.

<!--
### [YYYY-MM-DD] Decision Title (ID)
- **Decision**: What was decided
- **Reason**: Why this approach was chosen
- **Alternatives**: What was considered but rejected
-->

## Solved Issues

Problems encountered and their solutions.

### [2025-12-29] Image Drop Delay Issue
- **Problem**: In original project, dropped images took several seconds to appear in queue list
- **Root Cause**: `useImageQueue`'s async `loadHistory()` called `setItems(historyItems)` which overwrote newly added images
- **Solution**: When implementing View layer, use one of:
  1. Separate `historyItems` and `pendingItems` state, merge for display
  2. Use `useReducer` to ensure LOAD_HISTORY and ADD_PENDING are atomic
- **Prevention**: Avoid async initialization overwriting real-time state; history loading should append, not replace

### [2025-12-29] #5 Image Compression Strategy
- **Decision**: Grayscale + WebP 75% + max 1024px
- **Why Grayscale**: Reduces file size ~60% while maintaining OCR quality (receipts are mostly text)
- **MD5 Timing**: Calculate hash AFTER compression (on WebP bytes), not on original file
  - Same original image compressed twice = same hash (deterministic)
  - Deduplication works even if user re-drops the same image
- **Output Path**: Use temp dir (`std::env::temp_dir().join("yorutsuke-v2")`) for compressed files

### [2025-12-29] #6 Upload Queue FSM Design
- **State Machine**: `idle | processing | paused` (not boolean flags)
- **Error Classification**: Critical for retry logic
  - `network/server` → auto-retry with exponential backoff (1s, 2s, 4s)
  - `quota/unknown` → no retry, pause queue
- **Double Processing Prevention**: Use `processingRef: Set<string>` to track in-flight tasks
  - Problem: useEffect can trigger multiple times before state updates
  - Solution: Track processing tasks in a ref, not in state
- **Retry Cleanup**: Only remove from processingRef AFTER backoff delay, not immediately

### [2025-12-29] #7 Auth Flow Learnings
- **Three-Step Flow**: register → verify (email code) → login
  - After register: stay logged out (wait for verification)
  - After verify: stay logged out (user must login explicitly)
  - This avoids auto-login with unverified accounts
- **Device Binding**: Generate deviceId once, store in SQLite, send with every login
  - Enables: "Logged in from new device" notifications
  - Enables: Device-specific session revocation
- **Token Refresh Failure**: Auto-logout user (don't leave in broken authenticated state)
- **Initial State**: Start with `status: 'loading'` to check stored tokens on mount

## References

Key resources and links.

<!-- Format: Topic - Link/Path -->

## Best Practices

Lessons learned from this project.

<!-- Format: Scenario → Approach → Result -->
