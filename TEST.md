# Testing Quick Reference

## 🎯 Fast Commands

Run from project root:

```bash
# Run all tests
npm run test

# Watch mode (auto re-run on file change)
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run only app tests
npm run test:app

# Run only infra tests
npm run test:infra

# App tests in watch mode
npm run test:app:watch

# Infra tests in watch mode
npm run test:infra:watch

# Sync environment files
npm run env:sync

# Sync AWS CDK outputs to env files
npm run env:sync:cdk
```

## 📊 Current Test Status

- **App tests**: 20 files
- **Infra tests**: 7 files
- **Total**: 27 test files

## 🚀 Common Workflows

### During Development
```bash
# Watch app changes
npm run test:app:watch
```

### Before Committing
```bash
# Full validation
npm run test
```

### Check Coverage
```bash
# Generate coverage reports
npm run test:coverage
```

### Backend Development
```bash
# Watch infra changes
npm run test:infra:watch
```

## 📁 Test Files Location

| Path | Count |
|------|-------|
| `app/src/01_domains/**/*.test.ts` | 5 |
| `app/src/02_modules/**/*.test.ts` | 13 |
| `app/src/00_kernel/**/*.test.ts` | 2 |
| `infra/lambda/**/*.test.mjs` | 7 |

## 🔧 Advanced Usage

```bash
# Direct script usage (same as npm run test)
./scripts/run-all-tests.sh

# Watch mode via script
./scripts/run-all-tests.sh --watch

# Coverage via script
./scripts/run-all-tests.sh --coverage
```

## 📋 What Gets Tested

### App
- Domain rules and validation
- Service logic and state management
- API adapters and database operations
- Quota management
- Sync operations

### Infra
- Lambda shared utilities
- Report generation
- Model analysis
- Logger functionality
- S3 presigning
- Permit validation

## ✅ Pre-commit Checklist

Before pushing:
```bash
npm run test
```

Exit codes:
- `0` = All tests passed ✅
- `1` = Some tests failed ❌

---

For detailed information, see:
- `scripts/RUN_TESTS.md` - Full documentation
- `scripts/QUICK_TEST.md` - More examples
