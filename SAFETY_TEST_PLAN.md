# Safety Test Plan for Auto Sync Service

## Quick Test Scenarios

### Scenario 1: Timer Overflow Protection
**Objective**: Verify that concurrent execution is prevented

```bash
# Steps:
1. Set a breakpoint in executePush() or executePull()
2. Let it hang for 10+ seconds
3. Observe: Timer still fires at T=3, T=6, etc., but executeSyncCycle() returns early
4. Expected logs:
   - "auto_sync_cycle_execute" (T=0s)
   - "auto_sync_cycle_skipped" reason:'sync_already_in_progress' (T=3s)
   - "auto_sync_cycle_skipped" reason:'sync_already_in_progress' (T=6s)
   - "auto_sync_cycle_execute" (after breakpoint released)

# Verification:
✅ No concurrent push/pull
✅ finally block releases lock
✅ Timer continues without deadlock
```

---

### Scenario 2: Push Failure Retry
**Objective**: Verify failed pushes are retried, not skipped

```bash
# Setup:
1. Create a transaction locally
2. Inject a network error in transactionPushService (mock failure)
3. Wait 3 seconds for auto-sync

# Steps:
1. Observe logs at T=0s (first push attempt)
   - "auto_sync_push_cycle_complete" with failed:1
   - nextOperation stays as 'push' (not alternated to 'pull')
2. At T=3s, same transaction retried
3. Remove the mock error
4. At T=3s, push succeeds
   - "auto_sync_push_cycle_complete" with synced:1, failed:0
   - nextOperation switches to 'pull'

# Expected sequence:
  T=0s: PUSH (fails) → nextOp remains 'push'
  T=3s: PUSH (retries, succeeds) → nextOp becomes 'pull'
  T=6s: PULL
  T=9s: PUSH
```

---

### Scenario 3: Network Offline → Online Transition
**Objective**: Verify state recovery on network reconnect

```bash
# Setup:
1. Ensure sync is running normally

# Steps:
1. Disconnect network (unplug ethernet / turn off WiFi)
   - Timer should pause (networkMonitor.getStatus() = false)
2. Take a local action (add transaction)
3. Reconnect network

# Expected logs:
  - "auto_sync_network_reconnect" action:'restart_timer'
  - "auto_sync_timer_started" with nextOperation:'pull'
  - Next cycle: PULL (fetches latest cloud state)

# Verification:
✅ nextOperation reset to 'pull' (not mid-state)
✅ Cloud data fetched on reconnect
✅ Local changes preserved
```

---

### Scenario 4: User Logout → Login as Different User
**Objective**: Verify no cross-user data corruption

```bash
# Setup:
1. Login as User A
2. Create a transaction (dirty_sync = 1)
3. Trigger push (setInterval fires)

# Steps:
1. While push is in-flight (hang at breakpoint), logout
2. Login as User B
3. Release breakpoint

# Expected behavior:
  - activeSyncUserId mismatch detected
  - Timer restarted
  - activeSyncUserId cleared
  - nextOperation reset to 'pull'
  - User A's dirty transaction NOT pushed to User B

# Expected logs:
  - "auto_sync_user_mismatch" expected:UserA, current:UserB
  - "auto_sync_timer_started" for User B
  - No "SYNC_COMPLETED" for User A after logout
```

---

### Scenario 5: Alternating Schedule Verification
**Objective**: Verify 3-second interval with correct alternation

```bash
# Setup:
1. Ensure clean state (no dirty transactions)
2. Watch logs for 30 seconds

# Expected log sequence:
  T≈0s:  auto_sync_push_cycle_complete (no dirty → skip)
  T≈3s:  auto_sync_pull_cycle_complete
  T≈6s:  auto_sync_push_cycle_complete (no dirty → skip)
  T≈9s:  auto_sync_pull_cycle_complete
  T≈12s: auto_sync_push_cycle_complete (no dirty → skip)
  T≈15s: auto_sync_pull_cycle_complete

# Verification:
✅ Interval = 3 seconds (±100ms)
✅ Push → Pull → Push → Pull pattern
✅ nextOperation alternates correctly
```

---

### Scenario 6: No Concurrent Sync
**Objective**: Verify syncInProgress flag works

```bash
# Setup:
1. Inject delay in executePush() or executePull()
2. Watch concurrent execution

# Implementation:
```typescript
// In executePush() or executePull(), add:
await new Promise(resolve => setTimeout(resolve, 5000));
```

# Expected:
  T=0s:  PUSH starts → syncInProgress = true
  T=3s:  Timer fires, but executeSyncCycle() returns early
  T=6s:  Timer fires, but executeSyncCycle() returns early
  T=5s:  PUSH finishes → syncInProgress = false
  T=6s:  Next cycle starts (finally executed)

# Verification:
✅ No "auto_sync_push_cycle_complete" + "auto_sync_pull_cycle_complete" at same time
✅ Logs show "auto_sync_cycle_skipped" when locked
```

---

## Automated Test Suite

### Unit Tests for Timer Lock

```typescript
describe('AutoSyncService - Timer Lock', () => {
  it('should skip cycle if sync in progress', async () => {
    const service = new AutoSyncService();
    service.setUser('user123');
    
    // Manually set flag
    (service as any).syncInProgress = true;
    (service as any).userId = 'user123';
    
    // Call should return early
    const spy = jest.spyOn(logger, 'debug');
    await (service as any).executeSyncCycle();
    
    expect(spy).toHaveBeenCalledWith(
      'auto_sync_cycle_skipped',
      expect.objectContaining({
        reason: 'sync_already_in_progress'
      })
    );
  });

  it('should release lock in finally block', async () => {
    const service = new AutoSyncService();
    service.setUser('user123');
    
    // Force an error in the sync
    jest.spyOn(service as any, 'executePush')
      .mockRejectedValueOnce(new Error('test error'));
    
    // Execute should fail but lock released
    await (service as any).executeSyncCycle().catch(() => {});
    
    expect((service as any).syncInProgress).toBe(false);
  });
});
```

### Unit Tests for User Switching

```typescript
describe('AutoSyncService - User Switching', () => {
  it('should detect user mismatch and restart timer', async () => {
    const service = new AutoSyncService();
    service.setUser('user123');
    
    // Simulate: User A starts sync
    (service as any).activeSyncUserId = 'user123';
    
    // User B logs in
    service.setUser('user456');
    
    // Sync cycle detects mismatch
    await (service as any).executeSyncCycle();
    
    expect((service as any).activeSyncUserId).toBeNull();
    expect((service as any).nextOperation).toBe('pull');
  });

  it('should clear activeSyncUserId on logout', () => {
    const service = new AutoSyncService();
    
    service.setUser('user123');
    (service as any).activeSyncUserId = 'user123';
    
    service.setUser(null);
    
    expect((service as any).activeSyncUserId).toBeNull();
    expect((service as any).userId).toBeNull();
  });
});
```

### Integration Tests

```typescript
describe('AutoSyncService - Integration', () => {
  it('should handle full cycle: network offline → push fails → online → retry', async () => {
    // Test full state machine transitions
  });

  it('should maintain clean state across multiple user sessions', async () => {
    // Test: UserA → UserB → UserA
  });
});
```

---

## Manual Testing Checklist

Run these checks before release:

### Basic Functionality
- [ ] Auto-sync starts when user logs in
- [ ] Auto-sync stops when user logs out
- [ ] Timer fires every 3 seconds (check logs)
- [ ] Operations alternate: Push → Pull → Push → Pull

### Failure Scenarios
- [ ] Push failure with 1 transaction: Retries at next cycle
- [ ] Push failure with multiple transactions: All retried
- [ ] Pull failure: Graceful error logging, retries next cycle
- [ ] Network disconnect: Timer pauses, no errors
- [ ] Network reconnect: Restarts with Pull first

### Edge Cases
- [ ] User logs out during push: Next cycle detects and restarts
- [ ] User logs in as different user during pull: Detects mismatch, resets
- [ ] Rapid push cycles (high dirty count): All queued and synced
- [ ] Long sync operation (10+ seconds): Timer skips due to lock

### Data Integrity
- [ ] Confirmed transaction appears in cloud within 3-12 seconds
- [ ] Deleted transaction doesn't reappear after sync
- [ ] Conflicting edits resolved correctly
- [ ] No duplicate transactions across sessions

### Logging Quality
- [ ] All sync events logged with traceId
- [ ] Failed operations logged with error details
- [ ] State transitions visible in logs
- [ ] User mismatch clearly logged

---

## Performance Baselines

Set these as regression test targets:

| Metric | Target | Unit | Notes |
|--------|--------|------|-------|
| Timer interval | 3000 ± 100 | ms | Should not drift |
| Cycle startup time | < 10 | ms | Time to execute guard + log |
| Lock release time | < 1 | ms | finally block overhead |
| Memory per sync | < 5 | MB | No memory leaks |
| Max concurrent syncs | 1 | count | Enforced by flag |

---

## Regression Test

Run before each release:

```bash
# 1. Manual 30-second observation
# 2. Verify log sequence matches expected pattern
# 3. Check no "CRITICAL" logs
# 4. Verify user session transitions work
# 5. Network toggle test (offline → online)
# 6. Create transaction → verify cloud sync within 12s
# 7. Delete transaction → verify not reappear after sync
```

---

## Success Criteria

Mark as complete when:

- ✅ All 6 scenarios pass
- ✅ Timer never deadlocks
- ✅ No concurrent push + pull
- ✅ User switching doesn't corrupt data
- ✅ Push failures retry correctly
- ✅ All logs are clean (no errors except expected failures)
