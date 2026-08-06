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

### Late-game features — all 10 shipped
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

### 2026-08-06 audit round — shipped

- [x] **Seasonal events were half dead code.** `shouldTriggerSeasonalEvent` read
      `state.seasonalEvents`, a field nothing writes, so `completedEvents` was
      always empty (events could repeat) and `lastSeason` was always `''` —
      making the "season changed" branch always true and the 0.4% base chance
      plus the whole `weekInSeason` rarity curve UNREACHABLE. Now derived from
      `weeksLived` (the Legacy Contracts v33 precedent): one roll per
      (event, season) decides whether it happens, a second decides which single
      week. At most one firing per season, no state, no migration, replay-safe.
- [x] **75 designed gradients were flat slabs.** `expo-linear-gradient` is
      banned (iOS 26 TurboModule crash) so all 265 sites use
      `LinearGradientFallback`, which paints `colors[0]` flat.
      `components/ui/Gradient.tsx` is a drop-in with the identical prop
      signature backed by `react-native-svg` — a different library, already used
      directly by GradientButton/ProgressRing/ImageScrim. 32 files migrated,
      107 call sites. `ErrorBoundary` deliberately left flat: the crash screen
      must not depend on native views, and its gradient is two off-whites.
- [x] **`useTheme` took a full-state subscription to read one boolean.** 64
      files call it, so 64 components re-rendered on every commit — silently
      cancelling narrowing work already done in `home.tsx` and `AdRewardOrb`
      (11 files were in that state). Now a selector. Same for `useTranslation`
      (10 files). `React.memo` added to the three always-mounted inline children
      of the layout roots, without which their own narrowing is worth nothing.
- [x] **`lib/automation/` deleted** — 1,445 lines, unreachable since
      `state.automation` was never in `initialState`. All four capabilities
      already ship elsewhere (billPayRules, applySavingsGoals,
      applySubscriptions, applyAutoReinvest); building its UI would have added a
      SECOND debit path for money the first already moves. No migration: no save
      ever carried the key. Prestige rows kept so an already-bought bonus still
      renders.
- [x] **`savingsGoals.autoContribute` has a writer.** The weekly sweep, its
      tests and its asset-conservation proof all shipped; nothing could set the
      field. Both banks now collect it as a second goal-creation step.
- [x] **`computerPreviouslyOwned` has a writer** — stamped on buy AND on sell,
      so the flag self-heals on saves made before it had one.
- [x] **Dead design tokens deleted** — net 841 lines. `androidScale`,
      `iosScale` and four internal duplicates had ZERO consumers;
      `utils/designSystem.ts` and `utils/responsiveDesign.ts` are gone.
      `BaseModal` moved off the raw 12-scale onto the device-scaled one — it was
      the only shared chassis whose padding did not grow with the screen.

**Correction to the earlier finding:** the token collision was NOT "55 files
importing two scales blocking every sweep". `scaling.ts:705/746` were dead
exports; the real scale (`responsiveSpacing`, 156 files) never conflicted with
anything. The collision was 21 call sites in 2 files.

### Before any new feature
- [x] **The journal has a writer.** `appendWeekToJournal` records the week's
      notable notifications into `journal` from the tick's state assembly, keyed
      by notification id so a StrictMode double-invoke cannot double-append.
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
- [x] Rent + luxury yield folded into the tax base — ~$450k/wk of late-game
      income was untaxed, making real estate strictly dominant. The luxury
      figure is computed early from the owned ids (it is credited later in the
      tick), so the cash still lands where it always did.
- [x] Vehicle running costs + accident bills, pet food and birth costs now
      defer too. Diet and education deliberately left alone — both are ALREADY
      in `weeklyBillsDue`, so deferring them would double-charge. Mining power
      needs nothing: it is netted out of crypto earnings, never charged to cash,
      so it was never forgiven (the audit's claim there was imprecise).
- [x] Make the passive-income soft cap legible (roadmap #7, first half) — the
      readout and the charge now share one implementation and cannot drift
- [x] **Tax is legible and consistent.** `banking.taxDueThisYear` had two
      readers and no writer, so both bank-app rows were dead on every save ever
      made; it is now the year-to-date tax PAID ledger (no migration — 0 was
      already the right value). New Tax tab in Bank Pro: brackets with the
      player's band marked, YTD total, the four non-withholding taxes, and the
      Tax Strategy discount. Unaffordable stock capital-gains tax was WRITTEN
      OFF — it now defers into the same `overdueBalance` the income tax uses, so
      the game has one answer to "you cannot pay" instead of three. Tax Strategy
      now reaches capital gains (it moved income tax and nothing else, so the
      only tax skill was worth zero to an investor). Crypto's yearly tax +
      DCA notifications are week-keyed — a fixed id is deduped by the journal
      writer, so they'd have been recorded once in a 60-year life.

### Navigation
- [x] Renting is now on Life → Market (no device, no tier) as well as in the
      Real Estate app — it was a week-1 survival need behind a $5,000 computer
      and a Chapter-3 gate. The Real Estate path is kept, not replaced.
- [ ] Retire the Desktop/Mobile segment split (buying a computer currently *adds*
      a tap to five apps and relocates two)
- [ ] Promote the Discovery Center to a real, always-visible "All Systems"
      directory with working navigation

### Features — what is left of the roadmap
- [ ] #8's content: the ~40-event Tycoon pack. The `moneyPct` mechanism ships
      and is a no-op until a template adopts it — one field per choice.
- [ ] #10's UI: the family tree at three generations, and the
      Patriarch/Matriarch activity set. The data and score input exist.
- [ ] #5 beyond the advanced ladders: the 30 base careers have per-career salary
      curves, so capstones there are an authoring job, not a mechanical one.
- [ ] Prestige tiers 2–5 have no entries yet — the plumbing exists, they need
      content to gate.

---

## Prestige tiers 2–5 — real content (2026-08-06)

`PRESTIGE_UNLOCKS` had exactly ONE entry (`feature:conglomerate`, tier 1), so
prestige #5 was mechanically identical to prestige #2. Four NEW capabilities,
one per tier. Nothing that exists today is moved behind a wall.

- [x] Tier 2 — **The Vault**: pay a preservation fee to carry owned luxury
      pieces across death/prestige. First material thing that survives a life.
- [x] Tier 3 — **The Endowment**: one-time-ever tranches that convert money
      into Legacy Points. First cross-life use for money; a wealth-scaled sink.
- [x] Tier 4 — **Dynasty Trials**: opt-in handicaps on the NEXT life, settled
      for Legacy Points at the following transition. Makes each life differ.
- [x] Tier 5 — **The Dynasty Seat**: a four-wing estate ($100M → $5B) bought
      across lives, each wing deepening one of the tiers above.
- [x] One new GameState field `dynasty` (default `undefined` → carve-out),
      STATE_VERSION 35 → 36, no backfill, no `repairGameState` mirror.
- [x] Carry `dynasty` AND `legacyContracts` across prestige (the latter was not
      carried, so every prestige re-armed the whole contract board).
- [x] Surface all four in the Prestige Shop's Dynasty tab, padlocked when locked.
- [x] Tests in `__tests__/prestige/dynastyTiers.test.ts` + reachability.
