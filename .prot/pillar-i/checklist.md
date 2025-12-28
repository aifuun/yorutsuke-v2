# Pillar I: Architectural Firewalls Checklist

> Use this checklist when creating modules or reviewing import patterns

## AI-First Principles

| Principle | Application |
|-----------|-------------|
| **Explicit > Implicit** | All public APIs defined in index.ts |
| **Copy > Abstract** | Copy index.ts template for new modules |
| **Boundary Enforcement** | ESLint rules catch violations automatically |

## When Creating New Module

### 1. Create Directory Structure

```
src/02_modules/{name}/
├── index.ts          # PUBLIC API
├── types.ts          # Internal types
├── headless/         # Logic hooks (Pillar L)
├── adapters/         # IO operations
├── views/            # React components
└── workflows/        # T3 sagas
```

- [ ] Directory structure follows standard layout
- [ ] `index.ts` created at module root
- [ ] Internal folders are NOT exported directly

### 2. Define Public API (index.ts)

```typescript
// Types
export type { Entity, EntityId } from './types';

// Hooks
export { useEntity } from './headless/useEntity';

// Actions
export { createEntity } from './workflows';

// Components (if shared)
export { EntityCard } from './views/EntityCard';
```

- [ ] Only necessary types exported
- [ ] Hooks exported for UI consumption
- [ ] Actions exported for programmatic use
- [ ] Internal utilities NOT exported

### 3. Configure Path Aliases

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/modules/*": ["src/02_modules/*"]
    }
  }
}
```

- [ ] Path aliases configured in tsconfig.json
- [ ] Vite/webpack alias configured (if applicable)

### 4. Add ESLint Rules

```javascript
// .eslintrc.js
'no-restricted-imports': ['error', {
  patterns: [
    { group: ['@/modules/*/headless/*'], message: 'Use index.ts' },
    { group: ['@/modules/*/adapters/*'], message: 'Use index.ts' },
    { group: ['@/modules/*/views/*'], message: 'Use index.ts' },
  ]
}]
```

- [ ] ESLint rule added for deep import detection
- [ ] Rule covers all internal directories

## Code Review Checklist

### Import Patterns

- [ ] No imports from `@/modules/*/headless/*`
- [ ] No imports from `@/modules/*/adapters/*`
- [ ] No imports from `@/modules/*/views/*`
- [ ] No imports from `@/modules/*/workflows/*`
- [ ] No relative imports like `../../module/internal/*`
- [ ] All cross-module imports use path aliases

### Module Structure

- [ ] Every module has `index.ts`
- [ ] `index.ts` has explicit exports (no `export *`)
- [ ] Internal utilities stay internal
- [ ] No circular dependencies

### Path Depth

- [ ] Maximum 1 level deep: `@/modules/order` ✅
- [ ] No 2+ levels: `@/modules/order/headless/useOrder` ❌

## Common Patterns

### Correct Import

```typescript
// ✅ From module root
import { useOrder, Order, createOrder } from '@/modules/order';
import { useUser } from '@/modules/user';
import { Button } from '@/modules/shared';
```

### Incorrect Import

```typescript
// ❌ Deep imports
import { useOrder } from '@/modules/order/headless/useOrder';
import { orderApi } from '@/modules/order/adapters/orderApi';

// ❌ Relative deep imports
import { something } from '../../user/headless/helper';
```

### Barrel Export (Avoid)

```typescript
// ❌ Don't do this - exposes internals
export * from './headless';
export * from './adapters';

// ✅ Explicit exports
export { useOrder } from './headless/useOrder';
export type { Order } from './types';
```

## Common Mistakes

| Pattern | Problem | Fix |
|---------|---------|-----|
| `import from '../order/headless/useOrder'` | Deep import | Use `@/modules/order` |
| `export * from './headless'` | Exposes internals | Explicit exports |
| `import { helper } from '@/modules/order/utils'` | Internal access | Move to shared or keep internal |
| No `index.ts` | No public API | Create index.ts |
| `../../../../../../` | Path hell | Use path aliases |

## Dependency Direction

```
✅ Allowed:
  modules/checkout → modules/cart (via index.ts)
  modules/checkout → modules/user (via index.ts)
  modules/* → shared (via index.ts)
  modules/* → domains (pure types)
  modules/* → kernel (infrastructure)

❌ Forbidden:
  modules/checkout → modules/cart/headless/*
  modules/cart → modules/checkout (if checkout already imports cart)
  Lower layers → Higher layers
```

## Circular Dependency Resolution

If modules A and B need each other:

1. Extract shared types to `src/01_domains/`
2. Both modules import from domains
3. Or create a new module C that both depend on

```
// Before (circular):
// order/index.ts imports from user
// user/index.ts imports from order

// After (resolved):
// 01_domains/shared-types.ts has shared types
// order/index.ts imports from domains
// user/index.ts imports from domains
```

## Verification Commands

```bash
# Run ESLint to check imports
npm run lint

# Find deep imports (manual grep)
grep -r "from '@/modules/.*/" src/ | grep -v "index"

# Run Pillar I audit
npx tsx .prot/pillar-i/audit.ts
```

## Template Reference

- Module structure: `.prot/pillar-i/firewalls.ts`
- ESLint config: `.prot/pillar-i/firewalls.ts` (eslintFirewallsConfig)
- Index.ts template: `.prot/pillar-i/firewalls.ts` (indexTemplate)
