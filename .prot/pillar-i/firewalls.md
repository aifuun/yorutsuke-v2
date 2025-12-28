# Pillar I: Architectural Firewalls

> Strict physical isolation between modules

## Rule

Cross-module communication must occur **ONLY** via the module's public API (`index.ts`). Deep imports are **BANNED**.

## Purpose

- Prevent spaghetti code
- Eliminate circular dependencies
- Enable independent module evolution
- Clear contracts between modules

## Implementation

### Module Structure

```
src/02_modules/
├── order/
│   ├── index.ts           # ✅ PUBLIC API - only import from here
│   ├── headless/
│   │   └── useOrder.ts    # ❌ Internal - never import directly
│   ├── adapters/
│   │   └── orderApi.ts    # ❌ Internal
│   ├── views/
│   │   └── OrderView.tsx  # ❌ Internal
│   └── types.ts           # ❌ Internal (export via index.ts)
│
├── user/
│   ├── index.ts           # ✅ PUBLIC API
│   └── ...
│
└── shared/
    ├── index.ts           # ✅ Shared components
    └── components/
        └── Button.tsx     # ❌ Internal
```

### Public API (index.ts)

```typescript
// 02_modules/order/index.ts

// Types - explicit exports
export type { Order, OrderId, OrderStatus } from './types';
export type { CreateOrderCommand, OrderResult } from './workflows/types';

// Hooks - for UI consumption
export { useOrder } from './headless/useOrder';
export { useOrderList } from './headless/useOrderList';

// Actions - for programmatic use
export { createOrder, cancelOrder } from './workflows';

// Components - if shared
export { OrderSummary } from './views/OrderSummary';
```

### Correct Import Pattern

```typescript
// ✅ GOOD: Import from module's public API
import { useOrder, Order, createOrder } from '@/modules/order';
import { useUser, User } from '@/modules/user';
import { Button, Card } from '@/modules/shared';

function OrderPage() {
  const { order } = useOrder(orderId);
  const { user } = useUser(order.userId);

  return (
    <Card>
      <OrderSummary order={order} />
      <Button onClick={() => createOrder(...)}>New Order</Button>
    </Card>
  );
}
```

### Forbidden Import Pattern

```typescript
// ❌ BAD: Deep imports
import { useOrder } from '@/modules/order/headless/useOrder';
import { orderApi } from '@/modules/order/adapters/orderApi';
import { Button } from '@/modules/shared/components/Button';
import { formatOrder } from '@/modules/order/utils/format';
```

### ESLint Configuration

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['@/modules/*/headless/*'],
          message: 'Import from module index.ts instead',
        },
        {
          group: ['@/modules/*/adapters/*'],
          message: 'Import from module index.ts instead',
        },
        {
          group: ['@/modules/*/views/*'],
          message: 'Import from module index.ts instead',
        },
        {
          group: ['@/modules/*/workflows/*'],
          message: 'Import from module index.ts instead',
        },
      ],
    }],
  },
};
```

### TypeScript Path Aliases

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/modules/*": ["src/02_modules/*"],
      "@/domains/*": ["src/01_domains/*"],
      "@/kernel/*": ["src/00_kernel/*"]
    }
  }
}
```

## Good Example

```typescript
// ✅ Clean module boundaries

// modules/cart/index.ts
export { useCart } from './headless/useCart';
export { CartView } from './views/CartView';
export type { Cart, CartItem } from './types';

// modules/checkout/index.ts
export { useCheckout } from './headless/useCheckout';
export type { CheckoutCommand } from './types';

// App.tsx - uses public APIs only
import { useCart, Cart } from '@/modules/cart';
import { useCheckout } from '@/modules/checkout';

function App() {
  const { cart } = useCart();
  const { checkout } = useCheckout();
  // ...
}
```

## Bad Example

```typescript
// ❌ Cross-module deep imports

// modules/checkout/views/CheckoutForm.tsx
import { cartReducer } from '../cart/headless/cartReducer';  // ❌ Deep import
import { validateItem } from '../cart/utils/validate';       // ❌ Deep import
import { CartItem } from '../cart/types';                    // ❌ Should use index

// Creates tight coupling, breaks encapsulation
function CheckoutForm() {
  // Using cart's internal reducer directly
  const [state, dispatch] = useReducer(cartReducer, initial);
}
```

## Anti-Patterns

1. **Relative deep imports**
   ```typescript
   // ❌ Going up and into another module
   import { something } from '../../user/internal/helper';
   ```

2. **Shared utilities outside shared module**
   ```typescript
   // ❌ Utils should be in shared or within module
   import { formatDate } from '../order/utils/date';
   ```

3. **Circular dependencies**
   ```typescript
   // order/index.ts imports from user
   // user/index.ts imports from order
   // ❌ Circular! Extract shared types to kernel
   ```

4. **Re-exporting internals**
   ```typescript
   // ❌ Don't expose internal structure
   export * from './headless';
   export * from './adapters';
   ```

## Exceptions

- Shared module internals may be accessed by other shared utilities
- Test files may import internals for unit testing

## Checklist

- [ ] All modules have `index.ts` with explicit exports
- [ ] No imports from `*/headless/*`, `*/adapters/*`, `*/views/*`
- [ ] ESLint rule configured to catch violations
- [ ] No circular dependencies between modules
- [ ] Shared code in `shared/` module
- [ ] Path aliases configured in tsconfig

## References

- Related: Pillar J (Locality) - state within modules
- Related: Pillar L (Headless) - internal structure
- Architecture: Feature-Sliced Design, Modular Monolith

## Assets

- Template: `.prot/pillar-i/firewalls.ts`
- Checklist: `.prot/pillar-i/checklist.md`
- Audit: `.prot/pillar-i/audit.ts`
