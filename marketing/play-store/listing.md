# DeepLife Simulator - Google Play listing pack (first Android release)

**Single source of truth: `marketing/aso/metadata.mjs` -> `PLAY`.** The text
below mirrors it; `scripts/check-aso.mjs` enforces the character limits. If the
copy changes, change it THERE first, then re-paste here.

Reminder for a first Play listing: **there is no keywords field.** Play indexes
the **title**, **short description** and **long description**, so the terms you
want to rank for must appear naturally in the long description (they do).

Canonical URLs (already published):
- Privacy policy: https://wrexist.github.io/DeepLifeSimulator/privacy.html
- Support: https://wrexist.github.io/DeepLifeSimulator/support.html

## Text (paste these)

**App title (max 30)**
```
Deep Life Simulator: Tycoon
```

**Short description (max 80)**
```
Career, crime, stocks and property. Build a fortune, then pass it on.
```

**Full description (max 4000)** - copy `PLAY.longDescription` verbatim from
`marketing/aso/metadata.mjs`. It is written for Play keyword indexing
(careers, money, stocks, crypto, property, business, crime, mafia, dark web,
prison, dating, family, legacy, offline games) and is the main ranking surface.

**Category:** Simulation (primary). Secondary: Casual.
**Tags:** Simulation, Casual.

## Graphics (in this folder)

| Asset | File | Spec | Status |
|---|---|---|---|
| App icon | `icon-512.png` | 512x512 PNG | generated |
| Feature graphic | `feature-graphic-1024x500.png` | 1024x500 PNG/JPG | generated |
| Phone screenshots | `screenshots/` | 2-8, each side 320-3840px, aspect <= 2:1 | 8 designed 1080x1920 (9:16) storyboards |

Do **not** upload the iOS screenshots - they are 2.17:1 and Play rejects above
2:1. Each Play frame carries a floating project-owned 3D render (from
`art/game-assets-v1/renders/`) with a soft glow, drop shadow and ambient
particles, rendered by
`screenshots/player-stories-2026-09/source/build.mjs --devices=play-phone`.
`screenshots-live/` keeps four plain live captures as alternates.

## Compliance answers (verify each in the console)

**Ads** - Yes, the app contains ads (banner + rewarded video via Google AdMob).

**In-app purchases** - Yes. The catalogue is `utils/iapConfig.ts` (27 one-time
products + 2 subscriptions, already listed in `tasks/launch-step-by-step.md`).

**Target audience** - 13+ / not designed for children. Do NOT opt into
Designed for Families.

**Content rating (IARC questionnaire)** - answer honestly; expect Teen /
PEGI 12+. Crime and a dark-web path are present by design; stocks and crypto are
simulated gambling; dating/marriage is mild; alcohol/drugs are mild references.

**Data safety** - declare:
- *Collected*: App activity (in-app actions/screens) via Firebase/GA4; Device or
  other IDs (advertising ID) via AdMob.
- *Shared*: Device or other IDs with Google AdMob for advertising.
- *Not collected*: name, email, precise location, contacts, photos, messages.
- Encrypted in transit: yes.
- Data deletion: the app ships a player-reviewed deletion request flow; point
  the deletion URL at the privacy policy.

**Government apps / financial features** - No. The game only simulates money.

**App access** - No login. Reviewer instructions: tap **Play** on the main menu.

## Store listing contact

- Website: https://wrexist.github.io/DeepLifeSimulator/support.html
- Privacy policy: https://wrexist.github.io/DeepLifeSimulator/privacy.html

## Release notes (max 500 per language)

```
First Android release. Start a life at 18, build it across careers, markets,
family and legacy - and pass what you built to your heir.
```
