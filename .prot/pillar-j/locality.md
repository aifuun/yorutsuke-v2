# Pillar J: State Locality

> State lives as close to its usage as possible

## Rule

State must reside at the **lowest possible level** in the component tree. Global state is reserved for truly universal data only.

## Purpose

- Prevent global store pollution
- Improve render performance
- Simplify state debugging
- Enable component reusability

## Implementation

### State Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│ GLOBAL (App-wide)                                        │
│ • User session (auth)                                    │
│ • Theme preference                                       │
│ • Locale/i18n                                           │
│ • Feature flags                                          │
└─────────────────────────────────────────────────────────┘
                           ▲
                           │ Only these belong in global store
                           │
┌─────────────────────────────────────────────────────────┐
│ MODULE (Feature-scoped)                                  │
│ • Cart state (cart module)                               │
│ • Order list (order module)                              │
│ • User profile cache                                     │
└─────────────────────────────────────────────────────────┘
                           ▲
                           │ Module-level context or store slice
                           │
┌─────────────────────────────────────────────────────────┐
│ COMPONENT (Local)                                        │
│ • Form input values                                      │
│ • UI state (open/closed)                                 │
│ • Loading states                                         │
│ • Pagination                                             │
└─────────────────────────────────────────────────────────┘
```

### Global State (Zustand Example)

```typescript
// stores/global.ts - ONLY for truly global state
interface GlobalStore {
  // Auth
  user: User | null;
  isAuthenticated: boolean;

  // Preferences
  theme: 'light' | 'dark';
  locale: string;

  // Actions
  setUser: (user: User | null) => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

const useGlobalStore = create<GlobalStore>((set) => ({
  user: null,
  isAuthenticated: false,
  theme: 'light',
  locale: 'en',

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setTheme: (theme) => set({ theme }),
}));
```

### Module State (Context)

```typescript
// modules/cart/context.ts
interface CartContext {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: ItemId) => void;
  total: number;
}

const CartContext = createContext<CartContext | null>(null);

// Provider at module boundary
function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => [...prev, item]);
  }, []);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price, 0),
    [items]
  );

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, total }}>
      {children}
    </CartContext.Provider>
  );
}

// Hook for components
function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be within CartProvider');
  return context;
}
```

### Component State (Local)

```typescript
// views/ProductCard.tsx
function ProductCard({ product }: { product: Product }) {
  // ✅ Local state - only this component needs it
  const [quantity, setQuantity] = useState(1);
  const [isHovered, setIsHovered] = useState(false);

  // Module state access for actions
  const { addItem } = useCart();

  const handleAdd = () => {
    addItem({ productId: product.id, quantity });
    setQuantity(1);  // Reset local state
  };

  return (
    <div onMouseEnter={() => setIsHovered(true)}>
      <input value={quantity} onChange={e => setQuantity(+e.target.value)} />
      <button onClick={handleAdd}>Add to Cart</button>
    </div>
  );
}
```

## Good Example

```typescript
// ✅ Correct state placement

// Global: Auth only
const { user } = useGlobalStore();

// Module: Cart state in cart context
function CartPage() {
  const { items, total } = useCart();  // Module state
  return <CartList items={items} />;
}

// Component: Form state local
function CheckoutForm() {
  const [address, setAddress] = useState('');  // Local
  const [cardNumber, setCardNumber] = useState('');  // Local
  const { items } = useCart();  // Read from module

  return (
    <form>
      <input value={address} onChange={e => setAddress(e.target.value)} />
      <input value={cardNumber} onChange={e => setCardNumber(e.target.value)} />
    </form>
  );
}
```

## Bad Example

```typescript
// ❌ Everything in global store
const useStore = create((set) => ({
  // Auth - OK
  user: null,

  // ❌ Should be module state
  cartItems: [],
  orders: [],

  // ❌ Should be component state
  productSearchQuery: '',
  isProductModalOpen: false,
  selectedProductId: null,
  formValues: {},
  currentPage: 1,
}));

// Results in:
// - Unnecessary re-renders across app
// - Difficult to trace state changes
// - Tight coupling between unrelated features
```

## Anti-Patterns

1. **Form state in global store**
   ```typescript
   // ❌ Form inputs don't need global state
   const { formValues, setFormValue } = useGlobalStore();
   ```

2. **UI state in Redux**
   ```typescript
   // ❌ Modal open/close is component concern
   dispatch(setModalOpen(true));
   ```

3. **Derived state stored**
   ```typescript
   // ❌ Calculate, don't store
   store.set({ total: items.reduce(...) });
   // ✅ Use useMemo or selector
   const total = useMemo(() => items.reduce(...), [items]);
   ```

4. **Prop drilling avoidance via global**
   ```typescript
   // ❌ Don't use global just to avoid prop drilling
   // Use module context instead
   ```

## State Location Decision Tree

```
Is it needed across the entire app?
├── Yes → Global Store (user, theme, locale)
└── No
    └── Is it needed across a feature/module?
        ├── Yes → Module Context (cart, order list)
        └── No
            └── Component State (form, UI toggles)
```

## Exceptions

- Performance optimization may require lifting state
- Cross-module communication via events (not shared state)

## Checklist

- [ ] Global store contains only: auth, theme, locale, feature flags
- [ ] Module state uses Context or scoped store
- [ ] Form inputs use local useState
- [ ] UI toggles (modals, dropdowns) are local
- [ ] Derived values use useMemo, not stored
- [ ] No prop drilling solved by global state

## References

- Related: Pillar I (Firewalls) - module isolation
- Related: Pillar L (Headless) - state in hooks
- Pattern: Lifting State Up, Colocation
- Template: `.prot/pillar-j/locality.ts`
- Checklist: `.prot/pillar-j/checklist.md`
