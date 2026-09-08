# Master Prompt — Program 18: From Release Candidate to a Deeper Life Simulator

**Prepared:** 2026-09-07  
**Product:** DeepLife Simulator  
**Targets:** iOS, Android, and web  
**Current package:** 2.13.0  
**Current save schema:** `STATE_VERSION = 51`

> **Implementation status, 2026-09-07:** the owner authorized execution after
> merging #196. Start with `tasks/todo.md` and
> `tasks/program-18-audit-and-implementation-2026-09-07.md`. The weakness map
> below contains historical hypotheses, not 50 confirmed current defects.
> Creator levels/memberships, new-company Hustle overlays, the real pet-care
> tick, banking interest counters, and education semesters/exams are already
> wired. Do not rebuild them from the stale assertions in sections 3 and 9.
> iOS run #72 built the 2.13.0 IPA and initiated submission on September 6.
> Submission completion and physical-device validation remain unverified.
> Newly reproduced purchase/save faults must close before a new release.

> **Continuation, 2026-09-08:** PR #197 now adds same-install purchase-intent
> recovery, recurring journal identity, and live-event claim/budget continuity
> across prestige/heir transitions. The achievement objective also uses the
> canonical earned-achievement reader. See
> `tasks/program-18-continuity-and-recovery-2026-09-08.md` for tested boundaries
> and remaining native, reinstall and subscription recovery work.

> **Education continuation, 2026-09-08:** after #197 merged, the next slice
> adds actual loan-cost disclosure, adjusted study duration and atomic
> enrollment guards. See `tasks/program-18-education-costs-2026-09-08.md`.
> The full post-bills forecast and student-loan deferment remain open.

> This is the next executable master prompt, not a promise that every idea below
> is already approved. Give it to the implementation agent after the 2.13.0
> release gates are closed. Work from evidence, preserve saves and paid benefits,
> and prefer finishing existing systems over adding another disconnected screen.

---

## 0. Owner questions — answer when convenient, but do not block the audit

Use the recommended defaults in parentheses until the owner answers:

1. Is the immediate objective **ship 2.13.0**, **improve retention**, or **add
   marketable depth**? (**Ship, then retention, then depth.**)
2. Should one real-life day represent one play session, or should the player be
   encouraged to advance many weeks per session? (**Support both; never use
   real-time waiting to block the core simulation.**)
3. Is the desired tone grounded/serious, satirical, or a blend? (**Grounded
   systems with concise, lightly playful writing.**)
4. Which audience is primary: BitLife-style story players, strategy/economy
   players, or cozy progression players? (**Story first, strategy underneath.**)
5. May major systems create irreversible consequences such as divorce, business
   failure, repossession, injury, or prison? (**Yes, if telegraphed, explainable,
   and recoverable in ordinary play.**)
6. Should web be a fully supported game or a preview/funnel for native? (**Keep
   it functionally playable; native remains the release and monetization target.**)
7. Is online/cloud/social multiplayer in scope this year? (**Cloud backup and
   community challenges only; no synchronous multiplayer yet.**)
8. Which monetization boundary is non-negotiable? Recommended: no paid purchase
   should silently disappear; ads and gems accelerate or personalize but do not
   turn core survival into pay-to-win.
9. Are we willing to add backend operating cost for cloud save, remote content,
   moderation, and account recovery? (**Only after the offline core is healthy.**)
10. What is the release cadence after 2.13.0: weekly patches, monthly content, or
    quarterly feature releases? (**Biweekly patches, monthly content, one larger
    feature every 6–8 weeks.**)

Record answers in the Decision Log (§17). Do not silently reinterpret unanswered
questions as product approval.

---

## 1. Mission and product north star

Build the best **mobile-first life simulator** in which a player can understand
why their life changed, make meaningful trade-offs, tell a different story on a
new life, and remain curious about the next week. The same TypeScript simulation
must run safely on iOS, Android, and web.

Every shipped increment must improve at least one of these promises:

1. **Agency:** a choice changes a later outcome.
2. **Legibility:** the player can explain the outcome and find the next action.
3. **Variation:** different lives, strategies, relationships, and world states
   produce meaningfully different stories.
4. **Continuity:** the world remembers decisions across weeks and, where intended,
   across generations.
5. **Fairness:** losses are telegraphed; recovery exists; purchases and saves are
   never gambled by implementation details.
6. **Pace:** advancing a week feels immediate even in a 250-week life.

Do **not** optimize for raw feature count. Optimize for completed loops, reachable
content, consequence density, replayability, and player trust.

---

## 2. Verified project baseline

- React Native 0.81.5, Expo SDK 54, React 19.1, strict TypeScript, expo-router.
- One large `GameState`, composed through nine game providers; the week loop is
  split across roughly 37 `apply*` subsystems.
- AsyncStorage persistence uses checksummed saves and a migration ladder.
- Major playable domains already include career, education, relationships/family,
  health, crime, banking, stocks/crypto, real estate, companies, creator apps,
  travel, vehicles, politics, prestige/legacy, events, achievements, live ops,
  IAP, ads, and cloud-save scaffolding.
- The repository already has hundreds of suites plus static audits for economy,
  stability, saves, logic, and performance. Program 17 most recently reported
  762 suites / 9,629 tests green, clean source/test type checks, and no known P0
  or P1 code blocker.
- The remaining 2.13.0 gates are operational/device gates: build from merged
  main, observe the first EAS environment-wrapped preflight, sandbox purchase /
  restore / relaunch, native modal flows, accessibility, and tester re-verification.

Treat historical reports as leads, not truth. Reproduce every open claim on the
current commit before changing code.

---

## 3. Weakness map — what must improve next

### A. Release and operational confidence

1. A green Linux suite is not an iOS or Android device pass.
2. The 2.13.0 binary and sandbox monetization matrix still require human-device
   evidence.
3. Release configuration depends on remote EAS/RevenueCat/App Store state and is
   only partly observable locally.
4. The support/live-ops surfaces create operational responsibility without a
   single, concise owner dashboard/runbook.
5. App-store copy and in-game claims can drift from implemented behavior.

### B. Save, purchase, and state integrity

6. Old migration loops (v11/v13/v14) do not tolerate `null` array entries; the
   loader survives, but the migration retries and fails forever.
7. New-life carry-over needs a two-phase protocol; a simple reorder trades gem
   duplication risk for paid-entitlement loss.
8. Consumable grants need a persisted pending-grant recovery record on every
   store path, not only transaction-ledger deduplication.
9. RevenueCat entitlements must not be cleared merely because the first fetch of
   a launch has never completed.
10. `liveOps.claimedInstanceIds` and chapter gem claims need an explicit
    per-life versus per-lineage policy.

### C. Core simulation and balance

11. Happiness saturation remains an owner decision: high-value lives can spend
    long stretches clamped at 100, hiding differences and discarding rewards.
12. The ad-orb vitality grant is unusually large, week-ungated, and bypasses the
    shared happiness-gain curve.
13. Free contact calls have no time/opportunity cost and can ratchet ordinary
    relationships to maximum strength.
14. Student loans charge while studying; deferment and repayment fantasy are
    incomplete.
15. Chapter 2 has a reward spike and chapter rewards may be farmable across a
    lineage.
16. Party standing drift, election consequences, and social wealth measurement
    still need product decisions and stronger persona coverage.
17. Event telemetry lacks a full interruption-budget versus arc-completion view;
    unlucky lives can see too few meaningful choices.
18. Any new random tick path can destroy same-life replay unless it uses the
    life-salted deterministic roll system.

### D. Incomplete or deceptive app loops

19. **Banking:** interest statistics, savings goals, account transfers, budgets,
    card fees/rewards, and live rates need one authoritative, conserved-money loop.
20. **Stocks:** macro/sector signals must affect the authoritative tradeable
    price; otherwise banners and movers imply a simulation that is not real.
21. **Mining:** durability needs repair/auto-repair; large authored depth
    (pools, upgrades, energy, staking, automation) must become reachable.
22. **Spark:** unresolved jealousy can block future jealousy; premium “likes you”
    and relationship lifetime stats should become real features.
23. **Contacts:** recency/Attention and favor/IOU systems need producers and tick
    wiring; duplicated inline mutations should move into domain actions.
24. **Pulse:** paid analytics value, follower history, scandals, and bounded NPC
    reactions need to become reachable and honest.
25. **Pets:** use the real care/decay engine so vaccination, traits, sickness,
    toys, bonding, and mortality agree with the UI.
26. **Education:** class templates, exams, semester choice, bonuses, campus
    events, and study groups should form a complete semester loop.
27. **Hustle:** new companies must enter the overlay/tick; staff must affect
    output; scandals and milestones must be written by real gameplay.
28. **Real estate:** rooms/decor/upgrades and the activity timeline are authored
    but underexposed; rent/value calculations must remain single-source.
29. **YouVideo/Streamly:** creator levels are frozen; viewers/live status and
    memberships need shared authoritative calculations and income caps.
30. **Travel:** destination events and benefits are partly cosmetic; stress must
    map to existing stats or the UI must stop claiming it.
31. **Vehicles:** template specs, financing reputation, insurance labels, and the
    accident/total-loss system need consistent wiring.
32. **Politics:** requires a fresh end-to-end audit before new scope; spending,
    approval, scandal, office exits, and PAC efficiency are high-risk systems.

### E. UX, accessibility, and discovery

33. Complex app-within-app screens risk becoming dashboards rather than stories.
34. Critical actions compete with stats, tabs, cards, popups, toasts, live ops,
    goals, and ads for the first viewport.
35. Eight interactive elements were historically measured below the 44-point
    target and still need native confirmation.
36. VoiceOver order, labels, focus restoration, Reduce Motion, contrast, and
    largest Dynamic Type require a repeatable device matrix, not ad-hoc checks.
37. Small screens and web pointer/keyboard behavior need explicit regression
    captures at 360, 390, and 430px plus desktop web.
38. Features with no discoverable entry point are dead even if their engines and
    tests exist.

### F. Architecture, maintainability, and performance

39. `GameState` and the action surface are very large; broad context subscriptions
    make accidental whole-app rerenders easy.
40. The week loop has many subsystems, increasing order-dependency, exception,
    conservation, and O(n²) risks.
41. Lint/UI ratchets protect regressions but their existing warning debt remains
    significant.
42. Duplicated display calculations can diverge from the real tick.
43. Feature flags, live-ops defaults, store configuration, and platform fallbacks
    need contract tests at their boundaries.
44. Analytics must answer product questions without collecting sensitive life
    choices or becoming mandatory for simulation correctness.

### G. Content, retention, and live operations

45. More templates alone do not fix reachability, repetition, or consequences.
46. Story arcs need setup, escalation, resolution, memory, and downstream effects;
    isolated one-week events feel interchangeable.
47. Mid/late-game players need new decisions rather than only bigger numbers.
48. Prestige must alter the next life’s strategy/story, not merely reset stats.
49. Daily/weekly rewards, challenges, holidays, and subscriptions need one
    interruption budget and clear claim policy.
50. There is no single product scorecard joining crash-free play, week completion,
    choice rate, recovery, retention, monetization fairness, and content variety.

---

## 4. Non-negotiable engineering rules

1. Read `CLAUDE.md`, `tasks/todo.md`, `tasks/lessons.md`, the most recent release
   report, and all scoped `AGENTS.md` files before editing.
2. Work from current code. For each issue record: reproduction, root cause,
   player impact, reachability, and proof that the fix closes the cause.
3. Correctness and player property (save data, money, paid benefits) outrank UX,
   content, performance, and cleanup.
4. Use `weeksLived` for absolute time and `weeksInThisLife(state)` for progress
   since the current life began. `week` is display-only.
5. Every life-affecting random result on the tick must be deterministic and
   life-salted. Never add `Math.random()` or wall-clock IDs to saved tick output.
6. Every weekly subsystem is exception-isolated and must never mutate state in
   place. Money changes use the canonical money action/conservation path.
7. A new persisted field requires a schema decision, migration, repair default,
   test factory update, save/load tests, and a stated downgrade/rollback story.
8. Never “fix” a failing analyzer by suppressing it. Tighten false-positive
   logic or fix the root cause.
9. No paid feature may be advertised before its real unlock path and restore path
   are verified. No consumable transaction is finished before its grant is durable.
10. The UI reads the same authoritative calculations the tick uses. Do not copy
    economy, decay, benefit, level, price, or probability formulas into screens.
11. One primary action per viewport, 44pt targets, semantic colors, useful
    disabled reasons, Dynamic Type, screen-reader labels/order, and web keyboard
    support are acceptance criteria.
12. Keep features offline-first. Network failure must not block Next Week, local
    saves, or owned entitlements previously verified on device.

---

## 5. Definition of done for every slice

A slice is not done until all are true:

- An observable player problem and success metric are written first.
- The current behavior is reproduced with a focused test or instrumented trace.
- The smallest authoritative domain layer is changed; UI is only a consumer.
- Empty, loading, error, locked, maxed, broke, dead, offline, and double-tap
  states are considered.
- Economy impact declares source, sink, cap, cadence, and exploit analysis.
- Save impact declares schema/default/migration/repair/test-fixture behavior.
- Determinism, week-loop complexity, and cross-system side effects are reviewed.
- Unit/integration/render tests cover the change and fail against the old bug.
- A real journey is exercised at phone width; perceptible UI changes are captured.
- Copy says exactly what is granted, charged, lost, timed, or unlocked.
- Relevant audit, type, lint, route, content, and full-suite gates pass.
- The report links evidence, records unresolved risks, and updates lessons.

---

## 6. Phase 0 — close 2.13.0 before starting feature work (P0)

**Goal:** protect the release candidate from unrelated scope.

1. Confirm the work is on the intended branch and based on current `main`.
2. Trim/approve the 2.13.0 store “What’s New” block.
3. Dispatch the iOS release workflow from merged main and observe the first run
   that executes preflight inside the production EAS environment.
4. Confirm binary version/build identity and archive the build URL/result.
5. On physical iOS and Android devices test:
   - fresh install, update install, relaunch, background/foreground, offline;
   - buy gems, Revival Pack, subscription; restore; kill during purchase; relaunch;
   - Spark/Pulse cancellation confirmations;
   - death → new life, death → revival, wedding continuation;
   - VoiceOver/TalkBack and largest Dynamic Type on Home, Apps, Bank Pro, death;
   - all eight historically-small targets.
6. Ask the reporting tester to retest every 2.12.0 report on the new binary.
7. If a blocker appears, patch only the blocker, bump the binary version as the
   runbook requires, repeat the affected matrix, and do not mix in Program 18.

**Exit:** release evidence exists; no known P0/P1; owner explicitly says ship or
hold; post-release items are not disguised as release blockers.

---

## 7. Phase 1 — fresh forensic baseline and scorecard (P0, 1–2 days)

1. Run the five-domain weekly audit and full preflight.
2. Run the full Jest suite, app/test type checks, lint ratchets, route/content/
   live-ops checks, performance suite, deterministic replays, and save/load soaks.
3. Export iOS/Android/web bundles; record environmental limitations honestly.
4. Inventory routes, applications, modals, weekly subsystems, money writers,
   random sources, save fields, migrations, feature flags, analytics, and remote
   dependencies with scripts—not hand-counts where automation is possible.
5. Execute four 30-minute walkthroughs: new/confused, optimizer, story player,
   and accessibility-first. Record every dead tap, surprise, lie, interruption,
   and unclear recovery route.
6. Simulate representative lives at 5/20/50/100/250 weeks. Measure deaths,
   bankruptcies, stat clamp time, wealth, choice/event cadence, repeated content,
   relationship diversity, and time per tick.
7. Create the baseline scorecard:
   - crash-free sessions and week-advance completion;
   - time to first meaningful choice / first consequence / recovery;
   - event choice and arc-completion rates;
   - percentage of time each vital is clamped at 0 or 100;
   - P50/P90 tick duration and save duration;
   - unique systems used by week 20/50/100;
   - D1/D7/D30 retention when analytics data is available;
   - purchase success/restore success and support contacts per transaction.

**Deliverable:** `tasks/program-18-baseline-YYYY-MM-DD.md` containing commands,
results, evidence, severity, confidence, and top three next actions.

---

## 8. Phase 2 — trust and data safety (P0/P1, 1 sprint)

Execute before new monetized or schema-heavy features:

1. Null-guard and test legacy migration array loops; prove the save reaches the
   current version on the second load and does not discard valid neighbors.
2. Design and implement a two-phase new-life carry-over record: pending → old
   slot deletion → committed/consumed, with idempotent recovery after a crash at
   every await boundary.
3. Persist pending consumable grants before finishing store transactions; test
   purchase delivery, redelivery, restore, mixed products, duplicates, and
   storage failure on RevenueCat and native fallback paths.
4. Model entitlement state as unknown / verified-active / verified-inactive /
   stale, so launch-time network failure cannot revoke a known purchase.
5. Decide and encode per-life/per-lineage claim semantics for live ops, chapters,
   daily rewards, and prestige.
6. Defer queued alert handlers until the presenting modal has actually dismissed;
   cover nested and teardown-producing handlers.
7. Add fault-injection integration tests for every save/write/delete/restore step.
8. Write a player-facing recovery route and support diagnostic bundle that does
   not include sensitive life choices or secrets.

**Exit:** no tested crash point loses paid property or corrupts the only save;
every operation is idempotent; recovery behavior is documented.

---

## 9. Phase 3 — honesty and complete-loop sweep (P1, 1–2 sprints)

Prioritize “the UI says it works but it does not” over new features.

### Shared prerequisites

- Fix banking interest writers and use them in cross-system summaries.
- Fix stock previous-close and authoritative-price ownership.
- Fix Pulse scandal type mapping and Spark reply/personality mapping.
- Seed every new Hustle company into its tick overlay.
- Replace duplicate display formulas with domain selectors.
- Establish shared creator-level and creator-membership modules.

### Per-system completion order

1. **Spark:** jealousy resolution surface, unblock future events, lifetime stats,
   real premium Likes You inbox.
2. **Contacts:** interaction recency, Attention triage, IOUs/repayment, favor tick.
3. **Bank:** conserved savings-goal transfers, own-account transfers, real interest
   totals, budgets/alerts, honest fee/reward copy.
4. **Stocks:** make bounded sector/macro movement persist to tradeable price;
   watchlist; yearly dividend reset; catalogue balance.
5. **Pets:** converge on the real decay/care engine; reconcile toy data and death
   thresholds; surface vaccination and trait effects.
6. **Education:** choose 2–3 classes, make exams/bonuses/semester number real,
   add a bounded study-group loop.
7. **Hustle:** companies enter the tick, hires affect bounded productivity,
   milestones record, campaigns do not disappear on pause.
8. **Real estate:** expose decor/rooms/upgrades in Manage, write a capped activity
   timeline, remove duplicate rent assignment.
9. **YouVideo + Streamly:** shared level curve and membership model; real live
   state/viewers; bounded creator income.
10. **Mining:** authoritative yield estimate, manual repair, atomic affordability,
    auto-repair toggle.
11. **Travel:** destination-specific event pools and benefits mapped only to real
    stats; passport milestones.
12. **Vehicles:** template-specific specs, financed-purchase reputation parity,
    insurance copy, seeded accidents/total loss with fair warning.
13. **Politics:** perform the missing audit, then implement only evidence-backed
    fixes; do not port the Pulse/Hustle scandal design without domain analysis.

**Exit:** no Tier-A deceptive-value item remains; every visible metric has a
producer; every action has a consequence or is removed.

---

## 10. Phase 4 — core balance, recovery, and fair failure (P1, 1 sprint)

1. Decide happiness saturation using measured lives. Compare: current cap,
   diminishing positive gains, higher-cost maintenance, and a separate meaning/
   fulfillment axis. Do not add a stat until it creates decisions.
2. Rebalance ad-orb vitality: once-per-week, shared gain curve, clear cap, and no
   survival state that strongly pressures ad viewing.
3. Give contact calls an opportunity cost (energy, a limited weekly social-action
   budget, or diminishing returns), without making social play punitive.
4. Prototype student-loan deferment while enrolled and transparent repayment
   afterward; test lifetime cost and education ROI across personas.
5. Smooth Chapter 2 rewards and choose lineage-aware chapter-gem semantics.
6. Add event pity/arc guarantees only after measuring the interruption budget.
7. Define fair-failure contracts for homelessness, illness, job loss, business
   failure, repossession, crime, divorce, injury, and death: warning → cause →
   options → consequence → recovery.
8. Run economic, survival, relationship, event, and shock personas before/after.
   Reject a change that merely moves hardship to an unmeasured cohort.

**Exit:** no ordinary strategy becomes a money printer; new players can identify
and recover from their first crisis; optimizer and story personas both retain
meaningful trade-offs.

---

## 11. Phase 5 — connected stories and world memory (P1/P2, 2 sprints)

Build cross-system consequence chains from existing systems:

1. Spark milestones can create optional Pulse posts; social response affects
   relationships, not just follower counts.
2. Writing/video/marketing skills provide a bounded, once-per-week creator boost.
3. Pulse fame gives bounded YouVideo/Streamly reach; creator scandals can affect
   employment, partners, sponsors, and reputation.
4. Macro conditions coherently affect bank rates, stocks, real-estate demand,
   company revenue, and hiring—one modifier per system with explicit clamps.
5. Education choices unlock differentiated careers and networks rather than only
   a salary multiplier.
6. Family, friends, pets, property, vehicles, and businesses appear in memories,
   anniversaries, inheritance, obituary, and legacy recap.
7. Implement 3–5 authored arcs with setup/escalation/resolution/aftermath, each
   with at least two domain crossings and multiple viable endings.
8. Add an inspectable “Why did this happen?” explanation from the same causal
   ledger used by the tick.

**Exit:** a 100-week life produces a coherent summary containing remembered
choices and consequences, not only balances and achievements.

---

## 12. Phase 6 — midgame, endgame, and generational replay (P2, 2–3 sprints)

1. Audit decision density at weeks 50–250; identify where progression becomes
   passive accumulation.
2. Add capstone decisions to careers, degrees, relationships, creator careers,
   companies, politics, crime, collections, and property portfolios.
3. Make prestige/legacy offer strategic trade-offs: inherited advantage paired
   with obligations, reputation, rivals, family expectations, or world state.
4. Create lineage goals and a family timeline, but prevent repeated bounded
   rewards from compounding into an exploit.
5. Add late-life planning: retirement, succession, wills, caregiving, philanthropy,
   reputation, and unfinished-arc closure.
6. Improve obituary/legacy comparison with opt-in local records; no manipulative
   global leaderboard is required.
7. Ensure every starting scenario changes at least three of: constraints,
   opportunities, social context, risk, objectives, or available recovery.

**Exit:** starting a second life changes the strategy and story; a long life has
meaningful decisions after wealth and career ladders plateau.

---

## 13. Phase 7 — UX, accessibility, and platform parity (continuous; formal sprint)

1. Re-audit every route at 360/390/430 widths, largest font, light/dark, reduced
   motion, offline, and empty/max/critical states.
2. Preserve one lead action per viewport and collapse secondary metrics behind
   progressive disclosure.
3. Verify minimum targets, focus order/restoration, labels/hints/values, modal
   escape, non-color status communication, contrast, and haptic alternatives.
4. On web, verify keyboard navigation, visible focus, pointer hover, browser back,
   responsive desktop width, save behavior, and unsupported purchase messaging.
5. On Android, verify system back, edge-to-edge/safe areas, TalkBack, purchase
   restore, low-memory relaunch, and representative low-end performance.
6. On iOS, verify VoiceOver, Dynamic Type, Reduce Motion, StoreKit flows, modal
   presentation, safe areas, and background/termination recovery.
7. Add automated render/accessibility contracts where possible; retain device
   checks for behaviors automation cannot prove.

**Exit:** parity matrix is attached to the release; known platform exceptions are
intentional, explained, and do not affect save or purchase integrity.

---

## 14. Phase 8 — architecture and performance runway (P2, incremental)

1. Instrument the week loop by subsystem and report P50/P95/P99 duration, state
   size delta, and failures without recording private choice content.
2. Define explicit preconditions/outputs for each `apply*` subsystem and test
   order dependencies. Move toward a typed tick result/ledger, not a rewrite.
3. Continue replacing broad `useGameState()` subscriptions with selectors for
   proven hot components; measure renders before and after.
4. Bound all player-growing arrays (posts, messages, contacts, memories, history,
   transactions, events) with documented retention policies.
5. Audit nested loops over NPCs, holdings, diseases, properties, posts, and
   companies. Add size-based performance tests before optimization.
6. Split giant modules only along established domain boundaries, keeping public
   actions stable and avoiding a high-risk state-management rewrite.
7. Burn down lint/UI ratchet debt without raising ceilings or mixing mechanical
   cleanup into balance changes.
8. Contract-test feature flags and platform/native-module fallbacks.

**Exit:** a 250-week, content-rich save stays within the agreed tick/save/render
budgets on representative Android hardware and remains deterministic.

---

## 15. Phase 9 — retention, live ops, and ethical growth (P2/P3)

1. Define the event taxonomy before adding analytics: onboarding, meaningful
   choice, consequence, recovery, week advance, session return, feature discovery,
   purchase attempt/result/restore, and technical failure.
2. Never log free-text choices, names, relationship details, health details, or
   save payloads. Document retention and consent by platform.
3. Build dashboards for funnels and cohorts, not vanity event counts.
4. Establish a content pipeline with schema validation, preview, deterministic
   simulation, localization readiness, start/end timezone rules, rollback, and a
   compiled-in runway.
5. Use weekly/community challenges that respect offline play and are not required
   for survival or permanent progression.
6. Rotate existing underused content only after proving reachability and variety.
7. A/B test presentation and pacing, not hidden economic disadvantage.
8. Add store-review prompts only after a genuine success moment and enforce a
   respectful cooldown.

**Exit:** D1/D7/D30 questions are answerable; content can ship and roll back safely;
growth features preserve consent and game fairness.

---

## 16. Prioritized feature backlog after loop completion

### Now — highest leverage

1. Save/purchase transactional recovery.
2. Native release/accessibility matrix.
3. Honest banking and stocks.
4. Spark jealousy + Contacts recency.
5. Pet care-engine convergence.
6. Creator levels/live status.
7. Education semester loop.
8. Event arc/interruption telemetry.

### Next — deepen existing fantasy

9. Banking: living credit-card loop with rewards only on repaid principal.
10. Mining: expose upgrades, pools, energy, automation, and staking within the
    existing income cap.
11. Pulse: deterministic bounded NPC replies/reposts and scandal aftermath.
12. Hustle: board governance for IPO companies.
13. Travel: living businesses with symmetric boom/bust risk and divestment.
14. Vehicles: seeded used-car market and trade-in capped by resale value.
15. Real estate: commercial property and tenant/renovation stories.
16. Relationships: shared finances, boundaries, caregiving, co-parenting, and
    reconnection arcs with consent-aware writing.
17. Career: workplace relationships, mentorship, burnout, layoffs, negotiation,
    professional reputation, and lateral transitions.
18. Health: preventative care, treatment adherence, insurance clarity, aging,
    disability-safe paths, and recovery narratives.
19. Crime/politics: investigation, evidence, public trust, rivals, consequences,
    and legitimate exits—not only escalating reward ladders.

### Later — new strategic horizons

20. Retirement, wills, inheritance obligations, and succession.
21. Neighborhood/world evolution driven by deterministic macro state.
22. Optional cloud backup/account recovery with conflict resolution.
23. Remote authored story packs with signed schemas and rollback.
24. Local challenge seeds and privacy-safe shareable life summaries.
25. Localization infrastructure and cultural content review before adding markets.
26. Tablet/foldable layouts after phone hierarchy is stable.
27. Modding/user-generated content only after moderation, schema security, and
    save isolation are designed.

### Explicitly defer

- Synchronous multiplayer, public free-text feeds, and chat.
- A second state-management rewrite.
- New currencies or subscriptions before existing monetization is fully honest.
- AI-generated live story content without safety, determinism, cost, privacy,
  offline, and save-compatibility designs.
- Huge new systems whose closest existing system is still unreachable.

---

## 17. Decision log template

For every owner decision, append:

| Date | Decision | Options considered | Chosen rule | Why | Revisit trigger |
|---|---|---|---|---|---|
| YYYY-MM-DD | Example: chapter rewards | per-life / per-lineage | TBD | economy + replay | after persona data |

Required early decisions: release priority, primary audience/tone, web support
level, irreversible consequence boundary, happiness saturation, ad-orb balance,
student-loan deferment, per-life/per-lineage rewards, cloud/backend scope, and
release cadence.

---

## 18. Required verification commands

Run focused tests throughout, then the full matrix before declaring the program
complete. Record exact exit codes and counts.

```bash
npm run check:routes
npm run type-check
npm run type-check:tests:ratchet
npm run lint:errors
npm run lint:ratchet
npm run ui:ratchet
npm run check:content
npm run check:liveops
npm run audit:weekly:full
npm run test:performance
npm run preflight
npx jest --ci
```

Also run the relevant opt-in persona/determinism/save-load soaks with their
documented `RUN_*` flags. A skipped soak is not a pass. If the environment cannot
run a native/device gate, label it **NOT EXECUTED — DEVICE/OWNER REQUIRED** rather
than inferring success.

---

## 19. Final report format

The implementation agent must finish with:

1. **Verdict:** GREEN / YELLOW / RED and the exact reason.
2. **Baseline versus after:** metrics and regression deltas.
3. **Findings:** severity, reachability, reproduction, root cause, player impact.
4. **Changes:** one row per slice, files, tests, save/economy/determinism impact.
5. **Journey evidence:** phone screenshots and native device matrix.
6. **Economy proof:** source/sink/conservation/caps and persona outcomes.
7. **Save/purchase proof:** migrations, fault injection, restore/idempotency.
8. **Performance proof:** tick/save/render percentiles and state growth.
9. **Accessibility proof:** VoiceOver/TalkBack/Dynamic Type/keyboard/targets.
10. **Open risks:** OWNER, POST-RELEASE, or BLOCKER—never vague “future work.”
11. **Top three next actions:** ordered by impact, confidence, effort, and risk.
12. **Decision log and lessons:** update both before handoff.

The final standard is not “many files changed.” It is: **the player trusts the
game, understands the consequences, wants to advance one more week, and can begin
a genuinely different next life.**
