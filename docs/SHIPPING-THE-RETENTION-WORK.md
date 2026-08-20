# Shipping the retention work — owner checklist

Everything you need to do for the retention + analytics release, in order.

**This is not a second release runbook.** `docs/RELEASE_RUNBOOK.md` is the
authority for cutting a build and filling in App Store Connect, and it stays
that way. This document covers only what is *specific to this change*: the
verification steps that would otherwise be skipped, the one App Store Connect
task the offer rotation needs, and what to measure afterwards.

Time: about **40 minutes of your attention**, spread across ~2 hours of waiting.

---

## Step 1 · Merge the PR

- [ ] Review and merge **[PR #148](https://github.com/Wrexist/DeepLifeSimulator/pull/148)**

Nothing else in this document works until this is on `main`.

Two automated reviewers commented and **neither reviewed**: Codex hit its usage
limit, and CodeRabbit skips repositories under 10 stars. Don't read their
presence as a review having happened.

**CI does run on this PR**, and both checks passed:

| Check | Trigger | Result |
|---|---|---|
| `eas-update` | every PR to `main` | ✅ success |
| `preflight` | PRs touching `app.config.js`, `eas.json`, `package.json`, `app/entry.ts`, `app/_layout.tsx`, `assets/**`, or the preflight script | ✅ success |

`preflight` fired here because this branch touches `app/_layout.tsx` (and the
merge with `main` brought a `package.json` change). That is the real gate — a
green preflight means native config, the privacy manifest and the purpose
strings all validated. The build workflow in Step 3 re-runs type-check, lint,
tests and preflight again before it builds anything.

---

## Step 2 · Bump the version

- [ ] Edit `version` in `package.json`: **`2.9.0` → `2.10.0`**
- [ ] Commit and push to `main`

`2.10.0` rather than `2.9.1` because this adds features rather than fixing a
bug. The exact number matters less than it going **up** — TestFlight and crash
reports are ordered by it.

> ⚠️ **Do NOT touch the App Store version record here.** That is a separate
> number (`storeVersion: '1.5.0'` in `marketing/aso/metadata.mjs`) and it has
> never matched the binary. Raising the store record to 2.x is a one-way door
> that permanently abandons the 1.x line — Apple only lets store versions
> increase. CLAUDE.md §9 has the full reasoning. Step 7 handles the store
> record properly.

---

## Step 3 · Build to TestFlight

- [ ] GitHub → **Actions** → **iOS TestFlight (local build · no cloud credits)** → **Run workflow**
- [ ] `version`: **`2.10.0`** (must match what you set in Step 2)
- [ ] Leave **Submit the build to TestFlight** ticked
- [ ] Leave **Watch the submission** ticked

The workflow runs route-conflict, type-check, lint, tests and preflight before
it builds, so a failure there is a real signal, not flakiness.

Expect **~40 minutes**, most of it waiting. The submission step alone takes
10–25 minutes and a quiet log is normal — it heartbeats every two minutes.
**Do not cancel and rebuild**; a rebuild mints a new `CFBundleVersion` for
nothing.

> 🟡 A green watch step means Apple *has* the build, not that Apple *accepted*
> it. Validation runs afterwards and is where privacy-manifest and
> purpose-string rejections surface — by email, and as **Invalid Binary** in App
> Store Connect. Confirm the build actually appears in TestFlight before
> treating it as shipped.

---

## Step 4 · Verify on the device 🔴

This is the step that cannot be skipped, because **four of the six defects
fixed in this PR were invisible to the test suite.** They needed someone to
look.

### 4a · The standing three (any release)

- [ ] The app **saves and reloads** — proves the HMAC key inlined correctly
- [ ] A **sandbox purchase completes** — proves the RevenueCat key is right
- [ ] **Character creation renders faces** — proves the avatar bundle shipped

### 4b · New in this release

- [ ] **Home screen** shows a "WHAT NEXT / Your next moves" card with NOW / SOON / DREAM
- [ ] Tapping a goal **navigates to the right tab**
- [ ] The **shop button in the HUD is gold** and shines about every 5 seconds
- [ ] Open the shop → **"This week: <pack name>"** row is visible on the tab you land on (Featured)
- [ ] Tap it → the **Offer Center** opens showing last / this / next week
- [ ] The featured offer shows **pack art, three benefit lines, and a value line**
- [ ] **The price appears ONCE per card** — on the button only, e.g. `BUY · $9.99`
- [ ] On the **Upgrades** tab, gem costs still appear on the left (their buttons say "Redeem" / "Not enough gems")

> The price-once fix is the one thing I could not photograph. A web build has
> no StoreKit, so every button reads "UNAVAILABLE" there and the left-hand price
> correctly stays. The `BUY · $X` case only exists on a real device — please
> actually look at it.

### 4c · Things that will legitimately look "missing"

Not bugs. Do not report these:

- **No `SAVE %` badge on the offer.** Correct until Step 6 is done.
- **No "week ahead" card on a brand-new save.** It only appears when something
  is actually scheduled — a degree in progress, a loan, a pregnancy, arrears.
  Play a few weeks or start a scenario with a loan.
- **No goal-reached banner unless you reach one during the session.** It is
  deliberately not replayed on a cold start.

---

## Step 5 · Confirm analytics is actually recording 🔴

**Do this before anything else in the release goes further.** The whole point
of this change is that the funnel was silently dead in production; if it is
still dead, everything downstream is guesswork.

- [ ] On the TestFlight device, **allow tracking** when the ATT prompt appears
      (analytics is consent-gated — deny and it stays a no-op, correctly)
- [ ] Firebase Console → **Analytics → DebugView**
- [ ] Confirm you see **`session_start`** with properties `dayIndex`,
      `daysSeen`, `sessions`, `anchorEstimated`
- [ ] Confirm you see **`retention_day`** on the first launch
- [ ] Advance a week and confirm **`week_advanced`**
- [ ] Open the Offer Center and confirm **`offer_center_opened`** and
      **`offer_shown`**

If none of these appear, stop and tell me — that means the gate fix did not
take, and shipping further just loses more data.

> To enable DebugView on a device you normally need the debug flag set. If that
> is awkward on a TestFlight build, the fallback is to check the standard
> Analytics dashboard 24 hours after release and confirm `session_start` has a
> non-zero count with the new properties attached.

---

## Step 6 · Schedule the first offer price change 💰

**Until you do this, the weekly rotation runs but no discount badge ever
appears.** The app cannot create a sale — it can only report the price Apple
charges, and refuses to claim a discount it cannot prove.

Full procedure: **`docs/IAP-PRICE-ROTATION.md`**. Short version:

- [ ] Decide which week to run. Offers rotate **Monday 00:00 UTC**; the Offer
      Center's "Next week" row tells you which pack is up.
- [ ] App Store Connect → your app → **Monetization → In-App Purchases**
- [ ] Open the SKU for that week
- [ ] Next to **Price Schedule** → **+** → **Temporary Price Change** → Next
- [ ] **Start date** = that Monday · **End date** = the following Monday
- [ ] Pick the reduced price and the countries
- [ ] Save (allow up to 24h to propagate)

The price reverts by itself at the end date. No app change, nothing to switch
off in code.

> ⚠️ If you change a product's **regular** price at any point, update
> `regularPriceUSD` in `lib/offers/catalogue.ts` **and** `price` in
> `utils/iapConfig.ts` in the same commit. A test fails if they disagree,
> because a drift there either invents a permanent fake discount or hides a
> real one.

---

## Step 7 · Release to the App Store

Follow **`docs/RELEASE_RUNBOOK.md` Parts 5–9** — metadata, screenshots,
submission. Nothing about this change alters that procedure.

The only decision specific to this release:

- [ ] Bump the **store version record**: `storeVersion` in
      `marketing/aso/metadata.mjs`, `1.5.0` → **`1.6.0`**
- [ ] Write the "What's New" copy in the same file
- [ ] GitHub → Actions → **App Store Connect — release** to apply it

Suggested "What's New", in the game's voice — edit freely:

> Your life now tells you what's next. A new card reads your actual situation
> and suggests what to work toward now, soon, and someday. The weeks ahead are
> visible too: see your graduation, your loan payoff, a baby due, or a bill
> coming before it lands. Plus a weekly featured offer that rotates every
> Monday, so you always know what's on and what's next.

---

## Step 8 · Wait, then read the numbers 📊

**The retention curve starts from this release.** No install timestamp exists
in the app's history and none can be recovered, so every player who installed
before this build is flagged `anchorEstimated: true` and must be excluded. Any
number computed over the existing install base before now is fiction.

That means **the clock starts the day you ship**, and every week you wait is a
week of cohort data you cannot get back later.

| When | What to look at |
|---|---|
| **Day 2** | `retention_day` with `dayIndex = 1` — your first real D1 |
| **Day 8** | `dayIndex = 7` — first D7 |
| **Week 2** | `goal_tapped` vs `week_ahead_shown` — is the direction card being used, or just seen? |
| **Week 2** | `offer_center_opened` → `offer_cta_tapped` → `purchase_succeeded` — the offer funnel |
| **Day 31** | `dayIndex = 30` — first D30 |

**Filter `anchorEstimated = true` out of both the numerator and the
denominator.** `docs/RETENTION-ANALYTICS.md` has both standard retention
formulas and the cohort-size query.

Benchmarks to compare against (classic day-N, from
`tasks/retention-and-content-strategy-2026-06-19.md`): industry average
**D1 ≈ 26%, D7 ≈ 10%, D30 < 4%**; top casual titles **D1 35%+, D7 12%+**.

---

## The short version

| # | Do | Where | Time |
|---|---|---|---|
| 1 | Merge PR #148 | GitHub | 5 min |
| 2 | `package.json` → `2.10.0` | repo | 1 min |
| 3 | Run the iOS TestFlight workflow | Actions | 40 min (waiting) |
| 4 | Device checks 🔴 | TestFlight | 10 min |
| 5 | Confirm analytics records 🔴 | Firebase DebugView | 5 min |
| 6 | Schedule a temporary price change 💰 | App Store Connect | 5 min |
| 7 | Store metadata + submit | runbook Parts 5–9 | 30 min |
| 8 | Read the numbers | Firebase | D+2, D+8, D+31 |

**Steps 4 and 5 are the ones that actually matter.** Everything else is the
normal release. Those two are where this release either works or silently
does not, and neither can be verified from here.
