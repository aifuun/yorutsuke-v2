/**
 * Pillar J: State Locality Template
 *
 * State lives as close to its usage as possible.
 *
 * ⚠️ AI DEVELOPMENT NOTE:
 * - GLOBAL: Only auth, theme, locale, feature flags
 * - MODULE: Feature-scoped state (cart, orders)
 * - COMPONENT: Form inputs, UI toggles, loading states
 * - Use decision tree before placing state
 */

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useReducer,
  type ReactNode,
} from 'react';

// =============================================================================
// STATE HIERARCHY
// =============================================================================

/*
┌─────────────────────────────────────────────────────────────────────────────┐
│ LEVEL 1: GLOBAL (App-wide)                                                   │
│ • User session (auth)                                                        │
│ • Theme preference                                                           │
│ • Locale/i18n                                                               │
│ • Feature flags                                                              │
│ → Implementation: Zustand store or React Context at root                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│ LEVEL 2: MODULE (Feature-scoped)                                             │
│ • Cart state (cart module)                                                   │
│ • Order list (order module)                                                  │
│ • User profile cache                                                         │
│ → Implementation: Module-level Context or store slice                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│ LEVEL 3: COMPONENT (Local)                                                   │
│ • Form input values                                                          │
│ • UI state (open/closed, hover)                                              │
│ • Loading states                                                             │
│ • Pagination                                                                 │
│ → Implementation: useState, useReducer                                       │
└─────────────────────────────────────────────────────────────────────────────┘
*/

// =============================================================================
// LEVEL 1: GLOBAL STATE (Zustand pattern)
// =============================================================================

/**
 * Global store interface.
 *
 * ⚠️ AI NOTE: ONLY these types of state belong here:
 * - User authentication
 * - Theme preference
 * - Locale/language
 * - Feature flags
 *
 * DO NOT add: cart, forms, UI toggles, search queries
 */
interface GlobalState {
  // Auth
  user: { id: string; email: string } | null;
  isAuthenticated: boolean;

  // Preferences
  theme: 'light' | 'dark' | 'system';
  locale: string;

  // Feature flags
  features: Record<string, boolean>;
}

interface GlobalActions {
  setUser: (user: GlobalState['user']) => void;
  setTheme: (theme: GlobalState['theme']) => void;
  setLocale: (locale: string) => void;
  setFeature: (key: string, enabled: boolean) => void;
  logout: () => void;
}

type GlobalStore = GlobalState & GlobalActions;

/**
 * Global store implementation (Zustand).
 *
 * Usage:
 * ```typescript
 * import { create } from 'zustand';
 *
 * const useGlobalStore = create<GlobalStore>((set) => ({
 *   user: null,
 *   isAuthenticated: false,
 *   theme: 'system',
 *   locale: 'en',
 *   features: {},
 *
 *   setUser: (user) => set({ user, isAuthenticated: !!user }),
 *   setTheme: (theme) => set({ theme }),
 *   setLocale: (locale) => set({ locale }),
 *   setFeature: (key, enabled) =>
 *     set((state) => ({ features: { ...state.features, [key]: enabled } })),
 *   logout: () => set({ user: null, isAuthenticated: false }),
 * }));
 * ```
 */

// =============================================================================
// LEVEL 2: MODULE STATE (Context pattern)
// =============================================================================

/**
 * Module context pattern.
 *
 * ⚠️ AI NOTE: Use this for feature-scoped state like:
 * - Cart items
 * - Order list
 * - Search results
 * - Form wizard state
 */

// Example: Cart module context

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Cart provider - wrap at module boundary.
 *
 * Usage:
 * ```tsx
 * // In module layout or page
 * <CartProvider>
 *   <ProductList />
 *   <CartSidebar />
 * </CartProvider>
 * ```
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback(
    (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.productId === item.productId);
        if (existing) {
          return prev.map((i) =>
            i.productId === item.productId
              ? { ...i, quantity: i.quantity + (item.quantity ?? 1) }
              : i
          );
        }
        return [...prev, { ...item, quantity: item.quantity ?? 1 }];
      });
    },
    []
  );

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity } : i))
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  // ✅ Derived values use useMemo, NOT stored
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      total,
      itemCount,
    }),
    [items, addItem, removeItem, updateQuantity, clearCart, total, itemCount]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * Hook to access cart context.
 *
 * ⚠️ AI NOTE: Throws if used outside CartProvider
 */
export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}

// =============================================================================
// LEVEL 3: COMPONENT STATE (Local patterns)
// =============================================================================

/**
 * Component-local state examples.
 *
 * ⚠️ AI NOTE: These should NEVER be in global or module state:
 * - Form inputs
 * - UI toggles (modal, dropdown)
 * - Hover/focus state
 * - Loading state
 * - Pagination
 */

// Example: Product card with local state
function ProductCard_EXAMPLE({ product }: { product: { id: string; name: string; price: number } }) {
  // ✅ Local state - only this component needs it
  const [quantity, setQuantity] = useState(1);
  const [isHovered, setIsHovered] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Module state for actions
  const { addItem } = useCart();

  const handleAdd = async () => {
    setIsAdding(true);
    try {
      addItem({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity,
      });
      setQuantity(1); // Reset local state
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <h3>{product.name}</h3>
      <input
        type="number"
        min={1}
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
      />
      <button onClick={handleAdd} disabled={isAdding}>
        {isAdding ? 'Adding...' : 'Add to Cart'}
      </button>
    </div>
  );
}

// Example: Form with local state
function CheckoutForm_EXAMPLE() {
  // ✅ Form state is ALWAYS local
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    zip: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Read from module state
  const { items, total } = useCart();

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: '' })); // Clear error on change
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // ... submit logic
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={formData.address}
        onChange={handleChange('address')}
        placeholder="Address"
      />
      {/* More fields... */}
      <button type="submit" disabled={isSubmitting}>
        Pay ${total}
      </button>
    </form>
  );
}

// Example: Modal with local state
function ProductModal_EXAMPLE({ productId }: { productId: string }) {
  // ✅ UI toggle is local
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'reviews'>('details');

  return (
    <>
      <button onClick={() => setIsOpen(true)}>View Details</button>
      {isOpen && (
        <div className="modal">
          <button onClick={() => setIsOpen(false)}>Close</button>
          <div className="tabs">
            <button onClick={() => setActiveTab('details')}>Details</button>
            <button onClick={() => setActiveTab('reviews')}>Reviews</button>
          </div>
          {/* Tab content */}
        </div>
      )}
    </>
  );
}

// =============================================================================
// DECISION TREE
// =============================================================================

/**
 * State Location Decision Tree
 *
 * ```
 * Q: Is this state needed across the ENTIRE app?
 * │
 * ├─ YES → GLOBAL (Zustand/Redux)
 * │        Examples: user auth, theme, locale, feature flags
 * │
 * └─ NO
 *    │
 *    Q: Is this state needed across multiple components in a FEATURE?
 *    │
 *    ├─ YES → MODULE CONTEXT
 *    │        Examples: cart items, order list, search results
 *    │
 *    └─ NO → COMPONENT STATE (useState/useReducer)
 *            Examples: form inputs, loading, modals, hover
 * ```
 */

// =============================================================================
// ANTI-PATTERNS TO AVOID
// =============================================================================

/*
❌ WRONG: Form state in global store

const useStore = create((set) => ({
  formValues: {},  // NO! Form is component concern
  setFormValue: (k, v) => set((s) => ({ formValues: { ...s.formValues, [k]: v } })),
}));

❌ WRONG: UI toggles in Redux

dispatch({ type: 'OPEN_MODAL' });  // NO! Modal is component concern

❌ WRONG: Derived state stored

set({ total: items.reduce(...) });  // NO! Use useMemo

❌ WRONG: Global state to avoid prop drilling

// Instead of global, use module context or composition

❌ WRONG: Everything in one global store

const useStore = create((set) => ({
  user: null,          // OK - global
  cartItems: [],       // NO - module
  searchQuery: '',     // NO - component
  isModalOpen: false,  // NO - component
  formData: {},        // NO - component
}));
*/

// =============================================================================
// TEMPLATE EXPORTS
// =============================================================================

export { CartContext, ProductCard_EXAMPLE, CheckoutForm_EXAMPLE, ProductModal_EXAMPLE };
export type { GlobalState, GlobalActions, GlobalStore, CartItem, CartContextValue };
