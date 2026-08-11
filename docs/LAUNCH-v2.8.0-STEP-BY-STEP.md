# Launching v2.8.0 — step by step

Everything in the repo is done, merged and verified. This is only what needs
your logins, your device, or a decision.

**Read this first — it changes the order of everything below.**

**iOS can ship this week. Android cannot ship for at least three weeks**, and
the reason is not the code. Google requires a new developer account to run a
closed test with **12+ testers for 14 continuous days** before the Production
track unlocks, and that clock cannot start until a build is on a track. Nothing
about that is negotiable or speedable.

So: **ship iOS now, start the Android clock in parallel today.**

---

# Track A — iOS (can complete in ~2 days)

## Step A1 · Confirm the EAS variables — 2 minutes

I could not check this from here (no EAS login), and I need to correct
something I told you earlier: I said the RevenueCat key was *the* blocker.
Reading `docs/REVENUECAT-TODO.md`, **the iOS key is recorded as already set**.
Preflight failed in my container only because a bare clone has no EAS
variables — that is expected, not a defect.

Verify rather than trust either of us:

```bash
eas env:list --environment production
```

You want to see these three:

| Variable | If missing |
|---|---|
| `EXPO_PUBLIC_RC_IOS_KEY` | Every purchase is refused. Paying players get nothing. |
| `EXPO_PUBLIC_SAVE_HMAC_KEY` | Production builds refuse to sign saves. **If it is already there, do not touch it** — rotating invalidates every existing save. |
| `EXPO_PUBLIC_ADMOB_*` | Ads silently never serve. No error, just no revenue. |

Only if one is genuinely missing:

```bash
eas env:create --scope project --name EXPO_PUBLIC_RC_IOS_KEY \
  --value "appl_YOUR_KEY" --environment production --visibility plaintext
```

The `appl_…` key is at app.revenuecat.com → Apps → iOS app → API keys. Use the
**public** SDK key, never the secret one. Never put it in a committed file.

## Step A2 · Check the iOS in-app purchases exist — 20 minutes

This is the step most likely to bite you, because it fails *after* review
rather than at upload.

App Store Connect → your app → **Monetization → In-App Purchases**. Every
product in `docs/REVENUECAT-TODO.md` §2a must exist **and be submitted for
review** — products that are only created never appear, even in sandbox.

Two naming traps recorded in that doc, worth re-reading before you type
anything: iOS uses `deeplife_mindset_perk` where Android uses
`deeplife_mindset`, and the revival pack ID must match whatever
`lib/config/iapConfig.ts` actually says. **Apple permanently reserves a deleted
product ID**, so a typo is not recoverable — you lose that string forever.

Then in RevenueCat: **Offerings** → confirm a `default` offering exists with
the monthly and yearly packages attached. §1f of that doc lists it as not yet
done, so assume it needs doing.

## Step A3 · Build — 5 minutes, then ~30 waiting

```bash
git checkout main && git pull
npm ci
npm run preflight; echo "EXIT=$?"
```

**Read the `EXIT=` line, not the summary banner.** Preflight prints a banner
that can say one thing while the command exits non-zero — I was fooled by
exactly that twice during this work. `EXIT=0` is the only thing that counts.

If preflight fails on section 9 (`No receipt verification configured`), that is
Step A1 not done. Go back.

```bash
eas build --platform ios --profile production
```

Do **not** use `--local` for a submission build. It never auto-increments the
build number, and a duplicate `CFBundleVersion` is rejected at submit.

The version is already `2.8.0` in `package.json`, which is the single source of
truth — `app.config.js` derives everything from it. Nothing to edit.

## Step A4 · TestFlight, and the four things only a device can prove — 30 minutes

```bash
eas submit --platform ios --latest
```

Once it processes, install from TestFlight and check these in order:

1. **Buy something with a sandbox account.** Create the tester in App Store
   Connect → Users and Access → Sandbox Testers first. A purchase must complete
   *and* grant the item. This is the whole reason Step A1 exists.
2. **Restore purchases** after deleting and reinstalling.
3. **Tap Play from a cold start.** You should be in a life within two taps,
   with the coach card on the home tab pointing you at work. This is the
   headline change of the release — if it does not appear, stop and tell me.
4. **Load an existing 2.7.0 save.** It must open normally and advance one week
   per tap. The save format is unchanged (v38) so it should just work — but it
   is the single highest-blast-radius thing in this release, and the one I
   cannot test from here.

## Step A5 · The store listing — 45 minutes, highest-value hour you have

The ad data says the product page is the bottleneck: tap-through runs at
**2.4× the Games benchmark** while page conversion sits at **0.6×**. People
want this game and then do not install it. Fixing the page is worth roughly
**+65% installs at identical spend**, before a dollar of new budget.

**Everything below is written and committed. Copy it, do not retype it.**

- **Subtitle, keywords, promotional text, What's New** →
  `marketing/app-store-localizations/en-US.md`.
  ⚠️ **I rewrote the promotional text and What's New today.** The committed
  copy was still selling Story Mode, which no longer exists — pasting it would
  have advertised a removed feature, which is an App Review rejection risk
  under guideline 2.3 (accurate metadata). Same fix applied to en-CA and en-GB.
  All 41 locale files pass `node marketing/app-store-localizations/validate.js`.
- **Screenshots** → `screenshots/appstore-2026/`, 10 each at `iphone-6.9`,
  `iphone-6.5`, `ipad-13`. I checked these: none showed the pace picker, so
  they are all still accurate. **No re-shoot needed.**
- **App Preview video** → the single biggest conversion lever, and still
  unshot. Script: `marketing/app-preview-video-script.md`. ⚠️ **I rewrote this
  today too** — the old one opened on the Story Mode pace picker and three of
  its ten shots were unshootable. The new opening is the two-tap start, which
  is a stronger hook anyway because it answers the objection that actually
  stops installs.
- **Replace the placeholder social preview image.** The App Store link
  currently previews as an Apple placeholder, so every share on iMessage,
  Discord, X or Reddit renders broken — including the obituary shares.

### ⚠️ The version number, and a discrepancy you need to resolve

Set the App Store Connect **version record**, which is a different number from
the binary. Two committed docs disagree about what it should be:

- `CLAUDE.md` §9 says 1.3.5 is live and **1.4.0** is next.
- `docs/RELEASE-2.7.0-SUBMISSION.md` says next is **1.5.0**.

They disagree because 2.7.0 may or may not have actually been submitted. **Look
at App Store Connect and pick the next number above your last *released*
version.** I cannot see that from here and will not guess.

**Do NOT set it to 2.8.0 to match the binary.** They have deliberately differed
since 1.2.7. Store version numbers can only ever increase, so matching them is
a one-way door that permanently abandons the 1.x line. Apple never compares the
two — the only rule is that each store version beats the last released one.

## Step A6 · Submit

Attach the build, submit for review. Apple typically answers in 24–48h.

If it comes back rejected on metadata, the usual cause is a purpose string. The
one this app ships (`NSUserTrackingUsageDescription`) is written by the
`expo-tracking-transparency` plugin and is already guarded by preflight §5c —
so it should pass, but note that a metadata rejection also returns **every
attached IAP marked "Rejected"** even when nothing is wrong with them. That is
normal. Resubmit them with the next build.

---

# Track B — Android (start today, ships in ~3+ weeks)

Do **Step B1 today**, in parallel with everything above. It starts a clock you
cannot shorten.

## Step B1 · Upload any build to any track — today

Right now the app exists in Play Console with **zero builds on any track**. That
blocks everything else: Google will not let you create a single subscription or
one-time product until a build carrying the billing permission is on a track.

```bash
eas build --platform android --profile production
eas submit --platform android
```

Or download the `.aab` and upload it manually under **Play Console → Test and
release → Internal testing → Create new release**.

## Step B2 · Start the 14-day closed test — the same day

Your Play developer account has no Production access yet. Google requires
**12+ opted-in testers on a closed track for 14 continuous days** before
Production unlocks. The clock starts when the build is live on that track, so
every day you wait on Step B1 is a day added here.

Recruit the 12 now. They must actually opt in — an invite that is never
accepted does not count.

## Step B3 · The Google Play service account JSON — 20 minutes

Until this is uploaded, RevenueCat **cannot validate a single Android
purchase**. Full click-by-click steps are in `docs/REVENUECAT-TODO.md` §1c.
Summary: create the service account in Play Console → Setup → API access,
grant it *view financial data* and *view app information*, download a JSON key
from Google Cloud Console → IAM → Service Accounts → Keys, then upload it at
app.revenuecat.com → Apps → Deep Life Simulator (Play Store).

## Step B4 · Set the Android RevenueCat key — 1 minute

The key already exists in RevenueCat; it just was never pushed to EAS:

```bash
eas env:create --scope project --name EXPO_PUBLIC_RC_ANDROID_KEY \
  --value "goog_YOUR_KEY" --environment production --visibility plaintext
```

Get the current value from RevenueCat → Apps → Play Store app → Show key rather
than from any doc — a key pasted into a committed file is a key that has been
published.

## Step B5 · Create the Android products — after B1 unlocks the screens

`docs/REVENUECAT-TODO.md` §3a–3d. Same product list as iOS **except** use
`deeplife_mindset`, not `deeplife_mindset_perk`. Every product must be set to
**Active**, then imported into RevenueCat and attached to the `premium` /
`ads_removed` entitlements.

## Step B6 · Android Developer Verification — before September 2026

`com.deeplife.simulator` is registered as a **Draft** under Play Console →
Android developer verification. To finish it Google needs the **SHA-256
fingerprint of your signing certificate**, which only exists once you have
built and signed. After Step B1, get it from `eas credentials` (Android →
production → keystore) or Play Console → Test and release → App integrity →
App signing, then paste it into the draft.

Not launch-blocking today. It becomes blocking for installs on certified
devices in September 2026.

---

# One decision, not a task

**Progressive HUD disclosure.** The 3-star review's third point — "make the
mechanics easier to understand" — is the most valuable of the three and the
only one still open.

A new player currently meets, on the HUD alone: health, happiness, energy,
money, savings, gems, generation, age, date, week-of-month, trend arrows and a
danger badge. The proposal is to show only health/happiness/energy/money in the
first game year and reveal the rest as they become reachable. Nothing is
removed — it arrives when it means something.

I did not ship it because **it changes what every existing player sees**, not
just new ones. That is a product call, not a correctness one. Ranked
cheapest-first in `tasks/review-response-2026-08-10.md` §3.

Say the word and I will build it.

---

# After launch

**Watch D1/D7 retention and ARPDAU for a week.** That is when the ad question
from the review becomes answerable with data. The reviewer wanted ads gone
entirely; I shipped only the half that measured as a real defect — banners had
*no* grace and appeared in the first session, while interstitials already had a
two-year one. Whether to go further is a decision to make on numbers, not on
one review.

**Two cleanup leads, neither urgent.** 88 exports are referenced only by tests
— that list is what led me to the insurance bug, so it is worth a pass
sometime. And `resolveAbsoluteWeek` has no production caller despite CLAUDE.md
naming it as *the* helper for the absolute clock; documentation and reality
have drifted.

---

# What is already done — so you do not redo it

| | |
|---|---|
| Code | v2.8.0 merged to `main` (PR #116) |
| Tests | 6,605 passing, 1 skipped, 0 failures |
| Type-checks | both at 0 |
| Lint | 1,186 against a 1,193 ceiling |
| Weekly audit | 53 invariants + the new G5, all green |
| Preflight | exit 0 with production env present |
| Store copy | rewritten for 2.8.0, all 41 locales validate |
| Screenshots | committed and still accurate |
| Video script | rewritten for 2.8.0 |
| In-app changelog | 2.8.0 entry, guard suite passing |
