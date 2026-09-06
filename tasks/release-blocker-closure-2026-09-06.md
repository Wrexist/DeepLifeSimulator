# Master Program 16 — Release Blocker Closure (2026-09-06)

Branch `claude/deeplife-release-blockers-7wcdpg`, cut from `main` at `47595f5`
(the merge of PR #192). Program 15's forensic audit
(`tasks/release-readiness-2026-09-04.md`) is the input; this program's only job
was to turn its findings into a tree that is safe to build from.

Not a new audit. Not a feature program. Every finding below is one Program 15
raised, re-proved on THIS head before anything was touched.

## 0. Baseline (Phase 0)

| item | value | source |
|---|---|---|
| HEAD at start | `47595f5` | `git log` |
| `origin/main` | **`47595f5` — identical.** Program 15's branch is merged | `git fetch origin main` |
| open PRs | none | GitHub API |
| package version | **2.13.0** | `package.json` |
| last iOS TestFlight build | run **#71**, 2026-09-04, on `d845b9e` — a **2.12.0** binary | Actions API, `eas-build-local-ios.yml` |
| builds since #192 merged | **none** | Actions API |
| STATE_VERSION | 51, unchanged (and unchanged by this program) | `contexts/game/initialState.ts` |
| full suite on the untouched head | **760 suites passed, 9 621 tests passed, 0 failed**, 17 suites / 32 tests skipped (the `RUN_*` soaks) | `npx jest --ci` |
| lint ratchet | 0 errors, **716 warnings (ceiling 716)** | `node scripts/check-lint.js` |
| type-check / test-tree ratchet | clean / 0 (baseline 0) | |

Two facts from that table do work later on:

- **`main` already carries every Program 15 fix.** The one open item on its
  RELEASE BLOCKERS list that was not a HUMAN action — "merge this branch" — is
  closed by observation, not by anything done here.
- **No build has been cut since.** So the 2.12.0 collision Program 15 found is
  still closed by its own bump: 2.13.0 is unshipped, and the next build is the
  first to carry it. No second bump is needed, and adding one would only make
  the changelog entry the suite pins go stale again.

## 1. The release blocker table (Phase 0 deliverable)

Severity is Program 15's grade. "Current status" is what re-proving on
`47595f5` found.

| ID | Finding | Sev | Root cause | Evidence re-checked here | Current status |
|---|---|---|---|---|---|
| **B1** | `npm run preflight` red on `main` — 721 lint warnings against a 719 ceiling | P1 | two warnings merged with PR #190's test file | `node scripts/check-lint.js` → **0 errors, 716/716** | **CLOSED** |
| **B2** | 2.12.0 already on TestFlight; the next build would ship a second binary with the same label | P1 | §9 "bump for every build" missed after the screenshot fixes | `package.json` = 2.13.0; Actions shows run #71 (2.12.0) is still the newest build | **CLOSED** |
| **B3** | Death screen "N yrs lived" divided the ABSOLUTE week counter | P1 | §4.2 — `weeksLived` is age-seeded | `DeathPopup.tsx:715` reads `weeksInThisLife`; `deathScreenLifeLength.render.test.tsx` green | **CLOSED** |
| **B4** | Spark Premium / Verified Pro cancel confirm raised from a `BaseModal` that hosted no `AlertHost` — dead tap on iOS | P1 | the derived guard matched `'<Modal'`, which `'<BaseModal'` does not contain | `BaseModal.tsx:243` renders `<AlertHost />`; `nestedAlertHosts.test.ts` green | **CLOSED in code.** Device confirm remains HUMAN |
| **B5** | Seasonal roll keyed on the week alone — every life of a starting age saw the same festivals | P1 | a local `Math.sin` PRNG outside `makeWeeklyRoll`, invisible to `weekOnlyRollAudit` | `seasonalEvents.ts:217` folds `lifeSalt(state)`; `seasonalEvents` + `weekOnlyRollAudit` + `simulationDeterminismAudit` green | **CLOSED** |
| **B6** | Merge the audit branch and cut the build from the merge commit | process | — | `origin/main == 47595f5` | **CLOSED** |
| **B7** | Native restore records the REAL store transaction id for a MIXED consumable | P2, **fixed** (not re-graded up: the RevenueCat path bypasses it) | the synthetic-id rule was named for `REVIVAL_PACK` and applied to that one product | see §3.1 | **CLOSED** |
| **B8** | `WeddingPopup` returns `null` when the partner name is missing, and is the only thing that clears its own flag | P2 → **fixed** | a renderer that declines does not release what the flag is holding | see §3.2 | **CLOSED** |
| B9 | Fresh-start gem stash lands before `deleteSaveSlot` | P3 | ordering | traced through `DeathPopup.tsx:566-606`, not fault-injected; see §4.1 | **POST-RELEASE — and the proposed fix moves the risk the wrong way.** Reasoning below |
| B10 | v11/v13/v14 migrations throw on a `null` array element | P3 | unguarded `for…of` over a stored array | **reproduced against the real `runMigrations`**: the throw is CAUGHT, the chain halts, the save stays loadable; see §4.2 | **POST-RELEASE**, no known producer |
| B11 | `AlertHost` runs a QUEUED alert's handler synchronously | P2 residual | a second alert keeps the Modal presented, so nothing is dismissing | analysed, not changed; see §4.3 | **POST-RELEASE** |
| B12 | `showZeroStatPopup` is a dead flag | P3 | — | **verified**: no production writer sets it `true`; only `false` is ever written | **no action, confirmed dead** |
| B13-B17 | Starved holidays, happiness saturation, `liveOps` claims across prestige, ad-orb vitality, chapter gems per life, Bank Pro "Week 104", live-ops P3s, WHATS_NEW trim, analytics flag | OWNER / P3 | — | unchanged on this head | **OWNER / POST-RELEASE** (unchanged list in `tasks/todo.md`) |
| B18 | Sandbox purchase + restore + relaunch, RC dashboard ids, iOS Modal presentation, VoiceOver, Dynamic Type, the first `eas env:exec` workflow run | HUMAN | — | run #71 predates the `env:exec` change, so that run has genuinely not happened yet | **HUMAN** |

**P0: 0, before and after.** Program 15 found none and neither did this pass.

## 2. What re-proving actually changed

Three of the graded findings moved, and each move is the point of the phase
that produced it.

1. **B7's reachability was mis-stated, in both directions.** Program 15 sent it
   post-release on the strength of "needs a save-I/O failure mid-purchase",
   which understates the human half: the second half of the trigger is *the
   player tapping Restore Purchases because their gems did not arrive*, the
   exact action the failure message directs them to. The recovery path was what
   destroyed the retry. It also OVERstates the exposure, which the audit did not
   check: with RevenueCat enabled the native loop is never entered, so this was
   never live for a correctly configured build. Both halves matter — the first
   is why it was fixed now, the second is why it is not graded P1.
2. **B9 moved SIDEWAYS.** The recommended fix — stash the carry-over AFTER
   `deleteSaveSlot` succeeds — inverts the risk rather than removing it, and
   the direction it inverts to is worse. Not doing it is the finding.
3. **B10 moved DOWN, with a sharper edge.** It cannot make a save unloadable —
   the migration failure is caught, recorded and non-fatal. But the halt is
   not self-healing in the way "next load retries" suggests. Details in §4.2.

## 3. The two blockers closed here

### 3.1 A restore may not spend the store's retry (B7)

**Where.** `services/IAPService.ts`, the native (non-RevenueCat) restore loop.

**The mechanism, in order.** `applyBenefit` records into the dedupe ledger
whatever transaction id it is handed. `setupPurchaseListener` dedups store
REDELIVERY against that same ledger and, on a hit, calls
`finishTransactionAsync` — which is what permanently removes the transaction
from the store's queue.

A MIXED product is a consumable that also carries permanent entitlements, so
the restore loop deliberately does not skip it: it re-applies the permanent
half with `entitlementsOnly`, dropping every quantity. The live example is the
$99.99 Mega Pack — 40 000 gems plus four perks and four banking unlocks. The
loop handed `applyBenefit` the **real** store transaction id for that
half-grant. So:

1. the pack is bought; the grant fails (app killed mid-purchase, save
   unwritable) and the transaction is deliberately left UNFINISHED so the store
   redelivers it — that is MON-6's retry, working as designed;
2. the gems never arrive, so the player taps **Restore Purchases**;
3. the restore applies the four perks and records the real transaction id;
4. the redelivery arrives, finds the ledger entry, and finishes the
   transaction;
5. the 40 000 gems are gone.

Paid once, received half, and the recovery path is what closed the retry.

**Why it was there.** The rule was already known. `REVIVAL_PACK` is defused two
branches above under a synthetic `native_restore:revival_pack` id, and its
comment states the general shape in as many words — "would mark an UNFULFILLED
pack purchase as done and stop the store redelivering it". It was applied to
one product rather than to the class. The RevenueCat loop, which is the
shipping path, got this right everywhere: it keys every restore on a synthetic
`rc_restore:${productId}`.

**Reachability, stated honestly.** With `EXPO_PUBLIC_USE_REVENUECAT=true` and
the RC key present, `restorePurchases()` returns before the native loop, so the
defect is **not on the shipping path**. It becomes live exactly when
`revenueCatService.isEnabled()` is false — which includes a build whose RC key
is missing, the case preflight §9 exists to catch and now (since #192) verifies
inside the EAS environment. This is the fallback path being made safe, not a
live customer-facing bug.

**Fix.** One pure function, `nativeRestoreLedgerId(productId, storeTransactionId)`,
next to `isNonIdempotentGrant`. A product whose quantities the restore drops
gets `native_restore:${productId}`; a plain non-consumable keeps the real id,
because that grant genuinely landed in full. One call site changed.

Deliberately **not** gated on the synthetic id (unlike the pack): the permanent
half must be able to repair a wipe on every tap, and the dropped quantities
make the re-apply a no-op — the same call the RevenueCat loop makes, for the
same reason.

**The sweep, so this is the last one.** All seven `applyBenefit` call sites
were enumerated: three are purchase / listener paths that grant in FULL under
the real transaction id (correct — the grant landed); one is the dev simulation
path with no id at all; the RevenueCat restore uses `rc_restore:${productId}`;
the native `REVIVAL_PACK` branch uses its own synthetic id. The site fixed here
was **the only one** handing a real store transaction id to an
`entitlementsOnly` grant.

**Test.** `__tests__/monetization/restoreLedgerIdentity.test.ts`, 5 tests. It
walks the real catalogue rather than naming a SKU, so a new mixed product is
covered the day it is added: every mixed consumable restores under a synthetic
id, those ids are distinct per product, none can collide with a numeric store
id, and every plain non-consumable still keeps the real one. **Verified to fail
without the fix** (3 of 5 red).

### 3.2 A raised flag must have something that can lower it (B8)

**Where.** `components/WeddingPopup.tsx`.

`showWeddingPopup` is written by the weekly tick and cleared by exactly one
thing: the player tapping Continue on `WeddingPopup`. The component returns
`null` whenever `weddingPartnerName` is missing — so the pair (flag set, name
absent) is a flag nobody can turn off. Nothing draws, and nothing offers the
tap.

It is not an idle flag while stuck. `showWeddingPopup` suppresses the
life-moment and weekly-event modals (`app/(tabs)/_layout.tsx:170,192,197`), the
home feed's popups (`home.tsx:145`), the ad orb, the premium promo and the
interstitial gate in `TopStatsBar`. A stuck flag silently retires every
interrupting surface in the game for the rest of the life, with no visible
cause and no way back — the Phase 3 invariant, in its quiet form.

**Fix.** An effect that clears the flag when the component declines to render
it, re-checked against `prev` inside the updater (§4.4) so a concurrent write
that supplies the name wins instead of being clobbered. The renderer that
declines is the only place that can release what it was holding.

**Honest about reachability.** The tick writes the flag and the name in one
state object (`GameActionsContext.tsx:3276-3277`), so the pairing holds today
and Program 15 was right to call it hardening. What makes four lines worth it
is the failure mode, not the odds: silent, permanent, and invisible to every
existing guard.

**Test.** `__tests__/render/weddingPopupSelfClear.render.test.tsx`, 3 tests: an
absent name clears the flag, an empty string is the same unrenderable state,
and a real wedding still renders and KEEPS its flag until the player taps —
that last one is the guard against the fix becoming a popup that dismisses
itself. **Verified to fail without the fix** (2 of 3 red).

## 4. Re-proved and deliberately NOT changed

### 4.1 The fresh-start carry-over ordering (B9) — the proposed fix is worse

`DeathPopup.tsx` stashes the gems and IAP entitlements the player keeps
(`stashNewLifeCarryOver`) **before** `deleteSaveSlot`. Program 15's note asks
for the reverse: stash after the delete succeeds, so a rejected delete cannot
leave a pending record beside a surviving slot.

That trade runs the wrong way. Reordering moves the failure from "a soft
currency could be applied twice, if a storage write rejects at exactly one
await" to "**a paid entitlement is destroyed**, if a storage write rejects at
exactly one await" — the player's purchases are in that record, and the slot
they were carried from is already gone by then. Phase 5's own invariant list
puts losing a paid benefit above duplicating currency, and the current order is
the one that fails in the safe direction.

If this is fixed later, the fix is a **two-phase record** (write pending →
delete → mark committed) that a later new-life build can reconcile, not a
swap of two awaits. Left on the POST-RELEASE list with that note.

### 4.2 A `null` array element in a pre-v11 save (B10) — reproduced

Run against the real `runMigrations` with `{ version: 10, careers: [null] }`:

```
version=10  applied=[]  errors=["Migration to v11 failed: Cannot read properties of null (reading 'startedWeeksLived')"]
```

It does **not** throw out. `runMigrations` catches, records and halts the chain
at the last good version; `loadGame` logs the errors and continues into
`hydrateLoadedState`, which repairs. **The save is loadable** — Program 15's P3
is right, and this is not the "unloadable save" class Phase 2 prioritises.

What the finding did not say, and what a second probe through
`runMigrations → hydrateLoadedState → runMigrations` establishes, is that it
never recovers either:

```
AFTER-HYDRATE  version=10  careers=[null]
SECOND-LOAD    version=10  errors=["Migration to v11 failed: …"]
```

The hydrated state keeps `version: 10`, and `repairGameState` does not strip
the `null`, so every subsequent load re-attempts the same migration and fails
identically. `runMigrations`' comment says the halt is so that "next load will
retry the failed migration (it may have been a transient failure)" — true for a
transient failure, and this one is not transient. Such a save would play on
forever un-migrated, with everything v11-v51 adds supplied by `repairGameState`
defaults instead of by its migration.

That is a sharper statement than "the ladder halts", and it is worth having
before anyone decides the priority. It does not change the grade: **no producer
of a `null` element is known**, and repair runs after migrations, so nothing in
the pipeline can create one. If it is fixed, three `??`-guards in v11/v13/v14
close it, and the reason is permanence, not the throw.

### 4.3 `AlertHost`'s queued-handler path (B11)

`dismiss()` runs a button handler synchronously when another alert is queued
behind it, because the Modal then stays presented (it swaps content), no
`onDismiss` will fire, and the single `pendingActionRef` would be overwritten
by the next dismissal before its timer ran — dropping a decision, which is the
bug the whole defer mechanism exists to prevent.

The residual hazard needs two alerts queued in the SAME nested host with the
first one's handler tearing down that host. No such caller was found. The
obvious fix — make the pending action a queue and always defer — is not free:
it would run handler #1 up to 350 ms late, i.e. potentially after the player
has already answered alert #2, reordering two decisions to close an unobserved
one. Left as Program 15 graded it, with the trade written down so the next pass
does not have to rediscover it.

### 4.4 `showZeroStatPopup` (B12)

Verified across the whole tree: every production writer sets it to `false`
(`ItemActionsContext`, `checkpointSystem`, the two simulators). Nothing sets it
`true`, and nothing renders it. Genuinely dead, and dead in the harmless
direction. No action.

## 5. What was NOT touched, on purpose

No `STATE_VERSION` change (Hard Rule 6 — the current shape expresses both fixes
exactly). No schema field. No migration. No balance number. No threshold, floor
or ceiling raised. Nothing on the weekly tick, in `lib/`, or in `contexts/`. No
guard weakened, skipped or quarantined. The whole diff is two source files, two
new test files, and documentation.

## 6. Gates (Phase 14)

Run on the changed tree.

| gate | result |
|---|---|
| `npm run type-check` | clean |
| `npm run type-check:tests:ratchet` | 0 (baseline 0) |
| `npm run lint:errors` | clean |
| `node scripts/check-lint.js` | **0 errors, 716 warnings (ceiling 716)** — the diff adds none |
| `npm run check:routes` | 17 routes, no conflicts |
| `npm run check:aso` | pass |
| `npm run check:content` | at or above every floor |
| `npm run check:liveops` | every stage has runway (compiled-in `early` quiet 40 d in the next 90 — the known Q4 on-ramp item) |
| `npm run ui:ratchet` | 152 / 94 / 652, all at ceiling — the diff adds no gradient, raw font size or heavy weight |
| `node scripts/preflight-check.js --platform ios` | **ALL PREFLIGHT CHECKS PASSED** (WARN: RC keys not verifiable locally, iOS interstitial id, 14 unreferenced images — the same three Program 15 recorded) |
| P1 regression set — `deathScreenLifeLength`, `nestedAlertHosts`, `seasonalEvents`, `weekOnlyRollAudit`, `simulationDeterminismAudit`, `happinessGainAudit`, `whatsNewFeed` | 7 suites / 126 tests pass |
| new regression tests | `restoreLedgerIdentity` 5/5, `weddingPopupSelfClear` 3/3 — and **both verified red without their fix** |
| `blockingPopupScroll` (the existing wedding-modal guard) | 2 suites / 20 tests pass |
| `RUN_REPRO_SIM=1 RUNS=2 WEEKS=100` — five personas, every field, every week | **5/5 identical** |
| `RUN_SAVELOAD_SIM=1 WEEKS=100 SPLIT=40` — continue from a round-tripped save vs straight through | **3/3 identical** |
| full `npx jest --ci` on the changed tree | **762 suites passed, 9 629 tests passed, 0 failed**, 32 skipped. Against the 760 / 9 621 baseline that is exactly the two new files (5 + 3 tests) and nothing else |

**Not re-run, and why.** The economy, social, early-game, event-delivery and
retention SOAKS are `RUN_*`-gated measurement harnesses; their standing GATES
(`economyBoundaries`, `socialBoundaries`, `earlyGameSurvivability`,
`eventReachability`, `retentionJourney`) run inside the full suite above and
pass. Nothing in this diff touches the weekly tick, `lib/` or `contexts/`, so
re-measuring those distributions would report Program 15's numbers back. The
one contract worth re-proving anyway was determinism, because it is the
cheapest to break by accident and the most expensive to discover late — hence
the soaks in the table.

**No new screenshots.** This diff changes no layout, so there is nothing to
re-photograph; Program 15's Playwright replay against a real web export still
describes the shipped surfaces (Hard Rule 10 — a device-rendering claim is not
made from source here, and none is made).

## 7. Scorecard (Phase 16)

Program 15's dimensions, re-scored on this head. Only two moved, and both
because a specific hole closed — not because the code got a second look.

| dimension | P15 | now | why it moved |
|---|---|---|---|
| startup safety | 90 | 90 | unchanged; startup suite green, `entry.ts` untouched |
| save integrity | 92 | 92 | unchanged. The two P3 edges were re-proved bounded; `carveOutRoundTrip` already pins every §7 carve-out through the real load |
| deterministic simulation | 94 | 94 | replay + save/load continuation re-run on the changed tree |
| economy integrity | 85 | 85 | untouched |
| social integrity | 82 | 82 | untouched |
| progression integrity | 85 | 85 | untouched |
| event integrity | 72 | 72 | untouched; starved holidays still OWNER |
| live ops safety | 84 | 84 | unchanged; compiled-in Q4 runway still the open item |
| **monetization safety** | 86 | **88** | the fallback path's fulfilment edge is closed and pinned against the catalogue, and the `applyBenefit` call sites are now swept rather than sampled; the remaining edge (no in-app retry on the RC failure branch) is UX, not loss |
| **modal / input safety** | 84 | **87** | the second "flag with no clearer" surface is closed; the `AlertHost` queued-handler residual remains, now with its trade written down |
| UI quality | 80 | 80 | no layout change |
| accessibility | 65 | 65 | still HUMAN |
| TestFlight readiness | 78 | 82 | branch merged, version valid and unshipped, preflight green, changelog entry present |
| release-process integrity | 80 | 82 | the blocker list is now closed-with-evidence rather than closed-by-assertion |

## 8. Counts

| | before (P15) | closed here | remaining |
|---|---|---|---|
| **P0** | 0 | — | **0** |
| **P1** | 5 | 5 (all by P15, all re-proved here) | **0** |
| P2 | 6 | 2 (B7, B8) | 4 — all OWNER copy or post-release |
| P3 | ~8 | 0 | ~8, two of them re-proved and re-scoped |
| OWNER | 9 | 0 | 9 |
| HUMAN | 6 | 0 | 6 |

## 9. Verdict

**YELLOW — every code-side release blocker is closed; specific HUMAN and OWNER
actions remain.**

Not GREEN, and the reason is not a code doubt. Four of the things that decide
whether this build is good cannot be answered from the repository: whether an
iOS device actually presents the confirm inside `BaseModal` (B4's fix is
structural and its guard is static), whether a sandbox purchase, restore and
mid-purchase relaunch behave, whether the EAS `production` environment really
holds the RevenueCat key now that preflight will FAIL rather than warn on it,
and whether VoiceOver and the largest Dynamic Type survive the death screen.
Those are the TestFlight matrix, and they are what YELLOW means here.

## 10. Exact next step

**Proceed to TestFlight matrix.**

Cut 2.13.0 from this branch's merge. Watch the first run of
`eas-build-local-ios.yml` in the Actions tab: it is the first run since
preflight moved inside `eas env:exec production`, so a genuinely missing
RevenueCat or save-signing key now fails the build by name instead of warning.
Then work the RELEASE VERIFICATION list in `tasks/todo.md` on the device.

The two owner calls — trimming the drafted v2.13.0 `WHATS_NEW.md` entry, and
deciding `EXPO_PUBLIC_ENABLE_ANALYTICS` — gate the STORE submission and the
telemetry, not the build. Neither needs to be resolved before the matrix starts.
