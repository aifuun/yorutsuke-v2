# Lambda TypeScript Migration Plan (Issue #160)

> **Goal**: Convert 15 Lambda functions + 5 shared-layer modules from `.mjs` to `.ts` with compile-time type safety and EVENTS constant enforcement.

## Executive Summary

**Strategy**: Shared-layer first migration using **esbuild** for compilation, maintaining ES Modules format, with incremental P0 → P1 → P2 rollout.

**Timeline**: 4-6 days
**Risk**: Low (no logic changes, TypeScript is syntax-only transformation)

---

## Architecture Decision

### Build Tool: esbuild (not tsc)

**Reasons**:
- ⚡ 10-100x faster than tsc (critical for 15 functions)
- 📦 Built-in bundling support (optional)
- 🌲 Tree-shaking for smaller bundles
- 🎯 Native TypeScript + ESM support
- 🔥 Incremental builds (~100ms per function)

### Output Format: ES Modules (.mjs)

**Reasons**:
- Matches current Lambda format (Node.js 20.x ES Modules)
- No runtime overhead vs current .mjs
- 0ms cold start impact
- Maintains CDK compatibility

### Directory Structure

```
infra/
├── lambda/                         (Source - TypeScript)
│   ├── tsconfig.json               (NEW)
│   ├── shared-layer/
│   │   └── nodejs/shared/
│   │       ├── logger.ts           (MIGRATED from .mjs)
│   │       ├── schemas.ts
│   │       └── ...
│   ├── config/index.ts             (MIGRATED)
│   └── ...
├── .lambda-dist/                   (Output - Compiled JS, gitignored)
│   ├── shared-layer/
│   │   └── nodejs/shared/
│   │       ├── logger.mjs          (Compiled)
│   │       └── ...
│   ├── config/index.mjs            (Compiled)
│   └── ...
└── scripts/
    └── build-lambdas.mjs           (NEW - Build orchestrator)
```

---

## Implementation Phases

### Phase 0: Setup (2 hours) ✅ IN PROGRESS

**Tasks**:
- [x] Add esbuild and glob to `infra/package.json` devDependencies
- [ ] Create `infra/lambda/tsconfig.json`
- [ ] Create `infra/scripts/build-lambdas.mjs`
- [ ] Create `infra/lambda/types/aws-events.ts`
- [ ] Update `infra/.gitignore`: add `.lambda-dist/`
- [ ] Update `infra/package.json` scripts
- [ ] Test build script runs successfully

### Phase 1: Shared Layer Migration (4-6 hours)

**Critical**: All functions depend on shared layer. Must migrate this first.

**Files to migrate**:
1. logger.mjs → logger.ts (CRITICAL - 514 lines, 150+ EVENTS)
2. schemas.mjs → schemas.ts
3. model-analyzer.mjs → model-analyzer.ts
4. azure-credentials.mjs → azure-credentials.ts
5. report-generator.mjs → report-generator.ts

**Per-file checklist**:
- [ ] Rename `.mjs` → `.ts`
- [ ] Convert EVENTS to `as const` (logger only)
- [ ] Add `EventName` type export (logger only)
- [ ] Add type annotations: function params, return types
- [ ] Add error type guards: `catch (error: unknown)`
- [ ] Update imports: `.mjs` → `.js`
- [ ] Build: `npm run build:lambdas`
- [ ] Verify output in `.lambda-dist/`
- [ ] Deploy and test Layer

### Phase 2: P0 Functions (3 hours)

**Priority**: Critical admin operations

**Functions**:
1. admin-delete-data/index.ts
2. admin-purge-all-data/index.ts
3. admin/control/index.ts

### Phase 3: P1 Functions (4 hours)

**Functions** (6 total):
1. config/index.ts
2. issue-permit/index.ts (includes test file)
3. report/index.ts
4. transactions/index.ts
5. admin/costs/index.ts
6. admin/stats/index.ts

### Phase 4: P2 Functions (4 hours)

**Functions** (6 total):
1. presign/index.ts (includes test)
2. quota/index.ts
3. instant-processor/index.ts (11 string literals to fix)
4. admin/azure-credentials/index.ts
5. admin/model-config/index.ts
6. diagnostic/index.ts

### Phase 5: Cleanup (2 hours)

**Tasks**:
- [ ] Delete all `.mjs` files
- [ ] Remove CDK toggle logic
- [ ] Update documentation
- [ ] Final testing

---

## Key Files to Create

### 1. Lambda TypeScript Config (`infra/lambda/tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,

    "outDir": "../.lambda-dist",
    "rootDir": ".",
    "declaration": false,
    "sourceMap": false,

    "baseUrl": ".",
    "paths": {
      "/opt/nodejs/shared/*": ["./shared-layer/nodejs/shared/*"]
    }
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "**/*.test.ts", ".lambda-dist"]
}
```

### 2. Build Script (`infra/scripts/build-lambdas.mjs`)

Compiles shared-layer modules and Lambda functions using esbuild.

### 3. Lambda Event Types (`infra/lambda/types/aws-events.ts`)

Type definitions for API Gateway and S3 events.

### 4. Type-Safe Logger (`infra/lambda/shared-layer/nodejs/shared/logger.ts`)

EVENTS as const + EventName type for compile-time validation.

---

## Progress Tracking

- [x] Issue picked (#160)
- [x] Feature branch created (feature/160-lambda-typescript-migration)
- [ ] Phase 0 complete
- [ ] Phase 1 complete
- [ ] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Phase 4 complete
- [ ] Phase 5 complete
- [ ] PR created
- [ ] Tests passing
- [ ] Ready for merge

---

## Related Documents

- **Issue**: #160 (GitHub)
- **Rules**: `.claude/rules/lambda-layer-deployment.md`
- **Testing**: `scripts/RUN_TESTS.md`

---

**Last Updated**: 2026-01-21
**Status**: In Progress - Phase 0
