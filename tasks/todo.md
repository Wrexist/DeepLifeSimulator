# Active plan — rentable housing, and the wellbeing it was supposed to provide

Owner ask: rent property for health / happiness / energy bonuses, plus "look for
more necessary features".

---

## What I found while scoping it

The feature is not a nice-to-have. Four things are broken or missing, and they
are the same thing seen from four sides.

1. **There is no way to rent a home.** The tenant path EXISTS —
   `applyRentAndHousing` charges rent for any property with
   `status === 'rented' && !owned` — but nothing in the game ever creates one.
   `operations.ts` only ever sets `status: 'rented'` on the LANDLORD side. So the
   only route to a home is buying one.

2. **Which, after the rebalance, is unreachable for most of a life.** The
   cheapest property is $95 000, i.e. 16.6 years on a bottom-rung wage. So a
   character has no access to housing benefits for the first two decades. The
   rebalance made this worse and renting is the bridge that should always have
   been there.

3. **The HUD promises an energy bonus the tick never pays.**
   `TopStatsBar.tsx:501` adds `currentResidence.weeklyEnergy` to the predicted
   weekly energy change. `processWeeklyHousing` applies `weeklyHappiness` only —
   `weeklyEnergy` has no reader anywhere else in shipping code. Every property in
   the catalogue carries the field (2 to 10 per week) and it has never done
   anything. Advertised-vs-actual, exactly the class the audits keep finding.

4. **Housing has no health effect at all**, and being homeless is free. Living
   nowhere costs nothing, so "get a roof over your head" has never been a goal.

Together these are also the missing recurring cost the last rebalance left open:
rent is the bill the arrears system was built for and never received.

---

## Plan

- [x] `lib/realEstate/rentals.ts` — rental ladder priced against the CURRENT
      income scale (bottom-rung career is $110/wk), so the tier choice is a real
      trade rather than an obvious pick.
- [x] `applyHousingWellbeing` weekly reducer: health / happiness / energy from a
      rental OR an owned residence, and a penalty for having neither.
- [x] Rent flows through the arrears bill line, so an unaffordable week becomes
      a debt instead of being silently forgiven.
- [x] `rentHome` / `endRental` actions, atomic per §4.4.
- [x] State + v32 migration + repair mirror + test-helper entry.
- [x] Pay the energy bonus the HUD has been promising, and give owned residences
      the same health/energy treatment as rentals.
- [x] A "Rent" tab in RealEstateApp.
- [x] Tests: the ladder is affordable-but-not-free at each income tier, homeless
      hurts, bonuses land, and the HUD prediction matches what the tick pays.

## Deliberately NOT in this pass

Found while looking, worth doing, but separate decisions:

- **Utilities/groceries as a second recurring bill.** Rent alone may be enough
  pressure; adding two at once makes neither measurable.
- **Roommates** to split rent in exchange for a happiness hit. Good depth, needs
  its own relationship hooks.
- ~~**Eviction**~~ — approved and shipped, see below.

---

## Shipped

`lib/realEstate/rentals.ts` (ladder + pure helpers), `applyHousingWellbeing`
(weekly reducer), `RentalActions` (pure-resolver shape), v32 `rental` field, and
a Rent tab in RealEstateApp placed BEFORE Browse — for most of a life renting is
the only housing a player can reach, so leading with the unreachable option would
make the screen read as "nothing here for you".

The ladder, priced against the measured income scale ($110/wk bottom rung):

| Tier | Rent | Needs | Health | Happiness | Energy |
|---|---|---|---|---|---|
| Shared Room | $45 | — | 0 | +1 | +1 |
| Bedsit | $80 | $100/wk | +1 | +2 | +2 |
| Rented Studio | $140 | $220/wk | +2 | +4 | +3 |
| City Apartment | $260 | $400/wk | +3 | +6 | +4 |
| Suburban House | $480 | $750/wk | +4 | +9 | +5 |
| Penthouse Lease | $950 | $1500/wk | +5 | +13 | +6 |

Homeless: −2 health, −4 happiness, −5 energy per week. Survivable by design —
over twenty weeks from full health to zero, so "cannot afford rent" is pressure,
never a dead save.

Two calibrations the tests forced, not chose:

- The bedsit asked $120/wk income against a $110 bottom rung, which left a
  minimum-wage worker exactly ONE option. Lowered to $100.
- The first draft of `RentalActions` returned `success: true` outside the
  updater and tripped the C-9 ratchet. Rewritten to the pure-resolver shape the
  ratchet's own header prescribes, so no variable crosses the updater boundary.


---

## Eviction (approved 2026-08-04)

Four consecutive weeks ending in arrears while renting ends the tenancy. Four
matches `ZERO_STAT_DEATH_WEEKS` deliberately — the game already teaches "four bad
weeks and something breaks", and a second number for the same shape of
consequence is just something else to learn.

This is the first thing in the economy that TAKES something away rather than
dragging on a stat, so three properties matter more than the mechanic, and the
tests assert them directly:

- **Announced.** Silent on week one (crying wolf early is how a warning stops
  being read by week three), then a named, counted-down notice from week two,
  shown on the Rent screen as well as in a toast a player may have dismissed.
- **Escapable at every point.** The counter RESETS to zero the week the balance
  clears, so paying what you owe always buys back the full four weeks. There is
  never a week where the player is doomed but still playing — that shape is what
  makes people abandon a save instead of fighting.
- **Recoverable.** Eviction stops the rent but NOT the debt (wiping it would make
  eviction the cheapest way out of a bad month), and the $45 shared room stays
  under the ~$95 a week street work alone brings in.

---

## Review pass on the PR (2026-08-05)

Three defects in the above, all found by re-reading the feature against its own
claims rather than by a failing test.

1. **The HUD disagreed with the tick — in the direction this feature existed to
   fix.** `TopStatsBar` kept its own copy of the housing maths that only knew
   about an OWNED residence, so after this change it under-predicted energy and
   happiness for a renter, showed nothing for someone sleeping rough, and missed
   the health effect owned homes now pay. It now calls `computeHousingWellbeing`,
   the same function the tick uses. One source of truth, both callers read it.
   Justifying `weeklyEnergy` by "the HUD promises what the tick never pays" and
   then leaving the HUD wrong three new ways was the worst of the three.

2. **The signing week was charged twice.** `resolveRentHome` takes the first
   week on the spot ("a tenancy never starts in arrears") and the tick then
   billed the same week again. `startedWeek` was stamped at signing and read by
   nothing; it now skips exactly one charge.

3. **Owning a home could evict you from a flat you were not paying for.**
   Ownership wins in `computeHousingWellbeing`, so an owner is charged no rent —
   but the eviction clock still ran against arrears from any other bill, and the
   Rent screen hides "Move out" once you own, so the dangling tenancy could not
   be cleared by hand either. Buying a home now ENDS the lease (`resolveTenancyStep`).

Skipping the signing-week charge is why `HousingWellbeingResult` gained an
explicit `owns` flag: `rent === 0` is now true for an owner, a new tenant and a
homeless character alike, and (3) would otherwise have cancelled every lease on
its first week.

---

## Previously shipped — the Family tab redesign (merged in #104)

Kept here rather than dropped: both branches wrote their plan to this file, and
this one landed on `main` while the housing work was in review. It is history
now, not an active plan.


Player report + screenshot (2026-08-05): the Family screen opens with its title
under the status bar, the close X sitting behind the battery/Dynamic Island, and
most of the screen empty below an invisible card.

Source of the screenshot: `app/(tabs)/life.tsx` opens `components/FamilyTab.tsx`
in a `presentationStyle="fullScreen"` Modal.

---

## 1. Root cause of "it's too far up, can't press close"

`FamilyTab` started its header at `paddingTop: scale(16)` from y=0. A full-screen
RN Modal is NOT inset by the tab navigator's safe area, so on every notch /
Dynamic Island phone the header was drawn *underneath* the status bar. The title
collided with the clock and the close button landed under the battery indicator.

This is the same control the 2026-08-01 accessibility pass "fixed": it already
carried `minTouchTargetStyle` + `hitSlopToMinTarget` + `CLOSE_BUTTON_A11Y`. The
target was the right size the whole time — it was in the wrong PLACE. A 44pt
target under the system status bar is still a 44pt target you cannot hit.

- [x] `useSafeAreaInsets()` — header padded by `insets.top`, scroll content by
      `insets.bottom`, matching every other full-screen surface in the repo
      (`SettingsModal`, `HobbiesModal`, `WhatsNewModal`, `mobile.tsx`)
- [x] `statusBarTranslucent` on the host Modal so Android claims the same full
      window iOS's `fullScreen` presentation does — otherwise Android insets the
      modal AND the header insets again, double-padding it
- [x] Close button is a visible 44pt circular surface, not a bare glyph

## 2. The design

- [x] **Dark-first.** Light mode was removed from the game (SettingsModal note,
      `saveValidation` coerces `settings.darkMode` back to `true`). Every
      `settings.darkMode && styles.xDark` pair in this file was a dead branch.
      Dropped; colours now come from `colors.dark` / `accent` in
      `lib/config/theme.ts`
- [x] **The invisible card.** The page gradient was `#1E293B → #0F172A` and the
      empty-state / stats cards were `#1E293B` — the card at the top of the page
      was exactly the background colour. Flat `background` page + `surface` cards
      with a full 1px border (Hard Rule #7), so every card has an edge
- [x] **Reclaimed the top third.** The full-width purple life-stage slab carried
      one age string; it is now the header subtitle. The summary card moves up
      and the fold shows content instead of chrome
- [x] **Honest headline.** "+0 Family Happiness" implied a weekly bonus. Nothing
      in the week loop reads it — `child.familyHappiness` has no writer at all.
      Now "Household Mood", an average of the bonds/moods it actually averages;
      income formatted with `toLocaleString`

## 3. Usability — the gating was invisible

An action the player had not unlocked simply *was not rendered*
(`canTryForBaby`, `canMoveIn`), or rendered at `opacity: 0.5` with no reason
(`Propose`). There was no way to learn the path from the screen.

- [x] Every relationship action is always visible, disabled with the reason
      inline — the pattern the parenting list in this same file already used
- [x] Requirements quoted from the action modules, not invented: move in ≥60,
      propose ≥60 + a ring you can afford, baby ≥70 + living together or engaged
      + age 18
- [x] Empty state gets a real CTA instead of a sentence telling the player to go
      find one, gated on actually owning a device
- [x] Child rows show mood + bond without opening the child sheet

## 4. Found while fixing — three bugs the screen was hiding

- [x] **"Teen · Age 21".** `GameState.lifeStage` is written exactly once, by
      `initialState.ts` (`getLifeStage(18)`), and nothing ever updates it: no
      birthday handler, no weekly subsystem, no scenario override. This header
      was its only product reader, so every player was "Teen" at every age.
      Derived from age at the point of use; the three duplicate copies of
      `getLifeStage` collapsed into one in `lib/config/gameConstants.ts`
- [x] **"Open the dating app" landed on the wrong grid.** `/(tabs)/apps` shows
      the desktop launcher once a computer is owned, and Dating lives under its
      *Mobile Apps* toggle — so the CTA dropped the player on a grid that did
      not even show the app it named. Added `?app=<id>`: the Apps tab passes it
      to whichever launcher is mounted, which opens the app, leaves the matching
      category behind it, and clears the param so returning does not re-open it
- [x] **Render smoke tests were passing on a crash screen.** Every provider sits
      in a `ProviderBoundary`, so a throw renders a valid fallback tree and
      `expect(json.length).toBeGreaterThan(0)` passes. Three suites were green
      on components that never rendered (`lucide` icon allowlist, missing
      `useWindowDimensions` / `useNavigation` mocks, no `requestAnimationFrame`).
      `renderWithProviders` now fails on the boundary's crash screen and names
      the failing provider; the mocks are fixed so all 29 render suites are real

## 5. Proof

- [x] `npm run type-check` clean · `type-check:tests:ratchet` holding at 0
- [x] `npm run check:routes` — 17 routes, no conflicts
- [x] Full Jest suite: 458 suites / 5620 tests pass
- [x] New `__tests__/render/familyTab.render.test.tsx` pins the safe-area fix,
      the requirement ladder, the derived life stage and the honest headline
- [x] Driven in the real app (web export + Playwright, iPhone 13 Pro viewport):
      header, summary card, empty state, CTA → Spark, back → Mobile Apps grid,
      re-entry does not re-open. Partner/spouse/child states verified by
      type-check + the suite, not screenshotted — reaching them needs a
      multi-week play-through
