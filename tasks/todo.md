# Plan — Live Operations (Master Program 10)

## Audit: what already exists
- `lib/challenges/weeklyChallenges.ts` — 12-challenge pool, multi-objective,
  rotates every 4 GAME weeks, per-life shuffle salt, reward granted atomically
  inside the week tick. Deliberately gated on `weeksLived`, not the device clock.
- `lib/offers/` — weekly IAP offer rotation, deterministic on a UTC week index,
  with a visible previous/current/next window.
- `lib/events/seasonalEvents.ts` — IN-GAME seasons (`weeksLived % 52`), not the
  real calendar. Christmas is an in-game week, not December.
- Daily login gems, welcome-back bonus, `applyWeeklyEvents` random events.
- `lib/analytics/` (M9) — envelope, experiments, funnels, feature adoption.

## Gaps
1. **No live event system.** No definition model, no lifecycle, no hub, no
   reward ledger. Every rotating thing is bespoke and compiled in.
2. **No remote content.** Nothing ships without an app update.
3. **Two bespoke rotations, no shared pool abstraction** (weight, cooldown,
   repeat prevention, eligibility).
4. **No live-ops analytics funnel.**
5. **No per-event kill switch or staged rollout.**
6. **No reactivation content** beyond a cash bonus.

## The one hard design decision
Windows are REAL time; progress and rewards are GAME state.
A scrubbed clock may change which event window you see (a shop window grants
nothing) but can never manufacture progress or re-claim a reward — claims are
recorded by event INSTANCE id in a persisted ledger. This is the only reading
consistent with the five STATE_VERSION bumps that exist to close clock exploits.

## Tasks
- [ ] 1. `lib/liveops/types.ts` — event definition + persisted player state.
- [ ] 2. `lib/liveops/objectives.ts` — compiled-in objective REGISTRY (remote
      content references ids; it never carries logic).
- [ ] 3. `lib/liveops/validation.ts` — definition schema, bounded rewards, date
      and version validation; drop bad events individually, never the payload.
- [ ] 4. `lib/liveops/schedule.ts` — UTC windows + the lifecycle state machine.
- [ ] 5. `lib/liveops/eligibility.ts` — stage / subscription / cooldown / repeat.
- [ ] 6. `lib/liveops/pool.ts` — the reusable weighted pool with cooldowns.
- [ ] 7. `lib/liveops/rewards.ts` — economy caps + idempotent claim ledger.
- [ ] 8. `lib/liveops/catalogue.ts` — the compiled-in fallback events (real content).
- [ ] 9. `lib/liveops/remote.ts` — fetch → validate → cache → fallback, kill switch.
- [ ] 10. `lib/liveops/state.ts` — save-state reader, degrades to empty.
- [ ] 11. `lib/liveops/analytics.ts` — the live_event_* funnel.
- [ ] 12. `contexts/game/actions/LiveOpsActions.ts` — the ONE atomic claim updater.
- [ ] 13. STATE_VERSION 49 + migration + types + createTestGameState.
- [ ] 14. Discovery UI: the hub + a home surface card.
- [ ] 15. Tests: time, offline, invalid remote data, duplicate claims, expiry,
      economy caps, save round-trip.
- [ ] 16. `docs/LIVEOPS.md` + the content calendar.
- [ ] 17. Red team + second independent audit; fix what it finds.
