# Full-app audit — 2026-08-11

Automated layer clean, deep layer not. `npm run audit:weekly` passed all 53
invariants across the five domains before anything here was touched, and it
still passes now. Everything below came from reading for the classes a static
analyzer cannot see.

**Four live defects found and fixed. Three of them took money or gave it away.**

---

## 1. Dark-web hack minted money — CRITICAL

`contexts/game/ItemActionsContext.tsx` · `performHack`

The energy gate read `stateRef.current`, a ref synced by a **post-commit
effect**. Inside a single React batch that ref still holds the pre-batch state,
so two taps read identical energy and both passed. Energy is then written
`Math.max(0, …)`, so the second run was charged **nothing** and still paid the
full cash reward and the BTC.

Repeatable at zero energy for as long as taps landed in one batch. This was the
game's only outright money printer.

**Fixed:** `canRunHack(prev)` inside both updaters — the caught branch spends
energy and adds jail weeks too, so leaving it unguarded would have moved the
duplicate to the unlucky roll rather than removing it.

## 2. Gym session paid out free stats — HIGH

`app/(tabs)/market.tsx` · `handleGym`

Same shape, different clamp. The gate read the rendered `gameState`; the grant
went through `updateStats`, which routes money through `sanitizeAmount`
(returns 0 for anything ≤ 0) and energy through `clampStat` (floors at 0). The
second workout charged nothing and paid +5 fitness / +3 health / +2 happiness.

`disabled={!canUseGym}` could not help — it derives from the same render. The
gym-timer stamp was a **second** `setGameState`, so a refused charge still
bought a week of anti-decay protection.

**Fixed:** charge, payout and timer in one updater, re-checked against `prev`.

## 3. Warehouse upgrade — three bugs at once — HIGH

`contexts/game/company.ts` · `upgradeWarehouse`

The opposite clamp, and the most damaging of the three:

1. `money` was written by hand with **no floor**, so an overdraw stored a
   **negative balance** rather than being refused.
2. The level rose **twice**, straight past the max-10 ceiling.
3. Cost scales with level, so the second upgrade was billed at the **stale
   level's cheaper price**.

`buyWarehouse`, `buyMiner` and `sellMiner` in the same file all validate inside
their updater. This one was the outlier, so the fix makes it look like its
siblings rather than inventing a new shape.

## 4. Vehicle insurance never expired — HIGH

`contexts/game/actions/weekly/applyVehicles.ts`

`purchaseInsurance` charges a six-month premium and stamps a 26-week
`expiresWeek`. Three places **read** that field — to block re-buying an active
policy, and twice to prorate a cancellation refund — and not one ever expired
the policy.

The code that did expire it lives in `VehicleActions.processVehicleWeekly`, the
pre-`WeekContext` ancestor of the live reducer, which has **no production
caller**. It is reachable only from its own stress tests.

So a single premium bought **permanent coverage** — reduced repair bills and
reduced accident injury, on every vehicle, for the rest of the life. The
vehicle system's most expensive recurring purchase was a one-off.

**Fixed:** expiry runs in the live reducer before the accident roll reads
coverage, and is announced. A policy with no `expiresWeek` is left alone rather
than cancelled — a malformed record must not lose cover that was paid for.

---

## The root cause, and the guard now standing on it

Three of the four are one bug class: **CLAUDE.md §4.4's "gate → grant"** —
affordability checked outside a `setGameState` updater, the effect applied
inside, and the balance written by hand rather than through a helper that can
refuse.

What decided whether each *overdrew* or *paid out free* was the clamp at the
write site, and the clamp cut both ways: `sanitizeAmount` forgave the debt and
granted anyway (1, 2); a raw subtraction stored a negative balance (3).

`scripts/audit/audit-logic.cjs` gains **G5**, a ratchet counting hand-written
balance charges whose updater has no refusal path. Budget **2**, which is the
measured truth — and both remaining sites are dead exports, marked as such.

It is a ratchet rather than a threshold on purpose: this repo's own coverage
post-mortem records that a gate which cannot pass trains you to skim the
failure. **Raise it to get a build unstuck and the next real one walks in
behind it.**

While building G5 its first version reported `return prevState;` refusals as
bugs, because it hard-coded `return prev`. It now binds the updater's actual
parameter name. A check that fires on correct code is worse than no check.

---

## Verified clean (looked, found nothing)

| Area | Result |
|---|---|
| Hard Rule #7 — decorative accent bars | Clean. All 19 non-hairline one-sided borders are active-tab underlines, an allowed structural exception. |
| Timer leaks | Clean. Every file using `setInterval` has matching `clearInterval`. |
| Daily-gem claim | Correctly guarded; re-checks `canClaimDailyGemsFor` against `prev`, citing §4.4. |
| Skill-tree unlock | Correct — re-validates via `purchaseLifeSkill(prev, …)`. |
| Crime-skill upgrade | Correct — re-checks level, money **and** already-unlocked against `prevState`. |
| Food purchase, brand-deal breach | Correct — outer checks are documented fast paths; the real gate is inside the helper. |
| `TopStatsBar` quick actions | The reference implementation — `canPay(prev, …)` inside the updater. |
| Disease immunity, luxury risk, patent income | All live. Their unused exports are redundant helpers, not lost features. |
| Save/state integrity | 43 migration backfills all mirrored in `repairGameState`; every version 2–38 covered. |

---

## Open, not fixed

**88 exports are referenced only by tests.** Most are harmless redundant
helpers — but finding #4 came directly from this list, so it is worth a pass.
The dangerous shape is not unused code, it is unused code that *looks*
maintained: a full stress suite kept `processVehicleWeekly` looking alive while
the behaviour it uniquely owned had quietly stopped running.

Two worth naming:

- `contexts/game/actions/VehicleActions.ts::processVehicleWeekly` — now
  `@deprecated` with the two ways it has diverged from the shipped economy.
- `contexts/game/company.ts::createCompany` — a second, less-safe
  implementation; the UI calls the canonical one in `actions/CompanyActions.ts`.

Deleting either drops the G5 budget to 1.

**`utils/weekCounters.ts::resolveAbsoluteWeek` has no production caller** —
notable because CLAUDE.md §4.2 names it as *the* helper for the absolute clock.
Documentation and reality have drifted; one of them should move.

**Vehicle running costs bypass the arrears system.** The live reducer routes
them through `chargeOrDefer` correctly, but the deprecated duplicate still
clamps. Not player-visible today; would be if that function were ever revived.

---

## Release status

- Full suite **6,601 passing**, 1 skipped, 0 failures (+32 tests).
- `type-check` **0**, `type-check:tests` **0**.
- Lint **1,186** against a 1,193 ceiling — net zero new warnings.
- `npm run audit:weekly` — all five domains green, now including G5.
- `npm run preflight` — **exit 0** *only when RevenueCat env vars are set*.

Preflight §9 fails in a bare container with
`No receipt verification configured for a production build`. That is the
standing secrets gap, not a code defect: with placeholder RevenueCat keys the
run is **exit 0, 16 passes, zero failures**. Real keys are the owner's to set
in EAS and must never be committed.

Judge preflight by its **exit code**, never the banner — and note the wrapper's
exit code is not preflight's. During this audit a `npm run preflight > log;
tail` chain reported success because `tail` succeeded, while preflight itself
had exited 1.
