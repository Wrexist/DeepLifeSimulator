# Plan — child proportions, release secrets, store screenshots

Three asks. They have one ordering dependency: **children change what faces look
like, so the store screenshots have to be recaptured after that lands**, not
before. So the screenshots go last.

(The avatar-revamp plan that lived here shipped in #122.)

---

## 1. Children read as small adults

### What is actually true

The previous note said this "needs a commissioned child art set, not code".
That is right about the ceiling and wrong about the floor — there IS real
headroom in code, and it was never measured. Two findings from probing the
generated art:

- **The art's layer groups are stable.** Every configuration tested — nine of
  them, across clothing, hats, long hair, beards, glasses and bald — emits the
  same eight top-level groups with byte-identical transforms:
  `translate(0 170)` body, `translate(78 134)` mouth, `translate(104 122)` nose,
  `translate(76 90)` eyes, `translate(76 82)` brows, then facial hair, hair and
  accessories. So the features can be moved as layers without touching a path.
- **The body is irrelevant.** At the shipped crop (head centred, zoom 1.10) the
  shoulders are almost entirely outside the circle, so head-to-shoulder ratio —
  the textbook child cue — buys nothing here. Every usable cue is in the head.

### The lever

Cranial ratio, expressed as **where the eye line sits**. Adult eyes sit at the
vertical middle of the head; an infant's sit far lower, because the cranium
above them is huge relative to the face. Measured: skull top 36, chin 173, so
the adult eye line is 104.5 and an infant's is ~120.

- [x] Probe the art's group structure and confirm it is stable
- [x] Render today vs three strengths across ages 1/4/8/12/16/30 and pick one
      (`screenshots/avatar-child-proportions.png` — C reads youngest with no
      distortion: eye line 120, feature cluster 0.80, eyes +20%)
- [x] `lib/avatar/proportions.ts` — pure, no art import, degrades to the input
      unchanged when a group is not found
- [x] Wire into `VectorAvatar` before `frameArt`
- [x] Tests: the ramp, monotonicity, the no-op at adult ages, graceful
      degradation — plus one test that pins the group offsets against the REAL
      generated art, so a DiceBear bump fails loudly instead of silently
      turning the effect off
- [x] Verify in the running app on a family with children

### Two bugs the verification turned up, both fixed

Neither was the ask. Both are "a child renders wrong", found by looking at the
real app rather than at the module.

- [x] **Grey hair on a newborn, third occurrence.** `HAIR_COLORS` is only a
      continuous ramp for its first nine entries — naturals 0-8, then GREY (9)
      and WHITE (10), then four dyed. `inherit.ts` blended across that boundary,
      so a brown-haired parent (3) and a green-haired one (13) produced a child
      at 9 or 10. Inheritance now reads only the parents' NATURAL colours. Dye
      is not heritable, which the file already argued for facial hair and
      clothing. Asserted as a property over all 225 parent pairings, because
      the two previous fixes for this image were both defeated by a later
      change to the numbers.
- [x] **One child, two faces.** `CharacterAvatar` falls back to a seeded face
      when `parents` is absent, and `ContactsApp` never passed it — so the same
      child was green-haired in Contacts and blonde on the Family tab, in one
      save, in one session. That is the "my character turned into someone else"
      defect the revamp exists to kill, across screens instead of across ages.
      Wired, plus a coverage test over all four screens that render children.
      **`FamilyTreeModal` deliberately left alone**: it renders a whole lineage
      keyed by its own ids, so handing every node the CURRENT player's parents
      would be wrong for all but one generation.

**Stated plainly in the deliverable:** this is proportion, not new art. It makes
a child read as a child; it does not give the style baby geometry. The ceiling
is still a commissioned child set.

---

## 2. `EXPO_PUBLIC_RC_IOS_KEY` and `EXPO_PUBLIC_SAVE_HMAC_KEY`

Not a code change — a runbook. The two keys are opposite in kind and that is
the thing worth being explicit about:

- **`EXPO_PUBLIC_RC_IOS_KEY`** is *fetched* from RevenueCat. It is a publishable
  key that ships inside the binary.
- **`EXPO_PUBLIC_SAVE_HMAC_KEY`** is *generated* by us and must never be
  regenerated once saves are signed with it, or every existing save fails its
  signature.

- [x] Read what the code actually does with each before writing a word about them
      (`services/RevenueCatService.ts` `apiKey()`, `utils/saveSigningConfig.ts`,
      `scripts/preflightSaveSigning.js`, preflight §8/§9)
- [x] Write the step-by-step into `docs/RELEASE_SECRETS.md`
- [x] Check the preflight sections that gate on them so the doc matches the
      failure messages a build actually produces. Two things worth recording
      that came out of reading rather than assuming: preflight only checks the
      HMAC key is PRESENT, not that it is strong (a value of `x` passes, so the
      `openssl rand` step is what makes it real); and the screenshot-capture
      env vars are themselves hard §8 failures, so running preflight in the
      same shell fails with a message that names the variable, not the shell.

---

## 3. Recapture the store screenshots

Guideline 2.3.3 — the screenshots must depict the app as it now is, and every
face in every shot changed.

Pipeline is already documented in `screenshots/appstore-2026/README.md`:
web export → serve → `capture-rich-state.mjs` (28 real gameplay captures, via
Dev Tools to a rich late-game save) → `generate-appstore-2026-set.mjs` (iPhone
6.9" + 6.5") → `generate-appstore-2026-ipad.mjs` (13" iPad).

- [x] Export the web build with devtools enabled
- [x] **Fix the capture script, which was stale in three places.** It waited for
      `New Game` on the menu — a label that only exists once a save EXISTS; a
      fresh profile shows `Play` / `Custom life`, so every run hung to its 120s
      timeout. It waited for `Create Identity`, since renamed `Create Character`.
      And it matched the market's Computer row on `$5000`, the item's BASE
      price, while the market applies inflation — by that point in a rich run
      the card reads $5,300.
- [x] **Make the silent failure loud.** The market miss meant the computer was
      never bought, so the desktop launcher never appeared, so six shots were
      never written — and the PREVIOUS run's files stayed on disk. The set was
      being rebuilt from a mix of new and stale captures with nothing red
      anywhere: the exact Guideline 2.3.3 problem, reintroduced by the tool
      meant to fix it. The script now throws if the launcher is missing.
- [x] **Fix the scrolling, which never worked at all.** `page.mouse.wheel` does
      nothing to react-native-web's ScrollView, so every `wheel()` in the
      script was a no-op and shots meant to be "the same screen, scrolled" were
      byte-identical duplicates — `md5sum` on `00-home.png` and
      `01-home-goals.png` proved it. The only scrolling that ever happened was
      accidental, via `clickText`'s `scrollIntoViewIfNeeded`, which is what
      parked Home halfway down and left the hero frame of an AVATAR release
      with no face in it. Replaced with a DOM helper, verified moving.
- [x] Re-run the rich capture, iPhone and iPad (28/28 each)
- [x] Regenerate all three output sets
- [x] Look at every regenerated frame — contact sheets of both sets, all 20
      frames checked. Hero shows the identity card and face, the Dark Web and
      Garage frames are back, and the "12 decisions waiting" pill is gone from
      every phone (it had been baked into all three devices per frame, and on
      Home it overlapped the daily-gems banner).

---

## Gates before pushing

- [x] `npx jest --ci` — 6876 pass, 1 pre-existing skip
- [x] `npm run type-check` + `type-check:tests:ratchet` — clean, ratchet at 0
- [x] `node scripts/check-lint.js` — 0 errors, 1190 warnings under the 1193 ceiling
- [x] `npm run check:routes` — 17 routes, no conflicts
- [x] `npx expo export:embed` — production bundle builds, 3904 modules
