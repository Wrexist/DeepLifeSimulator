<!--
Compiled by the 2026-07-28 six-domain audit. Provenance: twelve Opus 5 agents
(six domain audits + six adversarial verifiers) feeding one Fable 5 synthesis,
run as a deterministic workflow. The findings this plan executes on — with
anchors, repros and verification evidence — are in
tasks/full-audit-2026-07-28-findings.md.
-->

# DeepLife Simulator — full audit & phased fix plan (2026-07-28)

Branch: `claude/unfixed-audit-findings-4iaed3` · Baselines to keep green after every phase: `npx tsc --noEmit -p tsconfig.typecheck.json` · `npx jest` (currently 4126 passing / 308 snapshots — new tests raise the count, snapshot re-baselines are enumerated per step) · `npm run audit:weekly` (currently green except the cosmetic "as GameState in tests" warning) · `npx eslint .` (0 errors).

---

## 1. Executive summary

The game's core simulation is sound, but its **recovery tier is silently dead in every shipped build** (PERF-1: production backups have never been written), its **most valuable late-game economy loop is exploitable** (econ-1: selling a depreciated/damaged luxury item is a one-tap net-worth and prestige-point gain, compounded by reach-2: the insurance/restore counterplay was built and never wired into any UI), and its **event-chain system permanently latches after one chain** (GL-1: no chain ever completes or re-rolls for the rest of a life). 29 confirmed findings: **4 high** (econ-1, reach-2, GL-1, PERF-1), **14 medium** (econ-2, econ-3, econ-4, reach-1, crash-1, recap-1, save-1, save-3, GL-3, UX-1, UX-2, UX-3, PERF-3, PERF-5), **11 low** (econ-5, save-4, save-5, GL-2, GL-4, GL-5, GL-6, UX-4, PERF-2, PERF-4, PERF-6). The three things that matter most, each in one sentence:

1. **PERF-1** — `createBackupFromState` hands a raw GameState to `createBackup`, which rejects it as an unsigned legacy payload in every non-dev build, so 100% of shipped builds have zero save backups and the corrupt-save fallback has nothing to restore from.
2. **econ-1 + reach-2** — the sell path prices luxury items off the catalog sticker while net worth prices them off condition-adjusted `currentValue`, making "sell everything, then prestige" strictly profitable, while the entire Phase-5 risk system (insurance, restoration) has zero call sites and therefore no counterplay.
3. **GL-1** — `resolveEvent` branches on the previously-resolved stage index, so the complete branch is unreachable, `activeEventChain` latches forever, and no event chain ever fires again in that life.

---

## 2. Complete findings table

| id | sev | domain | title (short) | anchor | effort |
|---|---|---|---|---|---|
| econ-1 | high | economy | Luxury sale refunds catalog price, not holding value — sell-to-gain-net-worth exploit | `contexts/game/actions/LuxuryActions.ts:155` | M |
| reach-2 | high | stability | Luxury insurance/restore have zero call sites — risk roll is one-way value destruction | `contexts/game/actions/LuxuryActions.ts:361` | M |
| GL-1 | high | game logic | Event chains never complete; `activeEventChain` latches forever | `contexts/game/GameActionsContext.tsx:2894` | S |
| PERF-1 | high | perf/health | Save backups never created in production — raw state rejected as unsigned legacy | `utils/saveBackup.ts:570` | S |
| econ-2 | med | economy | Transport multiplier/bypass keys on `bike` requirement id — leaks onto illegal `smuggling` | `contexts/game/actions/JobActions.ts:234` | S |
| econ-3 | med | economy | `getDeliveryTerms().energyCost` has no consumer — Transport card quotes a never-charged number | `contexts/game/actions/JobActions.ts:237` | S |
| econ-4 | med | economy | Bank rewarded-ad cash bonus has no cooldown/cap; grants without ad when AdMob is off | `components/mobile/BankApp.tsx:569` | S |
| reach-1 | med | stability | Pilot licence has no UI writer — both aircraft permanently unbuyable | `contexts/game/actions/VehicleActions.ts:1098` | S |
| crash-1 | med | stability | `gameState.crimeSkills` dereferenced bare in Work tab; container never repaired | `app/(tabs)/work.tsx:275` | S |
| recap-1 | med | stability | Week Result drops luxury yield & risk cost; `luxuryCharged` measured pre-yield | `contexts/game/GameActionsContext.tsx:1535` | S |
| save-1 | med | save | DeathPopup saves in the same sync segment as `setGameState` — rewind/heir persisted as dead state | `components/DeathPopup.tsx:292` | S |
| save-3 | med | save | 14 Spark/Pulse repair backfills never set `repaired` — repaired clone discarded | `utils/saveValidation.ts:1202` | S |
| GL-3 | med | game logic | Political career earns zero lifetime work credit — $0 pension for career politicians | `contexts/game/actions/weekly/applyLifetimeStatistics.ts:64` | M |
| UX-1 | med | UX | `prestigeAvailable` never written true — Life Chapter 5 uncompletable; home PrestigeButton dead | `lib/progress/lifeChapters.ts:236` | S |
| UX-2 | med | UX | Retired players get enabled Apply buttons — inert taps, false "under review" toast, frozen career list | `app/(tabs)/work.tsx:501` | S |
| UX-3 | med | UX | Home hero "Net Worth" is a sixth divergent basis — no stocks/luxury/liabilities, 1% cash haircut | `components/IdentityCard.tsx:216` | M |
| PERF-3 | med | perf/health | Every save synchronously stringifies+CRC32s full unpruned state; checksum discarded | `utils/saveBackup.ts:569` | S |
| PERF-5 | med | perf/health | `applyRelationshipGain` / karma `npcTrustMultiplier` only consumed by a zero-importer module | `contexts/game/actions/SocialActions.ts:23` | M |
| econ-5 | low | economy | DM clue reward gates on component state, grants in a separate dispatch — double-tap double-credit | `components/mobile/social/DMSystem.tsx:435` | S |
| save-4 | low | save | `pruneSaveData` has no `checkpoints` branch — aggressive retry can't shrink the biggest sub-tree | `utils/saveQueue.ts:630` | M |
| save-5 | low | save | `socialMedia.activeBrandDeals` has no migration backfill or repair mirror | `utils/saveValidation.ts:995` | S |
| GL-2 | low | game logic | `lifeMilestones` write-only; retirement entry stamps cyclic display week | `contexts/game/GameActionsContext.tsx:2203` | M |
| GL-4 | low | game logic | Unseeded rolls in event/life-moment/economy generation; layoffs event rolls outcome twice | `lib/events/careerEvents.ts:401` | L (only S parts in scope) |
| GL-5 | low | game logic | `family.spouse` survives weekly-tick breakup for up to 9 weeks | `contexts/game/actions/weekly/applyRelationshipHealth.ts:82` | S |
| GL-6 | low | game logic | `secret_unlucky_13` unreachable — no start scenario below age 16 | `lib/events/secretEvents.ts:205` | S |
| UX-4 | low | UX | Global 8-street-jobs cap invisible in Work UI | `contexts/game/actions/JobActions.ts:95` | S |
| PERF-2 | low | perf/health | Relationship tick block lacks its own try/catch — outer-catch soft-lock exposure | `contexts/game/GameActionsContext.tsx:984` | S |
| PERF-4 | low | perf/health | Dead `lib/prestige/legacyBonuses.ts` exports a name-colliding `applyLegacyBonuses` + 6th net-worth formula | `lib/prestige/legacyBonuses.ts:74` | S |
| PERF-6 | low | perf/health | ~28 zero-importer modules; no reachability check in the weekly audit | `utils/cacheManager.ts:1` | M |

---

## 3. Phases

Ordering logic: **Phase 1 restores the save/backup/repair safety net** so every later behavioral change ships on top of working recovery; **Phase 2** fixes self-contained simulation logic with no economy coupling; **Phase 3** closes the cheap economy exploits (econ-2 must land with econ-3 or the energy fix leaks onto smuggling); **Phase 4** is the coupled luxury batch (recap-1 → econ-1 → reach-2 must ship together — the sell-price nerf without the restore/insure UI lands a nerf without its mitigation, and enabling insurance without the recap fix makes the recap *more* wrong); **Phase 5** is player-facing UX with snapshot re-baselines; **Phase 6** is dead-code removal, hardening, and the tooling that keeps each class caught.

### Phase 1 — Save, repair & recovery layer (all S, low risk, do first)

**Goal:** production backups exist, `repairGameState` actually heals what it computes, the two known load-crash / stale-save paths are closed.
**Why first:** every subsequent phase changes behavior on live saves; this phase is what lets a bad later change be recovered from, and it is entirely additive/low-risk.

**Commit 1A — `utils/saveBackup.ts` (PERF-1 + PERF-3, same file):**
1. **PERF-1.** In `createBackupFromState` (`utils/saveBackup.ts:564-577`): wrap the payload — `const { createSaveEnvelope } = await import('@/utils/saveValidation'); const data = createSaveEnvelope(JSON.stringify(state));` — so `normalizeBackupPayload` takes the v2 branch at `utils/saveValidation.ts:1703`. Drop the dead `_checksum` parameter from `createBackup` (`saveBackup.ts:421`) and its one call site. **Keep the legacy branch reachable in `normalizeBackupPayload` for reads** so dev-machine backups still decode.
2. **PERF-3.** Delete the discarded `calculateChecksum(data)` call (`saveBackup.ts:571`); insert the `setTimeout(0)` yield used at `utils/saveQueue.ts:175-181` at the top of `createBackupFromState` before the stringify; pass the live state object straight to `extractGameInfo` (`saveBackup.ts:431`) instead of round-tripping through decode+`JSON.parse`. Do **not** add pruning in this commit (behavior change — see Phase 6).
   - **Test (new file `__tests__/save/saveBackupProduction.test.ts`):** unmocked; force production signing via `resolveSaveSigningRuntimeConfig(env, /* explicitIsDev */ false)` with `EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES` unset; assert `createBackupFromState` → `listBackups(slot).length === 1` → `loadBackup(id)` round-trips; second test asserts a legacy-shape stored backup still decodes. Nothing exercises this implementation today (`currentSlotSync.test.ts:70` and `gameInitializer.test.ts:90` mock it away) — this test is the point.
   - **Verify:** the new suite green; `__tests__/onboarding/gameInitializer.test.ts:158` ordering assertion still green (the yield resolves one macrotask later; `gameInitializer.ts:169` awaits it, so ordering holds).

**Commit 1B — `utils/saveValidation.ts` repairs + `SparkActions` hardening (save-3 + save-5 + crash-1 repair half):**
3. **save-3.** Convert the 14 flagless backfills to the block form every neighbour uses (`sp.X = []; repairs.push(...); repaired = true;`): Spark at `:1158-1161` and `:1202-1208`, Pulse at `:1026`, `:1091`, `:1111`. Then fix at the source: change `ensureSpark` (`contexts/game/actions/SparkActions.ts:64`) from `prev.sparkApp ?? {…}` to a defaults-merge `{ ...DEFAULTS, ...(prev.sparkApp ?? {}) }` (the 2026-07-07 "fix belongs IN the helper" lesson).
4. **save-5.** Next to the `sm.notifications` repair (`saveValidation.ts:1079`) add `if (!Array.isArray(sm.activeBrandDeals)) { sm.activeBrandDeals = []; repairs.push('Created missing socialMedia.activeBrandDeals'); repaired = true; }`. Do **not** bundle other settings fields. No STATE_VERSION bump.
5. **crash-1 (repair half).** Beside the `catalogArrays` loop (`saveValidation.ts:447-458`): backfill `s.crimeSkills` wholesale from `initialFields.crimeSkills` when missing/non-object, AND fill individual missing skill ids from the same seed (present-but-partial is the likelier shape). Both branches push to `repairs` **and set `repaired = true`** — the write-back at `:1311` discards the clone otherwise (the exact luxuryHoldings trap CLAUDE.md documents).
   - **Tests:** extend `__tests__/save/v22FieldRepairParity.test.ts` (or sibling parity suite) with: (a) Spark-partial fixture (`delete s.sparkApp.likedYou`) → `repaired === true` and `likedYou` restored, then `likeBackFromLikedYou` does not throw; (b) `activeBrandDeals`-deleted fixture repaired; (c) `crimeSkills`-deleted and crimeSkills-partial fixtures repaired. Update any test asserting `repaired === false` or an exact `repairs` array on these fixtures.
   - **Verify:** `npx jest __tests__/save/` green; `node scripts/audit/audit-save.cjs` V8 parity still green.

**Commit 1C — render guards (crash-1 defensive half):** `app/(tabs)/work.tsx:275` → `(gameState.crimeSkills?.[job.skill]?.level || 0)`; `components/SkillTalentTree.tsx:119` → `const skill = gameState.crimeSkills?.[skillId]; if (!skill) return null;`. No test beyond tsc — the repair test in 1B is the real coverage.

**Commit 1D — save-1, `components/DeathPopup.tsx` (+ optional `GameActionsContext.tsx`):**
6. In `handleRewind` (`:288-296`) make the Alert `onPress` async, insert `await new Promise<void>(r => setTimeout(r, 0));` between `setGameState(() => restored)` and the save, and call `await saveGame(true)` (forced path resolves only after a verified write). Same yield in `handleContinueLegacy` between the `setGameState` at `:183-187` and the save at `:190`. Durable option (recommended, same commit): add `stateOverride?: GameState` to `saveGame` (`GameActionsContext.tsx:210`, `const currentState = stateOverride ?? gameStateRef.current;` at `:212`), widen `saveGameRef`'s type at `:207`, and have DeathPopup pass `restored` directly. **Do not** re-acquire the mutex in the forced path (C-1 comment at `:310-314`); confirm the AppState listener at `:3216+` still typechecks against the widened ref.
   - **Test:** DeathPopup test (fake timers need `jest.advanceTimersByTime(0)` or real timers) instrumenting `saveGame` to assert the persisted payload has `showDeathPopup === false` after rewind.

**EXIT CRITERION (Phase 1):** `npx tsc --noEmit -p tsconfig.typecheck.json` clean · `npx jest` fully green with the new save suites added (no snapshot changes expected in this phase) · `npm run audit:weekly` green · `npx eslint .` 0 errors · the new production-signing backup test exists and passes unmocked.

---

### Phase 2 — Game-logic correctness (self-contained, no economy coupling)

**Goal:** event chains complete and re-roll; layoffs event is internally consistent; marriage state, pension bookkeeping and dead content are corrected.
**Why here:** all steps are reducer/pure-lib changes with narrow blast radius, and GL-1's self-heal wants to be in the field before anything else touches the tick.

**Commit 2A — GL-1, `contexts/game/GameActionsContext.tsx` + `lib/events/engine.ts`:**
1. At `:2891-2913` branch on the stage being resolved: `const resolvedStage = typeof event.chainStage === 'number' ? event.chainStage : currentChain.currentStage + 1;` — advance when `resolvedStage < currentChain.totalStages - 1`, else clear `activeEventChain` and push the `{ completed: true }` entry (capped `.slice(-50)`).
2. Self-heal latched saves (no STATE_VERSION bump): in `rollWeeklyEvents` (`engine.ts:3316` area), when `state.activeEventChain` exists and `getNextChainEvent(state)` returns null, clear the field and append the completed entry — that is the terminal condition and it fixes both live saves and any future off-by-one.
   - **Test (new, `lib/events/__tests__/eventChainCompletion.test.ts`):** drive all 3 `health_scare` stages through `resolveEvent`; assert `activeEventChain === undefined` and `eventChains` contains `{chainId:'health_scare', completed:true}`; second case: a hand-latched state (currentStage past the end) is healed on the next roll. (`eventChains.test.ts` never calls `resolveEvent` — that is why this survived.)
   - **Risk to watch:** `eventChains` dedupe at `engine.ts:3042` becomes live — long-run event mix shifts; re-baseline any subsystem snapshot pinning weekly event output.

**Commit 2B — GL-4 items (1)+(2) only:** `lib/events/careerEvents.ts:395-405` — hoist `const survived = Math.random() < surviveChance;` once, use for BOTH `effects` and `special`. `lib/events/economyEvents.ts:83` — replace `Math.random()` with `seededRandom(weekSeed + 7000)` (hoist the seed above the early return). Test: unit test asserting the layoffs choice's `special` and effects always agree (mock `Math.random` at both extremes). Item (3) — full determinism threading — is **out of scope** (see §4).

**Commit 2C — GL-5, `GameActionsContext.tsx:2192-2198`:** compute `spouseStillPresent` from `processedRelationships` and return `spouse: newWeddingSpouse ?? (spouseStillPresent ? prevState.family?.spouse : undefined)` — wedding path must keep winning (`applyScheduledWedding.ts:100`). Test: tick test forcing the two-week-low-score breakup roll, asserting `family.spouse === undefined` the same week and that a same-tick wedding still lands.

**Commit 2D — GL-6 + GL-2 pension one-liner:** `lib/events/secretEvents.ts:200-206` — re-band to `age === 16 && week === 1` (or delete `:197-224` + registry entry `:385`; either way add a comment in the `childhoodEvents.ts:9-15` style so audits stop re-flagging). `lib/retirement/pension.ts:230` — `week: Math.max(0, num(state.weeksLived))` (reuse the `retiredAtWeek` computed at `:210-215`). GL-2's surface-or-delete decision is deferred (§4).

**Commit 2E — GL-3 (M):** `applyLifetimeStatistics.ts` — add input `politicalWeeklySalary` (0 when not in office); `effectiveSalary = careerSalary > 0 ? careerSalary : politicalWeeklySalary`; use it for `workedThisWeek` (`:64`), `highestSalary` (`:95`) and the `updateCareerHistory` guard (`:111`). At the `GameActionsContext.tsx:2128` call site compute it as **`POLITICAL_CAREER.levels[level].salary / WEEKS_PER_YEAR`** gated on `politics.careerLevel > 0` — **never the raw annual figure** (a $400k *weekly* pension base is the failure mode; `PENSION_BASE_SALARY_CAP` blunts but does not hide it). In `PoliticalActions.ts`'s win branch (`:364-414`) append `{ job: 'political', weeks: 0, earnings: 0, startWeek: prev.weeksLived || 0 }` to `careerHistory` iff no open political entry exists, mirroring `JobActions.ts:746-758`.
   - **Test (in `contexts/game/actions/weekly/__tests__/` beside the existing applyLifetimeStatistics coverage):** in-office week increments `totalWeeksWorked`, sets `highestSalary` to the *weekly* figure, and creates/updates the political `careerHistory` entry; jailed/unemployed week still contributes 0. Re-fixture any subsystem-equivalence snapshot covering `applyLifetimeStatistics` (new input field).

**EXIT CRITERION (Phase 2):** all four commands green; the chain-completion test and political-pension test exist and pass; any re-baselined event-mix snapshots reviewed by hand (diff must show only chain bookkeeping / event-mix shifts, no money deltas).

---

### Phase 3 — Cheap economy exploits (econ-2/3 are one commit; econ-4 gated on owner)

**Goal:** close the smuggling leak, make transport energy real and honest, make ad-cash bounded, make the DM grant atomic.
**Why here:** econ-2 **must** land before or with econ-3 — applying the energy substitution without job-id scoping leaks the tier energy (car: 18) onto `smuggling` (flat 45).

**Commit 3A — econ-2 + econ-3, `contexts/game/actions/JobActions.ts` + `app/(tabs)/work.tsx`:**
1. **econ-2.** Add `const DELIVERY_JOB_IDS = new Set(['delivery', 'food_delivery']);` beside `TRANSPORT_REQUIREMENT_ITEMS` (`:17`); require `DELIVERY_JOB_IDS.has(jobId)` in BOTH the `satisfiedByTransport` predicate (`:120-121`) and the `transportTerms` guard (`:234`). Fix both, not just the multiplier — the bypass alone keeps the criminal-level-3 unlock reachable off a $5 rental. (The `transportGated` flag redesign drags in the migration/repair/test trio — out of scope, §4.)
2. **econ-3.** Add `const effectiveEnergyCost = transportTerms ? transportTerms.energyCost : job.energyCost;` beside `:237` and substitute at all six sites (`:105`, `:108`, `:292`, `:323`, `:353`, `:467`). Export a `getStreetJobEnergyCost(gameState, job)` helper and use it from `work.tsx:351/:356/:412/:465` so button, message and charge cannot disagree.
   - **Tests (extend the street-job suite):** (a) smuggling with a car and no bike is rejected on requirements and pays the unmultiplied base when a bike item IS owned; (b) `delivery` costs 26 energy on a rented scooter and 30 on an owned bike; (c) the bike-*item* owner path (`:123`) is unchanged. Watch the weekly-cap/pity suites — they drive repeated runs against fixed energy budgets and may need re-baselining.

**Commit 3B — econ-5, `components/mobile/social/DMSystem.tsx`:** collapse gate+grant into ONE `setGameState(prev => …)` keyed on the persisted `prev.revealedDMClues` (early-return if included; credit via `applyMoneyDelta` imported from `contexts/game/actions/MoneyActions`; append id once); latch `clueId` in a `useRef<Set<string>>` at the top of the handler (AdRewardOrb `busyRef` idiom); keep the deferred `:439` save; ensure re-open still shows `claimed: true`. Test: fire the handler twice synchronously; assert one credit and no duplicate id in `revealedDMClues`.

**Commit 3C — econ-4, `components/mobile/BankApp.tsx` + new action — OWNER CHECKPOINT FIRST:** confirm with the owner that the uncapped faucet was not deliberate and pick the cadence (weekly vs daily-equivalent) before writing code. Then: move the grant into a `claimAdCashBonus` action that stamps and re-checks a weekly marker **inside** the updater (mirror `PulseActions.ts:1166-1183`), credit via `applyMoneyDelta`, and derive the button's `disabled` / `disabledLabel` from the same predicate. **Storage decision:** either reuse the persisted `socialMedia` shape next to `lastAdBoostWeek` (no version bump), or add `settings.lastAdCashBonusWeek` — which, per CLAUDE.md, requires a STATE_VERSION bump 25→26 + `createTestGameState` coverage + DEV.md/WORKFLOW.md/CLAUDE.md sync even though the `undefined` default skips the backfill/repair mirror. Key on `weeksLived`, never a wall-clock day (2026-07-24 daily-gem lesson). Test: two claims in the same week → one credit; claim next week → allowed; grant path with `adsAvailable() === false` still respects the cooldown.

**EXIT CRITERION (Phase 3):** all four commands green; street-job suites re-baselined and reviewed; if the `settings` route was chosen for econ-4, `STATE_VERSION === 26` is consistent across `initialState.ts` / DEV.md / WORKFLOW.md / CLAUDE.md and audit-save's version-parity check is green.

---

### Phase 4 — The luxury batch (recap-1 → econ-1 → reach-2, shipped as ONE release)

**Goal:** one canonical per-holding valuation used by sell, net worth and UI; insurance/restore reachable; the weekly recap telling the truth about luxury cash flow.
**Why this order:** recap-1 first so the recap is correct *before* premiums become a live outflow; econ-1 before reach-2 so the valuation helper exists for the new UI to quote; **all three in one release** because the sell nerf without restore/insure is a nerf without its mitigation.

**Commit 4A — recap-1, `contexts/game/GameActionsContext.tsx`:** declare `let luxuryYield = 0; let luxuryRiskCost = 0;` beside `luxuryCharged` (`:1335`) so the existing `catch (luxErr)` leaves them 0; assign inside the try; replace the `Math.min` at `:1348` with a real before/after read (`luxuryCharged = Math.max(0, moneyBeforeLuxury + luxuryYield - moneyAfterLuxury - luxuryRiskCost)`); add `luxuryRiskCost` to `totalExpenses` (`:1535`) and a `{ category: 'lifestyle', amount: luxuryRiskCost }` row near `:1751`; add the yield to the **display fields only** — `incomeEarned` (`:1541`) and `netChange` (`:1543`). **Hard guardrail: do not touch `totalIncome`** — it is destructured at `:775` and feeds `calculateIncomeTax` (`:836`) and the cash projection (`:844`); folding the yield in would retroactively tax it and turn a reporting fix into a balance change. Test: tick test with a high-yield/high-upkeep item asserting `netChange` reconciles against the `stats.money` delta, including the low-cash ordering case ($10k cash, $85k yield, $150k upkeep → charged $95k, not $10k). Re-baseline week-result snapshots.

**Commit 4B — econ-1, `lib/luxury/operations.ts` + `contexts/game/actions/LuxuryActions.ts` + `components/computer/LuxuryApp.tsx`:**
1. Extract `export function getLuxuryHoldingValue(item, holding)` = `Math.floor(getHoldingValue(item, holding) * LUXURY_RESALE_FRACTION * conditionValueMultiplier(getCondition(holding)))` from `getTotalLuxuryMarketValue` (`operations.ts:250-259`) and make the total reduce over it — the two definitions then physically cannot drift.
2. `sellLuxuryItem` (`LuxuryActions.ts:137-186`): replace `:155` with the holding-aware value AND recompute it **inside** the `setGameState(prev => …)` from `prev.luxuryHoldings?.[itemId]` before `applyMoneyDelta` (`:161`); keep the outer value only for the toast (`:184`).
3. UI parity in `LuxuryApp.tsx`: `:255` (card), `:508` (post-sell toast), `:635` (detail sheet), `:1020` (confirm sheet — its percentage must become percentage-of-holding-value); `:384` `collectionValue` → `getTotalLuxuryMarketValue(ownedIds, gameState.luxuryHoldings)`. Leave `getTotalLuxuryResaleValue` alone elsewhere (`lib/devtools/simulations.ts:417` is dev-only).
   - **Tests:** in `lib/luxury/__tests__/luxury.test.ts` — sell proceeds equal the item's net-worth contribution immediately pre-sale (net-worth-neutral invariant), and a damaged item sells strictly below pristine. **Expect and update** the pins at `luxury.test.ts:100` and `:150`; `yieldAppreciation.test.ts:163` should survive (pristine holding). Check `__tests__/refactor/subsystemEquivalence.test.ts` for sell-path snapshots.

**Commit 4C — reach-2, `components/computer/LuxuryApp.tsx` + `LuxuryActions.ts`:**
4. Pre-wire hardening: `setLuxuryInsurance` is the one luxury action whose updater lacks an in-`prev` ownership re-check — add `if (!ownsLuxuryItem(prev.luxuryItems, itemId)) return prev;` inside the updater (`LuxuryActions.ts:361+`) before exposing it to UI.
5. In the detail sheet next to the verbs block: import `setLuxuryInsurance`/`restoreLuxuryItem` and `getCondition`/`getItemPremium`/`getExpectedWeeklyLoss`/`getRestoreCost`/`CONDITION_POOR` from `@/lib/luxury`; render (a) a condition row (colour-coded below `CONDITION_POOR`), (b) Insure/Cancel toggle quoting premium vs `getExpectedWeeklyLoss` ("costs $X/wk, saves $Y/wk on average"), (c) Restore CTA priced by `getRestoreCost`, disabled at condition 100. Handlers follow the verb shape: dispatch → `showToast(result.message)` → `queueSave()`.
   - **Tests:** action-level tests for insure→premium charged weekly (`getTotalPremiums` becomes a live outflow folded into `risk.cashOwed` at `applyLuxuryItems.ts:115-118`) and for the insured/deductible branch (`risk.ts:219-235`) going live for the first time; restore raises condition and spends through `applyMoneyDelta`. Re-baseline LuxuryApp render snapshots and any economy-balance/money-conservation stress assertions moved by premiums.

**EXIT CRITERION (Phase 4):** all four commands green; the net-worth-neutral sell invariant test passes; a manual smoke of the recap on a mega-yacht save reconciles `netChange` with the wallet delta; **all three commits ship in the same release build** — verify no intermediate TestFlight cut happens between 4B and 4C. Per CLAUDE.md, bump `version` in `package.json` before the build.

---

### Phase 5 — Player-facing completeness & UX

**Goal:** the Work tab, home hero, chapter spine and dealership stop advertising things the reducers don't do.

**Commit 5A — UX-2 + UX-4 (both live in `app/(tabs)/work.tsx` + `JobActionsContext`):**
1. **UX-2.** `JobActionsContext.tsx`: interface `:21` → `applyForJob: (jobId: string) => { success: boolean; message: string } | void;`; callback `:155-164` returns the result and fires `haptic.medium()` only on `result?.success` (mirror `promoteCareer` `:165-180`). `work.tsx:693`: surface the result via `showSuccess`/`showWarning`. Add `!gameState.isRetired` to `canApplyForCareer` (`:527-535`), a retired lockReason at `:691`, and an early-return + lock state in the advanced-career onPress (`:795`). **Blast radius:** `TestRunner.tsx:87` and the simulators (`ComprehensiveGameSimulator.ts:3491/3524/3606`, `LongTermSimulator.ts:428/458/534`) already read `result.success` and will start receiving real objects — `failedActions` bookkeeping flips from silently passing to correctly failing; check `__tests__/stress/featureGauntlet.stress.test.ts` and `__tests__/actions/careerPromotionGating.test.ts`.
2. **UX-4.** Export `MAX_TOTAL_STREET_JOBS_PER_WEEK` from `JobActions.ts` (replacing the function-local const at `:96`); in `work.tsx` derive `streetJobsThisWeek` once, fold the cap into both `locked` expressions (`:396`, `:457`) with lockReason "Street-job limit reached (8/8 this week).", and render "Street work this week n/8" beside `:988-993`. Do **not** copy the literal 8 into work.tsx.
   - **Test:** retired state → `canApplyForCareer` false for every career and advanced-career apply no-ops with a warning; 8 street jobs done → all street cards locked.

**Commit 5B — UX-1, `lib/progress/lifeChapters.ts` + `app/(tabs)/home.tsx` + `app/(tabs)/progression.tsx`:** rewrite `ch5_prestige_ready` as a **derived** predicate — `checkComplete: (s) => !!s.prestigeAvailable || netWorth(s) >= getPrestigeThreshold(s.prestige?.prestigeLevel ?? 0)`; `checkProgress` = `min(1, netWorth/threshold)` (drop the 0.9 cap and the wrong 100M divisor). Same predicate at `home.tsx:606` and `progression.tsx:107`. **Do not start writing the flag from the tick** — a stored mirror of a derived value is what created this. `netWorth()` is identity-key memoised (`achievements.ts:35-56`), so per-render cost is a pointer compare. Test: state at $12M/prestige-0 → chapter 5 complete + claimable; DevTools flag still forces it. **Release note required:** long-lived saves claim $35,000 + 320 gems once.

**Commit 5C — UX-3, `components/IdentityCard.tsx` + `components/NetWorthBreakdownModal.tsx`:** delete the IdentityCard memo (`:216-257`) and render canonical `netWorth(gameState)` at `:605-607`. In the modal: headline from the same canonical function; populate `liabilities` from `gameState.loans`; add Stocks and Luxury rows; property at `currentValue ?? price`; `valuationMultiple` 10 → 52 with the explainer at `:290` updated; drop the blanket 1% `transactionFee` from the headline. **Do not touch** `preTick.calculateNetWorth` or `lib/statistics/planningNetWorth.ts` — lessons.md:534 records those as deliberately different bases. Test: modal itemisation sums to the canonical headline for a fixture with stocks + a loan; fresh $200 save reads $200, not $198. Release note (visible number jumps for stock/loan holders).

**Commit 5D — reach-1, `components/computer/VehicleApp.tsx`:** add a pilot-licence card mirroring the driver's-licence card (`:245-276`) — but note `getPilotLicense`'s signature is `(gameState, setGameState)` with **no `deps` object**, so don't copy the call shape verbatim; render in the Dealership tab when `hasLicense && !gameState.hasPilotLicense`, disabled below `PILOT_LICENSE.minAge` (18) or `cash < 45000`. Add `{ id: 'plane', label: 'Air' }` to `DEALER_FILTERS` (`:93-99`) + the `DealerFilter` union (`:85`); grey aircraft cards with a "Needs pilot licence" lock via the `lockedByReputation` mechanism (`:717`). Test: licence purchase flips the flag and `purchaseVehicle('utility_helicopter')` then succeeds. Re-baseline VehicleApp snapshots and the `:729` "N models available" copy.

**EXIT CRITERION (Phase 5):** all four commands green; render-snapshot diffs for LuxuryApp/VehicleApp/IdentityCard/work reviewed line-by-line (only the intended affordance changes); simulator stress suites green with the now-honest `applyForJob` returns.

---

### Phase 6 — Dead code, tick hardening, save-path hardening, tooling

**Goal:** remove the modules where the next wrong answer would hide, close the two hardening gaps, and make every class in this audit a named finding next time.

**Commit 6A — PERF-4:** delete `lib/prestige/legacyBonuses.ts` (git history is the archive; no test imports it). Verify with `npx tsc --noEmit` + full jest. Risk ≈ zero; the live binding is via explicit `require('@/lib/prestige/applyBonuses')` (`prestigeExecution.ts:368/:737`).

**Commit 6B — PERF-5 (deletion only):** delete `contexts/game/actions/SocialActions.ts` (43 lines, zero importers). Then **narrow the docstring** at `lib/skillTrees/lifeSkillEffects.ts:199-201` to "dating and gifting only" so it stops asserting a contract nothing enforces, OR leave it pending the owner's balance decision on wiring `applyRelationshipGain` + `npcTrustMultiplier` into `ContactsActions.ts:86` and `GameActionsContext.tsx:3828` (§4 — that wiring is a +25–55% balance change, not a refactor). If karma's trust tier is decided against, delete `npcTrustMultiplier` from `getKarmaModifiers` and the two assertions in `karmaAndMindset.stress.test.ts:195-196` in this commit.

**Commit 6C — PERF-6 sweep:** delete the confirmed-dead modules (`utils/cacheManager.ts`, `utils/enhancedGoalSystem.ts`, `utils/launchValidator.ts`, `utils/dailyChallenges.ts`, `utils/launchMonitor.ts`, `utils/bugTracker.ts`, `utils/spacing.ts`, `services/IAPSyncService.ts`, `hooks/usePerformanceOptimization.ts`, `hooks/useHapticFeedback.ts`, `contexts/TutorialRefContext.tsx`) or move deliberate dev tooling (`lib/simulation/BugHunterSimulator.ts`, `lib/simulation/MultiWeekSimulator.ts`) under `dev/`. One commit, full `npx tsc --noEmit` + jest as the gate — the known false-positive shape is platform extensions (`utils/offlineManager.native/.web` is reached via the extensionless import at `CloudSyncService.ts:5`); double-check dynamic `await import()` paths before each deletion.

**Commit 6D — PERF-2, `GameActionsContext.tsx:984-1040` + `scripts/audit/audit-perf.cjs`:** wrap the relationship map in ONE try/catch matching the pets/vehicles/luxury pattern, with the catch resetting `relationshipHappinessPenalty`, `newBornChildren`, `newShowBirthPopup`/`birthMessage` (and documenting, as the luxury comment does, that a mid-map throw leaves an already-charged wedding deduction in place). Order matters for the tooling half — see §5 item 3: tighten the P2 check **first**, watch it go red on the unwrapped block, then land the wrap in the same PR.

**Commit 6E — save-4, `utils/saveQueue.ts`:** add the `checkpoints` branch to `pruneSaveData` — normal pass caps each `cp.snapshot`'s growing arrays via a shared `capHistories(obj, cap)` helper (so top-level and checkpoint paths can't drift); **aggressive pass only** additionally `tail(pruned.checkpoints, 2)`. Never drop checkpoints on the normal pass — they are visible rewind targets in the Time Machine UI. Do **not** extend `CHECKPOINT_STRIPPED_TOP_LEVEL_KEYS` with catalog arrays without verifying `rewindToCheckpoint` restores each via `repairGameState` (`saveValidation.ts:449-458`). Test: a synthetic over-size payload shrinks on the aggressive pass (`stringify(pruned).length < stringify(input).length` with checkpoints present); check `checkpointSystem.test.ts` shape assertions.

**Commit 6F — tooling (see §5).**

**EXIT CRITERION (Phase 6):** all four commands green; each new audit check has been **seen red** against pre-fix or throwaway code (evidence: the failing run pasted into the PR description); `npm run audit:weekly` green with the new checks active and the documented allowlists in place.

---

## 4. Do not do

| item | reason |
|---|---|
| **save-2** (prestige save "divergent duplicate") | **Refuted.** The version-stamp predicate cannot diverge — prestige state is always rebuilt from `initialGameState` (`version === STATE_VERSION`), so both predicates write 25 for every reachable input; the carried-over `legacyPass` is healed on every load by `repairGameState` (`saveValidation.ts:578-586`, `:687`). Warning to the executor: the refuted finding's proposed fix (route through `saveGame(true)`) would **introduce** the save-1 stale-ref bug — the prestige path is the one save site that builds its payload from `newGameState` directly and is immune. Leave it alone. |
| **GL-4 item (3)** — thread a seeded `rollFor` through all event/life-moment templates | L-effort, reshuffles event output for existing saves, breaks subsystem-equivalence snapshots pinning event payloads, and removing re-roll-on-reload is a save-scum **balance decision**, not a bug fix. Owner call. Only the two S-size sub-fixes (careerEvents double roll, economyEvents stateDuration) ship, in Phase 2. |
| **GL-2 options (a)/(b)** — surface `lifeMilestones` in Life Story vs delete the field | Content/design decision; option (b) is not a pure deletion (the anniversary idempotence guards at `applyAnniversaries.ts:82` / `DatingActions.ts:1263` are load-bearing and two test suites assert on the field). Only the `pension.ts:230` week-basis fix ships (Phase 2, commit 2D). |
| **PERF-5 option (2a)** — wire `applyRelationshipGain` + `npcTrustMultiplier` into Contacts and `updateRelationship` | A +25% (skills) to +55% (skills+karma) relationship-gain balance change on the majority of interactions; moves `featureGauntlet.stress.test.ts:738` and `staleClosureGuard.stress.test.ts:155`. Owner balance decision; the risk-free deletion ships in Phase 6. |
| **econ-2 long-term redesign** (`transportGated: true` flag on StreetJob) | GameState shape change → drags in the migration + repairGameState + createTestGameState trio and a STATE_VERSION bump for a problem the job-id set already solves. Revisit only if a third transport-gated job is added. |
| **UX-3 extension** to `preTick.calculateNetWorth` / `lib/statistics/planningNetWorth.ts` | lessons.md:534 records these as **deliberately** different bases; "fixing" them re-opens the reconciled 5-way split. |
| **econ-4 without the owner checkpoint** | Removing ad impressions from a monetization surface; cadence (weekly vs daily) and whether the faucet was intentional are owner calls. The code change is in-plan (3C) but gated. |
| **Pruning backups through `pruneSaveData`** (PERF-3 optional extra) | Behavior change to restore contents; consistent with the primary save but must be its own commit and its own decision — not bundled with the latency fix. |
| **"Fixing" the App Store / binary version mismatch** during the Phase 4/5 release cuts | Explicitly forbidden by CLAUDE.md — the split is known and accepted; only bump `package.json`. |

---

## 5. Tooling upgrades (each must be seen RED before it ships)

The rule for all five: a check authored against already-fixed code and never seen red asserts only that the source equals itself. Each PR must include the failing run.

1. **`audit-save.cjs` — V8b: repair-without-flag.** Flag any `s.*` / `sp.*` / `sm.*` assignment inside `repairGameState` whose enclosing block does not also assign `repaired = true` (the save-3 class — 14 instances survived multiple audits). **Prove red against:** the pre-commit-1B tree (`git stash` the fix, run, observe 14 hits), or a throwaway flagless backfill.
2. **`audit-save.cjs` — V9: initialState key parity.** Diff the one-level-nested key set of `initialGameState` against keys written by the migration ladder + `repairGameState` (the save-5 class). Land as **WARNING first** with an allowlist seeded with the intentional undefined-default fields (`ambitionId` per CLAUDE.md) — it will surface a batch on first run, which is the point. **Prove red against:** the pre-commit-1B tree (`activeBrandDeals` missing).
3. **`audit-perf.cjs` — tighten P2.** Exclude the outer updater try at `GameActionsContext.tsx:414` from `L.tryRanges` so a bare subsystem block inside the weekly updater is no longer reported as guarded — the current brace-match against ANY enclosing try is exactly how PERF-2 stayed invisible at "53/54 guarded". **Prove red against:** the current unwrapped relationship block (`:984-1040`) *before* commit 6D's wrap lands; ship check + wrap in the same PR, red run in the description.
4. **`audit-perf.cjs` — P5: zero-importer reachability.** Fail on a NEW zero-importer module under `lib/ | utils/ | contexts/ | hooks/ | services/`, seeded with an allowlist of what Phase 6 deliberately keeps. Must resolve platform extensions (`.native.ts`/`.web.ts` — `utils/offlineManager.*` is the known false positive via `CloudSyncService.ts:5`), index re-exports, and dynamic `await import()`. **Prove red against:** a throwaway unreferenced module added, tripped, reverted (the 2026-07-28 lesson's own procedure). This is the check that would have named PERF-4, PERF-5 and PERF-6 before they cost anything. |
5. **`audit-economy.cjs` — E-n: unbounded ad-reward call sites.** Flag any `<WatchAdRewardButton` JSX usage that passes an `onReward` touching money/gems without a `disabled` prop (the econ-4 class — the component's own docstring anticipates the cooldown; the one call site omitted it). **Prove red against:** the pre-commit-3C `BankApp.tsx:569`. — **Deliberately not added:** a `Math.random`/`Date.now` grep over `lib/events` + `lib/lifeMoments` (would land permanently red until GL-4 item (3) is done, which is out of scope; add it only in the same PR as that work, per the GL-4 fix note).

---

### Effort roll-up

Phase 1: 4 commits, all S — one focused day. Phase 2: 5 commits, S×4 + M×1. Phase 3: 3 commits, all S (+1 owner checkpoint). Phase 4: 3 commits, S+M+M, **single release**, version bump per CLAUDE.md. Phase 5: 4 commits, S×3 + M×1, release notes for UX-1/UX-3. Phase 6: 6 commits, S×3 + M×3, tooling proofs attached.

Key files by touch count (merge-conflict watch when parallelizing): `contexts/game/GameActionsContext.tsx` (GL-1, GL-5, recap-1, save-1-optional, PERF-2), `app/(tabs)/work.tsx` (crash-1, econ-3, UX-2, UX-4), `utils/saveValidation.ts` (save-3, save-5, crash-1), `contexts/game/actions/JobActions.ts` (econ-2, econ-3, UX-4), `components/computer/LuxuryApp.tsx` (econ-1, reach-2). Steps sharing these files are already grouped into single commits above; do not split them.