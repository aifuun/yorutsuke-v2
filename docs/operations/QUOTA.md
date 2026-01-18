# Quota System (Permit v2)

> Client-side quota management with cryptographically signed permits

**Last Updated**: 2026-01-18 (Permit v2 migration complete)

Freemium model with tiered quotas using signed permits to balance user value and cost control.

## Architecture Overview

**Permit v2**: Client-side quota tracking with server-side signature verification.

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. App Startup: Fetch Permit                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  quotaService.setUser(userId)                                   │
│         │                                                        │
│         └──► POST /issue-permit                                 │
│                      │                                           │
│                      ▼                                           │
│              issue-permit Lambda                                │
│              - Determine tier (guest/free/basic/pro)            │
│              - Generate permit with totalLimit + dailyRate      │
│              - Sign with HMAC-SHA256                            │
│                      │                                           │
│                      ▼                                           │
│              UploadPermit {                                     │
│                userId, totalLimit, dailyRate,                   │
│                expiresAt, issuedAt, signature, tier             │
│              }                                                   │
│                      │                                           │
│                      └──► localStorage['yorutsuke:quota']       │
│                           LocalQuota.setPermit()                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 2. Upload: Local Validation + Cloud Verification                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User uploads image                                              │
│         │                                                        │
│         ├──► LocalQuota.checkCanUpload()                        │
│         │    - Check totalUsed < totalLimit ✓                   │
│         │    - Check usedToday < dailyRate ✓                    │
│         │    - Instant response (no network)                    │
│         │                                                        │
│         └──► POST /presign { userId, fileName, permit }         │
│                      │                                           │
│                      ▼                                           │
│              presign Lambda                                     │
│              - Verify HMAC-SHA256 signature                     │
│              - Check permit.expiresAt > now                     │
│              - If valid → generate S3 URL                       │
│              - If invalid → 403 INVALID_SIGNATURE               │
│                      │                                           │
│                      └──► S3 presigned URL                      │
│                                                                  │
│  After successful upload:                                        │
│         │                                                        │
│         └──► LocalQuota.incrementUsage()                        │
│              - totalUsed += 1                                   │
│              - dailyUsage[today] += 1                           │
│              - Auto-cleanup (7-day retention)                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## User Tiers

| Tier | Identity | Total Limit | Daily Rate | Permit Validity | Price |
|------|----------|-------------|------------|-----------------|-------|
| **Guest** | Device_ID | 500 images | 30/day | 30 days | Free |
| **Free** | Account | 1000 images | 50/day | 30 days | Free |
| **Basic** | Account | 3000 images | 100/day | 30 days | ¥500/month |
| **Pro** | Account | 10000 images | Unlimited | 30 days | ¥1,500/month |

**Key Changes from v1**:
- **Total Limit**: Monthly quota (replaces daily-only limit)
- **Daily Rate**: Optional rate limiting (0 = unlimited for Pro tier)
- **Permit Expiry**: 30-day validity, auto-refresh on app resume

## Quota Validation Priority

When checking `LocalQuota.checkCanUpload()`:

```
Priority 1: Permit Expired?
  └─ YES → Deny (reason: 'permit_expired')
  └─ NO  → Continue

Priority 2: Total Limit Reached?
  └─ YES → Deny (reason: 'total_limit_reached')
  └─ NO  → Continue

Priority 3: Daily Rate Exceeded? (if dailyRate > 0)
  └─ YES → Deny (reason: 'daily_limit_reached')
  └─ NO  → Allow
```

## Permit Structure

```typescript
interface UploadPermit {
  userId: string;
  totalLimit: number;       // Total upload quota (e.g., 500)
  dailyRate: number;        // Daily rate limit (0 = unlimited)
  expiresAt: string;        // ISO 8601 (e.g., 30 days from issuance)
  issuedAt: string;         // ISO 8601 (issuance timestamp)
  signature: string;        // HMAC-SHA256 hex (64 chars)
  tier: 'guest' | 'free' | 'basic' | 'pro';
}

// Signature algorithm
const message = `${userId}:${totalLimit}:${dailyRate}:${expiresAt}:${issuedAt}`;
const signature = HMAC-SHA256(message, SECRET_KEY);
```

**Security**:
- **Tampering Prevention**: Any modification to permit fields invalidates signature
- **Key Rotation**: Secrets Manager supports zero-downtime key rotation
- **Multi-Key Verification**: presign Lambda supports active + old keys during rotation

## Local Storage

**Location**: `localStorage['yorutsuke:quota']`

```typescript
interface LocalQuotaData {
  permit: UploadPermit;
  totalUsed: number;
  dailyUsage: {
    "2026-01-18": 25,
    "2026-01-17": 30,
    // Auto-cleanup: Only keeps last 7 days
  }
}
```

**Cleanup**: `LocalQuota.incrementUsage()` removes records older than 7 days.

## Enforcement Layers

| Layer | Location | Type | Purpose |
|-------|----------|------|---------|
| **Client** | `LocalQuota.checkCanUpload()` | Soft | Instant UX feedback (no network) |
| **Cloud** | presign Lambda | **HARD** | Cryptographic verification |

**Design Rationale**:
- Client check is instant (no network latency)
- Client tampering is prevented by signature verification
- presign Lambda is the final authority (verifies HMAC-SHA256)

## Rate Limiting

| Control | Value | Purpose |
|---------|-------|---------|
| Upload interval | 2,000ms | Prevent burst uploads |
| Daily reset | Local midnight | Per-device daily tracking |
| Quota rollover | None | Use it or lose it |

## Permit Lifecycle

### 1. Issuance
- Triggered by `quotaService.setUser(userId)`
- Generated by issue-permit Lambda
- Stored in localStorage
- Signed with Secrets Manager key

### 2. Validation
- Client: Check expiration, total/daily limits (instant)
- Cloud: Verify signature (on presign request)

### 3. Refresh
- Automatic on app resume (if expired)
- Manual via Debug panel (dev only)
- Triggers: `document.visibilitychange`, `quota:reset` event

### 4. Expiration
- Default: 30 days from issuance
- Auto-refresh when app becomes visible
- Grace period: Client continues to check locally until refresh

## Migration from Quota v1

**Legacy System (v1)**:
- DynamoDB `quotas` table (userId, date, count)
- quota Lambda for API queries
- Daily reset at 00:00 JST

**Permit System (v2)**:
- localStorage (permit + usage)
- No quota Lambda (replaced by issue-permit)
- Client-side daily tracking (local timezone)

**Backward Compatibility**:
- presign Lambda supports dual-path:
  - If `body.permit` → Verify signature (v2)
  - If no permit → Fall back to quotas table (v1, deprecated)
- Migration period: 7 days monitoring
- Cleanup: Remove quotas table after 95%+ adoption

## Global Cost Controls

| Level | Limit | Enforcement |
|-------|-------|-------------|
| Global daily | ¥1,000 | Lambda hard stop (emergency stop SSM parameter) |
| S3 uploads | 1,500/day | CloudWatch alarm |
| LLM calls | 900/day | CloudWatch alarm |
| Circuit breaker | Errors > 100/5min | Emergency stop |

**Circuit Breaker**: `EMERGENCY_STOP_PARAM` in SSM (checked by presign Lambda).

## Overflow Handling

When user exceeds quota:

```typescript
// Client behavior
if (LocalQuota.checkCanUpload().allowed === false) {
  uploadStore.setState({ status: 'paused', reason: 'quota' });
  // Queue preserved, user notified
}
```

**Recovery**:
- **Total limit reached**: Wait for permit renewal (next month)
- **Daily rate exceeded**: Retry after local midnight
- **Permit expired**: Auto-refresh on app resume

## Conversion Funnel

Expected user progression:

```
Downloads     100%
    ↓ Trial
Active Guest   30%    (500 images total, 30/day, 30-day permit)
    ↓ Register (data security + more quota)
Free User      15%    (1000 images total, 50/day, permanent)
    ↓ Pay (higher limits)
Paid User      2-3%   (3000-10000 images, 100/day or unlimited)
```

**Guest → Free**: +500 images total, +20/day, multi-device sync

**Free → Basic**: +2000 images total, +50/day

**Basic → Pro**: +7000 images total, unlimited daily

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| LocalQuota class | ✅ | Singleton pattern, 54 tests passing |
| issue-permit Lambda | ✅ | HMAC-SHA256 signing, 58 tests passing |
| presign Lambda (signature verification) | ✅ | Dual-path support |
| permitApi adapter | ✅ | Mock mode support |
| quotaService integration | ✅ | IO-First Pattern |
| quotaStore (Permit v2) | ✅ | FSM state machine |
| Multi-key rotation | ✅ | Secrets Manager + multi-key verification |
| Paid tiers (Stripe) | ⚪ | Phase 3 |
| Multi-device sync | ⚪ | Phase 2 |

## Frontend Integration

```typescript
// quotaStore returns QuotaStatus
interface QuotaStatus {
  // Total quota
  totalUsed: number;
  totalLimit: number;
  remainingTotal: number;

  // Daily quota
  usedToday: number;
  dailyRate: number;
  remainingDaily: number | typeof Infinity;

  // Status
  isLimitReached: boolean;
  tier: 'guest' | 'free' | 'basic' | 'pro';
  isGuest: boolean;
  isExpired: boolean;
}

// Usage in views
const quota = useStore(quotaStore, (s) => s.getQuotaStatus());
if (quota.isLimitReached) {
  // Show "Quota exceeded" message
}
```

## Testing

**Unit Tests**: 119/119 passing
- LocalQuota: 54 tests (priority validation, cleanup, Pro tier)
- issue-permit Lambda: 58 tests (signing, multi-key, edge cases)
- permitApi: 7 tests (mock mode, network errors)

**Integration Tests**:
- End-to-end upload flow with permit
- Signature verification (valid/invalid/expired)
- Dual-path fallback (v2 + v1 compatibility)

## Monitoring

**CloudWatch Metrics**:
- `METRIC_PERMIT_USAGE`: Requests using Permit v2
- `METRIC_QUOTA_USAGE`: Requests using legacy v1 (deprecated)
- Target: 95%+ Permit v2 adoption after 7 days

**CloudWatch Alarms**:
- Signature verification failures > 10/hour
- Permit expiration rate > 20%/day
- Global cost > ¥1,000/day

## Security Considerations

**Threat Model**:
| Attack | Mitigation |
|--------|-----------|
| Modify totalLimit | Signature verification fails → 403 |
| Replay old permit | expiresAt check → reject expired |
| Bypass client check | presign Lambda enforces signature |
| Key compromise | Rotate via Secrets Manager, multi-key support |

**Best Practices**:
- Secret key stored in Secrets Manager (not environment variables)
- Quarterly key rotation recommended
- Monitor CloudWatch for anomalous patterns
- Rate limiting at API Gateway (future)

## Related Documentation

- [SCHEMA.md](../architecture/SCHEMA.md) - Permit data structure
- [INTERFACES.md](../architecture/INTERFACES.md) - issue-permit + presign APIs
- [OPERATIONS.md](./OPERATIONS.md) - Cost controls
- [ADR-XXX](../architecture/ADR/) - Permit v2 architecture decision (pending)

## Appendix: Permit v1 → v2 Migration

**Timeline**:
- Day 0: Deploy Permit v2 (dual-path support)
- Day 1-7: Monitor adoption (CloudWatch metrics)
- Day 7: Verify 95%+ using Permit v2
- Day 8: Deprecate quota Lambda
- Day 30: Remove quotas DynamoDB table (or retain as audit log)

**Rollback Plan**:
- presign Lambda supports v1 fallback (quotas table)
- Re-enable quota Lambda if needed
- No data loss during transition
