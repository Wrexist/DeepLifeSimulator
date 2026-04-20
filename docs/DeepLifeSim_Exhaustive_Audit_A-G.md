# Deep Life Simulator Exhaustive Failure/Exploit Audit

## SECTION A, CRITICAL (WILL KILL REVIEWS / SAVES)

1. Bug/Exploit Name: Unauthenticated cloud save and leaderboard writes (client-authoritative online trust)
Evidence: Confirmed
Exact System/Flow: Cloud upload path posts raw save and score payloads with no auth/session/user proof.
Why it will happen in real play: Any modified client, proxy, or script can send arbitrary save states and scores.
How players will discover or abuse it: Community shares a curl script in hours; players inject max money/age/score and overwrite competitive integrity.
Concrete fix (design plus technical): Move to authenticated APIs with signed user/session tokens and server-side authorization checks for every write; reject writes without proof; enforce per-user rate limits and anti-replay nonces.
Anchors: `lib/progress/cloud.ts:92`, `lib/progress/cloud.ts:95`, `lib/progress/cloud.ts:96`, `lib/progress/cloud.ts:158`, `lib/progress/cloud.ts:162`, `components/LeaderboardModal.tsx:124`

2. Bug/Exploit Name: Cloud save namespace collision and overwrite risk (no slot/user in contract)
Evidence: Confirmed
Exact System/Flow: Save endpoints use `POST /save` and `GET /save` with payload `{state, updatedAt}` only.
Why it will happen in real play: Without explicit slotId/userId/version contracts, server routing mistakes or weak backends cause cross-user/slot overwrites and rollback.
How players will discover or abuse it: Players test two accounts/devices; one upload replaces another; exploiters intentionally race writes.
Concrete fix (design plus technical): Require `{userId, slotId, revision, hash, signature}`; server enforces per-user slot ownership and compare-and-swap by revision.
Anchors: `lib/progress/cloud.ts:7`, `lib/progress/cloud.ts:8`, `lib/progress/cloud.ts:9`, `lib/progress/cloud.ts:92`, `lib/progress/cloud.ts:235`

3. Bug/Exploit Name: IAP entitlement grant through simulated purchase path
Evidence: Confirmed
Exact System/Flow: Purchase flow simulates success and directly applies benefits when IAP module is unavailable or not connected.
Why it will happen in real play: Rooted devices, hooked JS runtime, or offline module tampering can force this branch in production-like environments.
How players will discover or abuse it: Disable/break store module, call purchase API, receive full perks/gems/money without valid store transaction.
Concrete fix (design plus technical): Compile-time hard-disable simulation in production builds; require server-verified receipt before entitlement mutation; gate all grant functions behind trusted verification state.
Anchors: `services/IAPService.ts:319`, `services/IAPService.ts:320`, `services/IAPService.ts:330`, `services/IAPService.ts:336`

4. Bug/Exploit Name: Client-side receipt validation and local entitlement trust
Evidence: Confirmed
Exact System/Flow: Receipt validation is local heuristic; entitlements/purchase history are persisted and loaded from local storage.
Why it will happen in real play: Local storage and JS logic are editable by users with save editors/trainers.
How players will discover or abuse it: Inject fake `iap_purchases`/`permanent_perks` entries, replay listeners, or bypass `validateReceipt` checks.
Concrete fix (design plus technical): Server receipt verification (`verifyReceipt(receipt, productId, transactionId)`), server entitlement ledger, idempotent transaction IDs, and signed entitlement snapshots.
Anchors: `services/IAPService.ts:117`, `services/IAPService.ts:154`, `services/IAPService.ts:167`, `services/IAPService.ts:823`, `services/IAPService.ts:828`, `services/IAPService.ts:858`, `services/IAPService.ts:867`

5. Bug/Exploit Name: Save integrity is forgeable (CRC32 + local anti-exploit state)
Evidence: Confirmed
Exact System/Flow: Save envelope uses CRC32 checksum; protected anti-exploit state is stored locally with predictable key prefixes.
Why it will happen in real play: CRC32 is not tamper-proof; attacker edits payload and recomputes checksum; protected state can be edited/deleted in same store.
How players will discover or abuse it: Save editors modify money/perks/death/jail flags and regenerate checksum to pass validation.
Concrete fix (design plus technical): Replace with signed envelope `{slotId, revision, hash, signature}` using server or secure enclave keys; keep anti-exploit authority off client for competitive/paid surfaces.
Anchors: `utils/saveValidation.ts:444`, `utils/saveValidation.ts:452`, `utils/saveValidation.ts:474`, `utils/saveBackup.ts:7`, `utils/saveBackup.ts:153`

6. Bug/Exploit Name: Backup restore checksum bypass and wrong envelope load path
Evidence: Confirmed
Exact System/Flow: Corrupt-save recovery parses raw backup blob directly; restore writes `backup.data` without checksum verification.
Why it will happen in real play: Partial writes and manual tampering produce malformed backup envelopes; fallback path loads wrong shape and proceeds to repair/merge.
How players will discover or abuse it: Force-close during save, edit backup JSON, trigger fallback load to induce state corruption or anti-punishment rollback.
Concrete fix (design plus technical): Always `loadBackup()` then verify checksum/hash before parse; fallback must parse `backup.data` only; reject envelope mismatch and quarantine slot.
Anchors: `contexts/game/GameActionsContext.tsx:2230`, `contexts/game/GameActionsContext.tsx:2233`, `utils/saveBackup.ts:537`, `utils/saveBackup.ts:545`, `utils/saveBackup.ts:571`, `utils/saveBackup.ts:597`, `utils/saveBackup.ts:673`

7. Bug/Exploit Name: Save-slot authority mismatch can overwrite wrong slot
Evidence: Confirmed
Exact System/Flow: Save routine resolves target slot from AsyncStorage `lastSlot` instead of active `currentSlot` context.
Why it will happen in real play: Multi-slot users switch slots in UI but stale `lastSlot` can route autosave/backup to another slot.
How players will discover or abuse it: Slot-switch + rapid actions/autosave creates accidental cross-slot overwrite and perceived data loss.
Concrete fix (design plus technical): Use authoritative in-memory slot context for all save/backup paths; enforce slot parameter in every call; add guard that blocks mismatch.
Anchors: `contexts/game/GameStateContext.tsx:48`, `contexts/game/GameActionsContext.tsx:214`, `contexts/game/GameActionsContext.tsx:263`, `contexts/game/GameActionsContext.tsx:265`

8. Bug/Exploit Name: Core calendar corruption (4-week year/month versus 52-week age)
Evidence: Confirmed
Exact System/Flow: Week cycles 1..4; year/month advance every 4 weeks; age advances by 1/52 per week.
Why it will happen in real play: Long saves always accumulate timeline drift (age, year, month, seasonal/event systems desync).
How players will discover or abuse it: Players notice impossible aging/anniversary/election/competition timing and economy timers never lining up.
Concrete fix (design plus technical): Introduce `absoluteWeek` as single authority; derive `weekOfMonth` for UI only; migrate all durations and scheduler logic to `absoluteWeek`.
Anchors: `contexts/game/GameActionsContext.tsx:371`, `contexts/game/GameActionsContext.tsx:381`, `contexts/game/GameActionsContext.tsx:386`, `contexts/game/GameActionsContext.tsx:400`, `contexts/game/types.ts:852`, `contexts/game/types.ts:858`

9. Bug/Exploit Name: Staking reward replay and permanent lock states from cyclical week math
Evidence: Confirmed
Exact System/Flow: Rewards use `weeksPassed = gameState.week - position.startWeek`; claims for active positions do not checkpoint prior claims.
Why it will happen in real play: With week wrap 4->1, elapsed math becomes negative/incorrect; active positions can be repeatedly claimed or never mature.
How players will discover or abuse it: Spam Claim Rewards each week for duplicate accrual; create positions at week 4 and observe lock behavior.
Concrete fix (design plus technical): Store `startAbsoluteWeek` and `lastClaimAbsoluteWeek`; compute deltas on absolute timeline; use idempotent claim ledger per position.
Anchors: `contexts/game/actions/MiningActions.ts:370`, `contexts/game/actions/MiningActions.ts:413`, `contexts/game/actions/MiningActions.ts:423`, `contexts/game/actions/MiningActions.ts:453`, `components/computer/BitcoinMiningApp.tsx:4352`, `components/computer/BitcoinMiningApp.tsx:4370`

10. Bug/Exploit Name: R&D competition timelines never resolve under 1..4 week clock
Evidence: Confirmed
Exact System/Flow: Competition windows defined on 1..52 timeline; entries store endWeek using `gameState.week + delta`; result processor compares against `gameState.week`.
Why it will happen in real play: `gameState.week` never reaches endWeek values like 12/26/52; rewards never settle.
How players will discover or abuse it: Enter competition, pay entry cost, never receive result; reload abuse and review-bomb for lost funds.
Concrete fix (design plus technical): All competition scheduling on `absoluteWeek`; store `entryAbsoluteWeek` and `endAbsoluteWeek`; process once with completion flag and idempotency key.
Anchors: `lib/rd/competitions.ts:35`, `lib/rd/competitions.ts:52`, `contexts/game/actions/RDActions.ts:405`, `contexts/game/actions/RDActions.ts:448`

11. Bug/Exploit Name: Bank savings interest is UI-driven and dies after week wrap
Evidence: Confirmed
Exact System/Flow: Interest accrues in `BankApp` component effect gated by `gameState.week > lastSavingsWeek`.
Why it will happen in real play: Interest only runs when app screen is open; after hitting week 4, wrap to 1 prevents future accrual.
How players will discover or abuse it: Open bank once, then interest permanently stalls; or avoid opening bank to avoid expected behavior scrutiny.
Concrete fix (design plus technical): Move savings interest accrual into core weekly progression (`nextWeek`) on absolute timeline; make BankApp display-only.
Anchors: `components/mobile/BankApp.tsx:485`, `components/mobile/BankApp.tsx:488`, `components/mobile/BankApp.tsx:493`, `components/mobile/BankApp.tsx:495`

12. Bug/Exploit Name: Passive income hard-fails on property upkeep expression and zeroes payouts
Evidence: Confirmed
Exact System/Flow: Real-estate upkeep variable self-references in initializer; global catch returns zero for all passive streams.
Why it will happen in real play: Any owned property enters this branch; ReferenceError triggers catch and masks all passive income.
How players will discover or abuse it: Buy property, passive income suddenly collapses to zero; players perceive economy as broken/unfair.
Concrete fix (design plus technical): Fix upkeep initializer, add property-level try/catch not function-level wipeout, emit telemetry and fail partially (not globally).
Anchors: `lib/economy/passiveIncome.ts:190`, `lib/economy/passiveIncome.ts:619`, `lib/economy/passiveIncome.ts:624`

13. Bug/Exploit Name: Multi-step economy transactions are non-atomic and invariant checks are ineffective
Evidence: Confirmed
Exact System/Flow: Cash updates and asset updates are separate state writes; money invariant checker is called with wrong signature/object.
Why it will happen in real play: Rapid taps, stale closures, or interrupted updates can commit one mutation without the paired mutation.
How players will discover or abuse it: Spam buy/sell buttons, trigger duplicate balance changes, negative holdings, or free assets/cash under race windows.
Concrete fix (design plus technical): Introduce atomic `runEconomyTransaction(txId, mutations[])` with idempotency key and commit log; enforce invariant checks on pre/post amounts only.
Anchors: `contexts/game/MoneyActionsContext.tsx:139`, `utils/stateInvariants.ts:256`, `contexts/game/MoneyActionsContext.tsx:308`, `contexts/game/MoneyActionsContext.tsx:310`, `components/mobile/StocksApp.tsx:328`, `components/mobile/StocksApp.tsx:330`

14. Bug/Exploit Name: Bail payment deducts money twice
Evidence: Confirmed
Exact System/Flow: Bail flow calls `updateMoney(-bailCost)` and also directly subtracts `bailCost` in returned state.
Why it will happen in real play: Every bail action runs both paths; users lose extra money unexpectedly.
How players will discover or abuse it: Repeatable repro in jail screen; immediate trust loss and refund requests.
Concrete fix (design plus technical): Single-source monetary mutation via one atomic money transaction path; forbid direct stat money edits in jail actions.
Anchors: `contexts/game/JobActionsContext.tsx:322`, `contexts/game/JobActionsContext.tsx:328`

15. Bug/Exploit Name: Loan autopay is claimed as automatic but not executed in core simulation
Evidence: Confirmed
Exact System/Flow: Loan expenses are computed in display components; no core-weekly loan payment execution path is wired.
Why it will happen in real play: Players can carry debt without automatic deductions if they avoid manual repayment flows.
How players will discover or abuse it: Max out loans, invest proceeds, skip repayments, keep cashflow advantage indefinitely.
Concrete fix (design plus technical): Run loan amortization + missed-payment penalties in weekly progression on absolute timeline; lock UI copy to actual behavior.
Anchors: `components/mobile/BankApp.tsx:1005`, `lib/economy/expenses.ts:35`, `components/FinanceOverview.tsx:55`, `components/IdentityCard.tsx:216`, `lib/automation/autoPay.ts:18`

16. Bug/Exploit Name: Mining difficulty progression is unreachable under cyclical week clock
Evidence: Confirmed
Exact System/Flow: Difficulty updates when `weeksSinceUpdate >= 10`, but both operands are `gameState.week` style values in range 1..4.
Why it will happen in real play: Difference of two week-of-month values can never reach 10.
How players will discover or abuse it: Mining stays easier than designed forever; optimization communities lock dominant mining strategy.
Concrete fix (design plus technical): Track `lastDifficultyUpdateAbsoluteWeek`; compute elapsed with absolute week and run exactly-once weekly scheduler.
Anchors: `contexts/game/actions/MiningActions.ts:618`, `contexts/game/actions/MiningActions.ts:619`, `contexts/game/actions/MiningActions.ts:621`, `contexts/game/actions/MiningActions.ts:623`

## SECTION B, HIGH RISK (PLAYER LOSS / NEGATIVE REVIEWS)

1. Bug/Exploit Name: Divorce settlement cash-shield exploit (asset shielding)
Evidence: Confirmed
Exact System/Flow: Settlement percentage is based on net worth, but payable settlement is capped by current cash; asset ownership remains intact.
Why it will happen in real play: Min-max players move wealth to stocks/real estate before divorce, then pay tiny settlement from cash only.
How players will discover or abuse it: Community guide: "Convert cash to assets, divorce, keep portfolio."
Concrete fix (design plus technical): Settlement should liquidate/transfer proportional assets or create enforceable debt lien; divorce transaction must touch cash + asset ledgers atomically.
Anchors: `contexts/game/actions/DatingActions.ts:491`, `contexts/game/actions/DatingActions.ts:520`, `contexts/game/actions/DatingActions.ts:562`, `contexts/game/actions/DatingActions.ts:581`, `contexts/game/actions/DatingActions.ts:603`

2. Bug/Exploit Name: Child creation spam with no pregnancy/cooldown/state gate
Evidence: Confirmed
Exact System/Flow: `haveChild` can be called repeatedly with only money and relationship checks; child IDs are timestamp-based.
Why it will happen in real play: Macro users can farm children instantly for lineage/social systems.
How players will discover or abuse it: Spam "Have Child" action in one session; generate unrealistic family spikes and possible ID collisions under fast calls.
Concrete fix (design plus technical): Add pregnancy state machine, cooldowns, fertility constraints, and unique UUIDv7 child IDs with dedupe check.
Anchors: `contexts/game/SocialActionsContext.tsx:118`, `contexts/game/SocialActionsContext.tsx:135`, `contexts/game/SocialActionsContext.tsx:151`

3. Bug/Exploit Name: Relationship/family consistency validator is dead code
Evidence: Confirmed
Exact System/Flow: Validation/repair utilities exist but have no call sites in runtime load/save/action paths.
Why it will happen in real play: Long-run saves plus edge-case transitions create orphan/duplicate spouse-child links that never get repaired centrally.
How players will discover or abuse it: Family tree UI shows missing spouse/child links; exploits chain from inconsistent states.
Concrete fix (design plus technical): Run relationship validation/repair during load, before save, and after high-risk actions (marriage/divorce/childbirth/prestige/death).
Anchors: `utils/relationshipValidation.ts:22`, `utils/relationshipValidation.ts:126`

4. Bug/Exploit Name: Travel business opportunities fail to unlock on first completed trip
Evidence: Confirmed
Exact System/Flow: Destination is marked visited at departure; return flow checks first-visit by visited list, so unlock condition is false.
Why it will happen in real play: Every normal travel path marks visited before completion.
How players will discover or abuse it: "Visited destination" badge appears, but no business opportunity unlocks after return.
Concrete fix (design plus technical): Mark visited on successful return, not departure; compute `isFirstCompletedVisit` from trip history completion records.
Anchors: `contexts/game/actions/TravelActions.ts:67`, `contexts/game/actions/TravelActions.ts:110`, `contexts/game/actions/TravelActions.ts:125`

5. Bug/Exploit Name: Travel duration is unenforced; immediate return grants full benefits
Evidence: Confirmed
Exact System/Flow: Return action has no `currentWeek >= returnWeek` gate; benefits are applied on any return call.
Why it will happen in real play: UI exposes return action directly; users can return immediately after booking.
How players will discover or abuse it: Rapid travel/return loops for stat farming and event triggers.
Concrete fix (design plus technical): Enforce return gating by absoluteWeek; support early return with explicit reduced benefit curve and clear penalties.
Anchors: `contexts/game/actions/TravelActions.ts:57`, `contexts/game/actions/TravelActions.ts:91`, `contexts/game/actions/TravelActions.ts:102`

6. Bug/Exploit Name: Dividend payouts fail for modern stock holdings due symbol normalization bug
Evidence: Confirmed
Exact System/Flow: New-format holdings convert symbol to lowercase before stock lookup; stock keys are uppercase.
Why it will happen in real play: Standard holdings use symbols like `AAPL`; lowercase lookup returns zero-price stock fallback.
How players will discover or abuse it: Players observe missing dividends despite owned dividend stocks.
Concrete fix (design plus technical): Normalize to uppercase for all stock IDs; add invariant tests for payout parity between legacy/new holding formats.
Anchors: `lib/economy/passiveIncome.ts:52`, `lib/economy/passiveIncome.ts:56`, `lib/economy/stockMarket.ts:6`, `lib/economy/stockMarket.ts:101`

7. Bug/Exploit Name: Auto-reinvest fallback can fail due `getAllStocks()` record/array mismatch
Evidence: Confirmed
Exact System/Flow: Reinvest code treats object map as array (`length`, index lookup).
Why it will happen in real play: Branch executes when no valid existing holdings target exists.
How players will discover or abuse it: Reinvest silently does nothing or picks invalid target, creating economy inconsistency.
Concrete fix (design plus technical): Convert `Object.entries(getAllStocks())` to array with explicit symbol+price objects; add runtime guards.
Anchors: `contexts/game/GameActionsContext.tsx:731`, `contexts/game/GameActionsContext.tsx:732`, `contexts/game/GameActionsContext.tsx:733`, `lib/economy/stockMarket.ts:115`

8. Bug/Exploit Name: Rent economy mismatch (2 percent in rental flow, 10 percent in weekly deduction)
Evidence: Confirmed
Exact System/Flow: Player rents at 2% weekly in real-estate flow, but core weekly deduction charges 10% for rented properties.
Why it will happen in real play: Entering rental path immediately creates hidden recurring overcharge.
How players will discover or abuse it: Sudden unexplained cash drain; players perceive fraud-like economy behavior.
Concrete fix (design plus technical): Single rent calculator module shared by UI and core loop; hard fail if mismatched constants.
Anchors: `components/computer/RealEstateApp.tsx:565`, `contexts/game/GameActionsContext.tsx:771`, `contexts/game/GameActionsContext.tsx:772`

9. Bug/Exploit Name: Cloud conflict resolution uses stale local timestamps
Evidence: Confirmed
Exact System/Flow: Conflict resolver compares `updatedAt/lastLogin`, but these are only set in initial state and not maintained by progression.
Why it will happen in real play: Long sessions keep old local timestamps, causing bad merge precedence and silent overwrite.
How players will discover or abuse it: Two-device play yields "wrong side won" conflicts and apparent rollback.
Concrete fix (design plus technical): Update `updatedAt` on every authoritative state mutation/save commit; compare monotonic revisions instead of wall-clock.
Anchors: `contexts/game/initialState.ts:1159`, `contexts/game/initialState.ts:1160`, `services/CloudSyncService.ts:160`, `services/CloudSyncService.ts:211`

10. Bug/Exploit Name: Cloud merge can duplicate achievements due object identity Set semantics
Evidence: Inferred
Exact System/Flow: Merge uses `new Set([...localAchievements, ...remoteAchievements])` likely on object arrays.
Why it will happen in real play: Distinct object references for same achievement id are not deduped.
How players will discover or abuse it: Duplicate achievements inflate arrays and can break UI/perk logic.
Concrete fix (design plus technical): Deduplicate by stable achievement id key using map keyed on `achievement.id`.
Anchors: `services/CloudSyncService.ts:169`, `services/CloudSyncService.ts:170`

11. Bug/Exploit Name: Offline manager forces online state, creating sync and conflict hazards
Evidence: Confirmed
Exact System/Flow: Network monitor removed; manager assumes always online.
Why it will happen in real play: Real offline sessions still execute online queue behavior and conflict assumptions.
How players will discover or abuse it: Flight mode + multi-device edits produce unexpected drops/conflicts/retries.
Concrete fix (design plus technical): Restore robust network detection with crash-safe adapter and explicit offline authority mode.
Anchors: `utils/offlineManager.native.ts:56`, `utils/offlineManager.native.ts:57`, `utils/offlineManager.native.ts:61`, `services/CloudSyncService.ts:40`, `services/CloudSyncService.ts:42`

12. Bug/Exploit Name: Leaderboard integrity is trivially tampered locally and remotely
Evidence: Confirmed
Exact System/Flow: Local prestige leaderboards persist directly in AsyncStorage; online leaderboard submits arbitrary name/score from client.
Why it will happen in real play: Save editors and scripts can inject entries or spoof high scores.
How players will discover or abuse it: Discord shares local edit keys and POST payload formats.
Concrete fix (design plus technical): Server-verified score submissions with anti-cheat checks, signed runs, and suspicious score quarantine pipeline.
Anchors: `lib/prestige/prestigeLeaderboards.ts:57`, `lib/prestige/prestigeLeaderboards.ts:110`, `lib/progress/cloud.ts:162`, `components/LeaderboardModal.tsx:125`

13. Bug/Exploit Name: Anniversary scheduler is broken by week-of-month arithmetic
Evidence: Confirmed
Exact System/Flow: `weeksMarried = gameState.week - marriageWeek` and anniversary check uses modulo 52.
Why it will happen in real play: `gameState.week` cycles 1..4, so elapsed married weeks never reaches 52 cadence.
How players will discover or abuse it: Marriage anniversary events/rewards never fire; relationship progression appears bugged.
Concrete fix (design plus technical): Store `marriageAbsoluteWeek` and compute `absoluteWeek - marriageAbsoluteWeek`; trigger yearly milestones on absolute timeline.
Anchors: `contexts/game/actions/DatingActions.ts:367`, `contexts/game/actions/DatingActions.ts:718`, `contexts/game/actions/DatingActions.ts:719`, `contexts/game/actions/DatingActions.ts:723`

## SECTION C, MEDIUM (LONG-TERM DAMAGE / TECH DEBT)

1. Bug/Exploit Name: Daily challenge reset is clock/timezone manipulable
Evidence: Confirmed
Exact System/Flow: Reset logic uses local `toDateString()` despite UTC reset intent in comments.
Why it will happen in real play: Device clock or timezone changes alter challenge day boundaries.
How players will discover or abuse it: Change timezone/device time to reroll daily challenges and rewards.
Concrete fix (design plus technical): Use server UTC day key or monotonic day counter anchored to signed timestamp.
Anchors: `utils/dailyChallenges.ts:247`, `utils/dailyChallenges.ts:253`, `utils/dailyChallenges.ts:275`, `utils/dailyChallenges.ts:279`

2. Bug/Exploit Name: Stock simulation can hit Infinity/NaN edge from Box-Muller input zero
Evidence: Inferred
Exact System/Flow: `Math.log(u1)` with `u1` from `Math.random()` can hit log(0) edge.
Why it will happen in real play: Rare edge values in long-running sessions can propagate non-finite price changes.
How players will discover or abuse it: Long soak or forced RNG hooks trigger invalid stock price spikes.
Concrete fix (design plus technical): Clamp `u1` to `(Number.EPSILON, 1)`; add finite guards before apply/round.
Anchors: `lib/economy/stockMarket.ts:77`, `lib/economy/stockMarket.ts:79`, `lib/economy/stockMarket.ts:88`

3. Bug/Exploit Name: High-value RNG outcomes are reload-rerollable (no persisted RNG seed)
Evidence: Inferred
Exact System/Flow: Core economy/event actions use `Math.random()` without persisted seed/commit.
Why it will happen in real play: Force-close/reload before commit rerolls outcomes until favorable.
How players will discover or abuse it: Saveload loops for proposal success, street job outcomes, market movements.
Concrete fix (design plus technical): Deterministic RNG seeded by `{slotId, absoluteWeek, eventId}` with consumed-seed journal committed before resolution.
Anchors: `lib/economy/stockMarket.ts:77`, `contexts/game/actions/JobActions.ts:109`, `contexts/game/actions/DatingActions.ts:201`

4. Bug/Exploit Name: Onboarding writes inconsistent week fields versus engine invariants
Evidence: Confirmed
Exact System/Flow: Onboarding sets `week = weeksLived + 1` and `date.week = (weeksLived % 52) + 1`, while invariants require date.week in 1..4.
Why it will happen in real play: Older or custom starts create immediate timeline inconsistency and later clamping artifacts.
How players will discover or abuse it: Start older scenario, observe broken weekly systems and mismatch warnings.
Concrete fix (design plus technical): Migrate onboarding to `absoluteWeek`; derive display week-of-month field; enforce invariant on save creation.
Anchors: `app/(onboarding)/Perks.tsx:347`, `app/(onboarding)/Perks.tsx:348`, `app/(onboarding)/Perks.tsx:349`, `utils/stateInvariants.ts:128`, `utils/stateInvariants.ts:134`

5. Bug/Exploit Name: Milestone IDs are based on cyclical week and can collide
Evidence: Confirmed
Exact System/Flow: Date/engagement/wedding milestone IDs include `prev.week` not absolute time.
Why it will happen in real play: Every 4 weeks IDs repeat for same partner/action patterns.
How players will discover or abuse it: UI list key collisions, overwritten or duplicate-feeling milestones.
Concrete fix (design plus technical): Use deterministic UUID with absoluteWeek + monotonic counter.
Anchors: `contexts/game/actions/DatingActions.ts:93`, `contexts/game/actions/DatingActions.ts:220`, `contexts/game/actions/DatingActions.ts:391`

6. Bug/Exploit Name: Save schema version drift can break migration assumptions
Evidence: Confirmed
Exact System/Flow: Initial state version is 10, but repair path defaults missing version to 5.
Why it will happen in real play: Corrupted/migrated saves can be downgraded in metadata and skip required new-field migration logic.
How players will discover or abuse it: Old saves load with silent field defaults and cross-version behavior regressions.
Concrete fix (design plus technical): Centralize schema version constant and explicit migration table for each version step.
Anchors: `contexts/game/initialState.ts:5`, `utils/saveValidation.ts:260`

7. Bug/Exploit Name: Save/load mutex exists but is effectively not integrated
Evidence: Confirmed
Exact System/Flow: Mutex utility is defined; import appears but no acquire/release usage in save/load critical paths.
Why it will happen in real play: Concurrent UI actions, autosave, and manual load/restore can still race.
How players will discover or abuse it: Repeated quick save/load and action spam yields occasional stale writes.
Concrete fix (design plus technical): Wrap all save/load/restore entry points in `withSaveLoadLock` wrapper and enforce single-writer semantics.
Anchors: `utils/saveLoadMutex.ts:20`, `utils/saveLoadMutex.ts:42`, `contexts/game/MoneyActionsContext.tsx:16`

8. Bug/Exploit Name: Cloud sync interval lifecycle has no teardown path
Evidence: Confirmed
Exact System/Flow: Periodic sync uses `setInterval` without storing/clearing handle.
Why it will happen in real play: Hot reload/test harnesses can stack intervals and duplicate sync behavior.
How players will discover or abuse it: Increased battery/network use and duplicate cloud writes in long sessions/dev environments.
Concrete fix (design plus technical): Store interval ID, provide explicit `dispose()` for singleton lifecycle, and guard duplicate timers.
Anchors: `services/CloudSyncService.ts:49`

9. Bug/Exploit Name: Real estate app contains duplicated end-rental confirmation blocks
Evidence: Confirmed
Exact System/Flow: Duplicate modal text/actions for ending rented-out tenancy appears in same component.
Why it will happen in real play: Parallel edits drift logic and create one-sided bug fixes.
How players will discover or abuse it: One modal path gets fixed, the other regresses.
Concrete fix (design plus technical): Consolidate to shared modal component with one handler source.
Anchors: `components/computer/RealEstateApp.tsx:1822`, `components/computer/RealEstateApp.tsx:1861`

## SECTION D, LOW (POLISH / FUTURE-PROOFING)

1. Bug/Exploit Name: Social action API exposes placeholder implementations
Evidence: Confirmed
Exact System/Flow: Core social context methods log-only (`startDating`, `breakUp`, `giveGift`, etc.) while being part of live action surface.
Why it will happen in real play: Future UI hooks may call stubs and appear broken.
How players will discover or abuse it: "Action did nothing" reports and trust erosion.
Concrete fix (design plus technical): Remove from public context until implemented, or route to hardened action reducers with tests.
Anchors: `contexts/game/SocialActionsContext.tsx:61`, `contexts/game/SocialActionsContext.tsx:67`, `contexts/game/SocialActionsContext.tsx:87`, `contexts/game/SocialActionsContext.tsx:92`

2. Bug/Exploit Name: Ask-for-money UX is exposed but not implemented
Evidence: Confirmed
Exact System/Flow: UI action path intentionally returns "Feature coming soon".
Why it will happen in real play: Players interpret as broken feature rather than roadmap.
How players will discover or abuse it: Repeated attempts and negative reviews around fake buttons.
Concrete fix (design plus technical): Hide action until implemented or ship minimal deterministic behavior with cooldown and caps.
Anchors: `components/mobile/ContactsApp.tsx:176`, `components/mobile/ContactsApp.tsx:177`

3. Bug/Exploit Name: Stock UI change/candlestick data is partially synthetic and can mislead
Evidence: Confirmed
Exact System/Flow: Displayed stock change and candles are generated with local random variation, not strict persisted market history.
Why it will happen in real play: UI numbers can disagree with player expectation of deterministic market feed.
How players will discover or abuse it: Screenshots show contradictory "change" values after reload.
Concrete fix (design plus technical): Persist OHLC/time-series per absolute week and render from that ledger only.
Anchors: `components/mobile/StocksApp.tsx:150`, `components/mobile/StocksApp.tsx:157`, `components/mobile/StocksApp.tsx:199`

4. Bug/Exploit Name: Inheritance valuation uses coarse proxies, not current asset value
Evidence: Confirmed
Exact System/Flow: Real estate valued by `price` not `currentValue`; company value fixed at `weeklyIncome * 52 * 5`.
Why it will happen in real play: Legacy payout feels arbitrary and exploitable around asset timing.
How players will discover or abuse it: Players compare displayed portfolio value versus inheritance result and min-max timing around transitions.
Concrete fix (design plus technical): Use normalized market valuation snapshot at death/prestige with explicit model and explainable breakdown UI.
Anchors: `lib/legacy/inheritance.ts:52`, `lib/legacy/inheritance.ts:55`

## SECTION E, MISSING SYSTEMS

1. Safeguard Missing: Authoritative time contract.
Required addition: `absoluteWeek`, `year`, `month`, deprecated `weekOfMonth` (UI only).
Required boundaries: All durations/events/interest/staking/competition/travel use `absoluteWeek`; convert week-of-month at render time only.

2. Safeguard Missing: Atomic economy transaction layer.
Required addition: `runEconomyTransaction(txId, mutations[])`.
Required boundaries: One commit updates money, assets, logs, and invariants together; idempotency key prevents replay.

3. Safeguard Missing: Signed save envelope and anti-rollback revisioning.
Required addition: `{slotId, revision, hash, signature}`.
Required boundaries: Reject unsigned or stale revisions; keep tamper evidence and rollback reason codes.

4. Safeguard Missing: Authenticated cloud contracts.
Required addition: `uploadGameState(auth, slotId, revision, payload)`, `downloadGameState(auth, slotId)`, `uploadLeaderboardScore(auth, runProof, score)`.
Required boundaries: Server validates session/user/slot ownership and replay protection.

5. Safeguard Missing: Server-verified IAP entitlement contract.
Required addition: `verifyReceipt(receipt, productId, transactionId)` before grant.
Required boundaries: Server ledger stores immutable entitlement state and prevents duplicate grant.

6. Safeguard Missing: Deterministic conflict-aware cloud merge schema.
Required addition: Merge rules by entity key + revision, not object-reference sets.
Required boundaries: Use precedence matrix per subsystem (stats, inventory, relationships, achievements).

7. Anti-exploit mechanism missing: Seeded RNG commit log.
Required behavior: Critical random rolls consume deterministic seeds tied to save revision; rolls cannot reroll by reload.

8. Anti-exploit mechanism missing: High-risk action nonce journal.
Required behavior: One-time operations (IAP grant, staking claim, inheritance payout, divorce settlement) must have replay-protected nonces.

9. Balancing feedback loop missing: Dynamic sinks tied to net worth and progression velocity.
Required behavior: Taxes/upkeep/risk scale with wealth concentration; anti-snowball dampers activate above threshold.

10. Balancing feedback loop missing: Debt recovery rails.
Required behavior: Bankruptcy restructuring, minimum survival income, explicit debt workout plans to avoid save death spirals.

11. Telemetry missing: Economy integrity events.
Required logs: `tx_started`, `tx_committed`, `tx_rolled_back`, `invariant_failed`, `nonfinite_detected`, `rollback_detected`.

12. Telemetry missing: Time and scheduler integrity events.
Required logs: `time_tick`, `absolute_week`, `duration_complete`, `duration_missed`, `negative_delta_detected`.

13. Telemetry missing: Cloud sync and conflict analytics.
Required logs: `sync_upload`, `sync_download`, `conflict_detected`, `merge_strategy_used`, `rollback_blocked`, `signature_invalid`.

14. Telemetry missing: IAP security analytics.
Required logs: `receipt_verified_server`, `receipt_rejected`, `entitlement_granted`, `grant_idempotent_replay_blocked`.

15. Telemetry missing: Family/lineage consistency checks.
Required logs: `orphan_child_detected`, `duplicate_spouse_detected`, `lineage_link_repaired`, `identity_collision_detected`.

## SECTION F, PLAYER ATTACK PLAN

1. Save abuse playbook.
Step 1: Export/modify save JSON to set money/perks/stats.
Step 2: Recompute checksum and patch envelope fields.
Step 3: Edit `protected_state_*` to clear death/jail/age blockers.
Step 4: Restore tampered save and push to cloud/leaderboard.
Step 5: Share editor templates in community channels.

2. Reload abuse playbook.
Step 1: Trigger high-value RNG action (proposal, street job, market entry, lawyer outcome).
Step 2: If bad result, force-close before stable commit.
Step 3: Reload and retry until favorable roll.
Step 4: Automate with macro and state detector.

3. Time/clock abuse playbook.
Step 1: Change device date/timezone before opening app.
Step 2: Force daily challenge reset and reroll.
Step 3: Repeat timezone flips around midnight boundaries.
Step 4: Exploit any local-time reward windows.

4. Pause/alt-tab/force-close abuse playbook.
Step 1: Start transaction with split state writes (cash then asset or inverse).
Step 2: Suspend/kill app between writes/autosave operations.
Step 3: Reload to capture favorable partial state.
Step 4: Repeat across buy/sell/claim/divorce/bail flows.

5. Cloud conflict abuse playbook.
Step 1: Play on Device A offline, create advantageous state.
Step 2: Play on Device B with different progression.
Step 3: Manipulate timestamps or edit fields to force preferred merge precedence.
Step 4: Upload and overwrite remote state/leaderboards.

6. IAP abuse playbook.
Step 1: Force simulated purchase path by disrupting IAP module/connectivity branch.
Step 2: Inject local purchase/perk records.
Step 3: Trigger restore/listener replay to reapply benefits.
Step 4: Convert fake entitlement into leaderboard/cloud dominance.

7. Economy race abuse playbook.
Step 1: Use autoclicker on buy/sell buttons with laggy frame pacing.
Step 2: Trigger split updates and stale closure windows.
Step 3: Keep favorable leg, drop unfavorable leg via interruption.
Step 4: Scale with multiple asset classes.

8. Edge-case timeline abuse playbook (birth/death/inheritance/prison/bankruptcy/migration).
Step 1: Stack events near week wrap (week 4 to 1).
Step 2: Enter jail/divorce/staking/wedding transitions simultaneously.
Step 3: Save, reload, and migrate versions around transition point.
Step 4: Attempt reversals via backup restore and protected-state edits.
Step 5: Harvest duplicated rewards or skip penalties.

## SECTION G, TESTS I MUST RUN BEFORE RELEASE

1. Test Name: 500-hour deterministic soak with save/load churn.
Setup: Fresh slot with scripted progression covering careers, relationships, travel, mining, stocks, loans.
Action sequence: Simulate 26,000+ weekly ticks with autosave every N ticks and hard app restart every 50 ticks.
Expected result: No NaN/Infinity, monotonic `absoluteWeek` (or equivalent), stable save/load parity.
Failure signal: Non-finite values, missing entities, timing drift, save parse fallback activation, performance cliff.

2. Test Name: Calendar consistency across week/month/year boundaries.
Setup: Seed states around boundary points (week 4->1, month 12->1, year changes).
Action sequence: Advance weeks and execute all duration-based systems.
Expected result: Timers use absolute timeline; no negative elapsed weeks; anniversaries/competitions fire correctly.
Failure signal: Negative durations, never-completing entries, repeated completion, impossible dates.

3. Test Name: Staking idempotency and replay resistance.
Setup: Multiple staking positions created at different weeks including boundary weeks.
Action sequence: Claim rewards repeatedly same week, across wrap, and after reload.
Expected result: One claim per earned interval; no duplicate payouts; positions unlock exactly once.
Failure signal: Duplicate rewards, permanently locked positions, negative elapsed calculations.

4. Test Name: R&D competition completion and payout determinism.
Setup: Enter all competition types with valid company prerequisites.
Action sequence: Progress timeline until each scheduled end.
Expected result: Each entry resolves once with deterministic completion state and payout log.
Failure signal: Entry never resolves, resolves multiple times, or resolves before scheduled completion.

5. Test Name: Bank interest and loan autopay core-loop validation.
Setup: Positive bank savings + active loans with known APR/payment schedule.
Action sequence: Advance 200 weeks without opening bank UI.
Expected result: Savings and loan balances update correctly from core loop only; UI reflects persisted values.
Failure signal: No accrual, no autopay, wrap-induced freeze, UI-only mutation behavior.

6. Test Name: Save tamper suite.
Setup: Export save, edit money/perks/protected state/version/checksum combinations.
Action sequence: Load tampered saves, attempt cloud upload and leaderboard submission.
Expected result: Tamper rejected with explicit error and quarantine; no silent auto-fix acceptance.
Failure signal: Tampered state loads/propagates, leaderboard accepts modified scores.

7. Test Name: Backup integrity and fallback recovery.
Setup: Create backups, corrupt main save, corrupt backup envelope, corrupt backup payload.
Action sequence: Trigger load fallback and manual restore.
Expected result: Correct envelope parsing, checksum/hash verification, safe rollback path.
Failure signal: Envelope object loaded as game state, unchecked restore, silent corruption.

8. Test Name: Force-close transaction atomicity.
Setup: Instrument buy/sell/crypto/divorce/bail actions.
Action sequence: Kill app at each mutation step boundary.
Expected result: Transaction either fully commits or fully rolls back.
Failure signal: Partial commits (money moved without asset, asset moved without money, double-deduct).

9. Test Name: Economy race stress (UI spam + low FPS).
Setup: 15-30 FPS throttle with input macro for trade/rent/claim actions.
Action sequence: Rapid alternating actions for 5,000 operations.
Expected result: Invariants hold; no duplicated or lost value; action idempotency maintained.
Failure signal: Drift between displayed and ledger amounts, negative holdings, unexplained profit.

10. Test Name: Precision and overflow guard suite.
Setup: Inject extreme values for prices, holdings, debt, and rewards near numeric limits.
Action sequence: Run weekly simulation and transaction operations.
Expected result: Non-finite values blocked; clamped behavior explicit; no propagation.
Failure signal: NaN/Infinity in any persisted field or UI output.

11. Test Name: Cloud two-device conflict chaos test.
Setup: Device A and B diverge offline from same base slot.
Action sequence: Concurrent uploads with manipulated timestamps/order.
Expected result: Deterministic merge with anti-rollback enforcement and audit trail.
Failure signal: Wrong state precedence, silent rollback, cross-slot overwrite.

12. Test Name: Leaderboard forgery resistance.
Setup: Attempt submissions with spoofed names/scores/run states via API and offline queue.
Action sequence: Replay and high-frequency submissions.
Expected result: Server rejects unverifiable scores and throttles abuse.
Failure signal: Arbitrary score accepted and visible globally.

13. Test Name: IAP abuse suite (simulation/offline/restore replay).
Setup: Instrument purchase path with disabled module and mocked receipts.
Action sequence: Trigger simulation branch, storage injection, restore replay.
Expected result: No entitlement grant without server verification; duplicate grant blocked by transaction ID.
Failure signal: Entitlement granted offline or duplicated by replay.

14. Test Name: Family/lineage consistency transitions.
Setup: Run marriage, divorce, childbirth, death, prestige-child continuation chains.
Action sequence: Validate spouse/child IDs across `relationships`, `family`, and `familyTreeData` after each transition.
Expected result: No orphan nodes, no duplicate spouses, no broken parent-child links.
Failure signal: Missing links, duplicate IDs, inconsistent child counts between arrays.

15. Test Name: Save migration matrix (vN-2, vN-1, corrupted version metadata).
Setup: Curate fixture saves across schema versions including malformed/missing fields.
Action sequence: Load into current build, progress weeks, save again.
Expected result: Deterministic migration path with explicit repair logs.
Failure signal: Silent downgrade, field loss, crash, or unrecoverable invalid state.

16. Test Name: Passive income integrity under property ownership.
Setup: States with no property, one property, many properties, mixed upgrade levels.
Action sequence: Run weekly passive income calculation and compare expected breakdown.
Expected result: All streams compute independently; one subsystem failure does not zero others.
Failure signal: Total passive income collapses to zero due single property error.

17. Test Name: Travel unlock and duration enforcement.
Setup: Fresh account, unvisited destinations.
Action sequence: Travel, attempt immediate return, then proper return after duration.
Expected result: Early return behavior explicit and reduced; first completed visit unlocks opportunity once.
Failure signal: Unlock never happens or immediate full-benefit exploit remains.

18. Test Name: Debt and bankruptcy survival rails.
Setup: Force high debt, low cash, recurring expenses.
Action sequence: Advance weeks without manual repayment actions.
Expected result: Predictable debt progression with recovery path and no unavoidable save death trap.
Failure signal: Soft-lock, hidden irreversible spiral, or free-debt exploit.

19. Test Name: Autosave/backup slot isolation.
Setup: Populate three slots with distinct signatures and play times.
Action sequence: Switch slots repeatedly while autosave and backup timers run.
Expected result: Writes and backups remain slot-local and revision-consistent.
Failure signal: Cross-slot overwrite, wrong-slot backup restoration.

20. Test Name: Low-end performance and logic stability.
Setup: CPU throttled mobile profile, large family tree, large inventories and ledgers.
Action sequence: Run 2-hour gameplay with frequent UI tab switches and autosaves.
Expected result: No logic misfires due frame drops; stable memory and acceptable save/load latency.
Failure signal: missed weekly ticks, duplicated events, UI-data mismatch, thermal shutdown behavior.
