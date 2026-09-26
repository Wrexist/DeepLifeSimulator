# Independent game-logic audit — 2026-09-26

Revision inspected: `9a4422c6`. Audit only; no gameplay or tracked source changed.
Scope: life clocks, financial planning/readouts, canonical weekly recap, education,
business action atomicity/feedback, relationship anniversaries and weekly claims.

## Confirmed current defects

### L1 — P2: FIRE savings rate and estimated years depend on starting age

- `lib/statistics/fireTracker.ts:62` divides current savings by absolute
  `weeksLived`; `:69` and `:73` reuse that amount for years-to-FIRE.
- `components/computer/StatisticsApp.tsx:590` and `:591` display the results.
- Reproduced by calling the production helper with otherwise identical state:
  $1,000 savings, $1,000 weekly salary, four weeks played. Age-18 baseline
  `(weeksLived=4, lifeStartWeek=0)` reports 25%; age-20 baseline `(108,104)`
  reports approximately 0.93%. Estimated years also rise solely due to age seed.
- Proposed fix: use life-relative elapsed time for any lifetime estimate, plus a
  defensible actual savings-flow basis (see L4); add equal-progress/different-
  starting-age regression. This affects displayed planning, not cash balances.

### L2 — P2: Business campaign can announce success after commit rejection

- `contexts/game/actions/HustleActions.ts:503` / `:505` correctly refuse a
  latest-state funds/energy failure; `:513` nevertheless immediately returns
  `success: true, message: 'Campaign launched'`.
- `components/mobile/Hustle/modals/LaunchCampaignModal.tsx:72`–`:80` consumes
  that response to play success haptics, save, show success and clear inputs.
- Reproduced against the production action: snapshot has 50 energy; captured
  updater receives latest state with 0. The updater returns that unchanged
  state with zero campaigns, but the returned response says success.
- Proposed fix: report the committed action outcome through the canonical
  transaction/result mechanism; only acknowledge after success. Keep existing
  atomic refusal. Test funds/energy races and a successful launch. This is a
  misleading-feedback defect; the reproduced case does not lose money.

### L3 — P2: Profile reports contradictory elapsed weeks

- `app/(tabs)/progression.tsx:315` uses `${gameState.weeksLived} weeks` in Life
  Stats summary, but `:319` uses `weeksInThisLife(gameState)` for its expanded
  Weeks Lived value. A new age-20 character therefore reads 104 weeks vs 0.
- Proposed fix: shared life-relative elapsed-week formatting for both views;
  verify age18, age20, age25 and inherited lives. Source-confirmed; visual case
  not independently recaptured by this reviewer.

## Source-backed UX / product issues

### L4 — P2: FIRE figures are unlabeled assumptions and account stock, not measured savings

- `lib/statistics/fireTracker.ts:45`–`:50` assumes expenses are 70% of salary,
  with a $15,600 annual floor, rather than actual recurring expenses.
- `:62` treats the current legacy savings-account balance as cumulative saved
  income. Moving cash into/out of that account changes the claimed savings
  rate without changing earnings or net worth; other deposit accounts are not
  in this numerator.
- `components/computer/StatisticsApp.tsx:564`–`:600` labels FIRE number,
  Years to FIRE and Savings rate without exposing those assumptions.
- Proposed fix: choose actual cash-flow history for measured savings, or label
  this explicitly as an estimate and explain basis/unavailable history. Don't
  manufacture missing transaction history. Separate from the L1 clock defect.

### L5 — P3: Many secondary screens expose internal absolute week stamps

- `components/computer/AdvancedBankApp.tsx:451` displays `Week 104` on an
  age-20 fresh life; `:1043` / `:1177` show raw opened/inquiry stamps.
- `components/mobile/BankApp.tsx:416` / `:618` repeat those raw stamps.
- `components/mobile/ContactsApp.tsx:867` shows NPC life event `(wk N)`;
  `components/computer/VehicleApp.tsx:763` shows raw expiry week;
  `components/computer/StatisticsApp.tsx:221` / `:232` show raw record weeks.
- These are valid internal monotonic timestamps, but inconsistent player-facing
  vocabulary alongside the new Home week record, month/year HUD and life-relative
  Profile value. Proposed fix: one display formatter with calendar dates or
  elapsed/remaining descriptions, preserving absolute counters in all mechanics.
  Existing pre-life stamps need an honest fallback, not negative week labels.

### L6 — P3/product backlog: Politics schema still contains deliberately inert systems

- `lib/politics/policies.ts:69`–`:103` explicitly documents and excludes eight
  inert policy-effect keys (property tax/price effects, crypto regulation and
  stability, R&D/patents/grants, unused price index) from rendered benefits.
- This is not a newly discovered false-advertising defect: display hiding is
  intentional and already fixed. A complete product roadmap must decide which
  systems will be built and which remain unsupported. Do not list historical
  hidden-benefit bugs as current, or turn this into an automatic scope expansion.

## Checks actually completed

Command: `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath`
with the following paths, captured in `tmp-bugaudit/audit-logic-tests.log`:

- `__tests__/simulation/weeklyRecapCash.test.ts`: production week transition,
  rent/prepaid rent, arrears, actual cash and realized property income.
- `__tests__/actions/educationActions.test.ts`: enrollment/class selection and
  study-group atomicity/refusals.
- `__tests__/economy/hustleReputationAtomicity.test.ts`: committed/rejected
  business costs and reputation remain atomic.
- `__tests__/dating/anniversaryIdempotence.test.ts`: anniversary repeat protection.
- `__tests__/actions/weeklyChallengeReward.test.ts`: weekly reward claim guards.
- `lib/statistics/__tests__/fireTracker.test.ts`: existing planning tests.

**Exit 0; 6 suites / 31 tests passed; 12.817 s; zero snapshots.** Existing FIRE
tests omit lifeStartWeek, so their pass does not refute L1.

Scratch reproduction command uses `--runTestsByPath
tmp-bugaudit/audit-logic-repro.test.ts`. **Exit 0; 1 suite / 2 reproduction
checks passed; 16.55 s.** These assert the defects exist, not that they are fixed.
Log: `tmp-bugaudit/audit-logic-repro.log`.

## Unreached acceptance, not inferred defects

- Full player journeys through education graduation/exam failure, business IPO/
  merger/liquidation, family birth/divorce/inheritance, debt default and bankruptcy
  were not visually replayed in this bounded review.
- Long-lived/multi-generation save economy conservation was not rerun here.
- Real-device double taps, VoiceOver feedback, slow save, background/kill/relaunch
  and presentation of all financial refusal paths remain device acceptance.
- Source/fixture tests cannot certify the signed build, StoreKit, ads or network
  provider correctness.

Next concrete logic task: fix L1/L3 together as a small life-clock/readout PR,
then implement committed action feedback for L2 with its captured-updater race
as a permanent behavioral regression. Decide L4 measurement semantics before
changing the financial-planning formula.
