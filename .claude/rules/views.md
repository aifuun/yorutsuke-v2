---
paths: "**/views/*.tsx"
---
# View Rules

> Views = Pure JSX rendering. Logic lives in headless hooks.

## Quick Check

### Pillar L: Separation of Concerns
- [ ] Uses headless hook: `const { state, ...actions } = useXxxLogic()`
- [ ] No `useState` for business state (only UI state like `isOpen`)
- [ ] No `useEffect` for data fetching
- [ ] No API/IPC calls directly in view

### State-Based Rendering
- [ ] Renders based on `state.status` (FSM)
- [ ] Handles all states: `idle`, `loading`, `success`, `error`
- [ ] Loading: shows spinner/skeleton
- [ ] Error: shows error message + retry action

### Pure JSX
- [ ] No business logic in event handlers
- [ ] Event handlers call actions: `onClick={() => actions.submit()}`
- [ ] No data transformation (do in headless)
- [ ] No conditional logic beyond rendering

### Component Structure
- [ ] Props are typed with interface
- [ ] Destructures props in function signature
- [ ] Returns single root element (or fragment)
- [ ] Key prop on list items

### Accessibility
- [ ] Interactive elements have labels
- [ ] Buttons have type="button" or type="submit"
- [ ] Forms have proper labels
- [ ] Focus management for modals

### Naming
- [ ] File: `{Feature}View.tsx`
- [ ] Component: `{Feature}View`
- [ ] Props: `{Feature}ViewProps`

## Core Pattern

```tsx
// Standard view pattern - copy directly
function UserView({ userId }: { userId: UserId }) {
  const { state, load, update } = useUserLogic(userId);

  // Handle all states
  if (state.status === 'loading') return <Spinner />;
  if (state.status === 'error') return <ErrorMsg onRetry={load} />;
  if (state.status === 'idle') return <Button onClick={load}>Load</Button>;

  // Success state - pure JSX
  return (
    <div>
      <h1>{state.data.name}</h1>
      <Button onClick={() => update(state.data)}>Save</Button>
    </div>
  );
}
```

## Full Resources

| Need | File | When |
|------|------|------|
| View examples | `.prot/pillar-l/headless.ts` | New view component |
| Full checklist | `.prot/pillar-l/checklist.md` | Code review |
| Detailed docs | `.prot/pillar-l/headless.md` | Uncertain implementation |

**AI**: Views are thin wrappers. All logic in headless hooks.
