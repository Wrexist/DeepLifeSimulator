# TestFlight lint dependency failure

Baseline: origin/main `b48f4a69`. Failed run: 34655502072, verify/Lint.
Plan: identify all seven errors, install the missing locked tooling dependencies
in affected build jobs, parse workflows, rerun lint and inspect PR checks.

All seven errors are import/no-unresolved in the isolated asset tooling:
sharp, three, RoundedBoxGeometry, OrbitControls, GLTFExporter and GLTFLoader
(three is imported twice). The workflow installed only the root lockfile.
Root lint also checks art/game-assets-v1/source, which owns its own lockfile.
The existing EAS Update and preflight workflows already install both projects.

Add `npm ci --prefix art/game-assets-v1/source` before lint in cloud EAS build,
local iOS, iOS diagnostics and local Android workflows. Native compile-only and
submission-only jobs do not need this tooling. No dependencies, lint rules,
warning ceilings, runtime code or submission settings changed.

Validation: all workflow YAML parsed; all six jobs running root lint/preflight
have the asset install before that gate. Local lint result and latest PR checks
are recorded in the PR. The original job stopped before tests/build/submission;
this fix is not evidence of a completed native build. Rerunning the old job uses
its old workflow revision; a new run must select a revision containing the fix.

No build dispatch, merge, production publish or Apple submission performed.
