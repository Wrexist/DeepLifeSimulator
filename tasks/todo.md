# UI Overhaul Master Program 1 — IN PROGRESS

Blueprint: `tasks/ui-overhaul-blueprint.md` (full forensic audit + 8-phase plan).
Phase status — audit complete, implementation not started:

- [x] Phase A — Forensic audit (screens, navigation, design system, overlay layer)
- [x] Phase A — Redesign blueprint written (14 sections + metric ratchet table)
- [ ] Phase 0 — Foundations: Card/Button/Text/IconBubble/StatBreakdownModal primitives, single stat-color source, lint guards, dead-code deletion
- [ ] Phase 1 — Kill the noise: interruption budget (≤2/tick), tutorial de-triplication, WeeklyResultSheet removal, paywalls 8→2
- [ ] Phase 2 — HUD rebuild (TopStatsBar → ≤7 readouts, labeled Next Week)
- [ ] Phase 3 — Home rebuild (unified Goals surface, IdentityCard diet)
- [ ] Phase 4 — Work rebuild (3-chip JobCard, button-state collapse)
- [ ] Phase 5 — Structure: one AppLauncher, Market flatten, route dedup
- [ ] Phase 6 — Progression + onboarding trim (Perks/Ambitions out of FTUE)
- [ ] Phase 7 — Sub-app pass (merge Vehicle+Luxury, Gaming+Streaming, one Bank)

---

# Live Operations — COMPLETE

Shipped on `claude/deep-life-analytics-system-l44b7j`. Reference: `docs/LIVEOPS.md`.

## Done
- [x] Event model, objective registry (logic compiled in; data references ids).
- [x] Validation: caps, dates, schema version, known objectives; drop per-event.
- [x] Lifecycle state machine + grace period; instance ids keyed on the parsed instant.
- [x] Eligibility: stage, life weeks, subscription (both ways), absence, cooldown, staged rollout.
- [x] Rewards: per-event caps, combined value cap, idempotent ledger, rolling weekly budget.
- [x] Compiled-in catalogue: 6 events across the stage range, all validator-clean.
- [x] Remote content: fetch → validate → cache → fallback, two kill switches.
- [x] The claim as a PURE reducer; reporting split from payment in the UI.
- [x] STATE_VERSION 49 + migration + carve-out round-trip row.
- [x] Discovery card on the home screen; no takeover, no permanent countdown.
- [x] Full analytics funnel + a static guard that every step has an emitter.
- [x] 125 live-ops tests; docs + content calendar + operating loop.

## Bugs found and fixed
1. **Instance ids were keyed on the raw date string** — three spellings of one
   instant gave three ids, so republishing an event with a reformatted date
   would have paid everyone who already claimed it a second time.
2. **`trackEventExpired` / `Progressed` / `Completed` had NO callers** — three of
   seven funnel steps were dead, so "did the work and never got paid" and "how
   many had it expire" were both unanswerable. Now emitted from a session
   observer, with a static test that fails CI if a step loses its emitter.
3. **Side effects inside a `setGameState` updater** — `track()` and `setRefusal`
   ran in the reducer, which React may invoke twice.
4. **FNV-1a avalanched poorly on its last byte** (M9 code) — `exp_a`/`exp_b`
   agreed 36% instead of 50%, so two concurrent experiments would not have been
   independent. Added the finalizer.
5. **`ExperimentService` re-hashed a stale pin** while its comment claimed it
   resolved to control — a mid-flight re-bucketing.
6. **The catalogue's returning event failed my own validator** (365-day window),
   which surfaced the real distinction between scheduled and evergreen kinds.
7. **`useLiveOps` was in `lib/`** and imported values from `contexts/`, which the
   layering rule caught. Moved to `hooks/`.

## Deliberately not done
- **No event hub screen.** Today it would be a screen with three rows.
- **No push notifications for events.** The card is a surface the player chooses
  to look at; the return loop should be worth returning to on its own.
- **No server-authoritative validation.** Caps, ledger and budget are enforced
  against the player's own save, so the blast radius is their own save.
