# CI correction

The Node compositor and preview script explicitly import Buffer from node:buffer. This fixes the two no-undef errors in EAS Update run 985 without changing image output or disabling lint rules.

Both files pass node --check; repository lint:errors passes. Remote checks must complete before this PR is called ready.
