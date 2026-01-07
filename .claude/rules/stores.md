---
paths: "**/stores/*.ts"
---
# Zustand Store Rules

> Stores = Zustand vanilla stores (outside React). State definition and actions.

## Quick Check

### Pillar D: FSM State
- [ ] Status is union type: `'idle' | 'processing' | 'error'`
- [ ] No boolean flag pairs (`isLoading` + `hasError`)
- [ ] State transitions via named actions, not direct setState

### Structure
- [ ] Use `createStore` from `zustand/vanilla` (not `create`)
- [ ] Separate `State` interface from `Actions` interface
- [ ] Export combined type: `type XxxStore = XxxState & XxxActions`
- [ ] Export singleton instance: `export const xxxStore = createStore<XxxStore>(...)`

### Actions
- [ ] Actions are synchronous state updates only
- [ ] No async operations in store (do in Service layer)
- [ ] Use `set()` for updates, `get()` for sync reads
- [ ] Provide getter actions for Service access: `getXxx: () => get().xxx`

### Immutability
- [ ] Never mutate state directly
- [ ] Use spread: `set((s) => ({ queue: [...s.queue, item] }))`
- [ ] Helper functions for complex updates

## Core Pattern

```typescript
import { createStore } from 'zustand/vanilla';

// 1. State interface (Pillar D: FSM)
export type Status = 'idle' | 'processing' | 'success' | 'error';

export interface XxxState {
  status: Status;
  items: Item[];
  currentId: ItemId | null;
}

// 2. Actions interface
export interface XxxActions {
  addItem: (item: Item) => void;
  setStatus: (status: Status) => void;
  // Getters for Service layer
  getItems: () => Item[];
  getStatus: () => Status;
}

// 3. Combined type
export type XxxStore = XxxState & XxxActions;

// 4. Create vanilla store
export const xxxStore = createStore<XxxStore>((set, get) => ({
  // Initial state
  status: 'idle',
  items: [],
  currentId: null,

  // Actions
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  setStatus: (status) => set({ status }),

  // Getters
  getItems: () => get().items,
  getStatus: () => get().status,
}));
```

## Anti-Patterns

```typescript
// ❌ Using React's create() instead of vanilla
import { create } from 'zustand';  // WRONG for stores/

// ❌ Async in store
addItem: async (item) => {
  await db.save(item);  // WRONG - do in Service
  set(...);
}

// ❌ Boolean flags
interface State {
  isLoading: boolean;
  hasError: boolean;  // WRONG - use FSM status
}
```

## Relationship with Other Layers

```
Service → Store.action()     # Service calls store actions
Service → Store.getXxx()     # Service reads via getters
Hook → useStore(store)       # React bridge (see zustand-hooks.md)
```

**AI**: Stores are pure state containers. All IO operations belong in Services.
