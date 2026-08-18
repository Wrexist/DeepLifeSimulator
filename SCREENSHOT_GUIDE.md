# App Store Screenshot Guide — DeepLife Simulator

**The screenshots are built by a script, not captured by hand.** If you are here
to get images to upload, you do not need this file — you need
[`screenshots/README.md`](./screenshots/README.md), which names the three
ready-to-upload folders.

This file covers the surrounding rules: what Apple requires, and how to upload.

> **History.** Until 2026-08 this document described capturing frames by hand in
> the iOS Simulator, listed the 6.5" display as Apple's required size, and
> carried a "❌ Current screenshots are outdated (Apple's feedback)" status from
> the Guideline 2.3.3 rejection that prompted it. All three statements are now
> false: capture is automated, 6.9" is Apple's required base size, and the set
> was rebuilt from the shipping UI. It is rewritten rather than deleted because
> six documents link here.

---

## What to upload

| Upload to | Folder | Size |
|---|---|---|
| **iPhone 6.9" (required)** | `screenshots/appstore-2026/iphone-6.9/` | 1320 × 2868 |
| iPhone 6.5" | `screenshots/appstore-2026/iphone-6.5/` | 1284 × 2778 |
| iPad 13" | `screenshots/appstore-2026/ipad-13/` | 2064 × 2752 |

Ten frames each, uploaded **in filename order** (`01…` first). Apple down-scales
the 6.9" set to every smaller iPhone class, so those three cover the store.

Rebuild after a design change — takes about a minute, no device needed:

```bash
node scripts/generate-appstore-2026-set.mjs    # iPhone 6.9" + 6.5"
node scripts/generate-appstore-2026-ipad.mjs   # iPad 13"
```

Full pipeline, including re-capturing from a running app when the UI itself has
changed, is in [`screenshots/appstore-2026/README.md`](./screenshots/appstore-2026/README.md).
Design rationale is in [`docs/store-screenshot-design.md`](./docs/store-screenshot-design.md).

---

## Apple's requirements

Screenshots must:

- show the **current version** of the app in use — this is **Guideline 2.3.3**,
  and it is what this app was rejected under once already
- show core functionality, not splash or login screens
- match the real UI; marketing text may frame a capture but must not obscure it
- be correct for each size class, 5–10 per class

The reason the generated set satisfies 2.3.3 is that every frame contains a real
capture of the shipping build, driven through the app by Playwright. Hand-mocked
or HTML-faked screens would not.

## Uploading to App Store Connect

1. **My Apps → DeepLife Simulator → the version you are preparing**
2. **Media Manager**, pick the device class, drag the ten files in
3. Repeat per device class. Confirm the order survived the upload — the first
   two images are the only ones most visitors ever see
4. Localizations: the same images serve every locale unless you have localized
   art. Metadata per locale lives in `marketing/app-store-localizations/`
5. **Save**

## Before submitting

- [ ] All three device classes populated, ten images each, `01` first
- [ ] Images show the version being submitted, not an older build
- [ ] No placeholder or dev-tools state visible in any frame
- [ ] Store metadata matches what the screenshots show (`marketing/aso/metadata.mjs`)
- [ ] `docs/RELEASE_RUNBOOK.md` followed top to bottom for the rest of the release

## If something is wrong

| Symptom | Cause |
|---|---|
| "Wrong size" at upload | A file was resized or re-exported. Regenerate with the scripts above; do not hand-crop |
| Screenshots don't match the app | The captures predate a UI change. Re-capture per `screenshots/appstore-2026/README.md` — note its warning that the capture script goes stale *silently* |
| A frame shows an empty or dev-tools state | Known trap: two frames deliberately avoid the obvious capture for this reason. See the narrative table in that README before swapping one |

## Related

- [`screenshots/README.md`](./screenshots/README.md) — which set is which
- [`docs/RELEASE_RUNBOOK.md`](./docs/RELEASE_RUNBOOK.md) — the release procedure
- [`marketing/aso/README.md`](./marketing/aso/README.md) — store listing fields
- [Apple: screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/)
