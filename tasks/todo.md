# Repo cleanup — screenshots and stale material (2026-08-17)

Goal: delete regenerable/superseded binaries, make the App Store screenshot set
findable, and stop the class from re-accumulating.

## Ground truth established first

- `screenshots/` is **193 MB / 284 tracked files**. Nothing in it ships: preflight
  §11 (`scripts/lib/assetBudget.js`) counts only `assets/` reachable through a
  static `require()`, so this is repo weight and clone time, not download size.
- Every directory in `screenshots/` is written by a `scripts/generate-*.mjs` or
  `scripts/capture-*.mjs`. The scripts are the regeneration path and all stay.
- No markdown file `![]()`-embeds any screenshot, so deleting them breaks no
  rendered doc. Two docs mention a path in prose — fixed in step 4.
- The asset tool's "18 unreferenced images in `assets/`" list is **not** safe to
  act on: it scans static requires only, so `icon.png`, `adaptive-icon.png` and
  `favicon.png` read as unreferenced while `app.config.js` uses all three. Only
  the one file the repo itself declares unused is removed.

## KEEP — the live App Store set and its inputs

- [x] `screenshots/appstore-2026/iphone-6.9/` · `iphone-6.5/` · `ipad-13/` (10 each)
      — the upload sets named by `docs/RELEASE_RUNBOOK.md` and `marketing/aso/README.md`
- [x] `screenshots/appstore-2026/rich-captures/` + `rich-captures-ipad/` (28 each)
      — the real-gameplay source frames the two composers read. Recomposing from
      these is cheap; re-capturing is documented in that dir's README as silently
      stale-prone, which is the whole reason it exists.
- [x] `screenshots/appstore-2026/README.md` — the pipeline record

## Steps

- [x] 1. Delete superseded store sets (the pre-`appstore-2026` generation, 2026-07-24)
      `iphone-6.9/` `ipad-13/` `app-store/` `hero-3d/` `iphone-hero/`
      `iphone-real-hero/` `iphone-real/` `iphone-gameplay/` `flawless-final/`
      and `appstore-2026/style-samples/` (its own README calls it superseded)
- [x] 2. Delete dev design-review captures (regenerable, one script each)
      66 root-level PNGs · `screenshots/app/` · `avatar-centered/` · `bbq-fixes/`
- [x] 3. Delete stale non-screenshot material
      `dev/.expo/` (TestFlight crash logs for 2.2.5; binary is 2.9.0) ·
      `output/playwright/` · `.playwright-cli/` (2026-03-09 probes) ·
      `tsc-current.txt` (388 KB tsc dump) · `.bolt/` · `.idea/` ·
      `feedbackapple.txt` · `assets/images/backupMain_Menu.png` (`.easignore`
      already records it as verified-unused) ·
      `__tests__/Apple iphone 13 screenshots/` (evidence for the IAP bug fixed
      in #90; 5 MB of an error dialog sitting in the test tree)
- [x] 4. Repoint the three prose references at their generator scripts rather
      than at deleted files (`docs/avatar-art-direction-research.md`,
      `docs/avatar-approach-research.md`, `tasks/iap-fix.md`)
- [x] 5. Add `screenshots/README.md` — an index saying which set is the App Store
      upload, which are inputs, and how to rebuild. There is no index today.
- [x] 6. `.gitignore`: ignore regenerable preview output so the 193 MB cannot
      re-accumulate, and un-ignore the config that is deliberately tracked
      (`.claude/settings.json`, `.cursor/rules/`, `.vscode/`) so it stops
      showing as ignored-but-tracked.
- [x] 7. Verify: `npm run check:routes`, `npm run type-check`, targeted Jest.

## Verification (actual output)

- `npm install` — exit 0. A cold container has no `node_modules`;
  `tasks/lessons.md` records mistaking that for a failing suite twice.
- `npm run check:routes` — `OK — 18 routes, no conflicts, all groups anchored`
- `npm run type-check` — clean, no output
- `npx jest __tests__/tooling __tests__/startup --ci` — **21 suites, 230 tests,
  all passed** (20.5 s)
- preflight §11 image payload — **156 images / 22.1 MB shipped, unchanged**,
  which is the point: nothing deleted was reachable from a static `require()`.
  Unreferenced-in-`assets/` warning drops 18 → 17 (`backupMain_Menu.png`).

## Result

- `screenshots/` 193 MB → 62 MB; 284 tracked files → 88
- repo excluding `.git`/`node_modules` 284 MB → 144 MB
- 251 files deleted

## One correction worth recording

`git rm 'screenshots/*.png'` deleted 86 files it should not have: a git
**pathspec** `*` matches across `/`, unlike a shell glob, so it swept
`appstore-2026/**/*.png` — the entire live App Store set — not just the 66 PNGs
at the top level. Caught by counting tracked files against the expected 88
before committing; restored with `git checkout HEAD -- screenshots/appstore-2026`
and the one genuinely superseded folder re-removed on its own. Appended to
`tasks/lessons.md`.
