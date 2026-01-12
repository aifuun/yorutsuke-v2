# URL Construction Rules

> Learned from BUG-003: Double slash caused silent routing failure (2026-01)

## The Bug

```typescript
const BASE_URL = 'https://api.example.com/';  // Trailing slash
fetch(`${BASE_URL}/sync`);  // → https://api.example.com//sync (WRONG!)
```

- Request went to wrong Lambda handler (silent failure)
- Returned `{ transactions }` instead of `{ synced, failed }`
- Only caught by Zod validation at boundary

## Rule: Pick One Slash Convention

```typescript
// Option A: Base URL has trailing slash, paths have no leading slash
const BASE_URL = 'https://api.example.com/';
fetch(`${BASE_URL}sync`);      // ✅ https://api.example.com/sync
fetch(`${BASE_URL}users/123`); // ✅ https://api.example.com/users/123

// Option B: Base URL has no trailing slash, paths have leading slash
const BASE_URL = 'https://api.example.com';
fetch(`${BASE_URL}/sync`);      // ✅ https://api.example.com/sync
fetch(`${BASE_URL}/users/123`); // ✅ https://api.example.com/users/123
```

## This Project's Convention

**Option A**: Base URLs end with `/`, paths have no leading slash.

```typescript
// ✅ Correct
const TRANSACTIONS_URL = 'https://xxx.lambda-url.ap-northeast-1.on.aws/';
fetch(`${TRANSACTIONS_URL}sync`);

// ❌ Wrong
fetch(`${TRANSACTIONS_URL}/sync`);
```

## Checklist

Before adding new API endpoints:
- [ ] Check if base URL has trailing slash
- [ ] Ensure path doesn't add leading slash (or vice versa)
- [ ] Test actual URL in browser/curl before shipping
