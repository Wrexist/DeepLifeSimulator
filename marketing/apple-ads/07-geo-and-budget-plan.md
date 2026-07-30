# 07 — Geo strategy & 90-day budget plan

Apple Ads runs per storefront. Each country is a separate auction with its own
CPT, its own LTV, and its own language — which means a country is only worth
opening when you have a localized listing to send it to. You already do:
**39 locales** are written and validated in
`marketing/app-store-localizations/`, each with a market-researched `keywords`
field. That file is the keyword seed list for its country — do not translate the
English list in `02`.

---

## Why you start with the US and only the US

Splitting $30/day across five countries gives each one ~6 taps a day, which
produces no learnable signal in any of them and a search-term report too thin to
mine. One country at $30/day reaches statistical usefulness in about two weeks;
five countries at $6/day reach it in never.

The US is first because it has the deepest search volume, the highest LTV, and —
critically — because your listing, screenshots, and all six CPPs are authored in
English first. Every other market's performance is partly a translation-quality
question, and you want that variable held still while you learn the keyword and
bid structure.

---

## Country tiers

| Tier | Countries | Character | Open when |
|---|---|---|---|
| **1 — Anchor** | 🇺🇸 US | Highest volume + highest LTV, highest CPT | Day 1 |
| **2 — English spillover** | 🇬🇧 GB · 🇨🇦 CA · 🇦🇺 AU | Same creative, no translation risk, 30–50% cheaper CPT than US | US CPA ≤ target for 3 consecutive weeks |
| **3 — Western Europe** | 🇩🇪 DE · 🇫🇷 FR · 🇳🇱 NL · 🇸🇪 SE · 🇳🇴 NO · 🇩🇰 DK | Strong LTV, moderate CPT, low competition on life-sim terms | Tier 2 profitable + localized CPPs live |
| **4 — Volume markets** | 🇧🇷 BR · 🇲🇽 MX · 🇹🇷 TR · 🇮🇩 ID · 🇹🇭 TH · 🇻🇳 VN · 🇵🇭 PH | Very low CPT, low IAP LTV — **ad-monetization plays** | Only if AdMob eCPM data shows ad revenue carries the CPA |
| **5 — High-effort** | 🇯🇵 JP · 🇰🇷 KR · 🇹🇼 TW | High LTV, culturally specific expectations, needs native creative | Not before month 6; requires localized screenshots, not just text |

**Tier 4 is a genuine trap and worth being explicit about.** A $0.15 CPT looks
irresistible next to the US, but if IAP LTV in that market is $0.05 you are
buying installs that can only ever be paid back by ad impressions. That works —
this app runs AdMob interstitials and rewarded ads — but only if you have
measured eCPM and ads-per-DAU *for that country* first. Open Tier 4 with the
per-country ad revenue number in hand, or not at all.

**Nordics note:** SE/NO/DK are small but unusually well-matched here — high
purchasing power, high English proficiency, low competition on life-sim terms,
and Swedish copy already exists (`sv.md`, plus the SV block in
`docs/STORE_LISTING.md`). Good early Tier 3 candidates despite the volume.

---

## Expansion mechanics

When a country opens, **clone the whole US structure** — do not add countries to
the existing campaigns. Per-country campaigns mean per-country budgets, bids, and
negatives, all of which differ. One campaign spanning five countries silently
spends its budget wherever the auction is cheapest, which is never where your LTV
is highest.

```
DLS-GB-Brand-Exact       ← same keywords, GB bids
DLS-GB-Category-Exact    ← keywords from app-store-localizations/en-GB.md
DLS-GB-Competitor-Exact
DLS-GB-Discovery-Broad
```

Per-country adjustments:

1. **Keywords** from that locale's `keywords` field, not translated from English.
2. **Bids** start at **60% of the US bid** for Tier 2/3 and **25%** for Tier 4,
   then reconcile against Apple's suggested range as in `02`.
3. **Negatives** — `negatives/global-negatives.csv` mostly does not transfer:
   the traps are language-specific ("Lebensversicherung" is the German life
   insurance trap, not "life insurance"). Build each country's list from its own
   search-term report over the first two weeks, and keep the platform/piracy rows
   (`apk`, `mod apk`, `roblox`, `minecraft`) which *do* transfer verbatim.
4. **CPPs** — CPPs support localizations, and a localized CPP still counts as
   **one** page against the 70-page limit. Localize the six existing pages rather
   than creating new ones per market.

---

## 90-day budget plan

| Phase | Days | Daily | Monthly | Markets | Goal |
|---|---|---|---|---|---|
| **0 — Prep** | −14→0 | $0 | $0 | — | Attribution live, CPPs published, rating gate cleared |
| **1 — Learn** | 1–14 | $30 | ~$450 | US | Two-week freeze. Collect the first search-term report. |
| **2 — Prune** | 15–30 | $30 | ~$450 | US | First bid/negative pass. Kill losers, find the long tail. |
| **3 — Concentrate** | 31–60 | $40–60 | ~$1,500 | US | Push budget into proven ad groups only |
| **4 — Extend** | 61–90 | $70–100 | ~$2,500 | US + Tier 2 | Clone to GB/CA/AU at 60% bids |

Phase 1 split ($30/day): **Brand $3 · Category $12 · Competitor $6 ·
Discovery $9.** Note Discovery gets more than Competitor — the search-term
report is worth more in month one than any competitor install.

By Phase 3 the split should have drifted toward whatever is working, typically
**Brand $4 · Category $30 · Competitor $6 (still capped) · Discovery $10.**
Competitor stays capped until it has cleared target CPA over $150+ of spend.

**Total 90-day commitment: roughly $4,900.** Treat it as tuition. The deliverable
of the first 90 days is a proven keyword list and a measured LTV, not profit.

---

## Scale triggers — the only reasons to spend more

Raise budget only when **all three** hold:

1. Blended account CPA ≤ target CPA for **3 consecutive weeks**, and
2. D30 ROAS ≥ 35% on the cohort acquired 30+ days ago, and
3. The campaign is genuinely budget-capped (hitting its cap 5 of 7 days).

Then +25% per week, maximum. Any single week that breaks trigger 1 → hold, do not
cut. Two consecutive weeks → cut budget 50% and go back to `06` Step 1.

**Kill triggers:** a country whose CPA is >150% of target for a full month after
its own two-week learning period gets paused entirely, not tuned. A country is a
much bigger unit than a keyword and there is no obligation to make every market
work.

---

## What to do with a bigger budget than this

If the budget available is materially larger than $30/day, the correct move is
**not** to start at $100/day across four countries. It is to run Phase 1–2 at
$30/day exactly as written and spend the difference on the LTV side of the model
in `05` — ratings recovery, retention, the monetization funnel. At a $0.46 LTV,
more spend buys more losses faster; at a $1.39 LTV, the same account scales.
The ceiling on this program is set by the product, not by the bid.

---

## Sources

- [Apple Ads — Campaign Structure best practices](https://ads.apple.com/app-store/best-practices/campaign-structure)
- [AppTweak — Apple Ads benchmarks 2026 (CPT/CPI by country)](https://www.apptweak.com/en/aso-blog/apple-ads-benchmarks)
- [MobileAction — 2026 Apple Ads benchmark report](https://www.mobileaction.co/report/apple-ads-2026-benchmark-report/)
- [RespectASO — Custom product pages in 2026 (localization counts as one page)](https://respectaso.com/blog/custom-product-pages-app-store-guide-2026/)
