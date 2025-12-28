/**
 * Pillar G: AI Traceability Chain Template
 *
 * Structured comments for AI-assisted refactoring.
 * Creates "Context Anchors" that AI can follow.
 *
 * ⚠️ AI DEVELOPMENT NOTE:
 * - COPY these annotation patterns to your code
 * - Every @trigger MUST have matching @listen somewhere
 * - Every @listen MUST document @calls dependencies
 * - AI uses these to understand event topology
 */

// =============================================================================
// EVENT TYPES
// =============================================================================

/**
 * Define event types as constants for type safety.
 * AI can grep for these to find all usages.
 */
export const EVENT_TYPES = {
  // Order domain
  ORDER_PLACED: 'ORDER_PLACED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_COMPLETED: 'ORDER_COMPLETED',

  // Payment domain
  PAYMENT_INITIATED: 'PAYMENT_INITIATED',
  PAYMENT_AUTHORIZED: 'PAYMENT_AUTHORIZED',
  PAYMENT_CAPTURED: 'PAYMENT_CAPTURED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',

  // Inventory domain
  INVENTORY_RESERVED: 'INVENTORY_RESERVED',
  INVENTORY_RELEASED: 'INVENTORY_RELEASED',
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

// =============================================================================
// EVENT PAYLOAD TYPES
// =============================================================================

/**
 * ⚠️ AI NOTE: Match these types in @payload annotations
 */

export interface OrderPlacedPayload {
  orderId: string;
  userId: string;
  items: Array<{ productId: string; quantity: number }>;
  totalAmount: number;
}

export interface PaymentInitiatedPayload {
  orderId: string;
  amount: number;
  currency: string;
  intentId: string;
}

export interface InventoryReservedPayload {
  orderId: string;
  reservationId: string;
  items: Array<{ productId: string; quantity: number }>;
}

// =============================================================================
// TRIGGER PATTERN
// =============================================================================

/**
 * @trigger ORDER_PLACED
 * @emits OrderPlacedEvent
 * @payload { orderId: OrderId, userId: UserId, items: OrderItem[], totalAmount: Money }
 *
 * ⚠️ AI NOTE:
 * - @trigger marks this function as event source
 * - @emits names the event type
 * - @payload documents the data shape
 */
async function createOrder_EXAMPLE(cmd: {
  userId: string;
  items: Array<{ productId: string; quantity: number }>;
}): Promise<{ orderId: string }> {
  // 1. Business logic
  const order = {
    id: 'order_123',
    userId: cmd.userId,
    items: cmd.items,
    totalAmount: 100,
    status: 'placed',
  };

  // 2. Persist
  // await orderRepo.save(order);

  // 3. Emit event (AI traces this via @trigger annotation)
  // await eventBus.publish({
  //   type: EVENT_TYPES.ORDER_PLACED,
  //   payload: {
  //     orderId: order.id,
  //     userId: order.userId,
  //     items: order.items,
  //     totalAmount: order.totalAmount,
  //   },
  // });

  return { orderId: order.id };
}

// =============================================================================
// LISTENER PATTERN
// =============================================================================

/**
 * @listen ORDER_PLACED
 * @calls [InventoryService.reserve, NotificationAdapter.sendConfirmation]
 * @compensates INVENTORY_RESERVED (on failure releases reservation)
 *
 * ⚠️ AI NOTE:
 * - @listen connects to matching @trigger
 * - @calls lists all dependencies (AI can trace)
 * - @compensates documents undo action
 */
async function handleOrderPlaced_EXAMPLE(event: {
  type: 'ORDER_PLACED';
  payload: OrderPlacedPayload;
}): Promise<void> {
  const { orderId, userId, items } = event.payload;

  // 1. Reserve inventory (@calls InventoryService.reserve)
  // const reservation = await inventoryService.reserve(items);

  // 2. Send confirmation (@calls NotificationAdapter.sendConfirmation)
  // await notificationAdapter.sendConfirmation({ userId, orderId });

  console.log(`Handled ORDER_PLACED for ${orderId}`);
}

// =============================================================================
// SAGA PATTERN
// =============================================================================

/**
 * @saga CheckoutFlow
 * @trigger CHECKOUT_INITIATED
 * @steps
 *   1. INVENTORY_RESERVED -> @calls [InventoryService.reserve]
 *   2. PAYMENT_AUTHORIZED -> @calls [PaymentAdapter.authorize]
 *   3. PAYMENT_CAPTURED -> @calls [PaymentAdapter.capture]
 *   4. ORDER_COMPLETED -> @emits OrderCompletedEvent
 * @compensates
 *   - INVENTORY_RESERVED: InventoryService.release
 *   - PAYMENT_AUTHORIZED: PaymentAdapter.void
 *   - PAYMENT_CAPTURED: PaymentAdapter.refund
 *
 * ⚠️ AI NOTE:
 * - @saga names the multi-step workflow
 * - @steps lists each step with its dependencies
 * - @compensates maps each step to its undo action
 */
async function checkoutSaga_EXAMPLE(cmd: {
  orderId: string;
  userId: string;
  items: Array<{ productId: string; quantity: number }>;
  amount: number;
  intentId: string;
}): Promise<{ success: boolean; transactionId?: string }> {
  const compensations: Array<() => Promise<void>> = [];

  try {
    // Step 1: Reserve inventory
    // compensations.push(() => inventoryService.release(reservationId));
    // const reservationId = await inventoryService.reserve(cmd.items);

    // Step 2: Authorize payment
    // compensations.push(() => paymentAdapter.void(authId));
    // const authId = await paymentAdapter.authorize(cmd.amount);

    // Step 3: Capture payment
    // compensations.push(() => paymentAdapter.refund(txId));
    // const txId = await paymentAdapter.capture(authId);

    // Step 4: Complete order
    // await eventBus.publish({ type: EVENT_TYPES.ORDER_COMPLETED, ... });

    return { success: true, transactionId: 'tx_123' };
  } catch (error) {
    // Run compensations in reverse
    for (const compensate of compensations.reverse()) {
      await compensate();
    }
    throw error;
  }
}

// =============================================================================
// MODULE INDEX PATTERN
// =============================================================================

/**
 * @module OrderModule
 * @exposes [createOrder, getOrder, cancelOrder, listOrders]
 * @depends [InventoryModule, PaymentModule, NotificationModule]
 * @triggers [ORDER_PLACED, ORDER_CANCELLED, ORDER_COMPLETED]
 * @listens [PAYMENT_COMPLETED, INVENTORY_RESERVED]
 *
 * ⚠️ AI NOTE: Place this in module index.ts files
 * - @module declares module name
 * - @exposes lists public API
 * - @depends lists module dependencies
 * - @triggers lists events this module emits
 * - @listens lists events this module handles
 */

// Re-export public API
export {
  createOrder_EXAMPLE as createOrder,
  handleOrderPlaced_EXAMPLE as handleOrderPlaced,
  checkoutSaga_EXAMPLE as checkoutSaga,
};

// =============================================================================
// TAURI IPC PATTERN
// =============================================================================

/**
 * @ipc read_order
 * @invokes OrderModule.getOrder
 * @returns OrderDTO
 *
 * ⚠️ AI NOTE: For Tauri commands, use @ipc annotation
 */
// #[tauri::command]
// async fn read_order(id: String) -> Result<OrderDTO, String> {
//   // Rust implementation
// }

/**
 * @ipc create_order
 * @invokes OrderModule.createOrder
 * @triggers ORDER_PLACED (via OrderModule)
 * @returns { orderId: string }
 */
// #[tauri::command]
// async fn create_order(cmd: CreateOrderCmd) -> Result<OrderResult, String> {
//   // Rust implementation
// }

// =============================================================================
// ANNOTATION QUICK REFERENCE
// =============================================================================

/*
┌─────────────────────────────────────────────────────────────────────────────┐
│ ANNOTATION QUICK REFERENCE                                                   │
├─────────────────┬───────────────────────────────────────────────────────────┤
│ @trigger EVENT  │ This function emits EVENT                                 │
│ @listen EVENT   │ This function handles EVENT                               │
│ @emits Type     │ Event type being emitted                                  │
│ @payload {...}  │ Shape of event data                                       │
│ @calls [A, B]   │ Dependencies invoked by this function                     │
│ @compensates    │ Undo action for saga step                                 │
│ @saga Name      │ Saga workflow name                                        │
│ @steps          │ Saga step sequence                                        │
│ @module Name    │ Module declaration (in index.ts)                          │
│ @exposes [...]  │ Public API of module                                      │
│ @depends [...]  │ Module dependencies                                       │
│ @triggers [...] │ Events emitted by module                                  │
│ @listens [...]  │ Events handled by module                                  │
│ @ipc command    │ Tauri IPC command                                         │
│ @invokes        │ Backend function called by IPC                            │
└─────────────────┴───────────────────────────────────────────────────────────┘
*/

// =============================================================================
// TEMPLATE FOR NEW EVENT FLOW
// =============================================================================

/*
⚠️ AI: When creating a new event flow, follow this template:

1. Define event type constant:
   ```typescript
   export const EVENT_TYPES = {
     MY_EVENT: 'MY_EVENT',
   } as const;
   ```

2. Define payload type:
   ```typescript
   export interface MyEventPayload {
     entityId: string;
     // ... other fields
   }
   ```

3. Create trigger function:
   ```typescript
   /**
    * @trigger MY_EVENT
    * @emits MyEventPayload
    * @payload { entityId, ... }
    */
   async function doSomething() {
     // ... logic
     await eventBus.publish({ type: 'MY_EVENT', payload });
   }
   ```

4. Create listener function:
   ```typescript
   /**
    * @listen MY_EVENT
    * @calls [ServiceA, ServiceB]
    */
   async function handleMyEvent(event: MyEvent) {
     // ... handling logic
   }
   ```

5. Update module index:
   ```typescript
   /**
    * @module MyModule
    * @triggers [MY_EVENT]
    */
   ```
*/
