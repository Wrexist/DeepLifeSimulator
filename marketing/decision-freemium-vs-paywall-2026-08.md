# Decision: keep the free tier. Do not put DeepLife behind a paywall.

**Question raised:** a widely-shared founder post argues *"remove your free plan,
add a CC-required trial instead — there is no such thing as freemium anymore,
especially if you're bootstrapped."* Should DeepLife do this?

**Answer: no, and the reasoning is not "freemium is nicer." It is that the advice
is written for a business model DeepLife does not have, and every number that
matters points the other way for games specifically.**

---

## 1. The category error

The post is B2B SaaS advice. In SaaS:

- You own the checkout, so "collect the card" is a thing you can do.
- **A free user costs you money** — seats, storage, support, compute.
- Revenue comes from one place: the subscription.

DeepLife is a consumer mobile game. All three invert:

- **You cannot collect a card.** Apple owns the payment relationship. There is
  no "CC-required trial" on iOS — only paid-upfront, or a StoreKit subscription
  with an introductory offer. The mechanic the post describes does not exist
  here.
- **A free player costs ~nothing and earns money.** Rewarded video runs at a
  **$15–25 eCPM**. A non-paying player who watches rewarded ads is revenue, not
  cost. In SaaS the free tier is a liability; in a mobile game it is inventory.
- **Revenue is at least three streams** — IAP, subscription, and advertising.
  A paywall deletes the third one entirely for everyone it filters out.

That last point is not theoretical. **BitLife takes 62% of its revenue from
advertising.** A paywall on the front door removes the majority revenue line of
the category leader.

---

## 2. The numbers, for games specifically

The strongest argument *for* the post is RevenueCat's 2026 data: hard-paywall
apps hit **10.7% Day-35 conversion vs 2.1% freemium**, and **$3.09 revenue per
install at Day 60 vs $0.38** — roughly 5× and 8×. Taken at face value that looks
decisive.

It is not, because those are blended figures across **subscription apps**, a set
dominated by Health & Fitness, Productivity and Business. Split by category, the
picture reverses:

| Metric | Gaming | Best category | Source |
|---|---|---|---|
| Trial → paid conversion | **4.4%** (near the bottom) | Business 9.1% | RevenueCat 2026 |
| Download → trial | **25.0%** (second lowest) | Travel 43.5% | RevenueCat 2026 |
| Revenue per install | **$0.08** | Health & Fitness $0.48 | RevenueCat 2026 |

**Gaming has the lowest revenue per install of any category — $0.08.** Applying
a paywall strategy to a game is applying it where it fits worst.

And the market shape says the same thing:

- **Free apps generate ~98% of all global app revenue.**
- Paid apps are **5.2% of the App Store and falling**.
- In Games: 192,837 free vs 14,476 paid — **paid is under 10%**, in the highest
  revenue category on the store.
- **~77% of mobile game revenue is IAP** — i.e. from players who installed free.

---

## 3. What a paywall would specifically cost DeepLife

Three things this product depends on die on contact with a front-door paywall:

1. **Organic growth.** BitLife reached 42M downloads with **~70% organic**. A
   paid app is not in the free charts, is not in "Top Free", and does not get
   the word-of-mouth install where someone taps a link mid-conversation.
   Organic CPI is effectively **$0** against **$1–5+** paid; it is also the
   channel that compounds.
2. **The share loop we just shipped.** v2.7.0 put the App Store link into the
   obituary share precisely so a friend can install on impulse. Behind a
   paywall, that link becomes a price tag and the loop's conversion collapses.
3. **The measured funnel.** Category-Exact runs **18.82% tap-through — 2.4× the
   Games benchmark — at $2.18 CPA.** That is a free-install funnel. Gaming's RPI
   is $0.08; you cannot pay $2.18 for an install that a paywall has to earn back
   at a category-worst conversion rate.

---

## 4. What the post gets right, and what to actually do

Two things in it are correct and worth taking:

**a. Paywall timing is a real lever.** ~50% of all paid conversions happen on
**Day 0**. If DeepLife+ is buried behind six taps, that window is being wasted.
This is the genuine, evidence-backed improvement available.

**b. Filtering has value — but placement, not exclusion, is how a game does it.**
The "combo of hard paywall plus a short trial" that performs well elsewhere maps,
in a game, to a *well-placed, high-quality offer at the first moment the player
has felt the product*, not to a locked door.

### And here is the leverage that is new

Freemium works when *users need time to experience value* — which is exactly a
life sim, and was exactly DeepLife's problem: a full life used to take **3,224
taps**, so the value proposition arrived hours in, long after any Day-0 window
had closed.

**Story Mode changed that.** A player can now live a complete life — career,
market crash, property, death, heir — in a first session. Time-to-value went
from hours to minutes.

That does not argue for removing the free tier. It argues that the free tier has
*only just started working*, and that the Day-0 offer is now viable for the first
time because there is finally something to have experienced by Day 0.

### Recommended instead

1. **Keep the game free.** Non-negotiable given the ad line, the charts and the
   share loop.
2. **Put a real offer at the first genuine peak** — end of the first Story Mode
   year, or the first Year in Review showing a big net-worth jump. That is a
   Day-0 moment that did not exist before v2.7.0.
3. **Ship rewarded-only, opt-in ads properly.** Keeps "no forced ads" literally
   true, captures the 62%-of-revenue line the category leader runs on, and
   benchmarks say rewarded users are **4× more likely to purchase** — it lifts
   IAP rather than cannibalising it. ARPDAU rises **30–66%** after rewarded
   video lands.
4. **Measure before touching pricing.** DeepLife's payer rate, ARPDAU and D1
   are currently unmeasured. Restructuring monetisation before instrumenting it
   is guessing with extra steps.

---

## 5. If you ever revisit this

A paid model is viable in exactly one shape: a **premium, ad-free, IAP-free
edition** as a *second* SKU — the Monument Valley / Slay the Spire pattern —
sold to players who already know the game and want it clean. That is an
additional revenue line on top of a free funnel, not a replacement for it. It
only makes sense once the free game has an audience to sell it to.

What is not viable is converting the existing free game to paid. That trades a
compounding channel for a one-time payment, at the category with the lowest
revenue per install on the store.

---

## Sources

- [RevenueCat — State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps) · [Gaming edition](https://www.revenuecat.com/state-of-subscription-apps-2026-gaming)
- [Hard paywall vs free trial — RevenueCat 2026 data](https://www.buildmvpfast.com/blog/hard-paywall-vs-free-trial-revenuecat-indie-app-2026)
- [Revenue per install by category — Gaming $0.08](https://tasu.ai/library/app-category-revenue-per-install-benchmark)
- [Trial-to-paid conversion by category](https://tasu.ai/library/trial-to-paid-conversion-rate-benchmark)
- [App Store revenue statistics 2026 — free vs paid share](https://electroiq.com/stats/app-store-revenue-statistics/)
- [Mobile game monetization 2026 — premium vs F2P](https://hubapps.team/blog/mobile-game-monetization)
- [Organic vs paid installs — retention and LTV](https://www.branch.io/resources/blog/mobile-marketing-how-paid-app-installs-impact-organic-downloads/)
- [Stillfront/Candywriter — BitLife organic share and scale](https://medium.com/@SEgames/stillfront-group-acquires-bitlife-developer-candywriter-92eb08532a5d)
