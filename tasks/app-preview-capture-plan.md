# Plan — App Preview demo save + automated capture

Owner ask: build the best possible demo save and use it to drive a recorded
playthrough for the App Store App Preview video.

Context: `docs/STORE_LISTING.md`, `marketing/app-store-localizations/en-US.md`.
Constraint that shapes everything: **Apple Guideline 2.3.3 requires App Preview
footage to be captured from the app itself.** Generated/mograph video is
rejected. So the pipeline automates *capture*, it does not synthesise frames.

The web capture below is for locking the edit (beat sheet, shot order, caption
timing) cheaply. The submitted preview must be re-shot on the iOS build via
`xcrun simctl io booted recordVideo` — react-native-web renders differ enough
from native to be a 2.3.3 risk.

---

## Steps

- [x] 1. Node-runnable stubs so save modules import outside React Native
      (`utils/logger` → `RemoteLoggingService` pulls in `AppState`).
- [x] 2. `scripts/demo/demoSave.ts` — build three chapter states from
      `initialGameState` + real catalogs (`PROPERTY_CATALOG`, `DEFAULT_PRICES`,
      `INITIAL_CAREERS`), so every id/price is one the app actually knows.
- [x] 3. Run each through `validateGameState` and fail the build on a state the
      app would reject.
- [x] 4. Emit the exact localStorage entries the app reads:
      `save_slot_N_A` (v2 envelope: `{v,data,checksum,hmac}`) + `save_slot_N_active`.
- [x] 5. `playwright.config.ts` — phone-sized project with `recordVideo`.
      Viewport is 430×932 CSS px, not 886×1920: react-native-web lays out
      against the CSS width, so the larger viewport produced a tablet layout.
      Crispness comes from `deviceScaleFactor: 2` + a 860×1864 recording.
- [x] 6. `e2e/appPreview.capture.spec.ts` — seed saves pre-boot, drive the hero
      run, record, and write a still per beat plus `beat-sheet.json`.
- [x] 7. npm scripts (`demo:save`, `demo:capture`, `demo:type-check`) + a guard
      test so a `STATE_VERSION` bump fails loudly instead of silently emitting
      a save the app will migrate or reject.

## What the run produced

`marketing/videos/app-preview/` — `hero-run.webm` (rehearsal), one still per
beat, `beat-sheet.json`. Eight beats, ~36s; needs trimming to 15–20s for
submission.

## Four things that looked fine in the save and wrong on camera

Recorded here because each cost a capture round trip:

1. `currentJob` alone captioned a 40-year-old founder **"Business Intern"** —
   the Identity card reads `careers[currentJob].levels[level].name` and the
   ladder rung was still 0.
2. No `scenarioId` renders the literal word **"Unknown"** under the name.
3. The **Apps tab is hidden** until `items` holds an owned `smartphone` or
   `computer` — and Stocks/Bank/Real Estate, most of the shot list, live there.
4. Without `stocks.lastWeekPrices` the market showed **0 Advancing / 0
   Declining**, all sectors Neutral and flat sparklines — a dead board under a
   "living market" caption.

## Still to do (owner)

- [ ] Trim the locked cut to 15–20s and burn in captions (autoplay is muted).
- [ ] Re-shoot on the iOS build — `xcrun simctl io booted recordVideo` — at an
      accepted App Preview resolution (886×1920 or 1320×2868 for 6.9";
      1080×1920 for 6.5").
- [ ] Upload as the App Preview so it takes the leading slot in search results.

## Demo content — three chapters, one character

One character (Ava Moreno) at three points, so the cut can show the arc the
listing sells (`$0 → empire`) instead of one static rich save.

| Slot | Chapter | Age | Net worth | Purpose in the edit |
|---|---|---|---|---|
| 1 | Week One | 18 | ~$250 | The hook frame. Nothing. |
| 2 | The Climb | 24 | ~$120K | Job, first shares, first apartment. |
| 3 | The Empire | 40 | ~$12M | Penthouse, companies, family, portfolio. |

Numbers are chosen to be round and legible at search-thumbnail size.

## Notes / risks

- Dev builds fall back to `dev-local-save-hmac-key`
  (`utils/saveSigningConfig.ts`), so a Node-generated envelope verifies against
  the web dev build. A production capture needs the real
  `EXPO_PUBLIC_SAVE_HMAC_KEY` in the generator env.
- Do NOT submit the three files in `marketing/videos/` as App Previews — they
  are TikTok ad cuts built from `marketing/tiktok_scripts.md` and follow the
  opposite ruleset.
