# Screenshots & App Preview Plan (Featuring-Grade)

Editors decide in seconds from your visuals. Featured apps almost always have
**story-driven screenshots with headlines** and a **short, gameplay-forward app
preview**. This is the shot list and the technical checklist.

There's an existing capture guide at repo root: `SCREENSHOT_GUIDE.md`. This doc is
the *editorial* layer on top of it — what each frame should say and why.

---

## The 6-frame narrative (order matters)

Each frame = one headline + one clean gameplay shot. Headlines already exist in
`marketing/app_store_listing.md` §8; refined here for a featuring narrative.

| # | Headline | Shows | Why it's here |
|---|----------|-------|---------------|
| 1 | **START WITH NOTHING. BUILD EVERYTHING.** | New character at 18, empty balance | The premise in one frame |
| 2 | **A REAL ECONOMY. LOANS. INTEREST. BANKRUPTCY.** | Loan/interest or bankruptcy screen | The differentiator — lead with it |
| 3 | **20+ CAREERS. FROM DOCTOR TO HACKER.** | Career selection / progression | Breadth of choice |
| 4 | **BUY PROPERTY. TRADE THE MARKET. WATCH IT COMPOUND.** | Real estate + market screen | Depth of systems |
| 5 | **80+ EVENTS. EVERY CHOICE COMPOUNDS.** | A consequential life-event modal | Stakes + replayability |
| 6 | **LIVE. DIE. INHERIT. BUILD A DYNASTY.** | Prestige / generational-wealth screen | The hook that sets it apart from one-life sims |

> If the store allows fewer, cut in this priority: keep 1, 2, 6, then 4, 3, 5.

---

## App preview video (15–30s)

Structure — no dead air, gameplay in the first 2 seconds:

1. **0–3s:** empty balance → first career pick. On-screen text: *"Start with nothing."*
2. **3–10s:** fast montage — a loan, a market trade, buying property, a life event.
   Text beats: *"Real economy." → "Real choices."*
3. **10–20s:** a bankruptcy *or* a big net-worth moment (show consequence).
   Text: *"It all compounds."*
4. **20–27s:** prestige / next-life inheritance. Text: *"Live. Die. Build a dynasty."*
5. **27–30s:** title + tagline lockup: **Deep Life Simulator — Real Economics. Real Choices.**

Rules: portrait, captured on-device at the featured version, no simulator chrome, no
finger cursors, real UI (not mockups), captions burned in (many watch muted).

---

## Optional: showcase the in-game phone

A distinctive, screenshot-worthy surface most sims don't have — the in-game phone
with mini-apps (dating, contacts, pets, politics, live statistics). Consider **one**
extra frame or a 2–3s preview beat here; it reads as "there's a whole world in
here," which editors like. Don't let it crowd out the economy story (frames 1–2, 6).

---

## Technical checklist (Apple)

- [ ] Correct sizes for current required devices (6.9" / 6.5" iPhone, 13"/12.9" iPad).
- [ ] Captured on-device on the **featured build**.
- [ ] No status-bar clutter or debug overlays; clean, full battery/signal.
- [ ] Headlines legible at thumbnail size; safe-area margins respected.
- [ ] Light **and** dark mode look intentional (dark theme is the app's default —
      keep it consistent).
- [ ] Localized screenshot text for at least the top markets among the 39 locales
      (en, es, pt-BR, de, fr, ja, ko, zh-Hans).
- [ ] App preview ≤ 30s, auto-plays cleanly, first frame is a strong poster frame.

## Technical checklist (Google Play)

- [ ] Feature graphic 1024×500 with the hook (frame 2's line works well).
- [ ] Phone + tablet screenshots.
- [ ] Promo video hosted on YouTube, linked in the listing.

---

## Asset delivery

Drop finals in a dated folder (e.g. `marketing/videos/` already exists for video;
mirror it for stills) and link them from doc 01 (supporting materials) and doc 03
(pitch email). Keep raw captures so you can re-cut per market without re-shooting.
