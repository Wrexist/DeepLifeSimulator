# YouTube Shorts playbook — Deep Life Simulator

Goal: Shorts that bring in **installs**, not just views. Written 2026-08-09.

Companion docs: `marketing/tiktok_scripts.md` (10 scripts, already written),
`marketing/videos/` (3 rendered TikTok cuts), `scripts/demo/README.md` (the
gameplay capture rig), `marketing/apple-ads/` (paid App Store side).

---

## 1. What the platform actually rewards in 2026

Five facts that should drive every decision below. All of them are load-bearing.

**Retention thresholds are explicit and brutal.** Roughly **65% average view
duration for sub-30s Shorts**, ~50% for 30–60s, before YouTube widens
distribution. A 6-second view of a 60-second Short now registers as a *strong
negative*. Only completed views and re-watches count meaningfully.

**→ Target 18–24 seconds.** Short enough that 65% is achievable, long enough to
land a story. Do not make 45-second Shorts because the story "needs it" — cut
the story instead.

**The decision window is ~2 hours.** Distribution runs in three stages: seed
sample (15–30 min, weighted on early retention), velocity escalation (resolves
inside 2 hours), then cross-surface amplification. After 2 hours YouTube has
effectively decided between 500 views and 500K.

**→ Post when your audience is awake, and never publish a batch of five at
once** — they compete for the same seed window.

**Ranking signals, heaviest first:** early retention → completion → re-watches
→ shares → comments → likes. Likes are near the bottom. Stop optimising for
them.

**Clarity beats creativity in the first 1–2 seconds.** If a viewer cannot tell
what they're looking at, they swipe. This is the single highest-leverage frame
in the entire video.

**Cadence: 3–5 per week is the baseline.** Channels posting 12+/month get ~53%
more views and ~66% more subscribers than those posting 1–3/month, and channels
under 10K subs saw the largest 2026 gains. But watch time per Short is falling
industry-wide as volume rises — so the floor is quality, not count. Five good
ones beat fourteen filler ones.

---

## 2. The conversion problem nobody mentions

**Links in Shorts descriptions are not clickable.** YouTube deliberately
disabled them, along with links in Shorts comments, to cut spam. Every "link in
description!" CTA on a Short is dead text.

So there are exactly four routes from a Short to an install:

| Route | How it works | Effort |
|---|---|---|
| **Channel About links** | Up to 14 links on the channel page. Viewers tap the channel name → About → link. | One-time setup. Do this first. |
| **"Related Video" in Studio** | The feature purpose-built for Shorts — attaches a clickable card. Point it at a long-form video that *does* have clickable links. | Per-Short, ~10 seconds. |
| **Search intent** | Say the app name out loud and show it on screen. Viewers search "Deep Life Simulator" in the App Store. | Free. Requires the name to be legible and memorable. |
| **Paid: Video Action / App campaigns** | Google Ads app-install campaigns run on Shorts inventory with a real install button. | Budget. This is where actual scale lives. |

**Implication:** organic Shorts are a *demand-generation and creative-testing*
channel. They make people want the game and they tell you which hooks work. The
install button comes from paid — and the winning organic hooks are exactly what
you should promote. Treat the organic channel as the R&D lab that feeds paid.

Practical consequence: **say and show the app name in every single Short.**
It is the only free conversion path you fully control.

---

## 3. Format spec

- **1080×1920, 9:16, 30fps, H.264/MP4, 10–15 Mbps.** Never below 720×1280.
- **Safe zone: keep everything that matters inside a 900×1350 box** — 180px
  clear at top, **390px clear at bottom**, 60px each side. The bottom-right is
  buried under the title, channel name and action buttons.
- **Captions in the upper-middle third.** Not the bottom. Almost every mobile
  game Short gets this wrong and hides its own hook behind the UI.
- **Design for sound-off.** Autoplay is muted. Burned-in captions carry 100% of
  the message; voiceover is a bonus, never the carrier.

Note the safe zone conflicts with the game's own HUD placement. When capturing
gameplay, either crop/reframe so the key number sits centre-frame, or composite
the gameplay into the upper 2/3 with captions above.

---

## 4. Nine formats built for this game

Ranked by expected install intent, not by expected views. Each is a repeatable
template, not a one-off.

**1 — The number climb.** Net worth counter ticking $0 → $17.8M over 20 seconds
of hard cuts. Caption: "I started with $250." This is the format the game was
born for and no other life sim can copy it credibly. *Highest priority.*

**2 — The one-decision fork.** Freeze on a real in-game choice. "Take the
$80,000 loan or don't." Two-second pause, then show the consequence 15 years
later. Ends on the outcome, not the choice.

**3 — The bad-run trainwreck.** Every worst decision in sequence, ending in
bankruptcy or prison. Already scripted as Script 2 in `tiktok_scripts.md`.
Comedy carries shares, which is signal #4.

**4 — "This isn't BitLife."** Direct comparison: show compound interest actually
compounding, a mortgage with real terms, a credit score dropping. Competitor
comparison is legitimate in video (unlike App Store keywords) and it's your
sharpest differentiator.

**5 — Speedrun challenge.** "$1M by age 25. Go." Time pressure creates
completion, and completion is ranking signal #2.

**6 — The dynasty.** Die, pass to your heir, show 13 inherited traits carrying
forward. Nothing else in the category does generational play — lead on it.

**7 — Reply-to-comment.** Answer a real comment with a run that tests it. The
cheapest content you will ever make, and the highest comment rate.

**8 — The dark web run.** Highest-drama, highest-risk-of-swipe-stop content.
Keep it truthful to the age rating — do not oversell it.

**9 — Stat porn.** 10 seconds, no story: portfolio, properties, companies,
family tree. Pure aspiration. Works as filler between story pieces.

**Rotate 3 formats per week.** Never post the same format twice in a row — the
seed audience overlaps and the second one cannibalises the first.

---

## 5. Making them with AI — the honest division of labour

### The rule that governs everything

**YouTube's "inauthentic content" policy was broadened in 2026.** It was
formerly "repetitious content"; it now covers any channel built on
mass-produced templates, recycled clips, slideshows with no narrative, or
scripts read verbatim. Enforcement is a three-strike ladder: warning → 90-day
suspension → permanent removal from YPP.

AI is **not** banned. YouTube's line is whether the output carries your own
vision and value, or is generic mass production. Separately, **disclosure** is
required only when content is synthetic *and realistic* — a fake real person, a
fabricated real event. Disclosing does not reduce reach or demonetise.

Gameplay footage of your own game is neither. But an AI-generated "person"
reviewing the game **would** need the disclosure toggle, and a channel of forty
near-identical AI slideshows is exactly what the policy now targets.

**→ The footage must be real captured gameplay. AI does everything around it.**

This is not a compromise, it is the competitive advantage: gaming audiences
swipe away from obviously synthetic footage, and you have a rig that produces
real footage on demand.

### What produces the footage: the capture rig you already have

`npm run demo:capture` (see `scripts/demo/README.md`) drives the real app
through a scripted run from a designed save state and records it. That was built
for the App Store preview, and it is directly reusable here:

- New Short format → new save chapter in `scripts/demo/demoSave.ts` + new beat
  list. A "bankruptcy run" or a "week one vs year twenty" cut is a config
  change, not a shoot.
- Deterministic. The same run re-records identically when the UI changes.
- **This is the moat.** Competitors making life-sim Shorts are screen-recording
  by hand or generating slop. You can produce authentic, on-brand, safe-zone-
  correct gameplay b-roll at will.

Two changes needed to make it Shorts-ready:
1. Add a 1080×1920 project to `playwright.config.ts` (the current one is
   430×932 CSS / 860×1864 recorded, sized for the App Preview).
2. Reframe so the key number lands centre-frame, clear of the 390px bottom
   exclusion.

### What AI does, tool by tool

The **Higgsfield** connector is live in this session and covers most of it:

| Job | Tool | Notes |
|---|---|---|
| Script & hook variants | Claude | Generate 10 hooks per concept, pick 3. The hook is the whole game. |
| Voiceover | `generate_audio`, `create_voice` | Optional — captions carry the message. A consistent voice builds channel identity. |
| Music | `generate_audio`, `tiktok_music_trending` | Trending-audio signal matters more on TikTok than Shorts, but tempo drives cut rhythm. |
| Shorts assembly | `shorts_studio_create` + presets | Presets are the point: lock one, and every Short inherits the same caption style and safe-zone layout. |
| Thumbnail / cover | `youtube-thumbnail-generator` workflow | Shorts show a cover in feed and on the channel grid. |
| Pre-flight scoring | `virality_predictor` | Scores hook strength and retention risk *before* you publish. Use it to kill weak cuts, not to validate ones you like. |
| Post-hoc analysis | `video_analysis_create` | Diagnose why a Short underperformed. |
| Clip mining | `personal_clipper_create` | Cut long gameplay recordings into candidate Shorts. |

**What to never use AI for here:** generating fake gameplay, fake players, fake
reviews, or fake testimonials. Fake gameplay is an App Store 2.3.3 problem *and*
a YouTube authenticity problem *and* it converts badly because players notice.

### The pipeline, end to end

```
1. Pick format (§4)          →  2. Claude: 10 hooks, pick 3
3. Design save state         →  4. npm run demo:capture (real footage)
5. Higgsfield shorts_studio  →  6. virality_predictor gate
7. Upload + Related Video    →  8. Read 2h retention, feed winners to paid
```

Steps 3–4 are the ones nobody else can do cheaply. That's where the advantage
compounds.

---

## 6. Measurement

Track per Short, at the 2-hour mark and at 48 hours:

- **Average view duration as % of length** — the only number that predicts
  distribution. Against the 65% bar for sub-30s.
- **Swipe-away point** — where the retention graph cliffs. Almost always the
  hook (fix the first 2s) or the moment the payoff is delayed too long.
- **Re-watches** and **shares** — the two signals worth chasing after retention.
- **Branded search lift** — "Deep Life Simulator" App Store search volume, since
  that's the main organic conversion path.
- **Install attribution** is genuinely hard from organic Shorts. Do not build the
  strategy on being able to measure it directly; use branded-search lift as the
  proxy and let paid carry measurable install volume.

Kill any format that misses 50% AVD twice. Double down on any that clears 70%.

---

## 7. Tooling gaps to close

| Gap | Impact | Fix |
|---|---|---|
| **No YouTube connector** | Cannot upload, schedule, set Related Video, or read YouTube Analytics from Claude. Every publish is manual. | Biggest gap. Add a YouTube MCP connector, or accept manual publishing. |
| **Canva not authorised** | Higgsfield covers generation; Canva would cover templated caption/end-card layout. | Authorise in claude.ai connector settings if wanted — not required. |
| **Windsor.ai not enabled** | It aggregates Meta / Google / TikTok Ads. This is the paid-side measurement layer that closes the loop in §6. | Enable when paid campaigns start. |
| **No ffmpeg in the dev container** | Cannot trim, re-encode, or burn captions locally. | Install ffmpeg, or do assembly in Higgsfield. |
| **Capture rig is App-Preview-shaped** | 860×1864, not 1080×1920, and framed without the Shorts safe zone. | Add a `shorts` Playwright project. Small change. |

---

## Sources

- [YouTube Shorts retention rate 2026 — Shortimize](https://www.shortimize.com/blog/youtube-shorts-retention-rate)
- [YouTube Shorts algorithm 2026 — ReelForge](https://reelforgeai.io/blog/youtube-shorts-algorithm-2026-complete-guide)
- [YouTube Shorts algorithm — Metricool](https://metricool.com/youtube-shorts-algorithm/)
- [Inauthentic content policy 2026 — AuditSocials](https://www.auditsocials.com/blog/youtube-inauthentic-content-policy-2026-mass-produced-ai-generated-monetization-creators-brands)
- [AI monetisation & disclosure rules — Vexub](https://vexub.com/blog/ai-generated-video-monetization-policies)
- [Shorts size & safe zones — PostLink](https://postlinkapp.com/blog/youtube-shorts-size-and-dimensions)
- [Sharing links with your audiences — YouTube Help](https://support.google.com/youtube/answer/13748639?hl=en)
- [Shorts ads specs & best practices — Google Ads Help](https://support.google.com/google-ads/answer/16041697?hl=en)
- [Posting frequency & growth — Miraflow](https://miraflow.ai/blog/should-you-post-daily-shorts-2026)
- [Mobile game UA guide 2026 — Udonis](https://www.blog.udonis.co/mobile-marketing/mobile-games/user-acquisition-strategy-mobile-games)
- [Mobile game ad creative strategy 2026 — GGA](https://gamegrowthadvisor.com/blog/2026-05-12-mobile-game-ad-creative-strategy-2026/)
