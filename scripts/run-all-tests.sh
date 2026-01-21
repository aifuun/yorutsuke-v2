#!/bin/bash

# Run all unit tests across the monorepo (app, infra)
# Usage:
#   ./scripts/run-all-tests.sh              # Run all tests
#   ./scripts/run-all-tests.sh --watch      # Run in watch mode
#   ./scripts/run-all-tests.sh --coverage   # Generate coverage report
#   ./scripts/run-all-tests.sh app          # Run only app tests
#   ./scripts/run-all-tests.sh infra        # Run only infra tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
RUN_APP=true
RUN_INFRA=true
WATCH_MODE=false
COVERAGE=false
EXTRA_ARGS=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --watch)
      WATCH_MODE=true
      shift
      ;;
    --coverage)
      COVERAGE=true
      shift
      ;;
    app)
      RUN_APP=true
      RUN_INFRA=false
      shift
      ;;
    infra)
      RUN_APP=false
      RUN_INFRA=true
      shift
      ;;
    *)
      EXTRA_ARGS="$EXTRA_ARGS $1"
      shift
      ;;
  esac
done

# Build npm test command
TEST_CMD="npm run test"
if [ "$WATCH_MODE" = true ]; then
  TEST_CMD="npm run test:watch"
fi

if [ "$COVERAGE" = true ]; then
  TEST_CMD="npm run test:coverage"
fi

# Test results tracking
FAILED_TESTS=()
PASSED_TESTS=()

# Function to run tests in a directory
run_tests() {
  local dir=$1
  local name=$2

  if [ ! -d "$PROJECT_ROOT/$dir" ]; then
    echo -e "${YELLOW}⚠️  Skipping $name - directory not found ($dir)${NC}"
    return 0
  fi

  echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}▶ Running $name tests${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  cd "$PROJECT_ROOT/$dir"

  if eval "$TEST_CMD"; then
    echo -e "${GREEN}✅ $name tests passed${NC}"
    PASSED_TESTS+=("$name")
  else
    echo -e "${RED}❌ $name tests failed${NC}"
    FAILED_TESTS+=("$name")
    return 1
  fi
}

# Run tests based on flags
OVERALL_EXIT_CODE=0

if [ "$RUN_APP" = true ]; then
  if ! run_tests "app" "App"; then
    OVERALL_EXIT_CODE=1
  fi
fi

if [ "$RUN_INFRA" = true ]; then
  if ! run_tests "infra" "Infra"; then
    OVERALL_EXIT_CODE=1
  fi
fi

# Summary
if [ "$WATCH_MODE" = false ]; then
  echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}📊 Test Summary${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  if [ ${#PASSED_TESTS[@]} -gt 0 ]; then
    echo -e "${GREEN}✅ Passed (${#PASSED_TESTS[@]}):${NC}"
    for test in "${PASSED_TESTS[@]}"; do
      echo -e "  ${GREEN}✓${NC} $test"
    done
  fi

  if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Failed (${#FAILED_TESTS[@]}):${NC}"
    for test in "${FAILED_TESTS[@]}"; do
      echo -e "  ${RED}✗${NC} $test"
    done
  fi

  if [ $OVERALL_EXIT_CODE -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed!${NC}"
  else
    echo -e "\n${RED}⚠️  Some tests failed${NC}"
  fi
fi

exit $OVERALL_EXIT_CODE
