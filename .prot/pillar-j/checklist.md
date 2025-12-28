# Pillar J: State Locality Checklist

> Use this checklist when deciding where to place state in your application.

## AI-First Principles

| Principle | Application |
|-----------|-------------|
| **Explicit > Abstract** | State location is explicitly decided per feature |
| **Simple > Clever** | Local state by default; lift only when needed |
| **Clear > DRY** | Prefer duplication over global pollution |

## Decision Tree

Before placing any state, answer these questions:

```
Q1: Is this state needed across the ENTIRE app?
    │
    ├─ YES → GLOBAL STORE
    │        (user auth, theme, locale, feature flags)
    │
    └─ NO
       │
       Q2: Is this state shared across multiple components in a FEATURE?
           │
           ├─ YES → MODULE CONTEXT
           │        (cart items, order list, search filters)
           │
           └─ NO → COMPONENT STATE
                   (form inputs, loading, modals, hover)
```

## Global State Checklist

### What Belongs in Global Store

- [ ] User authentication / session
- [ ] Theme preference (light/dark)
- [ ] Locale / language setting
- [ ] Feature flags
- [ ] **Nothing else**

### What Does NOT Belong

- [ ] ❌ Cart items (module state)
- [ ] ❌ Form values (component state)
- [ ] ❌ UI toggles (component state)
- [ ] ❌ Search queries (component state)
- [ ] ❌ Loading states (component state)
- [ ] ❌ Pagination (component state)

```typescript
// ✅ Correct global store
const useGlobalStore = create(() => ({
  user: null,
  theme: 'light',
  locale: 'en',
  features: {},
}));

// ❌ Wrong - polluted global store
const useGlobalStore = create(() => ({
  user: null,
  cartItems: [],       // Should be module
  searchQuery: '',     // Should be component
  isModalOpen: false,  // Should be component
}));
```

## Module State Checklist

### When to Use Module Context

- [ ] State shared by 2+ components in same feature
- [ ] State represents a "thing" the feature manages
- [ ] State needs to persist across page navigation (within feature)

### Creating Module Context

- [ ] Define clear interface for context value
- [ ] Provider wraps feature boundary (not app root)
- [ ] Hook throws if used outside provider
- [ ] Derived values use `useMemo`, not stored

```typescript
// ✅ Correct: Module-scoped context
const CartContext = createContext<CartContextValue | null>(null);

function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const total = useMemo(() => /* calc */, [items]);  // Derived
  return <CartContext.Provider value={{ items, total }}>{children}</CartContext.Provider>;
}

// Used at feature boundary
<CartProvider>
  <CartPage />
</CartProvider>
```

## Component State Checklist

### What Belongs in Component State

- [ ] Form input values
- [ ] Form validation errors
- [ ] Loading/submitting states
- [ ] UI toggles (modal open, dropdown open)
- [ ] Hover/focus states
- [ ] Current page (pagination)
- [ ] Active tab
- [ ] Temporary selections

### Implementation

- [ ] Use `useState` for simple values
- [ ] Use `useReducer` for complex state logic
- [ ] State resets when component unmounts (expected)
- [ ] No need to persist between sessions

```typescript
// ✅ Correct: Local component state
function CheckoutForm() {
  const [address, setAddress] = useState('');     // Form input
  const [isSubmitting, setIsSubmitting] = useState(false);  // Loading
  const [errors, setErrors] = useState({});       // Validation
  // ...
}

function ProductModal() {
  const [isOpen, setIsOpen] = useState(false);    // UI toggle
  const [activeTab, setActiveTab] = useState('details');  // Tab
  // ...
}
```

## Code Review Checklist

### Global Store Review
- [ ] Only contains: auth, theme, locale, features
- [ ] No cart/order/product state
- [ ] No form values
- [ ] No UI toggles

### Module Context Review
- [ ] Provider at feature boundary, not app root
- [ ] Hook has null check with descriptive error
- [ ] Derived values use useMemo
- [ ] Actions are memoized with useCallback

### Component State Review
- [ ] Form inputs use local useState
- [ ] Loading states are local
- [ ] Modal/dropdown open state is local
- [ ] No state lifted unnecessarily

### Derived State Review
- [ ] Totals/counts use useMemo
- [ ] Filtered lists use useMemo
- [ ] No derived values stored in state

## Common Patterns

### 1. Form with Local State

```typescript
function ContactForm() {
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: string) => (e: ChangeEvent) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <form>
      <input value={formData.name} onChange={handleChange('name')} />
      <input value={formData.email} onChange={handleChange('email')} />
    </form>
  );
}
```

### 2. List with Module Context

```typescript
// Context for order list feature
const OrderListContext = createContext<OrderListContextValue | null>(null);

function OrderListProvider({ children }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all');  // Could be local or shared

  // Derived
  const filteredOrders = useMemo(
    () => orders.filter(o => filter === 'all' || o.status === filter),
    [orders, filter]
  );

  return (
    <OrderListContext.Provider value={{ orders, filteredOrders, filter, setFilter }}>
      {children}
    </OrderListContext.Provider>
  );
}
```

### 3. Component Reading Multiple Levels

```typescript
function ProductCard({ product }) {
  // Global: auth
  const { user } = useGlobalStore();

  // Module: cart actions
  const { addItem } = useCart();

  // Local: UI state
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  return (/* ... */);
}
```

## Common Mistakes

| Pattern | Problem | Fix |
|---------|---------|-----|
| Form in global store | Unnecessary coupling | Use local useState |
| Modal state in Redux | Over-engineering | Use local useState |
| Derived value stored | Stale data risk | Use useMemo |
| Global to avoid drilling | Global pollution | Use module context |
| Module for single component | Over-engineering | Use local state |
| Lifting state too early | Complexity | Start local, lift when needed |

## Anti-Patterns

```typescript
// ❌ 1. Form state in global store
const { formValues } = useGlobalStore();

// ❌ 2. UI toggle in Redux
dispatch({ type: 'TOGGLE_MODAL' });

// ❌ 3. Storing derived values
const [total, setTotal] = useState(0);
useEffect(() => {
  setTotal(items.reduce(...));  // Wrong! Use useMemo
}, [items]);

// ❌ 4. Context at app root for feature state
<AppRoot>
  <CartProvider>  {/* Should be at feature boundary */}
    <App />
  </CartProvider>
</AppRoot>
```

## Template Reference

Copy from: `.prot/pillar-j/locality.ts`

Key patterns:
- Global store interface
- Module context with provider
- Component local state examples
- Decision tree for state placement
