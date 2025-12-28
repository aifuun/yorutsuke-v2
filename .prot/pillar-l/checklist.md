# Pillar L: Headless Abstraction Checklist

> Use this checklist when creating or reviewing hooks and view components

## AI-First Principles

| Principle | Application |
|-----------|-------------|
| **Separation of Concerns** | Logic in headless, UI in views |
| **Testability** | Headless hooks testable without DOM |
| **Reusability** | Same logic, different UIs (web/mobile/CLI) |

## Headless Hook Creation

### 1. File Location

```
src/02_modules/{module}/
├── headless/
│   ├── use{Entity}Logic.ts     # ✅ Logic hook
│   └── use{Entity}ListLogic.ts # ✅ List logic
└── views/
    └── {Entity}View.tsx        # ✅ UI component
```

- [ ] Headless hooks in `headless/` directory
- [ ] File name follows `use{Entity}Logic.ts` pattern
- [ ] Exported from module `index.ts`

### 2. Hook Interface

```typescript
interface {Entity}Logic {
  // State
  state: {Entity}State;
  entity: {Entity} | null;

  // Derived values
  isLoading: boolean;
  error: string | null;

  // Actions
  fetch: (id: {Entity}Id) => Promise<void>;
  save: (data: Partial<{Entity}>) => Promise<void>;
}
```

- [ ] Interface defined with explicit types
- [ ] State uses discriminated union (Pillar D)
- [ ] Derived values computed from state
- [ ] Actions are async functions

### 3. Implementation Rules

- [ ] Uses `useReducer` for complex state
- [ ] Uses `useCallback` for all actions
- [ ] Uses `useMemo` for expensive derived values
- [ ] NO JSX anywhere in the file
- [ ] NO render functions returned
- [ ] NO component references

## Headless Hook Verification

### What IS Allowed

```typescript
// ✅ React hooks
useState, useReducer, useCallback, useMemo, useEffect, useRef

// ✅ Framework primitives
useContext, useId

// ✅ Business logic
const canEdit = entity.status !== 'archived';
const total = items.reduce((sum, i) => sum + i.price, 0);

// ✅ API calls (via adapters)
const data = await entityApi.get(id);

// ✅ State transitions
dispatch({ type: 'FETCH_SUCCESS', data });
```

### What is FORBIDDEN

```typescript
// ❌ JSX elements
return <div>{entity.name}</div>;

// ❌ Render functions
const renderItem = () => <Item />;

// ❌ CSS/Styling
const className = isActive ? 'active' : '';

// ❌ DOM manipulation
document.getElementById('...');

// ❌ Component references
return { Button, Modal };
```

## View Component Verification

### What IS Allowed

```typescript
// ✅ JSX rendering
return <div>{entity.name}</div>;

// ✅ Event handlers (delegating to hook)
<button onClick={() => save(data)}>Save</button>

// ✅ Conditional rendering
{isLoading && <Spinner />}

// ✅ Mapping data to components
{items.map(item => <ItemCard key={item.id} item={item} />)}

// ✅ Styling
<div className={styles.container}>
```

### What is FORBIDDEN

```typescript
// ❌ Business logic
const discount = items.length > 5 ? 0.1 : 0;

// ❌ Complex state management
const [items, setItems] = useState([]);
const addItem = (item) => setItems([...items, item]);

// ❌ Direct API calls
useEffect(() => { fetch('/api/...') }, []);

// ❌ Data transformations
const sortedItems = [...items].sort((a, b) => a.price - b.price);
```

## Code Review Checklist

### Headless Hook Review

- [ ] File has NO `<` or `/>` characters (no JSX)
- [ ] No `className`, `style`, or CSS imports
- [ ] No `document.` or `window.` calls
- [ ] Returns object with data + functions only
- [ ] All functions wrapped in `useCallback`
- [ ] State uses FSM pattern (Pillar D)

### View Component Review

- [ ] All logic comes from headless hook
- [ ] No `useState` for business state
- [ ] No `useEffect` for data fetching
- [ ] No calculations or transformations
- [ ] Only renders what hook provides

## Common Patterns

### Entity Detail

```typescript
// headless/useEntityLogic.ts
function useEntityLogic(id: EntityId) {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });

  const fetch = useCallback(async () => {
    dispatch({ type: 'FETCH_START' });
    const data = await api.get(id);
    dispatch({ type: 'FETCH_SUCCESS', data });
  }, [id]);

  return {
    entity: state.data,
    isLoading: state.status === 'loading',
    fetch,
  };
}

// views/EntityView.tsx
function EntityView({ id }) {
  const { entity, isLoading, fetch } = useEntityLogic(id);

  useEffect(() => { fetch(); }, [fetch]);

  if (isLoading) return <Spinner />;
  return <div>{entity.name}</div>;
}
```

### Entity List with Pagination

```typescript
// headless/useEntityListLogic.ts
function useEntityListLogic() {
  return {
    items,
    page,
    totalPages,
    hasNextPage: page < totalPages,
    nextPage: () => loadPage(page + 1),
    prevPage: () => loadPage(page - 1),
  };
}

// views/EntityListView.tsx
function EntityListView() {
  const { items, hasNextPage, nextPage, prevPage } = useEntityListLogic();

  return (
    <>
      {items.map(item => <EntityRow key={item.id} item={item} />)}
      <button onClick={prevPage}>Prev</button>
      <button onClick={nextPage} disabled={!hasNextPage}>Next</button>
    </>
  );
}
```

### Form with Validation

```typescript
// headless/useEntityFormLogic.ts
function useEntityFormLogic(entity: Entity) {
  const [values, setValues] = useState(entity);
  const [errors, setErrors] = useState({});

  const validate = useCallback(() => {
    const newErrors = {};
    if (!values.name) newErrors.name = 'Required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [values]);

  const setValue = useCallback((field, value) => {
    setValues(prev => ({ ...prev, [field]: value }));
  }, []);

  return { values, errors, setValue, validate, isValid: !Object.keys(errors).length };
}
```

## Common Mistakes

| Pattern | Problem | Fix |
|---------|---------|-----|
| `return <Button onClick={...} />` | JSX in headless | Return function, not JSX |
| `const renderItem = () => <Item />` | Render function | Return data, map in view |
| `const discount = total > 100 ? 0.1 : 0;` (in view) | Logic in view | Move to headless |
| `useEffect(() => fetch(...))` (in view) | API call in view | Call from headless |
| `className={isActive ? 'on' : 'off'}` (in headless) | Styling in headless | Move to view |

## Testing Headless Hooks

```typescript
// headless/useEntityLogic.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEntityLogic } from './useEntityLogic';

describe('useEntityLogic', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useEntityLogic());
    expect(result.current.state.status).toBe('idle');
  });

  it('fetches entity', async () => {
    const { result } = renderHook(() => useEntityLogic());

    act(() => {
      result.current.fetch('entity_123' as EntityId);
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.entity).not.toBeNull();
    });
  });

  it('computes derived values', () => {
    // Test canEdit, canDelete, etc.
  });
});
```

- [ ] Test state transitions
- [ ] Test derived values
- [ ] Test action effects
- [ ] No DOM needed for tests

## Verification Commands

```bash
# Find JSX in headless files
grep -r "return.*<" src/**/headless/*.ts

# Find render functions
grep -r "render[A-Z]" src/**/headless/*.ts

# Run Pillar L audit
npx tsx .prot/pillar-l/audit.ts
```

## Template Reference

- Headless hook: `.prot/pillar-l/headless.ts`
- Related: Pillar D (FSM for state)
- Related: Pillar I (Module boundaries)
