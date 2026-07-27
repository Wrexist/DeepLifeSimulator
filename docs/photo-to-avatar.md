# Photo-to-avatar (DeepLife+)

Turning a selfie into a character. This is the one DeepLife+ benefit a free
player cannot reach by grinding, and it is deliberately the first item on the
paywall.

Manual creation did not move. It is still free, still the whole editor, and the
selfie route lands the player *in* it with the sliders pre-set rather than
replacing it.

---

## The shape of it

```
BecomeYourself ──selfie (DeepLife+)──▶ SelfieFlow ──▶ FaceStudio (pre-filled)
      └──────────manual (free)──────────────────────▶ FaceStudio
```

```
SelfieCapture ──▶ AvatarProcessing ──▶ AvatarReveal
   picker            real progress        compare + keep
```

Everything the UI touches goes through `services/avatar/AvatarService.ts`. No
screen imports a provider, and no provider imports a screen.

---

## Swapping vendors

`AvatarProvider` (in `services/avatar/types.ts`) is the whole contract:

```ts
interface AvatarProvider {
  id: string;
  label: string;
  capabilities: readonly AvatarStage[];
  isAvailable(): boolean;
  analyse(photo: PhotoInput, options: GenerateOptions): Promise<PhotoAnalysis>;
}
```

To add a vendor: write one file under `services/avatar/providers/`, add it to
`PROVIDERS` in `AvatarService.ts` in quality order, done. Nothing else changes.

**The seam is at landmarks and colours, not at "a finished avatar."** A provider
reports what it *found in the photograph*; turning that into a face is
`lib/identity/faceMeasures.ts`, which every provider shares. That is what keeps
a new vendor to a network client — a provider that returned a finished mesh
would be the awkward one to integrate, not the easy one.

Selection is ordered and falls through. A retryable failure (offline, rate
limited) hands off to the next provider; an unretryable one (no face in the
photo) does not, because trying again elsewhere only makes the player wait
longer for the same answer.

### Shipping providers

| id | needs | can it measure a face? |
|---|---|---|
| `cloud` | `EXPO_PUBLIC_AVATAR_API_URL` + `EXPO_PUBLIC_AVATAR_API_KEY` | yes, if the vendor returns 68 landmarks |
| `on-device` | expo-gl | **no** — skin and hair colour only |

With no key configured the feature still works and still says what it did. It
does not pretend.

---

## How a photo becomes a face

`scripts/build-ict-head.mjs` defines every app morph as a MEASUREMENT over the
iBUG-68 landmark set, then solves for the ICT shape-mode coefficients that move
that measurement and nothing else. `lib/identity/faceMeasures.ts` runs that
backwards: measure a real face, look up where each measurement sits in the
population, set the slider to match.

The population is real. `assets/models/face-measure-stats.json` is emitted by
the build script from ICT's 100 identity components — principal components of
Light Stage scans of actual people — so "is this jaw wide?" has an answer that
was not invented to make the output look reasonable.

Two things to know if you touch this:

- **`sd` is the root-sum-square of the per-mode deltas, not their standard
  deviation.** Each identity file is the mean face plus one component at unit
  amplitude; a face is a sum of all hundred. Using the across-file spread puts a
  perfectly ordinary jaw four standard deviations out and pegs every slider from
  every photo.
- **`FACE_MEASURES` mirrors `MEASURES` in the build script.** They are pinned
  against the same literals in `landmarkFit.test.ts`, because a silent
  divergence fits every photo to subtly the wrong face and nothing else notices.

### What a photo cannot give

Landmarks from one photo are two-dimensional. `PHOTO_UNFITTABLE` lists what is
left at neutral rather than guessed:

- `chinProtrusion`, `browProtrusion`, `eyeDepth`, `noseBridge`, `noseTip` — depth
  axes; a second view or a depth sensor would be needed.
- `cheekboneHeight` — the height difference between two *mirrored* jaw points,
  which on a symmetric face is zero by construction. In a photo it measures head
  roll and landmark noise.

`earSize`, `foreheadSlope` and `neckThickness` used to be on this list, and are
not any more: they are derived from VERTEX-REGION measurements rather than
landmark spans, so the rig drives all 24. A photo still cannot fit them — an ear
seen face-on gives no depth and the neck is usually out of frame — so they stay
at whatever the player set.

Fifteen of twenty-four morphs are fitted. Guessing the rest would produce a
control that moves something plausible in the wrong place, which reads as a
modelling bug rather than a missing feature.

---

## Honesty is a feature, not a disclaimer

`AvatarResult.performed` lists the stages that actually ran, and the reveal
screen switches on it:

| what happened | headline |
|---|---|
| landmarks + confident fit | *This looks like you* |
| landmarks, weak fit | *Here's your character* |
| colours only | *We matched your colouring* |

The same rule drives the processing checklist: `plannedStages()` returns the
capabilities of the provider that will actually run, so the on-device path shows
three steps and ticks three rather than showing seven and ticking three.

And the progress bar is not a timer. It comes from the provider's own upload and
poll responses. The only liberty is easing — the displayed value animates
towards the reported one, never past it and never backwards.

A player told the AI captured their face who then sees a generic head does not
conclude the copy was loose. They conclude the product is broken.

---

## Privacy

The photo is read locally by the on-device provider and never leaves the device.
The cloud provider uploads it to the configured endpoint for the duration of one
scan. Nothing is uploaded without a scan the player started themselves; the
entry screen says so.

If a vendor is added, its retention terms belong in the App Store privacy
questionnaire before the build ships.

---

## Checking a change to the head

`scripts/shoot-styles.mjs` renders the real asset through the real three.js
path. The switches exist because each one has caught a bug that every number
in the build reported as healthy:

| switch | what it answers |
|---|---|
| (none) | all 35 hair styles as a contact sheet |
| `--beards` | the five facial-hair styles |
| `MORPH=name` | that morph at -1 / 0 / +1 — does the slider move its own feature, in the right direction |
| `RANDOM=n SPREAD=s` | n randomised faces; found that the hair shells were never morphed at all |
| `SWEEP=hex,hex,...` | one render per palette entry; found brown eyes with no pupil, deep skin crushed to a silhouette, and olive eyebrows on blondes |
| `ONLY_PART=skin\|sclera\|iris` | one primitive alone; proved the eye's black cap and that the hair shell was whole |
| `HAIR_ONLY=1` | the hair shell without the head |
| `AGE=8,25,45,65,85` | one character across a lifetime, through the app's own `applyAging`; found hair growing through the ear |
| `VIEW=w,h,rot,zoom,ty` | size, yaw and a close-up |

`AGE` runs the app's real aging code in the harness via
`scripts/lib/loadTs.mjs`, which transpiles a TypeScript module on demand. That
matters: `applyAging` rewrites eleven morphs, greys the hair and lifts the
hairline, and a screenshot script that reimplemented any of it would drift from
the real curve and then quietly certify the wrong face. It works for the app's
PURE modules — `lib/identity` is pure by design — and a harness reaching into a
React component would be testing the wrong thing.

**Sweep the palettes after any change to the skin, hair or eye shaders.** The
default entry of each palette gets looked at constantly and the ends of the
range almost never, which is exactly where three separate bugs were sitting.

---

## Known gaps

- **The cloud adapter is unexercised against a real vendor.** It is written to
  the common REST shape (multipart upload, optional job poll, landmarks in the
  result) and handles both synchronous and asynchronous responses, but no
  account has been wired up. Expect field-name adjustments on first contact.
- **The on-device GL pixel read is not device-verified.** Same standing caveat as
  the rest of the GL work here — the harnesses exercise the web path.
- **Landmarks require a provider.** There is no on-device face detector; adding
  one (ML Kit / Vision) would let the free path measure face shape too, and would
  slot in behind the same interface.
