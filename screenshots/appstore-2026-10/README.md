# Deep Life Simulator — App Store set, October 2026 (2.15.5)

Fresh captures of the shipping 2.15.5 UI, re-sequenced so the **first three frames work on their own in a search result** — the only three most people ever see.

**v2 layout (2026-10-11).** v1 printed a small cropped panel on an art plate; on iPad that panel sat in a sea of empty canvas and the owner called the set boring. v2 shows the real screen in a device frame (status bar, Dynamic Island, titanium bezel) that runs off the canvas, and lifts each frame's key moment out of the screen at reading size. The headline sits on full-bleed art; on iPad the 851 px art plates are blurred on purpose rather than upscaled soft.

| # | Headline | Capture | Callout |
|---|---|---|---|
| 01 | Live any life. Your rules. | `home` | Profile card: name, job, marriage, net worth |
| 02 | Go live. Get famous. | `stream-recap` | Earnings, peak viewers, followers, subs, donations |
| 03 | Drive the dream. | `garage` | The yellow Exotic Supercar hero |
| 04 | Find your person. | `spark` | The Spark profile |
| 05 | Build your empire. | `company` | $8,000 take-home per week |
| 06 | Every choice counts. | `event-decision` | A decision and what each choice does |
| 07 | Level up your life. | `skill-unlocked` | The Life Skills unlock moment |
| 08 | Own the city. | `realestate` | A listing |
| 09 | Play the markets. | `stocks` | Live tickers |
| 10 | Live in luxury. | `luxury` | The watch collection |

`final/iphone-6.9` (1320 × 2868), `final/iphone-6.5` (1284 × 2778) and `final/ipad-13` (2064 × 2752) are the upload sets, ten each, uploaded in file-name order.

## Product Page creative assets (Header and Search Results)

| File | Size | Use |
|---|---|---|
| `final/header/header-a.png` | 5244 × 2950 | Header A — "Live any life. Your rules.", text left, garage / home / stream |
| `final/header/header-b.png` | 5244 × 2950 | Header B — "Go live. Get famous.", text left, Spark / stream / luxury |
| `final/header/header-c.png` | 5244 × 2950 | Header C — centred, crop-proof: survives any centred crop Apple applies |
| `final/search/search-a.png` (+ `-1920x1280`) | 3840 × 2560 | Search visual A — "Live any life. Your rules." |
| `final/search/search-b.png` (+ `-1920x1280`) | 3840 × 2560 | Search visual B — "Go live. Get famous." |

App Store Connect accepts 5244 × 2950 for the header (the 21:9 3840 × 1646 first cut was rejected) and 3840 × 2560 or 1920 × 1280 for search. Each header is laid out in a 21:9 band scaled into the centre of the 16:9 canvas, so everything that matters sits inside a central safe zone; the edges carry only blurred art. No prices of the app and no buzzwords. A/B pairs: header A vs C tests text-left against centred, A vs B tests life-sim against streaming as the lead promise. Upload in App Store Connect › the version › Header and Search Results.

## Honest by construction

Every frame lists `checks` in `source/storyboard.json` — literal strings that must appear in the text the capture script wrote beside its PNG. `build.mjs` refuses to render a frame whose caption is not visible in its screenshot (App Store Guideline 2.3.3).

The captures are real gameplay from a web build of 2.15.5 with developer tools used to reach a late-game state quickly (time skips, grants, the "Creator (big channel)" setup). Every value shown is reachable in ordinary play.

## Rebuild

```bash
# 1. export (throwaway HMAC key, devtools on) and serve - pass a WINDOWS path to the
#    server on Windows: Node reads /tmp as C:\tmp, which silently serves a stale export
EXPO_PUBLIC_SAVE_HMAC_KEY=<throwaway> EXPO_PUBLIC_ENABLE_DEVTOOLS=true EXPO_PUBLIC_BORING_BUILD=true \
  npx expo export --platform web --output-dir /tmp/webshots --clear
node scripts/serve-web-export.mjs "$(cygpath -w /tmp/webshots)" 8090
# 2. captures
node scripts/capture-store-2026-10.mjs
VIEW_W=1024 VIEW_H=1366 DSF=2 OUT=screenshots/appstore-2026-10/captures/ipad node scripts/capture-store-2026-10.mjs
# 3. render - DLS_FONT_MODULES must point at a node_modules with opentype.js
DLS_FONT_MODULES=/path/to/node_modules node screenshots/appstore-2026-10/source/build.mjs
# 4. upload (plan first) - GitHub Actions › "App Store Connect — screenshots"
```
