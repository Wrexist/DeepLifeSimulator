# 00 — Start here (beginner's guide)

You have never run app ads before. This file is the whole thing, in order, in
plain language. Do the steps as written and skip nothing.

The other files in this folder are reference material — you look things up in
them. **This file is the one you follow.**

Time needed: about **4 hours of setup**, spread over a week, then **45 minutes
every Monday**.

---

## 1. What Apple Ads actually is

When someone types "life simulator" into the App Store search box, Apple shows a
short list of apps. The very first result, with a light blue background and a
small "Ad" label, is an advertisement. Somebody paid to be there.

That is what you are buying.

Four things are worth understanding before you touch anything:

1. **You pay per tap, not per install** — in Apple Ads **Advanced**, which is
   what this program uses (step 1). If 100 people tap your ad and 60 install the
   app, you paid for 100 taps and got 60 installs, so your cost per install is
   always higher than your cost per tap. (Apple Ads *Basic* is the other
   product and charges per install instead — that difference is one reason the
   two are not interchangeable.)
2. **You do not upload an ad.** Apple builds the ad automatically from your App
   Store listing — your icon, name, subtitle, and screenshots. You control the
   ad by controlling your listing (and by using Custom Product Pages, step 9).
3. **You bid on words.** You tell Apple "I will pay up to $1.10 when someone
   searches *life simulator*." Everyone else bidding on that word does the same,
   and Apple runs an auction. Bidding more does not guarantee you win — Apple
   also weighs how relevant your app is to the search.
4. **The ad only gets the tap. Your App Store page has to close the deal.**
   This is the part beginners miss. If your page does not convince people, you
   pay for every tap and get nothing. That is why step 3 exists.

---

## 2. The words you will see, in plain English

Learn these eight. Everything in every other file is built from them.

| Term | What it means | Think of it as |
|---|---|---|
| **Impression** | Your ad was shown | "Someone saw it" |
| **Tap** | Someone tapped your ad | "Someone was interested" |
| **Install** | Someone downloaded the app | "It worked" |
| **CPT** (cost per tap) | What you paid for one tap | The price of one visitor |
| **CPA** / CPI (cost per install) | What you paid for one install | The price of one player |
| **TTR** (tap-through rate) | taps ÷ impressions | "Is my ad appealing?" |
| **CR** (conversion rate) | installs ÷ taps | "Is my App Store page convincing?" |
| **LTV** (lifetime value) | Total money one player eventually makes you | What a player is worth |
| **ROAS** | revenue ÷ ad spend | "Did I make money?" |

**The one sentence that matters:** if a player is worth **$1.00** to you over
their lifetime, then paying more than **$1.00** to get that player loses money.
Everything else is detail.

**Low TTR vs low CR — the most useful distinction in this whole folder:**

- Bad **TTR** = few people tap. Your ad is showing for the wrong searches.
  → Fix with *negative keywords* (step 8).
- Bad **CR** = people tap but do not install. Your App Store page let them down.
  → Fix with *screenshots, ratings, or Custom Product Pages* (step 9).

Beginners lower their bids when they see a bad number. Usually the bid was not
the problem.

---

## 3. ⚠️ Before you spend anything — the four gates

Do not skip this section. Spending money before these are true is the single
most expensive mistake available to you.

### Gate 1 — Your star rating

**Check now:** App Store Connect → your app → Ratings & Reviews.

The last number recorded in this repo is **2.3 stars from 8 reviews**
(`Deep_Life_Simulator_Marketing_Plan.md`, March 2026) — months old, so do not
trust it. Look up today's number and write it down:

> Live rating: `______` from `______` reviews · checked on `__________`

**If it is under 4.0 stars, or there are fewer than 30 reviews:**

> **Run the Brand campaign only** (step 7, $3/day) and stop there. Fix ratings
> first.

(Why 30 reviews as well as 4.0: a 5.0 from three people moves nobody, and one
bad review can swing it back. The threshold is the same one in
[`README.md`](README.md) — if the two ever disagree, they are both wrong.)

Why this is so strict: your ad sends people to your App Store page, and the star
rating sits right at the top of it. At 2.3 stars, most people who tap will read
the rating and leave. You still pay for every one of those taps. Advertising a
2.3-star app is paying full price for a third of the results.

Getting to 4.0+ is worth more than every optimization in this folder combined.
Phase 1 of `Deep_Life_Simulator_Marketing_Plan.md` covers how.

### Gate 2 — Which name is actually live?

`app.config.js` says **DeepLife Simulator** (one word). The marketing docs say
**Deep Life Simulator** (two words). Open your App Store page and see which one
is really there, then write it here:

> Live App Store name: `________________________`

Both spellings are already in the brand keyword list, so nothing breaks either
way — but you should know which one is real.

### Gate 3 — Attribution ✅ done

This is the plumbing that tells you which keyword produced which paying player.

- ✅ Code shipped — `services/RevenueCatService.ts` now collects Apple's
  attribution token.
- ✅ RevenueCat → Apple Search Ads integration enabled (you did this).
- ⬜ **Still needed:** the code has to reach real users in a **released App
  Store build**. It returns nothing at all in the simulator or a dev build, and
  TestFlight/sandbox can return placeholder or empty attribution — so a clean
  TestFlight result does not prove production attribution works. The version
  carrying this change must actually ship before the revenue numbers appear.

Verify it after your first release build, in step 11.

### Gate 4 — Your screenshots

Open your App Store page on a phone. Look only at the first three screenshots,
because that is all most people see.

Do they each have a short, bold sentence across the top saying what you *get*?
Or are they raw gameplay screenshots with no text? If it is the second, fix that
before advertising. `SCREENSHOT_GUIDE.md` and step 9 cover it.

---

## 4. The 12 steps, start to finish

| Step | What | When | Time |
|---|---|---|---|
| 1 | Create the Apple Ads account | Day 1 | 20 min |
| 2 | Set your budget cap safety net | Day 1 | 5 min |
| 3 | Build the Brand campaign | Day 1 | 30 min |
| 4 | Build the Category campaign | Day 2 | 60 min |
| 5 | Build the Competitor campaign | Day 2 | 20 min |
| 6 | Build the Discovery campaign | Day 2 | 20 min |
| 7 | Add the negative keyword lists | Day 2 | 30 min |
| 8 | Turn everything on | Day 2 | 2 min |
| 9 | Build Custom Product Pages | Week 2 | 3 h |
| 10 | **Do nothing for 14 days** | Days 3–16 | 0 min |
| 11 | Check attribution is working | Day 17 | 15 min |
| 12 | Start the Monday routine | Every Monday | 45 min |

---

## 5. Step 1 — Create the account

1. Go to **[ads.apple.com](https://ads.apple.com)**.
2. Sign in with the **same Apple ID** that owns the app in App Store Connect.
3. You will be offered **Basic** or **Advanced**.

> ### Choose **Advanced**.
>
> Basic is the simple version: you set a monthly budget and Apple decides
> everything else. It is genuinely easier — but it has no keywords, no negative
> keywords, and no search-term report. Every technique in this folder needs
> those. Basic also caps you at $10,000/month; Advanced has no cap.
>
> Advanced sounds intimidating and is not. It is a list of words and a price
> next to each one.

4. Add a payment card.
5. **Look for a starter credit.** New Apple Ads accounts are often offered around
   **$100 in free credit**. If you see the offer, take it — that is three free
   days of the plan below. If you do not see it, do not chase it.
6. Set your **time zone** and **currency**.

> 🚨 **These two can never be changed.** Not by support, not ever — you would
> have to make a whole new account and lose all your history. Set them to where
> you actually live and the currency you actually think in. Take the extra ten
> seconds.

---

## 6. Step 2 — The safety net

Before creating a single campaign, in **Account Settings**, set an **account-level
budget cap** if your account offers one.

Set it to a number that would annoy you but not hurt you. If the plan is $30/day
(≈$900/month), set the cap around **$1,000/month**.

You are not expecting to need it. It is there because a mistyped bid — $50.00
instead of $0.50 — is a thing that happens to everyone once, and this is the
difference between noticing it on Monday and noticing it on your statement.

Two things to know about how Apple budgets actually behave:

- **Lifetime and campaign-total budgets were retired**, so there is no "spend
  $500 and stop" option per campaign. Larger invoiced Advanced accounts can use
  *budget orders* to cap total spend across campaigns, but that is not available
  at this scale — so at the campaign level, the daily budget is your lever.
- **The daily budget is an average, not a hard daily cap.** Apple can spend more
  than it on a high-opportunity day and less on a quiet one. What *is* bounded is
  the month: **daily budget × 30.4**. So $30/day is capped at about **$912/month**
  — which is why the $1,000 account cap above is the right size.

---

## 7. Step 3 — Your first campaign (Brand)

We start here because it is small, cheap, almost impossible to get wrong, and it
teaches you the interface with $3 at risk.

**What it does:** shows your ad to people who search for *your app by name*.
These people already want you. It is the cheapest thing you will ever buy.

> **"Why pay for people who already searched for me?"** Fair question, and it is
> the most common beginner objection. Two answers: your competitors can bid on
> your name and take those people, and at $3/day the debate costs less than a
> coffee to settle. Run it.

### Click by click

**Campaigns → Create Campaign**

| Field | What to enter |
|---|---|
| App | DeepLife Simulator |
| Countries/regions | **United States** only |
| Campaign name | `DLS-US-Brand-Exact` |
| Placement | **Search results** only — untick everything else |
| Daily budget | `$3` |
| Ad group name | `Brand` |
| Default max CPT bid | `$0.80` |
| **Search Match** | **OFF** ← important, see below |
| Audience refinements | Leave completely empty |

**Search Match** is a toggle that lets Apple pick searches for you
automatically. It defaults to ON. Turn it OFF here. In this campaign you want
*only* your brand words and nothing else — Search Match would quietly add
searches you never chose. It has one proper home, in step 6.

**Audience refinements** (age, gender, new vs returning users) filter who sees
your ad. Leave them empty. Every filter shrinks your data, and you have no data
yet to justify a filter.

### Add the keywords

Open **[`keywords/brand-exact.csv`](keywords/brand-exact.csv)**. Copy the
**third column** (`keyword`) — 15 words including deliberate misspellings like
`deaplife`, because people typo your name and those taps are cheap.

Paste them into the ad group's keyword box. Set **match type = Exact** for all of
them.

> **Exact vs Broad, once:**
> **Exact** = show my ad only for this specific phrase. Predictable. Use it
> almost everywhere.
> **Broad** = show my ad for anything Apple thinks is related. Unpredictable.
> Use it only in Discovery (step 6), where unpredictable is the point.

Save. That is a working campaign. The rest are the same shape.

---

## 8. Steps 4–7 — The other three campaigns

Same process. The full settings for each are in
**[`01-SETUP.md`](01-SETUP.md)** — this is the summary so you know what you are
building and why.

| Campaign | Budget | Buys | Beginner note |
|---|---|---|---|
| **Category** `DLS-US-Category-Exact` | $12/day | People searching the genre: "life simulator", "get rich game", "tycoon" | **Your main campaign.** 8 ad groups, one per theme — keywords in [`keywords/category-exact.csv`](keywords/category-exact.csv), split by the `ad_group` column |
| **Competitor** `DLS-US-Competitor-Exact` | $6/day | People searching for BitLife and similar | Expensive and converts worst. **Do not raise this budget** until it proves itself |
| **Discovery** `DLS-US-Discovery-Broad` | $9/day | Everything else — this one *finds* words for you | Search Match **ON** here (the one place). Its job is a report, not installs |

**Why 8 separate ad groups in Category instead of one big list?** Because an ad
group holds one bid and one set of screenshots. Someone searching "crime
simulator" and someone searching "stock market game" want different things and
are worth different amounts. Separate groups let you pay each one what it is
worth and show each one the right screenshots.

**How Discovery works** — this is the clever part of the whole system:

```text
Discovery shows your ad for search words you never picked.
        ↓
Every Monday you read the report of what people actually searched.
        ↓
A word made installs cheaply?  → move it into Category as an Exact keyword
        ↓
Then block that word in Discovery, so the two don't bid against each other
        ↓
Discovery goes back to hunting new words. Forever.
```

That last "block it" step is easy to forget, so it is automated. After moving a
keyword, run:

```bash
node marketing/apple-ads/build-negatives.js
```

Then paste the regenerated list into Discovery's negative keywords.

### Step 7 — The negative keyword lists

**Negative keywords are words that stop your ad from showing.** They are the
highest-value 30 minutes in this entire setup, and beginners always skip them.

Here is why they matter so much for *this* app specifically. Your three main
words are all traps:

| Your word | What else it means | Who you would be paying for |
|---|---|---|
| **life** | life insurance, Life360, half-life, wildlife, life coach | People shopping for insurance |
| **simulator** | truck / bus / flight / farming / goat / dog simulator | People who want to drive a truck |
| **money, stocks, career** | Cash App, Robinhood, Zillow, Indeed, Tinder | People who want a real banking app |

Without negatives you pay full price for every one of those taps and get nothing.

**What to do:** open
[`negatives/global-negatives.csv`](negatives/global-negatives.csv), copy the
first column (169 words), and paste it into the **campaign-level negative
keywords** box of Category, Competitor, and Discovery.

**Not Brand.** Brand gets no negatives — every search reaching it is someone
typing your app's name, so there is nothing to filter out.

Set them all to **Exact** match. A broad negative blocks far more than you
intend: one broad `money` negative would silently switch off your entire
Money-Wealth ad group, and the symptom (traffic just stops) looks nothing like
the cause.

### Step 8 — Turn it on

Check the four daily budgets read **$3 / $12 / $6 / $9 = $30/day**, then enable
the campaigns.

---

## 9. Step 9 — Custom Product Pages (week 2)

A **Custom Product Page** is an alternative version of your App Store page with
different screenshots. You can then say "people who searched *crime simulator*
land on the crime version of my page."

It works: pages matched to the search convert far better, and ads built on them
average **+27% more taps** in search results — that figure is MobileAction's
industry measurement, not an Apple guarantee.

You can make 70 of them. You need **6**. Every screenshot and headline is
written for you in **[`04-custom-product-pages.md`](04-custom-product-pages.md)**
— build them in App Store Connect → your app → Custom Product Pages, then attach
each one to its ad group in Apple Ads under **Ad variations**.

Do this in week 2. Getting campaigns running matters more than getting them
perfect.

---

## 10. Step 10 — Do nothing for 14 days

This is a real step. It is harder than it sounds and it is where most beginner
accounts are ruined.

You will look at the numbers on day 3 and they will look bad. **They are
supposed to look bad on day 3.** Apple's auction needs roughly two weeks of data
before it shows your ad sensibly, and at $30/day you are getting about 20–40 taps
a day — far too few for a Tuesday number to mean anything.

If you change bids on day 3, you restart the learning and never find out whether
your setup worked.

**Allowed during the freeze — only these two:**

1. If one keyword has spent **more than 3× your target cost per install with
   zero installs**, pause that keyword.
2. If you see an obviously irrelevant search in the Discovery report ("truck
   simulator", "life insurance"), add it as a negative keyword.

**Not allowed:** changing bids, changing budgets, adding keywords, pausing ad
groups, or restructuring anything.

Put a calendar reminder 14 days out. Then close the tab.

---

## 11. Step 11 — Check the money plumbing (day 17)

Attribution is what connects "this keyword" to "this player spent $4.99". Now
that RevenueCat is linked, verify it end to end:

1. Confirm a build containing the attribution change is live on the **App
   Store**. It returns nothing in the simulator or a dev build, and
   TestFlight/sandbox can return placeholder data — so TestFlight passing is not
   proof.
2. Open RevenueCat → **Customers**, pick a recent iOS customer **who came from
   an ad**, look at the **Attribution** section.
3. You are looking for **Apple Search Ads** fields with a campaign name filled
   in. Apple resolves within about 24 hours, but RevenueCat says to allow **up
   to 7 days** for full coverage.

**If nothing shows after 7 days,** check in this order:

- Is it a real released App Store build? (most common cause — a simulator, dev
  or TestFlight build will not give you trustworthy attribution)
- Is the RevenueCat Apple Search Ads integration switched on?
- Is RevenueCat actually enabled in that build? It is gated behind
  `EXPO_PUBLIC_USE_REVENUECAT` and is switched off automatically in development
  builds by `BORING_BUILD_MODE`.

A customer marked **organic / no attribution** tells you the token collection
works — but it does *not* confirm the ad path. Only an ad-attributed customer
with populated campaign fields proves the whole pipe end to end.

---

## 12. Step 12 — Your Monday routine (45 minutes)

Same four things, every week, in this order. The order matters: step A changes
*what you are buying*, which is always worth more than changing *what you pay*.

### A. Clean up — 15 min

Apple Ads → `DLS-US-Discovery-Broad` → **Search Terms** → last 7 days → sort by
spend, highest first.

For each expensive term with **zero installs**:
- Obviously wrong (truck simulator, life insurance, minecraft, mod apk)?
  → add as a negative keyword, and add the line to `global-negatives.csv`
- Relevant but just not working yet? → leave it one more week

For each term **with** installs at a good price:
- → add it to the right Category ad group as an Exact keyword
- → then run `node marketing/apple-ads/build-negatives.js` and paste the result
  into Discovery's negatives

### B. Bids — 15 min

Look at each keyword's cost per install versus your target. One rule fires per
keyword, and never more than one change per keyword per week:

| What you see | What you do |
|---|---|
| Much cheaper than target (≤70%) | Raise bid **+20%** — you are under-buying a winner |
| About right (70–110%) | **Nothing** |
| A bit expensive (110–150%) | Lower bid **−15%** |
| Very expensive (>150%) | Lower bid **−30%**. Second week in a row → pause it |
| Spent 3× target, zero installs | **Pause** |
| Barely spent anything | **Nothing** — not enough data yet |
| Zero impressions for 2 weeks | Raise bid **+30%** once; still nothing → delete it |

Never change a bid by more than 30% at once. Never lower the Brand bid.

### C. Budgets — 10 min

Only raise a budget when the campaign is **both** hitting its daily limit most
days **and** producing installs at or below target. Then **+25% maximum per
week**.

If a campaign is spending well under its budget with good results, the problem is
your *bids* being too low to win auctions, not your budget.

### D. Write it down — 5 min

One line: date, what you changed, from → to, and why. Without this you will not
know in six weeks whether the improvement came from the negatives, the bids, or
the new screenshots.

---

## 13. The ten mistakes beginners make

1. **Advertising a low-rated app.** Gate 1. The most expensive mistake here.
2. **Skipping negative keywords.** You will pay for "truck simulator" for months.
3. **Changing things daily.** You are reading noise and destroying your data.
4. **Leaving Search Match on everywhere.** It belongs in Discovery only.
5. **Starting in five countries at once.** $6/day per country teaches you nothing
   in any of them. One country until it works.
6. **Judging on cost per install alone.** Cheap installs from the wrong keyword
   are worse than expensive installs from the right one. Revenue decides.
7. **Raising budgets before the numbers are good.** Scaling a losing campaign
   just loses faster.
8. **Bidding heavily on competitor names.** It feels aggressive and productive.
   It is the most expensive, worst-converting inventory you can buy — that is
   why it is capped at $6/day.
9. **Lowering bids when conversion rate is bad.** Bad CR is an App Store page
   problem. Lowering the bid just buys less of the same problem.
10. **Never reading the search-term report.** It is the only place the account
    tells you something you did not already know.

---

## 14. What "good" looks like

Rough industry medians to sanity-check against — not targets, just orientation:

| Number | Typical | What yours means |
|---|---|---|
| Cost per tap | ~$0.92 | Brand should be far cheaper. Competitor will be worse. |
| Conversion (tap→install) | ~64% | Well below? Your App Store page or rating is the issue |
| Tap-through rate, games | ~7.7% | Games are the lowest of any category. Low is normal here. |

**The number that actually decides everything** is in
[`05-measurement-and-roi.md`](05-measurement-and-roi.md): what one player is
worth to you. The worked example there lands at **$0.46**, which would mean you
cannot pay more than about **$0.28 per tap** — below the typical $0.92.

If that is your real number, it is not a reason to stop. It is the reason this
plan spends most of its money on brand and cheap long-tail words instead of
fighting for "life simulator". And it tells you the highest-value work is not in
this folder at all — it is making players worth more, through ratings,
retention, and monetization.

---

## 15. Where to look things up

| I want to… | Go to |
|---|---|
| See every campaign setting in detail | [`01-SETUP.md`](01-SETUP.md) |
| Understand the keyword choices | [`02-keywords.md`](02-keywords.md) |
| Understand negative keywords properly | [`03-negative-keywords.md`](03-negative-keywords.md) |
| Build the screenshot pages | [`04-custom-product-pages.md`](04-custom-product-pages.md) |
| Work out what a player is worth | [`05-measurement-and-roi.md`](05-measurement-and-roi.md) |
| Get the exact weekly rules | [`06-optimization-playbook.md`](06-optimization-playbook.md) |
| Add more countries later | [`07-geo-and-budget-plan.md`](07-geo-and-budget-plan.md) |

---

## Sources

- [Apple Ads — Compare Basic and Advanced](https://ads.apple.com/app-store/help/apple-ads-basic/0001-compare-apple-ads-solutions)
- [Apple Ads — Manage budgets](https://ads.apple.com/app-store/help/bids-and-budget/0016-manage-budgets)
- [Apple Ads — Campaign structure best practices](https://ads.apple.com/app-store/best-practices/campaign-structure)
- [Apple Ads — Use negative keywords](https://ads.apple.com/app-store/help/keywords/0060-use-negative-keywords)
- [Adapty — Apple Search Ads beginner's guide](https://adapty.io/blog/apple-search-ads/)
- [AppTweak — Apple Ads benchmarks 2026](https://www.apptweak.com/en/aso-blog/apple-ads-benchmarks)
- [MobileAction — Ad variations with custom product pages](https://www.mobileaction.co/blog/ad-variations-with-custom-product-pages/)
- [RevenueCat — Apple Search Ads attribution](https://www.revenuecat.com/docs/integrations/attribution/apple-search-ads)
