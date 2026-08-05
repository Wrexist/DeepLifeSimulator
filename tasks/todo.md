# Active plan — the Family tab is unusable and looks unfinished

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
