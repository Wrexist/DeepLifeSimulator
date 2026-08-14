> # ⚠ SUPERSEDED — do not paste from this file
>
> Replaced by **`marketing/aso/`**, where the copy lives in `metadata.mjs` as
> data and every character count is measured by `scripts/check-aso.mjs` at the
> moment it prints, instead of being written by hand next to the copy.
>
> ```bash
> npm run aso        # audit, then print every field ready to paste
> npm run check:aso  # audit only
> ```
>
> Two defects in this document are why it was replaced, and both are the kind
> prose cannot catch:
>
> 1. Its subtitle, `Rags to riches money life sim`, spent eight of thirty
>    characters re-indexing **life** and **sim** — both already in the app name
>    *Deep Life Simulator*, therefore already indexed — under a heading in this
>    same file that says never to do that.
> 2. Its description claimed **no forced ads** and **no pay-to-win**. Neither is
>    true of this build: `lib/ads/interstitial.ts` shows full-screen ads at
>    in-game year boundaries, and `utils/iapConfig.ts` sells permanent earnings
>    multipliers for money.
>
> The sections below on screenshots, the preview video and the version-number
> rule are still accurate and were carried across.

# App Store Connect — v2.7.0, paste-ready

Every field below is final copy with a **verified** character count. Nothing here
needs writing or editing; it needs pasting. Counts were measured
programmatically, not eyeballed, because Apple truncates silently and a subtitle
one character over is a subtitle that ends mid-word on the product page.

> **Why this changed:** the funnel data says top-of-funnel is excellent and the
> product page is the leak. Category-Exact taps at **18.82% against a 7.72%
> Games benchmark (2.4×)**, but converts at **40% against a 66.2% benchmark**.
> Fixing the page is worth roughly **+65% installs at identical ad spend** —
> before adding a dollar of budget. That is what these fields are for.

---

## 1. Title — unchanged

```
Deep Life Simulator
```
`19/30` · Already ranks on "deep life". Do not touch it.

---

## 2. Subtitle — **CHANGE THIS**

The subtitle is **indexed for search**. The current one,
`Real Economics. Real Choices.`, contains **zero searchable keywords** — it is
positioning copy in a slot that Apple treats as a keyword field.

**Use this:**
```
Rags to riches money life sim
```
`29/30` · Adds five indexed terms: **rags · riches · money · life · sim**.

<details><summary>Alternatives, if the tone is wrong</summary>

```
Money, careers, crime, legacy
```
`29/30` · Adds money, careers, crime, legacy. Broader, less aspirational.

```
Get rich, build a dynasty
```
`25/30` · Strongest fantasy, fewest keywords. Only pick this if the others feel off-brand.
</details>

---

## 3. Keyword field — **CHANGE THIS**

```
tycoon,billionaire,dynasty,crime,mafia,stocks,crypto,idle,career,empire,invest,wealth,fortune,story
```
`99/100`

Rules this already obeys, each of which wastes the field if broken:
- **No spaces after commas.** A space costs a character and buys nothing.
- **No word repeated from the title or subtitle.** Apple already indexes those,
  so repeating them throws away the slot. Verified: zero collisions.
- **No competitor brand names.** "bitlife" and similar are a **2.3.7 rejection
  risk**, and you already outrank on your own terms.
- Singular forms only — Apple matches plurals automatically.

---

## 4. Promotional text — **CHANGE THIS**

The one field that updates **without a review cycle**.

```
Build a life from nothing: careers, crime, markets, property and family - then hand it all to an heir, along with every mistake.
```
`128/170` · Counted programmatically, not eyeballed.

---

## 5. What's New

Already written and ready — copy the fenced block from `WHATS_NEW.md` §
"Store 'What's New' (copy-paste ready)".

---

## 6. Screenshots — order and captions

The first two are the only ones most people see. They must tell the story
**without sound and without context**, so each carries a caption burned into the
image rather than relying on the screenshot alone.

Dark UI on a bold flat background, caption top-aligned, one idea per shot.

**Most of these are already built.** `scripts/compose-store-screenshots.mjs`
composites real app captures into upload-ready 1290×2796 PNGs in
`screenshots/app-store/`. It uses screenshots the app actually produced rather
than recreations, so what the store shows is by construction what ships.

The four composed PNGs are committed, so nothing below needs re-running to
ship. It is only for re-capturing after the screens change:

```bash
npx expo export --platform web --clear --output-dir /tmp/webexport   # --clear matters, see below
npx serve -s -l 8099 /tmp/webexport
CAPTURE_URL=http://localhost:8099 node scripts/capture-real-screenshots.mjs
node scripts/compose-store-screenshots.mjs
```

The capture step used to be `capture-story-mode-shots.mjs`, which was removed
with story mode. `capture-real-screenshots.mjs` drives the same surfaces but
writes `screenshots/iphone-real/` under different names, so the compositor's
four inputs have to be copied into `screenshots/story-mode/` (or `IN` repointed)
before the second command finds them. It reports exactly which files it wanted
and skips rather than substituting, so a mismatch is loud.

| # | Screen | Caption | Status |
|---|---|---|---|
| 1 | The HUD | **Your whole life, on one screen** | ✅ generated |
| 2 | Work › Career tab | **20+ careers. Or a life of crime.** | ✅ generated |
| 3 | Life › Market tab | **Every dollar is a decision** | ✅ generated |
| 4 | Subscription paywall | **Go deeper** | ✅ generated |

**Four shots, all generated.** A fifth showed the story-mode pace picker; story
mode was removed after playtesting, so that screen no longer exists and the
shot went with it. Do not re-add a screenshot of a feature that is not in the
build — that is the exact oversell the compositor's skip-and-report rule exists
to prevent.

> **`--clear` is load-bearing.** Metro caches the *transformed* module, env
> inlining included, so an export can bake in a stale `EXPO_PUBLIC_SAVE_HMAC_KEY`
> and refuse every save. See the warning in `docs/LAUNCH_CHECKLIST.md` step 3.

Every caption was checked against the image beneath it. The Life shot's
original caption — "Loans have interest. Bills don't forgive." — is true of
the game but not visible in the Market screen, so it was rewritten rather
than left as a claim a visitor cannot verify from the picture.

Caption typeface is Liberation Sans — there is no brand font in the repo or the
build container. Restyle in `caption()` if you want Inter.

---

## 7. App preview video — 15–30s shot list

1. `0-3s` Character creation — the fantasy, before a single number
2. `3-8s` First job, first paycheque, first bill
3. `8-14s` Market crash; net worth drops hard
4. `14-20s` Recovery — promotion, first property
5. `20-26s` Death screen, obituary
6. `26-30s` Heir begins, Gen 2 — **end on the loop, not on a logo**

No voiceover. Captions only; most autoplay views are muted.

---

## 8. Also in App Store Connect

- **Replace the placeholder social preview image.** Every share of the App Store
  link currently renders an Apple placeholder — on Discord, iMessage, X and
  Reddit alike. This is the cheapest fix on the list.
- **Submit a featuring nomination.** Solo developer, rebuilt the in-game
  economy from player feedback, no forced ads, no pay-to-win. Free, ~15 minutes,
  and Apple editorial actively looks for that story.

---

## 9. Do not do this

**Do not raise the App Store Connect version to match the binary.** The store
record (1.x) and `package.json` (2.7.0) have been different on purpose since
1.2.7. Apple never compares them — the only rule is that each store version
beats the last released one. But store versions can only ever increase, so
setting the record to 2.7.x is a one-way door that permanently abandons the 1.x
line. See `CLAUDE.md` §9.
