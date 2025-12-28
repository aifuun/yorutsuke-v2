# Pillar L: Headless Abstraction

> Separate business logic from UI presentation

## Rule

Business logic must be separated from UI rendering:
- **Headless Layer**: Framework primitives allowed, JSX **FORBIDDEN**
- **View Layer**: Renders UI, delegates logic to headless hooks

## Purpose

- Enable logic reuse across different UIs
- Test logic without DOM/rendering
- Clear separation of concerns
- Support multiple frontends (web, mobile, CLI)

## Implementation

### Layer Separation

```
┌─────────────────────────────────────────────────────────┐
│ HEADLESS LAYER (Logic)                                   │
│                                                          │
│ ✅ Allowed:                                              │
│    • React hooks (useState, useEffect, useReducer)       │
│    • Framework primitives                                │
│    • Business logic                                      │
│    • State management                                    │
│    • API calls                                          │
│                                                          │
│ ❌ Forbidden:                                            │
│    • JSX / HTML                                          │
│    • CSS / Styling                                       │
│    • DOM manipulation                                    │
│    • Rendering components                                │
└─────────────────────────────────────────────────────────┘
                         │
                         │ Returns data + functions
                         ▼
┌─────────────────────────────────────────────────────────┐
│ VIEW LAYER (Presentation)                                │
│                                                          │
│ ✅ Allowed:                                              │
│    • JSX / HTML                                          │
│    • CSS / Styling                                       │
│    • Layout components                                   │
│    • Event handlers (delegating to headless)             │
│                                                          │
│ ❌ Forbidden:                                            │
│    • Business logic                                      │
│    • Complex state management                            │
│    • Direct API calls                                    │
└─────────────────────────────────────────────────────────┘
```

### Headless Hook

```typescript
// headless/useProductSearch.ts
// ✅ NO JSX in this file!

import { useState, useCallback, useMemo } from 'react';
import { productApi } from '../adapters/productApi';
import type { Product, ProductId } from '../types';

type SearchState =
  | { status: 'idle' }
  | { status: 'searching'; query: string }
  | { status: 'success'; products: Product[] }
  | { status: 'error'; error: string };

interface ProductSearchLogic {
  // State
  state: SearchState;
  products: Product[];
  isSearching: boolean;
  error: string | null;

  // Derived
  hasResults: boolean;
  resultCount: number;

  // Actions
  search: (query: string) => Promise<void>;
  clear: () => void;
  selectProduct: (id: ProductId) => void;
}

export function useProductSearch(): ProductSearchLogic {
  const [state, setState] = useState<SearchState>({ status: 'idle' });

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setState({ status: 'idle' });
      return;
    }

    setState({ status: 'searching', query });

    try {
      const products = await productApi.search(query);
      setState({ status: 'success', products });
    } catch (error) {
      setState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Search failed',
      });
    }
  }, []);

  const clear = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  const selectProduct = useCallback((id: ProductId) => {
    // Selection logic...
  }, []);

  // Derived values
  const products = state.status === 'success' ? state.products : [];
  const hasResults = products.length > 0;
  const resultCount = products.length;

  return {
    state,
    products,
    isSearching: state.status === 'searching',
    error: state.status === 'error' ? state.error : null,
    hasResults,
    resultCount,
    search,
    clear,
    selectProduct,
  };
}
```

### View Component

```typescript
// views/ProductSearchView.tsx
// ✅ JSX here, logic delegated to hook

import { useProductSearch } from '../headless/useProductSearch';
import { ProductCard } from './ProductCard';
import { SearchInput } from '@/modules/shared';

export function ProductSearchView() {
  const {
    products,
    isSearching,
    error,
    hasResults,
    resultCount,
    search,
    clear,
  } = useProductSearch();

  return (
    <div className="product-search">
      <SearchInput
        onSearch={search}
        onClear={clear}
        isLoading={isSearching}
      />

      {error && <div className="error">{error}</div>}

      {hasResults && (
        <>
          <p>{resultCount} products found</p>
          <div className="product-grid">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}

      {!hasResults && !isSearching && (
        <p>No products found</p>
      )}
    </div>
  );
}
```

### Testing Headless Logic

```typescript
// headless/useProductSearch.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProductSearch } from './useProductSearch';

// No DOM needed!
describe('useProductSearch', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useProductSearch());
    expect(result.current.state.status).toBe('idle');
  });

  it('searches and returns products', async () => {
    const { result } = renderHook(() => useProductSearch());

    act(() => {
      result.current.search('laptop');
    });

    expect(result.current.isSearching).toBe(true);

    await waitFor(() => {
      expect(result.current.state.status).toBe('success');
    });

    expect(result.current.hasResults).toBe(true);
  });
});
```

## Good Example

```typescript
// ✅ Clean separation

// headless/useCart.ts - Logic only
export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (item: CartItem) => { /* logic */ };
  const removeItem = (id: ItemId) => { /* logic */ };
  const total = items.reduce((sum, i) => sum + i.price, 0);

  return { items, addItem, removeItem, total };
  // Returns data/functions, NO JSX
}

// views/CartView.tsx - Presentation only
export function CartView() {
  const { items, removeItem, total } = useCart();

  return (
    <div>
      {items.map(item => (
        <CartItemRow
          key={item.id}
          item={item}
          onRemove={() => removeItem(item.id)}
        />
      ))}
      <p>Total: ${total}</p>
    </div>
  );
}
```

## Bad Example

```typescript
// ❌ Logic and UI mixed in hook
function useCart() {
  const [items, setItems] = useState([]);

  // ❌ JSX in headless hook!
  const renderItem = (item) => (
    <div className="item">
      <span>{item.name}</span>
      <button onClick={() => remove(item.id)}>X</button>
    </div>
  );

  // ❌ Returning JSX
  return { items, renderItem };
}

// ❌ Logic in view component
function CartView() {
  const [items, setItems] = useState([]);

  // ❌ Business logic in view
  const calculateDiscount = () => {
    if (items.length > 5) return 0.1;
    return 0;
  };

  // ❌ API call in view
  useEffect(() => {
    fetch('/api/cart').then(/* ... */);
  }, []);

  return <div>...</div>;
}
```

## Anti-Patterns

1. **JSX in headless hooks**
   ```typescript
   // ❌ Hooks should not return JSX
   return { renderButton: () => <Button /> };
   ```

2. **Business logic in views**
   ```typescript
   // ❌ Views should only render
   const discount = items.length > 5 ? 0.1 : 0;
   ```

3. **Direct API calls in views**
   ```typescript
   // ❌ Use headless hook or adapter
   useEffect(() => { fetch('/api/...') }, []);
   ```

4. **Styling logic in headless**
   ```typescript
   // ❌ Styling is presentation concern
   const buttonClass = isActive ? 'btn-active' : 'btn';
   ```

## Exceptions

- Simple presentational components without logic
- Third-party component wrappers

## Checklist

- [ ] Headless files contain NO JSX/HTML
- [ ] Views delegate all logic to headless hooks
- [ ] Headless hooks are unit testable without DOM
- [ ] Business calculations in headless, not views
- [ ] API calls through adapters, called from headless
- [ ] State management in headless hooks

## References

- Related: Pillar D (FSM) - state in headless
- Related: Pillar K (Testing) - test headless separately
- Pattern: Headless UI, Render Props, Compound Components

## Assets

- Template: `.prot/pillar-l/headless.ts`
- Checklist: `.prot/pillar-l/checklist.md`
- Audit: `.prot/pillar-l/audit.ts`
