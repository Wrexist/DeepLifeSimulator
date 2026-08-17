# Screenshots

Everything here is **generated**. Nothing in this directory ships in the app —
preflight §11 (`scripts/lib/assetBudget.js`) counts only files under `assets/`
reachable through a static `require()`, so this tree is repo weight, never
download size.

---

## What to upload to App Store Connect

**`appstore-2026/`** — and nothing else in this repo. Three sets, ten frames
each, uploaded **in filename order** (`01…` first; the first two are the only
ones most store visitors ever see).

| Upload to | Folder | Size |
|---|---|---|
| iPhone 6.9" Display **(required)** | `appstore-2026/iphone-6.9/` | 1320 × 2868 |
| iPhone 6.5" Display | `appstore-2026/iphone-6.5/` | 1284 × 2778 |
| iPad 13" Display | `appstore-2026/ipad-13/` | 2064 × 2752 |

They are composed from 28 real captures of the shipping UI, which is what makes
them compliant with **Guideline 2.3.3** (screenshots must show the current
version). `docs/RELEASE_RUNBOOK.md` carries the upload checklist;
`appstore-2026/README.md` carries the pipeline and the ten-frame narrative;
`docs/store-screenshot-design.md` carries the design rationale.

## The inputs — do not delete

| Folder | What it is |
|---|---|
| `appstore-2026/rich-captures/` | 28 iPhone captures (1290 × 2796) of a rich late-game save |
| `appstore-2026/rich-captures-ipad/` | the same 28 at iPad size (2048 × 2732) |

These are the source frames the two composers read. Recomposing the ten store
frames from them is cheap and deterministic; **re-capturing is not** — the
capture script drives the app by its on-screen labels, so it goes stale whenever
the UI is reworded, and it goes stale *silently* (a missed label leaves the
previous run's file in place). Three such bugs were found and fixed in 2026-08.
That failure mode is recorded at the top of `appstore-2026/README.md` and is the
reason the captures are committed rather than treated as scratch.

## Rebuilding

Recompose the store frames from the committed captures — the common case, and
the only step you need after a design change:

```bash
node scripts/generate-appstore-2026-set.mjs    # iPhone 6.9" + 6.5"
node scripts/generate-appstore-2026-ipad.mjs   # iPad 13"
```

Both import `scripts/lib/storeFrameSystem.mjs` — change the palette, type scale
or frame list **there**, never in one generator, or the two device sets drift
apart.

Re-capture from the running app — only when the UI itself has changed enough
that the captures no longer show the shipping build. Full procedure (Expo web
export → static server → Playwright drive) is in `appstore-2026/README.md`.

## Preview captures are not committed

Design-review previews (`avatar-*`, `onboarding-*`, `slate-glass-*`, `dna-*`,
`tab-*`, `vitals-*`, the creator-flow sweep, and the superseded 2026-07 hero
sets) used to live here — 193 MB of PNGs across 14 sibling directories, with no
index saying which set was the real one. They were regenerable output committed
by reflex, and the stale index in their place named the *wrong* folders as the
upload set, which is a live risk of shipping outdated screenshots to Apple.

They are removed and `.gitignore` now keeps them out. Each one still has its
generator in `scripts/generate-*.mjs` — run the script, look at the PNG, leave
it untracked. The decisions they informed are written down in
`docs/avatar-art-direction-research.md`, `docs/avatar-approach-research.md` and
`docs/store-screenshot-design.md`; the images were the working, not the record.
