# Saga/Workflow Rules

> T3 operations (distributed writes, payments). High risk, high protection.
> Apply when: Creating `*Saga.ts` files or implementing batch/payment flows.

## Quick Check

### Pillar M: Compensation (Undo)
- [ ] Every step has a compensation function defined
- [ ] `compensations.push(undo)` BEFORE executing step
- [ ] Rollback in reverse order on failure
- [ ] Compensations are idempotent (safe to retry)

### Pillar Q: Idempotency
- [ ] `intentId` received from client
- [ ] Check `Cache.has(intentId)` at entry
- [ ] Return cached result for retries
- [ ] Cache result after successful completion

### Pillar F: Concurrency Control
- [ ] `expectedVersion` in command
- [ ] Version check before write: `entity.version === expected`
- [ ] Throw `StaleDataError` on mismatch
- [ ] Increment version after write

### Error Handling
- [ ] Distinguish `FatalError` vs `TransientError`
- [ ] TransientError → retry with backoff
- [ ] FatalError → compensate and abort
- [ ] All errors logged with `traceId`

### Pillar R: Observability
- [ ] Semantic JSON logs (not text)
- [ ] Log: `{ saga, step, from, to, traceId }`
- [ ] Log state transitions, not just errors
- [ ] Include `intentId` in all logs

### Naming
- [ ] File: `{feature}Saga.ts` or `{feature}Workflow.ts`
- [ ] Entry: `process{Feature}(cmd: Command)`
- [ ] Steps: `step1_xxx`, `step2_xxx`

## Core Pattern

```typescript
// Standard saga pattern - copy directly
async function processOrder(cmd: OrderCommand) {
  // 1. Idempotency check (Pillar Q)
  const cached = await Cache.get(`intent:${cmd.intentId}`);
  if (cached) return cached;

  // 2. Version check (Pillar F)
  const order = await orderRepo.get(cmd.orderId);
  if (order.version !== cmd.expectedVersion) throw new StaleDataError();

  // 3. Execute with compensation (Pillar M)
  const compensations: Array<() => Promise<void>> = [];
  try {
    compensations.push(() => refundPayment(paymentId));
    await chargePayment(paymentId);

    // ... more steps

    const result = { success: true };
    await Cache.set(`intent:${cmd.intentId}`, result);
    return result;
  } catch (e) {
    while (compensations.length) await compensations.pop()?.();
    throw e;
  }
}
```

## Full Resources

| Need | File | When |
|------|------|------|
| Complete saga | `.prot/pillar-m/saga.ts` | New workflow |
| Idempotency | `.prot/pillar-q/idempotency.ts` | Intent caching |
| Concurrency | `.prot/pillar-f/optimistic-lock.ts` | Version control |
| Full checklist | `.prot/pillar-m/checklist.md` | Code review |

**AI**: When creating new saga, Read `.prot/pillar-m/saga.ts` first. T3 is high-risk.
