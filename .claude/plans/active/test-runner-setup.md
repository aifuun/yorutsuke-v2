# Unified Test Runner Setup

## Summary
Created a unified test running system for the Yorutsuke v2 monorepo with 27 unit tests distributed across 2 projects.

## Deliverables

### 1. Main Script
- **File**: `scripts/run-all-tests.sh`
- **Size**: 3.3KB
- **Features**:
  - Run all tests with one command
  - Watch mode for development
  - Coverage report generation
  - Individual project testing
  - Color-coded output
  - Test summary with pass/fail tracking

### 2. Documentation

#### Quick Reference
- **File**: `scripts/QUICK_TEST.md`
- **Contains**: One-liner commands, common use cases, test file locations

#### Full Guide
- **File**: `scripts/RUN_TESTS.md`
- **Contains**:
  - Complete test overview
  - Test structure explanation
  - CI/CD integration guide
  - Troubleshooting tips
  - Best practices

## Test Distribution

```
Total Tests: 27 files

App (Tauri + React):          20 test files
├── 01_domains/                5 tests (domain logic, rules)
├── 02_modules/               13 tests (services, adapters)
└── 00_kernel/                 2 tests (storage, migrations)

Infra (AWS CDK + Lambda):       7 test files
├── shared-layer/              4 tests (utilities, logger, report-generator)
├── presign/                    1 test
├── issue-permit/              1 test
└── diagnostic/                1 test
```

## Command Reference

### Run All Tests
```bash
./scripts/run-all-tests.sh
```

### Development Workflow
```bash
./scripts/run-all-tests.sh --watch      # Watch mode
./scripts/run-all-tests.sh app --watch  # Only app, watch mode
./scripts/run-all-tests.sh infra        # Only infra
```

### CI/CD
```bash
./scripts/run-all-tests.sh               # Exit 0 if pass, 1 if fail
./scripts/run-all-tests.sh --coverage    # Generate coverage reports
```

## Usage Examples

### Before Committing
```bash
# Quick validation
./scripts/run-all-tests.sh

# Or specific module
./scripts/run-all-tests.sh app
```

### During Development
```bash
# App development - watch mode
./scripts/run-all-tests.sh app --watch

# Infra development - UI runner
cd infra && npm run test:ui
```

### Coverage Check
```bash
./scripts/run-all-tests.sh --coverage
```

## Key Features

✅ **Single Entry Point**: No need to remember different test commands
✅ **Color Coded Output**: Easy to see which tests passed/failed
✅ **Flexible Options**: Watch mode, coverage, per-project testing
✅ **Summary Report**: Shows all passed and failed tests at end
✅ **Exit Codes**: Proper exit codes for CI integration
✅ **Watch Mode**: Re-run tests automatically on file changes
✅ **Coverage Support**: Generate coverage reports for all projects

## Files Created

| File | Purpose |
|------|---------|
| `scripts/run-all-tests.sh` | Main test runner script |
| `scripts/RUN_TESTS.md` | Full documentation |
| `scripts/QUICK_TEST.md` | Quick reference guide |

## Next Steps (Optional)

1. **GitHub Actions Integration**:
   - Add workflow to run `./scripts/run-all-tests.sh` on PR
   - Upload coverage reports

2. **Pre-commit Hook**:
   - Run tests before allowing commits
   - Use `husky` package for git hooks

3. **Test Coverage Thresholds**:
   - Set minimum coverage % requirements
   - Fail CI if coverage drops

## Status
✅ Complete - Ready to use

## Usage Tips

1. **Fastest feedback**: `./scripts/run-all-tests.sh app --watch`
2. **Full validation**: `./scripts/run-all-tests.sh` before pushing
3. **CI/CD ready**: Script handles proper exit codes
4. **Developer friendly**: Color output and clear summaries
