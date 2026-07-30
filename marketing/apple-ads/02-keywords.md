# 02 — Keywords

**126 exact-match keywords** across three campaigns, plus 12 broad-match Discovery
seeds. Machine-readable lists live in [`keywords/`](keywords/):

| File | Rows | Campaign |
|---|---|---|
| [`keywords/brand-exact.csv`](keywords/brand-exact.csv) | 15 | `DLS-US-Brand-Exact` |
| [`keywords/category-exact.csv`](keywords/category-exact.csv) | 87 | `DLS-US-Category-Exact` (8 ad groups) |
| [`keywords/competitor-exact.csv`](keywords/competitor-exact.csv) | 24 | `DLS-US-Competitor-Exact` (3 ad groups) |
| [`keywords/discovery-broad.csv`](keywords/discovery-broad.csv) | 13 | `DLS-US-Discovery-Broad` — 12 broad seeds + 1 keyword-less Search Match ad group |

Columns: `campaign, ad_group, keyword, match_type, max_cpt_usd, rationale`. These
CSVs are the **source of truth and the reference**; via the Campaign Management
API they map directly.

> 📋 **To actually paste into Apple Ads, use
> [`PASTE-BLOCKS.md`](PASTE-BLOCKS.md)** — the same lists rendered as
> comma-separated blocks, one per ad group, each labelled with its destination
> and bid. It is generated from these CSVs, so the two cannot drift.

---

## The two rules that produce the structure

**1. One keyword theme per ad group.** The ad group is the unit that carries both
a bid and a creative (the CPP). Two themes in one ad group means one bid and one
creative serving two different intents, and you can never tell which one the
performance came from. That is why "life simulator" and "stock market game" are
in different ad groups even though the same app satisfies both.

**2. Exact match everywhere except Discovery, Search Match off.** Exact is the
only match type where the search term equals the keyword, so the bid you set is
the bid that ran. Broad match and Search Match belong in Discovery, whose entire
purpose is to find terms you did not think of — and whose results then graduate
into an exact ad group. Leaving Search Match on inside an exact campaign
reintroduces undefined traffic into the one place you wanted certainty.

---

## Where these keywords come from

Every keyword maps to something the game actually ships. That matters twice
over: it is what makes Apple's relevance scoring cheap for you, and it is what
stops a paid install from bouncing on day one.

| Ad group | Backed by |
|---|---|
| `LifeSim-Core` | The whole premise — start at 18, `lib/scenarios`, the week loop |
| `Money-Wealth` | `lib/economy`, `lib/banking`, loans/interest/bankruptcy |
| `Career-Job` | `lib/careers` (20+ paths), `lib/education`, `lib/skillTrees` |
| `Investing-Stocks` | `lib/stocks`, `lib/crypto` — a live market that reacts |
| `Business-Tycoon` | `lib/business`, company actions, `lib/rd` |
| `RealEstate` | `lib/realEstate` — purchase, tenancy, market model |
| `Crime-Underground` | `lib/darkweb` — jobs, laundering, wanted level |
| `Choices-Story` | Event chains, `lib/lifeMoments`, `lib/karma` |

If a keyword theme is not backed by a real system, it does not belong in the
account no matter how much volume it has. Traffic you cannot satisfy is traffic
that returns as a one-star review, and at 2.3★ that costs you more than the
install was worth.

**Deliberately excluded:** `lib/dating`, `lib/parenting`, `lib/pets`,
`lib/politics`, `lib/travel`, `lib/luxury`. All are real systems, but their head
terms ("dating simulator", "pet game", "travel game") sit in genres with their
own giants and pull searchers whose primary want this app does not lead with.
They are the first candidates for expansion once Category is profitable —
promote them from Discovery data, not from this list.

---

## Bid strategy at launch

The `max_cpt_usd` column is a **starting** bid, not a final one. At add time
Apple shows a suggested bid range per keyword. Reconcile like this:

| Apple's suggested range vs. the CSV bid | Do this |
|---|---|
| CSV bid falls inside the range | Use the CSV bid |
| Range's low end is above the CSV bid | Use the range's low end |
| Entire range is above $2.00 | Do not add it to the exact campaign — leave it to Discovery to prove |

Then leave bids alone for 14 days (`01-SETUP.md` Part 6) and tune with the rules
in `06-optimization-playbook.md`.

**Bid tiers and why:**

- **Brand $0.30–0.80.** These auctions are nearly uncontested. You bid enough to
  hold position 1, no more.
- **Head category terms $0.90–1.30.** "life simulator" is the single most
  valuable non-brand term in the account — it is also the app's primary ASO
  keyword, so a paid tap here reinforces a term you already rank on.
- **Long-tail category $0.55–0.85.** Lower volume, materially higher conversion.
  This is where a small budget wins: "rags to riches game" describes this game
  more precisely than "life simulator" does, and almost nobody bids on it.
- **Competitor $0.70–1.60.** The most expensive inventory in the account.
  Alternative-intent phrasings ("games like bitlife", "bitlife alternative") get
  the *highest* bids in the whole account despite being competitor terms, because
  the searcher is explicitly asking for what you are — that is the one competitor
  auction where you are the better answer, not the interruption.
- **Discovery $0.40–0.50.** The rule: **Discovery's ceiling stays strictly below
  the lowest active Category/Competitor exact bid.** Today that floor is $0.55
  (`underworld game`), so Discovery caps at $0.50. Re-check this whenever you
  lower an exact bid — if a Category keyword drops to $0.45, Discovery must come
  down too, or it starts winning auctions your tuned campaign should have had.

  **Brand is the residual risk, and it is not fully closed.** Brand's floor is
  $0.30, below Discovery's ceiling. Every brand term is an exact negative in
  Discovery ([`negatives/discovery-graduated.csv`](negatives/discovery-graduated.csv)),
  but an exact negative blocks that term — it is not a guarantee against every
  close variant or brand-adjacent phrasing. So watch Discovery's search-term
  report for anything containing your app name and negative it on sight. At
  brand-term volumes the exposure is small, but do not treat it as impossible.

**Benchmark context for sanity-checking week 1:** global median CPT ≈ **$0.92**;
all-category tap-to-install conversion ≈ **64%**; Games has the **lowest TTR of
any category at ~7.7%**. Expect your brand campaign to beat all three by a wide
margin and your competitor campaign to lose on all three. If Category is landing
near the medians, the account is healthy.

---

## The graduation loop

This is the mechanism that makes the account compound rather than plateau.

```text
Discovery (broad + Search Match)
        │  search-term report, weekly
        ▼
  term with ≥1 install and CPA ≤ target?
        │ yes
        ▼
add as EXACT keyword to the matching ad group
in Brand / Category / Competitor
        │
        ▼
add the same term as an EXACT NEGATIVE in Discovery
        │
        ▼
regenerate negatives/discovery-graduated.csv
```

The last step is a script, so it cannot drift:

```bash
node marketing/apple-ads/build-negatives.js          # regenerate
node marketing/apple-ads/build-negatives.js --check  # verify it is in sync
```

Add the new keyword to the right `keywords/*.csv` first, then run the script,
then paste the regenerated list into Apple Ads. Skipping the negative step is the
most common way a well-built account decays: Discovery quietly starts winning
auctions your exact campaign already had, at a bid you never tuned, and your
exact-campaign CPT rises for reasons that look like "the auction got competitive."

---

## Keywords to add once you have data (not at launch)

Hold these back deliberately — they widen the account before it has proven the
narrow version works:

- **Seasonal / event terms** — "new year new life game", "back to school
  simulator". Only worth it with a matching CPP.
- **Long-tail question forms** — "how to get rich game", "what if game". Search
  Match usually finds these first; take them from the report rather than guessing.
- **Feature terms from the excluded systems** — dating, parenting, politics,
  travel, luxury (see above).
- **Localized head terms** — every locale in
  `marketing/app-store-localizations/` already contains a researched `keywords`
  field. When you expand a country (`07`), that file *is* the keyword seed list
  for it. Do not translate this English list; use the locale file, which was
  written against what that market actually types.

---

## Sources

- [Apple Ads — Understand match types](https://ads.apple.com/app-store/help/keywords/0059-understand-keyword-match-types)
- [Apple Ads — Campaign Structure best practices](https://ads.apple.com/app-store/best-practices/campaign-structure)
- [AppTweak — What are the different match types in Apple Search Ads](https://www.apptweak.com/en/aso-blog/what-are-the-different-match-types-in-apple-search-ads)
- [AppTweak — Apple Ads benchmarks 2026](https://www.apptweak.com/en/aso-blog/apple-ads-benchmarks)
- [SplitMetrics — Managing and optimizing Discovery campaigns](https://splitmetrics.com/blog/apple-search-ads-discovery-campaign/)
