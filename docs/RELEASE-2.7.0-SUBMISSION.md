# v2.7.0 "Story Mode" — submission checklist

Everything for this release, split by **who can do it**. The repo half is done
and verified; the rest needs a console login or a device and cannot be done from
source.

---

## ✅ Done in the repo — verified, not asserted

| Gate | Result |
|---|---|
| Full test suite | **6,483 passed / 1 skipped · exit 0** |
| `npm run preflight` | **ALL CHECKS PASSED** (with production env supplied — see below) |
| `npm run audit:weekly` | **53/53 clean**, 5 domains, 0 findings |
| `npm run type-check` | clean |
| `npm run type-check:tests:ratchet` | holding at **0** |
| `node scripts/check-content-quality.js` | at or above **every floor** |
| `npm run lint:errors` | clean |
| `npm run check:routes` | 17 routes, no conflicts |
| `node marketing/app-store-localizations/validate.js` | **ALL 39 LOCALES PASS** |

### Shipped in this release

- **Story Mode** — an opt-in pace chosen at character creation. One tap = a
  year; classic is untouched and remains the default for every existing save.
  Proven equivalent to classic by `__tests__/gameMode/batchEquivalence.test.ts`.
- **Year in Review** — the per-year recap that replaces the 52 suppressed
  weekly banners.
- **Share loop fixed** — the obituary now carries the App Store link (it
  previously ended at a hashtag, so every share was a dead end);
  `ShareLifeCard` wired into Progress after being dead code since PR #67.
- **Content ratchet** — `scripts/check-content-quality.js`, wired into
  preflight. Two cliffhangers that promised drama and defused it now land;
  bad-outcome share 26.67% → **40%**.
- **Two production bugs fixed** — stale-snapshot stat decay, and a death guard
  that let a dead character keep ageing. Both affected fast tapping in classic
  mode, not just the new one.
- **Tab-bar guard** — `__tests__/startup/tabBarSurface.test.ts` pins the 4-tab
  bar that expo-router would otherwise silently widen.

### Store copy — rewritten and committed

`marketing/app-store-localizations/en-US.md` (also en-CA, en-GB):

- **Subtitle** → `Rags to riches money life sim` (29/30). The old
  "Real Economics. Real Choices." carried **zero searchable keywords**, and
  subtitle is indexed.
- **Keyword field** → 98/100 chars, no spaces after commas, no words already in
  the name or subtitle, no competitor brand names (2.3.7 rejection risk).
- **Promotional text** → leads with Story Mode. **This also fixed a real
  blocker**: en-US, en-CA and en-GB were all over Apple's 170-character limit
  (187, 174 and 193) and would have been rejected on submission.
- **What's New** → written, player-language only.

---

## ☐ Needs an EAS login — 2 commands, blocks the build

Preflight fails on a fresh clone for exactly two missing variables. Both are
environment, not code: `eas.json`'s production profile already sets
`EXPO_PUBLIC_USE_REVENUECAT=true`, and neither key may be committed.

Exact commands are in **`docs/RELEASE_SECRETS.md` § "The two that block
preflight today"**. In short:

- [ ] `EXPO_PUBLIC_RC_IOS_KEY` — RevenueCat *public* app key (`appl_…`).
      Without it every purchase is refused and paying players get nothing.
- [ ] `EXPO_PUBLIC_SAVE_HMAC_KEY` — 64 hex chars, freshly generated.
      ⚠️ Rotating this invalidates the signature on every save already in the
      field. Read the note in `RELEASE_SECRETS.md` before rotating on a live app.

Verify with the one-shot command in that doc; it proves the gate passes without
storing anything.

---

## ☐ Needs App Store Connect — the highest-value hour available

The ad data says the product page is the bottleneck, not demand: tap-through
runs at **2.4× the Games benchmark** while page conversion sits at **0.6×**.
Closing that gap is worth **+65% installs at identical spend** before a dollar
of new budget.

- [ ] **Upload the App Preview video.** Shot script with timings, captions and
      capture settings: `marketing/app-preview-video-script.md`. This is the
      single biggest conversion lever and it only became shootable in 2.7.0 —
      a whole life now fits in one take.
- [ ] **Upload screenshots.** Already generated and submission-ready:
      `screenshots/appstore-2026/` — 10 each at
      `iphone-6.9` (1320×2868), `iphone-6.5` (1284×2778), `ipad-13` (2064×2752).
- [ ] **Paste the new subtitle, keyword field, promotional text and What's New**
      from `marketing/app-store-localizations/en-US.md`.
- [ ] **Replace the placeholder social preview image.** The App Store link
      currently previews as an Apple placeholder, so every share on Discord,
      iMessage, X or Reddit renders broken — including the obituary shares this
      release just fixed.
- [ ] **Submit a Featuring nomination.** Solo dev, rebuilt economy from player
      feedback, no forced ads. Free, ~15 minutes, asymmetric upside.
- [ ] **Set the App Store Connect version record.** Next is **1.5.0** — do NOT
      set it to 2.7.0. The store record and the binary version have been
      deliberately different since 1.2.7; store versions only ever increase, so
      matching them is a one-way door that abandons the 1.x line. See
      `CLAUDE.md` §9.

---

## ☐ Needs the Apple Ads console — after the page work, not before

Full analysis and reasoning: `marketing/apple-ads/08-first-results-2026-08.md`.

- [ ] **Keep everything paused** until page conversion ≥ 55% **and** D1 ≥ 30%.
      Restarting sooner means paying $2.54 to show people a wall.
- [ ] **Kill `DLS-US-Competitor-Exact`.** 4.66% tap-through against a 7.72%
      category floor, on 322 impressions — a real signal, not noise. People
      searching "BitLife" want BitLife.
- [ ] **Restart `DLS-US-Category-Exact` first**, same $12/day. Raise to $20 only
      once conversion clears 55%.
- [ ] **Keep `DLS-US-Discovery-Broad` at minimum** as a keyword harvester.
      Judge it on search terms found, never on CPA.

---

## ☐ Needs a device — before submitting

- [ ] TestFlight smoke: create a life in **each** mode, confirm classic is
      unchanged and a story tap opens the Year in Review.
- [ ] Confirm an **existing** save loads and still advances one week per tap —
      the v38 migration is a carve-out and must not re-pace a life in progress.
- [ ] Confirm the obituary share sheet shows the App Store link.
- [ ] Bump `BUILD_NUMBER` at EAS build time. `eas build --local` never
      auto-increments, and a duplicate `CFBundleVersion` is rejected at submit.

---

## Known and accepted

Two preflight warnings, both pre-existing and neither blocking:

- No iOS interstitial ad unit configured — banner and rewarded serve normally,
  so this is unrealised revenue rather than a defect.
- 16 unreferenced images in `assets/` — repo weight and clone time only. Metro
  bundles static requires, so they do not ship.

One open product gap, deliberately not closed in this release: the **median
event outcome is 6 points on a 0–100 stat against a goal of 15**. Moving it
means retuning several hundred authored numbers against a tick that decays stats
weekly — a balance project that needs playtesting, not a mechanical sweep. It is
tracked as `CURRENT` in `scripts/lib/contentQualityRatchet.js` so the gap stays
visible and cannot silently widen.
