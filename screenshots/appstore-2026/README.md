# App Store 2026 — Immersive Screenshot Set

New-generation App Store images built from **real gameplay captures** (not mock
HTML): the game is driven end-to-end with Playwright, a rich late-game save is
built through the in-app Dev Tools, and every frame is a true 1290×2796 @3x
capture of the shipping UI.

## Pipeline

1. `EXPO_PUBLIC_ENABLE_DEVTOOLS=true EXPO_PUBLIC_SAVE_HMAC_KEY=<any> EXPO_PUBLIC_REQUIRE_SIGNED_SAVES=false EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION=true EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES=true npx expo export --platform web --clear --output-dir <dir>`
2. `npx serve -l 8090 -s <dir>`
3. `node scripts/capture-rich-state.mjs` → `rich-captures/` (14 real screens)
   - onboarding (Food Courier → Business Empire ambition)
   - Dev Tools: god-mode on, 2×52-week skips, top career, company, education,
     spouse+kids, ~$11M net worth, gems, prestige, maxed stats → save
   - reload → menu → Continue (clean state, no dev modals) → capture every tab
     and phone app (Spark, Pulse, Stocks, Bank, Contacts, Education)
4. `node scripts/generate-appstore-2026-samples.mjs` → `style-samples/`
   (three 1320×2868 style candidates for image #1)

## The 3 style candidates (`style-samples/`)

| Sample | Style | Idea |
|--------|-------|------|
| `sample-A-cinematic` | **Aurora Stage** | Straight-on titanium phone on an ambient aurora backdrop, big headline, floating glass "live" chips ($11M · Married · +2.75% · Level 6) popping off the device |
| `sample-B-fullbleed` | **Inside the Game** | The real screenshot fills the entire canvas edge-to-edge, cinematic scrim + huge type — feels like standing inside the app |
| `sample-C-collage` | **Life in Motion** | Three overlapping angled phones (Home + Spark + Stocks), vivid gradient, emoji stickers and a net-worth badge — playful, content-rich |

## Planned 10-image narrative (any style)

| # | Headline | Screen | Accent |
|---|----------|--------|--------|
| 01 | Live any **life.** | Home / identity ($11M, married, Icon standing) | purple |
| 02 | Find your **person.** | Spark (dating swipe card) | pink |
| 03 | Build the **empire.** | Stocks (market, sectors, portfolio) | emerald |
| 04 | **Hustle** your way up. | Work (street hustle → careers → crime) | blue |
| 05 | Go **viral.** | Pulse (social feed) | magenta |
| 06 | Master your **money.** | Bank (accounts, loans, cards) | green |
| 07 | A phone full of **lives.** | Apps grid (Spark/Contacts/Pulse/Stocks/Bank/Education…) | cyan |
| 08 | Train your **mind.** | Education (degrees & skills) | teal |
| 09 | Leave a **legacy.** | Life tab (family, generations, prestige) | gold |
| 10 | Your story, your **rules.** | Home goals / ambition milestones | violet |

Order 01→10 is the upload order (01 is the primary hero). All frames target
Apple's current required 6.9" base size **1320×2868**; captures are 1290×2796
(430×932 @3x) and scale losslessly inside the frames.
