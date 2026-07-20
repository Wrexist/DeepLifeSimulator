# Deep Life Simulator — Featuring & Awards Nominations Package

**Purpose:** everything you need to nominate Deep Life Simulator for editorial
featuring and awards on the App Store and Google Play, tuned around the next
feature update.

**App:** Deep Life Simulator · **Current version:** v2.5.8 · **Category:** Games ›
Simulation · **Platforms:** iOS / iPadOS + Android · **Prepared:** 2026-07-20

---

## What's in this folder

| File | What it is | Where it goes |
|------|-----------|---------------|
| [`01-app-store-featuring.md`](./01-app-store-featuring.md) | App Store Connect **Featuring Nomination**, filled out field-by-field, copy-paste ready | App Store Connect › App Store › Featuring |
| [`02-apple-design-awards.md`](./02-apple-design-awards.md) | **Apple Design Awards** submission, mapped category-by-category with evidence | ADA nomination form (opens ~spring, before WWDC) |
| [`03-google-play-featuring.md`](./03-google-play-featuring.md) | **Google Play** editorial featuring, "Best of", and Indie Games program pitches | Play Console › Store presence + editorial contact |
| [`04-whats-new-editorial-angle.md`](./04-whats-new-editorial-angle.md) | The update's **editorial hook** + release-notes variants written for editors, not just users | Nomination "what's new" fields + release notes |
| [`05-screenshots-and-preview-plan.md`](./05-screenshots-and-preview-plan.md) | Featuring-grade **screenshot + app-preview** plan and asset checklist | Store assets + nomination supporting material |
| [`06-in-app-events.md`](./06-in-app-events.md) | **App Store In-App Events** — a direct, editor-visible featuring lever | App Store Connect › In-App Events |

Read this README first, then submit in this order: **04 → 05/06 (build assets)
→ 01 → 03 → 02** (ADA only when its window opens).

---

## The one-paragraph pitch (memorize this)

> Deep Life Simulator is a life sim with a **real economic engine** — loans that
> compound, a weekly market, real estate, and bankruptcy that actually costs you
> — where good decisions beat luck. It is **player-first**: no forced ads, no
> pay-to-win, and a live money-conservation invariant that fails the build if a
> single dollar could appear from nowhere. It ships in **39 localizations** with
> broad accessibility support (reduced-motion, VoiceOver labeling, WCAG-AA
> contrast). The upcoming update is a genuine **turnaround story**: a top-to-bottom
> stability, fairness, and performance pass that makes the game feel instant.

---

## Why this app is featurable (the levers, ranked)

1. **A real point of view.** "Economics that actually matter" is a crisp, editor-
   friendly hook that separates it from the category's random-tap sims. Editors
   feature apps with a clear reason to exist.
2. **Player-friendly monetization.** No forced ads, permanent ad-removal option,
   no pay-to-win. Apple and Google both editorialize around respecting players.
3. **Depth without a paywall.** 20+ careers, 80+ life events, prestige /
   generational wealth, an in-game phone with mini-apps (dating, contacts, pets,
   politics, stats). Lots of screenshot-worthy surface area.
4. **Global reach.** 39 App Store localizations is a genuine, verifiable
   differentiator most indie sims can't match — it maps directly to Apple's
   "around the world" and localization editorial themes.
5. **Accessibility & fairness as design values.** Reduced-motion, 112 components
   with accessibility labels, WCAG-AA contrast, a guaranteed-fairness system
   (kids/marriage/jobs). This is the spine of the Apple Design Award **Inclusivity**
   pitch.
6. **Engineering credibility.** Crash-on-launch UI test suite, save-durability
   stress tests, and an economy invariant test. Editors can trust it won't embarrass
   a feature slot.

---

## Timing — do NOT skip this

**App Store featuring nominations must be submitted at least 3 weeks before the
date you want to be featured; 6–8 weeks is the realistic target.** Nominate around
a *moment* — the update's release, a seasonal theme, or an In-App Event — not into
a vacuum.

Suggested schedule for the next update (fill in real dates):

| When | Action |
|------|--------|
| T‑8 weeks | Finalize the update scope + the "what's new" hook (doc 04). |
| T‑7 weeks | Capture new screenshots + app preview (doc 05). |
| T‑6 weeks | Submit App Store **Featuring Nomination** (doc 01) with a requested feature date ≈ release date. |
| T‑6 weeks | Create the **In-App Event** (doc 06) so it's visible to editors while they evaluate. |
| T‑5 weeks | Submit **Google Play** editorial nomination (doc 03). |
| T‑1 week | Respond to reviews, confirm build is approved and release-scheduled. |
| Release | Ship. Keep responding to reviews for the first 72h — editors watch trajectory. |
| Spring (annual) | Submit **Apple Design Awards** (doc 02) when the window opens. |

---

## Honest reality check (internal — do not paste into any submission)

- **Rating is the biggest headwind.** The listing notes ~2.3 stars. Apple and
  Google editors weigh star rating and recent-review sentiment heavily. The
  strongest, most honest move is to **submit the featuring nomination on the back
  of the stability update** and frame it as a comeback — but expect featuring odds
  to rise sharply once the rating recovers toward 4.0+. Keep responding to reviews;
  trajectory matters as much as the absolute number.
- **Don't over-claim accessibility.** Reduced-motion, extensive accessibility
  labeling, and WCAG-AA contrast are real and verifiable. **Full Dynamic Type and
  end-to-end VoiceOver navigation are NOT yet verified** — test them before you
  assert them in the ADA Inclusivity submission (see the checklist in doc 02).
- **A "wall of text" release note reads as a bug-fix dump to an editor.** Lead with
  the story (doc 04), not the changelog.
- **Nominating ≠ being featured.** Most nominations don't convert. Submitting a
  clean, on-theme, well-timed nomination for *every* update is the game — volume and
  consistency compound.

---

## Facts you can cite (all verified in-repo, 2026-07-20)

- 39 App Store localizations shipped (`marketing/app-store-localizations/`).
- 112 components carry accessibility labels/roles/hints.
- Shared `useReducedMotion` hook (`hooks/useReducedMotion.ts`) honored across
  animated components.
- WCAG-AA contrast enforced in the theme (`lib/config/theme.ts`).
- Haptic feedback via `expo-haptics` across interactive surfaces.
- Live money-conservation invariant test in the economy suite.
- Crash-on-launch UI test suite mounting all 7 tabs + onboarding.
- Player-first monetization: no forced ads, permanent ad-removal option, no
  pay-to-win (see App Store listing copy).
