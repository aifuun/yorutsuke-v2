# Pillar D: Explicit Finite State Machines

> Eliminate impossible states through union types

## Rule

Asynchronous flows must **NEVER** rely on boolean flags (`isLoading`, `isError`). Use explicit union types for state.

## Purpose

Mathematically prevent impossible states:
- `isLoading: true` AND `isError: true` (impossible!)
- `isSuccess: true` AND `isLoading: true` (impossible!)
- Undefined behavior when multiple flags are true

## Implementation (TypeScript + React)

### State as Union Type

```typescript
// ✅ GOOD: Explicit FSM
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

// Impossible states are literally impossible to represent
```

### With useReducer

```typescript
type State =
  | { status: 'idle'; items: Item[] }
  | { status: 'loading'; items: Item[] }
  | { status: 'success'; items: Item[]; message: string }
  | { status: 'error'; items: Item[]; error: string };

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; items: Item[] }
  | { type: 'FETCH_ERROR'; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, status: 'loading' };
    case 'FETCH_SUCCESS':
      return { status: 'success', items: action.items, message: 'Loaded' };
    case 'FETCH_ERROR':
      return { ...state, status: 'error', error: action.error };
    default:
      return state;
  }
}
```

### Rendering Based on State

```typescript
function Component() {
  const [state, dispatch] = useReducer(reducer, { status: 'idle', items: [] });

  // TypeScript narrows the type in each branch
  switch (state.status) {
    case 'idle':
      return <button onClick={fetch}>Load</button>;
    case 'loading':
      return <Spinner />;
    case 'success':
      return <List items={state.items} />;  // items guaranteed
    case 'error':
      return <Error message={state.error} />;  // error guaranteed
  }
}
```

## Good Example

```typescript
// Checkout flow with explicit states
type CheckoutState =
  | { step: 'cart'; items: CartItem[] }
  | { step: 'shipping'; items: CartItem[]; address?: Address }
  | { step: 'payment'; items: CartItem[]; address: Address }
  | { step: 'confirming'; items: CartItem[]; address: Address; paymentMethod: PaymentMethod }
  | { step: 'success'; orderId: OrderId }
  | { step: 'error'; error: string };

// Each step has exactly the data it needs
// Transitions are explicit and validated
```

## Bad Example

```typescript
// ❌ Boolean flag soup
interface CheckoutState {
  items: CartItem[];
  address?: Address;
  paymentMethod?: PaymentMethod;
  orderId?: string;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  isInCart: boolean;
  isInShipping: boolean;
  isInPayment: boolean;
  isConfirming: boolean;
  error?: string;
}

// Problems:
// 1. Can isLoading and isError both be true?
// 2. Can multiple step flags be true?
// 3. When is address required vs optional?
// 4. Easy to forget to reset flags
```

## Anti-Patterns

1. **Multiple boolean flags**
   ```typescript
   // ❌
   const [isLoading, setIsLoading] = useState(false);
   const [isError, setIsError] = useState(false);
   const [isSuccess, setIsSuccess] = useState(false);
   ```

2. **String status with loose typing**
   ```typescript
   // ❌ - typos possible, no type narrowing
   const [status, setStatus] = useState('idle');
   if (status === 'laoding') { } // typo compiles!
   ```

3. **Optional fields that depend on state**
   ```typescript
   // ❌ - when is error defined?
   interface State {
     data?: Data;
     error?: Error;
     loading: boolean;
   }
   ```

## Exceptions

- **Very simple components**: A single `isOpen` for a modal is acceptable
- **External library constraints**: When a library enforces boolean patterns

## Checklist

- [ ] No multiple boolean flags for async state
- [ ] State uses discriminated union with `status` field
- [ ] Each state variant contains exactly required data
- [ ] Switch statements handle all cases
- [ ] TypeScript narrows types in each branch

## References

- Related: Pillar M (Saga) - saga states
- Template: `.prot/pillar-d/fsm-reducer.ts`
- Checklist: `.prot/pillar-d/checklist.md`
