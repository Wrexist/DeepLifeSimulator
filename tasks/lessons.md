# Lessons Learned

<!-- Updated after every correction. Reviewed at the start of each session. -->

## Patterns to Watch For

### 2026-08-05 - Feature round: a test that pins a version number is a tripwire, and three caps that had to be proven to bind

- **A test that hard-pins `STATE_VERSION` fails on every correct future bump.**
  `luxuryHoldingsMigration` asserted `STATE_VERSION === 32`, so shipping v33
  broke a test in an unrelated file that had nothing wrong with it. The C-11
  suite had ALREADY been fixed for this exact reason and left a comment saying
  so — which is the tell that this is a pattern, not an accident. What a
  migration test should assert is that `STATE_VERSION === CURRENT_STATE_VERSION`
  and that no version in the chain is unregistered; today's number is not the
  invariant. Same shape as the career test that pinned `levels.length === 6`
  while its own name said "no longer short" — a floor written as an equality
  becomes a ceiling.
- **A bound that never binds proves nothing.** Three separate caps landed this
  round (luxury hosting multiplier, event money fraction, grandchildren per
  child), and in each case the useful test is not "the result is ≤ cap" — that
  passes when the cap is unreachable — but "the uncapped value EXCEEDS the cap,
  and the capped one equals it". The grandchildren test runs 6,000 weeks and
  asserts both that the bound holds and that births actually happened.
- **Check a threshold against the curve before choosing it.** I set the new top
  dynasty rank at 5,000 because it was a round number; the test I wrote first
  showed a deep-but-plausible 60-generation family scores ~2,700, so the rank
  was decoration. Derive thresholds FROM the growth function, then sanity-check
  with a realistic worst case.
- **A per-source income cap can turn a "risky" feature into a safe one.**
  Conglomerate read as the highest-risk item on the roadmap until
  `PER_SOURCE_CAPS.companies` turned out to be a hard $200k/wk ceiling that the
  five maxed originals already exceed. Every subsidiary therefore adds cost and
  no income. Rule: before assuming a feature moves the economy, find the cap
  that already governs it — the answer changes the design, not just the risk.
- **Derived progress beats stored progress whenever the metric only increases.**
  Legacy Contracts store only claimed ids; progress is read from lifetime
  counters. That removes an entire class of bug (drift, double-credit on a
  re-run tick) and has a real player benefit: an existing save loads with its
  contracts already part-complete instead of starting from zero.
- **An optional parameter is how you extend a hot path without touching its
  callers.** `applyChildAging(rel, weeksLived?)` rolls grandchild births only
  when a clock is supplied, so every existing caller and test kept working and
  the conservative default (no births) is the safe one.


### 2026-08-05 - Follow-up: the legacy shop had no buy button, and three navigation gates that disagreed with themselves

- **A shipped, tested, context-exposed system with no call site is not shipped.**
  `purchaseLegacyUpgrade` lived in `MoneyActionsContext`, was exported on the
  context value, and had 20+ passing tests. `PrestigeShopModal` displayed the
  Legacy Points balance. **No screen anywhere called the action**, so the entire
  currency was unspendable in the app — a readout next to a locked door. This is
  the SAME session's `feedbackSystem` bug in a different costume, and the third
  time this file has recorded it (`applyBenefit` 2026-06-30,
  `applyWeeklyInflation` 2026-08-04). The pattern is now unmistakable: a leaf
  with green tests, a context that exposes it, and nothing that calls it. Rule:
  when a feature's whole value is that a PLAYER can reach it, one test must
  assert a screen reaches it. A grep for the symbol across `components/` and
  `app/` is a one-line assertion. Sibling offenders still open:
  `lib/automation/` (7 files, ticked weekly, zero UI) and `getDynastyTier`
  (6 tiers, zero consumers).
- **Two surfaces enforcing the same gate must read the same state.** `home.tsx`
  pushed `/(tabs)/progression` with no unlock check while `life.tsx` locked the
  identical destination behind `tab:progression` — so the padlock read as
  broken. Fixing it exposed a second, subtler bug: `home.tsx` subscribes through
  a NARROW selector, and `unlockTier()` reads `completedChapters` and
  `generationNumber`, neither of which the selector carried. Calling the helper
  with a partial state would have scored the chapter path 0 and left only the
  money/weeks fallback — showing a lock the other screen doesn't. Rule: before
  calling a helper with a selector slice, check every field the helper actually
  reads. A narrow selector silently returns wrong answers rather than throwing.
- **An id that differs between two screens is a dead link waiting to happen.**
  The pet app was `paw` on one grid and `pet` on the other. Badges set both,
  `featureUnlocks` registered both — the only layer that did NOT was the `?app=`
  deep link, which resolved `undefined` and bounced silently. Nothing shipped
  that link yet, which is exactly why it was worth fixing: it was a trap for the
  next notification tap anyone added.
- **My own mistakes this round, both caught by tests I wrote first:** a
  source-scanning test anchored on `const apps`, which also matched
  `const appsList` (the descriptor ARRAY) and scooped up its `id`/`name`/`icon`
  keys — so it passed on noise, and two of its three assertions were vacuous.
  And a "every branch has exactly one root" assertion that failed correctly:
  parallel chains within a branch are a real tree shape, so the rationale was
  wrong, not the data. Rule: when a test parses source, assert the PARSE first —
  a regex that matches nothing makes every later assertion vacuous.

### 2026-08-05 - Whole-game audit: three feedback channels that rendered nothing, and a suppression that outlived its reason

- **A message bus with a gate on it is not a message bus.**
  `feedbackSystem.{success,error,warning,info}(message)` routed every message to
  `showAchievementToast(message, category, **0**)`. That helper gates on
  `reward > 0` — correctly, so tips and warnings can't hijack the branded
  "ACHIEVEMENT UNLOCKED!" popup — and the reward was hard-coded 0 at all four
  call sites. So for as long as the code has shipped, **every message handed to
  `useFeedback()` was silently discarded**: the phone buzzed and nothing
  rendered. A refused action ("Already done that this week", "Need $12 to grab a
  healthy meal") was indistinguishable from a successful one, which is the most
  likely single source of "I tapped something and don't know what happened."
  Both halves were individually correct — the gate, and the helpers. Only the
  wiring between them was wrong, and nothing asserted the wiring. This is the
  `applyWeeklyInflation` post-mortem (2026-08-04) and the `applyBenefit` one
  (2026-06-30) for the third time: **"is it called?" is a different question
  from "does it work?", and only one of them had a test.** Rule: when a helper's
  entire value is that it *reaches a renderer*, one test must assert the route,
  not the leaf.
- **Deleting a severity tier to fix a position bug throws away the one message
  type that must never be optional.** `warning` toasts were dropped at the
  provider with the comment "they were noise that overlapped the status bar."
  The overlap was real; the remedy silenced every rejection on the Work screen —
  job application, promotion, raise, retirement, failed street job. Worse, a
  later fix was written *against* that dead channel: `work.tsx` carries a comment
  saying "a rejection used to be silent… UX-2", so the bug it claims to fix was
  still shipping. The toast component already supported `position: 'bottom'`
  with safe-area offsets. Rule: fix a layout problem in the layout. If a whole
  category of feedback is being suppressed, the suppression is the bug.
- **A dismissal that resets is worse than no dismiss button.** Contextual tips
  cleared their dismissed set on every `weeksLived` change, so a player under $50
  dismissed "Running low on cash?" and it returned on the very next Next Week,
  forever. An X that does nothing teaches the player that the app ignores them.
- **`Math.max(x, 1)` inside a grant undoes the guard outside it.** The
  welcome-back bonus stamped `lastLogin = now` inside its updater (correct), but
  `computeWelcomeBackBonus` floors `daysAway` at 1 — so a second `onClose` in the
  same React batch saw `daysAway = 0`, clamped it back to 1, and paid another
  half-week of salary. The gate→grant rule (§4.4) is not satisfied by stamping
  state; the updater must also **return `prev` unchanged** on the rejected path.
- **An optional offer must never outrank a required dialog.** The ad orb sat at
  `Z_INDEX.TOAST` (400), above the `MODAL` layer (300), so it floated over the
  weekly result sheet and the death screen. The premium promo respected no
  blocking guard at all and could land on top of a death. Rule: anything the
  player can ignore belongs *below* anything they must act on, and a deferred
  popup must re-check its guard **at fire time**, not when its effect ran.
- **My own mistake this session:** the first version of the stale-tab-copy guard
  used an allowlist of valid tab names and flagged "the Jobs tab of the Onion
  Browser" and "the Miners tab" — legitimate sub-tabs *inside* an app. A
  denylist of the specific removed tabs was the correct shape. Rule: when the
  rule is "these specific things are wrong", encode that, not "everything except
  these is wrong."

### 2026-08-04 - Critical review: a zero-drift random walk, a system with no callers, and three of my own mistakes

- **A zero-mean ARITHMETIC return is a negative GEOMETRIC one.** `simulateWeek`
  stepped stock prices with `price *= (1 + z·σ)` and no drift term, which is
  `E[log ratio] ≈ −σ²/2` per week. At the 8% weekly vol on TSLA/NVDA/META/NFLX
  that is −0.32%/week: driving the real pipeline for ten game years left 22 of 25
  symbols down with the median at 0.32×, and at forty years four symbols sat on
  the $0.01 clamp. Because the walk is seeded on `weeksLived`, this was not
  variance — it was the same guaranteed collapse in every save on every device.
  Fixed with a log-normal step (`exp(μ + σz)`) plus a volatility-scaled risk
  premium, so more volatility now earns more expected return instead of less.
  Rule: any multiplicative random walk needs its drift stated explicitly, and the
  test that guards it must assert the OUTCOME after N steps, not that the output
  is finite. The old suite checked prices stayed positive and inside the clamp —
  all true of a market on its way to zero.
- **"Is it called?" is a different question from "does it work?", and only one
  of them had a test.** `applyWeeklyInflation` had ZERO production callers:
  `MoneyActionsContext` imported it and used it nowhere. So `economy.priceIndex`
  was frozen at 1 forever, every `getInflatedPrice(x, 1)` was a no-op, and the
  R4-X7 change that routed policy `inflationRate` into it connected a pipe to a
  dead function. `policyEffectsHonesty.test.ts` was green throughout because it
  calls the leaf helper directly — the exact failure the `applyBenefit`
  post-mortem (2026-06-30) already recorded. Same for `resetStockPrices`, whose
  docstring said "used on prestige/new game" while its only callers were tests,
  so a new life inherited the previous life's market. Rule: for any helper whose
  value depends on being INVOKED, one test must assert reachability from the
  entry point. A grep for the symbol across non-test files is a valid assertion
  and takes one line.
- **A cap derived from the thing it caps is not a cap.** My first arrears
  implementation compounded a weekly surcharge on the standing debt and bounded
  it with `Math.max(carried, …) * 3` — a ceiling that grew with the balance. A
  player with no income watched $1 000 reach $144 755 over ten years. Replaced
  with a flat late fee on what was MISSED that week, so the balance can only grow
  on a week the player actually failed to pay. Rule: a bound must be anchored to
  something that does not move.
- **Two constants describing one thing will disagree.** `WEEKS_PER_MONTH = 4`
  and `WEEKS_PER_YEAR = 52` (4 × 12 = 48), and the tick used one for the week
  label and the other for the month, so they desynchronised on the first month
  and drifted a step every third. Fixed by deriving both from one divisor in
  `resolveCalendar`. My first version then reintroduced the identical off-by-one
  one line down by flooring the month-start week instead of ceiling it — caught
  only because the test sweeps all 200 weeks asserting "label is 1 IFF the month
  changed" rather than spot-checking a few values.
- **Three of my own errors this session, all caught by tests I wrote before
  believing the code:** the arrears ceiling above; a 0.02 risk premium that
  compounded to ~8 000× over a life; and an empirical "volatile names pay more"
  assertion that was really a coin flip, and failed for a third reason entirely
  (at a 200-year horizon every symbol was resting on `MAX_STOCK_PRICE`, so it was
  comparing opening prices). Rule: when the property is a relationship between
  parameters, assert it on the FUNCTION, not on a simulated sample where
  dispersion drowns the signal.
- **Repo weight and download weight are different numbers.** I reported 67 MB of
  unreferenced assets as a shipping problem. It is not: Metro bundles only what a
  static `require()` reaches, verified by diffing a real `expo export` against
  the tree. The actual problem was the 234 MB that DOES ship — over Google Play's
  200 MB base-AAB limit — and no preflight section looked at it. Rule: measure
  the artifact, not the source tree, and validate any static estimate against one
  real build (234.0 MB predicted vs 234 MB bundled).
- **`setGameState`'s updater does not run at the call.** I tried to thread the
  real confiscated amount out of a `setGameState(prev => …)` into a message built
  on the next line; the variable is still unset there. When the honest number is
  unavailable at message time, state the RULE ("10% of your cash") rather than a
  figure that can be wrong.

### 2026-07-20 - Weekly audit: GameState schema drift — 4 fields added to initialState AFTER the version bump, no migration/repair

- What went wrong: `luxuryItems` (Luxury & Collectibles, commit `5e3cdf1`) and `ambitionId` /
  `ambitionCompletedMilestones` / `ambitionRewardClaimed` (Life Ambitions, commit `ffd82cc`) were
  added to `contexts/game/initialState.ts` on 2026-07-13, TWO days after `STATE_VERSION` was bumped
  to 22 and `migrations[22]` was written (`9ddff7e`, 2026-07-11). The version was never bumped to 23,
  so `migrations[22]` doesn't set them and `repairGameState` didn't backfill them → every existing
  v22 save loads with these fields `undefined`. Not an active crash today ONLY because every consumer
  happens to guard (`?? []`, `!!`, `|| []`), but that is one un-guarded future reader away from a
  crash on the entire installed base — the exact "GameState drift" Hard Rule #3 exists to prevent.
- Why the static audit missed it: `audit-save.cjs` verifies migrations `[2..N]` are all *covered*
  and that `STATE_VERSION` matches the docs — both were true. It does NOT diff `initialState`'s field
  set against what the migrations/repair actually set, so a field added without a version bump is
  invisible to it. The save-migration stress test also spreads `...initialGameState`, so tests always
  start complete and never exercise a real v22 save that lacks the newer fields.
- How it was found: the weekly-audit Crash/Save subagent traced each `initialState` field added this
  cycle back through git to confirm whether a migration + a `repairGameState` backfill existed. Fixed
  by bumping `STATE_VERSION` to 23, adding an idempotent `migrations[23]` that backfills the three
  concrete-default fields (only-if-missing), and mirroring the backfill into `repairGameState` for
  partial/CloudSync saves. `ambitionId` intentionally omitted — its default is `undefined`, so an
  absent key already equals the default. Updated DEV.md / WORKFLOW.md / CLAUDE.md to state v23.
- Rule: adding a field to `initialState.ts` is a THREE-part change that must land together — (a) a
  migration that bumps `STATE_VERSION` and backfills it, (b) a `repairGameState` backfill for partial
  saves, (c) inclusion in `createTestGameState`. A field that consumers only ever read via `?? []` is
  NOT safe drift — it's a latent crash waiting for the first non-guarded reader. Consider a static
  check that diffs the `initialState` key set against fields set by the migration ladder + repair, so
  this class fails the audit instead of a subagent having to catch it. (The `.claude/agents/*` +
  `.claude/prompts/*` the SKILL references still don't exist in-repo — ran the deep pass with
  general-purpose subagents again; same note as 2026-07-07.)

### 2026-07-07 - Weekly audit: divergent duplicate code paths (auto vs. manual wedding) + one unguarded call in a per-tick loop

- Two code paths that reach the SAME outcome must produce IDENTICAL state, or one silently drifts.
  `applyScheduledWedding` (the weekly-tick auto-marry path) built the spouse record with only
  `type: 'spouse'` + score, while the manual `executeWedding` (DatingActions) additionally set
  `marriageWeek`/`anniversaryWeek`, cleared `engagementWeek`/`engagementRing`, and set
  `livingTogether: true`. Which path fires is purely whether the player taps "execute" that week or
  lets the tick resolve it — so a large fraction of marriages went through the auto path and got an
  incomplete record. Concrete fallout: `checkAnniversary` bails on `!spouse.anniversaryWeek`, so
  auto-married couples NEVER got an anniversary (happiness reward + milestone permanently
  unreachable), and a married partner kept stale engagement flags. Fix: mirror the manual path
  field-for-field. Lesson: when you extract/duplicate a state transition, snapshot BOTH outputs and
  diff them — a subsystem-equivalence snapshot test is the right home for this (it caught the diff
  cleanly on `-u`).
- One unguarded caller in an every-tick loop reintroduces a soft-lock class the resilience test
  exists to prevent. `trackBudgetSpend` did `[...banking.budgetSpend]`; EVERY other caller guarded
  with `prev.banking?.budgetSpend ? … : …`, but the new weekly-tick `spendEvents` loop
  (`lib/banking/weeklyTick.ts`) called it unguarded every week. On a partial/older banking slice
  (`budgetSpend === undefined`) that throws inside the tick updater, whose outer catch returns
  `prevState` → "Next Week" silently no-ops (soft-lock). Fixed at the SOURCE (default
  `[...(banking.budgetSpend || [])]`) so all present/future callers are covered, and wrapped
  `runWeeklyBankingTick` in its own try/catch like the pulse/spark/stocks ticks — its crash surface
  grew this week (interest accrual + budget tracking) without an inner guard. Lesson: if N callers
  guard a helper and one doesn't, the fix belongs IN the helper, not in the Nth caller. And a
  subsystem tick whose failure aborts the whole week needs its own try/catch — check that every new
  tick step has one.
- `planWedding` charged its 25% deposit without re-checking affordability inside the updater
  (the same H-class atomicity gap the audit keeps closing) — a same-batch double-tap double-charged.
  Added the in-updater `money >= deposit` re-check to match `proposeMarriage`/`executeWedding`.
- Process note: the referenced project subagents/prompts (`.claude/agents/*`, `.claude/prompts/*`)
  do not exist in this repo — the SKILL points at them but they were never committed. Ran the deep
  qualitative pass with general-purpose subagents (one per domain) instead; worked fine. Worth
  either committing those agent/prompt files or updating the SKILL to drop the dead references.

### 2026-07-02 - Weekly audit (salvaged from PR #45): 3 more money printers + 2 silent-immunity buffers + crash guards

- Origin: PR #45 (weekly audit 2026-07-02) went unmergeable after PR #46 independently landed two
  of its fixes (audit-save doc rename + `enterCompetition` atomicity). The remaining six fixes were
  salvaged onto the bug-fix branch instead of rebasing the conflicted PR.
- Non-atomic gate→grant money printers (same H-8/H-9 class the mega-audit keeps closing):
  `runForOffice` re-applied the up-to-$5M election reward with no idempotency re-check (fixed with a
  `lastElectionAttemptWeek` marker stamped by BOTH branches, since win/loss is rolled independently
  per tap); `filePatent` filed duplicate perpetual-income patents via stale-outer dedup + inline
  floored charge; `stakeCrypto` drove the coin balance negative and minted a phantom staking
  position. Fix idiom unchanged: fold gate re-check + debit (`applyMoneyDelta`) + grant into ONE
  `setGameState(prev => …)` that returns `prev` when the gate no longer holds.
- TWO more fixed-size pre-roll buffers indexed by an uncapped collection (the petSickness class,
  2026-06-21): `relBreakup`/`relDisappointed` (len 20) indexed by the raw full-relationships
  index → partner past index 20 immune to breakup; doctor-visit cure buffer (len 10) → 11th+
  curable disease never cured. Both fixed with `idx % buffer.length`, matching the pet/vehicle/
  disease consumers that already wrap. A docstring that says a quirk is "PRESERVED VERBATIM" is a
  red flag, not a spec — re-verify it's intended, not just inherited.
- TWO unguarded `.length` reads on fields `repairGameState` does NOT backfill (`family.children`
  in ShareLifeCard's tagline, `curedDiseases` in CureSuccessModal) — crash-on-old-save. Note
  `curedDiseases.length` sat in a useEffect dependency array, which evaluates EVERY render
  regardless of the render-guard short-circuit below it.
- Process note: when two audit PRs overlap, the conflicted one is not worthless — diff it against
  main fix-by-fix before closing; here 6 of 8 fixes were still missing from main.

### 2026-06-30 - IAP `applyBenefit` double-granted every consumable (in-memory path + disk path both additive)

- What went wrong: `IAPService.applyBenefit` runs TWO grant paths in sequence for every
  purchase: (1) the in-memory `stateUpdater` (registered by `<IAPHandler/>`, mounted in
  `GameProvider`) clones live state, applies the product via `applyProductToState`, and
  `await`s `saveGame(true)` — persisting the credited state to the active slot — before
  resolving; then (2) `applyBenefitToDisk` reads that just-persisted slot back and calls
  `applyProductBenefitsToState` AGAIN. That helper is additive for consumables
  (`gems/money/youthPills` use `+=`), so every foreground gem/money/youth-pill purchase
  credited the player 2×. Flag products (perks, multipliers, ads-removed) are idempotent
  boolean sets, so they were unaffected — which masked the bug.
- Why it hid: all existing IAP tests (`iapMonetization.stress.test.ts`,
  `premiumPackIncome.test.ts`) exercised `applyProductToState` — ONE path — never the
  combined `applyBenefit`. The disk path was designed as a cold-start FALLBACK ("Always
  update disk as backup/source of truth") but ran unconditionally even when the in-memory
  path had already applied+persisted. `ShopModal` even carries a "DOUBLE-GRANT FIX"
  comment asserting the grant happens "exactly once per transaction" — the author removed
  a UI-layer re-apply but never saw that `applyBenefit` itself re-applies on disk.
- How it was found: the weekly-audit economy subagent flagged it (MEDIUM); source-verified
  by tracing `applyBenefit` → `stateUpdater` (IAPHandler) → `applyBenefitToDisk`, confirming
  `applyProductBenefitsToState` is `+=` additive and `<IAPHandler/>` is mounted
  (`GameProvider.tsx:113`). Proven with a new test that drives the real `applyBenefit` with
  the save pipeline mocked to an in-memory slot: warm path granted 1000 gems for a 500-gem
  pack (2×) before the fix. Fixed by capturing the in-memory updater's boolean result and
  passing `{ skipBenefitReapply: inMemoryApplied }` to `applyBenefitToDisk`, which then
  gates only the additive `applyProductBenefitsToState` re-apply (disk-only concerns —
  permanent perks, subscription fulfillment, transaction ledger, save — still run).
- Rule: when a benefit/grant has redundant apply paths (in-memory + disk, optimistic +
  authoritative), exactly ONE must perform the additive mutation per transaction; the
  fallback path must no-op the additive part when the primary already applied+persisted.
  Test the COMBINED entry point, not just the shared leaf helper — a redundant-path bug is
  invisible to a test that only calls the helper once.

### 2026-06-24 - "Normalize to current season" helper RESET unclaimed Legacy Pass rewards instead of rolling over

- What went wrong: the Legacy Pass module has two ways to bring a stale pass up to the live
  season. `ensureCurrentSeason(pass, liveSeasonId)` (`lib/legacyPass/legacyPass.ts:143`) RESETS
  to a fresh empty pass when `pass.seasonId !== liveSeasonId` — it's a normalizer, not a
  collector. `rolloverLegacyPass` / `reconcileLegacyPassSeason` / `awardLegacyPassXp`
  AUTO-COLLECT earned-but-unclaimed rewards before resetting (no silent loss). The two claim
  entry points (`claimLegacyPassReward`, `claimAllLegacyPassRewards`) used the RESET variant.
  So if the real-time 6-week season boundary was crossed while the pass modal sat open (the
  modal reconciles on open, but not continuously), tapping Claim ran against a freshly-reset
  empty pass: it claimed nothing, discarded the old season's earned gems/youth-pills/traits,
  and the modal's optimistic toast still said "Claimed N rewards (+X gems)" (computed from the
  pre-reset local `pass`). Reward loss + a lying toast.
- Why it hid: every claim test operated WITHIN the current season (the happy path). The
  rollover/collection tests covered only the XP and reconcile paths — none drove a claim across
  a rolled-over season. The asymmetry (same helper name family, two different behaviors) made
  the wrong call site look correct.
- How it was found: the weekly-audit economy subagent flagged it; source-verified at
  `LegacyPassActions.ts:176,197` against `ensureCurrentSeason`'s reset semantics. Fixed by
  adding a `withLiveSeason` helper that rolls over (auto-collects) when the season changed and
  only normalizes within-season, then routing both claim functions through it. Added 2
  regression tests that claim against an `oldSeasonPass()` and assert the rewards land on the
  account + a season summary is stamped.
- Rule: when two helpers in the same module both "bring state to the current period" but one
  RESETS and one MIGRATES/COLLECTS, every state-mutating entry point must use the collecting
  one unless loss is intended. Audit each call site of a `reset`-style normalizer for whether
  earned/pending data would be silently dropped. And test the boundary-crossing path, not just
  the in-period happy path — a rollover that's only exercised by one subsystem will rot in the
  others.

### 2026-06-24 - Cold-container false positive: perf jest "FAIL" was just missing node_modules (again)

- What went wrong: `npm run audit:weekly:full` reported a 🟠 HIGH "Performance jest suite
  failed" that looked like a real blocking week-loop regression. The container had an EMPTY
  `node_modules` (fresh clone, no install), so `jest` died with "Preset ts-jest not found" —
  the audit script graded a can't-even-start as a failure. After `npm ci`, the perf suite and
  money-conservation stress both passed clean.
- Why it hid: the static `npm run audit:weekly` (no jest) is green, so only the `:full` dynamic
  layer surfaces it, and the failure message ("See CI logs") reads like a genuine perf miss.
  This is the inverse of the 2026-06-21 cold-container lesson (there jest was silently absent →
  false green; here jest can't load its preset → false red).
- Rule: on a routine run, before trusting ANY jest-backed audit result (pass OR fail), confirm
  deps are installed (`ls node_modules/.bin/jest`). If empty, `npm ci` first, then re-run.
  Treat a jest config/preset error as an environment problem, not a code finding.


### 2026-06-21 - Fixed-size pre-roll arrays indexed by an uncapped collection silently grant immunity

- What went wrong: the weekly tick pre-rolls per-entity RNG into fixed-length arrays
  (`preTick.ts`: `petSickness`/`petSicknessType` length 10, `relBreakup`/`diseaseProgression`
  length 20, `vehicleAccident` length 10) to stay StrictMode-pure. Consumers index them by the
  entity's position in the FULL array (`applyPets.ts:76` `rolls.petSickness[petIdx]`). `petIdx`
  runs over alive + dead pets and there is no pet-count cap, so a player who has owned more pets
  than the buffer length reads `undefined`. The bug is silent because the comparison is
  `undefined < 0.06` → `false`: those pets become permanently immune to sickness (no crash, no
  error, just a balance/correctness drift that only shows up on a long, pet-heavy save).
- Why it hid: every test used ≤ a handful of pets (well under the buffer), and the refactor
  snapshot suite asserted byte-identical output for small inputs — none exercised an index past
  the buffer end. A length assertion (`toHaveLength(10)`) "passed", reinforcing the wrong size.
- How it was found: the weekly-audit Crash/Save/Logic subagent traced `petIdx` to the full-array
  map index and cross-checked the buffer length. Fixed by wrapping the index modulo the array
  length in the consumer (`petIdx % rolls.petSickness.length`, deterministic, no impure
  Math.random) + a regression test that drives index 11 to a guaranteed-sick draw.
- Rule: when a fixed-size pre-roll/lookup array is indexed by a collection whose size isn't
  capped to that length, the overflow entries silently get the default-branch behaviour. Either
  cap the collection to the buffer length, or wrap the index (modulo) in the consumer, and add a
  test that exercises an index PAST the buffer. The same latent shape still exists for >20
  relationships/diseases and >10 vehicles — apply the same wrap if those collections can grow.

### 2026-06-21 - "Missing" tooling already existed on main — fetch + check open PRs before building it

- What went wrong: the scheduled "weekly audit" routine prompt referenced `npm run audit:weekly`,
  `tasks/weekly-audit-<date>.md`, and `.agents/skills/weekly-audit/SKILL.md` — none of which were on
  the freshly-cut branch (only `eas-build`/`preflight`/`test-suite` skills existed), and the cold
  container had no `node_modules` so `type-check`/`jest` silently "passed" (`jest: not found`). I
  concluded the harness was missing and BUILT a parallel one (`scripts/weekly-audit.js`, a skill, npm
  scripts, a SessionStart hook). At PR time the merge was `dirty`: PR #23 had merged the real weekly-audit
  suite (`scripts/audit/*.cjs` + the same skill + `audit:weekly` scripts) into `main` ~10 minutes AFTER
  this branch was cut. My harness was a straight duplicate and had to be discarded in the merge.
- Why it hid: the branch base (`dc6ff19`) predated the #23 merge, and the local `origin/main` ref was
  stale from clone time, so `git rev-list origin/main...HEAD` showed main as fully behind. The duplication
  only surfaced when CodeRabbit/`mergeable_state: dirty` forced a `git fetch origin main`.
- Also true (still-valid sub-lessons): a piped `| tail` swallows the real exit code (`${PIPESTATUS[0]}`
  ≠ `$?`) — verify `node_modules` exists before trusting a green check on a cold container; and verify
  every subagent severity grade against source (this run's three real P2 fixes were each confirmed at the
  line — they survived the reconciliation because they were genuine code fixes, not tooling).
- Rule: before building tooling that looks "missing", `git fetch origin main` and scan open + recently
  merged PRs (`list_pull_requests`, recent `git log origin/main`) for an in-flight implementation. A
  routine branch cut minutes before a related PR merges will look like the tooling doesn't exist. Adapt
  to run the audit (reconstruct intent from equivalents) — but don't commit a parallel harness without
  first confirming `main` doesn't already have one. Keep the genuine deliverable (the code fixes) separate
  from the scaffolding so it survives if the scaffolding turns out to be redundant.

### 2026-06-18 - A "find bugs" subagent over-graded 9 findings as P0; source verification found 0 real P0s

- What went wrong: three deep audit subagents (run as background agents, salvaged after a session suspend)
  graded 9 `setGameState`/save/economy findings as P0 crashes/corruption. I consolidated them and told the
  user the app was "not code-ready, contradicting the roadmap." On source verification, ALL 9 were
  over-graded — 0 genuine P0s. Examples: the "out-of-bounds NaN crash" (C3/C4) can't fire because
  `undefined < chance` is false (the math is inside that `if`); the "stale-ref revalidation" (C7) reads the
  already-repaired state because `repairGameState` copies its clone back in-place (`saveValidation.ts:894`);
  the "spurious double-deaths" (C1) can't happen because death rolls are pre-rolled
  (`GameActionsContext.tsx:359`) and toasts are id-deduped (`:1599`); the "MONEY_CEILING bypass" (C8) needs
  ~1e14 weekly income to reach `MAX_SAFE_INTEGER`.
- Why it hid: the audits reasoned ABSTRACTLY about React semantics ("async setState", "StrictMode
  double-invoke", "races") and worst-case constants without tracing (a) the actual call sites, (b)
  synchronous in-place mutations, (c) React batching, (d) the codebase's EXISTING mitigations (pre-rolled
  RNG, id-dedup, in-place repair copy-back), or (e) realistic value ranges. The failure mode of a "find as
  many bugs as possible" prompt is severity inflation and ignoring mitigations.
- How it was found: verifying each finding against the real code BEFORE fixing (the user chose "verify-first").
  Batch 1 (3 items) all fell to verification, then Batch 2 (2), Batch 3 (3), and C1 — 9 of 9.
- Rule: treat subagent/audit severity grades as UNVERIFIED LEADS, never ground truth. Source-verify each P0
  against the actual code path — call sites, sync vs async, batching, and existing mitigations — before
  reporting it to the user or "fixing" it. One verified non-bug is reason to re-verify the whole batch. When
  a fresh audit contradicts a prior careful assessment ("code-ready"), suspect the audit first.

### 2026-06-15 - The $24.99 Premium Pack money multiplier was inert — dead flag written, real field not

- What went wrong: weekly income applies the money multiplier by reading `goldUpgrades.multiplier`
  (`applyIncome.ts:92`), but BOTH IAP entitlement-apply paths in `IAPService.ts` (`applyProductToState`
  @1578 and the disk-apply path @~1037) set only `settings.moneyMultiplier = true` for a
  `config.moneyMultiplier` product. `goldUpgrades.multiplier` was set ONLY inside the separate
  `config.allUpgrades` / `config.everythingUnlocked` branches — which the Premium Pack
  (`moneyMultiplier: true`, no allUpgrades/everythingUnlocked) does not have. So the paid 1.5× multiplier
  did nothing. A prior audit (round11 MON-3) even mis-concluded "the money mult IS delivered via the
  different goldUpgrades.multiplier" — it traced the write of the dead flag and the existence of a
  goldUpgrades write, but never the END-TO-END write→read chain for that specific product.
- Why it hid: a stress test (`iapMonetization`) asserted `settings.moneyMultiplier === true` after the
  purchase — i.e. it tested the WRITE of the dead flag, which "passed", giving false confidence. No test
  fed the purchased state through `computeWeeklyIncome` to confirm the income actually changed.
- How it was found: a "verify the mapping" task (roadmap H7) written as an END-TO-END regression test —
  apply the real product config, then run the real income calc and assert the 1.5×. It failed (ratio 1.0),
  exposing the inert multiplier. Fixed by setting `goldUpgrades.multiplier` under `config.moneyMultiplier`
  in both paths.
- Rule: for monetization (and any write→read feature), test the END-TO-END effect, not just that a flag
  was written. A flag/field is only "wired" if the consumer reads THAT field. When the same effect is
  applied by multiple code paths (here: in-memory `applyProductToState` vs disk-apply — the "divergent
  entitlement paths" / H6 drift), they WILL drift; consolidate to one helper, and assert the observable
  game effect (income changed, ad removed, etc.), not the intermediate flag.

### 2026-06-15 - UI render tests did NOT need a jest-expo host — just gaps in the existing RN mock

- What was believed: `__tests__/integration/gameFlow.test.tsx` and `screenImports.test.ts` both stated render
  tests were "deferred until a jest-expo / native test host is configured," so the project shipped with
  **0 `render()` tests across 254 components** — the biggest durability gap (per the 2026-06-15 roadmap).
- What was actually true: `react-test-renderer@19.1.0` is already installed, and `jest.setup.js` already mocks
  `react-native` to string-tag host components. So `TestRenderer.create(<Screen/>)` works in the existing
  ts-jest/node env — screens just hit a few **mock gaps** that threw, not a fundamental host limitation.
- The specific gaps (all additive fixes to `jest.setup.js`): (1) `Animated.View`/`Text`/etc. were missing →
  `usePressableScale`'s `<Animated.View>` was `undefined` ("Element type is invalid"); (2) `Animated.sequence`/
  `parallel` returned objects without `.stop()` → crash on unmount when a component stops an entrance anim;
  (3) `ActivityIndicator`/`ImageBackground`/`BackHandler` not mocked; (4) `react-native-safe-area-context` +
  `@react-navigation/native` not mocked; (5) Expo native `.js` modules (e.g. `expo-constants`) ship ESM that
  ts-jest (ts/tsx-only transform) can't parse → mock them.
- Rule: to add render coverage in a ts-jest/string-mocked RN project, use `react-test-renderer` directly and
  fill mock gaps reactively (run → read the throw → mock → repeat). Keep mocks ADDITIVE in `jest.setup.js`
  (new keys only) so the existing suite is unaffected, and always re-run the FULL suite after touching shared
  setup. Note the limitation: this renders each screen's own subtree, so it catches undefined-component /
  bad-import / Animated-misuse / provider-cycle crashes — but NOT navigator-level version-skew crashes (see
  the 2026-06-10 entry); those still need a real navigator mount.

### 2026-06-10 - The onboarding "Element type is invalid: undefined" was a @react-navigation version skew, NOT a screen module

- What went wrong: every prior fix for the launch crash (anchor `unstable_settings`, lazy `SettingsModal`, leaf-context imports, OTA disable) chased the wrong root cause. The real bug: `@react-navigation/native-stack@7.15.1` (pulled transitively by `expo-router`) imports `NavigationProvider` from `@react-navigation/native` and renders it as the OUTER element of every screen's `SceneView`. The peer dep is `@react-navigation/native@^7.2.4`, but `package.json` pinned `^7.0.14` and the lockfile froze `@react-navigation/native` at `7.1.17` — a version that does NOT export `NavigationProvider`. So `NavigationProvider` was `undefined`, and the FIRST native-stack mounted (the `(onboarding)` Stack, since the root is `<Slot>` and tabs use bottom-tabs) crashed with "Element type is invalid: …got: undefined" at `SceneView`. npm only *warns* on violated peer deps, so the bundle built fine and crashed only at render.
- Why it hid: it is a runtime JSX-type failure from a named import, not a missing default export. Every route module's `default` export is a valid component (verified by evaluating the real production bundle) — so module-load smoke tests, the bundle build, and JS render tests all pass. It only manifests in a real render of the navigator. The OTA-update bug masked it for ~20 builds (a stale published bundle ran instead of each new embedded one), so the crash was never actually exercised until `updates.enabled=false` (OTA-OFF-1).
- How it was proven: built the production bundle with `npx expo export:embed --dev false` and grepped — OLD bundle had `NavigationProvider` only as import references with NO `Object.defineProperty(e,"NavigationProvider",…)` export definition; after bumping `@react-navigation/native` to `^7.2.4` (resolves 7.3.0, core 7.19.0) the export definition is present.
- Rule: when a screen/navigator crashes with "Element type is invalid: …got: undefined" and EVERY route module has a valid default export, suspect a `@react-navigation` (or other native-UI lib) **version skew** — a child package importing a binding the resolved parent version doesn't export yet. Check `npm ls @react-navigation/native @react-navigation/native-stack @react-navigation/core` and every native-stack/bottom-tabs peer dep; align them (prefer `npx expo install --fix` on SDK bumps). Don't trust "it builds" — peer-dep violations are warnings, not errors.


### 2026-05-27 - Onboarding perk boosts can exceed bounded stat ranges

- What went wrong: permanent `lucky_charm` applied its `+5 happiness` boost on top of an initial `happiness` value of 100, creating `stats.happiness = 105`. Onboarding validation correctly rejected the generated save, so starting a life failed at the final Perks step.
- Pattern: additive onboarding bonuses share the same 0-100 stat bounds as gameplay stats; validation catches overflow after construction, but the builder must preserve invariants up front.
- Rule: when constructing a new `GameState`, clamp bounded stats (`health`, `happiness`, `energy`, `fitness`, `reputation`) at the builder boundary. Keep `money`/`gems` non-negative and unbounded by the 0-100 clamp.

### 2026-03-09 - Device Classifier Drift (iPhone Pro Max vs iPad)

- What went wrong: `isIPad()` used a height-only threshold (`height > 926`), so newer/taller Pro Max iPhones were treated as iPads.
- Pattern: height-only platform classification breaks as new phone form factors exceed older limits.
- Rule: use shortest-side tablet detection (`Math.min(width, height) >= 768`) for iPad checks, and derive iPhone checks from `!isIPad()` instead of hardcoded height caps.

### 2026-03-09 - Onboarding Name Regeneration Overwrite

- What went wrong: `Customize` could auto-regenerate names on screen entry when `lastAutoGeneratedSex` was `null`, overwriting existing user names after navigation.
- Pattern: regeneration logic that relies on previous auto-generated metadata must explicitly guard for "no auto-generated history" and partial manual edits.
- Rule: only regenerate on sex change when an auto-generated sex exists and both name fields are populated; clear auto-generated markers as soon as the user manually edits identity fields.

### 2026-04-20 - Corrupt GitHub Actions YAML from unfinished merges

- What went wrong: `.github/workflows/eas-build.yml` contained stray branch-name lines (`main`, feature branch tokens) between YAML keys, producing invalid workflow syntax.
- Pattern: merge conflicts or partial paste into workflow files without validating with a YAML parse or `gh workflow` view.
- Rule: after any edit to `.github/workflows/*.yml`, parse locally and confirm the workflow appears in GitHub’s Actions tab without errors.

### 2026-04-20 - Full GameProvider tests in Node Jest

- What went wrong: `__tests__/integration/gameFlow.test.tsx` could not mount `GameProvider` under `@testing-library/react-native` with the repo’s `jest.setup.js` RN string mocks; `useGame()` never ran and assertions saw `null` context.
- Pattern: integration tests that need the full provider tree belong in a native test host (`jest-expo`) or should be narrowed to pure bootstrap checks that run in Node.
- Rule: keep Node Jest integration files limited to deterministic imports (`initialGameState`, pure helpers); defer RTL-heavy flows until the Jest environment matches React Native.

### 2026-05-13 - week vs weeksLived strikes again (socialMedia / MiningActions)

- What went wrong: Two files still used the 1-4 cyclic `state.week` where the math needed the monotonic `state.weeksLived`:
  - `lib/social/socialMedia.ts:397` computed `weeksSinceLastPost = state.week - lastPostWeek` while `lastPostWeek` was correctly written as `weeksLived` at the call sites. Result: `weeksSinceLastPost` was always negative, follower decay never fired, engagement-rate math was wrong.
  - `lib/social/socialMedia.ts:623` used `state.week` as fallback for the per-content-type cooldown key, which would trigger a year-long lockout once the cycle repeated.
  - `contexts/game/actions/MiningActions.ts:606` recorded mining-history entries with `week: prev.week`, corrupting time-ordering in any history-display UI.
  - `contexts/game/actions/MiningActions.ts:370` stored staking `startWeek: prev.week` (the absolute counter was set on the adjacent `startAbsoluteWeek` field, but the inconsistency was a trap for the legacy fallback in `claimStakingRewards`).
- Pattern: Phase B sweep caught most week→weeksLived sites but missed read-side bugs where the write side had already been migrated. The asymmetry hides the bug because the field name `lastPostWeek` *looks* correct on both sides.
- Rule: whenever a field is named `*Week`, grep BOTH writes AND reads against the cyclic-vs-absolute axis. If the writer uses `weeksLived`, every reader must compare against `weeksLived` (not `state.week`). Treat `state.week` as a UI-display value only — never compare it against any stored field.

### 2026-05-29 - The `updatedAt` bumper turned every no-op setState into a full re-render

- What went wrong: `GameStateProvider.wrappedSetGameState` always bumped `updatedAt` and returned a fresh top-level object, even when the inner updater returned `prev` unchanged (e.g. an action rejecting an overdraw). Every consumer with `useMemo([gameState])` recomputed on every rejected action, cascading into a whole-app re-render storm that produced "Maximum update depth exceeded" warnings.
- Pattern: a "version bumper" middleware that runs *after* the inner updater inevitably re-renders the no-op case, defeating the action-level `return prev` idiom.
- Rule: in any wrapper around `setState`, short-circuit on identity (`if (newState === prev) return prev`) before applying any derived field updates. And: **never** add a top-level "always changes" field unless the contract requires it (clock fields can usually live in a `useRef`, not state).

### 2026-05-29 - In-place `repairGameState` broke React memo invalidation

- What went wrong: `repairGameState(state)` mutated `state.stats`, `state.banking` etc. in place. Callers did `{...prev}` to give React a new top-level ref, but every nested ref was unchanged — selectors keyed on `gameState.banking` saw the same object identity and silently skipped renders, leaving the UI showing stale data after a "successful" repair. Looked exactly like a frozen UI.
- Pattern: any function that's expected to "return new state" needs to actually replace nested object references, not just mutate fields inside them. Shallow spreading at the top doesn't help if the caller's memo selectors are keyed on nested objects.
- Rule: when a repair / migration / normalization function needs to keep the same top-level reference for caller-API compatibility, do the work on a `structuredClone` of the input and then copy the clone's *top-level keys* back onto the original. That preserves the outer ref (caller untouched) while giving every nested object a new identity (React's referential equality machinery wakes up).

### 2026-05-13 - Variables assigned inside setGameState updater, read outside

- What went wrong: `DatingActions.ts fileDivorce` declared `immediatePaymentApplied`, `divorceDebtCreated`, `forcedStockLiquidationPaid`, `forcedPropertyLiquidationPaid` at outer scope, assigned them inside a `setGameState(prev => {…})` updater, then read them after the call to format the log line and the user-facing divorce summary message. React batches/defers functional updaters, so the read sees the initial values (0) — the user sees "$0 immediate payment" in the divorce modal.
- Pattern: any state mutator whose result is also needed synchronously (for logs, returned messages, analytics) must compute the derived values OUTSIDE the updater. The updater should only assemble the new state from precomputed values.
- Rule: never use a `setGameState(prev => {…})` updater to assign closure-scoped variables that are read by code following the `setGameState` call. Compute audit/return values against the action's `gameState` snapshot first, then call `setGameState` with the precomputed objects. Reserve `prev` inside the updater only for spread-merging fields that other actions might touch concurrently (typically `prev.dailySummary`, `prev.family`, etc).

### 2026-05-30 - REVERTED: React.lazy() inside an expo-router screen crashes production iOS

- What went wrong: round 6 converted `app/(tabs)/computer.tsx` (17 sub-apps) and `app/(tabs)/mobile.tsx` (8 sub-apps) from eager `import X from '…'` to `const X = lazy(() => import('…'))` with a `<Suspense>` fallback. Type-check and the local Jest suite passed clean. The EAS-built iOS production bundle then crashed at app launch with `Element type is invalid: expected a string … but got: undefined` inside the root navigator — the "Router Initialization Error" screen.
- Pattern: expo-router scans every `app/**/*.tsx` file at boot to register routes. That import walk wakes up the lazy wrappers' module identities even though the wrapped chunks haven't been rendered yet. In the minified Hermes production bundle, at least one of those dynamic `import('…')` chains resolves through a path where the `.default` export is not unwrapped — or one of the transitive imports under a `lazy()` chunk is itself undefined — and React throws at the navigator render. Dev mode and JS tests don't reproduce this; only the production Hermes bundle does.
- Rule: do NOT use `React.lazy(() => import('…'))` for components that an expo-router screen references at module top (the `apps[activeApp]` map pattern). If code-splitting is needed, defer the load via an explicit `require()` inside a `useEffect` AFTER mount, and gate the import behind an error boundary that surfaces failures with a useful message. Eager imports are the safe default for any component the router will see during boot.
- Guardrail in place: [__tests__/startup/screenImports.test.ts](../__tests__/startup/screenImports.test.ts) asserts every `(tabs)/*.tsx` file has a `export default` AND that `computer.tsx` + `mobile.tsx` contain no `React.lazy(() => import(…))` patterns. CI will block any future regression.

### 2026-05-30 - work.tsx crashes on `gameState.items.find` when arrays missing

- What went wrong: `app/(tabs)/work.tsx` had 12 direct `.find()` calls on `gameState.items`, `gameState.darkWebItems`, and `gameState.educations` with no `|| []` guard. When a save loaded that had been migrated incompletely (rare path) or where `repairGameState` hadn't backfilled the array, the Work tab crashed immediately on render with `Cannot read property 'find' of undefined`.
- Pattern: even when `initialState.ts` declares an array field, older saves and edge-case migrations can leave it undefined. Component code that treats those as always-present is one bad save away from crashing.
- Rule: any read of `gameState.<arrayField>.find/.filter/.map/.length` in a render path must defensively guard with `(gameState.<arrayField> || [])` (or, equivalently, optional chaining when only a boolean is needed). The repair pipeline is a backstop, not a guarantee.

### 2026-05-30 - Don't trust an audit-agent's "file:line is broken" claim without re-reading the code

- What went wrong: a parallel performance audit asserted that `wrappedSetGameState` was regressing the May 29 `updatedAt`-bumper lesson and that the AppState listener / autosave interval had no cleanup. Direct reading of `contexts/game/GameStateContext.tsx:46-58` showed the identity short-circuit IS in place; `GameActionsContext.tsx:3710-3712` and `:3784-3787` both have working cleanup. The agent skimmed and got it wrong.
- Pattern: agents pattern-match aggressively; their "this is broken" claims often have a kernel of truth (the function shape is suspicious) without the verification that would distinguish "buggy" from "already fixed". Acting on those claims without re-reading wastes a fix slot and can re-introduce bugs.
- Rule: before applying any audit-flagged fix to load-bearing code (state providers, save pipeline, week tick), open the cited file at the cited lines and confirm the bug exists *as described*. If the code already does the right thing, mark the finding REJECTED with the line evidence in the report. Don't just edit because an agent said so.

### 2026-06-09 - Converted hook landed below an early return (rules-of-hooks)

- What went wrong: migrating `OfflineIndicator` to `useGameSelector`, the original `useGame()` call sat above the `if (isOnline && pendingActions === 0) return null;` guard, but the *derived value* it replaced (`isDarkMode`) sat below it. Mechanically converting the derived line into a hook call put a hook after a conditional return. Type-check and the full Jest suite both passed — only `eslint react-hooks/rules-of-hooks` caught it.
- Pattern: cast/hook migrations that convert a plain expression into a hook call can silently move a hook below an early return. Tests don't exercise the divergent-render-order path, so the suite stays green.
- Rule: after any migration that introduces hook calls into an existing component, run `npx eslint <files> --quiet` before committing — never rely on type-check + tests alone. Place all new selector hooks in the component's existing hook block at the top, not at the site of the expression they replace.

### 2026-06-09 - `useGameState().setGameState` reintroduces the full-state subscription

- What went wrong: Batch 4 migrated `GemsStoreModal` to slice selectors but took `setGameState` from `useGameState()`. That hook subscribes to the whole `GameStateContext`, so the component still re-rendered on every state mutation — the migration looked complete but delivered zero isolation. Caught one batch later while planning TopStatsBar.
- Pattern: in a selector migration, ANY remaining hook that consumes the full-state context (useGame, useGameState, useGameData-with-state) silently negates the win. The component compiles, tests pass, and the re-render behavior is unchanged.
- Rule: migrated components must get write access from `useSetGameState()` (store-backed, stable, no subscription) and actions from the split action hooks (`useMoneyActions()`, `useGameActions()`, …) — never from `useGame()`/`useGameState()`. Verification: after migrating, grep the file for `useGame(`/`useGameState(` — both must be absent.

### 2026-06-09 - Local type-check passed while CI failed: stale incremental tsbuildinfo

- What went wrong: PR #7 CI failed `tsc -p tsconfig.typecheck.json` with 5 TS18048 errors (`sm`/`pol`/`dw` possibly undefined in PulseApp.tsx and milestones.ts) that every local `npm run type-check` run during the session reported clean. Deleting `*.tsbuildinfo` and re-running locally reproduced all 5 — the incremental cache had skipped re-checking those files after the cast-removal edits changed inference in their dependencies.
- Pattern: `tsc --noEmit` with incremental state can return green for files whose *types changed transitively* (e.g. a `: any` local removed in one file tightens inference in another). CI always runs cold, so the divergence only shows after push.
- Rule: before pushing any commit that removes casts / changes type inference, run the type check cold: `rm -f *.tsbuildinfo && npx tsc --noEmit -p tsconfig.typecheck.json`. Also note: runtime guards like `safe(x?.field, 0) > 0` do NOT narrow `x` for TS — use `x?.field` again inside the branch instead of `x.field`.

### 2026-06-11 - `eas build --local` never auto-increments — duplicate CFBundleVersion rejected on submit

- What went wrong: `eas submit` for iOS failed with "You've already submitted this build of the app." `eas.json` had `cli.appVersionSource: "remote"` but **no** `autoIncrement` on any profile, and the failing pipeline (`.github/workflows/eas-build-local-ios.yml`) builds with `eas build --local`. Remote versioning made EAS ignore `app.config.js`'s existing `BUILD_NUMBER` hook, AND `--local` builds do not run the remote auto-increment (that only happens on EAS *cloud* builds) — so every local build baked the SAME `CFBundleVersion` and Apple rejected the duplicate.
- Pattern: `appVersionSource: "remote"` silently disables the local `ios.buildNumber` / `android.versionCode` values (remote becomes the source of truth), and the remote `autoIncrement` flag is a *cloud-build-only* feature. A `--local` + `remote` combination therefore has NO working increment path — it ships the same build number forever, and the failure only surfaces at submit time, not build time.
- Rule: any pipeline that uses `eas build --local` must manage the build number itself. Set `cli.appVersionSource: "local"` and compute a unique, monotonic `BUILD_NUMBER` (`scripts/next-build-number.mjs`: returns one higher than App Store Connect's latest build when `ASC_KEY_ID`/`ASC_ISSUER_ID`/`ASC_KEY_P8` are present, else `date +%s` epoch seconds — which also stays under Android's ~2.1e9 `versionCode` cap) so `app.config.js` bakes a fresh `CFBundleVersion` into each binary. Reserve `remote` + `autoIncrement` for the *cloud* `eas build` path only. After a failed submit you must REBUILD with a new number — the already-built `.ipa` can never be re-submitted as-is.

### 2026-06-26 - Weekly audit reported a false 🟠 high: perf jest suite "failed" in a fresh routine container

- What went wrong: the scheduled weekly-audit routine runs `npm run audit:weekly:full` in a freshly-cloned container. `node_modules` was not installed, so `npx jest __tests__/performance` died with "preset ts-jest not found" *before any test ran*. `audit-perf.cjs` caught that and reported it as a 🟠 high "Performance jest suite failed", failing the whole audit (`✗ ... 0 critical, 1 high`). There was no real perf regression — the suite passes in 4.5s once `npm ci` runs.
- Pattern: a dynamic check that shells out to a test runner conflates two distinct outcomes in one `catch` — (a) the suite ran and an assertion/timing budget failed (a real regression, 🟠), and (b) the runner couldn't start at all (missing deps, bad preset, no tests collected — an environment problem, not a regression). The routine harness (cron container) is exactly the env where (b) happens on every cold run, so the false blocker is recurring, not a one-off.
- Rule: before treating a shelled-out test failure as a finding, prove the harness actually ran. In `audit-perf.cjs`: gate the run on `depsInstalled()` (`node_modules/.bin/jest` + `ts-jest` both resolve) → INFO-skip if absent; and in the catch, only emit 🟠 when the output contains a real test summary (`/Tests:\s+\d+/`) — downgrade `preset .* not found` / `Cannot find module` / `No tests found` to INFO. The SKILL playbook's "false positive → tighten the analyzer, don't suppress" applies: the fix is detection, not deleting the check. Operationally, the routine's SessionStart setup should `npm ci` so the dynamic backstop actually runs (it only adds value with deps present).

### 2026-06-29 - Weekly audit: two HIGH money printers static checks can't see (atomicity + unit mismatch)

- What went wrong: the deep qualitative economy pass found two repeatable money printers the static audit (`audit:economy`) passed clean over. (1) `ContactsActions.redeemFavor` gated on the stale `gameState`, credited cash in one `setGameState` call, then flipped the ledger in a SEPARATE call — two same-batch taps both passed the stale gate and both paid out (a positive credit never overdraft-rejects) while the ledger closed once. (2) `VehicleActions.cancelInsurance` charged a 6-month premium (`monthlyCost*6`) for a 26-week term but refunded `floor(monthlyCost*weeksRemaining/4)-25` — a 4-week "month" against a 26/6≈4.33-week premium, so an immediate buy-then-cancel refunded up to 6.5 months of a 6-month policy: +$25..+$175/cycle, repeatable. Also `sellVehicle` lacked the inside-`prev` ownership re-check its sibling `sellItem` already had.
- Pattern: the static economy analyzer validates CONSTANTS (APR ordering, tax monotonicity, ladders, floors) but is blind to (a) grant/credit and state-flip split across two updaters — the H-8/H-9 same-batch double-tap race — and (b) refund/proration formulas whose week↔month unit basis disagrees with the charge formula (the H-3 "refund returns more than was paid" class). Both compile, type-check, and pass the existing tests because those tests only assert flags/active-state, never the money delta.
- Rule: any action that grants value (cash, item, perk) AND mutates a ledger/ownership flag must do BOTH inside ONE `setGameState(prev => …)` that re-checks the gating condition against `prev` (use `applyMoneyDelta` for the money leg so it shares the overdraft/ceiling guards), never gate on the outer stale `gameState`. For any refund/proration, prorate against the ACTUAL premium paid and ACTUAL term (`premiumPaid * remaining/term`) and clamp `refund ≤ premiumPaid` — never re-derive months with a different week-per-month divisor than the charge used. And every regression test for a money action must assert the exact `stats.money` delta across the buy+cancel / double-tap, not just the resulting flag.

### 2026-06-29 - IAP listener didn't share the foreground flow's in-memory dedup lock

- What went wrong: after the expo-iap migration, `runPurchaseFlow` (foreground) guarded against concurrent same-transaction processing with the in-memory `processingTransactions` Set, but `setupPurchaseListener` checked only the PERSISTED ledger (`isTransactionProcessed`). The persisted mark (`markTransactionProcessed`) is written at the very END of `applyBenefit`, after an async disk read/write — so if the listener fired for the same transactionId while the foreground grant was mid-flight, both passed the persisted check and both called `applyBenefit`, double-granting a consumable (gems/money).
- Pattern: two code paths that can process the same event need to share the SAME fast (in-memory) dedup guard; relying on a persisted ledger that's written late leaves a race window equal to the async work between the check and the write.
- Rule: when a singleton has both an interactive and a listener/callback path that grant the same entitlement, the listener must consult AND populate the same in-memory lock the interactive path uses (add on entry, delete in `finally`), in addition to the persisted ledger. Persisted-only dedup is correct for cold starts, not for same-process concurrency.

### 2026-07-01 - Weekly audit: hobby tournament was the last non-atomic "gate → grant" money action

- What went wrong: `enterHobbyTournament` (`HobbyActions.ts`) gated its once-per-week cooldown on the stale render-time `gameState`, then wrote the entry marker, drained energy, and paid the reward in THREE separate `setGameState`/dispatch calls. Two same-batch taps both passed the stale gate (the deterministic roll is identical for both, so both "win"), both wrote the marker, both drained energy, and both called `updateMoney` — an untaxed, repeatable payout for one week's cooldown. Its own sibling `trainHobby` in the same file already re-checked its cap inside the `prev` callback; this function was the lone exception. The static `audit:economy` (constants-only) and the existing `hobbyFlow.stress.test.ts` (sequential `act()` blocks with committed state between them) both passed clean — the same-batch race is invisible to both.
- Pattern: this is the same H-8/H-9 double-tap class the mega-audit and PR #43 kept closing (ContactsActions.redeemFavor, buyPet, enterCompetition). The tell is structural, not behavioral: an action that (a) reads its gating condition from the outer `gameState` snapshot and (b) applies the grant/marker/cost in more than one updater. Grep target: any `enter*`/`redeem*`/`claim*`/`buy*` action whose cooldown/ownership check sits ABOVE the first `setGameState`, with `updateMoney(`/`updateStats(`/a second `setGameState(` below it.
- Rule: any value-granting action must fold the gate re-check + every state mutation (marker, cost, reward) into ONE `setGameState(prev => …)` that re-reads the gate from `prev` and returns `prev` unchanged if it no longer holds; route the money leg through `applyMoneyDelta(prev, …)` so it shares the overdraft/ceiling guards. Re-derive any deterministic roll from `prev` (the lineage-seeded RNG is stable within a batch, so the outer message and the inner authoritative recompute agree). Every regression test must assert the exact `stats.money` AND resource (energy) delta across a same-batch double-tap — thread one shared `setState` over the same stale snapshot passed to both calls — not just the resulting flag.

### 2026-07-01 - Double-grant bugs hide in DEAD components too (GemsStoreModal)

- What went wrong: PR #43 fixed the IAP consumable double-grant in `ShopModal` and `GemShopModal` (the service applies `config.gems` via the IAPHandler `stateUpdater`; the modals must NOT re-add locally). But `GemsStoreModal.tsx` still ran `stats.gems += totalGems` after `purchaseProduct` — a real double-grant of real-money gems. It survived because the component is imported NOWHERE (grep found only its own self-reference); the live gem modal is `GemShopModal`. So it was a dormant landmine, not a shipped exploit — but exactly the footgun to trip a future dev who wires it up.
- Pattern: when a fix removes a redundant grant from "the modals," an orphaned/duplicate component carrying the same pattern gets missed because it never runs and no test covers it. Static and dynamic checks are both blind to unreachable code.
- Rule: after fixing a class of bug (double-grant, unit mismatch, non-atomic gate), grep the WHOLE tree for the pattern — not just the wired call sites — including dead/duplicate components (`grep -rn 'stats.gems +' components/` etc.). Fix or delete the dead copy; leaving a live `+= <currency>` after `purchaseProduct` anywhere in the tree is a regression waiting to be re-mounted. Verify reachability with a component-name grep before down-grading a duplicate-grant finding to "not exploitable".

### 2026-07-03 - Weekly audit: RDActions.enterCompetition was the last gate→grant that actually PRINTED money

- What went wrong: the deep economy pass found `enterCompetition` (`contexts/game/actions/RDActions.ts`) still non-atomic. The `alreadyEntered` + affordability gates were read from the stale outer `gameState`, the entry fee was charged via `deps.updateMoney` (dispatch #1), then the history entry was appended in a SEPARATE `setGameState` (dispatch #2) that never re-checked the gate. Two same-batch taps both passed the stale gate and both appended a duplicate `competitionHistory` entry (same `competitionId|entryWeek`). Unlike the self-charging double-tap actions (buyAccessory, purchasePassport, …) this one PAYS OUT: `processCompetitionResults` loops every pending entry and does `totalPrize += prize` per entry, so the duplicate independently placed and its prize was summed — a repeatable, untaxed money printer (prizes are 10×+ the entry fee). `applyHistory` marks BOTH duplicates completed, so nothing lingered to hint at the double-count.
- Pattern: same H-8/H-9 class the audit keeps closing (ContactsActions.redeemFavor, buyPet, PetActions/HobbyActions enterCompetition). The tell is purely structural: a gating read from the outer snapshot ABOVE the first `setGameState`, with the grant/marker/cost split across more than one updater. RDActions was overlooked because a PRIOR round (R10-1) had already made `processCompetitionResults` (the resolution/payout half) atomic — but the ENTRY half was never folded, and the two halves were audited separately. When a feature has a deferred payout (enter now, resolve N weeks later), BOTH halves must be atomic; hardening only the resolver leaves the printer open at entry.
- Rule: fold the gate re-check + entry fee (`applyMoneyDelta(prev, …)`) + marker append into ONE `setGameState(prev => …)` that re-reads the gate from `prev` and returns `prev` unchanged on the second tap. For any deferred-payout action, grep BOTH the enter* and the resolve/process* sides — a duplicate entry created at enter-time becomes a duplicate payout at resolve-time even when the resolver itself is atomic. Every regression test must assert exactly ONE entry appended AND the fee charged once across a same-batch double-tap.

### 2026-07-03 - The weekly-audit analyzer's own doc-drift check silently went dark after a file rename

- What went wrong: this week's tree renamed the dev docs (CLAUDE.md → DEV.md, AGENTS.md → WORKFLOW.md). `scripts/audit/audit-save.cjs` hard-coded `for (const doc of ['CLAUDE.md', 'AGENTS.md'])` for its STATE_VERSION cross-check. After the rename both files were absent, so the check hit the `src == null` branch and emitted `a.low('… not found', 'Skipping doc-version check')` for both — a WARNING that reads as noise, while the actual invariant (docs must state the canonical STATE_VERSION, drift has bitten this repo before) was no longer verified against ANY file. The audit's own safety check went dark and reported it as a low, not as "I can no longer see the thing I'm supposed to guard."
- Pattern: a static analyzer that references source/doc paths by hard-coded name silently stops enforcing its invariant when the target is renamed — the "skipping check" branch is indistinguishable from "nothing to check." This is the analyzer-integrity twin of the perf-suite lesson (2026-06-26): a check that can't run must not masquerade as a check that ran clean.
- Rule: when a file/symbol the audit scripts reference is renamed, grep `scripts/audit/` for the old name as part of the change. Point the check at the CURRENT names and distinguish "current doc missing" (worth an INFO/medium — the tree should ship it) from "legacy doc missing" (silent, expected). If NO doc satisfies the invariant, escalate to medium ("No dev doc states STATE_VERSION") rather than emitting per-file "not found" lows that bury the real signal.

### 2026-07-03 - IAPHandler resolved `true` on save-success regardless of whether the benefit applied

- What went wrong: the logic/stability pass found `components/IAPHandler.tsx` resolved the in-memory `stateUpdater` promise with an unconditional `resolve(true)` in the `saveGame().then(…)` branch, ignoring the `applied` boolean from `applyProductToState`. `IAPService.applyBenefit` keys its `skipBenefitReapply` guard on that resolved value: when the in-memory apply FAILED (`applied === false`, e.g. an unknown/misconfigured product) but the save succeeded, the service saw `true`, skipped the additive disk re-apply, and the paid consumable (gems/money/youthPills) was silently never credited — a lost paid grant. (The `.catch` branch already resolved `false`, so only the apply-false + save-success path was wrong.)
- Pattern: a callback that resolves a dedup/skip signal with an outcome it didn't actually verify. Resolving `true` on "the save finished" conflated "persisted" with "benefit landed"; the two diverge exactly when apply returns false.
- Rule: resolve the skip-reapply signal with the ACTUAL apply result (`resolve(applied)`), never an unconditional success. When one path's boolean gates whether another path does the fallback work, that boolean must reflect the thing the fallback exists to guarantee (benefit granted), not an adjacent success (disk write completed).

### 2026-07-09 - Weekly audit: exposeCatfish was the last non-atomic gate→grant, this time on reputation not money

- What went wrong: the economy pass found `SparkActions.exposeCatfish` still split across an updater + a trailing dispatch: the `setGameState(prev => …)` appended a `catfishRecord` and bumped `totalCatfishExposed` with NO dedup on `profileId` (its sibling `reportProfile` guards `reportedIds.includes`), then `updateStats(setGameState, { reputation: 5 })` ran as a SEPARATE dispatch with no `applied` gate. Two same-batch taps → duplicate record, double counter, +10 reputation for one catfish. Same H-8/H-9 structural tell the audit keeps closing, but on a bounded stat (reputation clamps 0-100) rather than money, so it graded MEDIUM not a printer.
- Pattern: the gate→grant class is not money-specific. Any value-granting action whose grant is split across the updater and a trailing `updateStats`/`updateMoney` is double-tappable — reputation, followers, records, counters all leak the same way. The tell is identical; only the severity differs by what's granted.
- Rule: fold the dedup re-check into the updater against `prev`, capture an `applied` flag inside it (the PulseActions.composePost idiom), and skip the trailing `updateStats`/`updateMoney` when `!applied` (return a `success:false`). The regression test must fire the action TWICE against the same stale snapshot and assert exactly one record + the stat delta applied once. When sweeping for this class, don't stop at `updateMoney` — grep trailing `updateStats(`/counter bumps too.

### 2026-07-09 - Weekly audit: a concurrent audit PR had already fixed our top finding on main — rebase and re-scope before pushing

- What went wrong: this run's deep pass independently found the auto-wedding path (`applyScheduledWedding`) never set `marriageWeek`/`anniversaryWeek`/`livingTogether` (a HIGH) and fixed it inline. But between branching and pushing, merged PR #49 fixed the exact same bug on `main` — and better, extracting a shared `buildSpouseRecord` factory used by both the manual and auto paths (the very "factor the shared shape into one helper" refactor this audit's own lesson recommends). Our branch was cut from a now-stale base, so the PR went `mergeable_state: dirty` (conflict in `applyScheduledWedding.ts` + the equivalence snapshot). The wedding fix was fully redundant; only the `exposeCatfish` fix + tests were still novel.
- Pattern: audit branches are long-lived relative to a fast-moving `main`. Two audit passes (ours + PR #49's) racing on the same recently-shipped feature will converge on the same top bug. A finding being real does not make it still-unfixed by the time you push.
- Rule: before opening an audit PR, `git fetch origin main` and diff your finding's file against the CURRENT tip — not the base you branched from. If `main` already fixed it, rebase onto `main`, drop the redundant change, and re-scope the PR to only what's still novel (keep your tests if they add coverage the merged fix lacks — e.g. a direct semantic assertion vs an opaque snapshot). Resolve `dirty` by resetting onto the fresh `main` and re-applying just the novel diff; force-with-lease is fine when the discarded commits were never merged.

### 2026-07-10 - Weekly audit: the new server IAP endpoint accepted SANDBOX receipts in production (free premium)

- What went wrong: this week's big new surface was `server/iap-verify/api/verify.js` (the receipt-verification backend the app fails-closed against). The deep IAP pass found `verifyApple` looped `for (const env of [Environment.PRODUCTION, Environment.SANDBOX])` and returned `true` if EITHER verified. A StoreKit *sandbox* transaction is free to obtain on a production build (sign a Sandbox Apple ID into device Settings) and its signed JWS verifies cleanly under `Environment.SANDBOX` — so a normal user could unlock `deeplife_lifetime_premium` (and every gem/perk product) for $0. The server literally decoded the environment and granted anyway. Separately, the `ALLOW_SOFT_LAUNCH` stopgap granted ANY well-formed >20-char string for a known productId, one stray env var away from a total bypass on the live endpoint, "protected" only by a bearer token that ships in the client JS bundle.
- Pattern: the money exploit this week was NOT in the game's action layer (which the audit has hardened round after round against the gate→grant double-tap class) — it was in freshly-added *backend/server* code that the five static analyzers don't scan at all. A new trust boundary (a verification server) is exactly where the next revenue leak hides once the client-side exploits are closed. Also: "verifies under some environment" ≠ "is a real production purchase" — the environment IS part of the authorization decision, not an implementation detail to loop over.
- Rule: when a release adds a server/verification endpoint, audit it as its own domain — treat every `grant`/`verified:true` path as a money printer until proven otherwise. Accept PRODUCTION receipts only in prod; gate SANDBOX behind an explicit `IAP_ALLOW_SANDBOX` flag that staging/TestFlight/review builds set and production never does. Make every soft-launch/bypass stopgap fail-closed in production (require a second deliberate `*_IN_PROD` flag). Never rely on a bearer token sourced from an `EXPO_PUBLIC_*` var as a real gate — it's in the bundle. Grant *amounts* must come from a server-side product table, never the client-supplied receipt/quantity (this part was already correct — keep it that way).

### 2026-07-10 - Weekly audit: the gate→grant double-tap class also lives in UI components, not just action modules

- What went wrong: the logic pass found `components/LifeMomentModal.tsx` `handleChoice` read `gameState.lifeMoments?.pendingMoment` from the stale render closure and applied `updateMoney`/`updateStats`/karma via separate dispatches BEFORE the `setGameState` that clears `pendingMoment`. Two same-frame taps both passed the `if (!pending) return` gate → double grant (e.g. "Bank the windfall" = +$5,000 → +$10,000; karma choices double their delta). This is the identical structural tell the audit keeps closing in `contexts/game/actions/*`, but it had gone unscanned because it lives in a `components/*.tsx` modal, and the 4→20 life-moments expansion this week added a no-cost cash-windfall choice that turned a latent double-apply into a real (if low-frequency) printer.
- Pattern: the audit's grep for the gate→grant tell has historically targeted `contexts/game/actions/`. But any component whose `onPress` reads a pending/gate value from the render closure and then fires `updateMoney`/`updateStats` across multiple dispatches is the same bug. The action-module hardening pushed the remaining instances of the class into the UI layer, where money/stat helpers (`updateMoney`) can't be trivially folded into one `setGameState(prev=>)`.
- Rule: extend the gate→grant sweep to `components/**/*.tsx` — grep for `onPress` handlers that read a `pending*`/gate field from `gameState`/props and call `updateMoney(`/`updateStats(` before clearing the gate. When the grant helpers are external dispatches that can't be folded into the authoritative clear, latch on the item's unique id with a `useRef` (set synchronously at the top of the handler, checked before applying) so a same-frame double-tap resolves exactly once — the "disable after first tap" fix, done in a way that's robust to React's render timing.

### 2026-07-10 - Weekly audit: a weekly-tick subsystem grew crash surface but stayed outside the try/catch its siblings have

- What went wrong: `runPoliticsWeeklyTick` was called at `GameActionsContext.tsx:~1470` with NO try/catch, while the banking and stocks ticks that bracket it in the same `nextWeek` updater ARE each wrapped with a fallback. This week added +67 lines of election-resolution logic to the politics tick, growing its throw surface — and a throw there would abort the entire `nextWeek` updater and soft-lock "Next Week". The static perf audit even reported it obliquely ("48/49 subsystems inside try/catch") but the one unwrapped subsystem wasn't called out by name.
- Pattern: the weekly-tick resilience invariant ("one subsystem's failure must not abort the whole tick") is enforced unevenly — new subsystems get added without the try/catch wrapper their siblings have, and the "N/M wrapped" static metric hides *which* one is bare. A subsystem that gains new code this week is exactly the one whose missing guard now matters.
- Rule: when a weekly-tick subsystem gains logic in a release, confirm its call site is inside a try/catch with a carry-over fallback (`nextX = prevState.x` on error), mirroring banking/stocks. Better: make the static audit name the unwrapped subsystem(s) rather than emit a bare "48/49" count, so the gap is actionable instead of buried.

### 2026-07-13 - Weekly audit: political office was double-paid, and the money-conservation lens was blind to it

- What went wrong: winning political office (`PoliticalActions.ts`) sets BOTH `currentJob:'political'` and pushes `careers[political]` with `accepted:true`. That made the generic weekly career-salary path (`applyCareerSalaryAndPenalty.ts`) pay `POLITICAL_CAREER.levels[level].salary` as a WEEKLY amount, while `passiveIncome.ts` ALSO paid the same salary as ANNUAL ÷ WEEKS_PER_YEAR. Both fed `totalIncome` every week. POLITICAL_CAREER salaries are authored as annual figures (President = 100000), so the generic path paid a President ~$100k/WEEK (~$5.2M/yr) on top of the intended ~$1,923/wk — and because office-loss only zeroes `politics.careerLevel` (not `currentJob`/`careers[].accepted`), the ~$100k/wk never stopped after being voted out. A textbook money printer gated behind "win an election."
- Pattern (two compounding): (1) the same salary table is consumed by two income paths with DISAGREEING units (one treats it weekly, one annual) — whenever a value feeds more than one accrual path, the paths must agree on units AND on ownership, or they double-count. (2) The economy/money-conservation stress suite is blind to income that only unlocks off the default loop: winning the presidency isn't in the default simulation, so 33/33 money-conservation tests stayed green while a President printed millions. The static economy analyzer (savings<loan APR, tax monotonicity, miner ladder) also can't see it — it audits constants, not the tick's income aggregation. It took the *game-logic* lens (trace what fires on `currentJob:'political'`), not the *economy* lens, to catch it.
- Rule: any income source that is ALSO delivered by `passiveIncome` (political, rent, mining, stocks…) must be excluded from the generic per-`currentJob` career-salary path — one owner per income stream. When you add a salary/price table consumed by multiple accrual paths, assert the unit (weekly vs annual) at every consumer and pick a single owner. For the audit itself: money-conservation stress tests must exercise the OFF-default income unlocks (hold each political office for a week and assert the weekly credit equals the single intended figure), because a printer behind a feature-unlock is invisible to a default-loop conservation test. When the economy lens comes back clean, still run the game-logic lens over "what pays out when `currentJob`/a career flag is set" — the two lenses catch different halves of the economy.

### 2026-07-13 - Weekly audit: crypto & dark-web ticks were the last two subsystems running outside try/catch

- What went wrong: continuing the 2026-07-10 "bare weekly-tick subsystem" thread, the crypto tick (`GameActionsContext.tsx` ~1342) and dark-web tick (~1484) were the only subsystem ticks in the `nextWeek` updater still NOT wrapped in try/catch (banking/stocks/politics/pulse/spark/hustle all are). Both self-guard *missing* top-level slices (`?? initial`), and dark-web even carries a comment claiming it avoids throws — but that self-guard only normalized `activeJobs`/`recentEvents`, leaving `vendors`/`skills`/`laundering`/`listings` exposed, and crypto left `coinMarkets.btc` (halving path) and `market.openOrders` iteration unguarded. A present-but-null sub-field (CloudSync merge / hand-edit / corruption — the exact class `repairGameState` names as a threat but only handles for whole-slice-missing) throws, and a throw there aborts the whole updater → "Next Week" soft-locks. The static perf audit reported it only as an opaque "50/51 subsystems inside try/catch" — the ONE bare subsystem wasn't named, and here there were effectively two.
- Pattern: a subsystem that "self-guards" is not equivalent to one wrapped in try/catch — the self-guard defends the fields the author remembered, and silently rots as the schema grows new sub-arrays. The belt-and-suspenders wrapper (try/catch + carry-over fallback) is what actually makes the resilience invariant hold regardless of which sub-field is null. The "N/M wrapped" static metric hid *which* ones were bare.
- Rule: every subsystem tick call in `nextWeek` gets its own try/catch with a carry-over fallback (`nextX = prevState.x`), full stop — don't rely on the subsystem's internal null-guards to substitute for it. When a normalize/self-guard block lists specific sub-fields, it must cover EVERY iterated/indexed slice of that type (grep the tick's operations for `for (const … of dw.X)` / `dw.X[`), not just the two the author hit first. Upgrade the static audit to NAME the unwrapped subsystem(s) rather than emit a bare "50/51".

### 2026-07-16 - Weekly audit: the "bare weekly-tick subsystem" class recurred a 4th time — and this time I finally made the static audit NAME the gap

- What went wrong: this week added FOUR new subsystem calls into the `nextWeek` updater — `applySubscriptionsForWeek` (in-game sub billing, 1365), `applyContentMemberships` (streaming memberships, 1552), `applySavingsGoals` (1574), and `expireFavors` (favor-ledger expiry, 1596) — and NONE were wrapped in the per-subsystem try/catch that every sibling (banking/stocks/politics/crypto/darkweb/pulse/spark/hustle) has. The concrete HIGH: `expireFavors` (`lib/contacts/favors.ts`) did `ledger.favors.map(...)` while the call site only guarded `prevState.favorLedger` truthiness — a present-but-partial `favorLedger: {}` (CloudSync merge / hand-edit / interrupted migration) throws `undefined.map`, and unwrapped in the updater → outer catch at ~2033 returns `prevState` → `weeksLived` never advances → PERMANENT "Next Week" soft-lock. The other three were defensive enough that I couldn't construct a throw today, but they broke the categorical invariant. The static perf audit again reported only a bare "52/53 subsystems inside try/catch" — the offenders weren't named.
- Second finding (MEDIUM, different class, same root save-shape): dc3e337's crash-fix sweep for legacy `sparkApp` lacking `premium` missed two sibling call sites — `SparkActions.rewindLastSwipe` (`sp.premium.perks.rewindLastSwipe`, line 273) and `likeBackFromLikedYou` (`sp.premium.perks.seeWhoLikedYou`, line 468). Both read the RAW `gameState.sparkApp` (no `ensureSpark` backfill) and only guarded `if (!sp)`, so an old save with a `premium`-less sparkApp crashes with "Cannot read properties of undefined (reading 'perks')" on tapping Rewind / a Liked-You entry. A partial-save fix that touches ONE consumer of a slice must grep for EVERY consumer of the same sub-field — the class re-lives at the sites the sweep skipped.
- Economy verdict: CLEAN. Streaming (finalize/start/tick), in-game subscriptions, and the ad-reward orb were all independently traced by subagents + by hand — the gate→grant double-tap class is architecturally closed (every grant folds into the authoritative `setGameState(prev=>)` updater via `applyMoneyDelta`, with the gate re-checked against `prev` inside it). No printer. Non-blocking LOWs filed: immediate stream/video payouts bypass the $75k/wk soft-cap that only the passive aggregator enforces (earned + hard-bounded by the 5-actions/week cap, so a balance decision not an exploit); subscription weekly billing has no `BANKRUPTCY_FLOOR` guard (anti-player, drains to $0, unlike loan autopay); subscribe actions lack an already-active re-entry guard (anti-player double-charge, mitigated by modal gating); dead `deps.updateMoney` param in ContentActions.
- Rule: the recurring lesson finally got its tooling fix — `audit-perf.cjs` P2 now NAMES the unwrapped subsystem calls (`— unwrapped: <names>`) instead of a bare "N/M", so the next bare subsystem is actionable at a glance rather than buried in a count. The block-count delta (42→46 here) is the honest signal that new wraps landed. When the count is "M-1/M", read the named residual: a pure self-guarding helper like `applyMoneyDelta` (returns null, never throws) is an acceptable residual; a real `apply*/run*/process*` subsystem tick is not. Keep folding: every NEW subsystem call added to `nextWeek` gets its own try/catch + carry-over fallback in the same commit that adds it — the invariant is categorical, not a function of whether you can construct a throw this week.

### 2026-07-17 - Weekly audit: the "bare weekly-tick subsystem" class recurred a 5th time (disease/pet/vehicle/luxury) — and I learned the static P2 metric can't see it

- What went wrong: the chronic-disease management loop (11e87e6) added new logic to `applyDiseasesForWeek` but left its call site in the `nextWeek` updater OUTSIDE any per-subsystem try/catch — as were its three neighbors in the same block (`tickPetsForWeek`, `applyVehiclesForWeek`, `applyLuxuryItemsForWeek`). All four iterate player-growable arrays (`diseases`/`pets`/`vehicles`/`luxuryItems`) and carry real partial-save throw surface — the concrete one: `applyDiseases.ts:107` `[...(input.prevDiseases || [])]` throws "not iterable" on a truthy non-array `diseases` (CloudSync merge / hand-edit / interrupted migration), BEFORE the helper's own `Array.isArray` guard. Unwrapped, that throw falls to the outer updater catch which returns `prevState` → `weeksLived` never advances → "Next Week" fails that week (mitigated: the outer catch surfaces an error toast rather than white-screening, and `repairGameState` normalizes `diseases` to `[]` on next load — so it's failed-week-until-reload, not a permanent brick). Fixed all four with their own try/catch + carry-over fallback, preserving the deliberate money-mutation order so the success path stayed byte-identical (308 subsystem snapshots unchanged).
- Second thing I learned (audit-tooling reality check): I tried to make `audit-perf.cjs` P2 "name the gap" by excluding the whole-updater try (whose catch returns prevState = the soft-lock) from the guarded-ranges set. It backfired: doing so drops guarded coverage from 52/53 to 23/53 and names ~30 subsystems (computeWeeklyIncome, applyRentAndHousing, applyCrimeTick, applyWeeklyEvents, …) that ALSO rely solely on the outer wrapper. The truth the experiment exposed: the code does NOT actually wrap every subsystem individually — only the higher-risk, partial-save-prone ones get inner try/catch, while ~30 pure-ish calculators lean on the outer net. P2 is a *tolerant smell check* (guardRatio ≥ 0.6, outer-wrapper counts) by design; a strict "every call in its own try" rule would flag a 30-item backlog, not a regression. Reverted the P2 change.
- Rule: keep wrapping incrementally — every NEW or NEWLY-EDITED subsystem call in `nextWeek` that iterates a player-growable array gets its own try/catch + carry-over fallback in the same commit that touches it (the actionable, non-flooding version of the categorical invariant). The static P2 check genuinely CANNOT distinguish "safe outer-wrapper reliance" from "dangerous outer-wrapper reliance" — it counts the outer try as a guard — so it will keep reporting a reassuring 52/53 while a freshly-edited array-iterating tick sits bare. The real detector is the human/subagent game-logic lens tracing "which newly-touched tick iterates a growable slice without a leaf try" — run it every week on the diff, because the number will lie.
- Merge note: this fix collided with PR #65 (vitals-UI redesign), which added `moneyBeforeLuxury`/`luxuryCharged`/`moneyBeforePetFood`/`petFoodCharged` locals to the same pet/vehicle/luxury block. Re-applied the wrap onto the rebased base, hoisting the downstream-used vars (updatedPets/updatedVehicles/luxuryCharged/updatedAchievements/petFoodCharged) and leaving PR #65's money-floor intermediates as `const` inside the try.
- Review refinement (CodeRabbit, valid): my first cut grouped pets + vehicles + luxury + pet-food into ONE shared try/catch. That's a half-measure — those subsystems mutate `weeklyCtx.newStats.money`/happiness IN SEQUENCE, so if a LATER one (luxury) throws after an EARLIER one (vehicle maintenance / pet-death penalty) already mutated `newStats`, a shared catch reverts the later subsystem's OUTPUT (`updatedVehicles`→prevState) while the cash/happiness mutation stays applied → state-vs-cash desync, and the player gets re-charged/re-penalized for the same week on the next tick. Rule: when wrapping N sequential subsystems that each mutate shared `newStats`, give each its OWN try/catch so a failure isolates to that subsystem and never rolls back a sibling whose side effect already landed. Also: the carry-over fallback must self-heal — `?? []`/`|| []` preserves a truthy non-array (the exact throw case) and re-throws every week until reload; use `Array.isArray(x) ? x : []` so the bad shape is replaced THIS tick.

### 2026-07-22 - Weekly audit: migration/repair asymmetry — `realEstateActivity` had a v22 migration but no `repairGameState` mirror (the static save audit can't see per-field repair parity)

- What went wrong: `realEstateActivity: []` (`initialState.ts:75`, a top-level concrete-default array) was backfilled on the version ladder by migration 22 (`saveMigrations.ts:619`) but was NEVER mirrored into `repairGameState` (`utils/saveValidation.ts`) — zero matches in the file. This is exactly the CLAUDE.md save-format rule (b) asymmetry ("set a value in the migration AND mirror it in repairGameState") that Hard Rule #3 exists to catch. It is not an active crash — every consumer already guards with `?? []` (`GameActionsContext.tsx:808`, `RealEstateApp.tsx:338`) — but a partial save already stamped at v23 (CloudSync merge / hand-edit) that is missing the key is healed by neither path: the wholesale migration skips it (version already current) and repair has no branch for it. Four v22 Wave-A NESTED fields have the same gap at LOW severity (`travel.passportMilestones`, `socialMedia.followerHistory`/`scandalRiskScore`, `gamingStreaming.perkTier`/`lastMemberWeek`/`hypeStreak`) — all guarded reads, filed not fixed. Fixed the top-level `realEstateActivity` with a 6-line mirror of the adjacent `luxuryItems` block.
- Pattern: the static save analyzer verifies the version-consistency invariants (STATE_VERSION across code+docs, contiguous migration coverage [2..N], repair/factory PRESENCE) but it does NOT cross-check each concrete-default field in `initialState` against BOTH migration and repair coverage — so a field can be migration-covered, factory-covered (createTestGameState spreads `...initialGameState`, so (c) is structurally auto-satisfied for every field), and still silently miss the repair mirror (b). The audit's own v23 fields (luxuryItems/ambition*) got both treatments and passed; the OLDER v22 additions were the ones that rotted. Guarded `?? []` reads at every consumer are what keep this at MEDIUM instead of a crash — which is also why a purely runtime test never surfaces it.
- Rule: when a field with a concrete stored default is added to `initialState`, its migration backfill AND its `repairGameState` mirror must land in the same commit (rule (b)), for NESTED fields too — the parent-subsystem repair block must list every new concrete-default sub-array/scalar, not just the ones the author hit first (same "self-guard rots as the schema grows" failure as the bare-tick class). Audit-tooling upgrade worth doing: extend `audit-save.cjs` to enumerate every `key: <concrete-default>` in `initialState` and assert each appears in BOTH `saveMigrations.ts` and `saveValidation.ts` (skipping `undefined`-default keys like `ambitionId`), so the migration/repair asymmetry becomes a named static finding instead of a subagent catch.
- Economy note (NOT fixed — design call for the owner): channel-membership income (`applyContentMemberships.ts`, new v2.5.7) is credited post-tax at `GameActionsContext.tsx:1801`, capped $75k/wk and idempotent (`lastMemberWeek`), but never enters `totalIncome` so it escapes progressive tax — WHILE the same creator app's ad-revenue stream flows through `passiveIncome`→`totalIncome` and IS taxed. It is consistent with the established post-tax-credit pattern for crypto (`:1698`), hustle (`:1657`), and stocks (`:1929`), so it is not a new regression or a printer; taxing it would require risky tick-reordering (tax computed at `:836`, membership at `:1795`). Left as a filed balance decision rather than changing money-flow in an unattended routine. Lens rule reaffirmed: economy came back CLEAN on printers/double-grants/free-debt-erasure; the only real fix this week came from the SAVE lens, not the economy lens.

### 2026-07-24 - Weekly audit: the monetization wave's real gap was the ECONOMY lens, not save/state — a daily premium-currency claim gated only on a device-clock day-string (farmable)

- Static + save-drift both came back CLEAN (the save subagent confirmed the entire DeepLife+ / gem-shop / Skill-Mastery wave added ZERO fields to `initialState.ts`, persisting via the sanctioned optional-undefined `settings` pattern like `ambitionId`, so no migration/version bump was owed; the only 🟡 was the pre-existing cosmetic `as GameState`-in-tests count). The one real finding (HIGH) came from the economy/exploit lens: `claimDailyGems`/`canClaimDailyGems` (`contexts/game/actions/SubscriptionActions.ts`) gated the daily gem drop SOLELY on `settings.deepLifePlusLastGemClaim !== todayKey`, where `todayKey = utcDayKey(new Date())` — a pure UTC day-STRING derived from the device clock, with no monotonic timestamp. Gems are the PAID premium currency (sold via `deeplife_gems_*` IAPs), so this minted paid currency for free: set the device clock forward a day → new day key → claim 250 (member)/20 (free) again, repeat arbitrarily; rolling BACKWARD also worked since the guard was a pure inequality, not `todayKey > lastClaim`. Compounded the perfect-week bonus (fabricate a full Mon→Sun window of keys → extra full daily drop). This violates the playbook's own H-3 note: "Daily/real-time claims should guard against `Date.now()` manipulation."
- Fix (two layered guards — the FIRST cut was incomplete, see below): (1) STRICT DAY-KEY MONOTONICITY — `todayKey` must be strictly LATER than the stored `deepLifePlusLastGemClaim` (keys are `YYYY-MM-DD`, so lexicographic `<=` is chronological); and (2) a MONOTONIC epoch high-water mark `settings.deepLifePlusLastGemClaimAt` (optional, undefined-default → no version bump, matches the wave's own pattern) that also rejects a `nowMs` below the stored mark (minus a 5-min NTP skew tolerance), stamped `max(previous, now)` so it never decreases. Both guards live in one pure primitive predicate `canClaimDailyGemsFor(lastKey, lastAt, todayKey, nowMs?)` that BOTH the reducer and the `DailyGemClaim.tsx` CTA call, so the button and the reducer can never disagree about the tolerance. `nowMs` is optional so legacy 2-arg callers still work (epoch guard skipped); the real call site passes `Date.now()`, and the CTA shows the settled chip (not a dead button) exactly when the shared predicate says ineligible.
- What the FIRST cut got wrong (CodeRabbit CRITICAL, valid — caught in review): the epoch high-water mark ALONE, with a 5-min skew tolerance and only a same-day-STRING guard, still allowed an unbounded ALTERNATING-ADJACENT-DAY farm across midnight: claim 23:59 (mark=23:59) → claim 00:02 next day (day key differs, 3 min > mark so allowed, mark=00:02) → rewind to 23:59 (day key differs from 00:02's key, and 23:59 is only 3 min below the 00:02 mark — INSIDE the 5-min tolerance, so the epoch guard passes) → reclaim yesterday's key → repeat the two timestamps forever. The tolerance that protects a benign NTP nudge is exactly the window an attacker oscillates inside. The strict day-key monotonicity (guard 1) is what actually closes it — once you've claimed key `D`, no key `<= D` is ever claimable again — and it makes the epoch mark defense-in-depth rather than the primary bound.
- Pattern: a client-only game (no server clock — which is why save integrity leans on HMAC tamper-detection) cannot FULLY stop an offline clock-FORWARD cheat, but the two guards together close every BACKWARD vector (same-day, whole-day-rewind, and the sub-tolerance alternating-midnight farm) and make forward-farming self-limiting (advancing the clock advances both marks, so returning to real time locks the cheater out until real time passes their furthest claimed day). Deeper lesson: when you add a tolerance to a monotonic guard to avoid a false-positive, prove the tolerance window itself isn't farmable by oscillation — a scalar high-water mark + tolerance is oscillation-farmable across a category boundary (here midnight) unless a SEPARATE strictly-monotone key (the day string) also advances. The static economy audit checks constant LADDERS (APR ordering, tax monotonicity, miner prices) but has no notion of a real-time/daily claim surface — this class only surfaces under the exploit-lens qualitative pass (and the exploitable gap in the FIRST fix only surfaced under adversarial review — worth having a skeptic re-derive the exploit against the patch, not just the original code).
- Rule: any real-time/daily/cooldown reward (especially one paying premium currency) must gate on a STRICTLY-MONOTONE claim key (reject `todayKey <= lastKey`), not merely `!==`, AND persist an absolute epoch high-water mark; never gate solely on a clock-derived day/hour STRING, and never let a skew tolerance be the only thing standing between two claims. Share ONE predicate between the reducer and every UI that gates on it. Audit-tooling upgrade worth doing: extend `audit-economy.cjs` to flag any reducer that reads `utcDayKey`/`new Date()`/`Date.now()` for claim ELIGIBILITY without a strict `<=`/`>` day-key comparison against a persisted last-claim key, so "clock-string-only daily claim" becomes a named static finding instead of a subagent (or reviewer) catch. Lens reaffirmed (3rd audit running): the save lens caught the last two weeks' real bugs, this week the economy/exploit lens did — run all five every time; the clean lenses are not the ones that will bite.

### 2026-07-28 - Weekly audit: two luxury-VERB money printers slipped past the yield-vs-upkeep test because verb income never flows through `getTotalLuxuryYield`

- Static + save-drift + logic/perf all came back CLEAN on their own lenses (the only 🟡 was the pre-existing cosmetic `as GameState`-in-tests count; the save subagent confirmed every recently-added field — `luxuryItems`/`luxuryHoldings`/`hasPilotLicense`/ambition* — is covered across all four legs and the v24/v25 migrations are gap-free). Both real findings came from the economy/exploit lens, and both live in `lib/luxury/verbs.ts` — the Phase-4b "verbs" wave that added things you DO with a trophy. The catalog's core invariant ("every `yield.weekly` is set BELOW its item's `weeklyUpkeep`, so a full collection still net-costs") is genuinely upheld by all 12 catalog rows AND by `yieldAppreciation.test.ts` — but that test only sums `getTotalLuxuryYield`, which reads the static `yield` field. Verb income is a SEPARATE channel (`getLoanIncome` added on top of yield in `applyLuxuryItems.ts:74`, and `resolveRace` purse credited via `LuxuryActions`), so it bypasses the only guardrail.
  - HIGH — museum loan: the `museum_diamond`'s "Loan to a museum" verb cost $0 / 0 energy with `cooldownWeeks: 12` == `MUSEUM_LOAN_WEEKS: 12`, so it re-armed the exact week the loan lapsed → continuous coverage. $4,000/wk fee vs the diamond's $200/wk upkeep = uncapped, untaxed +$3,800/wk (~33%/yr) on a $600k asset for tapping one button every 12 weeks. Fix: fee → $120/wk, below the item's upkeep, so continuous re-arming still net-costs. The draw is the prestige (+4 rep/loan), not the cash.
  - MEDIUM — racehorse: "Enter a race" credits the purse EXCLUDING the $25k entry, but the PLACE purse was $30k > entry, so a win AND a place both profit (2 of 3 outcomes) → +$5k/race base EV, climbing with form. The code comment literally claimed "the entry is lost on every run that is not a win or a place" while the numbers said otherwise. Fix: place → $15k (softens, doesn't cover the entry), win → $70k, so base EV is negative and only a win profits; a maxed champion only edges positive per race, which upkeep-net-of-yield eats over the cooldown.
- What the tests got wrong: both verb tests asserted only single-payout MAGNITUDE ("best case < $200k", "fee == the constant") — never per-cycle EV or income-vs-upkeep. One test (`verbs.test.ts` "the prize covers the entry") actively ENSHRINED the racehorse exploit by asserting place >= entry. A test that pins the buggy number is worse than no test. Corrected it and added the two missing assertions: base-form race EV <= 0 over the {win,place,unplaced} distribution, and museum fee strictly below the diamond's upkeep.
- False-positive worth recording: the logic subagent flagged (SUSPECTED, medium-ish) that `calculateNetWorth` in `preTick.ts` omits luxury, concluding "the appreciation/market-value machinery has zero effect on the net worth that gates prestige." It does not — there are FIVE net-worth implementations, and the canonical one is `netWorth()` in `lib/progress/achievements.ts`, which DOES include luxury (`getTotalLuxuryMarketValue`, resale-haircut + appreciation + condition). That `netWorth` is what prestige, prestige points, leaderboard, ambitions, bail cost, ad rewards, and stats all read (via `statisticsTracker.calculateNetWorth` → `netWorth`). `preTick.calculateNetWorth` is a legacy, more limited helper used for secondary decay inputs; `ShareLifeCard` and `retirementCalculator` carry their own luxury-omitting copies. So `createLuxuryProperty`'s `price:0` ("already counted through luxury resale") holds — no double-count, no missing-count. Lesson: when a subagent says "X isn't counted," grep for EVERY implementation of the thing before believing it — a duplicated calculation means "the one I read omits it" is not "the system omits it." Filed the 5-way net-worth duplication as a LOW consistency smell (a $120M collection shows in prestige/bail/ads but not the share card or retirement projection).
- Rule: any luxury/asset SIDE-CHANNEL income (verb payout, loan fee, event purse) must obey the same "below the item's upkeep / non-positive base EV" bar the passive `yield` field does, and the balance test must assert it THROUGH the channel the money actually flows (per-cycle EV, income-vs-upkeep), not just single-payout magnitude — because `getTotalLuxuryYield` only sees the static field. Audit-tooling upgrade worth doing: extend `audit-economy.cjs` to enumerate luxury verbs/loan constants and flag any whose best-case or expected per-cooldown-cycle net income exceeds the owning item's `weeklyUpkeep`, so "verb out-earns its trophy" becomes a named static finding. Lens reaffirmed (4th audit running): the economy/exploit lens caught this week's real bugs; the save lens caught the prior two weeks'. Run all five every time — and re-derive the exploit against the code, because a comment claiming "this can never be a printer" is exactly where the printer hides.

### 2026-07-28 (b) - Backlog sweep: the "filed not fixed" pile is where the audit's own tooling debt hides

- What I did: swept every finding the recent audits recorded as REAL but left unfixed, rather than running another discovery pass. The pile was six items across three audits (2026-07-16 economy LOWs, 2026-07-22 save parity, 2026-07-28 net-worth duplication) plus the three "audit-tooling upgrade worth doing" notes those same audits ended with. Every one was still present in the source — a finding filed with a file:line and no owner does not decay into a false positive, it just waits.
- What the tooling upgrade paid for immediately: the 2026-07-22 lesson asked for a static check cross-referencing each migration-backfilled concrete default against `repairGameState`. Built as `audit-save.cjs` V8, it reproduced the four NESTED v22 fields the human pass had already named — and then found FIVE OLDER ones nobody had looked for (`wantedLevel`, `processedIAPTransactions`, `pursuits`, `weeklyPursuitPractice`, `legacyPass.ownedCosmetics`). `wantedLevel` had real teeth: `JobActions.ts:316` does `prev.wantedLevel + (job.wantedIncrease || 1)` with no `?? 0`, so a partial save missing the key turns it into NaN and every success chance reading it (`Math.min(25, wantedLevel * 3)`) goes NaN too. The check's precision came from ONE design decision: `initialState.ts` is the authority on what "the default" is, so a migration that DERIVES a value (`lastEventWeeksLived = state.weeksLived || 0`) or converts legacy data (`challengeStreak`) is not flagged — filtering on that dropped the raw 9 hits to 5 genuine ones with no allowlist.
- Rule for new static checks: prove the check FAILS before shipping it green. All three new analyzers (save V8, economy E10 clock-string claims, economy E11 luxury-verb income) were run against the restored historical buggy values — $4,000 museum fee, $30k place purse, `todayKey !== lastKey` — and each tripped with the right message; then the probe was reverted. A check authored against already-fixed code and never seen red is an assertion that the current source equals itself.
- Economy note: the two subscription LOWs were both ANTI-player, which is why they survived four audits — the exploit lens hunts printers, and a bug that quietly overcharges the player trips nothing. Weekly billing had no `BANKRUPTCY_FLOOR` guard (drained to $0, unlike `applyLoanAutopay`), and `subscribeVerifiedPro`/`subscribeSparkPremium` re-charged full price for the plan you already held, resetting an annual `paidThroughWeek` to now+52 instead of extending it. Add "does this overcharge or under-deliver to the player" as an explicit pass of the economy lens; a money bug does not have to favour the player to be a money bug.
- Duplication note: the 5-way `netWorth` split resolved into three real answers, not one. `ShareLifeCard` was simply WRONG (cash + bank + real estate at PURCHASE price, contradicting every other surface) → now reads the canonical `netWorth()`. `fireTracker`/`retirementCalculator` held byte-identical copies with a DIFFERENT and defensible basis (income-producing / liquidatable assets only — a 4%-rule projection should not tell you a yacht funds your retirement) → extracted to one `lib/statistics/planningNetWorth.ts` with the basis written down, numerically unchanged. `preTick.calculateNetWorth` is snapshot-locked and stays. Rule: dedupe by first asking whether the copies MEAN the same thing; collapsing a deliberate second basis into the canonical one is a balance change wearing a refactor's clothes.

### 2026-07-29 - Full six-domain audit, executed: what the fixes taught that the findings didn't

- Context: a 12-agent audit (six domain passes, each re-checked by a separate adversarial verifier) produced 29 confirmed findings; all 29 are now closed across six phases. The findings documents are `tasks/full-audit-2026-07-28-findings.md` and `-plan.md`. What follows is only what EXECUTING them taught — the findings themselves are already written down.
- **The biggest bugs were all in code no test could reach.** GL-1 (event chains latched forever after one chain, locking out every future chain for the life) and GL-5 (`family.spouse` survived a breakup) both lived inline inside the `nextWeek`/`resolveEvent` React callbacks. `eventChains.test.ts` existed, but it hand-BUILT an `activeEventChain` and only exercised `getNextChainEvent` — nothing ever played a chain from stage 0 to its end, so the completion branch was unreachable in play AND unreachable in test. Extracting the decisions into pure `advanceEventChain` / `resolveFamilySpouse` helpers is what made the bugs visible; both now have tests that fail against the old logic. Rule: when a finding's root cause is "the branch was unreachable", the fix is not just the branch — it is moving the decision somewhere a test can drive it. A bug that hid in a callback will hide there again.
- **A fixed `mockReturnValue` cannot catch a double-roll.** The layoffs event drew `Math.random() < surviveChance` twice — once for `effects`, once for `special` — so ~48% of resolutions contradicted themselves (keep the job AND eat the laid-off penalty, or collect the survivor's reputation AND be fired). My first test mocked a constant and PASSED against the buggy code, because both draws read the same value and agreed by accident. Only a mocked SEQUENCE (`mockReturnValueOnce(0).mockReturnValueOnce(0.99)`) exposes it. Rule: to test that N draws became one, you must vary the draws; asserting on a single frozen value tests nothing. The strongest form is `expect(Math.random).toHaveBeenCalledTimes(1)`.
- **"Prove the check red" keeps finding more than the check was written for.** Every new analyzer this cycle was run against the pre-fix tree before shipping green — and two of them immediately found work nobody had scoped: `audit-save` V8 (migration↔repair parity) turned 4 known gaps into 9, including `wantedLevel`, which `JobActions` increments with no `?? 0` so a partial save turns it into NaN; `audit-perf` P5 (zero-importer reachability) turned 13 named dead modules into 26, including a SECOND `applyLegacyBonuses` and a duplicate `FamilyBusinessSystem` sitting beside the live ones. Deleting also cascades — `audioLibrary` was the only importer of `audioManager`, which the check caught on the next run. Rule: a static check pays for itself on the first run or it was written too narrowly; and after a dead-code sweep, re-run the reachability check rather than assuming one pass converged.
- **Two fixes were nerfs that needed their mitigation in the same release.** econ-1 (luxury sold at catalog sticker while net worth counted condition-adjusted value, so selling a damaged trophy RAISED net worth and prestige points) shipped in one commit with reach-2 (insurance and restoration had zero call sites — the risk system was one-way loss with no counterplay). Shipping the nerf alone would have made every incident unanswerable. Rule: when a finding's own risk note says another finding is its counterplay, they are one release, not two.
- **Reporting fixes must not become balance changes.** recap-1's obvious fix — fold luxury yield into `totalIncome` so the recap adds up — would have routed it through `calculateIncomeTax` and retroactively taxed it. The yield went into the DISPLAY fields only. Same shape as the CLAUDE.md note about the store-version/binary-version split: the honest-looking unification is the one-way door. Rule: before making a number consistent, check which consumers of that number are money paths.
- **Dead code is where the wrong answer hides — and the audit proved it twice.** PERF-4 and PERF-5 were both a LIVE system whose only other implementation was unreachable. PERF-5's was worse than dead: `applyRelationshipGain` (charisma / socialMaster) had no production consumer at all, so a purchased skill node promised faster bonds and did nothing. Deleting the orphan made that visible; wiring it into `updateRelationship` (gains only — skills never soften a betrayal) is what made the purchase real. Rule: an orphaned module is not just clutter, it is a place where a feature can appear implemented.
- **Anti-player money bugs need their own lens.** econ-4 (an uncapped CASH ad faucet) was found by the exploit lens, but its siblings — subscription billing draining past `BANKRUPTCY_FLOOR`, and re-subscribing re-charging full price while resetting an annual term — survived four audits because the exploit lens hunts printers and these overcharge the PLAYER. Rule: run the economy lens twice, once asking "can the player mint money" and once asking "can the game overcharge or under-deliver".

### 2026-07-29 (b) - Save-system audit anchored on a real player report: what a lost save actually teaches

- Context: a player mailed in a prestiged save replaced by a Week 1 / Age 18 / Generation 1 character that validated clean — 0 errors, 0 warnings, no error or warn logs. An 11-agent audit (five domain passes, each finding adversarially verified, synthesised by a separate orchestrator) returned 46 raw → 42 confirmed, 11 refuted. All 41 still-present findings are now closed across seven phases; `tasks/save-system-audit-2026-07-29-findings.md` and `-plan.md` hold the details. What follows is only what the incident and the fixes taught.
- **"Valid: yes, Errors: 0" was the most informative line in the report.** A save that validates perfectly and is still wrong is not corrupt — it is the wrong save. That single observation ruled out the entire corruption/migration surface before any code was read, and pointed straight at the write path. The fingerprint then closed it: money 200, age 18, weeksLived 0, careers 30, items 8, relationships 2 are `initialGameState` field-for-field, and NO scenario starts at age 18 with cash 200, so it could not have been built by onboarding. It was the untouched boot state, autosaved from the main menu (fixed in 2.5.7, after the player's 2.5.3 build). Rule: when a report says the data is valid, stop looking for corruption and start asking which writer produced it — and diff the payload against `initialState` before anything else.
- **I found a complete, plausible root cause that was NOT the incident — and it was still a real bug.** Independently of the agents I traced a full chain: the death screen navigated into onboarding setting no slot, `OnboardingContext` defaulted `slot: 1`, `flowGuard` never checked a slot, and `Perks` closed the gap with `state.slot || 1`. Every step verified in source. The agents confirmed it as SAVE-OW-2 — and separately proved it was not what happened to THIS player. Rule: a chain that reproduces the symptom is not thereby the cause; keep hunting until the payload's fingerprint is explained, and ship the other bug anyway.
- **The audit's most valuable finding was against code I had written an hour earlier.** SEC-1 flagged `slotSafety.inspectSlotForNewLife` — my own uncommitted last-line-of-defence — for the exact flaw it was written to prevent: `readSaveSlot` returns the SAME `null` for "nothing stored", "failed CRC32/HMAC" and "the read threw", so my `free` branch would have called an unverifiable save empty and deleted it. One HMAC key rotation (a live plan) would have made every slot on every device look free to overwrite. The module's own header even claimed "any failure to read resolves to `unreadable`, never `free`". Rule: run the audit against the fix, not just the original code — and treat a doc comment asserting a property as a claim to verify, especially when you wrote it.
- **The same conflation lived in five places, and fixing the callers is not fixing the bug.** `findFirstEmptySlot`, `checkIfAllSlotsFull`, `slotSafety`, `validateSaveSlot` and `purgeSlotIfPhantom` all read that null as "empty". Two other modules (`probeSaveSlotBlob`, `phantomSaveCleanup`) had the rule RIGHT and even documented it verbatim — "callers must never treat 'unknown' as safely overwritable" — but the fix never propagated. Phase 1 patched the callers; Phase 4 went to `doubleBufferLoad` and made the outcomes distinguishable (`none` / `unverified` / `unknown` + a `blobPresent` that a thrown read reports as `true`). Rule: when the same misreading appears in 3+ callers, the API is the bug. And a correct rule written in one module's comment does not propagate itself — encode it in the type.
- **Every recovery mechanism in the app was inert, in four independent ways, and each one hid the next.** Backups were written on every save but `restoreFromBackup` had zero callers (BRC-1); it wrote to the legacy single key while the loader reads the double buffer, so a restore was a silent no-op that returned `{success: true}` (BRC-1b); the 5-deep ring plus an unthrottled 2-minute autosave meant the whole recovery window was about ten minutes of play (BRC-2); and the "pre-save backup" snapshotted the state being WRITTEN, not the one being replaced (BRC-3). The one UI state literally labelled "Recovery Needed" offered exactly one action: Delete. Rule: a backup system is only as real as its most recently exercised restore. If nothing calls the restore path, assume it does not work — and test the round trip through the production LOADER, not through the key the restore happened to write.
- **The anti-cheat gate was aimed at the wrong person.** `canRestoreBackup` was written for an in-run rewind and applied to every restore, so `continueAsChild` bumping `generationNumber` made every backup from the run that just ended permanently unrestorable, and because the autosave keeps running while the death screen is up, the ring filled with dead-state backups that became the only LEGAL restores. Its catch failed closed "for security" — trading a single-player progression exploit against permanent data loss for someone whose save is already broken. Rule: separate INTENT (recovery vs rewind) before applying progression guards, and default an integrity check to fail-open when the failure mode on one side is unrecoverable data loss and on the other is a single-player exploit.
- **The test I wrote as an oracle found more than the audit did.** SEC-8 reported that the hand-rolled SHA-256 wrote a wrong 64-bit length word (`>>> 56` is `>>> 24` in JS). I fixed that and wrote a test comparing against `node:crypto` — which still failed, revealing a second defect nobody had found: the ipad/opad blocks were built as a JS STRING and handed to a `sha256` that UTF-8-encoded its input, so every pad byte ≥ 0x80 silently expanded to two bytes. Self-consistent, so it signed and verified fine forever, but not HMAC-SHA256 for ANY input. Rule: for anything with a published specification, assert against a reference implementation rather than against your own understanding of the defect — a self-consistent wrong algorithm passes every round-trip test you will think to write.
- **Correcting a signature is a fleet-wide data event.** Fixing the digest alone would have orphaned every save on every device. It shipped with the key-list work (SEC-2): the original construction survives VERBATIM as a verify-only fallback, verification accepts every configured key, and each save re-signs on its next write. `EXPO_PUBLIC_SAVE_HMAC_KEY` now takes a comma-separated list, newest first. Rule: any change to how a save is signed needs a verifier for the OLD form in the same release, and a rotation story before the key is ever rotated — a single bundled key with a `!==` compare is not a security posture, it is a single point of total loss (and it signs paid entitlements too, so it takes real purchases with it).
- **Two guards vanished under a mock.** `isWritableSlot` originally lived in `saveQueue`, so every suite that mocked the save queue silently lost it — one such suite went red the moment the guard started being enforced. Moved to `utils/slotNumber.ts`, a leaf with no imports. Rule: a validity guard consumed across module boundaries belongs in a dependency-free leaf; if mocking a neighbouring module can delete your guard, it is not a guard.
- **A refusal must be distinguishable from an absence.** Three separate defects were the same shape: a save from a newer build returned bare `null` — the value an empty slot returns — so the menu said "No save data found… start a new game" over an intact save (MR-4); `validateSaveSlot` hardcoded `exists: false` on the null path, making its own corruption messaging unreachable (PIPE-8); and four write-path guards turned "I don't know which slot this is" into "write it to slot 1" (SAVE-OW-6). Rule: never encode "refused", "failed" and "absent" as one value, and never let an unknown destination resolve to a default one — the correct failure mode for an unknown target is not to write.

### 2026-07-30 - Weekly audit: the SEC-3 recovery fix re-wrapped the save it was recovering

- Context: the standing weekly routine audit. Static layer (`npm run audit:weekly`) and every dynamic backstop (save-migration, long-run save/load incl. HMAC tamper + key rotation, money-conservation, economy stress) were green; the deep qualitative pass on the newest 2026-07-29 save-hardening commits found one HIGH the static checks could not.
- **The fix for a data-loss bug re-introduced the same data-loss bug, one layer down.** SEC-3 (commit e0bb005 + 7b1100d) made `doubleBufferLoad` always READ the bare `save_slot_N` key and migrate whatever it finds into buffer A — precisely to rescue a signed v2 envelope that a pre-double-buffer `restoreFromBackup` had written there via `atomicSave`. But the migration wrapped the RAW blob: `createSaveEnvelope(legacyData)`. `createSaveEnvelope` unconditionally makes its argument the envelope's `.data`, so wrapping an already-v2 envelope double-wraps it (checksum over the envelope, not the state). `loadGame` decodes exactly once, so `JSON.parse(decoded.data)` then yields the inner envelope OBJECT `{v:2,data,checksum,hmac}` — not a GameState — which `repairGameState` fills into a near-initial default and the next autosave persists over the real save. That is the SAVE-OW-1 wipe, aimed at exactly the recovery cohort SEC-3 existed to serve. Fix: wrap `decoded.data` (the decoder's unwrapped state string — the inner `data` of a v2 envelope, the whole payload of a raw legacy save), never the raw blob. `utils/saveValidation.ts:2227`, audit tag SEC-3b.
- **The decoder already unwrapped the thing; the migration reached past it for the raw bytes.** `decodePersistedSaveEnvelope` returns `{valid, data, format}` where `data` is ALWAYS the state string. The branch had that value in hand (`decoded.data`) and re-encoded the outer variable (`legacyData`) instead. For a raw legacy payload the two are identical, so the bug was invisible for the format the code was named after and only bit the v2 format — the one the fix was added to handle. Rule: when a value has been decoded/normalised, feed the DECODED value forward; reaching back to the raw input re-does work the decoder already did and diverges the moment the raw and decoded forms differ.
- **A round-trip test through the production loader is the only proof.** The guard that catches this asserts `JSON.parse(decode(migratedBlob)).userProfile.firstName` survives and that the parsed state has no `v` field — i.e. it decodes to a character, not to an envelope. Reverting the one-word fix turns it red (no `userProfile` on the double-wrapped object); shipped green it stays green. Asserting only "the slot migrated" or "buffer A exists" would have passed against the bug. Rule (again, five lessons deep now): a save-path test must drive the real loader end-to-end and assert on the recovered CHARACTER, not on envelope plumbing.

### 2026-07-30 (b) - Apple Ads program: the measurement gap was the actual blocker, not the keywords

- Context: built the full Apple Ads (App Store Ads) setup in `marketing/apple-ads/` — five-campaign structure, 126 exact keywords, 169 global negatives, six Custom Product Page briefs, an LTV→max-CPA model, and a rules-based optimization playbook. What follows is what building it taught, not the contents.
- **The account could not have been judged at all before the code change.** No MMP and no AdServices token collection meant Apple Ads showed installs and RevenueCat showed revenue with nothing joining them — every "optimize for ROI" instruction downstream would have been optimizing CPA in isolation, which is a proxy that can improve while the account loses more money. `Purchases.enableAdServicesAttributionTokenCollection()` (iOS, guarded, fire-and-forget) is one line and it is the precondition for every other decision in the folder. Rule: before writing an optimization plan, check that the metric the plan steers on is actually observable end to end; a plan steering on an unmeasurable number is a plan to guess confidently.
- **Running the LTV model honestly changed the recommendation.** The conservative worked example (ad revenue $0.20/install, 1.5% payer rate, 15% Small Business commission) lands at a $0.46 D180 LTV → a $0.28 max CPT, against a ~$0.92 global median CPT. That is not a bid-tuning problem; it says most category and all competitor inventory is unaffordable until LTV roughly triples, and it is why the plan caps Competitor at $6/day and gives Discovery more budget than Competitor in month one. Rule: compute the max affordable CPA before choosing keywords. A keyword list written before the model is a wish list, and the model is what tells you which half of it you can actually buy.
- **The commission rate is a real input, not a footnote.** Using 30% when the App Store Small Business Program's 15% applies (developers under $1M/yr) understates net LTV by ~18% and causes systematic underbidding across the whole account. Worth confirming enrolment in App Store Connect before the model is used to set a single bid.
- **The negative list had to be derived from this app's vocabulary, not from a generic template.** All three of the game's core nouns are polluted tokens: "life" pulls life insurance and life360; "simulator" pulls the entire vehicle/animal-sim genre; and money/stocks/real-estate/career/dating each sit on a real-utility app category (robinhood, zillow, indeed, tinder) whose searchers will never install a game. A generic "add some negatives" list would have missed every one. Rule: build the block list from the app's own head terms outward — enumerate what else each token means before enumerating what you want it to mean.
- **The graduation step needed to be a script or it would rot.** Discovery must carry every exact keyword from the other campaigns as an exact negative, or it bids against them and their CPT rises for reasons that look like market competition. That list drifts the moment a keyword graduates by hand, so `marketing/apple-ads/build-negatives.js` regenerates it from the three keyword CSVs and `--check` fails when stale. Rule: any invariant maintained by a human copying rows between two lists will break; make one list generated from the other.
- **Prove-the-test-red applied cleanly outside game logic.** The attribution test was run against the un-fixed `configure()` first: 4 of 7 assertions failed, and the 3 that still passed were exactly the "must not break configure" guards — which is the right shape, since those hold trivially when the call is absent. Shipping only the green run would not have distinguished "the call happens" from "the mock exists".

### 2026-07-30 (c) - A hung CI step is not a failing CI step, and step timings tell you which

- Context: PR #99's `update` job sat "in_progress" for over an hour on commit `c402247`. The instinct was to debug the change. The change was two markdown heading edits.
- **Comparing the same step across commits separated infra from code in one call.** `list_workflow_jobs` returns per-step `started_at`/`completed_at`, so the Test step's duration is directly comparable run to run: `25368d6` 83s ✅, `57dff30` 106s ✅, `b2ab87a` 109s ✅, `c402247` 60min+ hung. A 40x overrun on a docs-only diff is not a regression, it is a stuck runner. The local full suite then confirmed it — 349/350 suites, 4,347 tests, 135s, exit 0 on exactly `c402247`'s tree. Rule: before debugging a hung job, diff the *step timings* against the last green run of the same workflow. If the slow step is one your diff cannot reach, stop reading the diff.
- **The suspicious change was the innocent one, and CI had already proved it.** The only code/test edit since the last green run was swapping a runtime `require('@/lib/config/featureFlags')` for a hoist-safe `mockIsFeatureEnabled` (a review suggestion). That looked like the obvious culprit for a Jest hang — `jest.mock` is hoisted above the `const`, so it *smells* like a TDZ trap. But it shipped in `57dff30`, whose Test step ran 106s and passed. Rule: when a hang appears N commits after a suspicious change, check whether the suspicious commit's own run went green before theorising about it. The build history already ran the experiment.
- **"A worker process has failed to exit gracefully" is noise here, not the hang.** It prints on the green runs and on the clean 135s local run alike. A pre-existing teardown leak that never prevents exit is not evidence for a hang that started three commits later. Rule: a warning present in the passing baseline cannot explain a new failure.
- **I twice told the owner the PR's `eas update` step would skip, and it does not.** The reasoning was that the step is gated on `HAS_EXPO_TOKEN` and the secret probably wasn't set. The job history says otherwise: `Expo/EAS login` is gated on the same flag and **succeeded**, `EAS Update skipped (no EXPO_TOKEN)` was **skipped**, and `EAS Update (preview for PRs)` **succeeded** in ~2 minutes on all three runs. So every PR commit publishes an EAS update to the `preview` channel. Not production — that stays gated on push-to-`main` — but it is a real publish, not a no-op. Rule: a step's `if:` condition tells you when it *would* run; only the run history tells you whether it *did*. Read the conclusion, not the conditional — and never reassure someone about a side effect on the strength of a guard you have not seen evaluate.

### 2026-07-31 (round 4) - Auditing my own fixes: what an adversarial pass found that four green suites did not

- Context: after Round 3 shipped 34 of 37 findings, I ran a fifth pass whose only brief was to BREAK the Round 3 fixes. It found six real defects in my own work — four of them regressions I had introduced, each with a probe. Every one had a Round 3 test that was green. `tasks/whole-app-audit-2026-07-31-round4-findings.md` holds the details; what follows is only what the exercise taught.
- **A passing regression test is evidence the fixture lacks the bug, not that the code lacks it.** R3-M4 taught `netWorth()` to count `banking.accounts`, and my test's fixtures used account ids like `chk`/`hysa` while leaving both MIRROR accounts (`checking-default`, `savings-default`) at 0. Those two are overwritten with `stats.money` and `bankSavings` on step 1 of every weekly tick, so in any real save my sum double-counted both legacy pools — roughly DOUBLING the figure that gates prestige, the $10M achievement, ambitions, the leaderboard, the passive-income cap, bail and ad rewards. The repo already shipped the guard (`nonMirrorDeposits`) with a doc comment saying verbatim that anything counting the legacy fields must exclude the mirrors. Rule: build the fixture from the shape the TICK produces, not from the minimal shape the assertion needs; and grep for an existing helper before summing a collection the game also mirrors somewhere else.
- **A comment claiming a property is a claim to verify — including when I wrote it an hour ago.** `withdrawFromGoal` cleared `completedWeek` on withdrawal, with my comment saying that stopped the completion reward being farmed. It did the exact opposite: `contributeToGoal` REJECTS while that flag is set, so clearing it RE-ARMED the payout. Fund a $25,000 goal, withdraw it all back, fund it again — unbounded, at the cap per cycle, on money that never leaves the player's hands. My test asserted the FIELD (`completedWeek` is undefined after withdrawal), which is the bug written as an expectation. The replacement runs ten fund/withdraw cycles and counts the money. Rule: assert the OUTCOME the player experiences, never the intermediate flag — a test that asserts your mental model confirms your mental model.
- **A completeness test that lists its own subjects proves nothing about completeness.** R3-M2 added a politics APR floor and I wrote "every `aprReduction` caller also passes `aprFloor`" — iterating over the two files the fix had touched. `VehicleActions` and `EducationActions` also call `politicsAprReduction` and neither floored it, so a high-office player financed a car and a degree at the 2.5% minimum against a 5.5% CD. The test now DISCOVERS call sites by scanning the actions directory, and asserts the offered RATE behaviourally rather than the source text. Rule: a completeness check must find its own subjects. If the list is hardcoded, it is a check that the two things you already fixed are still fixed.
- **The same fix has to be applied everywhere the pattern lives, and "the ONLY writer" is a smell.** GL-5's comment described `acceptLoan` as "the ONLY writer of `progress.hasBeenInDebt`" — which was the finding, not the fix. Student loans, auto loans and mortgages each originate a `Loan` in their own module and none stamped the flag, so a player who financed a car, paid it off and never opened the Loans screen was locked out of both the "Debt Free" achievement and the "Clean Slate" prestige bonus. Replaced with one exported `debtProgress()` helper plus a test that scans for hand-rolled writes. Rule: when a comment says "the only X", check whether that is a description or an aspiration.
- **A unit-name suffix can hide a scale error at every call site simultaneously.** `RESTORE_COST_PER_POINT_PCT` was documented as "a fraction of item value" and set to `0.006`; all three call sites then divided by 100 as well. The `_PCT` made `/100` look right everywhere it appeared. Effect: luxury insurance was strictly dominated by ~100× — the module's own header says the design is "a genuine call rather than a dominant strategy in either direction", and it was a dominant strategy in the direction of never insuring. The identical shape appeared in `transportationMods` (politics percents read as fractions, so one $100,000 policy made every travel destination FREE forever). Rule: when a constant's name and its doc comment disagree about units, the name wins at every call site and the doc wins in review — rename to `_FRACTION` / `_PCT` to match the value, and pin the MAGNITUDE in a test. Directional assertions ("heavy costs more than light") pass a 100× error comfortably.
- **The gate-then-grant class is not finished; it just moves to whatever was written most recently.** This round found five more: revive (15,000 gems, a $49.99 pack), scandal recovery, profile boost, three vehicle actions, and `acceptAcquisition` (seven-figure asking prices). The R8 pass had already closed the "second grant is free" half by making the gem debit reject instead of floor. That is only half the class: with enough currency for two, the second tap is CHARGED and buys nothing, because the thing being bought is already in the state the first tap produced. Rule: the re-check inside the updater must cover the PRECONDITION, not just affordability — "is the character still dead", "is the scandal still active", "is the offer still pending". Every fix needs a control asserting the guard reads "this one is already done", not "one was ever done".
- **A cap that lives in a module variable is a cap on patience.** The ad orb's no-fill courtesy reward was capped "per app session" by a module-level boolean, and the comment beside it stated the reason: otherwise "a whale could farm the capped reward on every respawn with NO ad ever shown (~$10M/hr)". A module variable resets on app restart, so the farm the comment described was force-quit-and-relaunch — and the reward scales with net worth, so it pays best to exactly the players who will bother. CLAUDE.md §4.4 already says gate on game state, never a device-clock day-string; this is the same rule one step further out. Rule: process lifetime is weaker than a wall clock, which is weaker than game state. If a comment explains why a cap exists, check that the cap's storage outlives the thing it is capping.
- **Ordering inside an async reconcile is a correctness property.** MON-1 taught `SubscriptionReconciler` to `await iapService.loadPurchases()` before reading `isAdsRemoved()`. The `plusActive` read one line ABOVE that await was left alone — and `hasPremiumAccess()` falls through to `hasLifetimePremium()` → `hasPurchased()`, reading the very ledger the load populates. So a lifetime-premium owner was "not premium" on every cold start, and `reconcileLegacyPassSeason` (which never got MON-1's `entitlementCheckAuthoritative` guard) stripped their paid Legacy Pass premium track. Because `premiumOwned` gates `getClaimableTiers(pass, 'premium')`, a season boundary crossed in that window makes the rollover auto-collect skip every premium reward and reset the pass — permanently. Rule: when a fix adds an await to populate a source, re-read EVERY consumer of that source in the same function, and give every downstream reconciler the same unknown-vs-false distinction rather than only the one the finding named.
- **"Displayed but unread" recurs, and the honest fix is sometimes to stop displaying.** R3-M9 wired two policy modifiers that were rendered and read by nothing. Round 4 found eight more on the same card — the one a player reads before spending $100,000-$300,000. One (`economy.inflationRate`) was wired, because inflation is a real weekly system and the aggregator simply had no `economy` slice. The other seven describe systems that DO NOT EXIST: `lib/rd/patents.ts` has zero production callers, there is no property-tax system, nothing reads crypto regulation. Those rows were removed and the keys kept on the schema in an exported `INERT_POLICY_KEYS` with the reasoning, so the record of intent survives. Rule: before wiring an inert effect, check whether the system it names exists. If it does not, wiring it is building a feature under an audit's cover — hide the claim, write down why, and let the product owner decide.
- **The Mindset case is the sharpest version of inert: the game asserted the effect had happened.** `applyMindsetEffects` correctly returns adjusted deltas AND a message; `getMindsetFeedback` returned the message and discarded the deltas, and its single caller is the only place in the app that touches Mindsets at all. So the toast said "Frugal: You saved a bit extra (+120)" and credited nothing. Rule: a helper that returns one half of a computed pair should be named for what it drops, or it will be used as if it returned both — and a test should assert the number in the message equals the number applied.

---

## 2026-08-01 — Audit round 4 remediation: three ways a finding can be wrong

Working the round-4 backlog, three findings were materially mis-stated. All
three would have caused harm if implemented as written.

**Over-graded (C-13).** Reported as a 4.3x payout error: `BASE_MEMBERSHIP_RATE`
is documented "Monthly" and paid out weekly. Every actual consumer treats it as
weekly — the tick's clamp band is documented in `$/member/week`, `initialState`
seeds 4.99 specifically so the displayed "Members/wk" matches the payout, and
the UI figure and the payout are literally the same function call. One JSDoc
line was wrong. "Fixing the economy" would have been a 4.33x income nerf to
every content creator, justified by a stale comment. **Read what CONSUMES a
constant before repricing it.**

**Under-counted (C-9/ARCH-1).** Reported as ~15 modules reading their outcome
out of an updater. The real sweep finds 86 functions. Blind-fixing 86 is worse
than fixing none: each needs its own reading of which rejection paths are
reachable only from inside the updater, and several are fine because an outer
guard already returned. Ratcheted instead, like the test-tree type errors.
**When a finding's true scope is 5x its estimate, the fix strategy changes, not
just the effort.**

**Right, but the obvious fix was wrong (C-4).** The Weekly Modifiers card
promised a Sickness penalty no tick applies. Implementing it to match the label
would have introduced a compounding death spiral at 30 health that no save has
ever had — a balance change wearing a bug fix's clothes. Removed instead; the
same condition already had an honest warning a few lines down. Compare GL-3,
where the promised effect WAS implemented — the difference is that GL-3 was a
benefit the player had paid for, and this was a penalty they had never been
charged. **For UI-lies, ask which direction the correction moves the player.**

### The tests were wrong three times too

- An `indexOf` that returned -1 made `slice(i, -1)` run to end-of-file, so a
  field-presence assertion matched unrelated code and passed on the PRE-fix
  tree. **Assert that a slice's terminator exists.**
- Two suites asserted a removed string was absent, and matched the fix's own
  explanatory comment — which necessarily quotes the string to explain the
  removal. **Strip comments before asserting on live copy.**
- A structural guard I wrote caught a gap in my own fix: the `evalState`
  children projection reproduced the very unguarded `.filter` the guard existed
  to ban. **A guard that only covers the reported instances is worth less than
  one that sweeps the shape.**

### What worked

Every fix was proved RED against the pre-fix tree before being taken green, and
every suite carries at least one control asserting the behaviour that must NOT
change. The controls caught real over-reach twice: they were green on both
trees while the fix assertions flipped, which is exactly the signal wanted.

---

## 2026-08-01 — I shipped a fix pattern, then measured it and found it unsound

Working the C-9 ratchet down, I converted `PetActions` (8 functions) and then
`VehicleActions` (9) from the C-8 shape — reject inside the updater, then
`return { success: true }` unconditionally — to a "pessimistic capture":

    let applied = false;
    setGameState(prev => { …; applied = true; return next; });
    if (!applied) return { success: false, … };

The `VehicleActions` batch broke `vehicleSystemFlow.stress.test.ts`, which
drives real React through `act()`. A *successful* refuel reported failure. The
state was correct; only the report was wrong — the inverse of the bug I was
fixing.

**The measurement** (`__tests__/refactor/updaterTimingContract.test.tsx`):
React runs the FIRST functional update of a batch **eagerly**, at call time —
the bailout optimisation that lets it skip a render when state is unchanged.
The SECOND update in the same batch is **deferred**. So a captured flag is
readable sometimes and stale sometimes, split along exactly the axis these
guards care about.

**CLAUDE.md §4.1 already said this.** "Values computed inside a `setGameState`
updater are not visible outside it — don't assign to an outer variable from
within the updater and read it after." I read that rule, wrote a fix that
violates it, and only caught it because an existing test drove real React
instead of a stub. The repo's own `openAccount` /
`purchaseVehicleWithAutoLoan` / `doTravelActivity` do the same thing, which is
what made it look like the house pattern.

**Why every test I wrote passed anyway.** Every action test in this repo drives
`setGameState` with a synchronous stub that invokes the updater immediately.
Under that stub the capture is ALWAYS readable. A whole suite can be green
while the production path reports the opposite. That is the durable lesson:
**a stub that is more obliging than the real thing turns a test suite into a
mirror.** When a fix depends on *when* something runs, at least one test has to
drive the real runtime.

**What I kept and why.** `PetActions` and C-8 stay: for a single tap — the
overwhelmingly common case — the eager path makes them correct, and they were
previously wrong for *every* rejection. Strictly better, never worse.
`VehicleActions` was reverted because a legitimate second action in a batch is
reachable there and demonstrably regressed. The ratchet's header now points at
the sound fix (a pure reducer over `prev`, called for both the state and the
report — the C-10 `SkillTreeModal` shape) rather than at more capture.

**The estimate was wrong twice, in both directions.** The audit said ~15
functions; my first detector said 86; the corrected detector says 62 — the
first version only recognised a capture literally named `result`, so ~16
already-fixed functions were counted as broken. A ratchet that cannot see its
own progress is worse than none. The "not stale by more than five" assertion is
what caught it.

---

## 2026-08-01 — 62 instances of a bad shape turned out to be 2 bugs

Follow-up to the C-9 ratchet. Having established that pessimistic capture is
unsound, I went looking for the subset worth fixing a different way: functions
whose inner `return prev` has NO outer counterpart, so a plain single tap
reaches it and gets told the action succeeded.

A regex sweep flagged 39 candidates. **Reading them dropped it to 2.**
`publishVideo`, `buyAccessory`, `buyMinerUpgrade`, `claimStakingRewards`,
`purchasePassport`, `launchIPO` and most of the rest all test the condition
OUTSIDE first and return a real failure; the inner copy is the same-batch race
guard, reachable only by a second tap in one batch — where reporting failure is
correct anyway. The unconditional success return is therefore RIGHT on the
single tap that is nearly all real play.

The two genuine ones were `upgradeEnergySystem` (tap "Solar" while already on
Solar → "Upgraded to Solar Panels", no charge, no change) and `buildRDLab` —
and the second was **mine**: my own C-3 fix earlier the same day added the
inner already-this-tier check to stop a double charge and left the success
return alone without adding an outer guard. A fix that closes one hole and
opens a smaller one is still a regression; check the RETURN when you add a
rejection.

Both fixed with an outer guard, which has no timing dependency, rather than a
capture, which does.

**The generalisable lesson: a count of a code SHAPE is not a count of BUGS.**
I twice quoted 86, then 62, as though it were a defect backlog, and wrote
commit messages around that framing. The honest number of player-visible
defects in that population was 2. The sweep was worth running — it found the
two — but presenting its raw output as severity would have justified a 62-site
refactor of critical action code for almost no player benefit, which is exactly
the kind of churn the priority order (Correctness → Simplicity → Root causes)
is meant to prevent. Read the candidates before quoting the number.

---

## 2026-08-05 — a 44pt target in the wrong place is still unhittable

Player report, with a screenshot: the Family tab "is too far up, can't press
close". The close button was the SAME control the 2026-08-01 accessibility pass
had already fixed — it carried `minTouchTargetStyle`, `hitSlopToMinTarget` and
`CLOSE_BUTTON_A11Y`, and `__tests__/render/touchTargetsAndConfirm.test.ts`
asserted all three. The test was green and the button was unpressable.

The cause was position, not size. `app/(tabs)/life.tsx` hosts `FamilyTab` in a
`presentationStyle="fullScreen"` Modal, and a full-screen RN Modal sits OUTSIDE
the tab navigator's safe-area padding. The header started at `scale(16)` from
y=0, so on any notch / Dynamic Island phone it drew under the status bar: title
behind the clock, X behind the battery.

**The lesson: an accessibility pass that measures the control and not its frame
finds half the bug.** When a player says a control is hard to hit, check where
it is drawn before concluding the fix already landed — and when a surface is
hosted in a Modal, it owns its own insets.

The pass also left the rule untested in the axis that broke: there was a test
for the size and none for the position. Both are now pinned in
`__tests__/render/familyTab.render.test.tsx`.

## 2026-08-05 — render smoke tests that pass on the crash screen

Chasing the above turned up something worse. Every provider is wrapped in a
`ProviderBoundary`, so a throw anywhere in the tree is caught and a crash screen
renders instead. That screen is a perfectly valid tree — and the assertion in
nearly every render test was `expect(json.length).toBeGreaterThan(0)`.

So the suite went green on components that had rendered NOTHING. Three were
live: `TopStatsBar` (no `requestAnimationFrame` in `testEnvironment: 'node'`),
the onboarding Perks screen (no `useNavigation` in the expo-router mock), and
FamilyTab itself (the `lucide-react-native` mock was a hand-maintained
allowlist, so any unlisted icon was `undefined` → "Element type is invalid").

Fixes: `renderWithProviders` now throws on the boundary's crash screen and names
the failing provider; the lucide mock is a Proxy that answers for every icon; the
two missing hook mocks and the rAF polyfill are in `jest.setup.js`.

**Two generalisable rules.** A mock that is an allowlist will silently fail open
the first time someone uses an entry that is not on it — prefer one that cannot
be incomplete. And "it rendered something" is not an assertion: if the failure
mode of the code under test produces a valid tree, assert on content the
component itself owns.

## 2026-08-05 — a stored field nothing writes is not state

The Family header read `gameState.lifeStage` and rendered "Teen · Age 21" on a
21-year-old. `lifeStage` is assigned exactly once — `initialState.ts` seeds it
from `getLifeStage(18)` — and no birthday handler, weekly subsystem or scenario
ever updates it. Every player is a teenager forever, at 21 and at 70.

It survived because it had exactly one product reader (this header) and one
debug reader, and because the same `getLifeStage` helper existed as three
identical private copies, so nothing pointed at the drift.

Fixed by deriving from age at the point of use and collapsing the three copies
into `lib/config/gameConstants.ts`. **When a display value looks wrong, grep for
its WRITERS before its readers** — the same question ("who writes this?") is what
exposed `child.familyHappiness`, the headline right next to it, as another field
with no writer at all.

## 2026-08-05 — 73% of a TestFlight release was a macOS runner waiting

"Why do my TestFlight builds take over an hour now? It drains my GitHub usage."
Run #50 of `eas-build-local-ios.yml`, step by step:

    EAS Build iOS (local)   17m 26s   ← the actual compile
    Upload .ipa artifact         4s
    Submit to TestFlight    53m 15s   ← eas submit, waiting on EAS's queue
    ---------------------------------
    total                 1h 13m 12s

The submit step does about two seconds of work — it uploads the .ipa and
schedules a job — and then blocks until EAS finishes talking to Apple. All 53
minutes of that were a `macos-26` runner sitting idle at the **10x** billing
rate: roughly 530 billed minutes per release, for waiting.

Nothing in `eas submit` needs macOS. It needs the .ipa, `eas.json` and an
`EXPO_TOKEN`. So it is now its own `ubuntu-latest` job that downloads the
artifact the build job already uploads. Same wait, same pass/fail signal in CI,
one tenth the price.

`--no-wait` was the tempting one-flag fix and it is worse: it makes the job
green the instant the submission is *scheduled*, so a rejected binary shows as a
passing release. Paying 1x to keep the signal beats paying nothing to lose it.

**The generalisable lesson: on a metered runner, look at what each step is
DOING, not how long it takes.** A step that is blocked on someone else's queue
belongs on the cheapest runner that can hold the connection — and any job that
waits on an external service needs a `timeout-minutes`, or the failure mode is
six hours of billing.

---

## 2026-08-06 — "carried across prestige" is a list somebody has to remember

Building prestige tiers 2–5 meant persisting four small things (Vault,
Endowment, Trials, Seat) and making them survive a life boundary. That is not a
save-format problem — the save carries them fine. It is a `prestigeExecution`
problem: `createResetGameState` and `createChildGameState` both rebuild the
state from `initialGameState` and then **hand-copy** each field that is lineage
data rather than character data.

Every one of those copies is a line somebody has to remember to add, and the
cost of forgetting is silent. Found while adding to that list:
`legacyContracts.claimedIds` was **never copied**. So `initialGameState`'s empty
board came back on every single prestige, the whole contract ladder was
re-claimable, and it printed the full board's worth of Legacy Points per cycle.
Nobody reported it because a feature that quietly resets looks like a feature
that was never finished.

Same shape as the entitlement wipe (MON-1/2/3) and the ambition wipe: a
hand-maintained copy list where an omission reads as "not implemented yet".

**The rule:** anything that must outlive a character goes through ONE hook that
both paths call — here `applyDynastyTransition` (`lib/dynasty/transition.ts`) —
and the test asserts the hook appears on **both** paths, by count. The death →
heir flow (`continueAsChild`) reaches `createChildGameState` without going
through `executePrestige`, so a hook wired to only one path silently skips
everything on the other.

Second rule, from the same change: **make the transition hook derive every
number from the OLD state, never accumulate onto the new one.** `newLegacyPoints
= oldPoints + reward` is idempotent — re-running the transition on the same save
gives the same answer. `newState.legacyPoints += reward` is not, and a
transition that runs twice is not a hypothetical in a React codebase.

---

## 2026-08-06 — A test suite that HANGS tells you almost nothing, so instrument the process, not the source

`__tests__/render/screens.render.test.tsx` stopped completing. What CI reported
was a worker killed by SIGTERM with no message and no failing assertion.

The first useful observation was a negative one: `--testTimeout=25000` never
fired. Jest cannot time out a test whose spin blocks the event loop, so "the
timeout did not fire" is not a missing signal — it is the signal. It rules out
everything asynchronous and says the loop is synchronous, in-process, and inside
React.

I then spent four rounds bisecting by reverting source. That located the FILE
and named the wrong cause, because the change in it was a pure deletion —
reverting it fixed the symptom while proving nothing about the mechanism. Two of
my intermediate conclusions from that bisect were wrong, and I nearly shipped a
comment crediting an unrelated optimisation (`Gradient`'s flat-fill
short-circuit) with the fix.

What actually worked, in order, and each step took minutes:

1. **Run it under `node --inspect` and interrupt it.** Node 22 has a global
   `WebSocket`, so a ~30-line script can attach to the inspector, send
   `Debugger.pause`, and print `callFrames`. V8 can interrupt a spinning script.
   Launch `node --inspect node_modules/jest/bin/jest.js …` directly — putting
   `--inspect` in `NODE_OPTIONS` with `npx` attaches to the npx launcher and the
   real process then fails with "address already in use".
2. **CPU-profile it** (`Profiler.start` / `stop` over the same socket). The
   hottest frames were `propagateParentContextChanges`, `lazyInitializer` and
   `throwException`, with **no application frames at all** — which says React is
   spinning in its own reconciler without calling a single component.
3. **Count what React is doing.** Patching `scheduleUpdateOnFiber` to throw
   after 600 calls proved it was NOT a re-render loop (it never tripped).
   Patching `beginWork` to print every 200,000 calls showed a perfectly periodic
   ~1.4M-call cycle through the same fibers. That combination — millions of
   `beginWork`, almost no `scheduleUpdateOnFiber` — is React restarting a render
   from the shell, not re-rendering.
4. **Name the suspender.** Patching `lazyInitializer` to print its payload's
   source gave three `import()` calls, each stuck Pending after ~950k retries.

The bug: `app/(tabs)/home.tsx` mounted three `React.lazy` popups
unconditionally with `visible={false}`. Under ts-jest an `import()` compiles to
`Promise.resolve().then(() => require(…))`, so it can only settle on a
microtask — and the render harness renders inside a **synchronous** `act()`,
which never yields one. React retried forever.

**Rules:**

- A lazy component must be MOUNTED behind a condition, never mounted always with
  `visible={false}`. That defeats the point of `lazy()` — it defers the paint by
  a tick and still pays for the graph on every mount of the host screen — and
  under a synchronous `act()` it livelocks. Guarded app-wide by
  `__tests__/render/lazyMountGating.render.test.tsx`.
- **Never guard a hang with a test that renders.** It reproduces the hang
  instead of reporting it, and the hang is precisely the unreadable signal. Read
  the source and fail in milliseconds with a message naming the file.
- **Verify a guard by breaking the code**, not by watching it pass. The first
  version of that guard brace-matched backwards from the tag to find the
  enclosing JSX expression; with no gate present the walk escapes past every
  balanced sibling and lands on the component function's own opening brace,
  whose body is full of `&&`. It passed on deliberately broken input. A guard
  that has never failed has not been tested.
- **Count before declaring something a blocker.** In the same session, "settle
  the design-token collision" had sat open as a 156-file migration. Counted: the
  contested ladder had zero importers. Two other premises from earlier in the
  session (four objective systems, a repo-wide design-token collision) were also
  wrong in the same direction — estimated scope, never measured.
- Restore any `node_modules` you patch, and `diff` to prove it.

---

## 2026-08-06 — an anti-exploit invariant left a second door open

Weekly audit. Static layer + all dynamic backstops green; the deep economy pass
found the one real thing. The eviction feature (3068ede) documents its own
invariant at `RentalActions.ts:86-90`: the eviction counter "resets the week the
balance clears, which is the documented escape and the only one." A prior fix
(d5daaf8) hardened the tier-SWAP path — `resolveRentHome` carries `missedWeeks`
across a swap so a tenant can't drop to the $45 room to buy back the four weeks.

But `missedWeeks` lives on the `rental` record, and `resolveEndRental` discards
that record wholesale. So the SAME reset was reachable by the move-OUT path:
move out (free) → re-rent, and the clock is back to zero while `overdueBalance`
stands untouched. One door was bolted; the adjacent one was left open because
the fix carried the counter *on the object the other path deletes*.

Fix: gate re-entry in `canRent` — a landlord won't sign a new lease while the
player is in default (`!state.rental && overdueBalance > 0`), scoped to
`!state.rental` so tier swaps (which keep the clock) are untouched. That makes
"reset only when the balance clears" literally true.

**The generalisable lesson: when you close an exploit, enumerate every path that
reaches the same state, not just the one in front of you.** A counter stored on
a record is only as durable as the record — any code that rebuilds or discards
that record is a second copy of the exploit. Grep every writer/deleter of the
field the invariant depends on before calling it closed.

## 2026-08-07 — A defensive accessor that ENUMERATES fields is a trap

`lib/mail/state.ts`'s `getMailState` is the safe read layer every consumer goes
through — it repairs a missing or malformed slice into a valid empty one rather
than letting the week loop throw. It was written as an enumeration:

```ts
return { messages: …, lastGeneratedWeek: …, address: … };
```

Correct on the day, and a landmine afterwards. Two fields added later
(`shieldUntilWeek`, `reportsMade`) were written by their actions, read back
through this function, and came out `undefined` — so paying to rotate
credentials charged the player and did nothing, and reporting phishing counted
to zero forever. **The write worked and the read silently dropped it**, which is
the worst shape a bug can have: nothing throws, nothing type-errors, and the
feature is simply inert.

Five tests caught it at once only because they were written against the
BEHAVIOUR ("does the risk actually go down?") rather than against the accessor.
A test asserting `getMailState(x).shieldUntilWeek === 12` would have been written
from the same wrong mental model and passed nothing.

**The rule:** a defensive reader spreads first and overrides only what it
normalises.

```ts
return { ...mail, messages: normalise(mail.messages), … };
```

That is what "repair what you understand, preserve what you do not" actually
means. Enumeration turns every future field into a silent drop.

## The same day — `patchMessage` compares by reference, so a no-op patch is not a no-op

`reportMailPhishing` built a fresh message object every call:

```ts
patchMessage(prev, id, (m) => ({ ...m, folder: 'spam', read: true }))
```

`patchMessage` skips the write when `updated === original`, which is a REFERENCE
check — and a spread always produces a new reference. So re-reporting a message
already in Spam patched again and incremented the vigilance counter again. The
discount that reduces fraud risk could be farmed by tapping one message
repeatedly.

Found by a test whose premise was that this already worked ("never counts the
same message twice"), written to document the behaviour rather than to hunt a
bug. Worth noting: the test was RIGHT about what should happen and WRONG about
what did, and that gap is where the finding was.

**The rule:** when a helper's skip condition is reference equality, the patch
callback must return `null` for the no-op case explicitly. Do not rely on
"the values are the same" — the helper cannot see that.

Same family as the gate→grant bugs in §4.4: a guard that looks like it holds,
against a comparison that cannot see what you assumed it could.

## The same day — a test written from the same wrong model as the fix guards nothing

Having fixed the enumerating accessor above, I wrote the test for it:

```ts
state.mail = { messages: [], shieldUntilWeek: 140, reportsMade: 3 };
expect(getMailState(state).shieldUntilWeek).toBe(140);
```

Then deleted the `...mail` spread to check the guard bit. **It still passed.**

Of course it did. The two fields are also named in the override list, so they
survive either way. The test pins the two SYMPTOMS the bug happened to produce,
not the PROPERTY that prevents it — and the property is the whole point, because
the failure mode is specifically "the next field nobody has written yet". A
future `MailState` field would have vanished exactly as those two did, with a
green suite.

The fix is to assert the invariant directly:

```ts
state.mail = { messages: [], futureField: 'kept' } as never;
expect(getMailState(state).futureField).toBe('kept');
```

That one fails the moment the spread goes.

**The rule:** after fixing a bug, break the fix and watch the new test fail. A
test written immediately after a fix inherits the author's model of the fix, and
if that model is "these two fields matter" rather than "unknown fields survive",
it encodes the narrower thing and reads as coverage.

Also worth stating plainly: five of the six guards written this session DID fail
correctly when reverted. The one that did not was the one where I already
believed I understood the bug best.

## The same day — an audit finds the bugs the tests were never asked about

Six defects in the mail app, all found by re-reading finished, green, shipped
code rather than by a failing test. Every one is silent:

| Defect | Shape |
|---|---|
| `getMailState` enumerated | write works, read drops it |
| `reportMailPhishing` no-op patched | reference equality can't see "same values" |
| lapse pass driven by the letter | deleting the letter stranded the event in BOTH channels |
| welcome gated on "inbox empty" | `emptyMailBin` re-armed a once-per-life message |
| offer id keyed on the career | a second application produced an id that already existed, so the letter was deduped away |
| `MailAttachment.kind: 'receipt'` | a renderer branch with no producer that could ever select it |

Three of them are the same bug in different clothes: **something looked at once
and assumed to be once.** And two are this repo's oldest pattern — built,
type-checked, context-exposed, and read by nothing (`lossCap`, seven `MailFacts`
fields, `expiredMailEvents` itself, `yearOf`, `SenderKey`).

**The rule:** when a feature is finished, read it once more asking only "what
happens the SECOND time?" — second tap, second week, second application, second
read of the same accessor. That question found five of these six.

## 2026-08-09 — `flex: 1` inside a `maxHeight`-only sheet is zero, and a broken modal is a soft lock

Player report: "game soft locked on the life skills tab", with a screenshot of
the Activity Commitments modal drawn as a ~60px sliver under the status bar —
header and footer touching, the entire body gone, the game visible but dead
behind it.

Two defects stacked, and neither is interesting on its own:

```ts
modal:   { width: '90%', maxHeight: '90%' },   // no definite height
content: { flex: 1 },                          // → flexBasis: 0
blurOverlay: { ...StyleSheet.absoluteFillObject },  // no justify/align
```

`flex: 1` is `flexGrow: 1, flexShrink: 1, flexBasis: 0`. In a column whose own
height is **content-driven** (`maxHeight` is a clamp, not a height), a
zero-basis child contributes nothing to the measurement, so the column measures
`header + 0 + footer` — and there is then no free space left for `flexGrow` to
hand back. The list resolves to zero. `maxHeight` looks like a bound and reads
like one; it is not one. The pair that works is the one the banking sheets
already use: `flexShrink: 1` on the list, a real bound on the sheet.

The second half is why it looked so broken: the sheet's wrapper was
`absoluteFillObject`, so the parent's `justifyContent: 'center'` never applied
and the overlay's safe-area padding did not reach an absolutely-positioned
child. The sliver was pinned to the top of the window with its close button
under the status bar.

**What made it a soft lock rather than an ugly screen:** a transparent RN
`Modal` owns every touch in its window. Nothing behind it is reachable, however
visible it looks. So a sheet that mislays its own controls takes the entire game
with it — there is no tapping past it, and no back gesture on iOS. Every
transparent modal needs a dismiss affordance that does not depend on the sheet
laying out correctly: a backdrop `Pressable` **behind** the sheet (a wrapper
would steal the ScrollView's gestures), which is what `WhatsNewModal` already
documents.

**The rule:** `maxHeight` alone does not make a parent bounded — pair it with
`flexShrink: 1`, never `flex: 1`. And every transparent modal gets a
tap-outside-to-close backdrop, because the cost of a layout mistake in one is
not a bad screen, it is a lost session.

Footnote on the guard: `__tests__/render/modalListsShrink.test.ts` already
existed for exactly this class and did not catch it, because its sweep matches
inline `style={{ ... }}` and this one hid behind a named StyleSheet entry. A
regex-shaped guard only covers the spelling it was written against.

## 2026-08-09 (same day) — the same defect, eighteen more times, in three spellings

Fixing the Commitments soft lock above raised the obvious question: how many
more sheets have it? `__tests__/render/modalListsShrink.test.ts` already
guarded the class and reported clean, so the honest answer had to come from a
sweep that did not trust the existing one.

It found **eighteen** more sites. Not one of them was a new mistake — they were
the same defect wearing spellings the guard's regex did not match:

| Spelling | Why the guard missed it |
|---|---|
| `<ScrollView style={styles.modalBody}>` | the cap hid inside a named StyleSheet entry |
| `<ScrollView contentContainerStyle={…}>` | no `style` prop at all to match against |
| a `<View>` capped at `scale(200)`, no scroller | not a ScrollView, so nothing to sweep for |

The third is the one worth remembering. The Life Skills detail panel was a plain
`View` capped at `maxHeight: scale(200)` holding description → effect →
requirements → **Unlock button**. Measured at base scale that column is ~218px,
~235px with a two-line description. A `View` does not scroll and the modal shell
is `overflow: 'hidden'`, so the button was clipped — the primary action of the
screen, on a skill the player could afford, with no way to buy it. The guard was
written about lists, so a capped column that was not a list never came up.

The bounded surface and the shrinking child are two different jobs and belong on
two different elements. What broke everywhere was collapsing them into one: a
cap on the thing that should shrink (`scale(200)`, `maxHeight: '90%'` on the
list itself), or nothing on either. The shape that works, every time:

```tsx
<View style={{ maxHeight: '90%' }}>        {/* bound */}
  <Header />                                {/* fixed */}
  <ScrollView style={{ flexShrink: 1 }}>    {/* shrinks */}
  <ConfirmButton />                         {/* fixed — NEVER inside the scroller */}
```

**The rule, restated because the old one was too narrow:** the bound goes on the
sheet, `flexShrink: 1` goes on the body, and the action goes *below* the body,
never inside it and never last in an unscrolled column. This holds for any
capped column, not only ones containing a `ScrollView`.

**And the meta-rule:** a guard written as a regex over one spelling reports clean
on the other two. When a guard exists for a class and you find a new instance of
that class, the instance is the smaller problem — re-derive the sweep from the
SHAPE (parse the styles, resolve containment) and re-run it against the whole
tree before believing any count. The rewritten sweep is in the same file; it
resolves which sheet a scroller actually sits in rather than matching a line.

One known instance is deliberately left: `SimpleTutorialModal` caps a
non-scrolling column at `maxHeight: '80%'` with its Skip/Next buttons last. It
is safe only because its copy is fixed, short, and authored — not because the
shape is sound. If those strings ever become dynamic or localized, it breaks
exactly like the others.

## 2026-08-07 — a new weekly subsystem landed outside the guard, again

Weekly audit. Static layer + every dynamic backstop green (economy 522,
save/startup 331, money-conservation clean, type-check clean); the deep logic
pass found the one real thing. `applyArrears` — the settlement reducer added
with the rental/arrears feature — was called bare at `GameActionsContext.tsx`,
the ONE weekly `apply*` not inside `guardTick`. It routes every input through
`safe()` and only touches `Math.min/max/round`, so it cannot throw *today* — but
the tick's outer catch returns `prevState`, so an unguarded throw there costs the
whole week (a soft-lock that presents as a dead "Next Week" button). "Cannot
throw today" is exactly the assumption the next edit breaks.

This is the same class §4.3 and this file already record five times over (the
last was `trackBudgetSpend`, 2026-07-07): the failure mode is FORGETTING to wrap,
not mis-handling. `weeklyTickGuards.test.ts` proves coverage by reading the tick
source — but only for the historical thirteen it enumerates, so a fourteenth
subsystem added later slips straight past it.

Fix: wrap `applyArrears` in `guardTick('arrears', …)` with an honest fallback
("did nothing this week": pay what cash allows, carry the prior balance
unchanged, book no new debt or surcharge), and add `applyArrears` to the
coverage list so the test now pins it too.

**The generalisable lesson: a coverage test that hard-codes a historical list
does not cover what lands after it was written.** When the guarantee is "every X
is guarded", the check must enumerate every X in the source, not a snapshot of
the ones that existed the day the test was authored — otherwise the guard rots
one new subsystem at a time, which is precisely how the original thirteen
accumulated.

---

## 2026-08-09 (same day) — a growth plan written without reading the code asked us to break the App Store rules

A viral-growth plan arrived for review. Read end to end it is a good document,
and several pillars are genuinely unbuilt. But the item it ranked as a
this-week must-do — §4.1, the rating prompt — was the one item that would have
made the app **worse and rejectable**, and it is worth writing down exactly why
that item was the dangerous one.

**The recommendation.** "Soft-gate it: your own 'Enjoying DeepLife?' modal
first; only fire the native prompt on 'Yes!', route 'No' to Discord/feedback."

**Why it is wrong.** That is *review gating* — pre-screening players and
sending only the happy ones to the store. Apple's Ratings and Reviews guideline
prohibits selectively soliciting reviews from a subset of users, and
`utils/reviewMoments.ts:28-32` already carries a comment saying so and
instructing that it must not be added. So the plan proposed, as a headline
action item, precisely the thing a prior session had thought about and
deliberately refused. *(The guideline number in that comment reads 1.1.7 —
worth a 60-second check against the current guidelines text before anyone cites
it externally; the substance is not in doubt, the numbering is.)*

**Why it is wrong twice over.** The plan's premise — that the prompt fires at
naive moments and needs moving to peak-positive ones — was already false. The
prompt is a three-file system that does more than the plan asks for:

- `utils/reviewMoments.ts` — scores every candidate beat 0..1 and drops
  anything under `MIN_REVIEW_INTENSITY`, so a level-2 promotion never spends an
  ask; cancels on sour beats (death, bankruptcy, jail, a health or net-worth
  collapse); and delays into the *afterglow* so the sheet does not land on top
  of the celebration the player is still reading.
- `utils/ratingPrompt.ts` — wall-clock cooldown as the primary guard,
  specifically because a game-week cooldown would burn all three of iOS's
  yearly asks in one long session.
- `components/ReviewPromptHandler.tsx` — a headless store subscriber rather
  than a call inside a reducer, because React can invoke an updater twice and
  one beat would fire two asks.

Adopting §4.1 would have replaced that with a worse system and a rejection
risk.

**The rules.**

1. **A plan that describes our own product is a claim, not a brief.** Check
   every "currently we do X" against the code before actioning it. Four of this
   plan's premises were already false: the death screen *does* have a share
   button (`components/DeathPopup.tsx:569` → `lib/legacy/obituaryGenerator.ts:123`),
   `marketing/app-store-localizations/` already holds 39 locales including the
   pt-BR the plan says to do first, and a `ShareLifeCard` already exists. Only
   fast-forward was correctly reported as missing.
2. **Domain-plausible advice is the most dangerous kind.** "Soft-gate the
   rating prompt" is real, widely-repeated growth advice. It is also against
   the rules on this platform. Advice being standard practice somewhere is not
   evidence it is permitted here — and the more routine it sounds, the less
   likely anyone stops to check it.
3. **When a comment says "do not add this", it is load-bearing.** The
   `reviewMoments.ts` header is the only reason this was caught in minutes
   rather than shipped. Write the refusal down *next to the code*, with the
   reason, or the next plan re-proposes it.

**What the audit did surface, which the plan missed.** The share loop's real
defect is not that it is absent — it is that it cannot convert:

- `lib/legacy/obituaryGenerator.ts:123` builds the share text with a
  `#DeepLifeSim` hashtag and **no App Store link**. Every shared death is a
  dead end for attribution and for installs.
- `components/ShareLifeCard.tsx` (417 lines, added in PR #67) is **imported by
  nothing** — dead code. It is also text-only, and `require`s
  `@react-native-clipboard/clipboard`, which is not in `package.json`; the call
  sits in a try/catch, so wiring the component up would silently lose the Copy
  button rather than crash.

A feature that exists but is unreachable reads, in any audit that greps for
capability, as a feature that ships. Both this and the linkless share text were
invisible to a plan written from the outside — and are worth more than the
plan's top three items combined.

## 2026-08-09 (same day) — two stale-ref bugs that only a batch could expose

Story mode (one tap = a year) is built the cheap way: leave the ~2,700-line
weekly tick completely alone and call `nextWeek()` 52 times in a loop, with a
`batchTickRef` suppressing only the per-tap presentation (haptic, loading
overlay, banners, and the per-tick autosave, which would otherwise run the HMAC
save pipeline over ~100KB fifty-two times for one tap). No tick logic changed.

Building it surfaced **two real bugs in the existing tick**, both the same
shape, both invisible at one-tap-per-second and both live in production for
rapid taps — not batch-only artifacts:

1. **The tick derived its decay inputs from `gameStateRef.current`.** That ref
   is refreshed only by a post-commit `useEffect`, so in a loop it still
   described an earlier week. Every batched week decayed the character against a
   stale health/net-worth snapshot, damage never accumulated, and a batched life
   sailed straight past the week-15 death a classic life reaches from identical
   inputs. `computeDecayInputs` and `getStatDecayMultiplier` are both pure, so
   the fix is to re-derive them from `prevState` INSIDE the updater and let the
   names shadow the outer copies (which now serve only the log line).
2. **The death guard read the same stale ref.** `nextWeek`'s early return on
   `showDeathPopup` sat outside the updater, so mid-batch it kept answering
   "alive" and the tick went on aging, earning and re-killing a corpse. Fixed by
   putting the authoritative check inside the updater against `prevState` and
   returning it unchanged; the outer check stays as a cheap fast path.

**The rule: `prevState` is the only state React guarantees is current.** A ref
mirroring state through an effect is a cache, and every read of it inside a loop
is a cache read with no invalidation. If a value feeds the state transition,
derive it from `prevState`.

**And a design rule that fell out of it.** The first version of the batch also
tried to check after each iteration whether the character had died or an event
was waiting, so it could stop mid-year. That cannot be made to work: under
`act()` React does not run a queued updater *at all* until the block exits, so
the loop sees its own progress one to three iterations stale. A no-op probe
updater, publishing from inside the updater, and extra macrotask yields all
returned the same stale answer, because they were all asking the same impossible
question.

The fix was to stop asking. The loop now observes nothing and leans on two
properties instead: death is self-guarding (fix 2 above, so post-death
iterations are inert and the clock simply stops), and queued events never
blocked classic ticks either, so letting them accumulate and be answered in the
Year in Review is what classic mode already does. Everything the caller needs is
then derived from committed state — `weeksAdvanced` is
`after.weeksLived - before.weeksLived`, which is right regardless of when any
updater ran. `YearDigest` deliberately carries only "before" values and the
batch's own notes; `summarizeYear` joins it to live state for the "after" half.

**Corollary for tests: `act()` is not a slow production, it is a different
scheduler.** Anything that awaits inside a single act() block cannot see its own
commits. Assert on committed state *after* the block instead — which is what
`__tests__/gameMode/batchEquivalence.test.ts` does, and why it can now prove the
thing that matters: 15 batched weeks and 15 individual classic taps from the
same seed produce an identical state fingerprint.

## 2026-08-09 (same day) — I counted registrations and called it a tab bar

An audit of this repo reported "9 tabs, 8 of them visible to a brand-new
player" and made navigation one of four launch blockers. It was wrong, and the
way it was wrong is worth more than the finding was.

The number came from counting `<Tabs.Screen>` entries in
`app/(tabs)/_layout.tsx`. That counts *route registrations*, not tab buttons.
Five of the nine carry `href: null` — deliberately, with a comment three lines
above them explaining that mobile and computer were folded into Apps, and
market, health and progression into Life, with the routes left registered so
deep links and `router.push()` still resolve. **The real bar is four tabs**, and
the merge the audit "recommended" had shipped before the audit ran. The comment
was right there in the file being counted.

The same audit called five breakdown modals "the same component with different
data". Normalising the stat name and diffing put them at ~60% similar with real
per-stat contributors and advice in the rest — a modest-benefit refactor, not
the duplication that was claimed.

**The rules.**

1. **Count what renders, not what is registered.** A static count of
   declarations is not a measurement of a user-facing surface. Anything gated by
   a prop (`href: null`, a feature flag, a conditional render) is invisible to
   `grep -c` and decisive to the user.
2. **Read the comment next to the thing you are grading.** Both errors were
   pre-refuted in the source. The repo's own rule — *don't trust an audit claim
   that "file:line is broken" without re-reading the source* — applies to audits
   I write, not just ones I receive.
3. **A finding that says "this obvious thing was never done" deserves more
   suspicion, not less.** Competent codebases have usually already solved their
   loudest problem. When an audit reports otherwise, the first hypothesis should
   be that the measurement is wrong.

**What was actually missing, and is now there:** a guard.
`__tests__/startup/tabBarSurface.test.ts` pins the four-tab bar, requires every
file in `app/(tabs)/` to be explicitly declared, and fails if a folded route
loses its `href: null`. That matters because expo-router surfaces every file in
a group as a tab BY DEFAULT — so a new screen silently joins the bar and a
deleted `href: null` silently un-folds one, and neither shows up as a failure
anywhere. The merge was real work with nothing stopping it eroding.

---

## 2026-08-10 — Two content-quality goals set, both wrong. Check a goal is reachable before you ship it.

`scripts/lib/contentQualityRatchet.js` has now had a target retired twice in two
days, by me, in consecutive commits. The floors were fine both times — the
regression protection was never the problem. The *ambitions* were fiction.

**Goal 1: `medianAbsHappiness` → 15.** Retired within hours. It measured
happiness numbers in isolation, but 78% of outcomes that touch happiness also
move money, relationship or health. Chasing 15 would have inflated happiness on
events that already land hard through other mechanics, and the metric would have
reported that as progress.

**Goal 2: `soloHappinessMedian` → 10.** Its replacement, set the same day, and
wrong in two independent ways:

- **Unreachable by the work it implied.** Simulating a perfect pass — every
  trivial happiness-only outcome raised to 10, excluding the file that documents
  itself as deliberate flavour — lands the median at **8**, because the
  distribution's mass sits at exactly 5 and 8. The last two points could only be
  bought by retuning the flavour file too. A goal reachable only by overruling a
  documented authoring decision is not a goal.
- **Aimed at a population that was already correct.** Of the 46 trivial
  happiness-only outcomes, **24 are the decline branch of a choice set**
  ("Skip the sales", "Politely decline", "Just spectate") and 16 more are the
  flavour file. Declining an offer *should* do almost nothing — that is what
  makes the other branch a decision. The metric was reading good choice
  architecture as weak content, and "fixing" it would have made every decline
  branch competitive with the thing it declines.

**What settled it** was asking a question about the EVENT instead of the
outcome: how many multi-choice events have *no* branch that does anything?
**Two, out of 235** — and both are in the flavour file. The corpus never had the
problem either goal was chasing. That check shipped as `inertEventShare`, the
first metric here to ratchet DOWN (a ceiling, not a floor).

**The rules.**

1. **Simulate the perfect pass before you set the target.** "What does this
   metric read if I do all the work it implies?" is a five-minute script. Both
   goals would have died before landing. The simulation is now a test, so the
   claim can't decay into a remembered number.
2. **A goal you can't reach is worse than no goal.** It is a permanent red mark,
   and a gate nobody can satisfy trains people to skim it — the same failure as
   the unreachable 70% coverage threshold this file's ratchet replaced. Setting
   one is the same mistake wearing an aspirational hat.
3. **Check what the metric's population actually is before targeting it.** Half
   of goal 2's targets were correct as written. An aggregate can be bad-looking
   and right, and the only way to know is to print the members and read them.
4. **Prefer a question about the unit the player experiences.** "Is this outcome
   big?" invited inflation. "Does this event offer a real decision?" cannot be
   gamed by raising numbers, needs no word list, and names its offenders.
5. **Retiring your own goal is not moving the goalposts, provided the floor
   stays.** The distinction that makes it honest: floors unchanged, the reason
   written down, and the arithmetic shipped as a test. Lowering the floor to get
   green would have been the other thing entirely.

**Also disproved, and recorded so nobody re-tests it:** karma was excluded from
the "does this outcome do anything" check, which looked like a measurement bug
since karma gates careers and modifies drift. Only **6 of 113** happiness-only
outcomes carry karma, and correcting for it moves the median not at all. Left
alone — a change that alters no number is churn, and it would have looked like
fiddling with a metric to pass it.

---

## 2026-08-10 — "Preflight green" was read off a banner, not an exit code

I reported `npm run preflight` as **✅ ALL PASSED** while the command was
exiting non-zero. Both statements were about the same run.

`scripts/preflight-check.js` prints its own `PREFLIGHT CHECK SUMMARY` banner —
and that script is only the *second* of five steps in the npm script:

```
check:routes && preflight-check.js && lint:errors && lint:ratchet && check:content
```

I read the banner, saw ALL PASSED, and stopped. `lint:ratchet` was failing
underneath it, and had been failing since **before this session started**
(1 255 warnings against a 1 240 ceiling at the session's base commit). So the
claim was wrong in the worst available way: not a mistake about a number, but a
green report over a red build, repeated across several commits.

**The rules.**

1. **A gate's verdict is its exit code.** Any sub-step can print a cheerful
   banner. `echo "EXIT: $?"`, or read the last line of the chain — never a
   summary printed by one link in it.
2. **Know what a composite command actually runs.** `preflight` is five
   commands; `preflight-check.js` is one of them. Reading the npm script takes
   ten seconds and would have caught this immediately.
3. **A pre-existing failure is still a failure you are now reporting on.**
   "It was already broken" explains the cause and excuses nothing about the
   claim. Inheriting a red gate means saying so.

**What the failure turned out to be** is worth its own note, because it is the
opposite of what a 1 270-warning count suggests. One line —
`const AUTO_REST_TARGET_ENERGY = 70;` sitting between two `import` statements in
`GameActionsContext.tsx` — made all 103 imports below it "in body of module" to
`import/first`. That single misplaced constant was **8% of the repository's
entire warning count**. Two test files had a smaller version (a `require`
between imports, 11 more). Moving four lines took the repo from 1 270 to 1 188,
under the ceiling, and the ceiling is now locked at 1 193.

So: **before assuming a warning spike means sloppy code, look at whether one
statement is in the wrong place.** Warning counts are not linear in effort —
`import/first` and friends multiply one mistake by the size of the file.

---

## 2026-08-10 — `pgrep -f` / `pkill -f` match the watcher, not just the watched

Twice in one session, on the same script name, in two different disguises.

**First:** `pkill -f "capture-story-mode-shots"` killed my own shell (exit 144),
because the shell's command line *contains that string* — it is the command
being run. Fixed with the bracket trick, `pkill -f "[c]apture-story-mode-shots"`,
which matches the running process but not the pattern itself.

**Second, and much more expensive:** a "wait for the current run, then start the
next one" wrapper:

```bash
nohup bash -c 'while pgrep -f "capture-story-mode-shots" >/dev/null; do sleep 10; done; \
               node scripts/capture-story-mode-shots.mjs > capture2.log' &
```

The wrapper's own command line contains `capture-story-mode-shots` — twice. So
`pgrep` matched **the wrapper itself**, the condition was permanently true, and
it waited on itself forever. The failure is silent and, worse, it is
*indistinguishable from success*: `pgrep -f capture-story-mode-shots` kept
answering "yes, running", so every progress check I made said the capture was
running normally. I lost roughly 20 minutes believing a job was underway that
had never started, and only caught it because the log file it was supposed to
be writing did not exist.

**The rules.**

1. **Never match a process by a string your own command line contains.** Use
   the bracket trick for both `pgrep` and `pkill`, or match on a PID captured
   with `$!` when you started the job yourself.
2. **"Is it running?" is not a health check — "is it producing output?" is.**
   A process can exist and be doing nothing. Check for the artifact: the log
   file, the growing byte count, the new screenshot. I had the evidence
   (`ls: capture2.log: No such file`) fifteen minutes before I acted on it,
   because I kept asking the question that returned the comfortable answer.
3. **Prefer the harness's own backgrounding to hand-rolled `nohup` chains.**
   It tracks the job and notifies on exit, so there is no self-match to get
   wrong and no polling to misread.

---

## 2026-08-10 — Story mode's first tap ended in a funeral, and only running it showed that

Story mode shipped with a passing equivalence test, a passing suite, and a
green preflight. Then I drove the actual app and one tap of "Live the next
year" killed the character before the year finished. Twice, independently: the
jest seed dies at week 15, a real browser session on the shipped web bundle
died at week ~11 with `[DEATH] Character died from happiness reaching 0 for 4
weeks`.

Nothing was wrong with the simulation. An idle life SHOULD decay, and classic
mode decays identically over the same 52 weeks. The difference is that classic
shows you fifteen weekly screens on the way down, each one an invitation to
act. **Batching the interaction silently removed every one of those
invitations** — and the feature's whole premise is that the player takes no
actions during a year. So the premise and the death rule were in direct
conflict, and nothing in the test suite could see it, because every test asked
"does the batch equal the same number of individual ticks?" — which it does,
perfectly, all the way into the grave.

**The rules.**

1. **An equivalence test proves two things are the same, not that either is
   good.** `52 batched == 52 individual` was true before and after this fix.
   It was never going to fail on "the outcome is a dead character", because
   both sides produce the same dead character. Pair "is it consistent?" with
   "is the result one a player would want?"
2. **When a feature removes a player's touchpoints, enumerate what those
   touchpoints were doing.** Weekly taps were not just pacing — they were
   fifteen chances to notice a stat sliding and react. Batching kept the
   simulation and dropped the feedback loop, and only the feedback loop was
   load-bearing for survival.
3. **Run the thing.** Three defects in this feature came from running it and
   zero from reading it: a heading clipped under a sticky row, the stale-Metro
   `void 0` key, and this. The suite was green for all three.

**Two related bugs found while fixing it, both documentation that had drifted
from code:**

- `lastTickOutcomeRef` had no `advanced` field, yet TWO comments inside
  `nextWeek` reasoned about it — "`advanced` stays false, so `liveYear` must
  stop the batch here rather than spend its remaining 51 iterations on a broken
  tick". The flag was designed, argued for in prose, and never implemented, so
  after an unrepairable save the batch did exactly what those comments said it
  must not. Comments describing a mechanism are not evidence the mechanism
  exists — grep for the field.
- `mode.ts` promised the batch "stops early on ... a pending decision". It does
  not, and it should not: SIX events queue in fifteen weeks, so stopping at the
  first would turn "1 tap = 52 weeks" into "1 tap = 2 weeks". The doc was
  describing an intention nobody had costed. Fixed the doc, not the code.

**And one testing constraint worth knowing:** the fix could not be verified
through `liveYear` at all. React defers every updater queued inside a single
`act()` block until the block exits, so a test driving the batch sees the
post-tick state as null for all 52 iterations and can never observe a stop
firing. The first attempt checked state inside the loop, the integration test
still reported the week-15 death, and the cause was the harness. The judgement
was extracted into a pure `shouldStopBatch()` that can be tested directly, with
the loop reduced to one call — and the end-to-end behaviour verified in a real
browser, which is the only place it is observable.

---

## 2026-08-10 — Three rounds of screenshots against a bundle I had already replaced

Same session, same family as the `pgrep` self-match above, and it wasted more
time than either: I re-exported the web bundle twice, re-ran the capture three
times, and stared at screenshots wondering why my copy change was not in them —
because **a `serve` process from an earlier export was still holding port 8099**
and every capture had been driving the old bundle the whole time.

What made it durable was a check that returned the answer I wanted:

```
$ ss -lntp | grep 8099
(nothing)
$ echo "8099 free"
```

`ss` printed nothing, I read that as "port free", and started a new server that
could not bind. The old one kept answering on 8099, HTTP 200, serving stale
JavaScript. Every downstream observation — the picker copy unchanged, the
heading still sliced — was real, and every diagnosis I formed from it was wrong.
I "fixed" the scroll logic twice against a bundle that could not contain the fix.

The disproof took one command and I should have run it first:

```bash
SERVED=$(curl -s http://localhost:8099/ | grep -oE "entry-[a-f0-9]+\.js" | head -1)
EXPECTED=$(ls "$OUTDIR/_expo/static/js/web/" | grep '^entry')
[ "$SERVED" = "$EXPECTED" ] || echo "SERVING A STALE BUNDLE"
```

**The rules.**

1. **Verify the ARTIFACT, not the port.** "Something is listening" and "the
   thing I built is being served" are different claims. Content-hashed bundle
   filenames make the second one a one-line check — use it before every capture
   run, not after three of them.
2. **A negative result from a diagnostic you cannot fully trust is not
   evidence.** `ss -lntp` needs privileges to attribute sockets; empty output
   can mean "no listener" OR "cannot see it". I treated an ambiguous silence as
   a confirmation because it was the convenient reading.
3. **Kill by PID from `ps`, and confirm the kill.** Every pattern-based kill
   this session either missed its target or hit the wrong one. `ps -eo pid,cmd`,
   read the list, kill the numbers, then re-check the list.
4. **When a change does not appear in the output, suspect the pipeline before
   the change.** Two "the fix did not work" conclusions here were really "the
   fix was never loaded". The tell was available and cheap: the built file did
   contain the new string.

---

## 2026-08-10 — A verification step is code, and mine could only ever fail

Chasing why a story-mode year ends early, I ran four experiments that each
depended on the character renting a room, and logged `shared room tapped: true`
as evidence one existed. That only means an element was found and pointer
events were dispatched — the same "is it running?" mistake recorded twice above.

So I added a check. It read `aria-selected` on the rental card, and reported
**NOT ACTIVE**. On the strength of it I retracted three measurements and told
the user the balance analysis was contaminated by a homeless penalty I had
introduced myself.

The check was wrong. RN-web does not emit `aria-selected` for
`accessibilityState={{ selected }}`, so the attribute is `null` before and
after a **successful** rental alike. A direct probe showed the app saying
"Moved into the Shared Room. First week's rent of $45 paid." The rental had
worked every time. My verification was asserting on the absence of an attribute
that is never present — **a check with no passing branch.**

The retraction was therefore worse than the original error. The first mistake
left a claim unverified; the second manufactured false evidence *against* a
correct result, and did it while looking more rigorous than before.

**The rules.**

1. **A check that cannot pass is worse than no check.** Before trusting a new
   assertion, confirm it goes GREEN on a known-good case. I never saw this one
   succeed even once — that alone should have disqualified it.
2. **Assert on what the feature says it did, not on how you assume the
   framework renders it.** The confirmation toast is generated by the code
   under test; `aria-selected` is a guess about React Native Web's DOM mapping.
   One is evidence, the other is a hypothesis wearing evidence's clothes.
3. **A negative result that overturns earlier work deserves MORE scrutiny than
   a positive one, not less.** I acted on a single unfalsifiable red signal and
   retracted three consistent measurements. The cost of checking the checker
   was one six-minute probe.
4. **Fixing a verification gap is not the same as verifying.** Both attempts
   here were reflexes toward rigour that produced none.

---

## 2026-08-10 — A gate on `weeksLived` that never let anything through

The first-session coach shipped invisible. Every unit test passed, the
component was in the bundle, the mount was in the only render tree the screen
has, and no error appeared in the console. It simply never rendered, and I
burned four full export-and-drive cycles guessing at why: the storage flag, the
absolute positioning, the tab bar, the gate direction. Three of those were real
problems and none was THE problem.

The cause, found in thirty seconds once I stopped guessing and added one
`console.log`:

```
[COACH] {"step":null,"weeksLived":104,"dismissed":false,"hasJob":false}
```

`weeksLived` is the ABSOLUTE life counter (CLAUDE.md §4.2). A character created
at age 20 starts at **104**, not 0. The retirement cap read
`if (weeksLived > 8) return null`, so the coach was already eight weeks
"expired" before its first frame.

**Why the tests did not catch it.** They fed the step function `weeksLived: 0,
1, 2, 8, 9` — the numbers the implementation assumed. A test suite written from
the same wrong mental model as the code confirms the model, not the behaviour.
Every assertion was correct and the feature was still broken.

**Why the codebase did not save me either.** `FirstWeekGuide.tsx` carries this
comment, four lines above logic doing the same clamp:

> `currentWeek` is the absolute weeksLived, which is 0 for age-18 starts and
> 100+ for older starts

I read that file during this work — it is quoted in the coach's own header —
and did not apply it.

**The rules.**

1. **Never compare `weeksLived` to a small number.** It is an absolute clock,
   not an age or a duration. Anything meaning "N weeks after X" needs a stored
   baseline and a subtraction. §4.2 says this; it earns a third entry here.
2. **When a component renders nothing, instrument before theorising.** One
   `console.log` of the decision inputs beat four rebuild cycles of plausible
   hypotheses. The cost of the log was one export; the cost of guessing was
   four.
3. **A unit test written alongside the code shares its assumptions.** These
   tests could only have caught this if they had used a REAL starting value.
   They now pin `weeksLived: 104` explicitly, with the reason.
4. **"It works in the test" is not "it works."** Nothing here was verified by
   running the app until it had already been declared done — twice.

---

## 2026-08-11 — A clean audit is not a clean app

`npm run audit:weekly` passed all 53 invariants. A deep read of the same code
found four live defects in an afternoon, three of which took money or gave it
away — including the game's only outright money printer (a dark-web hack that
paid full cash reward for zero energy on every tap after the first in a batch).

**The lesson is not "the audit is bad."** It is good, and it stayed green
because the things it checks were genuinely fine. The lesson is that a green
automated layer measures *the invariants someone already thought to encode*,
and reporting it as "the app is healthy" is a category error.

### What the productive search actually looked like

Not "read everything". Three cheap scanners over the ONE bug class CLAUDE.md
already names as the most repeated here (§4.4 gate→grant), each narrowing the
next:

1. every `if (… < cost)` followed by a `setGameState` → 50 candidates, mostly
   noise (display code, documented fast paths);
2. every hand-written `money:` write inside an updater → 21, of which 16 were
   debug/simulation tooling;
3. of the rest, the ones whose updater had NO `return prev` refusal → 5, of
   which 3 were real.

Reading 5 files found what reading 350 would not have, because the filter was
derived from a failure mode the repo had already written down.

### The clamp decides whether a stale gate overdraws or pays out

Every one of the three had the same root — the only affordability check lived
outside the updater — but the *symptom* was set by the write site's clamp:

- `sanitizeAmount` (money ≤ 0 → 0) **forgave the debt and granted anyway** →
  free workouts, free hacks.
- a raw `prev.stats.money - cost` with no floor **stored a negative balance**.

So "money can't go negative" is not a safety property. It is what turns a
missing gate into a free grant.

### Dead code that looks maintained is the dangerous kind

Vehicle insurance never expired in live play. `purchaseInsurance` charged a
six-month premium and stamped `expiresWeek`; three places read that field and
none acted on it. The code that did expire it sat in `processVehicleWeekly` —
the pre-WeekContext ancestor of the live reducer — which has **no production
caller** and a full stress suite.

That suite is exactly why nobody noticed. Unused code with tests reads as
maintained. The perf audit's "no module kept alive only by its own tests" check
did not catch it either, because the *module* has plenty of live exports; it
was one function inside it.

A scan for exports referenced only by tests found 88. Most were redundant
helpers — immunity, luxury risk and patent income were all flagged and all
turned out to be live elsewhere. **A dead export is not a dead feature**; it is
only a lead. The one that mattered was the one where the behaviour existed
*nowhere else*.

### Two process notes, both self-inflicted

**The wrapper's exit code is not the command's.** `npm run preflight > log 2>&1;
echo done; tail log` exits with `tail`'s status. A run that reported success had
in fact exited 1 on a real check. This is the second time a preflight result has
been misread in this repo — the first was reading its printed banner. Echo
`$?` immediately, on its own.

**A new check must be tested against correct code, not just broken code.** The
first version of the G5 gate→grant analyzer hard-coded `return prev` and so
reported every `return prevState;` refusal as a bug — three false positives out
of five hits. A check that fires on correct code is worse than no check: it
trains you to skim it, which is precisely how the unfixable coverage threshold
went bad. It now binds the updater's real parameter name.

And the audit caught *me*: my first regression tests used `as GameState`,
violating Hard Rule #3, and the save analyzer flagged it. Worth remembering
that the guardrails apply to the person auditing too.

### Addendum — what the bot review of that audit caught

Three real findings on the audit PR itself, all worth recording because two are
about the *fix*, not the original bug.

**Fixing the state without fixing the message just moves the lie.**
`upgradeWarehouse` was corrected so a batched second tap can no longer
double-upgrade — but the return value was still built from the caller's
snapshot, so the rejected tap answered "Warehouse upgraded to level 3!". A level
never reached, a charge never made. The state was right and the player was still
told something false. Outcome now comes from inside the updater.

That shape carries the §4.1 hazard (React only evaluates an updater eagerly when
the fiber has no pending lanes, so the variable may be read before it is set),
and the resolution is to pick the *direction* of the failure deliberately: the
initial value is a refusal, so it fails CLOSED. "Said no when it meant yes" is
recoverable — the player taps again, state was correct throughout. The opposite
tells someone they bought something they did not.

**A detector with a blind spot reports a number that means less than it looks
like it means.** G5 matched only `money: prev.money - namedCost`, so a literal
`- 100` was silently exempt from the budget it existed to enforce. Widening it
did not change the count — nothing was hiding there — but the count had been
trustworthy by luck rather than by construction. This is the second time in one
change that the *checker* was the thing that was wrong; the first was the
`return prevState` false positives.

**`EXPO_PUBLIC_*` is not a secret, and calling one a secret is its own bug.**
The owner checklist listed `EXPO_PUBLIC_SAVE_HMAC_KEY` under "production
secrets". Expo inlines every `EXPO_PUBLIC_*` value into the JS bundle at build
time — documented behaviour — so the key ships inside the app, and the same key
both signs and verifies on the client. It genuinely detects corruption and
casual tampering; it cannot stop anyone willing to read it out of the bundle.

Nothing to change in the code today — single-player, save on device, a player
editing their own save harms nobody. It becomes real the moment anything is
server-authoritative. The lesson is narrower and sharper than "rotate the key":
**writing "secret" next to a value that ships in the client encodes a false
belief that some later feature will be built on.**

---

## 2026-08-11 — Weekly audit: a false red from a cold container, and the coach's second blind spot

Two lessons from the routine weekly audit.

**1. The audit's own `tsc` check red-flags a cold container.** `npm run
audit:weekly` (S6, Crash & Stability) runs `npx tsc -p tsconfig.tests.json`
directly. Run immediately after cloning — before `npm install` finishes — it
reported "Test-tree type errors ROSE to 2" and flipped the whole domain to
🟡. `npm run type-check:tests:ratchet` said **0**; re-running the audit after
the install completed said 0 too. The 2 were phantom errors from
half-resolved `@types` during an in-flight install.

The rule is already in CLAUDE.md ("a 'failing' suite in a cold container is
usually just missing dependencies") — this is the same trap wearing the
audit's clothes. **Let `npm install` fully finish before trusting any
audit/type/test output, and cross-check a single audit WARN against its
dedicated ratchet before reporting it as a finding.** I launched the install in
the background and read the audit before it landed; the fix was to wait and
re-run.

**2. "Established life" is gated on `totalWeeksWorked`, which crime/hustle/
business income never touches.** The 2026-08-11 fix that stopped the
first-session coach greeting established players (`coachStep.ts:61`,
`FirstSessionCoach.tsx:83`) keys "established" on
`lifetimeStatistics.totalWeeksWorked > 0`. That counter only increments on a
formal career or political salary (`applyLifetimeStatistics.ts:93-94,151` —
`effectiveSalary = careerSalary || politicalWeeklySalary`). A player who funded
a long life entirely through crime, dark web, hustles, business ownership, or
investments has `totalWeeksWorked = 0`, so on the app update that ships this
they are told to "find their first job" for up to eight weeks — the exact
failure the fix set out to prevent, for a supported, promoted playstyle. UI-only
and self-retiring, so Medium, not blocking. **When picking a "has this player
done X" signal, check every income/progress source that should count — a
career-salary counter is not a proxy for "experienced life".** A positive stamp
written at character creation ("this life is new") would be drift-proof where an
inferred signal keeps missing paths.

## 2026-08-11 — BBQ bug report: a writer with no caller, and two findings I over-graded

**A WRITER with no caller is invisible to every test that action has.**
`buyDarkWebItem` debited BTC correctly, flipped `owned` correctly, guarded
already-owned and insufficient-funds correctly — and had zero call sites in
`components/` or `app/`. Every unit test of it passed, because the action was
never the broken part. What was broken was that nothing called it, so a 20-item
catalogue was unreachable and 18 of the 19 illegal street jobs sat locked behind
tools with no storefront. The weekly audit hunts *readers without writers*; this
is the mirror image and nothing was looking for it. The new guard
(`__tests__/economy/crimeToolsReachable.test.ts`) asserts the whole CHAIN — job
requires id → id exists in catalogue → catalogue has a screen → that screen
calls the action — because any single link passing proves nothing.

**Two of my own findings were over-graded, and re-reading the source before
writing the fix is what caught both.** CLAUDE.md §8 says not to trust a finding
without re-reading; it applies to findings I wrote myself, an hour earlier.

- I claimed `calculateNetWorth` ignores bank accounts while prestige counts
  them. The canonical `netWorth()` already counted them, and two other callers
  delegate to it. The copy I cited was imported and **never called**. The real
  defect was three *display* surfaces — narrower, and still worth fixing.
- I graded the flagged-vendor sit-out a P0 bug and proposed removing it. It is
  deliberate and has a test suite whose describe block says so: *"the seeded
  market really can burn out"*. The player's complaint was real; the cause was
  one layer up — the scam odds are computed and never shown, and rep is a
  sigmoid, so "15/100" means a 95% loss chance and reads like "worth a punt".

Same shape both times: **a real symptom attached to the wrong mechanism.** The
tell in each case was a test that already asserted the opposite of what I
assumed. Grep the tests for the behaviour before calling it a bug — if the
repo already pinned it, it is a design decision and the bug is elsewhere.

**A test can fail because of byte distance.** The C-9 ratchet's control did
`src.indexOf('openAccount')` — matching an *import* — then read a fixed 6,000
character window hoping the real declaration fell inside. Adding ~1.7k of
unrelated code above it pushed the declaration out and the control failed,
reporting a regression in a function nobody had touched. Its sibling assertion
named the same wrong symbol and could never fail at all. Anchor to
`export const <name>` and assert the anchor was found; a locator that silently
returns -1 slices an empty string and passes.

**Third time in this repo that the CHECKER was the wrong thing** (after the
`return prevState` false positives and the G5 money-delta blind spot). The C-9
detector cannot see a success return through a ternary, so its "62" is really
"at least 63". When a ratchet moves because of an unrelated edit, suspect the
detector before the code.

**Wiring up dead code promotes its latent bugs to live ones.** `buyDarkWebItem`
gated already-owned and insufficient-BTC against `stateRef.current` and granted
inside the updater — textbook gate-then-grant. It had never mattered, because
nothing called it. Adding the Gear tab made every one of its unexercised guards
load-bearing in a single commit. A dormant writer has never had its guards run;
re-read them BEFORE giving it a caller, not after.

**A comment that describes behaviour the callee does not have is a bug with a
alibi.** I wrote "if the credit is refused (MONEY_CEILING) we return prev" over
a call to `applyMoneyDelta`, which does not refuse an over-ceiling credit — it
CLAMPS and returns a value. The savings debit was full, the cash credit partial,
and the difference vanished. The comment made the code read as correct on
review, including my own. Check the callee's actual failure mode rather than the
one the call site assumes; `null` and "clamped silently" are opposite contracts
and look identical at the call site.

**A guard can be correct and still be the bug, if it is the only exit.** Spark's
anti-bigamy check refuses a second partner — right, and it stays. But
`promoteMatchToRelationship` was the ONLY producer of relationships in the whole
codebase, so "no second partner" silently meant "no second contact of any kind".
The player experienced a correct rule as a broken feature. When a guard blocks
the only path, the fix is a second path, not a weaker guard.

**`'friend'` was read in six places and written in none.** Same class as
`buyDarkWebItem`, found in the same report. `npcDepth` even built a
`meet_friends` want that lists `'friend'` among its target types — a feature
authored entirely against a value nothing could create. Grepping for a type's
CONSUMERS proves nothing about whether it exists at runtime; grep for the
producers.

**Read the ratchet's instructions before working around it.** Adding
`promoteMatchToFriend` took the C-9 count 62 → 63. My first instinct was to
reshape the return to dodge the regex. The file's own header answers exactly
this case: "If you are here because you added an action and this failed: use the
pessimistic-capture shape. Do not raise the number." The "do not expand the
pattern" warning elsewhere in the same file is about CONVERTING existing
functions (the VehicleActions batch that broke `act()` tests), not about new
ones. Two rules in one file, each scoped to a different situation — and taking
the wrong one would have looked defensible.

**A pessimistic capture needs a test that the happy path still reports success.**
Its failure mode is silently returning the refusal forever, and every other test
in the suite asserted on committed STATE rather than the return value — so none
of them would have caught it.

**Deleting a dead field is how you find out who was writing it.** Removing
`Company.money` — a field nothing had ever read — immediately broke four TEST
FIXTURES that were dutifully setting it. Nobody reads a dead field, but people
keep writing it, because a field in a type looks like a field that matters. The
compile errors are the feature: they list everyone who assumed it did.

**Two numbers in two files with no assertion between them will drift.** The
company achievement table said 20; the cap in `lib/business/subsidiaries.ts`
said 5 × 3 = 15. Both were internally consistent, both were readable, and the
300-gold promise was impossible for as long as anyone cared to check. Retarget
the achievement, but the actual fix is the test that ties them together —
otherwise the next change to `MAX_PER_COMPANY_TYPE` re-opens it silently.

**When a feature's whole payload is a display value, check what fraction of it
reaches the player.** The acquisition's "Synergy +24%" reached money as
`(24 / 4) / 200` — three percent of weekly income, for a seven-figure price —
and hit a `COMPANY_FACTOR_MAX` clamp that could zero it entirely. The label was
not lying about the field; it was quoting the field faithfully and the field
only mattered a quarter as much as it looked. Trace a headline number all the
way to the thing it changes before deciding the feature "works".
