# Your step-by-step list — shipping v2.8.0

Everything that could be done in the repo is done, verified, and pushed. What
follows is only the work that **requires your accounts, your hardware, or your
judgement**. Nothing here can be done from a container.

Steps are in dependency order. **Step 2 is the one thing currently blocking a
build** — everything else can wait.

---

## Step 1 — Merge the PR

**PR #116** → https://github.com/Wrexist/DeepLifeSimulator/pull/116

Review it, then Squash and merge. CI runs type-check, the test-tree ratchet,
lint, the full suite and an EAS preview update — I'm watching it and will fix
anything that goes red.

*Time: 5 minutes.*

---

## Step 2 — Set the RevenueCat keys in EAS ⚠️ BLOCKING

**This is the only thing stopping a release build.** Preflight fails section 9
with `No receipt verification configured for a production build`. With no
receipt verification, `verifyReceiptWithServer` returns `false` and **every
purchase is refused — paying players get nothing.**

I verified the code is fine by running preflight with throwaway placeholders:
exit 0, 16 passes, 0 failures. Only the real values are missing, and those are
yours — I will never commit a key.

1. Go to **app.revenuecat.com** → your project → **API keys**.
2. Copy the **public** SDK keys (iOS starts `appl_`, Android starts `goog_`).
   Use the *public* keys, never the secret one.
3. In a terminal with the EAS CLI logged in, run:

   ```bash
   eas env:create --scope project --name EXPO_PUBLIC_USE_REVENUECAT \
     --value true --environment production --visibility plaintext

   eas env:create --scope project --name EXPO_PUBLIC_RC_IOS_KEY \
     --value appl_YOUR_REAL_KEY --environment production --visibility sensitive

   eas env:create --scope project --name EXPO_PUBLIC_RC_ANDROID_KEY \
     --value goog_YOUR_REAL_KEY --environment production --visibility sensitive
   ```

4. Confirm with `eas env:list --environment production`.

**Do not put these in `.env` or any committed file.**

*Time: 10 minutes. Blocks: Steps 3, 4, 5.*

---

## Step 3 — Confirm the other production secrets exist

Same command shape as above. Check `eas env:list --environment production`
contains these before building:

| Variable | Why it matters if missing |
|---|---|
| `EXPO_PUBLIC_SAVE_HMAC_KEY` | **Never change this if it is already set.** Rotating it invalidates the signature on every existing save. Set once, never again. |
| `EXPO_PUBLIC_ADMOB_*` (banner + interstitial, iOS + Android) | Ads silently do not serve — pure lost revenue, no error. |
| `EXPO_PUBLIC_FIREBASE_*` | No analytics, so the retention question in Step 8 stays unanswerable. |

*Time: 5 minutes.*

---

## Step 4 — Cut the build

Version is already bumped to **2.8.0** in `package.json`, which is the single
source of truth — `app.config.js` derives the displayed version and iOS
`CFBundleShortVersionString` from it. Nothing else to edit.

```bash
git checkout main && git pull
npm ci
npm run preflight        # must print EXIT 0 — check the exit code, not the banner
eas build --platform ios --profile production
```

**Read the exit code, not the summary line.** Preflight prints a banner that can
say one thing while the command exits non-zero. `echo $?` immediately after.

Do **not** use `eas build --local` for a submission build — it never
auto-increments, and a duplicate `CFBundleVersion` is rejected at submit.

*Time: 5 minutes to start, ~30 minutes for EAS.*

---

## Step 5 — Submit to TestFlight and test the purchase path

```bash
eas submit --platform ios --latest
```

Once processed, install from TestFlight and check these four in order — they are
the things a container cannot verify:

1. **Buy something.** This is the whole reason Step 2 exists. A sandbox purchase
   must complete and grant the item.
2. **Restore purchases** on a second device or after a reinstall.
3. **New game → tap Play.** You should be in a life in two taps, with the coach
   card visible on the home tab pointing you at work.
4. **Load an existing 2.7.0 save.** It must open normally and run at the
   standard pace. Save format is unchanged (v38), so this should just work — but
   it is the highest-blast-radius thing in the release.

*Time: 30 minutes.*

---

## Step 6 — App Store Connect listing

The copy is written and ready to paste — **do not retype it**, the in-app feed
and the store listing are guarded to match.

- Store "What's New" text: `WHATS_NEW.md`, the ```text block under **v2.8.0**.
- Keyword/ASO material: `marketing/aso-v2.7.0-paste-ready.md`.

**Set the App Store Connect version record to `1.4.0`** (or the next number
above your last *released* store version).

⚠️ **Do not set it to 2.8.0 to "match" the binary.** They have never matched and
every release since 1.2.7 shipped that way. Store version numbers can only ever
increase, so setting it to 2.x is a **one-way door** that permanently abandons
the 1.x line. Apple does not compare the two — the only rule is that each store
version beats the last released one.

*Time: 20 minutes.*

---

## Step 7 — Screenshots (only if you want them refreshed)

The four committed store screenshots under `screenshots/app-store/` are still
accurate — nothing in this release changed those screens. **You can skip this.**

If you do want fresh ones, note the capture script was removed with story mode.
`scripts/capture-real-screenshots.mjs` drives the same surfaces but writes
different filenames; `scripts/compose-store-screenshots.mjs` prints exactly
which four files it wants and skips rather than substituting, so a mismatch is
loud rather than silent.

*Time: 0 minutes if skipped.*

---

## Step 8 — One decision I deliberately did not make for you

**Progressive HUD disclosure.** The 3-star review's third point — "make the
mechanics easier to understand" — is the most valuable of the three and the only
one still open.

A new player currently meets, on the HUD alone: health, happiness, energy,
money, savings, gems, generation, age, date, week-of-month, stat trend arrows
and a danger badge. The proposal is to show only health/happiness/energy/money
in the first game year and reveal the rest as they become reachable. Nothing is
removed — it arrives when it means something.

I did not ship it because **it changes what every existing player sees**, not
just new ones. That is a product call, not a correctness one. Candidates are
ranked cheapest-first in `tasks/review-response-2026-08-10.md` §3.

Tell me to do it and I will.

---

## Also worth knowing

**Analytics.** Once 2.8.0 has a week of data, the ad question from the review
becomes answerable: the reviewer wanted ads gone entirely, and I only shipped
the half that measured as a real defect (banners had *no* grace and appeared in
the first session; interstitials already had a two-year one). Watch D1/D7
retention and ARPDAU, then decide with data rather than on one review.

**Two cleanup leads, neither urgent.** 88 exports are referenced only by tests —
that list is what led me to the insurance bug, so it is worth a pass sometime.
And `resolveAbsoluteWeek` has no production caller despite CLAUDE.md naming it
as *the* helper for the absolute clock; documentation and reality have drifted.

**Unrelated to this repo:** the Canva, Sentry and Vercel connectors are showing
as unauthorized in my session. I did not need any of them, but if you want me
using them later, authorize them in your claude.ai connector settings — I cannot
run that sign-in flow from here.
