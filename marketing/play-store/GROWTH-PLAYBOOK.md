# Growth playbook - launch order, copy, and Reddit posts

Read the honesty note first. **Nobody can promise zero negative comments.** The
only reliable way to get none is to (a) follow every subreddit's own rules,
(b) disclose you are the developer, (c) ask for feedback instead of downloads,
(d) never use alt accounts or fake praise, and (e) answer every comment within
an hour of posting. Anything that looks like marketing gets downvoted; anything
that looks like a dev sharing their work gets upvoted. That is the whole game.

## Priority order (do them in this order)

1. **Play Store Listing Experiments** (free, compounding). *Öka antalet
   användare -> Butikslistningsexperiment.* Test **icon A/B first** - it is the
   single highest-conversion element. Then test the **first screenshot**.
   Expected: 5-20% more installs from the same traffic, forever.
2. **Swedish + the Group 1 localisations** (`LOCALIZATIONS.md`). More indexed
   keywords = more organic traffic with zero ad spend.
3. **The in-app rating prompt** (already built). Ratings volume lifts rank and
   is the cheapest long-term lever you have.
4. **Reddit launch** (below). Do it *after* the listing is localised and the
   rating prompt is live, so the traffic converts.
5. **TikTok / Reels** (`marketing/tiktok_scripts.md`). Post 1-3/day; the format
   succeeds on the hook, not production value.
6. **Apple Search Ads** for iOS (`marketing/apple-ads/`).
7. Google Play **pre-registration** for the NEXT release only.

## The one rule that matters most on Reddit

**Traffic that arrives before the store page is good converts at 1-2%. Traffic
that arrives after it is good converts at 20-30%.** Do not post anywhere until
the listing looks finished - screenshots, icon, rating prompt live.

---

## Reddit posts (organic, rule-safe)

> Links are filled in and tracked: each one reports its subreddit as the
> `utm_source` in Play Console (*Butikens resultat → Butiksanalys*). r/AndroidGaming
> gets the plain Play link (an Android-only sub, and a visible destination reads
> as trustworthy); mixed audiences get the cross-platform `get/` page, which
> sends each reader to their own store. The `get/` links work once PR #219 is merged.

Post **one subreddit at a time**, spaced a day apart. Reply to every comment.
Never post the same text twice in 24 hours. Always check that day's subreddit
rules - they change.

### 1. r/AndroidGaming

**Title:**
```
I spent two years making a life sim with an actual economy instead of dice rolls
```
**Body:**
```
Hi r/AndroidGaming - I'm the solo dev of Deep Life Simulator, out now on Android.

I grew up on life sims where every decision is a dice roll and a line of text.
The thing that always bugged me: the dice never pushed back. So I built one where
the economy keeps running between your choices.

What that means in practice:
- Wages are taxed, loans charge weekly interest, rent is due whether or not you
  can pay it. Unpaid bills become arrears that follow you into next year.
- The stock market moves whether or not you are looking at it.
- You can be a surgeon who never breaks the law, or a courier who ends up
  running a dark web operation out of a rented room. Both are real routes.
- When you die, your heir inherits your fortune AND your mess.

It runs offline, ads are only at year boundaries (never in your first two
in-game years), and one purchase removes them.

I would genuinely love feedback from this sub on the first-30-minutes
experience - that is the part I have reworked the most and the part I am least
sure about. What is confusing? What made you put it down?

Link: https://play.google.com/store/apps/details?id=com.deeplife.simulator&referrer=utm_source%3Dreddit_androidgaming%26utm_medium%3Dreddit
```
*Why this works here:* leads with the design problem, not the product; asks for
serious feedback; states the ad policy up front (this sub punishes hidden ads).

### 2. r/iosgaming

**Title:**
```
A life sim where the economy runs whether or not you are watching
```
**Body:** same as r/AndroidGaming, swap the store link and note it is on iOS too
with the same save format. Add: *"Happy to answer anything about how the weekly
tick works - it is fully deterministic, so the same life replays identically."*

### 3. r/playmygame (built for feedback requests)

**Title:**
```
[Android/iOS] Deep Life Simulator - life sim with a real economic sim under it
```
**Body:**
```
Genre: life / business simulation
Platforms: Android (new), iOS
Playtime: runs in decades of in-game weeks; ~20 min for the first month
Price: free, ads at year boundaries only, one IAP removes them

Looking for: whether the first 30 minutes teach you what to do. I have a
first-job coach, but I want to know if it actually lands.

Link: https://wrexist.github.io/DeepLifeSimulator/get/?src=reddit_playmygame
```
*Why this works here:* this sub exists for exactly this; a feedback ask with
playtime and a specific question is what it rewards.

### 4. r/IndieGaming

**Title:**
```
The hardest part of my life sim was making 100 small choices compound instead of one big dice roll
```
**Body:**
```
Solo dev, two years. The central design bet: a single decision should almost
never matter, but a hundred of them should change your life.

That sounds nice and is brutal to implement. Every subsystem has to feed the
next one - a job pays a wage, the wage gets taxed, taxes interact with arrears,
arrears interact with your credit score, the credit score gates a loan, the loan
buys a property that pays rent that funds the next life's heir.

If you like that kind of design, I would love to talk about it. Game is out on
Android and iOS: https://wrexist.github.io/DeepLifeSimulator/get/?src=reddit_indiegaming
```
*Why this works here:* pure craft discussion, link last.

### 5. r/tycoon

**Title:**
```
I built a tycoon game where the tax brackets, loan interest and arrears are all real systems, not flavour text
```
**Body:**
```
Hello r/tycoon. Deep Life Simulator is a life tycoon where the numbers are the
game. A few things this sub tends to care about:

- Money has a failure state: unpaid bills become arrears with a weekly fee, and
  enough of them bankrupt you.
- The market is a simulated tape with sector rotation, not a fixed chart.
- Mining pays out in crypto net of an electricity bill that can exceed the yield
  if you over-buy.
- Prestige is generational: your heir keeps the assets and the debts.

Would love the nitpicky feedback this sub gives. https://wrexist.github.io/DeepLifeSimulator/get/?src=reddit_tycoon
```
*Why this works here:* speaks their language (systems), invites nitpicks.

### 6. r/gamedev (technical / determinism angle)

**Title:**
```
How I made a fully deterministic weekly simulation (same life replays identically) and why it was the hardest bug class
```
**Body:**
```
Not a promo post - happy to answer questions. I built a life sim on a weekly
tick, and I wanted any life to replay byte-identically from a save, because
otherwise the whole economy is untestable.

The bugs were all the same shape: an unseeded Math.random() or a Date.now() id
written into saved state. The worst one was an event engine that picked the
week's event from a week-seeded roll, so every player drew the same number in
week N and saw one of 365 events instead of their own - twelve test lives hit 33
distinct events; the same twelve on salted rolls hit 78.

Now guarded by a static audit: no Math.random() anywhere in the tick, and every
tick-reachable module with a draw or clock read must declare itself.

The game is https://wrexist.github.io/DeepLifeSimulator/get/?src=reddit_gamedev if you want to see the result, but genuinely here
for the systems talk.
```
*Why this works here:* this sub upvotes technical depth and downvotes promos;
the disclosure that it is also your game is expected and fine.

---

## What will get you negative comments (avoid all of this)

- Posting the same text to five subs in one day. Reddit flags it as spam.
- Not saying you are the developer. It always gets found out.
- Alt accounts or asking friends to comment. Bannable, and it would make every
  good comment look fake.
- Posting a link with no context, or posting in r/gaming / r/Games (self-promo
  bans).
- Ignoring criticism. Answer every critical comment with "fair, here's why" -
  that single habit is what turns a hostile thread into a receptive one.
- Posting to a country sub in English (r/sweden etc.) - either translate or skip.

## Metrics to watch (first 14 days)

- **Install conversion**: Play Console -> *Statistik* -> store listing
  acquisition. Below 20%? Fix the icon/screenshots via Experiments.
- **Crash-free rate** -> *Övervaka och förbättra* -> Android vitals. Below 99%?
  Stop marketing, fix, then resume.
- **Ratings**: target 4.0+ before you spend any ad money. Ads multiply a bad
  rating, they do not fix it.
- **Retention (D1/D7)**: if D1 is under ~25%, the first 10 minutes need work, not
  more traffic.
