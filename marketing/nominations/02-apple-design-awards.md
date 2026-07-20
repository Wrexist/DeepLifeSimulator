# Apple Design Awards Nomination — Deep Life Simulator

**Where:** the Apple Design Awards submission form (via App Store Connect /
Apple Developer). **When:** nominations typically open in **spring**, ahead of
**WWDC**; the app must be live on the App Store and reflect current design/OS best
practices. Submit in the newest, most polished version you have.

The ADA has these categories. You pick the ones you're submitting for. Below,
each is rated for *fit*, with the exact evidence to cite and what to shore up first.

---

## Category fit at a glance

| Category | Fit | Lead with |
|----------|-----|-----------|
| **Inclusivity** | ★★★★☆ (strongest) | 39 localizations + reduced-motion + VoiceOver labeling + WCAG-AA + fairness system |
| **Innovation** | ★★★★☆ | The real economic engine + money-conservation invariant as a *design* value |
| **Interaction** | ★★★☆☆ | Instant week-advance, immediate stat/money feedback, haptics |
| **Delight and Fun** | ★★★☆☆ | In-game phone with mini-apps; prestige/generational-wealth loop |
| **Visuals and Graphics** | ★★☆☆☆ | Cohesive dark theme, identity/legacy cards — verify it clears the ADA bar |
| **Social Impact** | ★★☆☆☆ | Financial-literacy angle (compound interest, debt, bankruptcy taught by play) |

**Recommendation:** submit primarily for **Inclusivity** and **Innovation**. Both
are defensible with in-build evidence today. Treat Interaction and Delight & Fun as
secondary. Don't stretch for Visuals unless the art direction is genuinely
award-tier against this year's winners.

---

## Primary submission — INCLUSIVITY

**One-liner:** *A deep economic life sim that hundreds of millions of people can
actually play — in their language, at their pace, with the volatility dialed to
comfort — and that's fair by design, not by luck.*

**Evidence to cite (all verifiable in-repo):**

- **39 App Store localizations** (`marketing/app-store-localizations/`) — the app
  meets players in their own language across the Americas, Europe, the Middle East,
  and Asia (incl. `ar-SA`, `he`, `hi`, `th`, `ja`, `ko`, `zh-Hans`, `zh-Hant`).
- **Reduced-motion support** — a shared `useReducedMotion` hook
  (`hooks/useReducedMotion.ts`) is honored across animated components (progress
  rings, toasts, stat indicators, modals), so motion-sensitive players get a calm
  experience without losing feedback.
- **VoiceOver labeling at scale** — 112 components carry
  `accessibilityLabel`/`Role`/`Hint`.
- **WCAG-AA contrast** enforced in the theme (`lib/config/theme.ts`) in both light
  and dark modes.
- **Haptic feedback** on key interactions for non-visual confirmation.
- **Fairness system as inclusive design** — guaranteed kids after fair attempts,
  marriage success at high relationship, job success with full qualifications, and a
  guaranteed weekly event after a dry spell, so the sim never feels arbitrary or
  punishing regardless of luck.

**⚠️ Verify BEFORE you submit (do not claim unverified):**

- [ ] **VoiceOver end-to-end:** can a screen-reader user actually complete
      onboarding → pick a career → advance a week → make a purchase? Labels exist;
      confirm the *flow* is navigable and reading order is sane.
- [ ] **Dynamic Type:** does text scale with the system setting on the core screens
      without clipping? (The brand logo intentionally opts out — that's fine; check
      body/UI text.) Only claim Dynamic Type if this passes.
- [ ] **Reduce-motion coverage:** confirm the heaviest transitions (tab changes,
      week-advance) actually respect it.
- [ ] **Localization QA:** spot-check RTL layout (`ar-SA`, `he`) for mirroring and
      truncation.

> Fixing the two checkboxes above (VoiceOver flow + Dynamic Type) is the single
> highest-leverage pre-ADA investment. It converts "we have labels" into "we're an
> Inclusivity contender."

---

## Secondary submission — INNOVATION

**One-liner:** *Most life sims fake their economy. Deep Life Simulator runs a real
one — and guarantees its integrity with a live invariant that fails the build if a
single dollar is ever created or destroyed incorrectly.*

**Evidence:**

- **A real economic model** — compounding loans/interest, a live weekly market
  (stocks + crypto), appreciating real estate, depreciating vehicles, and genuine
  bankruptcy with a painful-but-possible recovery. The design thesis — *good
  decisions beat luck* — is the innovation, not a gimmick.
- **Correctness as a design feature** — a money-conservation invariant test runs in
  the suite and fails the build if money can appear from or vanish into nowhere.
  Turning economic integrity into an enforced, testable property is a genuinely
  novel stance for the genre and worth foregrounding to a design jury.
- **Prestige / generational wealth** — death isn't game-over; your next life
  inherits perks, property, and prestige, turning a single session into a
  multi-generational strategy.

---

## Supporting notes for any category

- **Platform craft:** StoreKit IAP with the native rating prompt, cloud save with
  conflict resolution, Dark Mode, Haptics, and Reduce-Motion — i.e. it behaves like
  a good iOS citizen, which juries notice.
- **Engineering rigor** (context, not a category by itself): crash-on-launch UI test
  suite across all 7 tabs + onboarding, save-durability stress tests, and the economy
  invariant. It signals a team that sweats details.

---

## Submission asset checklist

- [ ] App is live and updated to the most polished version.
- [ ] 30–60s demo video showing the strongest category story (for Inclusivity:
      language switch → reduce-motion on → VoiceOver reading a real flow).
- [ ] 3–5 hero screenshots (reuse doc 05's set).
- [ ] Written category rationale (adapt the one-liners above).
- [ ] Every accessibility claim re-verified on-device that week.
- [ ] Category selection finalized: **Inclusivity + Innovation** (drop the rest
      unless genuinely competitive this cycle).
