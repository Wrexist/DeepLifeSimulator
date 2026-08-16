# Architecture-audit fix waves (2026-08-16) — waves 1 & 2 COMPLETE

Source: tasks/architecture-audit-2026-08-16.md. All items below landed on
claude/codebase-architecture-audit-dy6c5m, each batch verified before commit;
final combined tree: both type-checks clean, lint:errors clean, audit-save all
clear, preflight passes on a clean checkout, tooling+save+startup 531 tests green.

## Wave 1 (fix-order items 1–6)
- [x] C1 welcome-back forward-clock exploit (v44 carve-out + tests)
- [x] C2 check:routes in the production OTA workflow
- [x] C3 audit-save V11 assignment-based matching + 8 repair mirrors
- [x] C4 factory scan widened; all 25 raw `as GameState` casts burned down
- [x] H3 test:integration → real save/integration suites
- [x] H4 src/** in tsconfig.typecheck.json
- [x] H1 discoverySystem typed reads + `as unknown as … any` lint closure
- [x] H7a payoffRoll → seeded makeWeeklyRoll

## Wave 2
- [x] H2 preflight resolves eas.json profile env (warn-not-fail for EAS-store-only
      secrets; NEW hard fail on Google test ad units in production)
- [x] H5 boot-error surfacing live (subscriber model); Metro dead code deleted
- [x] H9 cold start ~6s faster (readiness-driven; MIN_SPLASH_MS=600); bounded health poll
- [x] M2 tick failure actually aborts (no silent pre-tick save)
- [x] M3 relationship pass per-entry containment
- [x] M1 breakUp/moveIn stat deltas atomic in-updater
- [x] H8/L10 forceSave + quota-retry protected-state parity
- [x] H6 lib boundary: 3 symbols moved down, 2 sanctioned in place, eslint
      boundary rule over lib/** (documented in CLAUDE.md §5)
- [x] M12 carveOutRoundTrip.test.ts — all 14 carve-outs + 3 full envelope round trips
- [x] Discovery follow-up: seeded Mom/Dad no longer credit 'relationships'

## Wave 3 candidates (from the report, not started)
- M4 whole-state subscriptions (IAPHandler, AchievementToast, UIUXOverlay,
  provider stateRef pattern → useGameStateGetter)
- M5 useAchievements recompute; M7 formatMoney ×35; M8 gem catalog + false success
- M6 cloud-sync half-wired path; M9 net-worth consolidation; M10 age dual-source
- M11 render-phase mirror write; M13 zeroPreRolls adoption; M14 audit-logic G5
- M15 EAS preview profile flags; M16 tabs layout selectors; M17 preview.tsx
- M18 EventChoice.special union; M19 constants/order-book dedup; M20 nested audit walk
- H7(b/c) event payload seeded rolls + RNG consolidation; LOW items L1–L18
