# DeepLife "Flawless" Audit — full findings + fix tracker (2026-07-16)

7-agent game-wide read-only audit (core loop/save, mobile apps, computer apps, economy, life
systems, progression/meta, cross-cutting code health) + subagents. ~100 findings, each with
file:line + fix + repro. Fixing in verified batches (tsc 0 / eslint 0 / jest + 308 snapshots).

Invariants (required targets — some still violated, see the tracked items): `stats.money` canonical;
`banking.accounts` are mirrors; all money SHOULD route via `applyMoneyDelta` (six direct `stats.money`
writers remain tracked below); seeded weekly tick deterministic (no Math.random/Date.now — the
determinism cluster below tracks the remaining violations); new state additive/optional.

## ✅ DONE (landed)
- [x] Streaming/content hardening (5 CodeRabbit items) — NaN guards, ref-in-render, live-stream save checkpoint. (merged in #62, commit ee809e5)
- [x] Legacy-save crashes — sparkLogic scorePlayerProfile, OnionApp activeJobs, work.tsx crimeSkills. (merged in #62, dc3e337/59d2fe8)
- [x] Real estate: underwater sale no longer erases mortgage for free (keeps deficiency balance). (37a7e22)
- [x] Vehicles: underwater sale no longer erases auto loan for free (keeps deficiency balance). (e66ba7b)
- [x] Careers: CEO / investment banker / creative director unlockable (bad education IDs masters/bachelors → masters_degree/business_degree). (d551eb9)
- [x] Pulse Insights: engagement rate showed ~2000% (double ×100). (efa7659)
- [x] Save-slot data loss: currentSlot synced in loadGame (+ new-game via loadGame); deleteSlot repoints stale lastSlot/currentSlot markers; provider-level regression test. (2143dce)
- [x] Hustle money printers: seeded ROI variance kills the guaranteed marketing profit; candidate dedup + idempotent hire + 30-cap; named-hire payroll charged weekly. (295cee4)
- [x] FIRE + retirement 52x weekly-as-annual salary bug; savingsRate clamped 0-100. (e492c84)
- [x] Bank statement net worth cash double-count (mirror excluded via computeStatementNetWorth). (e492c84)
- [x] Spark Boost no-op (BOOST_MATCH_FLOOR 1.5x + immediate likedYou); swipe deck seekingGender filter; Pulse composer energy gate + surfaced errors; ComposeModal per-type energy cost; rewarded-ad boost reachable from populated notifications; Spark Premium annual toggle; match celebration partner photo. (ce49570)
- [x] Vehicle deficiency loans unsecured (vehicleId cleared, no collision with future purchase) + money finite-guard (Codex P2 + CodeRabbit). (ac07bc9)
- [x] Event chains: choiceId persisted on eventLog; invest/doctor branches reachable; 7 regression tests. (0907252)
- [x] Seeded-tick determinism: 7 sites (pulse earnings/trends/notifs, sparkTick likedYou, hustle notif timestamps, scandal comments, npc memory ids, exam/campus rolls) now seeded; determinism tests added. (2cdcfaa)
- [x] Daily-reward + work-action stale-save: saves persist the committed state (post-commit deferral; regression test). (e01e133)
- [x] Prestige re-grant farms: claimedAmbitions + claimedAchievementIds persist across prestige; payouts once-ever. (aa53e52)
- [x] Desktop lying/dead UI (7): repair price after insurance, travel preview honesty, record CTA cap, mining Buy at cap + marginal yield, stale For-sale page, IPO feedback, hire-refresh nonce. (1da86f0)

- [x] WAVE 4a — Seeded tick: education loans actually charge; mining auto-repair budget-limited; patents age+expire; non-BTC mining yields real (USD-normalized); limit/stop fills pay the 2% fee; Math.sin → makeWeeklyRoll (event roll + beginner luck); rent tick seeded; all 12 weekly challenges reachable. Snapshot regen owned+mapped (9 entries). (2e8f0cd)
- [x] WAVE 4b — Relationships wired: Spark→Pulse milestone auto-posts, 7 date tiers incl. free chat (display prices fixed), anniversaries fire (idempotent), lendMoney→favor Redeem loop, Spark profile editor with live strength meter. (4b9ae33)
- [x] WAVE 4c — Company/social UI: BrandDeals persistence, sponsor double-delivery, CreateCompany inflated-price+gates, DM clues honest+rewarding, board/suppliers seeded rosters, one-time policy copy, personalCrises dead insurance branch removed. (1fdc0f6)
- [x] WAVE 4d — Cleanup: gameBalance/tutorialData/appStoreOptimization/HobbyActions/relations/calculateActionImpact deleted (~1,100 lines), legacy achievements stubbed; prestige achievement fixes; autoSave NaN guards; cash_percentage implemented; autoPay/autoRenew honest copy; stateValidator + housing alert fixes. (40d9361)
- [x] origin/main (PR #63) merged in; full gate green over merged state (tsc 0, jest 3521, snapshots 308). (e2be38f)

- [x] WAVE 5a — Orphaned subsystems wired: mining Upgrades tab (upgrades/pools/staking/energy/automation), lobbyist hiring + alliances, credit-card charge/pay/redeem loop, family business entry + manage (atomicity fixed). (f099c69)
- [x] WAVE 5b — Tick economy/life-stage: asked rent realized (fill/churn lever, no-dominance sim), $150k rent cap, RentAndHousing NaN guard, stock capital-gains+dividend tax parity, commitment levels decay+rise, life-stage 3.5x event weighting, childhood pack re-banded 13-17. Zero snapshot entries changed. (9ba9e25)
- [x] WAVE 5c — Content depth + money polish: continuous quality curve, stock/crypto/realEstate/vehicle buys via applyMoneyDelta, NPC replies 9-12/pool + de-dupe, jealousy variants, pets 19 breeds/8 comps/treatmentCost billing, elder activities for FIRE retirees, 10 Legacy-Pass cosmetics, claimable milestone gems. (311ffc5)

## 🔴 CRITICAL — remaining

## 🟠 HIGH — remaining


## 🟡 MEDIUM — remaining (broken-UI "spend does nothing" / correctness)
- [ ] Lifestyle-cost sink shown in UI, never deducted. (lifestyle.ts:46)
- [ ] Chronic diseases (6) have no management loop despite "ongoing management" copy. (diseaseDefinitions.ts:179)

## 🟢 LOW / dead-code cleanup

## Notes
- PR #62 (playtest fixes + first crash/streaming fixes) is MERGED to main. Follow-up audit fixes are on
  branch `claude/vitals-ui-notifications-redesign-e3262m` restarted from main (new PR when opened).
- Seeded-tick items (marked) change the 308 snapshots — regenerate deliberately and verify the diff is
  only the intended path.
- 2026-07-16: two fix agents were interrupted by the weekly API rate limit (resets Jul 17); remaining
  batches resume after reset.
