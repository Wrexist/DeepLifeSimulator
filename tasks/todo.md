# Architecture-audit fix waves (2026-08-16) — waves 1–3 COMPLETE

Source: tasks/architecture-audit-2026-08-16.md. All landed on
claude/codebase-architecture-audit-dy6c5m, each batch verified before commit.
Final wave-3 combined tree: both type-checks, lint:errors, check:routes,
preflight, audit-save and audit-logic all green.

## Wave 1
- [x] C1 welcome-back exploit (v44) · C2 OTA check:routes · C3 audit matcher +
      8 mirrors · C4 factory scan + 25-cast burn-down · H3 real integration
      gate · H4 src/ typecheck · H1 discovery typed reads + lint closure ·
      H7a seeded payoffRoll

## Wave 2
- [x] H2 preflight eas.json env · H5 live boot-error surfacing · H9 ~6s cold
      start · M1/M2/M3 tick+action correctness · H8/L10 forceSave parity ·
      H6 lib boundary + eslint rule · M12 carve-out round-trip suite

## Wave 3
- [x] M4 narrow subscriptions (5 providers, root overlays; GameActionsContext
      deliberately kept — documented) · M5 useAchievements · M8 gem catalog +
      honest results · M11 mirror render-write · M16 tabs selectors
- [x] M7 formatMoney dedup (33 copies; fixed missing B/T tier, $-1.2M signs,
      $NaN) · M15 preview=Boring Build, iap/att opt-in, notifications flag
      deleted · M17 preview.tsx nested providers removed
- [x] M18 EventSpecial union · H7b 23 seeded payloads · H7c RNG consolidation
      (grandchildren copy deliberately kept — save-format)
- [x] M9 net worth · M10 getAge · M19 constants/order-book/stock registry
- [x] M13 zeroPreRolls (18 files + audit check) · M14 producer-matching
      detector + RealEstateActions NaN-fallbacks deleted · M20 nested audit
      walk (9 mirrors incl. settings.autoSave) · L3/L4/L16 dead code

## Remaining candidates (wave 4, not started)
- M6 cloud-sync half-wired path (route through the loadGame merge or delete)
- Raw Math.random in careerEvents/personalCrises/travelEvents/lifeEvents
  generate() (same class as H7b; personalCrises decides add_disease,
  careerEvents decides layoffs) · TravelActions sixth FNV copy
- LOW backlog: L1 weekCounters unused helpers, L2 lint-selector require
  bypasses, L5-L9 save-pipeline LOWs, L11 BUILD_TAG, L12 fix-podspec,
  L13 versionCode validation, L14 metro polyfill/entry export, L15 stock
  board module state, L17 ambition wasDue test, L18 doc drift
- Owner decisions queued: overdueBalance in the net-worth SUM; extending the
  DeepLife+ member gem drop gate (v40 note)
