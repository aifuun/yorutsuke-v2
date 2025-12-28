---
paths: "**/headless/*.ts"
---
# Headless Hook Rules

> Headless = Logic without UI. Returns data + actions, never JSX.

## Quick Check

### Pillar L: No JSX
- [ ] Returns `{ state, ...actions }` pattern
- [ ] No JSX or React elements returned
- [ ] No `className`, `style`, or UI props
- [ ] Can be tested without React Testing Library

### Pillar D: FSM State
- [ ] State is union type: `'idle' | 'loading' | 'success' | 'error'`
- [ ] No boolean flag pairs (`isLoading` + `isError`)
- [ ] State transitions explicit via `dispatch` or setter
- [ ] Impossible states are unrepresentable

### Hook Structure
- [ ] Uses `useReducer` for complex state (not `useState`)
- [ ] Actions are functions, not raw `dispatch`
- [ ] Side effects in `useEffect`, not in actions
- [ ] Cleanup in `useEffect` return

### Dependencies
- [ ] Calls adapters for IO (not direct fetch)
- [ ] No DOM manipulation
- [ ] No `window` or `document` access

### Naming
- [ ] File: `use{Feature}Logic.ts`
- [ ] Hook: `use{Feature}Logic()`
- [ ] Returns: `{ state, action1, action2, ... }`

## Core Pattern

```typescript
// Standard headless hook - copy directly
type State = { status: 'idle' | 'loading' | 'success' | 'error'; data?: User };

function useUserLogic(userId: UserId) {
  const [state, setState] = useState<State>({ status: 'idle' });

  const load = async () => {
    setState({ status: 'loading' });
    try {
      const data = await userApi.fetchUser(userId);
      setState({ status: 'success', data });
    } catch {
      setState({ status: 'error' });
    }
  };

  return { state, load };  // Data + actions, no JSX
}
```

## Full Resources

| Need | File | When |
|------|------|------|
| Complete template | `.prot/pillar-l/headless.ts` | New headless hook |
| FSM reducer | `.prot/pillar-d/fsm-reducer.ts` | Complex state machine |
| Full checklist | `.prot/pillar-l/checklist.md` | Code review |
| Detailed docs | `.prot/pillar-l/headless.md` | Uncertain implementation |

**AI**: When creating new headless hook, Read `.prot/pillar-l/headless.ts` first.
