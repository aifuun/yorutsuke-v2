---
name: scaffold
category: planning
requires: [.prot/STRUCTURE.md, .prot/pillar-*/]
---

# Command: *scaffold

## Purpose
Generate project structure from AI_DEV_PROT v15 templates

## Usage
```bash
*scaffold module <name> [--t1|--t2|--t3]    # Generate feature module
*scaffold domain <name>                      # Generate domain directory
*scaffold docs                               # Generate docs/ with templates
```

## Workflow

### Module Generation
1. Determine tier (default: T2)
2. Create directory: `src/02_modules/{name}/`
3. Copy templates based on tier:

**T1 (Direct)**:
- `adapters/{name}Api.ts` ← @.prot/pillar-b/airlock.ts
- `views/{Name}View.tsx` ← Basic view skeleton
- `index.ts` ← Public exports

**T2 (Logic)** - adds:
- `headless/use{Name}Logic.ts` ← @.prot/pillar-l/headless.ts

**T3 (Saga)** - adds:
- `workflows/{name}Saga.ts` ← @.prot/pillar-m/saga.ts

4. Update issue plan with generated files

### Domain Generation
1. Create: `src/01_domains/{name}/`
2. Files:
   - `types.ts` ← @.prot/pillar-a/branded.ts
   - `rules.ts` ← Pure business logic functions
   - `index.ts` ← Public exports

### Docs Generation
1. Read product type from user (or infer from project)
2. Create required docs:
   - `REQUIREMENTS.md` (always)
   - `ARCHITECTURE.md` (always)
   - `SCHEMA.md` (if data-heavy)
   - `UI-SPEC.md` (if has UI)
   - `API.md` (if has API)
   - `DOMAIN.md` (if complex business logic)
3. Each doc includes template with sections to fill

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

- **Naming**: PascalCase for components, camelCase for files
- **Module names**: Singular (cart, not carts)
- **Generated code**: Starting point - customize as needed
- **Tier confirmation**: Run `*tier` after scaffolding to verify classification

## Related
- Pillars: @.claude/patterns/pillar-reference.md
- Structure: @.prot/STRUCTURE.md
- Templates: @.prot/pillar-{a-r}/
- Commands: *tier (for complexity classification)
