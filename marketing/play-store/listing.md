# DeepLife Simulator - Google Play listing pack (first Android release)

Everything Play needs that lives in the repo. Store-console-only items are marked
**[CONSOLE]**. Verify character limits after any edit.

Canonical URLs (already published):
- Privacy policy: https://wrexist.github.io/DeepLifeSimulator/privacy.html
- Support: https://wrexist.github.io/DeepLifeSimulator/support.html

## Text

**App name (max 30)**
```
DeepLife Simulator
```

**Short description (max 80)**
```
Live a thousand lives: career, love, money, legacy. Every choice compounds.
```
(78 characters - verify after editing.)

**Full description (max 4000)**
```
You start at 18 with almost nothing. Everything after that is a choice.

DeepLife Simulator is a life-simulation game with a real economy underneath it. Take a job, or don't. Study for a degree that costs more than you have. Take the loan. Buy a home, rent it out, watch the market move. Fall in love, start a family, or chase the money instead. When this life ends, your heir inherits what you built, and the next one begins.

WHAT YOU CAN DO
- Careers: dozens of jobs with real pay ladders, promotions, raises, and burnout.
- Education: programs, scholarships, student loans, study progress, and a payoff that hiring actually reads.
- Money and markets: savings interest, loans, stocks, crypto, a bank, and a net worth that is honest about every asset and debt.
- Property: buy, mortgage, rent out, upgrade, and carry the tax and upkeep.
- People: meet, call, date, marry, have children, and keep (or neglect) the bonds that hold a life together.
- Crime and dark web: a riskier path with real consequences.
- Legacy: prestige into a dynasty, unlock a Legacy Pass, and pass an estate to your heir.

WHY IT IS DIFFERENT
- One life is one run. Death is not a fail screen - it is the end of a story your heir continues.
- The economy is simulated, not scripted: tax brackets, arrears, market cycles and rent all move on their own.
- Your choices compound. A single decision rarely matters; a hundred of them do.

No account required. Your save is on your device. Optional ads can be removed with a one-time purchase.

Contains ads. In-app purchases available.
```

**Category:** Simulation (primary). Secondary: Casual.
**Tags:** life simulation, tycoon, dating sim, idle, text adventure.

## Graphics (in this folder)

| Asset | File | Spec | Status |
|---|---|---|---|
| App icon | `icon-512.png` | 512x512 PNG, 32-bit | generated |
| Feature graphic | `feature-graphic-1024x500.png` | 1024x500 PNG/JPG | generated |
| Phone screenshots | `screenshots/` | 2-8, each side 320-3840px, aspect <= 2:1 | 8 designed 1080x1920 (9:16) storyboards |

Phone screenshots must be Android/Play-aspect. The existing iOS shots are
1320x2868 / 1284x2778 (**2.17:1**) and would be **rejected** by Play - do not
upload them.

`screenshots/` holds the **designed storyboards** (8 of the 10-story campaign),
rendered at 1080x1920 by
`screenshots/player-stories-2026-09/source/build.mjs --devices=play-phone`,
which gained a `play-phone` size for this. `screenshots-live/` keeps four plain
live captures (720x1280) as alternates if a raw screenshot is preferred.

## Compliance answers (verify each in the console before submitting)

**Ads [CONSOLE]** - Yes, the app contains ads (banner + rewarded video via
Google AdMob). Rewarded ads are opt-in.

**In-app purchases [CONSOLE]** - Yes. The catalogue is defined in
`utils/iapConfig.ts` (gem packs, permanent upgrades, Remove Ads, subscriptions
handled via RevenueCat). Create matching products in Play Console.

**Target audience [CONSOLE]** - 13+ / not designed for children. The game
contains simulated crime, alcohol, and dating themes. Do NOT opt into
Designed for Families.

**Content rating (IARC questionnaire) [CONSOLE]** - answer honestly; expect
Teen / PEGI 12+. Relevant answers:
- Violence: none.
- Simulated gambling: yes - stocks, crypto and other market speculation are a
  core mechanic. (There is no real-money wagering and no virtual casino.)
- Crime: yes - crime and a dark-web path are present by design.
- Sexuality: mild - dating and marriage, no explicit content.
- Drugs/alcohol: mild references.
- Language: mild.
- User-generated content / social: none (single-player; the Pulse/Spark feeds
  are simulated NPC content, not real users).

**Data safety [CONSOLE]** - Declare:
- *Collected*: App activity (in-app actions and screens) via Firebase/GA4;
  Device or other IDs (advertising ID) via AdMob.
- *Shared*: Device or other IDs and approximate/derived data with Google AdMob
  for advertising.
- *Not collected*: name, email, precise location, contacts, photos, messages.
- Encrypted in transit: yes.
- Data deletion: the app ships a player-reviewed deletion request flow; point
  the deletion URL at the privacy policy, and cite
  `components/settings/BugReportSheet` / the privacy request path as the in-app
  route.
- Consent: usage analytics is optional and default-denied; ads require ATT/UMP
  consent (see `lib/analytics`, `services/AdMobService.ts`).

**Government apps / financial features [CONSOLE]** - The game simulates
money but does not provide real financial services. Answer "no" to
financial-services declarations.

**App access [CONSOLE]** - No login. Provide review instructions: tap Play on
the main menu to start a life (no account, no purchase needed to review).

## Store listing contact

- Email: the support address published on the support page.
- Website: https://wrexist.github.io/DeepLifeSimulator/support.html
- Privacy policy: https://wrexist.github.io/DeepLifeSimulator/privacy.html

## Release notes (max 500 per language)

```
First Android release. Start a life at 18, build it across careers, markets,
family and legacy - and pass what you built to your heir.
```
