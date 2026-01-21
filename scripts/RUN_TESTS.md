# Running Unit Tests

This document describes how to run unit tests across the Yorutsuke v2 monorepo.

## Tests Overview

Tests are distributed across multiple projects:

| Project | Location | Runner | Command |
|---------|----------|--------|---------|
| **App** (Tauri) | `app/src/` | vitest | `cd app && npm run test` |
| **Infra** (AWS CDK) | `infra/` | vitest | `cd infra && npm run test` |

## Quick Commands

### Run All Tests
```bash
./scripts/run-all-tests.sh
```

### Run Tests in Watch Mode
```bash
./scripts/run-all-tests.sh --watch
```

### Generate Coverage Report
```bash
./scripts/run-all-tests.sh --coverage
```

### Run Only App Tests
```bash
./scripts/run-all-tests.sh app
```

### Run Only Infra Tests
```bash
./scripts/run-all-tests.sh infra
```

## Individual Project Testing

### App Tests
```bash
cd app

# Run tests once
npm run test

# Run in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Infra Tests
```bash
cd infra

# Run tests once
npm run test

# Run in watch mode
npm run test:watch

# Run with UI
npm run test:ui
```

## Test Structure

### App Tests
- **Location**: `app/src/`
- **Patterns**: `*.test.ts`, `*.test.tsx`, `*.integration.test.ts`
- **Config**: `app/vitest.config.ts`
- **Examples**:
  - `app/src/01_domains/transaction/rules.test.ts` - Domain logic tests
  - `app/src/02_modules/transaction/services/syncService.test.ts` - Service tests
  - `app/src/02_modules/transaction/adapters/transactionApi.test.ts` - API adapter tests

### Infra Tests
- **Location**: `infra/lambda/`
- **Patterns**: `*.test.mjs`, `*.test.ts`
- **Examples**:
  - `infra/lambda/shared-layer/nodejs/shared/__tests__/` - Shared Lambda utilities tests
  - `infra/lambda/presign/index.test.mjs` - S3 presign Lambda tests
  - `infra/lambda/issue-permit/index.test.mjs` - Permit Lambda tests

## CI/CD Integration

For GitHub Actions or other CI systems:

```bash
# Run all tests with exit code
./scripts/run-all-tests.sh

# Run with coverage
./scripts/run-all-tests.sh --coverage
```

The script exits with:
- `0` if all tests pass
- `1` if any tests fail

## Troubleshooting

### Tests not found
```bash
# Ensure you're in the correct directory
cd /Users/woo/dev/yorutsuke-v2-2

# Check test files exist
find . -name "*.test.ts" -o -name "*.test.mjs" | grep -v node_modules | head -10
```

### vitest not installed
```bash
# Reinstall dependencies
npm install --workspace app
npm install --workspace infra
```

### Port conflicts (Watch mode)
```bash
# Kill processes on vitest default ports
pkill -f vitest
```

## Best Practices

1. **Write tests alongside code** - Keep test files next to implementation
2. **Use descriptive names** - `rule.test.ts` not `test.test.ts`
3. **Organize by layer** - Mirror the source structure in tests
4. **Keep tests focused** - One test file per module/service
5. **Use factories** - Create reusable test data builders

## Related Files

- **App config**: `app/vitest.config.ts`
- **Infra config**: `infra/package.json` (vitest config)
- **Script**: `scripts/run-all-tests.sh`
- **This guide**: `scripts/RUN_TESTS.md`
