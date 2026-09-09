# Current work

Updated 9 September 2026. This is the short entry point, not a second release queue.
Verify current main, PR heads and provider records before acting.

## Start here

- [Master-prompt backlog](MASTER_PROMPT_BACKLOG.md): 35 scoped packages with dependencies and acceptance criteria.
- [Task guide](README.md): where plans and evidence belong.
- [Original ledger](archive/todo-before-cleanup-2026-09-09.md): the full previous task history, preserved verbatim.
- [Lessons](lessons.md): recurring engineering constraints and past corrections.

## Active release

[PR #203](https://github.com/Wrexist/DeepLifeSimulator/pull/203) merged the
release queue and save/research/validation fixes at `c32f2b9`.
Use the [remaining-work guide](release/REMAINING_WORK.md),
[release queue](release/queue.json), and [execution contract](release/CONTRACT.md).
[PR #206](https://github.com/Wrexist/DeepLifeSimulator/pull/206) owns follow-up
save/load timeout handling and evidence ancestry validation; its checks must pass
before integration. User authorized the reviewed merge loop on 9 September 2026.

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
R00/R01/R02/R03/R05 have recorded implementation evidence. #206 corrects unpublished
local commit references; native/store acceptance remains separate.

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

## MP00 integration review (active)

- [x] Inspect both PR heads, review comments and completed CI logs.
- [x] Repair the encoding fixture exception after its historical report moved.
- [ ] Verify cleanup CI and merge #205 at its checked head.
- [ ] Merge verified #206 save/load acquisition and evidence ancestry corrections.
- [x] Refresh merged #203 and integrate its release queue without restoring old TODO history.
- [ ] Refresh the release queue and execute the next eligible package.

Integration note: if #203 updates this file, retain its live release entries and
the navigation above. Do not restore the archived 1,500-line mixed history.
