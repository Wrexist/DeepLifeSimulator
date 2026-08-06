# Active plan — whole-game audit: noise, UX polish, and the late-game roadmap

Owner ask: run several audits; make the game less noisy and confusing; add more
gameplay and late-game content to grind toward; audit UI/navigation/UX/design for
imperfections and asymmetry; make the app premium and easy to navigate; and
produce a ranked list of 10 features with pros and cons.

Findings: `tasks/game-audit-2026-08-05-findings.md`
Roadmap: `tasks/game-feature-roadmap-2026-08-05.md`

---

## Done in this pass

### Feedback channels — un-muted
- [x] `utils/toastBridge.ts` — module-level handle on the real toast channel
- [x] `feedbackSystem` routes to toasts, not the achievement popup (every
      message was being discarded by a `reward > 0` gate it could never pass)
- [x] `warning` toasts restored, defaulting to the bottom slot so the original
      status-bar overlap can't return
- [x] Toast stack offsets counted per position group
- [x] `SmartNotificationTicker` copy now travels with its buzz (was blocked *by*
      the feedbackSystem bug)
- [x] Deleted the dead duplicate `useToast` in `feedbackSystem.ts`

### Interruption noise — reduced
- [x] Ad orb: 3× slower cadence, no appearance haptic, moved below the MODAL
      layer (it was covering the weekly sheet and the death screen)
- [x] Premium promo: blocking guard added + re-checked at fire time
- [x] Contextual tips: real 12-week dismissal cooldown (was wiped every week)

### Correctness
- [x] Welcome-back bonus double-grant (gate→grant, §4.4)
- [x] "Ready to prestige" card now starts a prestige instead of opening a shop

### UI / polish
- [x] `BaseModal` theme-aware — it rendered dark chrome in light mode across all
      six HUD breakdown modals
- [x] 10pt legibility floor (7 sites, incl. 7.5pt on the paywall and three
      unscaled 8pt job badges)
- [x] `hitSlop` + a11y labels on 7 sub-44pt close buttons
- [x] Android back restored on 4 modals that swallowed it
- [x] Safe-area insets on the two Pulse bottom sheets under the home indicator

### Copy
- [x] 16 strings pointing at tabs that no longer exist → real paths

### Tests
- [x] `__tests__/utils/feedbackToastChannel.test.ts` (11) — channel reachability
- [x] `__tests__/onboarding/navigationCopy.test.ts` (4) — copy ↔ real tab set

**Gates:** type-check clean · test-tree ratchet 0 · lint 0 errors (1239 warnings
vs ceiling 1240) · routes OK · `audit:weekly` all green ·
**467 suites / 5,721 tests passing** (baseline was 465 / 5,706).

---

### Interruption queue — shipped
- [x] `contexts/InterruptionContext.tsx` — one priority queue, one winner.
      Replaces four independent chains that could not see each other and the
      O(n²) `&&` cascades they were built from. Declarative (claims derive from
      each surface's own `wants` flag), so nothing can wedge the queue by
      forgetting to release. Migrated: the four Home popups, the weekly result
      sheet, the premium promo, the ad orb.

### Navigation — shipped
- [x] Android hardware back exits an open sub-app instead of popping the tab
      stack (`useHardwareBack` existed and was wired into onboarding only)
- [x] The Progress screen's gate now agrees between Home and Life — plus the
      selector fields `unlockTier()` actually reads
- [x] `paw`/`pet` deep-link ids resolve in both launchers
- [x] Visible long-press affordance on vitals carrying quick actions

### Dynasty Tree — shipped (roadmap #2)
- [x] 6 upgrades / 340 points → 17 nodes across 4 branches with prerequisites,
      25 → 3,600, tree total ~8,700. No migration.
- [x] **Built the missing purchase UI** — `purchaseLegacyUpgrade` shipped with
      no screen calling it, so the whole currency was unspendable in the app

### Late-game features — 9 of 10 shipped, 1 partial
- [x] #1 Conglomerate — up to 3 companies per type at 2.5x escalating cost. A
      pure SINK: PER_SOURCE_CAPS.companies already caps company income at
      $200k/wk, which the five maxed originals exceed.
- [x] #2 Dynasty Tree — 6 upgrades/340 pts → 17 nodes across 4 branches
- [x] #3 Prestige tiers — first thing ever gated on prestiging
- [x] #4 Legacy Contracts (v33) — 14 multi-life goals, derived progress
- [x] #5 Career capstones — Board Seat @20yr, Emeritus @30yr (advanced ladders)
- [x] #6 Luxury Collections — 7 completion sets
- [x] #8 Wealth-scaled event money — mechanism (content pack still unwritten)
- [x] #9 Dynasty rank surfaced + 3 ranks above Legendary
- [x] #10 Grandchildren (v34) — deterministic, bounded, no nested loop
- [x] #7 Operating Overhead — soft cap made legible AND the management ladder
      built (`ops_management`, +2pp floor per level, capped at +20pp). No
      migration; zero managers reproduces the old curve exactly.

### Luxury Collections — shipped (roadmap #6)
- [x] `lib/luxury/collections.ts` — 7 completion sets, a title ladder, a
      reputation bonus clamped by the existing cap, and a bounded hosting
      multiplier. Surfaced in the Luxury app's Collection tab. No migration.

---

## Next — in order

### Before any new feature
- [ ] **Write the journal.** `journal: []` has no writer anywhere in the repo, so
      the one surface that could answer "what just happened?" is permanently
      empty — on the screen Help points at. Same fix as the muted week digest.
- [ ] **Settle the design-token collision.** `spacing.md` is 12 in
      `lib/config/theme.ts` and 16 in `utils/scaling.ts`, with a third orphaned
      copy in `utils/designSystem.ts`. Every mechanical sweep is blocked behind
      this decision.
- [ ] **Consolidate the four parallel objective systems** before adding a fifth.

### Economy
- [x] Arrears now covers the post-writeback costs too — luxury upkeep and
      insurance, crime fines and student loans defer via `chargeOrDefer` instead
      of flooring at $0, and the total folds into the same `overdueBalance`
- [x] Ad-orb cash grants gated on the GAME week (v35 carve-out), replacing a
      wall-clock-only limiter that let net worth double every ~2.2h of real time
- [ ] Still open: vehicle running costs and mining power also floor at $0 —
      same fix, `chargeOrDefer`, not yet applied to those two reducers
- [ ] Fold rental + luxury income into the tax base — ~$450k/wk of late-game
      income is currently untaxed and bypasses the net-worth soft cap
- [x] Make the passive-income soft cap legible (roadmap #7, first half) — the
      readout and the charge now share one implementation and cannot drift

### Navigation
- [ ] Move renting out of the desktop-only, tier-3 Real Estate app — it is a
      week-1 survival need
- [ ] Retire the Desktop/Mobile segment split (buying a computer currently *adds*
      a tap to five apps and relocates two)
- [ ] Promote the Discovery Center to a real, always-visible "All Systems"
      directory with working navigation

### Features — what is left of the roadmap
- [ ] #7's second half: the Operating Overhead management ladder (Group COO /
      property managers / family office). The soft cap is legible now; turning
      it into a decision is the part that moves the money axis.
- [ ] #8's content: the ~40-event Tycoon pack. The `moneyPct` mechanism ships
      and is a no-op until a template adopts it — one field per choice.
- [ ] #10's UI: the family tree at three generations, and the
      Patriarch/Matriarch activity set. The data and score input exist.
- [ ] #5 beyond the advanced ladders: the 30 base careers have per-career salary
      curves, so capstones there are an authoring job, not a mechanical one.
- [ ] Prestige tiers 2–5 have no entries yet — the plumbing exists, they need
      content to gate.
