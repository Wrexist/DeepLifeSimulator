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

The one field that updates **without a review cycle**. Use it for the release.

```
New: Story Mode. Live a whole life in one sitting - one tap, one year. Same simulation, every week still runs in full.
```
`118/170`

---

## 5. What's New

Already written and ready — copy the fenced block from `WHATS_NEW.md` §
"Store 'What's New' (copy-paste ready)". It leads with Story Mode and states
plainly that the simulation is unchanged, which is the objection that would
otherwise stop players choosing it.

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

```bash
npx expo export --platform web --clear --output-dir /tmp/webexport   # --clear matters, see below
npx serve -s -l 8099 /tmp/webexport
CAPTURE_URL=http://localhost:8099 node scripts/capture-story-mode-shots.mjs
node scripts/compose-store-screenshots.mjs
```

| # | Screen | Caption | Status |
|---|---|---|---|
| 1 | Year in Review, a year that went WELL | **A whole life, one sitting** | ⚠️ needs a played save — see below |
| 2 | The pace picker, Story selected | **Choose your pace** | ✅ generated |
| 3 | The HUD | **Your whole life, on one screen** | ✅ generated |
| 4 | Year in Review with the DeepLife+ offer | **Make the next one count** | ⚠️ needs a good year (the offer only fires after one) |
| 5 | Careers / Work tab | **20+ careers. Or a life of crime.** | ✅ generated |
| 6 | Life tab | **Loans have interest. Bills don't forgive.** | ✅ generated |
| 7 | Subscription paywall | **Go deeper** | ✅ generated |

**Why 1 and 4 need you.** The automated capture takes no actions during the
year, so its character is unemployed and broke: the batch hands the year back
after ~7 weeks with "Your life is in trouble" across the Year in Review. That
is a true screenshot of the feature working correctly and a dishonest one under
"A whole life, one sitting" — so the compositor deliberately leaves those two
slots empty and reports the gap rather than shipping an oversell. Capture them
from a save where a year actually went well.

> **`--clear` is load-bearing.** Metro caches the *transformed* module, env
> inlining included, so an export can bake in a stale `EXPO_PUBLIC_SAVE_HMAC_KEY`
> and refuse every save. See the warning in `docs/LAUNCH_CHECKLIST.md` step 3.

Caption typeface is Liberation Sans — there is no brand font in the repo or the
build container. Restyle in `caption()` if you want Inter.

---

## 7. App preview video — 15–30s shot list

Only recordable now that Story Mode exists; a life used to take 3,224 taps, so
there was no way to show an arc in 30 seconds.

1. `0-3s` Character creation, Story Mode selected — **the hook is the pace**
2. `3-8s` One tap → a year passes → Year in Review with money climbing
3. `8-14s` Market crash; net worth drops hard
4. `14-20s` Recovery — career promotion, first property
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
