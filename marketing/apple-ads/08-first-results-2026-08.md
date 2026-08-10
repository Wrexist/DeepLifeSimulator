# First results — 7 days, paused 2026-08-09

The first real data from the account, and what to do with it. Read this before
[`06-optimization-playbook.md`](06-optimization-playbook.md); the playbook tells
you *how* to optimise, this says *what the numbers actually said*.

---

## The raw run

| Campaign | Budget/day | Spend | Impr. | Taps | Installs | TTR | CR | CPA |
|---|---|---|---|---|---|---|---|---|
| `DLS-US-Category-Exact` | $12 | $30.58 | 186 | 35 | 14 | **18.82%** | 40% | **$2.18** |
| `DLS-US-Competitor-Exact` | $6 | $15.32 | 322 | 15 | 3 | 4.66% | 20% | $5.11 |
| `DLS-US-Discovery-Broad` | $9 | $9.87 | 762 | 22 | 5 | 2.89% | 22.73% | $1.97 |
| **Blended** | $27 | **$55.77** | **1,270** | **72** | **22** | 5.67% | 30.6% | **$2.54** |

## Read against 2026 benchmarks

Games is the **lowest-TTR category on the store at 7.72%** — it is the most
crowded shelf there is. Overall conversion benchmark is 66.2%; US Games median
CPI is $12.28.

| Signal | Us | Benchmark | Verdict |
|---|---|---|---|
| Category-Exact TTR | **18.82%** | 7.72% | **2.4× the category.** People searching the genre want this app. |
| Product page CR | 40% | 66.2% | **0.6× — the leak.** They tap and then don't install. |
| CPA | $2.18 | $12.28 median CPI | **5.6× cheaper** than the category median. |
| Competitor-Exact TTR | 4.66% | 7.72% | Below a floor that is already the lowest on the store. |

### What this means in one line

**Demand is not the problem and price is not the problem. The product page is.**
Lift CR from 40% to benchmark and CPA falls **$2.18 → $1.32** — the same $12/day
buys ~9 installs instead of ~5.5, i.e. **+65% installs at identical spend**,
before adding a dollar of budget.

---

## Statistical caveat — read before acting

At **14 / 3 / 5 installs**, the CR and CPA columns are *directional only*. A
three-install cell has error bars wide enough to swallow any conclusion, and
nobody should reallocate budget on it.

**TTR is the trustworthy number here** — 186 / 322 / 762 impressions is a real
sample, and tap-through is measured on impressions, not on the tiny install
counts. Every decision below rests on TTR or on benchmark comparison, not on a
CPA computed from three installs.

---

## Decisions

### 1. `DLS-US-Competitor-Exact` — **kill it**

4.66% TTR against a 7.72% category floor, on 322 impressions, so this is a real
signal and not noise. People searching "BitLife" want BitLife; conquest traffic
on a genre this identity-driven does not convert.

[`00-START-HERE.md`](00-START-HERE.md) already called this campaign "expensive
and converts worst — do not raise this budget until it proves itself." It did not
prove itself. Pause it and move the $6/day to Category.

*Revisit only if:* a Custom Product Page built specifically for the
"BitLife alternative" intent is live (see
[`04-custom-product-pages.md`](04-custom-product-pages.md)), and even then at
$3/day as a test, not a channel.

### 2. `DLS-US-Category-Exact` — **restart first, then raise**

The winner by a distance. Restart this one before either of the others, at the
same $12/day. Raise to $20/day only once page CR clears ~55%.

### 3. `DLS-US-Discovery-Broad` — **keep at minimum, as a report**

2.89% TTR is normal for broad match and is not a failure — this campaign's job
is to *find words*, not to buy installs. Keep it at $9/day (or drop to $6),
harvest search terms weekly, and promote winners into Category-Exact as exact
match. Do not judge it on CPA.

---

## The gate — do not unpause yet

Running more traffic into a page that converts at 0.6× benchmark is paying
$2.54 to show people a wall. **Both conditions must hold before the account
restarts:**

- [ ] **Page conversion ≥ 55%** — driven by the app preview video
      (`marketing/app-preview-video-script.md`), caption-led screenshots, the
      rewritten subtitle and keyword field, and a rating count above 1.
- [ ] **D1 retention ≥ 30%** — the v2.7.0 Story Mode release is the change that
      makes this reachable; a first session can now contain a whole life.

Version 2.7.0 addresses the second. The first is App Store Connect work and is
the highest-value hour available in this whole program.

## Scale rules once restarted

| Condition | Action |
|---|---|
| CPA < $3 **and** D7 ≥ 10% | Double budget weekly |
| CPA $3–$5 | Hold, optimise keywords |
| CPA > $5 | Halve budget, pull the worst ad group |

With a US Games median CPI of $12.28, anything under ~$4 is a strong buy — the
ceiling here is how fast the page and retention can absorb the traffic, not
what the traffic costs.
