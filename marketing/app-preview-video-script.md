# App Preview Video — shot script (v2.7.0, Story Mode)

**Length:** 27s (Apple allows 15–30s; 27 leaves room for a frame of slack)
**Format:** portrait 886×1920 (6.9"), captured on device, no voiceover
**Purpose:** lift product-page conversion from a measured **40% to the 66.2%
category benchmark**. At the current $2.18 CPA that alone is worth ~65% more
installs at identical spend.

---

## Why this script is the one to shoot

The page currently converts at 0.6× benchmark while the *ad* tap-through runs at
**2.4× benchmark** — people want this game and then don't install it. So the
video has one job: show, in the first three seconds, the thing the screenshots
cannot — that **a whole life fits in a sitting**. That is only demonstrable now
that Story Mode ships; it was un-shootable before v2.7.0, which is why this
comes after it and not before.

Three rules the shoot must hold to:

1. **No voiceover, and readable with sound off.** Most product-page views are
   muted. Every claim lands as an on-screen caption or not at all.
2. **Never show a number the game cannot produce.** Record a real run. A staged
   net worth is the kind of detail a returning player notices and resents.
3. **The arc must complete.** $0 → death → heir. A preview that stops at "you
   got a job" sells a job simulator.

---

## Shot list

| # | t (s) | On screen | Caption | Why |
|---|---|---|---|---|
| 1 | 0.0–2.5 | New life screen, finger taps **Story** in the pace picker | **One tap. One year.** | The hook, and the differentiator, in the first frame. Do not open on a logo. |
| 2 | 2.5–5.0 | HUD at 18, cash **$200**. Tap. Year in Review slides up: age 18 → 19 | **A whole life in a sitting** | Proves the claim immediately rather than asserting it. |
| 3 | 5.0–8.0 | Career screen — job accepted, first payslip in DeepMail | **Get a job. Get paid. Get taxed.** | Establishes the economy is real, not cosmetic. |
| 4 | 8.0–11.5 | Bank app: loan taken, interest line visible, credit score moves | **Loans have interest. Bills don't forgive themselves.** | The wedge against every other life sim. This is the differentiator — hold it a beat longer. |
| 5 | 11.5–14.5 | Market screen, portfolio green, then a visible crash | **The market doesn't care about you** | Conflict. Failure is more shareable than success. |
| 6 | 14.5–17.0 | Overdue balance appears, red; eviction countdown | **Fall behind and you lose the place** | Stakes. Shows the game can hurt you. |
| 7 | 17.0–20.0 | Recovery montage — Year in Review cards flicking past, net worth climbing | **Compound growth is the win condition** | The payoff, and the finance-brain hook. |
| 8 | 20.0–23.0 | Property + business screens, net worth crossing $1M | **Or die a billionaire** | Aspiration. |
| 9 | 23.0–25.5 | Death screen, gravestone, obituary headline | **Every life ends** | The emotional beat and the share moment. |
| 10 | 25.5–27.0 | Heir screen, generation 2, inheritance figure | **Your kids inherit your empire — and your mistakes** | The dynasty hook, and the reason to reinstall. |

---

## Capture notes

- Record in **Story Mode** throughout. The pacing only reads if years advance
  per tap; a classic-mode capture makes the game look slow, which is the exact
  impression the video exists to correct.
- Use a **funded save** for shots 7–10 so the numbers are real without waiting
  for a live run to reach them. Shots 1–6 should come from a genuine cold start.
- **Boring Build Mode** on (`EXPO_PUBLIC_BORING_BUILD=true`) so no ad or ATT
  prompt can interrupt a take.
- Hide the debug overlay and the autosave indicator.
- Captions: system sans, ~64px, bottom third, 88% white on a subtle scrim so
  they survive a light game background. No emoji.
- Cut on the tap, not after it — the pace of the edit is part of the pitch.

## Assets already in-repo

`scripts/generate-hero-screenshots.mjs`, `generate-gameplay-screenshots.mjs`
and `capture-real-screenshots.mjs` drive the existing screenshot set; the same
screens are the ones listed above, so the video can be storyboarded against
those outputs before a device capture is scheduled. See `SCREENSHOT_GUIDE.md`.

## Deliverables to App Store Connect

- 6.9" (886×1920) — required
- 6.5" (886×1920 accepted) — reuse
- iPad 12.9" (1200×1600) — optional, only if the iPad build is promoted

Upload as **App Preview** on the primary localization first (en-US); other
locales inherit unless overridden.
