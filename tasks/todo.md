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

### 2026-08-06, second wave — shipped

- [x] **Every onboarding perk was permanently locked.** `isPerkUnlocked` read
      `gameState.achievements[].completed`, whose only writer is a no-op stub, so
      all 20 perks rendered disabled and the only unlock path left was the IAP
      call — a character-creation step behaving as a paywall gallery. 17 of the
      20 pointed at achievement ids absent from the catalogue. Repointed at
      `getSatisfiedAchievementIds`, all 20 ids remapped onto live achievements,
      locked copy now names the real achievement instead of a raw slug. Provably
      unlock-only; no version bump.
- [x] **Legacy Contracts were re-claimable every prestige.** `claimedIds` was
      never carried across a transition, so the empty board returned each cycle
      and the whole 14-contract Legacy Point ladder could be farmed once per
      life. Verified against the commit that shipped contracts. Both the prestige
      and death-to-heir paths now run `applyDynastyTransition`.
- [x] **The linear goal system could never fire.** Every goal's show-condition
      was the negation of its completion condition. It ran weekly and held the
      top interruption-queue slot. Deleted; `completedGoals` kept as a carve-out.
- [x] **The ambition payout moved into the tick.** The largest reward in the game
      ($60k–$300k + gems + up to 900 prestige points) had one caller: a card's
      claim handler, with no badge and no notification. Now a guarded weekly
      subsystem; the card is read-only so there is one granting path, not two.
- [x] **Prestige tiers 2–5 have content** (v36 `dynasty`, carve-out). Vault /
      Endowment / Trials / Dynasty Seat — all NEW capabilities, nothing existing
      moved behind a wall. Money had no cross-life use at all before this.
- [x] **45 wealth-scaled events** — the first content to declare `moneyPct`, a
      mechanism that shipped as a no-op and is why late-game events stopped
      mattering. Reachability asserted through the real selector.
- [x] **Discovery Center navigates**; **Desktop/Mobile toggle retired**.

**Correction to my own earlier report:** I looked at a screenshot of the Perks
screen, saw every card dimmed, and called it "the intentional locked state". It
was the dead-flag bug above. Looking at a screen is only worth something if you
question what you see.

**Correction to the earlier finding:** the token collision was NOT "55 files
importing two scales blocking every sweep". `scaling.ts:705/746` were dead
exports; the real scale (`responsiveSpacing`, 156 files) never conflicted with
anything. The collision was 21 call sites in 2 files.

### Before any new feature
- [x] **The journal has a writer.** `appendWeekToJournal` records the week's
      notable notifications into `journal` from the tick's state assembly, keyed
      by notification id so a StrictMode double-invoke cannot double-append.
- [x] **Design-token collision settled by deletion.** The premise that this was
      a blocking 156-file decision was wrong twice over. `utils/designSystem.ts`
      (the third copy) was already deleted; and when the remaining two were
      finally *counted* rather than estimated, `lib/config/theme.ts`'s raw
      `spacing` ladder had **zero importers** — every screen had drifted onto
      `responsiveSpacing` on its own. Deleted, with a note in its place saying
      why not to reintroduce it. One spacing scale now: `responsiveSpacing` /
      `scale()`. It did leave a mark: `PULSE_DENSITY.cardPadding` was commented
      `// 12` against `responsiveSpacing.md` (16) because its author was reading
      the other ladder. The comment was wrong, not the number.
- [x] **"Consolidate the four parallel objective systems" — dropped, premise
      wrong.** There are seven, not four, and they run on deliberately different
      horizons (a week, a chapter, a life, a dynasty). Life Chapters is
      load-bearing for the tab gates. Merging them would collapse the horizons
      that make them readable. What is actually missing is one shared "what
      next?" surface on Home that READS all of them — kept below, unbuilt.
- [ ] **One "what next?" surface on Home** that reads every objective system
      rather than each shipping its own card.

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
- [x] Retire the Desktop/Mobile segment split (buying a computer currently *adds*
      a tap to five apps and relocates two) — the toggle is gone; Phone and
      Computer are now two labelled sections of one launcher list
- [x] Promote the Discovery Center to a real, always-visible "All Systems"
      directory with working navigation — every card routes through
      `lib/depth/systemRoutes.ts`, and the list is no longer truncated at 10

### Features — what is left of the roadmap
- [ ] #8's content: the ~40-event Tycoon pack. The `moneyPct` mechanism ships
      and is a no-op until a template adopts it — one field per choice.
- [ ] #10's UI: the family tree at three generations, and the
      Patriarch/Matriarch activity set. The data and score input exist.
- [ ] #5 beyond the advanced ladders: the 30 base careers have per-career salary
      curves, so capstones there are an authoring job, not a mechanical one.
- [x] Prestige tiers 2–5 have no entries yet — the plumbing exists, they need
      content to gate. (Shipped as the Vault / Endowment / Trials / Seat, v36
      `dynasty`; see the section below.)

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

---

## The render suite stopped completing (2026-08-06)

`__tests__/render/screens.render.test.tsx` did not fail — its worker was killed
by SIGTERM with no message, and jest's own `testTimeout` never fired. That second
fact was the diagnosis: the spin blocked the event loop, so nothing scheduled
could interrupt it.

- [x] Root cause: `app/(tabs)/home.tsx` mounted its three `React.lazy` reward
      popups unconditionally with `visible={false}`. Under ts-jest an `import()`
      compiles to `Promise.resolve().then(() => require(…))`, so it settles only
      on a microtask — and `renderWithProviders` renders inside a SYNCHRONOUS
      `act()`, which never yields one. React restarted the render from the shell
      to retry the pending lazy: ~1.4M `beginWork` calls per pass, forever, with
      `scheduleUpdateOnFiber` called under 600 times in total. Not a re-render
      loop, so React's own "too many re-renders" guard could not see it either.
- [x] Found by attaching to the hung process over the V8 inspector (interrupt for
      a stack, then CPU-profile), then patching `lazyInitializer` to name the
      pending payload. Three popup imports, each stuck Pending after ~950k
      retries. Four rounds of source-level bisection had narrowed it to the file
      but named the wrong line, because the change there was a pure deletion.
- [x] Fix: mount each popup only while it holds its interruption slot — the shape
      `app/_layout.tsx`, `(tabs)/_layout.tsx` and `MainMenu.tsx` already used.
      Home was the only exception among the four files that use `lazy()`.
- [x] Guard: `__tests__/render/lazyMountGating.render.test.tsx`, asserting the
      invariant across `app/` from SOURCE — a render-based guard would reproduce
      the hang instead of reporting it. Verified in both directions; its first
      version passed on deliberately broken input and was rewritten.
- [x] Full suite green: 496 suites / 6,245 tests / 0 failures in **64s**. The
      previous run took 1,558s and lost a worker, so the livelock had been
      eating the whole suite's wall clock, not just its own test.

---

## Mail app — the game's paper trail (2026-08-06)

Owner ask: a mail app with real-looking receipts, invoices, payslips and
important info; scam mail when the player has dealt with untrusted dark-web
vendors; Gmail as the design reference; a key feature, not a curiosity.

**Why it fits.** The game already produces every number a mail would quote —
salary and withholding, rent, tuition, subscriptions, loan interest, tax,
dark-web vendor reputation — and shows almost none of it as a durable
document. The journal records what happened in a week; mail is where the
*paperwork* lives, and it is the natural home for the one thing the game has
never had: a channel the player must judge rather than just read.

### Data
- [ ] `MailState` on GameState — `messages[]`, `lastGeneratedWeek`, `address`.
      **v37, carve-out** (default `undefined`): absence already means "no mail
      yet", and inventing an inbox on an existing save would fabricate receipts
      for purchases that never happened. Bounded to `MAX_MESSAGES` so a 60-year
      life cannot grow the save without limit.
- [ ] Every read goes through `lib/mail/state.ts`, degrading a missing or
      malformed shape to the empty inbox rather than throwing in the week loop.

### Content
- [ ] `lib/mail/templates/` — one module per family, each a pure
      `(ctx) => MailMessage | null` so a template that cannot apply this week
      simply returns null:
      payslip · bank statement · rent/mortgage invoice · subscription receipts ·
      tuition invoice · tax notice · overdue notice · dividend + trade
      confirmations · job offer / interview / rejection · insurance ·
      vehicle service · property purchase receipt · luxury purchase receipt ·
      family + social (wedding invite, birth, condolence) · promotions ·
      security alerts (new sign-in, password) · **scam**.
- [ ] Attachments render as REAL documents — a payslip with gross → deductions →
      net and YTD, an invoice with line items, VAT and a due date, a receipt with
      an order id and payment method. Numbers come from the save, never invented.

### The scam mechanic (the reason this is a feature and not a feed)
- [ ] Risk is EARNED, not random: buying from a low-reputation or scam-flagged
      dark-web vendor, high investigation heat, and leaked-credential events all
      raise the odds. A player who never touches the dark web still sees the
      occasional generic phish, at a much lower rate.
- [ ] A scam can only cost money if the player ACTS on it (taps the fake
      "verify"/"claim"), never passively. The charge happens inside the same
      `setGameState` updater that marks the message resolved, re-checked against
      `prev` (§4.4) — a double-tap in one React batch must pay once.
- [ ] Every scam carries real TELLS (lookalike domain, urgency, wrong greeting,
      mismatched link), revealed after resolution either way, so the mechanic
      teaches instead of taxing.
- [ ] "Report phishing" is always safe and always available.
- [ ] Recovery: disputing the charge with the bank can recover part of a loss,
      once per incident — so being scammed is a setback with an answer, not a
      dead loss.

### UI — Gmail's DNA
- [ ] Search pill + avatar header, category tabs (Primary / Finance /
      Promotions / Social), density-matched list rows (coloured sender avatar,
      unread weight, star, snippet, date), folder drawer (Inbox / Starred /
      Archive / Spam / Trash), detail view with sender block, verified badge,
      attachment card, and per-message actions.
- [ ] Reachable from BOTH launchers (phone and computer), like Bank — with an
      unread badge on the tile, which is what makes it a channel rather than a
      screen nobody opens.

### Gates
- [x] Weekly generator runs as a guarded subsystem (§4.3); a throw must not cost
      the week.
- [x] Deterministic from `weeksLived` — a tick that runs twice produces the same
      inbox (ids encode the week, appends are keyed), asserted both ways plus a
      `Math.random` spy.
- [x] type-check · test-tree ratchet 0 · lint 0 errors · routes · full suite.

### Two things the build surfaced that were NOT about mail

- [x] **`dynastyTiers.test.ts` pinned `CURRENT_STATE_VERSION` to 36.** It failed
      the moment v37 landed, while proving nothing about `dynasty` — a test that
      breaks on every future bump. Rewritten to assert what actually matters
      (v36 is registered, migrating across it writes no `dynasty` key) in a form
      that survives the next version. Same hardcoded-literal trap already
      recorded in `scripts/lib/coverageRatchet.js`.
- [x] **CORRECTED — the earlier note here was wrong on both numbers.** It said
      the 100 KB growth budget passed with "1.2 KB to spare" and that
      `checkpoints` was "657 KB after 100 ticks, 6.5x everything else combined".
      Re-measured on the real provider loop:
        - 20-tick growth is **20.7 KB of the 100 KB budget** — ~79 KB of
          headroom, not 1.2 KB. The budget test never sees a checkpoint at all:
          the first one fires at week 52, well past its 20-tick window.
        - `checkpoints` after 100 ticks is **108 KB**, not 657 KB.
      Where it IS bad is further out, and the earlier note undersold the shape:
      at 260 ticks (5 years) the save is 914 KB and checkpoints are **743 KB of
      it — 81%**. Each snapshot is ~170 KB, essentially a whole copy of the
      state, and there are five.
- [x] **Stripped `cryptoMarket` from checkpoint snapshots.** ~37 KB of every
      170 KB snapshot, almost all `coinMarkets[*].priceHistory` (100 weeks per
      coin). Also the right call independent of size: it is MARKET state, so
      restoring it rewound the market alongside the player — rewind to before
      the crash, trade a window you already watched. The position itself is
      `cryptos[].owned` and is untouched. Save 914 KB -> **744 KB (-19%)**.
- [x] **Stripped `mail`** (~39 KB/snapshot, the largest single field) and
      **`jailActivities`** (4.2 KB, verified catalogue-only). Mail needed a fix
      to be safe: `pendingEvents` is NOT stripped, so a routed letter-event
      came back with no inbox to render it in — invisible in both surfaces
      until it lapsed. `rewindToCheckpoint` now clears `channel` on restored
      mail-routed events, handing them to `WeeklyEventModal`. Break-tested.
- [x] **`MAX_CHECKPOINTS` 5 -> 3.** `getRewindCost` doubles per use in a life
      (500 / 1,000 / 2,000), so targets 4 and 5 cost 8,000 and 16,000 gems —
      more than reviving outright. They were unreachable at ~100 KB each.
- [x] **Result: 914 KB -> 434 KB (-53%).** Checkpoints 743 KB -> 264 KB.
- [ ] **Compression: NOT done, and I do not think it should be.** It was on the
      list, but after a 53% cut the remaining delta does not justify what it
      costs: a new dependency, and a discriminator in the save format because
      `CheckpointSnapshot` already allows a plain-JSON `string` for legacy
      saves — compressed strings would be indistinguishable from those without
      one. That is save-format surface area in a PR already at 313 files.
      Worth revisiting as its own change if the save grows again.
- [ ] **Stripping stops here.** The next two by size are NOT safe, and the
      field names do not say so: `streetJobs` (8.5 KB) carries `progress`, and
      `darkWebItems` (2.8 KB) carries `owned`. Both are in `repairGameState`'s
      `catalogArrays`, which restores them WHOLESALE from defaults when absent,
      so stripping either would reset crime progress or repossess purchases on
      every rewind. Pinned by a test.
- [ ] **LATENT SAVE BUG found on the way, not fixed.** That same
      `catalogArrays` list treats `streetJobs`, `darkWebItems` and `dietPlans`
      as pure catalogues, but they carry `progress`, `owned` and `active`. Any
      save that loses one entirely gets it replaced from defaults and logged as
      "Restored missing X catalog from defaults" — silent progress loss
      reported as a successful repair. Narrow (needs the whole array missing)
      but real. The trade is genuine: the alternative is `validateGameEntry`
      rejecting the save and locking the player out, which is what this code
      was written to fix. Worth an owner decision rather than a quiet change.
- [ ] **Also found, not addressed:** `careers` is 13.6 KB and `streetJobs` 8.5 KB
      inside every snapshot, because `initialState` seeds the full CATALOGUE
      into the save and mixes per-career progress into it. That is a structural
      issue well beyond checkpoints — it inflates the live save too.

---

## Mail, round 2 — the inbox becomes a place where things happen (2026-08-06)

Round 1 made mail a record. This makes it a surface you act on. All four items
share one mechanism, which is the point: mail is the only channel in the game
where a decision can WAIT, and everything below is an instance of that.

### The mechanism
- [x] `MailDecision` on a message: choices, an `expiresAtWeek` deadline, and a
      TAGGED RESOLVER saying who applies the outcome. One presentation, several
      handlers — not several decision systems.
- [x] Letter-shaped events delegate to the EXISTING `resolveEvent(eventId,
      choiceId)` rather than copying its ~200 lines of effect application. One
      resolver, one set of rules about affordability, karma and follow-ups.
- [x] `lib/events/routing.ts` — one place that decides modal vs mail, used by
      BOTH the event inbox pill and `WeeklyEventModal`, so a routed event can
      never appear in two channels.

### 1. Letter-shaped events move to the inbox
- [x] Nine existing events are described in their own copy as arriving by mail —
      a jury duty summons, a lawsuit threat, a four-page revenue-service letter,
      a reporter's fact-checking email — and all of them present as a
      full-screen modal that demands an answer immediately. Route them to mail
      with a deadline. Not new content: existing content in the right channel,
      plus the ability to defer.

### 2. The job offer letter
- [x] `applyCareerApplications` silently flips `accepted: true` after 1–2 weeks.
      No offer, no salary quoted, no start date, no way to decline. Replace with
      a real offer letter: Accept / Negotiate / Decline.
- [x] **Lapsing an offer ACCEPTS it**, which is deliberate. Today's behaviour is
      auto-accept, so a player who never opens mail must land exactly where they
      land now. Reading your mail earns the extra options; ignoring it costs
      nothing. A feature that can silently leave a new player unemployed because
      they did not find an inbox is not worth shipping.
- [x] Negotiate reuses `raiseMultiplier` and its cooldown — an existing lever
      moved to where it belongs, not a new economy.

### 3. Payable bills
- [x] `overdueBalance` has no player-facing action anywhere: written by the tick,
      collected automatically, displayed in the bank, and otherwise a spectator
      sport. An invoice with Pay now clears it early and lifts the credit score.
      Atomic against `prev` (§4.4) and refused when unaffordable.

### 4. Legal paper
- [x] The crime axis produces stat changes and a jail counter and no documents.
      Fines with contest-or-pay, a summons, a settlement offer with a deadline —
      authored as EVENTS so they inherit the routing above and the one resolver,
      rather than as a fifth bespoke system.

### What ignoring a letter actually does — the design answer that mattered

The tick cannot apply an ignored event's effects: `resolveEvent` is a React
callback with its own updater, and copying its ~200 lines of affordability,
karma and follow-up handling into the weekly pipeline would have created a
second set of rules for what a choice can do. The alternative — expiring the
letter silently — would have made every deadline meaningless.

So an expired letter **stops being deferrable**: clearing `channel` hands the
event back to `WeeklyEventModal`, where it would have appeared all along if mail
did not exist. Ignoring your post produces precisely the thing you were avoiding
— the decision interrupts you. One resolver, a real consequence, and no second
effects engine.

**Gates:** type-check clean · test-tree ratchet 0 · lint 0 errors · routes OK ·
audit:weekly all five domains green · full suite **500 suites / 6,298 tests /
0 failures** (was 499 / 6,273).

---

## Mail app — navigation and filters (2026-08-07)

Owner ask: make the mail app easy to use and navigate, with clean filters.

Read the finished screen looking for what a player actually has to DO to find a
message. Four of the six items below are defects rather than polish — the
navigation is not just inconvenient, it answers some questions wrong.

### Defects
- [x] **`emptyMailBin` empties Spam AND Trash whatever folder you are in.**
      The visible label just says "Empty". Standing in Trash and tapping it
      wipes Spam too — data loss the player did not ask for. Scope it.
- [x] **Search only covers the current folder.** The module docblock says
      search exists so "did my bank really write from that address?" is
      answerable in the app — but an archived message returns "No matches",
      which answers that question WRONG. Search must span folders.
- [x] **A decision letter with a deadline looks exactly like a promo.** The
      highest-stakes row in the game — a summons that auto-resolves in two
      weeks — has no badge, no filter and no count. Nothing surfaces it.
- [x] **Drawer counts are Inbox-only** (`key === 'inbox' ? unreadInbox : 0`),
      so nothing tells the player Spam or Starred has anything in it.

### Navigation
- [x] **Every folder switch is a modal round-trip** — hamburger, tap, close;
      three taps to look in Spam and come back.
- [x] **No filters beyond the four category tabs**, and those exist only in
      Inbox, so Archive and Spam have no way to narrow anything.

### Approach
- [x] `lib/mail/filters.ts` — the filter model as pure functions: `matchesFilter`,
      `filterCounts`, `searchMessages` (cross-folder), `folderCounts`,
      `decisionDeadline`. Testable without a renderer, and the deadline copy
      lives here so the row and the detail cannot drift.
- [x] Chip row under the search bar — Gmail's own current design (Unread /
      Attachments / Starred are literally chips there today), carrying the
      filters this game needs: Unread, Needs reply, Documents, Unverified.
- [x] The current folder is the FIRST chip when not in Inbox, dismissable —
      so where you are is always visible and getting back is one tap.
- [x] Deadline chip on the row; folder label on cross-folder search results.
- [x] Filter-aware empty states ("No unread mail", not "Nothing here").

### Found while working, NOT fixed — out of scope
- [x] FIXED in the death-screen rebuild below. `components/DeathPopup.tsx:563`
      showed `safeUserProfile(gameState).name`,
      which is the HANDLE (defaults to "player"), not the character's
      `firstName`/`lastName`. Seen live: a save named Thomas White gets a death
      screen headed "You Died / Player". Same wrong-field bug as the one fixed
      in mail, on the most emotionally loaded screen in the game.
      `characterName()` in `lib/mail/state.ts` already resolves this correctly
      and should probably move somewhere shared. Left for the owner to schedule
      — it is a different surface from the one this task was about.

---

## Death screen — rebuild to the owner's design (2026-08-07)

Owner supplied a mockup. Differences from what ships today, top to bottom:

- [x] **Hero illustration** — a lit gravestone with skull, purple wisp, moss and
      particles, filling the top ~20% of the screen. Today: a 48px skull in a
      glass circle, inline with the title. This is the whole change in tone.
- [x] **"You Died" centred and huge**, subtitle in indigo, cause in grey under
      it. Today all three are a left-aligned stack sharing a row with the icon.
- [x] **Identity card** — avatar in a ring, name, `Age N · N yrs lived`. Today
      the name and age are the 2nd/3rd lines of the header text block, with no
      portrait at all.
- [x] **Life Quality arc gauge** — semicircular progress, a face that matches
      the score, big percentage. Does not exist in any form.
- [x] **Action rows** — Revive (pink), Get more gems (neutral), Rewind (amber),
      each a full-width card with a title, a one-line description and a cost
      pill. Today: two gradient pill buttons and a list of bare rewind chips.
- [x] **Start New Life** — full-width purple CTA with a subtitle.

### Decisions this needs

- [x] **Life Quality has to be REAL.** A number the player can read is a number
      they will check. Derive it in `lib/legacy/lifeQuality.ts` from the same
      signals the ribbon system already reads — achievements, net worth,
      family, career, education, health and happiness at death, years lived —
      as a pure, deterministic, tested function. Not a cosmetic gauge.
- [x] **The hero art does not exist yet.** Metro cannot `require` a missing
      file, so the screen must look right TODAY without it. Build the hero as a
      drawn composition with an optional image override, so dropping the
      generated asset in is a one-line change and nothing is broken meanwhile.
      Ship the AI prompt list alongside.
- [x] **Fix the name while here.** `safeUserProfile(gameState).name` is the
      handle and defaults to "player" — the mockup's own placeholder says
      "Player", which is exactly the bug. One shared `characterName()` in
      `utils/characterName.ts`, used by both this screen and mail.
- [x] **NOT shipping the mockup's X button.** Death is a hard stop: there is no
      dismiss handler because a dismissed death screen leaves the player in a
      dead save with no way forward. An X that soft-locks the game is worse
      than a missing X. Flagged for the owner rather than guessed at.
- [x] Rule #7: every card gets a full four-sided border, never a side stripe.
      `scale()`/`fontScale()` throughout, no raw pixels.

### Death screen — economy + IAP (2026-08-07, owner follow-up)
- [x] `REVIVE_GEM_COST` 15,000 → 5,000 (owner's number). Help copy now reads the
      constant instead of quoting "15,000 gems" as a literal.
- [x] "Before Death" checkpoint removed. A 500-gem rewind to it handed back a
      living character one week older — what Revive charges thousands for and
      what the $2.99 pack sells. Creation removed AND filtered from the death
      screen so existing saves lose the exploit too.
- [x] Revival Pack row added to the death screen, bridging to the `perks` tab.
- [ ] **OWNER ACTION — the Revival Pack is a NON-CONSUMABLE.** It can be bought
      once per Apple/Google account, ever. "Revive with real money" therefore
      works exactly once per player, and the row hides itself afterwards rather
      than showing a button that cannot fire. Making it repeatable means
      changing the product type in App Store Connect and Play Console, plus
      moving it to `CONSUMABLE_PRODUCTS` in `utils/iapConfig.ts` and dropping
      it from the restore carve-out in `services/IAPService.ts`. Not done —
      changing a live product's type is a store decision with billing
      consequences.
- [x] **The hero image — DONE (2026-08-08), by the owner, not the image tool.**
      The tool route stalled twice: first on model cost (`nano_banana_pro` at
      2.00 credits against a 1.68 balance), then on the network policy denying
      the CDN that served the four `z_image` candidates, so none of them were
      ever seen. The owner supplied artwork directly instead. Shipped as
      `assets/images/death/gravestone.webp` — 1024 × 683, quality 90, **98 KB
      from a 2.18 MB PNG (−96%)**, alpha intact. Wiring was the one prop the
      note promised. The source PNG is not committed; nothing reads it.
      - Same commit collapsed a `Death/` vs `death/` case collision. Git treats
        them as two paths, macOS and Windows as one — so the bug could only
        have appeared on a clone, never on the Linux box that made it. Worth
        remembering the next time a directory is created by hand.

---

## Archived — Weekly Audit 2026-08-06 (from `main`, PR #107)

Kept verbatim below. `main` used `tasks/todo.md` for a completed weekly-audit
report while this branch was using it as the active plan, so the merge had to
choose. It keeps both: every item here is already `[x]`, and the work shipped in
PR #107 (the eviction move-out → re-rent hole), so nothing outstanding is lost —
but the record is worth keeping and the repo's convention would file it as
`tasks/weekly-audit-2026-08-06.md` rather than here.

# Weekly Audit — 2026-08-06

Static audit (`npm run audit:weekly`): **all 5 domains green, 0 warnings.**
Dynamic backstops (money-conservation, rental ladder, save-migration, arrears,
housing-wellbeing, RentalActions, longRunSaveLoad, performance): **all green.**
Deep qualitative pass via subagents (economy exploits; stability + logic): done.

## Confirmed finding — fixing

- [x] **Eviction clock resettable via move-out → re-rent** (economy, LOW–MEDIUM).
  `resolveEndRental` wipes the whole `rental` record incl. `missedWeeks`; move-out
  is free; re-renting while `overdueBalance > 0` grants a fresh 4-week clock. This
  is a *second* escape that contradicts the developer's documented invariant
  ("the counter resets the week the balance clears… the only one",
  `RentalActions.ts:86-90`) and defeats the shipped eviction feature (3068ede).
  The tier-**swap** variant was already hardened (d5daaf8); the move-**out**
  variant was left open because it discards `missedWeeks` rather than carrying it.
  - [x] Fix: gate re-entry in `canRent` — a landlord won't sign a new lease while
        the player is in default (`!state.rental && overdueBalance > 0`). Scoped to
        `!state.rental` so tier swaps (which carry the clock) are unaffected.
        Move-out stays free/immediate (the escape hatch), and the debt clears off
        income, so it stays recoverable.
  - [x] Add regression tests (move-out → re-rent blocked while owing; allowed once
        clear; tier swap still allowed while owing).

## Non-blocking (filed in PR description)
- Landlord `housingRentalIncome` is untaxed (bounded, not player-settable) — info.
- `economyIncomeMultiplier` has no upper clamp (not player-reachable) — defensive.
- Eviction notice wording attributes arrears to rent even when the shortfall came
  from other bills — cosmetic.

---

## OPEN — a balance decision for the owner: story mode's first years are short

**Measured, not estimated.** Three runs against the shipped production web
bundle, story mode, one tap each:

| Character | Weeks delivered | Outcome |
|---|---|---|
| Idle (before the danger stop) | ~11–15 | **died** — happiness at 0 for 4 weeks |
| Idle (after the danger stop) | 7 | handed back, "your life is in trouble" |
| **Employed + housed** (Line Cook $110/wk, Shared Room $45/wk) | **8** | handed back, still in danger |

Taking the two obviously-correct opening actions bought **one extra week**.
That is the finding: the danger stop is working exactly as designed, and it is
revealing something underneath it.

**Why — measured per week, then traced to the formula.** A default character's
happiness runs 100 → 94.4 → 88.2 → 81.4 → 74.0 → 65.0 → 55.4 → 46.2 → 36.4 →
26.0 → 15.6 → 3.2 → 0. The decay is not flat, it **accelerates**: −5.6/week at
week 1, −12.4/week by week 11. Health does the same, −3.2 → −8.8. Fitness starts
at **10**, not 100, and is gone by week 6.

`computeDecayInputs` (`contexts/game/actions/weekly/preTick.ts`) explains both:

```
effectiveDecayRate = 4 × wealthMultiplier × prestigeMultiplier × (0.25 + 0.75 × graceFactor)
wealthMultiplier   = clamp(100000 / max(1000, netWorth), 0.5, 2.0)
graceFactor        = min(1, weeksLived / 8)
```

Two things fall out, and they compound:

- **`wealthMultiplier` is INVERSE to net worth and clamps at 2.0 for anyone
  under $50k.** Every new character starts at ~$1,500, so they sit on the
  ceiling: a new player decays at exactly twice the rate of a rich one. That is
  a deliberate "poverty is hard" choice in classic mode, where they can act
  weekly. In story mode it means the poorest players — i.e. all new ones — get
  the shortest years.
- **The grace period is 8 weeks, and the first story year ends at 7–8 weeks.**
  That is not a coincidence: the danger stop fires almost exactly when grace
  expires and the decay rate finishes quadrupling (0.25× → 1.0×).

So no threshold tweak fixes it — at −10/week near the end, moving the danger
line from 20 to 10 buys about two weeks, not forty.

**Four measured runs bound the problem, and they rule out the obvious fixes:**

| Configuration | Weeks of 52 |
|---|---|
| Idle, broke (~$1,500) | 7 |
| Job + rented room, broke | 8 |
| Job + room + **$500,000** (decay at its 0.5 FLOOR) | 13 |
| Room + $500,000, **no job** | 16 |

The best case in the game — maximum wealth advantage, housed, and free of any
job's weekly toll — reaches **16 of 52 weeks**. So "one tap, one year" is not
unreachable for *poor* characters; it is unreachable for **anyone**, which
eliminates raising the `wealthMultiplier` floor or lengthening the grace period
as sufficient fixes on their own. Quadrupling the decay advantage bought five
weeks; removing employment bought three more.

**A hypothesis that was tested and is WRONG, recorded so it is not re-run:**
that `weeklyToll` in `lib/careers/jobMarket.ts` was the dominant drain. Every
job is negative on happiness and energy (`{ energy: -14, happiness: -1 }`,
`{ energy: -12, happiness: -3 }`) and story mode removes the weeks a player
would use to absorb it, so it was a reasonable suspect. Removing the job
entirely moved 13 → 16. Real, and nowhere near sufficient.

**The 16-week figure is VERIFIED HOUSED.** An earlier check reported the
tenancy as inactive and I briefly retracted these numbers; that check was
broken, not the rental. RN-web does not emit `aria-selected` for
`accessibilityState={{ selected }}`, so it read `null` before and after a
successful rental alike. The run now asserts on the confirmation toast
("Moved into the Shared Room. First week's rent of $45 paid.") and reproduces
16 weeks with the tenancy confirmed. The table above stands.

**What is still unaccounted for, stated as a number rather than a guess.** For
the wealthy HOUSED unemployed run the formula predicts happiness decay of
`4 × 0.5 × 1.0 × 0.8 ≈ 1.6/week` once grace expires, less the Shared Room's
+1/week — call it well under 1/week net, i.e. 90 → 20 in **70+ weeks**. It died
in 16. Health does not explain it either: starting at 70 with decay
`rate × 0.6 ≈ 1.2/week` gives ~40 weeks to reach 20.

So **roughly 4 points per week of stat drain are not explained by
`effectiveDecayRate`, and the homeless penalty is ruled out** — this character
was housed. Three hypotheses are now disproved (danger-threshold tuning, job
`weeklyToll`, and `HOMELESS_PENALTY`), which is why the next step is
measurement rather than a fourth guess:

1. **Which stat crosses the danger line first?** The run only reports "in
   trouble"; it does not say whether happiness, health or energy tripped it.
2. **Per-subsystem attribution.** Instrument the weekly tick to log every
   happiness and health delta by source for ~20 ticks. The ~37 `apply*`
   subsystems are the search space, and several of them (`applyPets`,
   `applyRelationshipHealth`, `applyEducationStress`, `applyCrimeTick`) carry
   double-digit penalties that would not show up in any formula I have read.

Do that before touching a single balance number.

**This is a design call, not a bug, so it is not being changed unilaterally.**
Three options, with what each costs:

1. **Accept it.** The loop becomes act → live → act, and the first years are
   short by design. Cheapest, and already communicated: the pace picker, the
   in-app changelog and `WHATS_NEW` all now say the year can hand back early.
   Risk: the picker promises "1 tap = 52 weeks" and a new player gets 8.
2. **Rebalance, with the formula as the map.** The candidates, cheapest first:
   raise the `wealthMultiplier` floor or lower its 2.0 ceiling so a broke
   character is not permanently at maximum decay; lengthen `gracePeriodWeeks`
   past 8 so the first year is not cut exactly where grace ends; start fitness
   above 10 or slow its decay so it does not reach zero by week 6; or give a job
   and a home real weekly upkeep instead of +1 happiness. Delivers the headline
   promise. Cost: every one of these touches CLASSIC mode as well, so it needs
   playtesting — this is the game's core economy, not a story-mode knob.
3. **Let the batch perform upkeep** (auto-rest when a stat is low). Delivers the
   promise without touching classic. Cost: it breaks the rule the mode is built
   on — "nothing is decided for you" — and that rule is why the batch is
   trustworthy. Not recommended.

**Knock-on:** the two hero App Store screenshots (`01-a-whole-life-one-sitting`
and `04-make-the-next-one-count`) cannot be produced from a fresh character
until this is settled — `scripts/capture-good-year.mjs` tries and correctly
refuses to write a "good year" that went badly. They need a played save, or
option 2.
