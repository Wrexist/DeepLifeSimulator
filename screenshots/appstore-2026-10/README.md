# Deep Life Simulator — App Store set, October 2026 (2.15.5)

Fresh captures of the shipping 2.15.5 UI in the September immersive design system (same art plates, typefaces and framed device panel, reused from `../appstore-2026/source`), re-sequenced so the **first three frames work on their own in a search result** — the only three most people ever see.

| # | Headline | Capture | Why here |
|---|---|---|---|
| 01 | Live any life. Your rules. | `home` | Says "life sim" in one glance: a person, a job, a marriage, a net worth |
| 02 | Go live. Get famous. | `stream-recap` | The most exciting single screen: NEW BEST, +$9,741, 7,124 viewers |
| 03 | Drive the dream. | `garage` | Pure aspiration: an exotic supercar |
| 04 | Find your person. | `spark` | Dating |
| 05 | Build your empire. | `company` | Business |
| 06 | Every choice counts. | `event-decision` | Decisions with visible consequences |
| 07 | Level up your life. | `skill-unlocked` | Progression (Life Skills unlock moment) |
| 08 | Own the city. | `realestate` | Property listings |
| 09 | Play the markets. | `stocks` | Investing |
| 10 | Live in luxury. | `luxury` | Collectibles |

`final/iphone-6.9` (1320 × 2868), `final/iphone-6.5` (1284 × 2778) and `final/ipad-13` (2064 × 2752) are the upload sets, ten each, uploaded in file-name order.

## Honest by construction

Every frame lists `checks` in `source/storyboard.json` — literal strings that must appear in the text the capture script wrote beside its PNG. `build.mjs` refuses to render a frame whose caption is not visible in its screenshot (App Store Guideline 2.3.3).

The captures are real gameplay from a web build of 2.15.5 with developer tools used to reach a late-game state quickly (the same buttons QA uses: time skips, grants, the "Creator (big channel)" setup). Every value shown is reachable in ordinary play.

## Rebuild

```bash
# 1. captures (web export served on :8090, see scripts/capture-screenshot-fixes.mjs for the export recipe)
# 2. render - DLS_FONT_MODULES must point at a node_modules with opentype.js so the
#    headline is drawn as outlines (plain <text> falls back to a monospace face on Windows)
DLS_FONT_MODULES=/path/to/node_modules node screenshots/appstore-2026-10/source/build.mjs
# 3. upload (plan first) - GitHub Actions › "App Store Connect — screenshots"
#    dir = screenshots/appstore-2026-10/final, run with ref = this branch
```
