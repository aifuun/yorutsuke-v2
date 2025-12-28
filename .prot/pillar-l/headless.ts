/**
 * Pillar L: Headless Abstraction Template
 *
 * Separate business logic from UI presentation.
 *
 * ⚠️ AI DEVELOPMENT NOTE:
 * - COPY this pattern for new feature hooks
 * - Headless hooks MUST NOT contain JSX
 * - Return data + functions, NEVER return JSX elements
 * - All business logic goes in headless, views only render
 */

import { useState, useReducer, useCallback, useMemo } from 'react';

// =============================================================================
// TYPES (Pillar A: Nominal Typing)
// =============================================================================

type EntityId = string & { readonly __brand: 'EntityId' };

interface Entity {
  id: EntityId;
  name: string;
  status: EntityStatus;
  createdAt: Date;
}

// Pillar D: FSM states
type EntityStatus = 'draft' | 'active' | 'archived';

// =============================================================================
// STATE MACHINE (Pillar D: Explicit FSM)
// =============================================================================

/**
 * State definition for headless hook.
 *
 * ⚠️ AI NOTE: Use discriminated union, NOT boolean flags
 */
type EntityState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: Entity }
  | { status: 'error'; error: string }
  | { status: 'saving' }
  | { status: 'deleting' };

type EntityAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; data: Entity }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; data: Entity }
  | { type: 'SAVE_ERROR'; error: string }
  | { type: 'DELETE_START' }
  | { type: 'DELETE_SUCCESS' }
  | { type: 'RESET' };

function entityReducer(state: EntityState, action: EntityAction): EntityState {
  switch (action.type) {
    case 'FETCH_START':
      return { status: 'loading' };
    case 'FETCH_SUCCESS':
      return { status: 'success', data: action.data };
    case 'FETCH_ERROR':
      return { status: 'error', error: action.error };
    case 'SAVE_START':
      return { status: 'saving' };
    case 'SAVE_SUCCESS':
      return { status: 'success', data: action.data };
    case 'SAVE_ERROR':
      return { status: 'error', error: action.error };
    case 'DELETE_START':
      return { status: 'deleting' };
    case 'DELETE_SUCCESS':
      return { status: 'idle' };
    case 'RESET':
      return { status: 'idle' };
    default:
      return state;
  }
}

// =============================================================================
// HEADLESS HOOK INTERFACE
// =============================================================================

/**
 * Public interface for headless hook.
 *
 * ⚠️ AI NOTE:
 * - ONLY data and functions
 * - NO JSX elements
 * - NO render functions
 * - NO component references
 */
interface EntityLogic {
  // State
  state: EntityState;
  entity: Entity | null;

  // Derived values (computed from state)
  isLoading: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  error: string | null;
  canEdit: boolean;
  canDelete: boolean;

  // Actions (functions that modify state)
  fetch: (id: EntityId) => Promise<void>;
  save: (data: Partial<Entity>) => Promise<void>;
  remove: () => Promise<void>;
  reset: () => void;
}

// =============================================================================
// HEADLESS HOOK IMPLEMENTATION
// =============================================================================

/**
 * Headless hook for entity management.
 *
 * ⚠️ AI NOTE:
 * - NO JSX in this function
 * - NO styling logic
 * - NO DOM manipulation
 * - Returns ONLY data and functions
 */
function useEntityLogic(initialId?: EntityId): EntityLogic {
  const [state, dispatch] = useReducer(entityReducer, { status: 'idle' });

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const fetch = useCallback(async (id: EntityId) => {
    dispatch({ type: 'FETCH_START' });

    try {
      // Call adapter (Pillar I: through module API)
      const response = await entityApi.get(id);
      dispatch({ type: 'FETCH_SUCCESS', data: response });
    } catch (error) {
      dispatch({
        type: 'FETCH_ERROR',
        error: error instanceof Error ? error.message : 'Failed to fetch',
      });
    }
  }, []);

  const save = useCallback(async (data: Partial<Entity>) => {
    if (state.status !== 'success') return;

    dispatch({ type: 'SAVE_START' });

    try {
      const updated = await entityApi.update(state.data.id, data);
      dispatch({ type: 'SAVE_SUCCESS', data: updated });
    } catch (error) {
      dispatch({
        type: 'SAVE_ERROR',
        error: error instanceof Error ? error.message : 'Failed to save',
      });
    }
  }, [state]);

  const remove = useCallback(async () => {
    if (state.status !== 'success') return;

    dispatch({ type: 'DELETE_START' });

    try {
      await entityApi.delete(state.data.id);
      dispatch({ type: 'DELETE_SUCCESS' });
    } catch (error) {
      dispatch({
        type: 'SAVE_ERROR',
        error: error instanceof Error ? error.message : 'Failed to delete',
      });
    }
  }, [state]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // -------------------------------------------------------------------------
  // Derived Values
  // -------------------------------------------------------------------------

  const entity = state.status === 'success' ? state.data : null;
  const isLoading = state.status === 'loading';
  const isSaving = state.status === 'saving';
  const isDeleting = state.status === 'deleting';
  const error = state.status === 'error' ? state.error : null;

  // Business logic for permissions
  const canEdit = entity !== null && entity.status !== 'archived';
  const canDelete = entity !== null && entity.status === 'draft';

  // -------------------------------------------------------------------------
  // Return Interface
  // -------------------------------------------------------------------------

  return {
    state,
    entity,
    isLoading,
    isSaving,
    isDeleting,
    error,
    canEdit,
    canDelete,
    fetch,
    save,
    remove,
    reset,
  };
}

// =============================================================================
// MOCK ADAPTER (Replace with real implementation)
// =============================================================================

const entityApi = {
  async get(id: EntityId): Promise<Entity> {
    // Replace with actual API call
    return {} as Entity;
  },
  async update(id: EntityId, data: Partial<Entity>): Promise<Entity> {
    return {} as Entity;
  },
  async delete(id: EntityId): Promise<void> {
    // Delete logic
  },
};

// =============================================================================
// HEADLESS LIST HOOK (Pillar D: FSM Pattern)
// =============================================================================

/**
 * List state using FSM pattern.
 *
 * ⚠️ AI NOTE: Use discriminated union, NOT boolean flags
 */
type ListState<T> =
  | { status: 'idle'; items: T[]; page: number; totalPages: number }
  | { status: 'loading'; items: T[]; page: number; totalPages: number }
  | { status: 'success'; items: T[]; page: number; totalPages: number }
  | { status: 'error'; items: T[]; page: number; totalPages: number; error: string };

type ListAction<T> =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; items: T[]; page: number; totalPages: number }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'RESET' };

function listReducer<T>(state: ListState<T>, action: ListAction<T>): ListState<T> {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, status: 'loading' };
    case 'LOAD_SUCCESS':
      return {
        status: 'success',
        items: action.items,
        page: action.page,
        totalPages: action.totalPages,
      };
    case 'LOAD_ERROR':
      return { ...state, status: 'error', error: action.error };
    case 'RESET':
      return { status: 'idle', items: [], page: 1, totalPages: 1 };
    default:
      return state;
  }
}

/**
 * Headless hook for entity list with pagination.
 *
 * ⚠️ AI NOTE: Same rules - NO JSX, ONLY data + functions
 */
interface EntityListLogic {
  // State (FSM)
  state: ListState<Entity>;
  items: Entity[];

  // Derived from FSM status
  isLoading: boolean;
  error: string | null;

  // Pagination
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;

  // Filter/Sort (separate from FSM - UI preferences)
  filter: string;
  sortBy: keyof Entity;
  sortOrder: 'asc' | 'desc';

  // Actions
  loadPage: (page: number) => Promise<void>;
  nextPage: () => void;
  prevPage: () => void;
  setFilter: (filter: string) => void;
  setSort: (field: keyof Entity, order: 'asc' | 'desc') => void;
  refresh: () => Promise<void>;
}

function useEntityListLogic(): EntityListLogic {
  // FSM for async state (Pillar D)
  const [state, dispatch] = useReducer(listReducer<Entity>, {
    status: 'idle',
    items: [],
    page: 1,
    totalPages: 1,
  });

  // UI preferences (not async state, so useState is acceptable)
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<keyof Entity>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const loadPage = useCallback(async (pageNum: number) => {
    dispatch({ type: 'LOAD_START' });

    try {
      const response = await entityApi.list({ page: pageNum, filter, sortBy, sortOrder });
      dispatch({
        type: 'LOAD_SUCCESS',
        items: response.items,
        page: pageNum,
        totalPages: response.totalPages,
      });
    } catch (e) {
      dispatch({
        type: 'LOAD_ERROR',
        error: e instanceof Error ? e.message : 'Failed to load',
      });
    }
  }, [filter, sortBy, sortOrder]);

  const nextPage = useCallback(() => {
    if (state.page < state.totalPages) loadPage(state.page + 1);
  }, [state.page, state.totalPages, loadPage]);

  const prevPage = useCallback(() => {
    if (state.page > 1) loadPage(state.page - 1);
  }, [state.page, loadPage]);

  const setSort = useCallback((field: keyof Entity, order: 'asc' | 'desc') => {
    setSortBy(field);
    setSortOrder(order);
  }, []);

  const refresh = useCallback(() => loadPage(state.page), [state.page, loadPage]);

  // Derived values from FSM
  const isLoading = state.status === 'loading';
  const error = state.status === 'error' ? state.error : null;

  return {
    state,
    items: state.items,
    isLoading,
    error,
    page: state.page,
    totalPages: state.totalPages,
    hasNextPage: state.page < state.totalPages,
    hasPrevPage: state.page > 1,
    filter,
    sortBy,
    sortOrder,
    loadPage,
    nextPage,
    prevPage,
    setFilter,
    setSort,
    refresh,
  };
}

// Mock list API
Object.assign(entityApi, {
  list: async (params: { page: number; filter: string; sortBy: string; sortOrder: string }) => {
    return { items: [] as Entity[], totalPages: 1 };
  },
});

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/*
// ✅ CORRECT: View uses headless hook

// views/EntityView.tsx
import { useEntityLogic } from '../headless/useEntityLogic';

function EntityView({ id }: { id: EntityId }) {
  const {
    entity,
    isLoading,
    error,
    canEdit,
    save,
    remove,
  } = useEntityLogic(id);

  // View ONLY renders - all logic is in headless
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!entity) return <NotFound />;

  return (
    <div className="entity-view">
      <h1>{entity.name}</h1>
      <StatusBadge status={entity.status} />

      {canEdit && (
        <button onClick={() => save({ name: 'New Name' })}>
          Edit
        </button>
      )}
    </div>
  );
}


// ❌ WRONG: JSX in headless hook

function useEntityBad() {
  const [entity, setEntity] = useState<Entity | null>(null);

  // ❌ FORBIDDEN: JSX in headless
  const renderEntity = () => (
    <div className="entity">
      <h1>{entity?.name}</h1>
    </div>
  );

  // ❌ FORBIDDEN: Returning render function
  return { entity, renderEntity };
}


// ❌ WRONG: Logic in view component

function EntityViewBad({ id }: { id: EntityId }) {
  const [entity, setEntity] = useState<Entity | null>(null);

  // ❌ FORBIDDEN: Business logic in view
  const canEdit = entity?.status !== 'archived';

  // ❌ FORBIDDEN: API call directly in view
  useEffect(() => {
    fetch(`/api/entities/${id}`)
      .then(res => res.json())
      .then(setEntity);
  }, [id]);

  // ❌ FORBIDDEN: Complex state management in view
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});

  return <div>...</div>;
}
*/

// =============================================================================
// TEMPLATE FOR NEW HEADLESS HOOK
// =============================================================================

/*
⚠️ AI: Copy this template when creating a new headless hook:

1. Create file: src/02_modules/{module}/headless/use{Entity}Logic.ts

2. Define types:
   type {Entity}State =
     | { status: 'idle' }
     | { status: 'loading' }
     | { status: 'success'; data: {Entity} }
     | { status: 'error'; error: string };

3. Define interface:
   interface {Entity}Logic {
     // State
     state: {Entity}State;
     entity: {Entity} | null;

     // Derived
     isLoading: boolean;
     error: string | null;

     // Actions
     fetch: (id: {Entity}Id) => Promise<void>;
     save: (data: Partial<{Entity}>) => Promise<void>;
   }

4. Implement hook:
   function use{Entity}Logic(): {Entity}Logic {
     // Use useReducer for state
     // Use useCallback for actions
     // Return ONLY data and functions
   }

5. Export from module index.ts:
   export { use{Entity}Logic } from './headless/use{Entity}Logic';

6. Verify:
   - NO JSX in file
   - NO render functions
   - Returns plain data/functions
*/

export { useEntityLogic, useEntityListLogic, entityReducer, listReducer };
export type { Entity, EntityId, EntityState, EntityAction, EntityLogic, EntityListLogic, ListState, ListAction };
