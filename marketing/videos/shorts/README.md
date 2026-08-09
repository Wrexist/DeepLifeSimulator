# YouTube Shorts — batch 01

Three finished Shorts, **2160×3840 (4K) H.264 High, 30fps**, built by
`npm run shorts`.

Captured at 4K on purpose. YouTube serves Shorts at 1080p regardless, but it
gives a >1080p upload a markedly better transcode — and this app is
wall-to-wall dark gradients, which are the first thing to band when the
transcoder is stingy. Upload the 4K files as they are.

Strategy and the reasoning behind the format live in
`marketing/youtube-shorts-playbook.md`; the rig is documented in
`scripts/demo/README.md`.

| File | Length | Format (playbook §4) | Hook |
|---|---|---|---|
| `01-the-climb.mp4` | 19.1s | 1 — the number climb | `$250` on screen, then it runs to $17.76M |
| `02-real-economics.mp4` | 20.7s | 4 — real economics | "Most life sims fake the economy." |
| `03-the-dynasty.mp4` | 16.4s | 6 — the dynasty | "You die. They don't." |

All three are **real captured gameplay** from the seeded demo save, with the
caption layer and a live 3D scene composited in the page. Nothing is
AI-generated footage — which is what keeps them clear of YouTube's
inauthentic-content policy and means they can be reused as App Store material.

The 3D is rendered in-engine, not sourced: a seeded, perspective-projected
dust field with volumetric light (`e2e/support/shortsScene.ts`) sits behind
the app, and each Short pulls the running game back onto a tilted plane inside
it before the end card. Free, deterministic, and it re-renders with the
footage instead of going stale beside it.

## Publish sheet

Descriptions have **no clickable links on Shorts** — YouTube disabled them.
Set the channel About links once, and attach a Related Video per Short in
Studio. Each Short says the app name on screen so branded search works.

### 01 — the climb
- **Title:** I turned $250 into $17.8 million
- **Description:** One life. 22 years. No script — just loans, a job, the stock market and compound interest. Deep Life Simulator is a life sim with a real economic engine.
- **Tags:** #lifesim #simulationgame #mobilegame #indiegame #tycoon

### 02 — real economics
- **Title:** Most life sims fake the economy. This one does the math.
- **Description:** A live stock market with sector rotation, real loans, real interest, and a credit score that actually drops. Deep Life Simulator.
- **Tags:** #lifesim #simulationgame #stockmarket #mobilegame #indiegame

### 03 — the dynasty
- **Title:** Your kids inherit everything — including your mistakes
- **Description:** Thirteen genetic traits, nurture stats, and a family tree that outlives you. Raise them well and they inherit it all. Deep Life Simulator.
- Films the **Contacts** app rather than the Life ▸ Family sheet. That sheet is
  a modal that would not stay open under automation, and Contacts shows the
  same cast — spouse, both children, bond scores — through the reliable route.
- **Tags:** #lifesim #simulationgame #legacy #mobilegame #indiegame

## Posting

Per the playbook: 3–5 Shorts a week, never two of the same format back to
back, and never batch-published — Shorts posted together compete for the same
seed audience, and distribution is effectively decided within about two hours.
Post these on separate days.

## What to read after publishing

Average view duration as a percentage of length is the number that predicts
distribution; the bar for sub-30s Shorts is roughly 65%. Check it at two hours
and again at 48. Kill a format that misses 50% twice; make more of anything
that clears 70%.

## Regenerating

```bash
npm run web        # dev server on :8081, in another terminal
npm run shorts     # capture + encode all three
```

Editing a Short means editing its beat list in `e2e/shorts.capture.spec.ts` —
captions, holds, and which screens it visits. A new Short is a new `test()`
block plus, if it needs a different starting state, a new chapter in
`scripts/demo/demoSave.ts`.

The `.webm` masters under `e2e/.artifacts/` are gitignored and disposable; the
`.mp4`s here are the deliverable.
