# Active plan — four owner decisions (2026-08-02)

Previous plan (C-1 … C-4, 2026-08-01) shipped in full; superseded here.

---

## 1. Hard Rule #7 — the two remaining side accent bars

**Decision: tinted background, no border.**

Correction to my own earlier report: I described these as "one-sided colored
borders". They are not. They are 3px-wide `<View>` stripes
(`stripe: { width: scale(3) }`) with a semantic `backgroundColor`. The rule bans
"side accent bars" by name, so the flag stands — but a `borderLeftWidth` grep
never would have found them, and the `borderBottomWidth` lines in the same rows
are neutral `theme.border` hairline dividers, which the rule explicitly allows
and which stay.

- [x] `components/stocks/StockRow.tsx:231` — sector-colored stripe → tinted row background
- [x] `components/mobile/StocksApp.tsx:944` — buy/sell-colored stripe → tinted row background
- [x] Regression test: no stripe view remains in either row, and the semantic
      color still varies with sector / side, so the fix does not silently drop
      the meaning it was carrying

## 2. Credit-card screen — "list won't scroll at all"

Read all four credit-card surfaces. `AdvancedBankApp` (main + credit detail) and
mobile `BankApp` are structurally correct: a `flex: 1` ScrollView under a
`flex: 1` root, with proper bottom padding.

`components/banking/ApplyCardModal.tsx:112` is not:

    <ScrollView style={{ maxHeight: scale(360) }}>   // fixed cap, no flexShrink

inside a sheet with `maxHeight: '90%'` holding a column of header + subtitle +
list + conditional reject notice + Apply button. A fixed `maxHeight` cannot give
space back, so on a short screen the column overflows the sheet and the Apply
button is pushed outside it — with nothing scrollable to reach it, because only
the inner list scrolls and the sheet itself does not.

- [x] Replace the fixed `maxHeight` with `flexShrink: 1` so the list takes
      whatever is left after the header and button, at any screen size
- [x] Regression test: the modal declares no fixed-height list, and the Apply
      button is a sibling of the list rather than inside it

**Not confirmed as the reported screen.** This is a real defect on its own merits
and it matches the symptom, but there are four card surfaces and I do not know
which one the screenshot showed. Report it that way — do not claim the player's
report is closed.

## 3. Player portrait — "age, keep identity"

**Decision: portrait moves through age brackets, same person and gender.**

The parents-aging-into-the-wrong-gender bug is already fixed (`utils/facePool.ts`
— `hero_grandparent.png` moved to the male bucket, `HERO_FACE_SEX` added,
`getAvatarPortrait` switched from `Math.min` to `index % bucket.length`).

- [x] Verify the player's own avatar resolves through the same age-bracket path
- [x] Verify identity is stable: same avatarId keeps one sex across all brackets
- [x] Regression test: sweep one avatarId across the full age range; assert the
      sex never changes and the bracket does
- [x] FOUND AND FIXED: `index % bucket.length` scrambled slot ordering across
      bands (`f7` → 1,7,1,2,3). Now proportional, so ordering survives.
- [x] CLOSED, not escalated: I over-graded this. Single-player, and NPCs
      already share the same finite buckets via `hashSeed % len`. The
      player-visible property is fixed and pinned.

## 4. MON-5 Revival Pack — "one banked revive, consumed on death"

The $2.99 pack currently revives only at the instant of purchase, so buying it
while alive is a permanent no-op. Biggest item here: it needs new state.

- [x] `contexts/game/types.ts` — field ALREADY existed (`revivalPack: boolean`), dead since day one
- [x] `contexts/game/initialState.ts` — default already `false`; `STATE_VERSION` 29 → 30
- [x] `utils/saveMigrations.ts` — v30 migration
- [x] `utils/saveValidation.ts` — `repairGameState` mirror **if** the default is
      concrete; skip both if it is `undefined` (the v26/v27/v28 carve-out).
      Decide from the chosen shape; whatever is written must set `repaired = true`
- [x] `__tests__/helpers/createTestGameState.ts` — already listed in requiredFields
- [x] IAP grant path — banks instead of reviving inline
- [x] Death flow — `reviveWithPack`, both gates + spend in one updater (§4.4: gate and decrement in
      the SAME updater, or a double-tap prints lives)
- [x] Restore carve-out KEPT — now correct for the right reason: re-granting a bankable one-shot on every restore would mint a life each time
- [x] Docs: `CLAUDE.md` §7 v30 entry, `DEV.md` / `WORKFLOW.md` synced

**Not device-verifiable here.** The StoreKit sandbox needs a TestFlight build;
everything below the IAP boundary is testable in Jest.

---

## Standing constraints

- Every behavioural fix proved RED against the pre-fix tree before green.
- Every suite carries a control asserting what must NOT change.
- Gate before each commit: `tsc` on both configs (test ratchet now **0**),
  `eslint --quiet`, full Jest, `npm run audit:weekly`.
- PR #100 check-ins until merged or closed.
- [x] `as GameState` sweep (Hard Rule #3): 64 → 2. Both survivors are
  DELIBERATE corruption fixtures — a test that proves the code survives
  garbage must be able to construct garbage. That is the floor, not a backlog.

## Open for the owner

Nothing blocking. Two things are informational:

- **Revival Pack is a non-consumable**, so it is one revive ever — which is what
  was chosen. Making it repeatable needs the product changed to a consumable in
  App Store Connect first; not a code change.
- **MON-5 is not device-verified.** StoreKit sandbox needs a TestFlight build.
  Buy while alive, then die and spend, is the flow.
