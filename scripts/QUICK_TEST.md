# Quick Test Commands

## One-Liner Commands

```bash
# 📋 Run all tests
./scripts/run-all-tests.sh

# 👀 Watch mode - re-run tests on file change
./scripts/run-all-tests.sh --watch

# 📊 Coverage report
./scripts/run-all-tests.sh --coverage

# 🎯 Only app tests
./scripts/run-all-tests.sh app

# 🎯 Only infra tests
./scripts/run-all-tests.sh infra

# 📱 App tests in watch mode
./scripts/run-all-tests.sh app --watch
```

## From Project Directories

```bash
# App tests
cd app && npm run test:watch

# Infra tests
cd infra && npm run test:watch

# Infra tests with UI
cd infra && npm run test:ui
```

## Test Files Location

| Module | Path | Command |
|--------|------|---------|
| **App - Domains** | `app/src/01_domains/**/*.test.ts` | Run via script |
| **App - Modules** | `app/src/02_modules/**/*.test.ts` | Run via script |
| **App - Kernel** | `app/src/00_kernel/**/*.test.ts` | Run via script |
| **Infra - Lambda** | `infra/lambda/**/*.test.mjs` | Run via script |
| **Infra - Layer** | `infra/lambda/shared-layer/**/__tests__/**` | Run via script |

## Test Count

```bash
# Count test files
find . -name "*.test.ts" -o -name "*.test.mjs" | grep -v node_modules | wc -l
```

## Examples of Existing Tests

### App
- **Domain Rules**: `app/src/01_domains/transaction/rules.test.ts`
- **Services**: `app/src/02_modules/transaction/services/syncService.test.ts`
- **Adapters**: `app/src/02_modules/transaction/adapters/transactionApi.test.ts`
- **Integration**: `app/src/02_modules/transaction/services/syncService.integration.test.ts`

### Infra
- **Shared Utilities**: `infra/lambda/shared-layer/nodejs/shared/__tests__/model-analyzer.test.mjs`
- **Lambda Functions**: `infra/lambda/presign/index.test.mjs`

## Tips

1. **Before committing**: Run `./scripts/run-all-tests.sh`
2. **During development**: Use `./scripts/run-all-tests.sh app --watch`
3. **For performance**: Run `./scripts/run-all-tests.sh infra` to verify backend changes
4. **For debugging**: Use `npm run test:ui` in infra to see visual test runner
