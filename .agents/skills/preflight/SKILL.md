---
name: preflight
description: Run full preflight checks (type-check, lint, tests) before a release build
---

# Preflight Check

Run the complete preflight validation suite for DeepLife Simulator before any release or TestFlight build.

## Steps

1. Run TypeScript type-check: `npx tsc --noEmit --pretty`
2. Run ESLint: `npx eslint . --ext .ts,.tsx`
3. Run unit tests: `npm run test:unit`
4. Run integration tests: `npm run test:integration`
5. Run the full preflight script: `npm run preflight`

## On Failure

- Report which step failed with the exact error output
- Suggest a fix for each failure
- Do NOT proceed with the build until all checks pass

## On Success

- Report all checks passed with a summary
- Ask the user if they want to proceed with an EAS build
