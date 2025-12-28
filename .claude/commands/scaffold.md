# Scaffold

Generate project structure from `.prot/STRUCTURE.md` specification.

## Usage

```
*scaffold                     # Generate base project structure
*scaffold module <name>       # Generate feature module
*scaffold module <name> --t1  # Generate T1 module (adapters + views)
*scaffold module <name> --t2  # Generate T2 module (+ headless)
*scaffold module <name> --t3  # Generate T3 module (+ workflows)
*scaffold domain <name>       # Generate domain directory
*scaffold docs                # Generate docs/ with templates
```

## Workflow

### Base Project Structure

1. Read `.prot/STRUCTURE.md` for complete directory layout
2. Create missing directories:
   ```
   src/00_kernel/{context,telemetry,types}/
   src/01_domains/
   src/02_modules/
   src/03_migrations/
   src-tauri/src/commands/
   infra/lib/{stacks,constructs,config}/
   tests/{unit,integration,e2e}/
   docs/
   ```
3. Report created directories

### Module Generation

1. Determine tier (default: T2)
2. Create module directory: `src/02_modules/{name}/`
3. Generate files based on tier:

   **T1 (Direct)**:
   ```
   {name}/
   ├── adapters/{name}Api.ts     # Copy from .prot/pillar-b/airlock.ts
   ├── views/{Name}View.tsx      # Basic view skeleton
   └── index.ts                  # Public exports
   ```

   **T2 (Logic)** - adds:
   ```
   ├── headless/use{Name}Logic.ts  # Copy from .prot/pillar-l/headless.ts
   ```

   **T3 (Saga)** - adds:
   ```
   ├── workflows/{name}Saga.ts     # Copy from .prot/pillar-m/saga.ts
   ```

4. Update TODO.md with generated files

### Domain Generation

1. Create domain directory: `src/01_domains/{name}/`
2. Generate files:
   ```
   {name}/
   ├── types.ts      # Branded types from .prot/pillar-a/branded.ts
   ├── rules.ts      # Pure business rule functions
   └── index.ts      # Public exports
   ```

### Docs Generation

1. Read product type from user (or infer from project)
2. Create required docs based on type:
   ```
   docs/
   ├── REQUIREMENTS.md   # Always
   ├── ARCHITECTURE.md   # Always
   ├── SCHEMA.md         # If data-heavy
   ├── UI-SPEC.md        # If has UI
   ├── API.md            # If has API
   └── DOMAIN.md         # If complex business logic
   ```
3. Each doc includes template with sections to fill

## Templates

### Module index.ts
```typescript
// Public API for {name} module
// Only export what other modules need

export * from './headless/use{Name}Logic';
// export * from './views/{Name}View';  // Usually not exported
```

### View skeleton
```tsx
import { use{Name}Logic } from '../headless/use{Name}Logic';

export function {Name}View() {
  const { state, actions } = use{Name}Logic();

  if (state.status === 'loading') return <div>Loading...</div>;
  if (state.status === 'error') return <div>Error: {state.error}</div>;

  return (
    <div>
      {/* TODO: Implement {name} view */}
    </div>
  );
}
```

### Headless skeleton
```typescript
import { useReducer } from 'react';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: unknown }
  | { status: 'error'; error: string };

type Action =
  | { type: 'LOAD' }
  | { type: 'SUCCESS'; data: unknown }
  | { type: 'ERROR'; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD': return { status: 'loading' };
    case 'SUCCESS': return { status: 'success', data: action.data };
    case 'ERROR': return { status: 'error', error: action.error };
    default: return state;
  }
}

export function use{Name}Logic() {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });

  const actions = {
    // TODO: Add actions
  };

  return { state, ...actions };
}
```

## Output Format

```
## Scaffold Complete

**Type**: Module (T2)
**Name**: cart
**Location**: src/02_modules/cart/

### Created Files
- adapters/cartApi.ts
- headless/useCartLogic.ts
- views/CartView.tsx
- index.ts

### Next Steps
1. Define types in src/01_domains/ if needed
2. Implement adapter API calls
3. Add business logic to headless hook
4. Build view components

### Related Pillars
- Pillar A: Branded types for IDs
- Pillar B: Airlock pattern for adapters
- Pillar L: Headless separation
```

## Notes

- Always use PascalCase for component names, camelCase for files
- Module names should be singular (cart, not carts)
- Generated code is a starting point - customize as needed
- Run `*tier` after scaffolding to confirm complexity classification
