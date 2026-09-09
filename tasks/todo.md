# Current work

Updated 9 September 2026. This is the short entry point, not a second release queue.
Verify current main, PR heads and provider records before acting.

## Start here

- [Master-prompt backlog](MASTER_PROMPT_BACKLOG.md): 35 scoped packages with dependencies and acceptance criteria.
- [Task guide](README.md): where plans and evidence belong.
- [Original ledger](archive/todo-before-cleanup-2026-09-09.md): the full previous task history, preserved verbatim.
- [Lessons](lessons.md): recurring engineering constraints and past corrections.

## Active release

[PR #203](https://github.com/Wrexist/DeepLifeSimulator/pull/203) owns the current
release queue and save/research/validation fixes. While that PR is unmerged,
use its [remaining-work guide](https://github.com/Wrexist/DeepLifeSimulator/blob/codex/fresh-release-workflow/tasks/release/REMAINING_WORK.md)
and [queue](https://github.com/Wrexist/DeepLifeSimulator/blob/codex/fresh-release-workflow/tasks/release/queue.json).
Once integrated, those same files are local under `tasks/release/`.

| Package | Remaining acceptance |
|---|---|
| R11 | Verified provider/operator facts, accurate live privacy/support and store answers |
| R04 | Reached player journeys and visual acceptance |
| R08 | Exact signed production candidate and processed TestFlight identity |
| R06 | Native purchases, interruption, recovery and Restore |
| R09 | iPhone/iPad lifecycle, ads, accessibility and performance |
| R07 | Current store record, release notes, locales and native screenshot parity |
| R10 | Complete evidence and submission packet |

The release remains HOLD until the required evidence exists. Do not reuse stale
“dispatch 2.13.0” instructions without checking current build/store records.
R00/R01/R02/R03/R05 have recorded evidence on #203; unmerged code is not main.

## Recently merged

| PR | Finished implementation | Still separate |
|---|---|---|
| #197 | Purchase persistence/recovery, legacy migration repairs, journal and claim continuity | Native and cross-install recovery boundaries |
| #199 | Education quotes/atomic enrollment and loan/pension cash-flow corrections | Full post-bills forecast and optional deferment |
| #201 | Compact HUD and one first-job/goal surface | Native layout/accessibility acceptance |
| #200 | Reusable assets and recap presentation | HomeScene intentionally not mounted on Home |
| #204 | Ten game-themed store stories in three sizes | Native parity and current store upload |

## Next product work after release

1. MP08: authoritative cash/arrears/rental/noncash forecast before commitments.
2. MP09: causal weekly recap with useful actions.
3. MP10–MP13: path discovery, connected arcs, deliberate relationships and non-wealth endings.

Later experiments, maintenance, Android and marketing remain separate packages
in the backlog. Historical hypotheses are not confirmed defects.

## Repository cleanup

- [x] Inspect current source, PRs, TODOs and literal source markers.
- [x] Archive old reports, preserve historical evidence and add navigation.
- [x] Remove only verified unreferenced generated outputs from `undefined/`.
- [x] Verify references/content preservation and relevant local checks.
- [x] Publish [cleanup PR #205](https://github.com/Wrexist/DeepLifeSimulator/pull/205) and inspect latest CI. Full remote checks remain pending.

Integration note: if #203 updates this file, retain its live release entries and
the navigation above. Do not restore the archived 1,500-line mixed history.
