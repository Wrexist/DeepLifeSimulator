# Your first Google Play release - the clean path (you already know App Store Connect)

If you know App Store Connect, you know 90% of this. Play just uses different
words and a different order. Do this top to bottom and you cannot get stuck.

## 1. Translation table (Apple -> Play)

| App Store Connect | Google Play Console |
|---|---|
| Your app | Your app (same idea) |
| TestFlight | **Internal testing** (a "track") |
| App Privacy answers | **Data safety** |
| Age rating | **Content rating** (IARC questionnaire) |
| Keywords field (100 chars) | **There is NO keyword field.** Ranking comes from the **title (30)**, **short description (80)** and **long description (4000)**. So put your keywords in the long description naturally. |
| Promotional text | **Does not exist.** |
| App icon 1024x1024 | **Icon 512x512** |
| Screenshots 6.5"/6.9" | **Phone screenshots**, aspect ratio max 2:1 |
| Build (Xcode/EAS) | **Android App Bundle (.aab)** |
| "Submit for review" | **Production release** (review can take hours to days) |

You do **not** need a Mac, Xcode, or the service account for your first release.
The AAB is already built and uploaded.

## 2. The order Play requires (do not skip ahead)

**A. Store settings** (left menu: *Grow / Store presence*)
- App name, category, contact email, privacy policy URL.

**B. App content** (left menu: *Policy -> App content*) - all of it is required
before any release publishes:
1. Privacy policy
2. App access (no login)
3. Ads (yes)
4. Content rating
5. Target audience (13+)
6. Data safety
7. Government apps (no)
8. Financial features (no)

**C. Store listing** (*Grow -> Store presence -> Main store listing*)
- Text + icon + feature graphic + screenshots.

**D. Test** (*Test -> Internal testing*)
- Create release, add testers, install on your phone.

**E. Production** (*Release -> Production*) - only when the internal test looks good.

## 3. Copy-paste values

**App name (30 max)**
```
Deep Life Simulator: Tycoon
```

**Short description (80 max)**
```
Career, crime, stocks and property. Build a fortune, then pass it on.
```

**Full description** - copy the whole block from
`marketing/aso/metadata.mjs` -> `PLAY.longDescription` (it is already written for
Play keyword indexing). Paste it into the store listing.

**Category:** Simulation. **Tags:** Simulation, Casual.

**URLs**
- Privacy policy: `https://wrexist.github.io/DeepLifeSimulator/privacy.html`
- Website / support: `https://wrexist.github.io/DeepLifeSimulator/support.html`

**Graphics**
| Play field | File | Size |
|---|---|---|
| App icon | `marketing/play-store/icon-512.png` | 512x512 |
| Feature graphic | `marketing/play-store/feature-graphic-1024x500.png` | 1024x500 |
| Phone screenshots (2-8) | `marketing/play-store/screenshots/*.png` | 1080x1920 |

## 4. App content answers (copy from `marketing/play-store/listing.md`)

- **Ads:** Yes, contains ads.
- **App access:** No login. Reviewers tap **Play** on the menu.
- **Target audience:** 13+ (not for children).
- **Content rating:** answer the questionnaire honestly - crime and simulated
  gambling (stocks/crypto) are present, plus mild dating/alcohol.
- **Data safety:** collected = App activity + Device/other IDs; shared (ads) with
  Google; encrypted in transit; deletion via the in-app request flow.
- **Government / financial features:** No, no.

## 5. Common first-timer mistakes

1. Looking for a keywords field. There isn't one - keywords live in the long
   description.
2. Uploading the **iOS** screenshots (2.17:1). Play rejects above 2:1 - use the
   1080x1920 set in `marketing/play-store/screenshots/`.
3. Skipping **App content**. Play blocks publishing until it is complete.
4. Uploading an APK instead of an AAB. Use the `.aab` already built.
5. Reusing the iOS version number. Android has its own **versionCode** (ours is
   **114**) that must only ever increase.

## 6. Where you are right now

Done already: app created, AAB uploaded to the Internal testing release, Play
icon + feature graphic + 8 screenshots + all listing copy and content answers
prepared.

Left: fill the forms in section 2 (A-D), then install from the tester link.

**Next step:** in Play Console, finish **Policy -> App content** first (it is the
gate every other step waits on). Tell me if any screen asks something you are
not sure about and I will answer it exactly.
