# Copy-paste blocks for Apple Ads

Every list below is **comma-separated and ready to paste**. Apple Ads accepts
a comma-separated paste in the keyword box — it splits them into individual
keywords automatically. Each block says exactly where it goes.

> ⚠️ **Generated file — do not edit by hand.** It is built from the CSVs in
> `keywords/` and `negatives/`. Edit those, then run:
>
> ```bash
> node marketing/apple-ads/build-paste-blocks.js
> node marketing/apple-ads/build-negatives.js
> ```

Set **match type = Exact** for every keyword block except Discovery, which is
Broad. Set **every negative keyword to Exact**, always.

---

## Where each block goes — quick reference

| # | Block | Paste into | Match |
|---|---|---|---|
| 1 | Brand keywords | `DLS-US-Brand-Exact` → ad group `Brand` → Keywords | Exact |
| 2 | Category — LifeSim-Core | `DLS-US-Category-Exact` → ad group `LifeSim-Core` → Keywords | Exact |
| 3 | Category — Money-Wealth | `DLS-US-Category-Exact` → ad group `Money-Wealth` → Keywords | Exact |
| 4 | Category — Career-Job | `DLS-US-Category-Exact` → ad group `Career-Job` → Keywords | Exact |
| 5 | Category — Investing-Stocks | `DLS-US-Category-Exact` → ad group `Investing-Stocks` → Keywords | Exact |
| 6 | Category — Business-Tycoon | `DLS-US-Category-Exact` → ad group `Business-Tycoon` → Keywords | Exact |
| 7 | Category — RealEstate | `DLS-US-Category-Exact` → ad group `RealEstate` → Keywords | Exact |
| 8 | Category — Crime-Underground | `DLS-US-Category-Exact` → ad group `Crime-Underground` → Keywords | Exact |
| 9 | Category — Choices-Story | `DLS-US-Category-Exact` → ad group `Choices-Story` → Keywords | Exact |
| 10 | Competitor — BitLife | `DLS-US-Competitor-Exact` → ad group `BitLife` → Keywords | Exact |
| 11 | Competitor — LifeSim-Rivals | `DLS-US-Competitor-Exact` → ad group `LifeSim-Rivals` → Keywords | Exact |
| 12 | Competitor — Tycoon-Rivals | `DLS-US-Competitor-Exact` → ad group `Tycoon-Rivals` → Keywords | Exact |
| 13 | Discovery seeds | `DLS-US-Discovery-Broad` → ad group `Discovery-Broad` → Keywords | **Broad** |
| 14 | Global negatives | `DLS-US-Category-Exact`, `DLS-US-Competitor-Exact`, `DLS-US-Discovery-Broad` → **Campaign**-level Negative keywords | Exact |
| 15 | Discovery graduated negatives | `DLS-US-Discovery-Broad` → **Campaign**-level Negative keywords | Exact |
| 16 | Ad-group crosslocks | each Category ad group → **Ad group**-level Negative keywords | Exact |

**Brand gets no negative keywords.** Every search reaching it is someone typing
your app name — there is nothing to filter, and a negative there can only cost
you a cheap branded install.

**Negative keywords only exist on Search Results campaigns.** If you later add
Today tab / Search tab / Product Pages campaigns, they have no keyword or
negative-keyword fields at all.

---

## 1 · Brand keywords

**Campaign:** `DLS-US-Brand-Exact` → **Ad group:** `Brand`
**Match type:** Exact · **Default max CPT bid:** $0.80 · **Search Match:** OFF
**15 keywords** — includes deliberate misspellings; people typo your name and those taps are cheap.

```text
deeplife, deep life, deeplife simulator, deep life simulator, deeplife sim,
deep life sim, deeplife game, deep life game, deeplife simulation,
deeplife plus, deeplife app, deaplife, deeplife simulater,
deep life simulater, deeplife sumilator
```

---

## 2 · Category keywords — 8 ad groups

**Campaign:** `DLS-US-Category-Exact` · **Match type:** Exact · **Search Match:** OFF

Create the eight ad groups below and paste one block into each. Do **not**
merge them — one bid and one set of screenshots per theme is the whole point.

### 2.1 Ad group `LifeSim-Core`

**Default max CPT bid:** $1.30 · **18 keywords**

```text
life simulator, life sim, life simulator game, life simulation game,
life sim game, realistic life simulator, real life simulator,
virtual life game, virtual life simulator, my life simulator,
live another life game, adulthood simulator, growing up game,
life story game, life rpg, text life simulator, life choices game,
human life simulator
```

### 2.2 Ad group `Money-Wealth`

**Default max CPT bid:** $1.05 · **13 keywords**

```text
get rich game, money simulator, billionaire simulator, billionaire game,
millionaire game, rich life game, wealth simulator, rags to riches game,
money management game, financial simulator, debt simulator,
bankruptcy game, net worth game
```

### 2.3 Ad group `Career-Job`

**Default max CPT bid:** $0.95 · **8 keywords**

```text
career simulator, career game, job simulator game, work life simulator,
ceo simulator, corporate ladder game, office simulator, salary simulator
```

### 2.4 Ad group `Investing-Stocks`

**Default max CPT bid:** $1.00 · **12 keywords**

```text
stock market game, stock market simulator, stock simulator,
trading simulator, investing game, investing simulator, stock trading game,
crypto trading game, crypto simulator, day trading game, wall street game,
portfolio simulator
```

### 2.5 Ad group `Business-Tycoon`

**Default max CPT bid:** $1.05 · **10 keywords**

```text
tycoon game, business simulator, business tycoon, business game,
entrepreneur game, startup simulator, company simulator,
empire building game, business empire game, management simulator
```

### 2.6 Ad group `RealEstate`

**Default max CPT bid:** $0.95 · **8 keywords**

```text
real estate tycoon, real estate game, property tycoon,
real estate simulator, landlord simulator, landlord game,
house flipping game, property empire game
```

### 2.7 Ad group `Crime-Underground`

**Default max CPT bid:** $0.90 · **10 keywords**

```text
crime simulator, criminal life simulator, crime life game, mafia game,
gangster game, drug dealer game, dark web game, hacker simulator,
money laundering game, underworld game
```

### 2.8 Ad group `Choices-Story`

**Default max CPT bid:** $0.85 · **8 keywords**

```text
choices game, life choices simulator, choice based game, decision game,
interactive story game, text based game, story simulator,
choose your own adventure game
```

---

## 3 · Competitor keywords — 3 ad groups

**Campaign:** `DLS-US-Competitor-Exact` · **Match type:** Exact · **Search Match:** OFF
**Daily budget: $6 — hard cap.** This is the most expensive, worst-converting
inventory in the account. Do not raise it until it clears target CPA over $150+
of spend.

### 3.1 Ad group `BitLife`

**Default max CPT bid:** $1.60 · **8 keywords**

```text
bitlife, bit life, bitlife simulator, bitlife life simulator,
games like bitlife, bitlife alternative, apps like bitlife,
better than bitlife
```

### 3.2 Ad group `LifeSim-Rivals`

**Default max CPT bid:** $1.10 · **10 keywords**

```text
altlife, alt life, instlife, life simulator 3, hobo life, my success story,
the sims mobile, avakin life, virtual families, alter ego game
```

### 3.3 Ad group `Tycoon-Rivals`

**Default max CPT bid:** $0.90 · **6 keywords**

```text
adventure capitalist, cash inc, idle bank tycoon, landlord go,
taps to riches, billionaire capitalist
```

---

## 4 · Discovery seeds

**Campaign:** `DLS-US-Discovery-Broad` → **Ad group:** `Discovery-Broad`
**Match type: BROAD** (the only broad block) · **Max CPT bid:** $0.50 · **Search Match: ON**
**12 seed keywords**

```text
life simulator, life sim game, get rich game, money simulator,
career simulator, business simulator, tycoon game, stock market game,
real estate game, crime simulator, choices game, simulation game
```

Then create a **second ad group** in the same campaign called
`Discovery-SearchMatch` with **no keywords at all** and **Search Match ON**.
That is deliberate — it matches against your product page metadata and finds
the long tail your seeds miss.

---

## 5 · Global negative keywords

**Paste into the CAMPAIGN-level Negative keywords box of all three:**
`DLS-US-Category-Exact` · `DLS-US-Competitor-Exact` · `DLS-US-Discovery-Broad`

**Not Brand.** **Match type: Exact** — a broad negative here would silently
mute whole ad groups.

**169 negatives.** These are the traps your own three core words
create: "life" pulls insurance and Life360, "simulator" pulls the truck/farming/
animal-sim genre, and money/stocks/career/dating each sit on a real-utility app.

```text
life insurance, term life insurance, whole life insurance,
life insurance quotes, life insurance calculator, life360, life 360,
half life, half life 2, life is strange, still life, shelf life, wildlife,
wild life, sea life, night life, nightlife, afterlife, plant life,
life cycle, life coach, life planner, daily life planner,
life expectancy calculator, healthy life, my talking tom, flight simulator,
truck simulator, euro truck simulator, bus simulator, farming simulator,
train simulator, car simulator, driving simulator, car parking simulator,
drift simulator, plane simulator, ship simulator, forklift simulator,
tractor simulator, snow plow simulator, lawn mowing simulator,
power wash simulator, pc building simulator, cooking simulator,
fishing simulator, surgeon simulator, police simulator, army simulator,
war simulator, gun simulator, zombie simulator, goat simulator,
animal simulator, cat simulator, dog simulator, horse simulator,
wolf simulator, lion simulator, tiger simulator, shark simulator,
spider simulator, dinosaur simulator, bee simulator, ant simulator,
anime dating simulator, dating simulator anime, cash app, paypal, venmo,
money transfer, send money, money manager, budget app, expense tracker,
loan app, payday loan, borrow money, credit score, make money online,
earn money app, money making apps, get paid to play games,
real money games, win real money, robinhood, webull, coinbase, binance,
etoro, tradingview, forex trading, stock tracker, stock portfolio tracker,
crypto wallet, bitcoin wallet, buy bitcoin, resume builder, resume,
cv maker, indeed, linkedin, job search, job finder, interview prep, zillow,
redfin, realtor, apartments for rent, houses for sale, mortgage calculator,
property management, tinder, bumble, hinge, dating app, meet singles, gta,
grand theft auto, gta 5, gta san andreas, roblox, minecraft, among us,
fortnite, free fire, pubg, call of duty, clash of clans, brawl stars,
subway surfers, candy crush, monopoly go, sims 4, the sims 4,
sims 4 cheats, sims freeplay, mod apk, mod menu, apk download, apk,
unlimited money mod, hack, cheats, cheat codes, unblocked, cracked,
free download, online, pc game, steam, xbox, playstation, ps5,
nintendo switch, emulator, movie, netflix, anime, manga, wallpaper,
ringtone, quotes, audiobook, kids games, games for kids, toddler games,
baby games, preschool games
```

---

## 6 · Discovery graduated negatives

**Paste into the CAMPAIGN-level Negative keywords box of `DLS-US-Discovery-Broad` only.**
**Match type: Exact.**

**126 negatives** — every keyword you bid on in Brand, Category and
Competitor. Without this, Discovery bids against your own optimized campaigns
and pushes their CPT up for reasons that look like market competition.

**Re-generate this every time a keyword graduates out of Discovery:**

```bash
node marketing/apple-ads/build-negatives.js
node marketing/apple-ads/build-paste-blocks.js
```

```text
deeplife, deep life, deeplife simulator, deep life simulator, deeplife sim,
deep life sim, deeplife game, deep life game, deeplife simulation,
deeplife plus, deeplife app, deaplife, deeplife simulater,
deep life simulater, deeplife sumilator, life simulator, life sim,
life simulator game, life simulation game, life sim game,
realistic life simulator, real life simulator, virtual life game,
virtual life simulator, my life simulator, live another life game,
adulthood simulator, growing up game, life story game, life rpg,
text life simulator, life choices game, human life simulator,
get rich game, money simulator, billionaire simulator, billionaire game,
millionaire game, rich life game, wealth simulator, rags to riches game,
money management game, financial simulator, debt simulator,
bankruptcy game, net worth game, career simulator, career game,
job simulator game, work life simulator, ceo simulator,
corporate ladder game, office simulator, salary simulator,
stock market game, stock market simulator, stock simulator,
trading simulator, investing game, investing simulator, stock trading game,
crypto trading game, crypto simulator, day trading game, wall street game,
portfolio simulator, tycoon game, business simulator, business tycoon,
business game, entrepreneur game, startup simulator, company simulator,
empire building game, business empire game, management simulator,
real estate tycoon, real estate game, property tycoon,
real estate simulator, landlord simulator, landlord game,
house flipping game, property empire game, crime simulator,
criminal life simulator, crime life game, mafia game, gangster game,
drug dealer game, dark web game, hacker simulator, money laundering game,
underworld game, choices game, life choices simulator, choice based game,
decision game, interactive story game, text based game, story simulator,
choose your own adventure game, bitlife, bit life, bitlife simulator,
bitlife life simulator, games like bitlife, bitlife alternative,
apps like bitlife, better than bitlife, altlife, alt life, instlife,
life simulator 3, hobo life, my success story, the sims mobile,
avakin life, virtual families, alter ego game, adventure capitalist,
cash inc, idle bank tycoon, landlord go, taps to riches,
billionaire capitalist
```

---

## 7 · Ad-group crosslocks

**Paste into the AD GROUP-level Negative keywords box of the named Category ad
group.** **Match type: Exact.**

These stop two Category ad groups fighting over the same ambiguous term, so each
term has exactly one owner and its performance data stays in one place.

### Ad group `LifeSim-Core` — 6 negatives

```text
tycoon game, business simulator, money simulator, career simulator,
crime simulator, choices game
```

### Ad group `Money-Wealth` — 4 negatives

```text
life simulator, business simulator, investing game, real estate game
```

### Ad group `Career-Job` — 3 negatives

```text
life simulator, business simulator, ceo simulator
```

### Ad group `Business-Tycoon` — 4 negatives

```text
ceo simulator, life simulator, real estate tycoon, money simulator
```

### Ad group `Investing-Stocks` — 3 negatives

```text
money simulator, business simulator, life simulator
```

### Ad group `RealEstate` — 3 negatives

```text
tycoon game, business simulator, life simulator
```

### Ad group `Crime-Underground` — 2 negatives

```text
life simulator, money simulator
```

### Ad group `Choices-Story` — 3 negatives

```text
life simulator, life choices game, life choices simulator
```

---

## Final check before you enable anything

- [ ] Match type is **Exact** everywhere except the Discovery seeds (Broad)
- [ ] **Search Match OFF** on Brand, Category, Competitor · **ON** on Discovery
- [ ] Every negative keyword is **Exact**
- [ ] Brand has **no** negative keywords
- [ ] Global negatives applied at **campaign** level on the three campaigns
- [ ] Crosslocks applied at **ad group** level, not campaign level
- [ ] Daily budgets: Brand $3 · Category $12 · Competitor $6 · Discovery $9
- [ ] Countries = **United States** only
- [ ] Placement = **Search results** only
- [ ] No audience refinements set

Then do not touch bids for 14 days (`01-SETUP.md` Part 6).
