# UI Overhaul Master Program 4 — ASYMMETRY + EDITORIAL HIERARCHY — IN PROGRESS

Branch: `claude/ui-hierarchy-asymmetry-pass-fwqtue`. Programs 1 and 3 are on
`main` (PRs #182, #183). **Program 2 (asymmetry / hierarchy) was briefed and
never implemented** — confirmed: no commit on any branch carries it, the only
mentions are the two "never landed" notes in `tasks/phone-apps-audit.md` and
this file. This program applies that missing judgement to the CURRENT tree.
It does not redo Program 1, undo Program 3, or start another
component-standardization pass. Rules and scales: `tasks/ui-hierarchy.md`.

Auto-safe classes: PURE LAYOUT / VISUAL STYLE / CONTENT PRIORITY / COPY.
Everything that changes what a player can do, what it costs, or what is saved
is out of scope and is called out per screen below as "behaviour: none".

## Phase 1 — repository state (done)
- [x] Program 1 present (Card, StatBreakdownModal, BaseModal, HUD/Home/Work/launcher rebuilds, ui:ratchet)
- [x] Program 3 present (AppHeader, StatStrip/StatTile, Chip, SectionTitle, ProgressBar, KeyValueRow, all 19 apps converted, launcher ErrorBoundary)
- [x] Program 2 missing (no asymmetry work anywhere; every screen still distributes weight evenly)
- [x] `node_modules` installed; baseline web export + screenshots captured for the walkthrough

## Phase 2 — audit findings (done; four independent read-only passes)
- HUD: four saturated fills of equal weight (green cash, indigo gems, blue date, green Next week) → nothing wins; gems (premium currency) reads equal to cash; a value-graded stat colour is computed and never rendered (`TopStatsBar.tsx:245`, comment claims otherwise) so a critical vital looks like a full one apart from the arc.
- Home: IdentityCard is a permanent centred hero (80pt avatar, 2xl name) regardless of state, followed by 4–6 identical list rows of reference data; GoalsCard's three rows are identical in weight though its first row is by construction "the one that matters now"; the lead of the feed never changes with player state.
- Work: no dominant element in any state; hero salary (12.5) is smaller than every list card's (16); the employed job renders twice (hero + its own list card); the hero has no action; screen chrome ("Work", 22/800) is the largest type; `workScreenStyles.ts` has 574 keys of which **7 are used** — 567 dead, 122 of them raw `fontSize` literals (a third of the app-wide 368).
- Health: 14 identical cards; when SICK the three cures are cards 5/7/8 below "Walk in park"; the issues card has the lightest heading on the screen.
- Market: three identical sections; a hungry/low-energy player gets no emphasis on food; a rental row title (18) outranks its section header (17).
- Progress: 50/50 split "hero" (Prestige | Legacy Pass) identical for a pre-prestige player and a level-5 dynasty; achievements completion printed three times.
- Onboarding: MainMenu has a real 48→21→20→17→13→10 ladder (keep). The three wizard screens put a static 24pt header above a 20pt raw-literal CTA above 18pt content — chrome wins.
- Phone apps: 10 of 19 open `banner → StatStrip(3) → SectionTitle → uniform rows`; only Education, Garage and Pulse let state pick what shows first. Weakest five: Crypto, Stocks, Statistics, Luxury, Travel.

## Phase 3 — scales (done: `tasks/ui-hierarchy.md`, tokens in `lib/config/hierarchy.ts`)
- [x] Four-tier weight scale; five-step rhythm scale from `responsiveSpacing`; hierarchy rules

## Phase 4 — main screens (each its own commit; each verified before the next)

| Screen | Problem | Dominant element | State that picks it | Axes | Yields space | Behaviour |
|---|---|---|---|---|---|---|
| HUD | 4 saturated blocks, gems = cash | **Next week** — the only saturated fill | always (primary action) ; a critical vital's number goes danger-red | colour + weight | date box → neutral surface; gems chip → outline; cash chip → neutral surface, white value | none |
| Home | permanent centred identity hero; 3 equal goal rows | **the lead slot**: prestige CTA → urgent tip (health/happiness/energy/money critical) → goal lead row | `isPrestigeAvailable` / `useContextualTip` / GoalsCard row 1 | scale + position + density | IdentityCard → compact left-aligned strip (avatar 48, name, job · status, net worth); its 4–6 reference rows fold into the existing Details disclosure, cash-flow stays visible | none |
| Work | hero without action; job rendered twice; chrome biggest | employed: **the current job hero with its one action** (Promote when eligible, Manage otherwise) ; unemployed: the job board with the lead section open | `canPromote` / `isEmployedHere` / `!currentJob` | scale + position + colour (one CTA) | the employed job's duplicate list card; the 3 local 18pt raw headers → `SectionTitle`; 567 dead style keys | none (same `promoteCareer` / manage sheet) |
| Health | cures buried 5th/7th/8th when sick | sick: **Treatment** (issues + the three cures) leads; healthy: vitals lead | active diseases / critical vitals | position + scale + colour(danger) | cures leave the activities list while promoted (no duplicate) | none |
| Market | hungry player sees Items first | low energy: **Food** leads; else Items | `stats.energy <= 20` (same threshold as HealthIssuesCard) | position + one lead line | housing row title 18 → 16 | none |
| Progress | 50/50 hero, state-invariant | **Prestige** full-width lead; Legacy Pass supporting row | `prestigeAvailable` / claimables promote the sub-line | span + scale | half the hero row | none |
| Onboarding | 24pt static header > 20 CTA > 18 cards | the **CTA** (already the only saturated element) | — | scale | header title 24→18; CTA raw 20 → `fontScale(17)` | none |

- [x] 4.1 HUD
- [x] 4.2 Home (lead slot + IdentityCard strip + GoalsCard lead row)
- [x] 4.3 Work
- [x] 4.4 Health
- [x] 4.5 Market
- [x] 4.6 Progress
- [x] 4.7 Onboarding chrome + shared `ScreenHeader` title to Tier 2

## Phase 5 — phone apps (weakest five only; landing chosen by state, Garage/Education pattern)
- [x] Luxury lands on Collection when anything is owned (Garage rule)
- [x] Stocks lands on Portfolio when holdings exist
- [x] Statistics: net-worth hero first, vitals rings demoted below it
- [x] Crypto lands on the rig console when a rig is running
- [x] Travel lands on the trip when one is in flight

## Phase 6 — primitive gaps (only where hierarchy needs them)
- [x] Button: NOT created — the one primary per screen uses the existing GradientButton; quiet secondary actions use `Chip size="md"`. Recorded in `tasks/ui-hierarchy.md`.
- [x] Chip disabled: NOT added — Spark's gated option chips are the only case and are local by design.
- [x] AppHeader wordmark: NOT added — competes with the screen's dominant element; Spark/Pulse keep their own.
- [x] `StatTile` `hero` stays the one headline-number treatment; no new variant.

## Phase 7 — raw typography
- [x] Delete the 567 dead `workScreenStyles` keys (122 raw sizes) and move the survivors to Tier tokens
- [x] `OnboardingFloatingButton` raw 20 → scaled; `PrestigeStatsCard` raw literals only where they compete (leave the rest — ratchet, not sweep)
- [x] Lower `rawFontSizes` ceiling in the commit that earns it

## Phase 8 — responsive + accessibility
- [ ] 360pt / 390pt / 430pt captures; Dynamic Type via `maxFontSizeMultiplier` on every new Tier-1 text; labels on every new pressable; reduced motion untouched

## Phase 9 — walkthrough (web export + Playwright, fresh save; state variants via render tests)
## Phase 10 — red team + scores + final report (`tasks/ui-hierarchy.md` §Report)

## Verification per phase
`npm run type-check` · `type-check:tests` · `lint:errors` · `lint:ratchet` · `ui:ratchet` · `check:routes` · targeted Jest; full `npm test` + `npm run preflight` before the final report. No ceiling raised, no test skipped.

---

# UI Overhaul Master Program 3 — THE 19 PHONE APPS — IN PROGRESS

Audit + design matrix + owner decisions: `tasks/phone-apps-audit.md`.
Program 1 blueprint: `tasks/ui-overhaul-blueprint.md`. Program 2 (asymmetry) was
briefed but **never implemented or merged** — nothing on `main` carries it, so
this program builds on Program 1's primitives only.

Auto-safe classes: PURE LAYOUT / VISUAL STYLE / NAVIGATION STRUCTURE. Everything
that changes what a player can do, what it costs, or what is saved is a
PROPOSAL, not a change.

- [x] Phase 1 — Inventory all 19 apps (entry, LOC, header, tabs, lists, modals, primary action, empties, shared vs local, noise, a11y)
- [x] Phase 2 — Group by purpose + design matrix (audit doc §2–3)
- [x] Phase 3 — Shared patterns: headers ×24, tab bars ×21, stat tiles ×30+, chips ×20+, hero recipe ×14, empties ×9 bespoke, modals ×16 raw
- [x] Phase 4 — Shared primitives (convergence, no forks): `AppHeader` (back + title + right chip), `StatStrip`/`StatTile`, `Chip`, `ProgressBar`, `SectionTitle`, `withAlpha`; `SegmentedControl` gets `scrollable`; `EmptyState` adopted; ErrorBoundary once at the launcher
- [x] Phase 5 — Owner decisions written up as PROPOSALS (Vehicle+Luxury, Gaming+Streaming, one Bank; prestige shop tabs assessed) — NOT implemented
- [x] Phase 6 — High-traffic apps: Bank (hero 9→3 numbers, banners off the list), Stocks (Trade CTA reachable from list, Portfolio grid → hero), Spark (5→3 actions, 11 stats → 4, tab double-count), Pulse (one compose, one header, one tab bar), Contacts (Network hero 6→2), Education (card = Study only), Pets (stage diet, 44pt tiles), Hustle (FAB demoted, segment → SegmentedControl)
- [x] Phase 7 — Remaining apps: Crypto (row = one tap), Real Estate (Details btn gone, KPI 6→3, fake gradient), Dark Web (VIEW gone, in-body backs gone), YouVideo (Channel 12 cells → 3), Streaming (one Go Live, one category grid), Travel (tab a11y, boarding-pass chrome), Political (4 CTAs → 1 + list), Statistics (duplicates gone), Vehicle (fleet card = one tap), Luxury (Details gone, Buy/Acquire → Buy)
- [x] Phase 8 — Header + tab convergence across all 19 (AppHeader + SegmentedControl), tabs get role="tab"
- [x] Phase 9 — Launcher hierarchy audit (grid order, badge policy, locked disclosure)
- [x] Phase 10 — Copy pass: one verb per action (Buy not Acquire, Repair not Restore it), no marketing blurbs
- [x] Phase 11 — Empty / error states on the shared EmptyState; ErrorBoundary parity (Pets, Hustle, Travel, Statistics, Luxury, YouVideo, Streaming were unwrapped)
- [x] Phase 12 — A11y + 360pt: unlabeled cash chips labeled, sub-44pt targets raised, tabs a11y-labeled
- [ ] Phase 13 — Regression: type-check, type-check:tests, lint:errors, lint:ratchet, check:routes, ui:ratchet, npm test, preflight; ratchets lowered where earned, never raised
- [ ] Phase 14 — Red team + 13-category scores + 21-item final report (audit doc §9–10)

---

# UI Overhaul Master Program 1 — IN PROGRESS

Blueprint: `tasks/ui-overhaul-blueprint.md` (full forensic audit + 8-phase plan).
Phase status — audit complete, implementation not started:

- [x] Phase A — Forensic audit (screens, navigation, design system, overlay layer)
- [x] Phase A — Redesign blueprint written (14 sections + metric ratchet table)
- [x] Phase 0 — Foundations: StatBreakdownModal chassis (7 modals → 1, −1,600 dup lines), Card/IconBubble primitives (9 rainbow cards → 1 neutral hairline), single stat-color source, dead-code deletion, ui:ratchet gate (gradients / raw font sizes / heavy weights) wired into preflight
- [x] Phase 1 — Kill the noise: interruption budget (≤2 budgeted grants per game week, player-initiated surfaces exempt), tutorial system fully retired (TutorialManager/SimpleTutorialModal/FirstWeekGuide/enhancedTutorialData/TutorialHighlightContext deleted; FirstSessionCoach is the one teaching surface), WeeklyResultSheet removed (LastWeekRecap + Week Summary switch), duplicate find-job CTA + no_job tip + HeroStrip removed, PremiumCrownButton off Home, Home's four visible={false} modals now conditional
- [x] Phase 2 — HUD de-clutter: savings chip folded into one money breakdown (BankBreakdownModal absorbed), gems gesture inversion fixed (tap=breakdown, +=buy), delta arrows + their 90-line prediction memo removed (projections live in the breakdown modals, now all reading computeHousingWellbeing), Help circle → Settings row, labeled flat 'Next week' button, HUD gradients flattened, dead parent week-dot animations removed
- [x] Phase 3 — Home rebuild: GoalsCard (top-3 objectives across chapter/challenge/live-ops/ambition/scenario/catalogue, same pure helpers, detail cards behind a Show-details disclosure), IdentityCard diet (Health Issues → Health screen, duplicate DailyGemClaim + avatar upsell crown removed, gradients flattened)
- [x] Phase 4 — Work rebuild: one promotion readout, ≤3-chip JobCards with fold, 16 button strings → 5, one crime-standing card + one cap line, identical-color gradient killed, InfoButton modals → subtitles
- [x] Phase 5 — Structure: one AppLauncher + shared catalog (computer 901→79 L, mobile 666→81 L, 28 tile gradients + marketing blurbs gone, locked apps behind one disclosure, pet id canonical), Market flattened to one sectioned list (tabs + filter bar + 5-emoji badge taxonomy removed, badges → 1), Gym moved to Health, Family = header action not fake segment, route dedup + one-door-per-room CI guard
- [x] Phase 6 — Progression: 12 modal booleans → one union, 9 tools → 5 (Your Story hub; paywalls out), duplicate achievements + prestige cards dropped, hero tap resolved to one destination that the label names. Onboarding: start ceremony extracted to useStartLife (Play now enters the game directly, no Perks detour), Ambitions dropped from the wizard (4 steps → 3; AmbitionPickerCard on Home covers it), appearance editor behind 'Edit look', locked perks behind a shelf, menu entrance ~1s → ~0.3s
- [x] Phase 7 — Sub-app pass: done as Master Program 3 (primitives + all 19 converted; the three merges are owner proposals in tasks/phone-apps-audit.md §5)

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
