---
paths: "**/adapters/*.ts"
---
# Adapter Rules

> Adapters = IO boundary (API, IPC, storage). No business logic.

## Quick Check

### Pillar B: Airlock (Boundary Validation)
- [ ] All external data parsed with `Schema.parse()`
- [ ] Never trust raw API/IPC responses
- [ ] Handle parse errors gracefully
- [ ] Upcast old versions if needed (`v1 → v2`)

### Pillar A: Nominal Typing
- [ ] Returns branded types (`UserId`, not `string`)
- [ ] Input params use branded types
- [ ] No primitive IDs crossing boundary

### Adapter Purity
- [ ] Pure IO: fetch/save only, no business logic
- [ ] No state management in adapter
- [ ] Error handling: wrap in typed errors
- [ ] Async functions return `Promise<T>`

### Naming
- [ ] File: `{entity}Api.ts` or `{entity}Ipc.ts`
- [ ] Functions: `fetchXxx`, `saveXxx`, `deleteXxx`

## Core Pattern

```typescript
// Standard adapter pattern - copy directly
async function fetchUser(id: UserId): Promise<User> {
  const raw = await api.get(`/users/${id}`);
  return UserSchema.parse(raw);  // Pillar B: validate at boundary
}

async function saveUser(user: User): Promise<void> {
  await api.post('/users', user);  // Branded types ensure type safety
}
```

## Full Resources

| Need | File | When |
|------|------|------|
| Complete template | `.prot/pillar-b/airlock.ts` | New adapter file |
| Full checklist | `.prot/pillar-b/checklist.md` | Code review |
| Detailed docs | `.prot/pillar-b/airlock.md` | Uncertain implementation |
| Branded types | `.prot/pillar-a/branded.ts` | New entity types |

**AI**: When creating new adapter, Read `.prot/pillar-b/airlock.ts` first.
