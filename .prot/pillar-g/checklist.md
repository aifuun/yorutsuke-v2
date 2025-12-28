# Pillar G: AI Traceability Checklist

> Use this checklist when creating event-driven flows or refactoring existing code.

## AI-First Principles

| Principle | Application |
|-----------|-------------|
| **Explicit > Abstract** | Every event flow is explicitly documented with annotations |
| **Copy > Generate** | Copy annotation patterns from template |
| **Clear > DRY** | Repeat annotations even if similar; clarity for AI |

## When to Apply

- [ ] Creating new event emitter (function that publishes events)
- [ ] Creating new event handler (function that subscribes to events)
- [ ] Creating saga/workflow with multiple steps
- [ ] Defining module public API
- [ ] Adding Tauri IPC commands

## Creating Event Emitter

### 1. Add @trigger Annotation

- [ ] Function has `@trigger EVENT_NAME` annotation
- [ ] Event name matches constant in EVENT_TYPES
- [ ] `@emits` specifies the event type interface
- [ ] `@payload` documents data shape

```typescript
// ✅ Correct
/**
 * @trigger ORDER_PLACED
 * @emits OrderPlacedEvent
 * @payload { orderId: OrderId, userId: UserId, items: OrderItem[] }
 */
async function createOrder() { /* ... */ }

// ❌ Wrong: No annotations
async function createOrder() {
  await eventBus.publish({ type: 'ORDER_PLACED' }); // Where does this go?
}
```

### 2. Define Event Type

- [ ] Event type constant defined in shared location
- [ ] Payload interface defined
- [ ] Type exported for handlers

## Creating Event Handler

### 1. Add @listen Annotation

- [ ] Function has `@listen EVENT_NAME` annotation
- [ ] Event name matches a @trigger somewhere
- [ ] `@calls` lists all service dependencies

```typescript
// ✅ Correct
/**
 * @listen ORDER_PLACED
 * @calls [InventoryService.reserve, NotificationAdapter.send]
 */
async function handleOrderPlaced(event) { /* ... */ }

// ❌ Wrong: Missing @calls
/** @listen ORDER_PLACED */
async function handleOrderPlaced(event) {
  await inventoryService.reserve();  // Not documented!
}
```

### 2. Document Compensation (if applicable)

- [ ] `@compensates` annotation if handler has undo action
- [ ] Compensation mapped to specific step/event

## Creating Saga

### 1. Full Saga Annotation

- [ ] `@saga` names the workflow
- [ ] `@trigger` marks entry event
- [ ] `@steps` lists each step with dependencies
- [ ] `@compensates` maps each step to undo action

```typescript
/**
 * @saga CheckoutFlow
 * @trigger CHECKOUT_INITIATED
 * @steps
 *   1. INVENTORY_RESERVED -> @calls [InventoryService]
 *   2. PAYMENT_AUTHORIZED -> @calls [PaymentAdapter]
 *   3. ORDER_COMPLETED -> @emits OrderCompletedEvent
 * @compensates
 *   - INVENTORY_RESERVED: InventoryService.release
 *   - PAYMENT_AUTHORIZED: PaymentAdapter.void
 */
```

## Module Index Annotation

### 1. Document Module

- [ ] `@module` declares module name
- [ ] `@exposes` lists public API
- [ ] `@depends` lists module dependencies
- [ ] `@triggers` lists events emitted
- [ ] `@listens` lists events handled

```typescript
// modules/order/index.ts
/**
 * @module OrderModule
 * @exposes [createOrder, getOrder, cancelOrder]
 * @depends [InventoryModule, PaymentModule]
 * @triggers [ORDER_PLACED, ORDER_CANCELLED]
 * @listens [PAYMENT_COMPLETED]
 */
export { createOrder, getOrder, cancelOrder };
```

## Code Review Checklist

### Event Flow Verification
- [ ] Every `@trigger` has matching `@listen` somewhere
- [ ] Every `@listen` references existing `@trigger`
- [ ] No orphan events (triggered but never listened)
- [ ] No ghost handlers (listening to non-existent events)

### Dependency Verification
- [ ] `@calls` accurately reflects actual function calls
- [ ] `@depends` at module level matches actual imports
- [ ] All significant dependencies documented

### Saga Verification
- [ ] Every saga step has compensation documented
- [ ] Compensation order is reverse of execution
- [ ] All external calls in saga are in `@steps`

### Tauri IPC Verification
- [ ] All `#[tauri::command]` have `@ipc` annotation
- [ ] `@invokes` matches actual backend call
- [ ] Events triggered by IPC are documented

## Common Patterns

### 1. Simple Event Flow

```typescript
// Emitter
/** @trigger USER_CREATED @payload { userId, email } */
async function createUser() { ... }

// Handler
/** @listen USER_CREATED @calls [EmailService.sendWelcome] */
async function onUserCreated() { ... }
```

### 2. Chain of Events

```typescript
// Step 1
/** @trigger ORDER_PLACED */
async function createOrder() { ... }

// Step 2 (listens and triggers)
/**
 * @listen ORDER_PLACED
 * @trigger INVENTORY_RESERVED
 * @calls [InventoryService]
 */
async function handleOrderPlaced() { ... }

// Step 3
/** @listen INVENTORY_RESERVED @calls [ShippingService] */
async function handleInventoryReserved() { ... }
```

### 3. Tauri Frontend to Backend

```typescript
// Frontend (TypeScript)
/** @invokes read_order @ipc */
async function getOrder(id: string) {
  return invoke('read_order', { id });
}

// Backend (Rust) - in comments
// @ipc read_order
// @returns OrderDTO
// #[tauri::command]
// async fn read_order(id: String) -> Result<OrderDTO, String>
```

## Common Mistakes

| Pattern | Problem | Fix |
|---------|---------|-----|
| No @trigger | AI can't find event source | Add @trigger annotation |
| No @listen | AI can't trace event handling | Add @listen annotation |
| Missing @calls | AI underestimates dependencies | List all service calls |
| Wrong event name | @trigger/@listen don't match | Use EVENT_TYPES constant |
| No @compensates | AI can't understand saga rollback | Document undo actions |
| Outdated annotations | Code changed, comments didn't | Update during refactoring |

## AI Tracing Example

When AI sees:
```
createOrder (@trigger ORDER_PLACED)
     ↓
handleOrderPlaced (@listen ORDER_PLACED)
     ↓ @calls
InventoryService.reserve
NotificationAdapter.send
```

AI can answer:
- "What happens when an order is created?" → Follow @trigger to @listen
- "What uses InventoryService?" → Search for @calls [*InventoryService*]
- "What if I change ORDER_PLACED payload?" → Find all @listen ORDER_PLACED

## Template Reference

Copy from: `.prot/pillar-g/traceability.ts`

Key patterns:
- Trigger annotation pattern
- Listener annotation pattern
- Saga annotation pattern
- Module index pattern
- Tauri IPC pattern
