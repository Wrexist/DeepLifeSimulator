---
name: test-suite
description: Run tests with smart filtering — unit, integration, e2e, or all
args: "[filter]"
---

# Test Suite Runner

Run the DeepLife Simulator test suite with optional filtering.

## Arguments

- No argument → run all tests (`npm test`)
- `unit` → run unit tests only (`npm run test:unit`)
- `integration` → run integration tests (`npm run test:integration`)
- `e2e` → run E2E tests (`npm run test:e2e`)
- `performance` → run performance tests (`npm run test:performance`)
- `coverage` → run with coverage report (`npm run test:coverage`)
- Any other string → use as a Jest pattern filter (`npx jest --testPathPattern="<filter>"`)

## Behavior

1. Run the requested test command
2. If tests fail:
   - Read the failure output carefully
   - Identify the root cause of each failure
   - Fix the failing tests or the code causing failures
   - Re-run to confirm the fix
3. If tests pass:
   - Report a summary of tests run, passed, and duration
