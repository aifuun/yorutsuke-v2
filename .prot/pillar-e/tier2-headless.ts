/**
 * Tier 2: Headless Hook Template
 * Pattern: View → Headless → Adapter
 *
 * Use for: Forms, local state, validation
 * Pillars: A (Nominal), D (FSM), L (Headless)
 *
 * RULE: NO JSX in this file!
 */

import { useReducer, useCallback } from 'react';

// ============================================
// Types (Pillar A: Nominal Typing)
// ============================================

type ItemId = string & { readonly __brand: unique symbol };

interface CartItem {
  id: ItemId;
  name: string;
  quantity: number;
  price: number;
}

// ============================================
// State Machine (Pillar D: Explicit FSM)
// ============================================

// GOOD: Union type for states
type CartState =
  | { status: 'idle'; items: CartItem[] }
  | { status: 'loading'; items: CartItem[] }
  | { status: 'success'; items: CartItem[]; message: string }
  | { status: 'error'; items: CartItem[]; error: string };

// BAD (don't do this):
// const [isLoading, setIsLoading] = useState(false);
// const [isError, setIsError] = useState(false);

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: ItemId }
  | { type: 'START_LOADING' }
  | { type: 'SUCCESS'; message: string }
  | { type: 'ERROR'; error: string };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'START_LOADING':
      return { ...state, status: 'loading' };

    case 'ADD_ITEM':
      return {
        status: 'idle',
        items: [...state.items, action.payload],
      };

    case 'REMOVE_ITEM':
      return {
        status: 'idle',
        items: state.items.filter(item => item.id !== action.payload),
      };

    case 'SUCCESS':
      return { ...state, status: 'success', message: action.message };

    case 'ERROR':
      return { ...state, status: 'error', error: action.error };

    default:
      return state;
  }
}

// ============================================
// Headless Hook (Pillar L: No JSX)
// ============================================

interface CartLogic {
  // State
  state: CartState;
  items: CartItem[];
  isLoading: boolean;
  error: string | null;

  // Derived
  totalPrice: number;
  itemCount: number;

  // Actions
  addItem: (item: CartItem) => void;
  removeItem: (id: ItemId) => void;
  clearCart: () => void;
}

function useCartLogic(): CartLogic {
  const [state, dispatch] = useReducer(cartReducer, {
    status: 'idle',
    items: [],
  });

  // Actions
  const addItem = useCallback((item: CartItem) => {
    dispatch({ type: 'ADD_ITEM', payload: item });
  }, []);

  const removeItem = useCallback((id: ItemId) => {
    dispatch({ type: 'REMOVE_ITEM', payload: id });
  }, []);

  const clearCart = useCallback(() => {
    state.items.forEach(item => {
      dispatch({ type: 'REMOVE_ITEM', payload: item.id });
    });
  }, [state.items]);

  // Derived values (computed)
  const totalPrice = state.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const itemCount = state.items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  // Return data + functions, NEVER JSX
  return {
    state,
    items: state.items,
    isLoading: state.status === 'loading',
    error: state.status === 'error' ? state.error : null,
    totalPrice,
    itemCount,
    addItem,
    removeItem,
    clearCart,
  };
}

// ============================================
// Type Helper
// ============================================

function toItemId(raw: string): ItemId {
  return raw as ItemId;
}

export { useCartLogic, cartReducer, toItemId };
export type { CartState, CartAction, CartItem, CartLogic, ItemId };
