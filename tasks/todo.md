# Analytics, Experimentation & Telemetry — COMPLETE

Shipped on `claude/deep-life-analytics-system-l44b7j`. Reference:
`docs/ANALYTICS.md` (taxonomy, funnels, dashboards, privacy review, limitations).

## Done
- [x] 1. `lib/analytics/context.ts` — common envelope (schema/app/build/platform/OS).
- [x] 2. `lib/analytics/validation.ts` — scrub, coerce, cap, opt-in de-duplication.
- [x] 3. `lib/analytics/experiments.ts` — registry with the question in the TYPE;
      deterministic FNV-1a assignment.
- [x] 4. `lib/analytics/ExperimentService.ts` — pinning against weight changes,
      exposure ≠ assignment, memoised envelope value.
- [x] 5. `lib/analytics/progression.ts` — stage ladder + engagement/monetisation segments.
- [x] 6. `lib/analytics/economySnapshot.ts` — sampled per-game-week rollup.
- [x] 7. `lib/analytics/featureAdoption.ts` + `featureRoutes.ts` — discovery vs return.
- [x] 8. `lib/analytics/debugBuffer.ts` — bounded `__DEV__`-only inspector.
- [x] 9. `lib/analytics/reliability.ts` — save_failed / save_repaired / app_startup.
- [x] 10. Events catalogue: type + runtime set derived from ONE array.
- [x] 11. Wiring — AnalyticsTracker (stage, economy, adoption), the two app
      launchers, `saveQueue`, `hydrateLoadedState`, `_layout` startup.
- [x] 12. 209 tests across 19 suites.
- [x] 13. `docs/ANALYTICS.md`.
- [x] 14. Red-team + second audit (findings below).
- [x] 15. `type-check`, `type-check:tests`, `lint:errors`, 1294-test regression run.

## Bugs found and fixed on the way
1. **Sensitive props reached Firebase unscrubbed.** Scrubbing ran on the way
   into the self-hosted queue only, so a receipt passed to `track()` left the
   device intact on the other sink. Now scrubbed once, before either.
2. **Event-name type and runtime Set were maintained separately** — "add to the
   type, forget the Set" type-checked and was silently dropped at runtime.
3. **Property caps exceeded Firebase's 25-parameter budget**, which is enforced
   by silently dropping the excess. Caps are now the stricter sink's.
4. **The experiment envelope string could truncate mid-pair** in a Firebase
   parameter, inventing an experiment id and an arm. Cut at a pair boundary.
5. **`screen_view` would have re-fired every week** once adoption was wired to
   the same effect. `weeksLived` is read through a ref.
6. **The de-dupe window leaked across `configure()`**, making a test pass for
   the wrong reason. `configure()` resets it.

## Deliberately NOT done (and why)
- **No experiment is registered.** Shipping the infrastructure and shipping a
  live experiment are different decisions; inventing one to demonstrate the
  plumbing would put a real behaviour change in front of real players.
- **No remote-config service.** It needs a validation layer designed first —
  this app's economy is gated on game state precisely because externally
  supplied and device-clock values have been exploitable here five times over.
  Its own change, not a rider on this one.
- **No per-source/per-sink economy attribution.** It needs a transaction
  ledger, which is a save-format change.
