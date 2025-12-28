/**
 * Pillar I: Architectural Firewalls Template
 *
 * Enforce strict module boundaries via public API (index.ts).
 *
 * ⚠️ AI DEVELOPMENT NOTE:
 * - Every module MUST have an index.ts that exports public API
 * - NEVER import from internal paths (headless/, adapters/, views/)
 * - Import ONLY from module root: '@/modules/order' not '@/modules/order/headless/useOrder'
 * - Deep imports (../../) are a CODE SMELL - refactor to use aliases
 */

// =============================================================================
// MODULE STRUCTURE REFERENCE
// =============================================================================

/**
 * Standard module structure:
 *
 * src/02_modules/
 * ├── order/
 * │   ├── index.ts           # ✅ PUBLIC API - only entry point
 * │   ├── types.ts           # ❌ Internal - export via index.ts
 * │   ├── headless/          # ❌ Internal - logic hooks
 * │   │   ├── useOrder.ts
 * │   │   └── useOrderList.ts
 * │   ├── adapters/          # ❌ Internal - API/IPC calls
 * │   │   └── orderApi.ts
 * │   ├── views/             # ❌ Internal - React components
 * │   │   └── OrderView.tsx
 * │   └── workflows/         # ❌ Internal - T3 sagas
 * │       └── checkoutSaga.ts
 * │
 * └── shared/
 *     ├── index.ts           # ✅ Shared utilities
 *     └── components/
 *         └── Button.tsx
 */

// =============================================================================
// PUBLIC API TEMPLATE (index.ts)
// =============================================================================

/**
 * Module Public API Template
 *
 * ⚠️ AI NOTE: Copy this structure for every new module's index.ts
 * Export ONLY what other modules need. Keep internals hidden.
 */

// --- Example: src/02_modules/order/index.ts ---

// 1. TYPE EXPORTS (most important - used for contracts)
// export type { Order, OrderId, OrderStatus } from './types';
// export type { CreateOrderCommand, OrderResult } from './workflows/types';

// 2. HOOK EXPORTS (for UI consumption)
// export { useOrder } from './headless/useOrder';
// export { useOrderList } from './headless/useOrderList';

// 3. ACTION EXPORTS (for programmatic use)
// export { createOrder, cancelOrder } from './workflows';

// 4. COMPONENT EXPORTS (if shared with other modules)
// export { OrderSummary } from './views/OrderSummary';

// =============================================================================
// CORRECT IMPORT PATTERNS
// =============================================================================

/**
 * ✅ CORRECT: Import from module's public API
 */

// Good: Using path aliases
// import { useOrder, Order, createOrder } from '@/modules/order';
// import { useUser, User } from '@/modules/user';
// import { Button, Card } from '@/modules/shared';

// Good: Relative but still from index
// import { useCart } from '../cart';

/**
 * ❌ WRONG: Deep imports into module internals
 */

// Bad: Direct internal access
// import { useOrder } from '@/modules/order/headless/useOrder';
// import { orderApi } from '@/modules/order/adapters/orderApi';
// import { Button } from '@/modules/shared/components/Button';

// Bad: Relative deep imports
// import { something } from '../../user/internal/helper';
// import { cartReducer } from '../cart/headless/cartReducer';

// =============================================================================
// ESLINT CONFIGURATION
// =============================================================================

/**
 * ESLint rule to enforce firewalls.
 * Add to .eslintrc.js
 *
 * ⚠️ AI NOTE: This is CRITICAL - enables automated enforcement
 */

export const eslintFirewallsConfig = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          // Block internal module paths
          {
            group: ['@/modules/*/headless/*'],
            message: 'Import from module index.ts instead: @/modules/{module}',
          },
          {
            group: ['@/modules/*/adapters/*'],
            message: 'Import from module index.ts instead: @/modules/{module}',
          },
          {
            group: ['@/modules/*/views/*'],
            message: 'Import from module index.ts instead: @/modules/{module}',
          },
          {
            group: ['@/modules/*/workflows/*'],
            message: 'Import from module index.ts instead: @/modules/{module}',
          },
          {
            group: ['@/modules/*/*/**'],
            message: 'Deep imports are forbidden. Use module public API.',
          },
          // Block excessive relative imports
          {
            group: ['../**/headless/*', '../**/adapters/*', '../**/views/*'],
            message: 'Cross-module internal imports are forbidden.',
          },
        ],
      },
    ],
  },
};

// =============================================================================
// TSCONFIG PATH ALIASES
// =============================================================================

/**
 * TypeScript path aliases for clean imports.
 * Add to tsconfig.json compilerOptions.
 */

export const tsconfigPaths = {
  baseUrl: '.',
  paths: {
    '@/modules/*': ['src/02_modules/*'],
    '@/domains/*': ['src/01_domains/*'],
    '@/kernel/*': ['src/00_kernel/*'],
    '@/*': ['src/*'],
  },
};

// =============================================================================
// MODULE BOUNDARY VALIDATOR
// =============================================================================

/**
 * Runtime module boundary check (for development).
 *
 * ⚠️ AI NOTE: Optional utility for debugging import violations.
 * Use in development only, strip in production.
 */

interface ModuleManifest {
  name: string;
  publicExports: string[];
}

export function validateModuleBoundary(
  importPath: string,
  allowedModules: ModuleManifest[]
): { valid: boolean; error?: string } {
  // Check if path is a deep import
  const deepImportPattern = /@\/modules\/\w+\/(headless|adapters|views|workflows)\//;

  if (deepImportPattern.test(importPath)) {
    return {
      valid: false,
      error: `Deep import detected: ${importPath}. Use module's public API.`,
    };
  }

  // Check relative deep imports
  const relativeDeepPattern = /\.\.\/.*\/(headless|adapters|views|workflows)\//;

  if (relativeDeepPattern.test(importPath)) {
    return {
      valid: false,
      error: `Relative deep import detected: ${importPath}. Refactor to use path alias.`,
    };
  }

  return { valid: true };
}

// =============================================================================
// INDEX.TS GENERATOR TEMPLATE
// =============================================================================

/**
 * Template for generating module index.ts
 *
 * ⚠️ AI NOTE: When creating a new module, generate index.ts with this structure.
 */

export const indexTemplate = `
// =============================================================================
// {MODULE_NAME} Module Public API
// =============================================================================
//
// This file defines the PUBLIC interface for the {module_name} module.
// All imports from other modules MUST come through this file.
//
// ⚠️ NEVER export internal implementation details.
// ⚠️ ONLY export what other modules need to consume.
// =============================================================================

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export type { {Entity}, {Entity}Id } from './types';

// -----------------------------------------------------------------------------
// Hooks (for React components)
// -----------------------------------------------------------------------------
export { use{Entity} } from './headless/use{Entity}';
export { use{Entity}List } from './headless/use{Entity}List';

// -----------------------------------------------------------------------------
// Actions (for programmatic use)
// -----------------------------------------------------------------------------
export { create{Entity}, update{Entity}, delete{Entity} } from './workflows';

// -----------------------------------------------------------------------------
// Components (if shared)
// -----------------------------------------------------------------------------
// export { {Entity}Card } from './views/{Entity}Card';
`;

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/*
// ✅ CORRECT: Clean module consumption

// app/pages/OrderPage.tsx
import { useOrder, useOrderList, Order } from '@/modules/order';
import { useUser } from '@/modules/user';
import { Button, Card, LoadingSpinner } from '@/modules/shared';

function OrderPage({ orderId }: { orderId: string }) {
  const { order, isLoading, error } = useOrder(orderId);
  const { user } = useUser(order?.userId);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <Card>
      <h1>Order #{order.id}</h1>
      <p>Customer: {user.name}</p>
      <Button onClick={() => cancelOrder(order.id)}>Cancel</Button>
    </Card>
  );
}


// ❌ WRONG: Violating module boundaries

// app/pages/OrderPage.tsx
import { useOrder } from '@/modules/order/headless/useOrder';        // ❌
import { orderApi } from '@/modules/order/adapters/orderApi';        // ❌
import { OrderCard } from '@/modules/order/views/OrderCard';         // ❌
import { userReducer } from '../../modules/user/headless/reducer';   // ❌

// Problems:
// 1. Tight coupling to internal structure
// 2. Breaks when internals refactor
// 3. Circular dependency risk
// 4. No clear contract


// ❌ WRONG: Barrel export everything

// modules/order/index.ts
export * from './headless';    // ❌ Exposes internal structure
export * from './adapters';    // ❌ Should be hidden
export * from './views';       // ❌ Breaks encapsulation
export * from './types';       // ❌ Too broad, may include internals

// Problems:
// 1. No control over public API
// 2. Internals leak out
// 3. Breaking changes hard to track
*/

// =============================================================================
// TEMPLATE FOR NEW MODULE
// =============================================================================

/*
⚠️ AI: When creating a new module, follow this checklist:

1. Create directory structure:
   mkdir -p src/02_modules/{name}/{headless,adapters,views,workflows}

2. Create types.ts:
   - Branded IDs (Pillar A)
   - Entity interfaces
   - Command/Result types

3. Create index.ts using indexTemplate above

4. Create headless hooks (Pillar L):
   - No JSX
   - Return data + functions

5. Create adapters:
   - API calls
   - Tauri IPC

6. Verify with ESLint:
   npm run lint -- --rule 'no-restricted-imports: error'
*/
