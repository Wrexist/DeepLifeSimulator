# Active plan — architecture-audit fix wave 1 (2026-08-16) — COMPLETE

Source: tasks/architecture-audit-2026-08-16.md (fix order items 1–6).
All items landed on claude/codebase-architecture-audit-dy6c5m and verified
(type-check app+tests clean, check:routes, lint:errors, audit-save all clear,
54 targeted suites / 650 tests passing on the combined tree).

- [x] C1: Welcome-back bonus `settings.lastWelcomeBackWeek` gate (v44 carve-out,
      docs synced, round-trip + clock-farm tests).
- [x] C2: `check:routes` in `.github/workflows/eas-update.yml`.
- [x] C3: audit-save V11 assignment-based matching + 8 repairGameState mirrors.
- [x] C4: factory scan widened to all jest trees; all 25 raw `as GameState`
      casts converted or marked DELIBERATE-CORRUPTION.
- [x] H3: `test:integration` → real `__tests__/save` + `__tests__/integration`
      (36 suites / 404 tests); hollow saveLoad.test.ts deleted.
- [x] H4: `src/**` in tsconfig.typecheck.json (zero fallout, proven by diff).
- [x] H1: discoverySystem typed reads (9 of 20 systems were broken);
      `as unknown as … any` eslint bypass closed (descendant selector).
- [x] H7a: payoffRoll → seeded `makeWeeklyRoll` (Math.sin divergence closed).

## Next wave candidates (from the report's fix order, not started)
- H2 preflight reads eas.json profile env (before next release)
- H5 boot-error surfacing (dead earlyInitError / Metro screen)
- H8 forceSave protected-state embed; H6 lib→contexts inversions; H9 cold-start delay
- M1/M2/M3 tick+action correctness; M12 carve-out round-trip suite
- Noted during wave 1: `mark('relationships', …)` in discoverySystem is always
  true (initialState seeds Mom+Dad) — same over-credit class, left for next wave.
