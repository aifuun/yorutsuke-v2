# Quota System

> User tiers, rate limiting, and cost controls

Freemium model with tiered quotas to balance user value and cost control.

## User Tiers

| Tier | Identity | Daily Quota | Data Retention | Devices | Price |
|------|----------|-------------|----------------|---------|-------|
| **Guest** | Device_ID | 30 images | 60 days inactive | 1 | Free |
| **Free** | Account | 50 images | Permanent | 3 | Free |
| **Basic** | Account | 100 images | Permanent | 10 | ¥500/month |
| **Pro** | Account | 300 images | Permanent | 10 | ¥1,500/month |

## Core Value Proposition

**Registration value ≠ Just more quota**

The key benefits of registration:
- **Data permanence**: No 60-day expiration
- **Multi-device sync**: Access data from any device
- **Quota increase**: 30 → 50 images/day

```
Guest limitations:
- Data tied to single device (Device_ID)
- 60 days of inactivity → data deleted
- Cannot recover data on new device
```

## Rate Limiting

| Control | Value | Purpose |
|---------|-------|---------|
| Upload interval | 2,000ms | Prevent burst uploads |
| Daily reset | 00:00 JST | Fair daily allocation |
| Quota rollover | None | Use it or lose it |

## Quota Enforcement

Multi-layer defense with single authoritative checkpoint:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │ ──► │   Lambda    │ ──► │  DynamoDB   │
│  (Soft)     │     │  (HARD)     │     │  (Storage)  │
└─────────────┘     └─────────────┘     └─────────────┘
     UX hint         Authoritative        Atomic count
```

| Layer | Location | Type | Purpose |
|-------|----------|------|---------|
| Frontend | `useUploadQueue.ts` | Soft | Prevent wasted API calls |
| **Lambda** | `presign/index.mjs` | **HARD** | Authoritative enforcement |
| Lambda | `quota/index.mjs` | Info | Query API for frontend sync |

**Design rationale**:
- Frontend checks may be stale → acceptable for UX hints only
- Lambda presign is the single source of truth (atomic increment)
- Quota Lambda allows frontend to refresh on demand

## Global Cost Controls

| Level | Limit | Enforcement |
|-------|-------|-------------|
| Global daily | ¥1,000 | Lambda hard stop |
| S3 uploads | 1,500/day | CloudWatch alarm |
| LLM calls | 900/day | CloudWatch alarm |
| Circuit breaker | Errors > 100/5min | Emergency stop |

## Overflow Handling

When user exceeds daily quota:
1. Mark remaining images as `is_truncated = true`
2. Store in local queue
3. Process next day with priority

```typescript
// Frontend behavior
if (quotaExceeded) {
  state.status = 'paused';
  state.reason = 'quota';
  // Queue preserved, resumes at midnight JST
}
```

## Conversion Funnel

Expected user progression:

```
Downloads     100%
    ↓ Trial
Active Guest   30%    (30 images/day, 60-day expiry)
    ↓ Register (data security)
Free User      15%    (50 images/day, permanent)
    ↓ Pay (more quota)
Paid User      2-3%   (100-300 images/day)
```

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Guest quota (30/day) | ✅ | Device_ID based |
| Free quota (50/day) | ✅ | Account based |
| Paid tiers | ⚪ | Phase 3 (Stripe) |
| Multi-device sync | ⚪ | Phase 2 |
| 60-day expiration | ⚪ | Phase 2 |

## Frontend Integration

```typescript
// useQuota hook returns:
interface QuotaStatus {
  used: number;           // Today's upload count
  limit: number;          // Daily limit based on tier
  remaining: number;      // limit - used
  isLimitReached: boolean;
  resetsAt: string | null; // Next midnight JST (ISO 8601)
  tier: 'guest' | 'free' | 'basic' | 'pro';
}

// Default values (offline/guest)
const DEFAULTS = {
  limit: 30,
  tier: 'guest',
};

// Rate limiting (in rules.ts)
const MIN_UPLOAD_INTERVAL_MS = 2000; // 2 seconds
```

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Quota enforcement in Control Strategy
- [INTERFACES.md](./INTERFACES.md) - POST /quota API
- [OPERATIONS.md](./OPERATIONS.md) - Cost controls
