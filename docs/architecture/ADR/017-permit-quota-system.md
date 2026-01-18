# ADR-017: Permit-Based Quota System

**Status**: Accepted
**Date**: 2026-01
**Issue**: #150

## Context

Yorutsuke v2 enforces upload quotas to control costs and prevent abuse. The initial implementation (v1) used server-side quota checking:

```
Client → fetchQuota() → Lambda → DynamoDB → return { used, limit }
Client → check locally → proceed or block
```

**Problems with v1**:
1. **Two round trips**: Fetch quota, then request presign URL
2. **Stale data**: Quota checked before upload, race conditions possible
3. **Offline UX**: Can't show quota status without network
4. **Scaling costs**: Every quota check = Lambda invocation

**User Feedback**: Users complained about slow upload start times and unclear quota status in offline mode.

## Decision

Implement **Permit-based quota system (v2)** with client-side validation:

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Client (LocalQuota)                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1. Load cached permit from SQLite                       │ │
│ │ 2. Validate signature (HMAC-SHA256)                     │ │
│ │ 3. Check expiry (30 days)                               │ │
│ │ 4. Track local usage (totalUsed, usedToday)             │ │
│ │ 5. Enforce limits: totalUsed ≤ totalLimit               │ │
│ │                    usedToday ≤ dailyRate (if > 0)       │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          ↓
           Only fetch new permit when:
           - No permit cached
           - Permit expired
           - Signature invalid
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Cloud (Issue-Permit Lambda)                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1. Query DynamoDB for user tier                         │ │
│ │ 2. Generate permit with tier config                     │ │
│ │ 3. Sign with HMAC-SHA256 (secret in Secrets Manager)   │ │
│ │ 4. Return signed permit (valid 30 days)                │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

**1. UploadPermit (Domain)**
```typescript
interface UploadPermit {
  userId: UserId;
  totalLimit: number;     // Monthly quota (e.g., 500)
  dailyRate: number;      // Daily limit (0 = unlimited)
  expiresAt: string;      // ISO timestamp (30 days)
  issuedAt: string;
  signature: string;      // HMAC-SHA256 hex
  tier: UserTier;
}
```

**2. LocalQuota (Singleton)**
- Loads permit from SQLite on init
- Validates signature using HMAC-SHA256
- Tracks usage: `totalUsed`, `usedToday`, `lastUploadDate`
- Exposes: `canUpload()`, `recordUpload()`, `getQuotaStatus()`
- Refreshes permit automatically when expired

**3. Issue-Permit Lambda**
- Endpoint: `POST /issue-permit`
- Input: `{ userId, tier }`
- Output: `UploadPermit` with signature
- Secret: Stored in AWS Secrets Manager

**4. Presign Lambda Enhancement**
- Accepts optional `permit` in request body
- Validates permit signature server-side (defense in depth)
- Falls back to legacy quota check if no permit

### Dual Quota System

| Tier | Monthly (totalLimit) | Daily (dailyRate) | Enforcement |
|------|---------------------|-------------------|-------------|
| **guest** | 500 | 30 | Both limits enforced |
| **free** | 1000 | 50 | Both limits enforced |
| **basic** | 3000 | 100 | Both limits enforced |
| **pro** | 10000 | **0** | Only monthly limit (dailyRate=0 means unlimited) |

**Key Insight**: Pro tier bypasses daily rate limit (`dailyRate = 0`) but still has monthly cap.

### Security

1. **HMAC-SHA256 Signature**: Prevents permit tampering
2. **30-day Expiry**: Limits window for compromised permits
3. **Server-side Validation**: Presign Lambda re-validates signature
4. **Secret Rotation**: PERMIT_SECRET_KEY can be rotated in Secrets Manager
5. **Client-side Enforcement**: Blocks uploads before network call (UX + cost savings)

## Implementation

**Files Changed**: 38 files, 8366 insertions(+), 432 deletions(-)

**Key Modules**:
- `app/src/01_domains/quota/LocalQuota.ts` - Singleton permit manager
- `app/src/02_modules/capture/services/quotaService.ts` - Service layer
- `app/src/02_modules/capture/stores/quotaStore.ts` - Zustand store
- `infra/lambda/issue-permit/` - New Lambda function
- `infra/lambda/presign/` - Updated with permit validation

**Test Coverage**:
- `LocalQuota.test.ts`: 54 tests (signature validation, expiry, dual limits)
- `permitApi.test.ts`: 7 tests (API contract)
- `uploadService.integration.test.ts`: 6 tests (cross-module flow)

**Infrastructure**:
- PermitSecret (Secrets Manager)
- IssuePermitLambda (Node.js 22, 256MB, 10s timeout)
- Updated PresignLambda (with PERMIT_SECRET_KEY_ARN)
- Lambda Function URLs with CORS

## Consequences

### Positive

✅ **Offline-first UX**: Show quota status without network
✅ **Reduced API calls**: Fetch permit once per 30 days (vs. every upload session)
✅ **Faster uploads**: Skip quota API call before presign
✅ **Cost savings**: ~90% reduction in quota-check Lambda invocations
✅ **Dual limits**: Enforce both monthly total and daily rate
✅ **Pro tier flexibility**: Unlimited daily uploads (dailyRate=0) while maintaining monthly cap
✅ **Defense in depth**: Client + server validation

### Negative

❌ **Client complexity**: LocalQuota singleton manages permit lifecycle
❌ **Clock skew risk**: Client must have accurate time for expiry checks
❌ **Stale permit risk**: User upgrades tier, but permit cached for up to 30 days (mitigation: server re-checks tier on presign)
❌ **Secret management**: PERMIT_SECRET_KEY rotation requires Lambda redeployment

### Neutral

🔄 **Backward compatibility**: Presign Lambda falls back to legacy quota check if no permit
🔄 **Migration path**: Existing users get permit on next quota check
🔄 **Testing complexity**: Integration tests require mocked permits

## Alternatives Considered

### Alternative 1: Server-Side Quota Gating in Presign Lambda

**Rejected Reason**: Doesn't solve offline UX problem, still requires network for quota status.

### Alternative 2: JWT-Based Permits

**Rejected Reason**: Heavier library dependency, HMAC-SHA256 sufficient for our use case, and JWT adds unnecessary complexity for simple signature validation.

### Alternative 3: Single Quota Limit (Monthly Only)

**Rejected Reason**: Can't prevent burst abuse. User could upload entire monthly quota in one day, causing unexpected cost spike. Daily rate limit provides smooth cost distribution.

## Migration Strategy

**Phase 1: Deploy Infrastructure** ✅
- Deploy IssuePermitLambda to dev/prod
- Update PresignLambda with PERMIT_SECRET_KEY_ARN
- Permit validation optional (backward compatible)

**Phase 2: Client Rollout** ✅
- LocalQuota fetches permit on first init
- Falls back to legacy quota check if permit unavailable
- Gradual migration as users update app

**Phase 3: Deprecate Legacy (Future)**
- Monitor permit adoption rate
- After 90 days, make permit required in PresignLambda
- Remove legacy quota-check code

## Monitoring

**Key Metrics**:
- Permit cache hit rate (target: >95%)
- Permit validation failures (security indicator)
- Daily rate limit hits by tier
- Monthly quota exhaustion rate

**CloudWatch Alarms**:
- IssuePermitLambda error rate > 1%
- PresignLambda permit validation failures > 5%
- Secrets Manager access failures

## Related Decisions

- **ADR-001**: Service Pattern - QuotaService orchestrates LocalQuota + permitApi
- **ADR-005**: TraceId vs IntentId - Permits use intentId for idempotency
- **ADR-012**: Zustand Selector Safety - QuotaStore exposes getQuotaStatus()
- **ADR-013**: Environment-Based Secrets - PERMIT_SECRET_KEY in Secrets Manager

## References

- Issue: #150 (Refactor quota system to Permit-based architecture)
- Merged: 2026-01-18 (91c6d75)
- Tests: 294 passed, 1 skipped
- Deployed: dev environment (us-east-1)

---

**Last Updated**: 2026-01-18
**Status**: Deployed to dev, ready for production rollout
