# Viral Growth Plan — received 2026-08-09, reviewed against the codebase

> **Read this header before actioning anything below it.**
>
> The plan is preserved verbatim from §0 onward. It is a good strategy document
> and several of its pillars are genuinely unbuilt. But it was written from
> outside the repo, and **four of its premises about the current product are
> false**. One of its this-week action items would violate App Store policy.
>
> Review notes appended 2026-08-09. Full write-up in `tasks/lessons.md`.

## Verdict per item

| Plan item | Status | Detail |
|---|---|---|
| §4.1 rating prompt — "move to peak moments" | ❌ **Already done, better** | `utils/reviewMoments.ts` scores beats 0..1, drops anything under `MIN_REVIEW_INTENSITY`, cancels on sour beats, and delays into the afterglow. `utils/ratingPrompt.ts` uses a wall-clock cooldown (a game-week one would burn all 3 yearly asks in one session). `components/ReviewPromptHandler.tsx` watches the store rather than calling from a reducer, because React can invoke an updater twice. |
| §4.1 rating prompt — **"soft-gate it"** | 🚫 **DO NOT IMPLEMENT** | This is review gating: pre-screening players and routing only happy ones to the store. Apple's Ratings and Reviews guideline prohibits selectively soliciting reviews from a subset of users. `utils/reviewMoments.ts:28-32` already documents the refusal. Implementing it is a regression *and* a rejection risk. |
| §0.3 / §2.1 "the share loop doesn't exist" | ⚠️ **Wrong premise, real bug underneath** | The death screen has a share button (`components/DeathPopup.tsx:569`) producing a text obituary (`lib/legacy/obituaryGenerator.ts:123`). The actual defect: that text carries `#DeepLifeSim` and **no App Store link**, so every share is a dead end for installs and attribution. Fix the link before building anything new. |
| §2.1 "build the Life Card" | ⚠️ **Half-built and orphaned** | `components/ShareLifeCard.tsx` (417 lines, PR #67) exists but is **imported by nothing**. Text-only — no image render (`react-native-view-shot` / `expo-sharing` are not dependencies). It `require`s `@react-native-clipboard/clipboard`, which is not in `package.json`; the try/catch means wiring it up loses the Copy button silently rather than crashing. Decide: wire it up, upgrade it to an image, or delete it. |
| §4.2 localization — "pt-BR first" | ❌ **Already done** | `marketing/app-store-localizations/` holds 39 locales including pt-BR, es-MX, de-DE, tr, id. |
| §11.7 fast-forward | ✅ **Correct — genuinely missing** | No implementation outside `lib/devtools/simulations.ts`. The plan is right that this gates the paid stage. |
| "v1.5.0 imminent" vs `package.json` 2.6.0 | ℹ️ **Not a discrepancy** | Deliberate ASC-record / binary-version split. See `CLAUDE.md` §9 — do not "fix" it by raising the store version. |
| §3 TikTok, §5 Reddit, §6 Discord | 📋 **Partly pre-existing** | `marketing/` already contains `tiktok_scripts.md`, `content-calendar.md`, `reddit_and_outreach.md`, `press-kit.html`. Diff against those before writing new ones. |
| §4.2 ASO (og:image, subtitle, keywords, screenshots) | ✅ **Actionable, App Store Connect side** | Nothing in the repo to verify; these are ASC changes and stand on their own. |

## The transferable lesson

The plan's most dangerous item was also its most standard-sounding one.
"Soft-gate the rating prompt" is common, widely-repeated growth advice — which
is exactly why nobody stops to check it against platform rules. Advice being
routine somewhere is not evidence it is permitted here.

The only reason it was caught in minutes is that a previous session wrote the
refusal into a comment *next to the code*, with its reasoning. Keep doing that.

---
---

# DeepLife Simulator — Viral Growth Plan
**Goal:** Explode organic installs on the App Store. Target: 10,000 installs and 100+ ratings at 4.5★ within 90 days, with a repeatable content engine running after that.
**Prepared:** Aug 9, 2026 · Current state: US listing has 1 rating (3.0★), English only, v1.5.0 "Economy Update" imminent.

---

## 0. The honest diagnosis (read this first)

Virality in the life-sim genre is **product-led, not ad-led**. BitLife didn't blow up because of a marketing campaign — it blew up because every absurd life generated a screenshot that players posted themselves. Marketing *amplifies* a share loop; it can't replace one.

Three things currently cap your ceiling, and every strategy below assumes you fix them first:

1. **Social proof floor is broken.** 1 rating at 3.0★. Any traffic you drive — TikTok, Reddit, ads — hits a product page that says "probably not good." Fixing this is worth more than any single campaign.
2. **The pacing complaint kills the exact loop that makes life sims viral.** "One tap = one week" means the wild story moments come too slowly. Your promised fast-forward/skip-ahead feature is a *marketing prerequisite*, not a QoL nice-to-have. Ship it before the big push.
3. **The share loop doesn't exist yet.** There is no one-tap way to share a life. That's the #1 build item in this plan.

Also fix immediately: **the App Store link's social preview image is a literal Apple placeholder** (`Placeholder.mill/1200x630`). Every time anyone shares your App Store link on Discord, iMessage, X, or Reddit, the preview is broken. Upload proper promotional artwork in App Store Connect.

**Sequencing rule:** Foundation (Weeks 1–2) → Engines (Weeks 2–6) → Fuel/paid (Weeks 6+). Pouring traffic on a 3.0★ page with no share loop burns money and burns the audience.

---

## 1. Positioning & message

**Core message:** *The life sim where money actually works.*

You already have the perfect wedge — lean into it everywhere: "This isn't BitLife. Loans have interest. Bills don't forgive themselves. Compound growth is the win condition."

Supporting messages (rotate across channels):
- **vs. the genre:** "Other life sims are random button pressing. This one has a real economic engine."
- **the fantasy:** "Start at 18 with $0. Die a billionaire. Or don't."
- **the dynasty hook:** "Your kids inherit your empire — and your mistakes."
- **the fairness flex:** "No forced ads. No pay-to-win. Solo dev." (This line is also your Apple-featuring pitch.)

**Proof points:** real interest/credit mechanics, bankruptcy, weekly stock/crypto market, rental ladder → eviction, prestige/generational wealth, 20+ careers including crime.

**Audience:**
- Primary: 15–28, plays BitLife/InstLife/idle tycoons, lives on TikTok and Reddit, loves "rags to riches" and finance-brain content (r/wallstreetbets energy, "money glitch" humor).
- Secondary: personal-finance-curious players who like that the economics are real ("this game accidentally taught me compound interest" is a headline you want someone else to write).

---

## 2. PILLAR 1 — Build the viral loop into the game (highest leverage, ~1 weekend with Claude Code)

### 2.1 The Life Card (ship in v1.5.x)
A beautiful, branded, one-tap shareable image generated at death (and on demand from the stats screen):

- **Contents:** name & portrait, lifespan ("1988–2054, died at 66"), peak net worth, career arc ("Dishwasher → Senator"), 3 auto-picked highlight events ("Went bankrupt at 31 · Married 4 times · Served 6 years for fraud"), family/dynasty generation number, a grade (S/A/B/C/F life rating), and small "Deep Life Simulator" branding + QR/App Store link.
- **Tone:** obituary-meets-trading-card. Funny stats sell it: "Total interest paid to banks: $2.4M." "Children who resent you: 3."
- **Placement:** big share button on the death screen (your highest-emotion moment), plus share from prestige screen and net-worth milestones.
- **Format:** 9:16 image sized for TikTok/IG stories AND a 1:1 crop for Reddit/X. Native share sheet.
- **Instrumentation:** Mixpanel event on card generated + card shared. This is your viral coefficient dial.

### 2.2 Screenshot-bait moments
Audit the game for "I have to show someone this" beats and make them screenshot-clean (no debug clutter, event text fully visible, branding subtly in frame):
- Absurd event outcomes (scandals, lottery, betrayal) — punchy writing matters more than art here.
- Bankruptcy screen and eviction notice — failure is *more* shareable than success. Make the game-over screens funny and beautiful.
- "Weekly market crash" moments — WSB-style loss porn is a genre of its own.

### 2.3 Challenge system = content calendar
Add named weekly challenges (you already have achievements/leaderboards): "Felon to President," "No-loans run," "Die broke at 100," "Single parent, 5 kids, $1M." Each challenge is simultaneously:
- a retention feature (reason to return weekly),
- a TikTok series premise (see Pillar 2),
- a Discord event,
- and a leaderboard screenshot people post.

### 2.4 Referral hook (later, v1.6)
"Invite a friend → both get a Revival + gem pack." Keep it simple; the Life Card QR is already a soft referral channel.

---

## 3. PILLAR 2 — TikTok content machine (the genre's native channel)

This is where BitLife-style games actually get their installs. Faceless, cheap to produce, and your game's text-driven drama is perfect raw material.

### 3.1 Account setup (Day 1)
- Dedicated account: **@deeplifesimulator**. Bio: "The life sim where money actually works 💸 Start at 18 with $0." Direct App Store link in bio.
- Also create the matching **Instagram Reels + YouTube Shorts** accounts and cross-post everything (free extra distribution; Shorts especially converts for games).

### 3.2 The four formats (in priority order)

**Format A — "The audience plays" (your killer format).**
Video 1: "You're 18 with $0 in the deepest life sim on the App Store. Comment our first move." Then every video executes the top comment and ends on the next decision. One shared community life, episodic, engagement-baited by design (comments = the game controller). Post daily. Number the parts. This format alone has carried multiple sim games to millions of views.

**Format B — Narrated challenge runs.**
"Can I go from prison to President?" / "I took the maximum loan on day 1 and bought only crypto." 30–60s, gameplay capture + text-to-speech or your own voice, hard cut every 2–3 seconds, end on cliffhanger → Part 2. Use the in-game challenges from 2.3 so content and product ladder into each other.

**Format C — Absurd-moment clips.**
15s single-moment clips: the betrayal event, the eviction, the $2M margin call. Caption format: "this game has no chill 💀". Cheapest to make; batch 10 in one session.

**Format D — "Real economics" edutainment.**
"This game accidentally taught me what compound interest is." / "I finally understand why payday loans are a trap — because a mobile game bankrupted me." This angle is unique to you — BitLife can't make these videos. It also travels outside the gaming audience.

### 3.3 Hooks bank (first 1.5 seconds decides everything)
- "POV: you start life with $0 and a gambling problem"
- "I found a life simulator where the bank actually charges interest"
- "Day 14 of trying to die a billionaire"
- "This game evicted me and I took it personally"
- "BitLife players are not ready for this"
- "I gave my heir $10M and he lost it in 3 weeks"
- "Rating my citizens' worst financial decisions" (community-submitted Life Cards → UGC loop)

### 3.4 Cadence & rules
- **1–2 posts/day, minimum 30 days before judging anything.** TikTok is a lottery with better odds at volume; expect 1 in 20 to pop.
- Reply to every comment for the first hour (comment velocity drives distribution).
- When a video passes ~50k views: pin a comment with the app name, post Part 2 within 24h, and clip it for Reels/Shorts if not already cross-posted.
- Capture raw gameplay in batches (1 evening = 10+ videos of material). CapCut templates; keep a reusable caption/hashtag set (#lifesim #bitlife #simulationgames #fyp — small set, don't stuff).

### 3.5 Creator seeding (Week 3+)
- List 30–50 micro creators (10k–200k) in the BitLife/life-sim/mobile-gaming niche (search TikTok for "bitlife challenge", "life simulator").
- Offer: free DeepLife+ via **Apple Offer Codes** + $50–200 per posted video for the mid-tier, free codes only for nano creators. One-line brief: "Play a run, show your Life Card, be honest."
- Optionally test a clipping bounty later (pay per 1k views via a clipping platform) — only once organic proves which moments convert.

---

## 4. PILLAR 3 — The trust floor: ratings + ASO relaunch on v1.5.0

Treat v1.5.0 as a **relaunch**, not an update. "We rebuilt the economy" is a legitimate re-review story.

### 4.1 Ratings engine (fix the 1-rating problem in 30 days)
- **In-app prompt at peak-positive moments only:** first property purchased, first $100k net worth, prestige completed, challenge completed. NEVER after death, bankruptcy, or a crash. (Apple allows ~3 native prompts/year per user — spend them at emotional highs.)
- Soft-gate it: your own "Enjoying DeepLife?" modal first; only fire the native prompt on "Yes!", route "No" to Discord/feedback. You already have a rating modal in your standard checklist — the *placement* is what changes here.
- Discord push: pin a "leave an honest review" post with the direct review link when 1.5.0 ships; run a "review + screenshot it" gem giveaway (ask for *honest* reviews — incentivized 5★-only asks violate guidelines).
- Keep answering every review like you already do — your developer responses are genuinely excellent and visible social proof in themselves.
- **Target: 50+ ratings at ≥4.5★ within 60 days.** Everything else in this plan converts 2–3x better once this is true.

### 4.2 ASO fixes (this week)
- **Fix the broken social preview** (placeholder og:image) — upload proper promotional artwork in App Store Connect.
- **Subtitle:** "Real Economics. Real Choices." contains zero searchable keywords. Replace with keyword-rich benefit copy, e.g. **"Get rich, run empires, prestige"** or **"Rags to riches money life sim"** (30 chars). Subtitle is indexed for search.
- **Keyword field (100 chars):** life,sim,simulator,money,tycoon,rich,billionaire,dynasty,crime,mafia,stocks,idle,text,rags,riches — no spaces after commas, no words already in title/subtitle, no competitor brand names (rejection risk under 2.3.7; you already outrank on "deep life").
- **Screenshots:** first two must tell the story without sound: (1) a dramatic life event with a big caption "Your choices compound," (2) a net-worth graph going vertical "Build generational wealth," then careers grid, market screen, Life Card, prestige. Caption-led, dark UI on bold background. Follow the Apple asset best-practices doc you already use.
- **App preview video (15–30s):** screen recording of one life speedrun: $0 → job → loan → market crash → recovery → mansion → death → heir. This alone measurably lifts page conversion.
- **Localization (huge, cheap for you):** life sims over-index massively in **Brazil (pt-BR)** — do that first, then es-MX, de, fr, tr, id. Localize the *listing* first (days of work with your Claude pipeline), the game itself after; your checklist already has the CFBundleLocalizations step.

### 4.3 Apple featuring nomination
Submit via App Store Connect → Featuring nomination with the v1.5.0 story: solo Swedish dev, rebuilt an entire in-game economy from player feedback, no forced ads, no pay-to-win. Apple editorial loves exactly this narrative. Free, 15 minutes, asymmetric upside.

---

## 5. PILLAR 4 — Reddit (extend the playbook you already approved)

Your human-in-the-loop scout agent setup applies as-is. Additions specific to DeepLife:

- **Launch post for v1.5.0** in r/iosgaming + r/AndroidGaming (when relevant): dev-story format — "I spent a year building a life sim where the economy actually works. A maths bug was silently pushing every stock to zero — here's how I found it." Honest post-mortems outperform promos 10:1.
- **r/incremental_games + r/tycoon:** lead with the economic engine and prestige loop, not "life sim."
- **r/BitLifeApp:** never promote directly. Participate as a person; only mention DeepLife when someone asks for alternatives. One removal here poisons the well.
- **r/playmygame / r/DestroyMyGame:** free feedback + goodwill + trickle installs.
- Weekly cadence: 1 substantive post OR 5–10 helpful comments across the network. Every post links the App Store page (with its now-fixed preview image and healthy rating).
- Repost your best Life Cards and community screenshots — Reddit is where the screenshot loop from Pillar 1 compounds.

---

## 6. PILLAR 5 — Discord flywheel (community → content → retention)

You have the Discord; make it produce marketing assets:

- **Weekly challenge** (mirrors 2.3): winner's Life Card posted on TikTok/Reddit + gem prize. Community generates your content.
- **"Your event in the game":** monthly event-writing contest — winning life event ships in the next update with credit ("Event by BBQ", like your 1.3.5 notes already did). Cheap, viral-ish, deepens loyalty.
- **Bug bounty in gems:** formalize what you're already doing; converts complainers into contributors.
- **Changelog-as-content:** your update notes are unusually good — post each one to Discord + Reddit + a short TikTok ("we fixed the stock market. literally.").

---

## 7. Paid acquisition (only after Weeks 1–4 foundation)

Gate: ≥25 ratings at ≥4.3★, fast-forward shipped, at least one organic TikTok >50k views.

- **Channel:** TikTok Ads (SDK + AppsFlyer already integrated per your standard setup). Start $15–20/day.
- **Creative:** Spark Ads boosting your best-performing *organic* posts — never made-for-ads creative first. Refresh creative every 2 weeks from the organic winners.
- **Targets:** US/UK/CA/AU + SE. Optimize for install → then in-app event (day-1 "completed first week 10" or similar Mixpanel event).
- **Kill/scale rules:** CPI >$3 US or D1 <30% on paid cohorts → kill creative. CPI <$1.50 with D7 ≥10% → double budget weekly.
- Skip Apple Search Ads until ratings floor is solid; then a small exact-match campaign on "life simulator" terms is worth testing.

---

## 8. 8-week execution calendar

| Week | Focus | Ship / Do |
|---|---|---|
| 1 | Foundation | Fix og-image placeholder; new subtitle/keywords/screenshots in ASC; rating prompt re-placement at peak moments; TikTok/IG/Shorts accounts live; capture first gameplay batch; submit featuring nomination |
| 2 | v1.5.0 relaunch | Ship 1.5.0 + fast-forward; Discord review push; Reddit dev-story launch post; start Format A daily series; pt-BR listing localization |
| 3 | Content ramp | 1–2 TikToks/day across formats A–D; build Life Card feature; creator list (50 names) + first 10 outreach emails/DMs |
| 4 | Share loop live | Ship Life Card in 1.5.x; "share your Life Card" Discord challenge; Reddit screenshot posts; first 10 creator codes out |
| 5 | Double down | Analyze Mixpanel + TikTok data; kill weak formats, 2x the winner; challenge system live in-game; es-MX + de listings |
| 6 | Fuel | Start TikTok Spark Ads $15/day on top organic post (if gate met); second Reddit post (post-mortem or milestone) |
| 7 | UGC loop | "Rate my life" UGC format using players' Life Cards; mid-tier creator paid posts (3–5) |
| 8 | Review & compound | Full metrics review vs targets below; write next 8-week cycle; nominate for featuring again with traction data |

**Weekly time budget (solo, sustainable):** ~1h/day TikTok (batch capture Sundays), 2h/wk Reddit+Discord, 2h/wk ASO/outreach, rest into product. The Life Card and challenges are Claude Code sessions, not marketing time.

---

## 9. KPIs & instrumentation

North-star: **organic installs/week** + **D7 retention** (virality × retention is the whole game).

| Metric | 30 days | 90 days | Source |
|---|---|---|---|
| Ratings (US) | 25 @ ≥4.3★ | 100+ @ ≥4.5★ | App Store Connect |
| Organic installs/wk | 300 | 1,500+ | ASC + AppsFlyer |
| TikTok | 1 video >100k views | 3 videos >100k, 10k followers | TikTok analytics |
| Life Card shares / death | — (ships wk 4) | >8% of deaths | Mixpanel |
| D1 / D7 retention | 35% / 10% | 40% / 15% | Mixpanel |
| Page conversion (product page views→installs) | +25% vs today | +60% | ASC |
| Paid CPI (if running) | — | <$2 blended | AppsFlyer |

Review dashboard every Monday; move budget/time to whatever's working. Do not add channels until an existing one is saturated.

---

## 10. Risks & mitigations

- **Traffic arrives before quality does** → sequencing gate (Section 0). A viral spike on a buggy build creates 1-star reviews at scale — the one outcome worse than obscurity.
- **TikTok is a lottery** → volume + 4 formats + 30-day patience rule; Shorts/Reels cross-posting hedges platform risk.
- **Solo-dev burnout** → the calendar caps marketing at ~10h/wk; batch everything; the community flywheel (Pillar 6) is designed to generate content you don't have to make.
- **Incentivized-review policy risk** → only reward *honest* reviews, never condition on 5★.
- **Competitor fast-followers** (your "You Might Also Like" row is full of clones) → the real-economics positioning and dynasty depth are hard to clone; keep shipping the moat.

---

## 11. This week's checklist (start today)

1. Upload real promotional artwork in ASC (kill the placeholder social preview).
2. Rewrite subtitle + keyword field; queue new screenshots with captions.
3. Move the rating prompt to peak-positive moments; wire the soft-gate modal.
4. Create @deeplifesimulator on TikTok/IG/YT; record first gameplay batch; post video #1 of Format A tonight.
5. Submit Apple featuring nomination for v1.5.0.
6. Spec the Life Card with Claude Code (one screen, one share sheet, two aspect ratios, Mixpanel events).
7. Confirm fast-forward is in 1.5.0 or 1.5.1 — it gates the paid stage.
