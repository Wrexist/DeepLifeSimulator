# CI gates and cadence

The EAS Update workflow retains its existing PR tests and main-branch OTA action.
The following checks close gaps without changing release or measurement bounds.

| Workflow | Runs when | Enforces |
|---|---|---|
| Quality ratchets | PR changes to app/components/contexts/hooks/src/lib, either liveops source, the scanner/baseline files, or this workflow; also manual | Existing UI ceilings, authored-content floors, 14-day liveops runway |
| Coverage ratchet | Monday 03:17 UTC on main; manual; PR changes to coverage workflow/configuration, shared test factories or package manifests | Full Jest suite and all four existing coverage floors |
| Preflight | Existing native/config/asset path filters and manual dispatch | Existing release preflight |
| Live ops calendar watch | Existing weekly/manual schedule | Early warning at its existing longer runway threshold |

GitHub schedules can run later than their nominal time. Ordinary documentation
changes do not trigger the two added workflows. Ordinary source changes still run
the existing EAS tests; weekly coverage checks the complete main branch, including
source changes that did not alter coverage configuration. Coverage is therefore a
weekly backstop, not a per-source-PR coverage guarantee.

Quality scanners use Node built-ins and need no dependency install. Coverage uses
the locked root dependencies and records JSON summary and LCOV artifacts for 14
days. A failed test run or missing/unreadable/below-floor report fails the job;
artifact upload never substitutes for a passed gate. No deployments or secrets
are used by either new workflow; token permissions are contents:read only.

To reproduce, run `node scripts/check-ui-ratchet.js`,
`node scripts/check-content-quality.js`, and
`node scripts/check-liveops-calendar.cjs`. For coverage, run
`npm run test:coverage -- --ci --runInBand`, followed by
`npm run coverage:ratchet`. Use a checkout containing tracked asset/capture
fixtures; a sparse checkout omitting them cannot pass store-evidence tests.

Never lower a floor, raise a ceiling, ignore a failing test, or remove a measured
source directory to make CI pass. Investigate the actual regression. These jobs
do not certify native devices, payments, privacy operations or store readiness.
