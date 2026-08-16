# Architecture-audit fix waves (2026-08-16) — waves 1–4 COMPLETE

Source: tasks/architecture-audit-2026-08-16.md. All landed on
claude/codebase-architecture-audit-dy6c5m, each batch verified before commit.
Final wave-4 tree: both type-checks, lint:errors, check:routes, audit-save
(all clear), full preflight, and save/services/stress/startup (1285 tests)
all green.

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
- [x] M4 narrow subscriptions · M5 useAchievements · M8 gem catalog + honest
      results · M11 mirror render-write · M16 tabs selectors · M7 formatMoney
      dedup · M15 preview=Boring Build, iap/att opt-in · M17 preview.tsx ·
      M18 EventSpecial union · H7b engine payloads · H7c RNG consolidation ·
      M9 net worth · M10 getAge · M19 constants/order-book/stock registry ·
      M13 zeroPreRolls · M14 producer-matching detector · M20 nested audit
      walk · L3/L4/L16 dead code

## Wave 4
- [x] M6 cloud-sync safety: loadGame hardening extracted to
      utils/hydrateLoadedState.ts (shared by loadGame, the cloud-apply path
      with a weeksLived regression guard, and resolveConflict merge);
      CloudSyncService inert at import (explicit start()); sync deliberately
      NOT wired — needs identity + backend /save endpoints (see service
      header + README contract).
- [x] L5 saveGame repair no longer mutates prev in place · L6 single-clone
      load path (validateGameState skipRepair)
- [x] H7b follow-up: careerEvents/personalCrises/travelEvents/lifeEvents
      seeded (zero executable Math.random in lib/events) · TravelActions FNV
      deduped (bit-identity proven, output mapping preserved for saves)
- [x] L2 require-selector bypasses + 4 sites · L7/L8 mutex coverage ·
      L9 CESU-8 documented · L11 derived BUILD_TAG · L12 fix-podspec ·
      L13 BUILD_NUMBER validation · L14 metro polyfill + entry export ·
      L15 stock-board warnings · L17 ambition wasDue tests · L1 dead week
      helpers deleted · L18 doc drift

## Owner decisions (parked — change game balance/monetization; not made
unilaterally)
- Should overdueBalance arrears reduce the net-worth SUM? (key includes it;
  sum does not — comment at lib/progress/achievements.ts)
- Extend the weeksLived gem gate to the DeepLife+ member drop? (v40 note —
  retention decision)
- Wire cloud save-sync? Needs: real identity (sign-in), backend /save
  endpoints per README contract, server-side signature verification. Client
  is hardened and one start() call away.
