# App Preview Video — shot script (v2.8.0)

**Length:** 27s (Apple allows 15–30s; 27 leaves room for a frame of slack)
**Format:** portrait 886×1920 (6.9"), captured on device, no voiceover
**Purpose:** lift product-page conversion from a measured **40% to the 66.2%
category benchmark**. At the current $2.18 CPA that alone is worth ~65% more
installs at identical spend.

> **Supersedes the v2.7.0 script.** That version opened on the Story Mode pace
> picker and used Year in Review cards for its payoff montage. Story Mode was
> removed in v2.8.0, so three of its ten shots and its entire capture premise
> are now unshootable. Do not film from an older copy of this file.

---

## Why this script is the one to shoot

The page converts at 0.6× benchmark while the *ad* tap-through runs at **2.4×
benchmark** — people want this game and then don't install it. So the video has
one job: kill the suspicion that stops the install.

For a life sim that suspicion is **"this looks like a lot of setup and a lot of
menus."** v2.8.0 is the first build that can answer it on camera: Play now goes
straight into a life, and a new player reaches their first paycheck with a guide
pointing the way. That is the opening beat — not a feature, a *removal* of
friction, which is far more persuasive shown than claimed.

The old hook was "a whole life fits in a sitting." The new one is **"you are
playing three seconds after you tap."** Both answer the same objection. This one
has the advantage of being true of the build that ships.

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
| 1 | 0.0–2.0 | Main menu. Finger taps **Play**. Character is created and the life opens. | **Tap once. You're alive.** | The hook is the absence of setup. Do not open on a logo, and do not show the menu for longer than the tap. |
| 2 | 2.0–4.5 | Home HUD at 18, cash **$0**. The first-session card reads "Find your first job". | **No setup. No tutorial wall.** | Answers the objection that stops the install, in the first frames. |
| 3 | 4.5–8.0 | Work screen — job accepted; a week ticks; first payslip lands in DeepMail | **Get a job. Get paid. Get taxed.** | The core loop, complete, inside eight seconds. Establishes the economy is real, not cosmetic. |
| 4 | 8.0–11.5 | Bank app: loan taken, interest line visible, credit score moves | **Loans have interest. Bills don't forgive themselves.** | The wedge against every other life sim. This is the differentiator — hold it a beat longer. |
| 5 | 11.5–14.5 | Market screen, portfolio green, then a visible crash | **The market doesn't care about you** | Conflict. Failure is more shareable than success. |
| 6 | 14.5–17.0 | Overdue balance appears, red; eviction countdown | **Fall behind and you lose the place** | Stakes. Shows the game can hurt you. |
| 7 | 17.0–20.0 | Fast cuts of weekly ticks — net worth line climbing across a few years | **Compound growth is the win condition** | The payoff, and the finance-brain hook. Replaces the old Year in Review montage: cut on each tap so the *edit* supplies the pace the removed mode used to. |
| 8 | 20.0–23.0 | Property + business screens, net worth crossing $1M | **Or die a billionaire** | Aspiration. |
| 9 | 23.0–25.5 | Death screen, gravestone, obituary headline | **Every life ends** | The emotional beat and the share moment. |
| 10 | 25.5–27.0 | Heir screen, generation 2, inheritance figure | **Your kids inherit your empire — and your mistakes** | The dynasty hook, and the reason to reinstall. |

---

## Capture notes

- **Shots 1–3 must be one continuous cold start**, from the menu to the first
  payslip, with no cuts. That sequence *is* the pitch, and a cut in the middle
  of it invites exactly the suspicion the video exists to remove.
- **Pace comes from the edit now, not from the game.** Every life runs one week
  per tap. Shot 7 is where that used to look slow, so cut on the tap and let the
  montage carry it — never hold on a single week advancing.
- Use a **funded save** for shots 7–10 so the numbers are real without waiting
  for a live run to reach them. Shots 1–6 come from a genuine cold start.
- **Boring Build Mode** on (`EXPO_PUBLIC_BORING_BUILD=true`) so no ad or ATT
  prompt can interrupt a take. A new life is ad-free for its first year in
  v2.8.0 anyway, but the flag makes it deterministic.
- Hide the debug overlay and the autosave indicator.
- Captions: system sans, ~64px, bottom third, 88% white on a subtle scrim so
  they survive a light game background. No emoji.
- Cut on the tap, not after it — the pace of the edit is part of the pitch.

## Assets already in-repo

`screenshots/appstore-2026/rich-captures/` holds 28 real captures of the
shipping UI, and the same screens are the ones listed above, so the video can be
storyboarded against those frames before a device capture is scheduled. Rebuild
or re-capture them per `screenshots/appstore-2026/README.md`; `SCREENSHOT_GUIDE.md`
covers the store-upload side.

(The three SVG-mock generators this section used to name — `generate-hero-screenshots.mjs`,
`generate-gameplay-screenshots.mjs`, `capture-real-screenshots.mjs` — were removed
with the screenshot sets they produced. They recreated app screens rather than
capturing them, which is exactly what Guideline 2.3.3 rejects.)

The committed store screenshots (`screenshots/appstore-2026/`) are all still
accurate for v2.8.0 — none of them showed the pace picker, so they need no
re-shoot.

## Deliverables to App Store Connect

- 6.9" (886×1920) — required
- 6.5" (886×1920 accepted) — reuse
- iPad 12.9" (1200×1600) — optional, only if the iPad build is promoted

Upload as **App Preview** on the primary localization first (en-US); other
locales inherit unless overridden.
