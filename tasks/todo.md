# Active plan — architecture-audit fix wave 1 (2026-08-16)

Source: tasks/architecture-audit-2026-08-16.md (fix order items 1–6).
No commits until orchestrator verification passes.

- [ ] C1: Welcome-back cash bonus — add `settings.lastWelcomeBackWeek` weeksLived gate
      (v44 carve-out: stub migration, NO backfill, NO repair mirror), gate spawn effect
      and grant updater, sync STATE_VERSION 44 across CLAUDE.md/DEV.md/WORKFLOW.md,
      add round-trip + gate tests.
- [ ] C2: Add `npm run check:routes` to `.github/workflows/eas-update.yml` before update steps.
- [ ] C3: audit-save V11 — stripNoise + assignment-based coverage matching; write the 8
      missing repairGameState mirrors (week, day, social, family, economy, goals,
      progress, prestige).
- [ ] C4: audit-save V6 — widen test scan to mirror jest testMatch trees.
- [ ] C4 burn-down: convert the 25 raw `as GameState` test states to createTestGameState.
- [ ] H3: repoint `test:integration` at the real save/integration suites.
- [ ] H4: add `src/**` to tsconfig.typecheck.json; fix fallout.
- [ ] H1: discoverySystem typed field reads; close the `as unknown as Record<string,any>`
      lint bypass.
- [ ] H7a: payoffRoll → seeded `makeWeeklyRoll`.
- [ ] Orchestrator: full verification (type-check, targeted suites, audit:weekly,
      preflight:quick), commit, push.
