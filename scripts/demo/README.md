# App Preview demo saves + capture rig

Builds a purpose-made demo save and drives a recorded playthrough, so the App
Store App Preview can be shot from a known, photogenic state instead of
grinding a hundred weeks on camera.

```bash
npm run demo:save        # build scripts/demo/demo-save.json
npm run demo:capture     # build + drive the web app, record video
npm run demo:type-check  # type-check the generator (scripts/ is excluded from the root pass)
npx jest __tests__/demo  # guard: the committed bundle still matches the app
```

`demo:capture` needs the web dev server up: `npm run web` (defaults to
`http://localhost:8081`; override with `DEMO_BASE_URL`).

Output lands in `marketing/videos/app-preview/`:
`hero-run.webm`, one still per beat, and `beat-sheet.json`.

---

## Read this before submitting anything

**Apple Guideline 2.3.3 requires App Preview footage to be captured from the
app itself.** This rig drives the *web* build, and react-native-web renders
differ from native.

So: use it to lock the edit — shot order, dwell times, caption timing — then
re-shoot the locked run on the iOS build with
`xcrun simctl io booted recordVideo`. The web capture is a rehearsal, not the
asset.

Also note the three files in `marketing/videos/` (`01_billionaire_challenge`
and friends) are **TikTok ad cuts** built from `marketing/tiktok_scripts.md`.
Paid social and the store follow opposite rules; don't submit those as App
Previews.

---

## The three chapters

One character, Ava Moreno, at three points, so the cut can show the arc the
listing sells rather than one static rich save.

| Slot | Chapter | Age | Net worth | Role in the edit |
|---|---|---|---|---|
| 1 | Week One | 18 | $250 | The hook frame. Nothing. |
| 2 | The Climb | 24 | $142K | Job, first shares, first keys. |
| 3 | The Empire | 40 | $17.8M | Penthouse-tier home, companies, family, portfolio. |

Slot 3 is the default boot target.

## How it works

`demoSave.ts` starts from `initialGameState` and applies overrides, pulling
every id and price from the real catalogs (`PROPERTY_CATALOG`,
`DEFAULT_PRICES`, `INITIAL_CAREERS`) rather than inventing them — an invented
id renders as a blank card. Each chapter is run through `validateGameState`
and the build fails on a state the app would reject.

The output is the exact localStorage the app reads: a v2 envelope
(`{v, data, checksum, hmac}`) under `save_slot_N_A`, plus the `_active`
pointer. On web, AsyncStorage is localStorage, so Playwright seeds these with
`addInitScript` before any app code runs — indistinguishable from the app
having written them.

## Details that were not obvious

Four things looked fine in the save and wrong on camera:

- **`currentJob` alone is not a job.** The Identity card reads
  `careers[currentJob].levels[level].name`, so a 40-year-old founder was
  captioned *"Business Intern"* — level 0 of the ladder. `promote()` sets the
  rung and the accepted/applied flags.
- **No `scenarioId` renders the literal word "Unknown"** in italics under the
  character's name, which reads as a bug.
- **The Apps tab is hidden until a device is owned.** Stocks, Bank and Real
  Estate — most of the shot list — live behind it, and
  `app/(tabs)/_layout.tsx` gates the tab on an owned `smartphone` or
  `computer` in `items`.
- **A market with no previous close is a dead market.** Without
  `lastWeekPrices` the board reports *0 Advancing / 0 Declining*, every sector
  reads Neutral and the sparklines draw flat — under a caption claiming a
  living economy. `seedMarketHistory()` seeds a deterministic previous close,
  mixed red and green (an all-green board reads as fake).

## When it breaks

`__tests__/demo/demoSave.test.ts` fails if the committed bundle drifts from the
app — a `STATE_VERSION` bump, a renamed career or property id, a state that
stops validating. Fix by re-running `npm run demo:save` and committing the
result. Without that guard the failure surfaces as a blank screen partway
through a capture run, or in footage already sent to Apple.

## Signing

Dev builds fall back to `dev-local-save-hmac-key`
(`utils/saveSigningConfig.ts`), which is why a Node-generated envelope verifies
against `expo start --web`. To generate saves a **production** build will
accept, set `EXPO_PUBLIC_SAVE_HMAC_KEY` in the generator's environment.
