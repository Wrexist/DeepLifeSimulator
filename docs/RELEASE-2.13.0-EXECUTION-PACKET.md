# 2.13.0 — iOS build + TestFlight execution packet

Written by Master Program 18 (2026-09-06). This exists because the build could
not be run from the agent's environment: it is a Linux container with **no
macOS, no Xcode, no CocoaPods, no `eas-cli` and no Apple credentials** (all
four verified, not assumed). The only real build path is the repository's own
GitHub Actions workflow, which runs on a macOS runner with your credentials —
and the owner triggers that, per `docs/RELEASE_RUNBOOK.md` Part 4.

Everything below is the exact input. Nothing here needs a judgement call.

## 1. What to build

| field | value |
|---|---|
| **branch** | `main` — **only after PR #193 is merged** |
| **PR to merge first** | [#193](https://github.com/Wrexist/DeepLifeSimulator/pull/193) |
| **release SHA** | `5f0c72c` (the PR head; `main` fast-forwards to it) |
| **marketing version input** | **`2.13.0`** — type it exactly |
| **STATE_VERSION** | 51 — unchanged, do not bump |
| **bundle id** | `com.deeplife.simulator` |
| **profile** | `production` (from `eas.json`) |
| **build number** | **do not type one** — `scripts/next-build-number.mjs` mints it from the App Store Connect API, with an epoch fallback |

**Why the merge has to happen first.** `main` is currently missing both
Program 16 fixes — verified by content, not by log: `nativeRestoreLedgerId`
appears 0 times in `services/IAPService.ts` on `main` and 3 times on the release
branch; the `unrenderable` guard in `components/WeddingPopup.tsx` likewise 0 vs 3.
All 71 previous iOS runs were cut from `main`. Dispatching before the merge
ships a 2.13.0 binary without the restore-ledger fix and without the
self-clearing wedding flag.

## 2. How to dispatch

GitHub → **Actions** → **iOS TestFlight (local build · no cloud credits)** →
**Run workflow**, on branch `main`:

| input | set to | why |
|---|---|---|
| `version` | `2.13.0` | Validated against `package.json`; a lower value is rejected. This sets the BINARY version, never the App Store Connect record (which stays on the 1.x line — CLAUDE.md §9) |
| `submit` | **your call** | OFF produces the `.ipa` as a run artifact and proves the whole chain without touching Apple. ON also uploads to TestFlight, which is what the device gates need |
| `wait_for_submission` | leave ON if submitting | Turns "scheduled" into "accepted". A green watch means Apple HAS the build, not that Apple accepted it |

Alternatively `eas build --platform ios --profile production` from a Mac, per
runbook Part 4 — but note `--local` never auto-increments, so you would have to
set `BUILD_NUMBER` yourself.

## 3. Secrets the run consumes

Already configured (the workflow's own `Expo/EAS login` step succeeded on
PR #193's CI run, so `EXPO_TOKEN` is present and valid):

`EXPO_TOKEN` · `EXPO_PUBLIC_SAVE_HMAC_KEY` · `ASC_KEY_ID` · `ASC_ISSUER_ID` ·
`ASC_KEY_P8` · `EXPO_PUBLIC_ADMOB_IOS_APP_ID` · `EXPO_PUBLIC_ADMOB_BANNER_IOS` ·
`EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS` · `EXPO_PUBLIC_ADMOB_REWARDED_IOS` ·
`EXPO_PUBLIC_IAP_VERIFY_URL` · `EXPO_PUBLIC_IAP_VERIFY_TOKEN`

**The RevenueCat keys are NOT GitHub secrets and must not be added as any.**
They live in the EAS `production` environment store, which is why local
preflight can only say "not verifiable locally". Report §18 of
`tasks/release-readiness-2026-09-04.md` records an audit that misread that
warning as evidence of absence and had to retract it.

## 4. This is the first run of a changed gate — watch it

The single most important thing about this build: it is the **first run since
preflight moved inside the EAS production environment**.

```
eas env:exec production "node scripts/preflight-check.js --platform ios" --non-interactive
```

(`.github/workflows/eas-build-local-ios.yml`, step 10, with the EAS login at
step 9.) Preflight §8 and §9 can now **FAIL by name** on a genuinely missing
save-signing or RevenueCat key, where they previously only warned. That is the
point of the change, and it is a louder failure mode than before.

**Success looks like:**

| step | expected |
|---|---|
| `Validate marketing version input` | `::notice::Building marketing version 2.13.0 (package.json currently: 2.13.0)` |
| `Expo/EAS login` | success (it already did on PR CI) |
| preflight via `eas env:exec` | `✅ ALL PREFLIGHT CHECKS PASSED`, **and the job step exits 0** |
| `Resolve build number` | `::notice::expo.version for this build: 2.13.0 (build <N>)` — N minted, not typed |
| `eas build --local` | an `.ipa` at `build/deeplife.ipa` |
| `Upload .ipa artifact` | artifact `deeplife-ios-ipa` attached to the run |
| submit (if on) | submission id printed within ~90 s, then state changes with a 2-minute heartbeat |

**Failure signatures worth recognising:**

- `[FAIL] EXPO_PUBLIC_SAVE_HMAC_KEY` or `[FAIL] EXPO_PUBLIC_RC_IOS_KEY` — the
  key is genuinely absent from the EAS `production` environment. Fix it there
  (`eas env:list --environment production`), **not** by adding a GitHub secret:
  a declared-but-empty `${{ secrets.X }}` is treated as present-and-wrong and
  hard-fails.
- `BUILD_NUMBER must be a positive integer` — something typed a build number.
- `versionCode NaN` ~20 min into Gradle — same cause, Android side.
- ITMS-91064 / **Invalid Binary** *after* a green run — privacy-manifest
  validation, which happens at Apple after upload. `NSPrivacyTracking` must
  stay `false`; an empty `NSPrivacyTrackingDomains` is not a fix.

## 5. Where the build lands

- **`.ipa`**: the run's `deeplife-ios-ipa` artifact, kept 14 days.
- **TestFlight** (if `submit` was on): App Store Connect → DeepLife → TestFlight.
  Confirm the build actually appears there — EAS reporting `FINISHED` means
  Apple received it, not that Apple accepted it.
- Afterwards, `npm run submit:watch -- --platform ios` reports how the
  submission went.

## 6. Device gates once it is installed

The runbook's three first, because each proves a secret was inlined correctly:

1. **The app saves and reloads** → the HMAC key is right.
2. **A sandbox purchase completes** → the RevenueCat key is right.
3. **Character creation renders faces** → the avatar bundle shipped.

Then the list that is specific to this release:

**Purchases (the one ticked risk box on PR #193).**
- Buy a consumable; confirm the grant.
- **The B7 scenario**: buy the Mega Pack (mixed consumable), kill the app
  before the grant lands, relaunch, tap **Restore Purchases**. The permanent
  perks must restore **and the gems must still arrive** — before this fix the
  restore recorded the real store transaction id and the redelivery that would
  have paid the gems was suppressed by our own ledger entry.
- Restore twice more: no duplicate grant.
- Buy the Revival Pack; confirm exactly one banked charge.
- Subscribe; check the RevenueCat dashboard shows `ads_removed` / `premium`.

**Modals (the iOS presentation the static guard cannot prove).**
- Mobile → Spark → Upgrade → **Cancel subscription** — the confirm must appear.
- Pulse → Verified Pro → Cancel — same.
- Death → **Start New Life**; Death → **Revival Pack** → return.
- A wedding → **Continue**.

**Save / life transitions.** Create a life, play several weeks, force-close,
relaunch, confirm exact continuity; then death → new life → relaunch again.

**Accessibility (both are HUMAN-only).** VoiceOver over Home / Apps / Bank Pro;
largest Dynamic Type on the death screen. And **D2**: Accessibility Inspector on
the 8 controls that measured under 44 pt in a browser — `hitSlop` is invisible
to a DOM rect, so that number is a lead, not a defect.

**Ads.** Banner, rewarded, and the failure path (airplane mode) — none may crash
or wedge the screen.

## 7. What is already proven, so you need not re-check it

On `5f0c72c`: 762 suites / 9 629 tests / 0 failed · type-check clean · test-tree
ratchet 0 · lint 0 errors and 716 warnings against a ceiling of 716 · routes 17 ·
ASO/content/live-ops/UI ratchets all green · all five audits EXIT 0 with no
blockers · **`npm run preflight` EXIT 0** · `expo export --platform ios` builds
**3 998 modules / 13.5 MB Hermes**, identical to the runbook's recorded figure ·
determinism replay 5/5 and save/load continuation 3/3 identical.

And on a real rendered build driven in a browser at 430/390/360 pt (Chromium,
not iOS — layout and flow only): 24 checks, 0 failures. 73 ms to first screen,
zero recorded startup failures, exact cold-launch save continuity, a death screen
reading "Age 20 • 4 wks lived", Start New Life and Revive both leaving the player
playable, 0 px horizontal overflow on every tab at every width, and no wedged
state after twelve rapid week taps, ten modal open/close cycles or a kill
mid-save.
