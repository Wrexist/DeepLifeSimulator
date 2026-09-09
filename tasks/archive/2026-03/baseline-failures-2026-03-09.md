# Baseline Failures Report

- Generated: 2026-03-09T20:27:11.935Z
- CWD: `C:\Users\IsacC\Downloads\DeeplifeSim-main OLD-WORKING(1.8.6)\DeeplifeSim-main`
- Mode: full (type-check + lint + test)

### Type Check Baseline
- Command: `npm.cmd run type-check -- --pretty false`
- Status: FAIL (exit 2)
- Duration: 51.9s
- Parsed: `{"errors":1274,"files":181}`
- Key output: `(no summary line matched)`

### Lint Baseline
- Command: `npm.cmd run lint`
- Status: FAIL (exit 1)
- Duration: 89.9s
- Parsed: `{"problems":16137,"errors":7979,"warnings":8158}`
- Key output:
  - `✖ 16137 problems (7979 errors, 8158 warnings)`

### Test Baseline
- Command: `npm.cmd run test -- --watch=false --runInBand`
- Status: FAIL (exit 1)
- Duration: 38.2s
- Parsed: `{"suitesFailed":24,"suitesPassed":12,"suitesTotal":36,"testsFailed":12,"testsPassed":130,"testsTotal":142}`
- Key output:
  - `Test Suites: 24 failed, 12 passed, 36 total`
  - `Tests:       12 failed, 130 passed, 142 total`
