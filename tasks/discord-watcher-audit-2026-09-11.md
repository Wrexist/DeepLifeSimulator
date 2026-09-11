# Discord watcher failure — 11 September 2026

Base main e7e58e8c. No open PRs at initial refresh; #210 already merged.
Inspected Actions run 34578762105, both jobs. Webhook presence flags are true;
this is not evidence that either webhook points to the intended channel.

Both jobs say no prior state, seed a baseline without posting, then report
"No state change." The workflow uses git diff before git add: new untracked
state files are invisible to that test. The ephemeral runner discards them,
so the next schedule seeds again. Green workflow status did not mean delivery.

Fix: shared commit helper stages the explicit checkpoint first, checks the
index, commits only that file and rebases/pushes to main without force. The
activity job follows the release job and checks out fresh main, preventing the
two watcher commits racing each other. Up to three push attempts accommodate
unrelated main changes; conflicts/errors fail visibly. A real local bare-Git
fixture covers initial untracked state, unchanged state, independent checkpoints
and a later version update.

Validation: focused Jest 1 suite / 1 integration test passed, exit 0; the test
executes four checkpoint runs against a real local bare remote. Changed scripts
pass Node syntax and focused ESLint checks, exit 0. Workflow YAML parsed and
the sequential dependency was verified. No live webhook invocation was used.

Run summaries now distinguish BASELINE ONLY, NO POST, DRY RUN and Discord HTTP
acceptance. Missing webhook cannot advance an announcement checkpoint in a live
CLI run. Store checkpoints are written after each successful announcement and
the workflow persists them even if a later store post fails.

First fixed run intentionally saves current versions/current merged PR baseline
without announcing old releases. Later new events can be detected. No historical
backfill, workflow dispatch, Discord message or webhook change was performed.
Final delivery verification still requires a real eligible event or an explicitly
authorized test announcement and checking its destination. A network acceptance
followed by failure to save state can still cause a retry; this is not a claim
of exactly-once external delivery.
