# Pillar D: Explicit FSM Checklist

> Use this checklist when creating stateful components or reviewing state management

## AI-First Principles

| Principle | Application |
|-----------|-------------|
| **Union > Flags** | Use discriminated unions, not boolean flags |
| **Explicit > Implicit** | Each state variant has exactly its required data |
| **Copy > Abstract** | Copy RequestState/FormState patterns directly |

## When Creating New Stateful Feature

### 1. Identify State Variants

```typescript
// List ALL possible states explicitly
type MyState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: Data }
  | { status: 'error'; error: string };
```

- [ ] All states have a discriminator field (`status` or `step`)
- [ ] Each variant contains exactly the data it needs
- [ ] No optional fields that "might" be there
- [ ] Impossible states cannot be represented

### 2. Define Actions

```typescript
type MyAction =
  | { type: 'START' }
  | { type: 'SUCCESS'; data: Data }
  | { type: 'ERROR'; error: string }
  | { type: 'RESET' };
```

- [ ] Each action has a `type` discriminator
- [ ] Action payloads are typed explicitly
- [ ] All transitions are represented

### 3. Create Reducer

```typescript
function myReducer(state: MyState, action: MyAction): MyState {
  switch (action.type) {
    case 'START': return { status: 'loading' };
    case 'SUCCESS': return { status: 'success', data: action.data };
    case 'ERROR': return { status: 'error', error: action.error };
    case 'RESET': return { status: 'idle' };
    default: return state;
  }
}
```

- [ ] Switch covers all action types
- [ ] Each case returns complete state object
- [ ] No mutation of existing state
- [ ] Default case returns unchanged state

### 4. Use in Component

```typescript
switch (state.status) {
  case 'idle': return <Button>Start</Button>;
  case 'loading': return <Spinner />;
  case 'success': return <View data={state.data} />;
  case 'error': return <Error message={state.error} />;
}
```

- [ ] Switch handles all status values
- [ ] TypeScript narrows type in each branch
- [ ] Data access is type-safe (no `!` or `as`)

## Code Review Checklist

### No Boolean Flags

- [ ] No `isLoading`, `isError`, `isSuccess` flags
- [ ] No multiple `useState` for related state
- [ ] No `useState<string>` for status (loose typing)

### Proper Union Types

- [ ] State is a discriminated union type
- [ ] Action is a discriminated union type
- [ ] Each variant has exactly needed fields

### Type Safety

- [ ] No `state.data!` (non-null assertion)
- [ ] No `state.data as Data` (type assertion)
- [ ] No `state.error ?? ''` for optional error

### Component Rendering

- [ ] Switch statement or conditional rendering per status
- [ ] All branches handled explicitly
- [ ] No impossible state combinations rendered

## Common Patterns

### Request State (API Calls)

```typescript
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };
```

### Form State

```typescript
type FormState =
  | { status: 'editing'; data: FormData; errors: Errors }
  | { status: 'submitting'; data: FormData }
  | { status: 'submitted'; message: string }
  | { status: 'failed'; data: FormData; error: string };
```

### Wizard/Multi-Step

```typescript
type WizardState =
  | { step: 'one'; data: Partial<StepOne> }
  | { step: 'two'; stepOne: StepOne; data: Partial<StepTwo> }
  | { step: 'complete'; all: StepOne & StepTwo };
```

## Common Mistakes

| Pattern | Problem | Fix |
|---------|---------|-----|
| `useState(false)` for loading | Can conflict with error state | Use union type |
| `data?: Data` optional field | Unclear when data exists | Move to success variant |
| `status: string` | No type checking for typos | Use literal union |
| Multiple useState | States can conflict | Single useReducer |

## File Organization

```
src/02_modules/{feature}/
├── headless/
│   ├── types.ts          # State & Action types
│   ├── reducer.ts        # Reducer function
│   └── use{Feature}Logic.ts  # Hook using reducer
```

## Exceptions

These patterns are acceptable:

- [ ] Simple `isOpen` boolean for modals (single flag)
- [ ] `isExpanded` for accordion items (single flag)
- [ ] External library requires boolean interface

## Template Reference

Copy from: `.prot/pillar-d/fsm-reducer.ts`
