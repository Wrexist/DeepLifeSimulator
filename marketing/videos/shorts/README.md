# YouTube Shorts — batch 01

Three finished Shorts, 1080×1920 H.264 MP4, built by `npm run shorts`.
Strategy and the reasoning behind the format live in
`marketing/youtube-shorts-playbook.md`; the rig is documented in
`scripts/demo/README.md`.

| File | Length | Format (playbook §4) | Hook |
|---|---|---|---|
| `01-the-climb.mp4` | 18.7s | 1 — the number climb | `$250` on screen, then it runs to $17.76M |
| `02-real-economics.mp4` | 19.6s | 4 — real economics | "Most life sims fake the economy." |
| `03-the-dynasty.mp4` | 18.0s | 6 — the dynasty | "You die. They don't." |

All three are **real captured gameplay** from the seeded demo save, with the
caption layer composited live in the page. Nothing is AI-generated footage —
which is what keeps them clear of YouTube's inauthentic-content policy and
means they can be reused as App Store material.

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
