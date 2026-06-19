# DeepLife Simulator — Retention & Content Strategy

**Date:** 2026-06-19
**Author:** Strategy planning pass (Claude)
**Status:** Proposal for review — nothing here is built yet
**Scope:** What to ship next (remake / DLC / updates), how to retain players, and how to do both at once.

---

## 0. How to read this document

This is a **decision + execution doc**, not a spec. Every section ends with a
**checklist you can tick through**. Items are tagged:

- `[NOW]` — high impact, low effort, mostly already half-built in the codebase
- `[NEXT]` — flagship work, the "next update / DLC"
- `[LATER]` — infrastructure or big bets that need lead time
- `💰` — directly monetizable
- `🔁` — directly improves retention (D1/D7/D30)

The guiding principle: **retention and "making the game better" are the same
project.** Every retention mechanic below is also a content/quality improvement,
not a dark-pattern bolt-on. We already have the systems; we are mostly *surfacing*
and *connecting* them.

---

## 1. Where DeepLife stands today (honest snapshot)

DeepLife is **not** a thin BitLife clone. It is a genuinely deep, economy-hardened
life sim with systems most competitors don't have:

**Strengths we should lean on:**
- 25+ interconnected systems (careers, dating w/ NPC depth, crime + dark web, crypto/mining, stocks, real estate, R&D patents, politics, pets, two in-game social apps — Pulse & Spark).
- A **prestige / generational loop** (Heir Mode, lineage, inherited traits) — this is our single biggest retention asset and most life sims lack it.
- A **forgiving, exploit-resistant daily-challenge system** with streak multipliers (up to 5×) already live.
- A diversified monetization catalog (gems, youth pills, perks, premium banking, bundles, ad-removal) already designed.

**Gaps that matter (this is where the next updates go):**
1. **No live-ops / seasonal content** — every player sees identical content forever. This is the #1 reason life sims churn at D7.
2. **Daily login rewards are coded as constants but have no UI.** Free retention win sitting on the shelf.
3. **No social / leaderboard layer** — no reason to compare, compete, or share.
4. **No remote content pipeline** — we can't ship events without an app update.
5. **No analytics** — we are flying blind on *why* players leave.
6. **First-session / onboarding gem curve is weak** — day-1 reward is gated behind the tutorial.

---

## 2. Competitive landscape (research)

### 2.1 BitLife — the incumbent to study, not copy

- **Cadence:** ships a major update **every 2–4 weeks**; 45+ major updates to date. Constant freshness is *the* product. [src]
- **Live-ops:** seasonal events (Halloween Scavenger Hunt, "Villain Season" with Evil Lairs/Special Lives), themed job packs (Dealer pack), "Boss Mode," Time Machine. Content is the live-ops engine. [src]
- **DLC model:** discrete **expansion packs ~$5 each** (e.g. Casino Expansion) layered on top of a subscription. [src]
- **Monetization:** ~$90k/day from interstitials *alone* (an ad every ~70s), **plus** the **Bitizen** subscription (removes ads, unlocks premium jobs/pets/items). Players average **34 min/day across ~5 sessions**, sustaining 15% D7 even with aggressive ads. [src]
- **Takeaway:** their moat is **cadence + breadth of content + a clean subscription**, not depth. We out-depth them; we lose on freshness and the subscription. **Close those two gaps and we have a differentiated product.**

### 2.2 The rising threat — AI / generative life sims

- **Infinite Life Simulation** is positioned as the most innovative 2025 entrant: AI-driven, "no two lives the same," NPCs that remember your history and pursue their own goals. [src]
- Academic work (**"Unbounded," generative-infinite-game**) shows generative NPC lives are now technically real. [src]
- Market: life-sim category growing ~7.5% CAGR; "AI in games" ~$2.87B (2025) → ~$3.4B (2026). [src]
- **Takeaway:** the genre is moving toward *personalized, non-repeating narrative.* **We already have an NPC depth system (goals, memories, moods) and a scenario/cliffhanger engine** — we are one step from this. This is our **flagship differentiator bet** (see §4).

### 2.3 Other competitors & what players ask for

- **InstLife / AltLife / Age Sim / Life is a Game:** clones; AltLife wins on *less aggressive ads + cleaner UI*. **Lesson: ad restraint + UX is a competitive axis.**
- **The Sims Mobile / inZOI / Paralives / Palia / Vivaland:** 3D, but the **most-requested features across the indie life-sim community are: deeper romantic relationships, multiplayer/social, and pets.** [src] We have pets and deep relationships; **social is our gap.**

**Sources:** BitLife Wiki Updates; Pro Game Guides (Casino Expansion); Gamigion (BitLife monetization); Infinite Life Simulation blog; generative-infinite-game.github.io; GameAnalytics 2025 retention benchmarks; Mistplay / Pushwoosh / Segwise retention guides; GamesHub & SimsCommunity life-sim roundups.

> Benchmark to beat: industry average **D1 ≈ 26%, D7 ≈ 10%, D30 < 4%**; top casual titles hit **D1 35%+, D7 12%+**. These are our targets in §9.

---

## 3. Strategy in one paragraph

**Ship a steady drumbeat of seasonal content (the BitLife lesson), powered by a
remote content pipeline so we never need an app update to run an event (the
live-ops gap), wrapped in a light social/leaderboard layer (the competitor gap),
and anchored by one flagship differentiator — AI-assisted "Living Story" narrative
built on our existing NPC-depth engine (the rising-threat answer).** Monetize with
a clean **DeepLife+ subscription** and a **Legacy Pass** (battle pass keyed to our
prestige loop), not more interstitials.

---

## 4. The flagship: "DeepLife Season 1 — Living Legacy"

This is the recommended **next big update / soft "remake" moment.** It bundles the
highest-leverage retention + content + monetization work into one marketable beat.

Four pillars:

### Pillar A — Living Story (the AI differentiator) `[NEXT]` 🔁
Turn our existing NPC-depth + scenario engine into a **personalized, non-repeating
narrative layer**. NPCs already track goals/memories/moods; surface that into
multi-week story arcs ("your rival from college resurfaces," "your child rebels").
- Two implementation tiers — **pick one in §10 decisions**:
  - **Tier 1 (no LLM, ship-safe):** richly authored branching arc library + the
    remote content pipeline, weighted by NPC state. Deterministic, offline, cheap.
  - **Tier 2 (LLM-assisted):** server-side generation for flavor text / event
    framing, seeded by NPC state. Higher wow, needs cost controls, moderation,
    offline fallback. (Use latest Claude models if pursued.)

### Pillar B — Seasons & the Legacy Pass (monetization + cadence) `[NEXT]` 💰🔁
A recurring **6-week season** with a free + premium track of rewards, keyed to the
**prestige/Heir loop we already have** (rewards = cosmetics, youth pills, gems,
exclusive heritable traits). This is BitLife's "Villain Season" but tied to *our*
unique generational system.

### Pillar C — Social & Leaderboards (the genre gap) `[NEXT]` 🔁
Net-worth / longevity / "best life score" leaderboards + shareable end-of-life
"Legacy Card" image. Low-cost virality; addresses the #1 missing competitive axis.

### Pillar D — Onboarding & Daily Loop polish (the cheap wins) `[NOW]` 🔁
Ship the already-coded daily login rewards UI, fix the day-1 gem curve, add
push-notification re-engagement. These are the fastest D1/D7 movers and need almost
no new design.

---

## 5. RETENTION ROADMAP — checklist

### 5.1 Cheap wins — ship first `[NOW]` 🔁
- [ ] **Deploy daily-login reward UI** — constants `[25,50,75,100,150,200,500]` already exist; build the 7-day claim modal + state. (Biggest effort:reward ratio in the codebase.)
- [ ] **Fix day-1 gem curve** — front-load the first-session reward so a brand-new player feels generous progress before the tutorial gate (roadmap item M5).
- [ ] **Push notifications for re-engagement** — feature flag `notifications` exists; wire 3 triggers: (a) daily challenge reset, (b) streak about to break, (c) "your business/crypto earned $X while away."
- [ ] **Streak-save grace messaging** — we already forgive 48h; *tell the player* ("Your 6-day streak is safe until tomorrow") to weaponize loss aversion.
- [ ] **"While you were away" summary** on app open — passive income from companies/crypto/real estate already accrues; surface it as a dopamine hit.
- [ ] **Toast/notification dedup** (roadmap M-item) so the reward moments don't get buried.

### 5.2 Session & mid-term retention `[NEXT]` 🔁
- [ ] **Daily login UI → 30-day cycle** (extend the 7-day to a monthly calendar with a marquee day-30 reward).
- [ ] **Weekly goals** (in addition to daily): "Earn $50k this week," "Reach a new career tier" — bridges daily → seasonal.
- [ ] **Comeback bonus** for lapsed players (7+ days away): a one-time gem + youth-pill "welcome back" grant.
- [ ] **Milestone celebration moments** — we track net-worth/week/relationship milestones with 85% "proximity alerts"; turn hitting them into full-screen shareable moments.
- [ ] **Achievement expansion** — only 7 hardcoded today; expand to 40–60 across all systems (crime, crypto, politics, parenting, prestige) for long-tail completionism.

### 5.3 Long-term / identity retention `[LATER]` 🔁
- [ ] **Seasons live** (see §6) — the core anti-churn engine.
- [ ] **Leaderboards + Legacy Card sharing** (see §7).
- [ ] **Collection / codex** — "Lives Lived" museum of past generations, careers tried, diseases survived, NPCs met. Completionist hook tied to prestige.
- [ ] **Hardcore / Ironman mode** — permadeath, no youth pills, exclusive cosmetic reward. Adds replay identity for veterans.

---

## 6. SEASONS & LIVE EVENTS — checklist

> The single most important *new* capability. BitLife's whole model is cadence.

### 6.1 Infrastructure `[LATER]` (prerequisite — roadmap N1)
- [ ] **Remote content pipeline** — move hardcoded scenarios/careers/diseases/events into a **versioned, signed manifest** the app fetches. Ship events without an app-store update. *This unblocks everything else in this section.*
- [ ] **Manifest validation + offline fallback** — verify checksum/signature (we already do CRC32 on saves; reuse the discipline), cache last-good, never break offline play.
- [ ] **A/B bucketing** (roadmap N3) — consistent-hash players into cohorts so we can test event/balance variants.

### 6.2 Seasonal content `[NEXT]` 💰🔁
- [ ] **Season 1: "Living Legacy"** — 6-week season, themed scenario arcs, seasonal job rotation, exclusive heritable trait as the marquee reward.
- [ ] **Holiday/seasonal events** (BitLife's proven playbook): Halloween (spooky careers/diseases), Winter (gifting, family events), Summer (travel-themed). Reuse our **Travel, Pets, Dating, Family** systems with seasonal skins.
- [ ] **Limited-time "flash" economic events** — reuse the existing `applyEconomicEvent` engine: a crypto bull run weekend, a stock-market crash event, a startup-IPO window. Creates urgency on systems we already have.
- [ ] **Event calendar doc** — maintain a forward 3-month content calendar so cadence is intentional, not ad-hoc.

### 6.3 The Legacy Pass (battle pass) `[NEXT]` 💰🔁
- [ ] **Free + premium track**, 6-week duration, keyed to **prestige progress + daily-challenge streaks** (we already generate the engagement signal).
- [ ] **Rewards = no pay-to-win:** cosmetics (apartment themes, vehicle skins, profile frames), youth pills, gems, exclusive heritable traits. Power stays earnable.
- [ ] **Keep the free track genuinely rewarding** (retention research: free-track value is what makes non-payers stay and eventually convert).
- [ ] **Pass tied to the in-fiction "Legacy" theme** so it feels native, not bolted on.

---

## 7. SOCIAL & VIRALITY — checklist `[NEXT]` 🔁

- [ ] **Leaderboards:** net worth, longevity (weeks lived), generations reached, "Best Life Score" (a composite). Weekly + all-time + seasonal boards.
- [ ] **"Legacy Card" shareable image** — auto-generate a stylized end-of-life summary card (career, net worth, family tree, cause of death, score) for one-tap share to socials. Cheapest organic-growth lever we have. (We already have `SCREENSHOT_GUIDE.md` / strong screen visuals to build on.)
- [ ] **Friend codes / async compare** — compare your current life vs. a friend's without real-time multiplayer (avoids server complexity).
- [ ] **Seasonal community goal** — global aggregate ("the DeepLife world collectively earned $1T this season → everyone gets a reward"). Cheap, fun, bonding.
- [ ] **(LATER) Heir trading / lineage showcase** — let players publish a "famous lineage" others can view. Long-term social identity.

---

## 8. CONTENT / DLC EXPANSIONS — checklist

> Sold as discrete packs (BitLife's ~$5 model) *or* folded into DeepLife+ subscription. Decide in §10.

- [ ] **Career/Life-path packs** `[NEXT]` 💰 — themed bundles reusing our job/hobby engine: *Criminal Empire* (expand dark web), *Hollywood* (expand streaming/content/celebrity), *Tycoon* (expand companies/real estate/R&D), *Politician* (expand the political ladder).
- [ ] **Romance & Family expansion** `[NEXT]` 💰🔁 — players ask for this genre-wide: deeper dating arcs, more wedding venues, parenting mini-decisions, family drama events. Leverages NPC depth.
- [ ] **Pets+ pack** `[LATER]` 💰 — more species, pet competitions, pet inheritance. (Pets are a top-3 requested life-sim feature.)
- [ ] **Cosmetics store** `[NEXT]` 💰 — apartment themes, vehicle wraps, profile frames, "lineage crests." **Gems-only, zero pay-to-win.** Pure-margin, non-controversial revenue.
- [ ] **"Season 2" narrative arcs** `[LATER]` — branching multi-week storylines per life path (career storylines, crime-investigation chains, romance arcs). Depth play.
- [ ] **Rare collectibles / heritable traits** `[NEXT]` 🔁 — event-exclusive traits that auto-pass to heirs; ties content → prestige → retention.

---

## 9. MONETIZATION IMPROVEMENTS — checklist 💰

> Principle: **earn trust, then revenue.** AltLife beats clones partly on ad restraint; we differentiate on respect-for-player. No BitLife-style ad-every-70-seconds.

### 9.1 Launch blockers (must clear before *any* revenue) `[NOW]`
- [ ] **IAP verification backend** (RevenueCat or custom) — `EXPO_PUBLIC_IAP_VERIFY_URL` unset = **all purchases refused today.** Hard blocker.
- [ ] **Real AdMob unit IDs** — test IDs currently → $0 ad revenue.
- [ ] **HMAC key as EAS secret** (one-time, non-rotatable) + **purge leaked Play service-account key** from git history.
- [ ] **Privacy policy aligned to actual ad delivery** (currently says ads disabled).
- [ ] **Android UMP/GDPR consent** before personalized ads.

### 9.2 New revenue lines `[NEXT]` 💰
- [ ] **DeepLife+ subscription** (the missing BitLife-Bitizen analog): removes ads, monthly gem stipend, exclusive seasonal cosmetics, "+1 daily challenge reroll." Recurring revenue >> one-shot IAPs. **Price test $4.99/mo, $29.99/yr.**
- [ ] **Legacy Pass** (§6.3) — seasonal, ~$7.99/season.
- [ ] **Cosmetics store** (§8) — gems-only, pure margin, no balance impact.
- [ ] **Rewarded-ad expansion** (opt-in only): "watch to claim daily bonus," "watch to revive," "watch to reroll a challenge." Respectful, player-initiated, proven non-churning.

### 9.3 Hygiene & fairness `[NEXT]`
- [ ] **Verify Premium Pack multipliers actually apply** (roadmap H-item: 1.5× income mapping unverified — we may be selling a boost that does nothing).
- [ ] **Keep the 2.0× income soft-cap** — protects long-term economy from pay-to-win runaway; reassure players power is earnable.
- [ ] **Decide stock vs. crypto capital-gains tax consistency** (crypto taxed 25%/yr, stocks untaxed) — fairness + economy integrity.

---

## 10. NEW THINKING / BIG BETS — checklist

- [ ] **Living Story (AI narrative)** `[LATER]` 🔁 — the genre is moving here (Infinite Life Simulation). We have the NPC-depth substrate; **this is our defensible differentiator.** Decide Tier 1 vs Tier 2 (§4 Pillar A).
- [ ] **Analytics first, everything else second** `[NOW]` — roadmap N2. We currently log only onboarding. **We cannot improve retention we can't measure.** Instrument: session length, where players quit, challenge completion, funnel to first purchase, D1/D7/D30 cohorts. *This should arguably be the very first thing built* — it makes every other item on this list measurable.
- [ ] **"One more generation" prestige polish** `[NEXT]` 🔁 — our prestige loop is the moat BitLife lacks. Make the Heir hand-off a *cinematic, emotional* moment (inheritance reveal, trait passing, family-tree growth). Lean into it as the brand signature.
- [ ] **Reduce decision fatigue** `[LATER]` — 25+ systems can overwhelm new players (AltLife wins on cleaner UX). Add a **"focus mode" / guided life goals** so newcomers aren't lost. Onboarding clarity = retention.
- [ ] **Deterministic sim replay** `[LATER]` — roadmap N5; lets us regression-test balance across content drops so live-ops never breaks economy. Quality moat.
- [ ] **Quality scorecard gate** `[LATER]` — roadmap N4; automated test/coverage/type/error-rate gate per release so cadence never sacrifices stability.

---

## 11. Recommended sequencing (so this isn't 80 things at once)

| Wave | Theme | Items | Why first |
|------|-------|-------|-----------|
| **Wave 0 — "See & Stabilize"** (now) | Measure + clear blockers | Analytics (§10), IAP backend + AdMob + key purge (§9.1), daily-login UI + day-1 gem fix + push (§5.1) | Can't improve blind; can't earn while purchases are refused; cheapest retention wins are already coded |
| **Wave 1 — "Daily Loop"** | Make coming back daily feel great | Rest of §5.1–5.2, achievement expansion, "while you were away" | Moves D1/D7 fastest, low risk |
| **Wave 2 — "Live-Ops Engine"** | Remote pipeline + first season | §6.1 pipeline, §6.2 Season 1, §6.3 Legacy Pass | Unlocks cadence — the core BitLife lesson; opens recurring revenue |
| **Wave 3 — "Social & Share"** | Virality + competition | §7 leaderboards + Legacy Card | Organic growth + D30 identity |
| **Wave 4 — "Differentiate"** | The big bet | §10 Living Story, prestige cinematics, content packs | Defensible moat vs. AI entrants |

---

## 12. KPIs — how we'll know it worked

- [ ] **D1 retention** — target **35%+** (industry avg 26%).
- [ ] **D7 retention** — target **12%+** (industry avg 10%; BitLife 15% even with heavy ads).
- [ ] **D30 retention** — target **6%+** (industry avg <4%).
- [ ] **Daily-challenge completion rate** & **avg streak length** (our core engagement signal).
- [ ] **Sessions/day & session length** (BitLife benchmark: ~5 sessions, ~34 min/day).
- [ ] **Prestige rate** — % of players who reach a 2nd generation (our moat metric).
- [ ] **ARPDAU & conversion to first purchase**; **subscription attach rate**.
- [ ] **Season pass attach rate** & **free-track completion** (health of the live-ops loop).
- [ ] **K-factor / shares per death** (virality of the Legacy Card).

---

## 13. Open decisions for you (resolve before Wave 2)

1. **Living Story:** Tier 1 (authored, offline, safe) or Tier 2 (LLM-assisted, higher wow, needs cost/moderation/offline-fallback)?
2. **DLC model:** discrete paid packs (BitLife ~$5 style) **or** fold all content into the DeepLife+ subscription **or** hybrid?
3. **Ad philosophy:** confirm "rewarded + light interstitial only" (our differentiator) vs. BitLife-style aggressive interstitials (more revenue, more churn/brand risk)?
4. **First season theme & length** — confirm "Living Legacy," 6 weeks.
5. **Build order confirmation** — is "analytics + blockers first" (Wave 0) acceptable, or is there pressure to ship visible content before instrumentation?

---

*This plan deliberately reuses existing systems (prestige, NPC depth, daily
challenges, economic events, the two social apps, travel/pets/family) rather than
inventing net-new ones. The fastest path to "better game + retained players" is to
**connect, surface, and schedule** what DeepLife already has — then place one big
bet (Living Story) on where the genre is going.*
