# Plan — Analytics, Experimentation & Telemetry (Master Program 9)

## Audit findings (what already exists)
- `lib/analytics/` — typed event catalogue (47 names), crash-safe pure-JS batcher,
  consent + flag gating, prop scrubbing, AsyncStorage queue, Firebase fan-out.
- `lib/analytics/retentionCohort.ts` — install-anchored D-N cohorts, monotonic,
  `anchorEstimated` exclusion flag. Correct and well reasoned.
- Funnels present: session, onboarding, paywall/purchase, subscription lifecycle,
  offers, ads, goals, return summary.

## Gaps found (what this change fixes)
1. **No common event envelope.** Events carry only id/name/ts/installId/sessionId.
   No app version, build, platform, schema version → *no cohorting by release, and
   no way to tell a v2.9 regression from a v2.8 one.*
2. **No experimentation system at all.** Zero A/B infra: no assignment, no
   exposure, no guardrails. Every change ships unmeasured.
3. **No economy telemetry.** The most audited domain in the repo emits nothing.
4. **No progression-stage telemetry.** `week_advanced` only; no stage funnel, so
   "where does the mid-game flatten" is unanswerable.
5. **No feature-adoption telemetry.** Dead features are invisible.
6. **No reliability telemetry.** Save failures/repairs are logged, never counted.
7. **No performance telemetry.** Startup/save timings unmeasured.
8. **Weak validation.** Names are checked; property shapes, sizes, numeric
   sanity and duplicate suppression are not.
9. **No analytics debug inspector.**
10. **No documented taxonomy / dashboard spec / privacy review.**

## Tasks
- [ ] 1. `lib/analytics/context.ts` — common envelope (schema version, app version,
      build, platform, OS). Lazy, never throws.
- [ ] 2. `lib/analytics/validation.ts` — prop sanitisation, caps, numeric sanity,
      duplicate suppression key.
- [ ] 3. `lib/analytics/experiments.ts` — registry + deterministic pure assignment.
- [ ] 4. `lib/analytics/ExperimentService.ts` — persisted pinning, exposure
      tracking (assignment ≠ exposure), envelope contribution.
- [ ] 5. `lib/analytics/progression.ts` — pure player-stage classifier + segments.
- [ ] 6. `lib/analytics/economySnapshot.ts` — pure week-boundary economy rollup.
- [ ] 7. `lib/analytics/featureAdoption.ts` — first-use + repeat-use, persisted.
- [ ] 8. `lib/analytics/debugBuffer.ts` — dev-only ring buffer + inspector.
- [ ] 9. New events in `events.ts` (+ names set) for 1/3/5/6/7 and reliability.
- [ ] 10. Wire into `AnalyticsTracker.tsx` (stage edges, economy rollup) and
      the save pipeline (reliability) — no hot-path cost.
- [ ] 11. Tests for every new module + an envelope/taxonomy conformance test.
- [ ] 12. `docs/ANALYTICS.md` — taxonomy, funnels, dashboards, privacy review.
- [ ] 13. Red-team pass + second independent audit; fix what it finds.
- [ ] 14. `npm run type-check`, `type-check:tests`, `lint:errors`, targeted Jest.
