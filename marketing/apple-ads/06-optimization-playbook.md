# 06 — Optimization playbook

Rules, not judgement calls. Every threshold below is a number you can check
against a spreadsheet, because the failure mode of a small ads account is a
person changing bids on a hunch three times a week and destroying the signal.

Throughout: **target CPA** = `D30 revenue per install ÷ 0.35` (see `05`).
Recompute it monthly, not weekly.

---

## The cadence

| When | Time | What |
|---|---|---|
| Daily (first 14 days only) | 5 min | Budget-cap check and the one emergency rule |
| Weekly — Monday | 45 min | Search-term mining → bids → budgets |
| Monthly | 90 min | Structure, CPPs, geo expansion, target-CPA refresh |
| Quarterly | half day | Full account rebuild decision, competitor re-scan |

---

## Daily (first 14 days only)

Only two things are allowed during the two-week freeze (`01-SETUP.md` Part 6):

1. **Emergency pause.** Any single keyword that has spent **≥ 3× target CPA with
   zero installs** → pause it. Nothing else.
2. **Budget-cap check.** If a campaign hits its daily budget before 6pm every day
   for 3 consecutive days, note it — do not change it yet. It becomes a scale
   decision on Monday.

Resist everything else. A $30/day account produces roughly 20–40 taps a day; a
Tuesday bid change based on Monday's data is fitting noise.

---

## Weekly (Monday, 45 minutes)

### Step 1 — Mine search terms (15 min)

Run the routine in [`03-negative-keywords.md`](03-negative-keywords.md):
Discovery → Search Terms → sort by spend →
block the irrelevant, graduate the winners, regenerate:

```bash
node marketing/apple-ads/build-negatives.js
```

Do this **first**, every week, without exception. It is the only step that
changes what you are buying rather than what you are paying.

### Step 2 — Keyword bid decisions (15 min)

Work the keyword-level report top-down by spend. **Evaluate the rules in the
order listed and stop at the first match** — the order matters, because a
zero-impression keyword also satisfies the low-spend rule below it. Bands are
half-open so no keyword matches two:

| # | Condition (last 14 days) | Action |
|---|---|---|
| 1 | Impressions = 0 for the full 14 days | **Raise bid +30%** once. Still zero next week → the term has no volume; remove it. |
| 2 | Spend ≥ 3× target CPA **and** zero installs | **Pause.** |
| 3 | Installs ≥ 3 **and** CPA ≤ 70% of target | **Raise bid +20%.** Under-buying a winner. |
| 4 | Installs ≥ 3 **and** CPA > 70% and ≤ 110% | **Leave it.** Working as intended. |
| 5 | Installs ≥ 3 **and** CPA > 110% and ≤ 150% | **Lower bid −15%.** |
| 6 | Installs ≥ 1 **and** CPA > 150% of target | **Lower bid −30%.** Second consecutive week in this band → pause. |
| 7 | Spend < 1× target CPA, any result | **Leave it.** Not enough data — this is most of your long tail. |

Note that only rule 6 pauses on a second bad week. A keyword sitting in the
110–150% band (rule 5) keeps getting its bid trimmed and is never auto-paused;
that band is "too expensive", not "hopeless".

Constraints that keep this from oscillating:

- **Never change a bid by more than 30% in one move**, and never twice in the
  same week.
- **Never raise a Discovery bid above the lowest exact bid** in the account.
- **Never lower a Brand bid** for CPA reasons. Brand CPA should be your floor; if
  it isn't, something is misconfigured.

### Step 3 — Budget decisions (10 min)

| Condition | Action |
|---|---|
| Campaign capped 5/7 days **and** campaign CPA ≤ target | **+25% daily budget** |
| Campaign capped 5/7 days **and** campaign CPA > target | Do not raise. Fix bids and negatives first. |
| Campaign spending < 60% of budget with healthy CPA | Raise bids (Step 2), not budget — you are losing auctions, not out of money |
| Campaign CPA > 150% of target for 2 consecutive weeks | **−50% daily budget**, move it to the best-performing campaign |

**Raise budgets by ≤25% per week.** Larger jumps re-enter the auction's
calibration and produce a bad week you will misread as the budget being wrong.

### Step 4 — Log it (5 min)

One line per change in a running log: date, what changed, from → to, why, and the
metric you expect to move. Without this you cannot tell in six weeks whether the
CPA improvement came from the negative list, the bid cuts, or the new CPP. Commit
the log next to this folder.

---

## Monthly (90 minutes)

1. **Recompute target CPA** from the last full cohort (`05` Part 2). Everything
   above depends on it and it drifts as retention and monetization change.
2. **Ad group review.** Any ad group whose CPA has been >150% of target for a
   full month gets paused, not tuned. On this budget, spreading spend across a
   losing theme starves a winning one.
3. **CPP review.** For each ad group, compare CR against the account average. A
   CPP more than 20% below average gets rewritten (one page at a time, two-week
   read — see `04`).
4. **Graduation audit.** `node marketing/apple-ads/build-negatives.js --check`
   must pass. If it fails, a keyword graduated without its negative and Discovery
   has been bidding against your exact campaigns — expect an unexplained CPT rise
   in that ad group, and confirm it in the report.
5. **Geo check.** Any expansion trigger in `07` met? Any expanded country
   underperforming its trigger for a month gets rolled back.
6. **Competitor re-scan.** Search the App Store for your top 5 category terms and
   note who now ranks. `keywords/competitor-exact.csv` decays as the charts move;
   verify each listed rival still exists and still competes before renewing spend
   on it.

---

## Quarterly

- **Maximize Conversions eligibility.** ≥30 days of history and ≥5 installs/day
  from Category+Discovery → build `DLS-US-MaxConv` (`01-SETUP.md` §1.5). Target
  CPA at or slightly above blended, budget = target CPA × 10, then do not touch
  it for two weeks.
- **Placement expansion.** Search Results profitable for a full quarter → open
  Search tab / Today tab / Product Pages, each in its own campaign with its own
  budget (`01-SETUP.md` Part 4).
- **Full-funnel review.** Compare paid-cohort D1/D7 retention against organic in
  Firebase Analytics. Paid retaining materially worse means the keyword mix is
  attracting the wrong player, and the fix is in `02`/`03`, not in bids.

---

## Failure modes, and what they actually mean

| Symptom | Usual cause | Fix |
|---|---|---|
| CPA rising, CPT flat | Buying more of the wrong traffic | Negatives (`03`) |
| CPT rising, no competitive change | Discovery bidding against your own exact campaigns | Run `build-negatives.js`; a graduation skipped its negative |
| Healthy TTR, poor CR | The page loses the user after the tap | CPP (`04`), or the rating |
| Poor TTR | Ad showing for terms it should not | Negatives, then keyword relevance |
| Good CPA, bad ROAS | Cheap installs that never monetize | The keyword theme is wrong, not the bid — pause the ad group |
| Everything looks fine, revenue doesn't move | Attribution not wired | `05` Part 1 |
| Spend flat at well under budget | Bids below the auction floor | Step 2's zero-impressions rule |

---

## The one-page decision tree

```text
Is attribution live?  ──no──► stop, fix 05
        │ yes
Is the rating ≥ 4.0 with 30+ reviews?  ──no──► Brand campaign only, fix ratings
        │ yes
Did you run the search-term report this week?  ──no──► do that first
        │ yes
Zero impressions for 14 days?  ──yes──► raise bid 30% once
        │ no
Spent 3× target CPA with zero installs?  ──yes──► pause
        │ no
Is spend ≥ 1× target CPA?  ──no──► leave it alone
        │ yes
Is CPA ≤ 110% of target?  ──yes──► ≤70%: raise 20% · else hold
        │ no
Is CPA > 150% of target?  ──no──► lower the bid 15%, wait a week
        │ yes
Is this the 2nd consecutive week above 150%?  ──yes──► pause
        │ no
Lower the bid 30%, wait a week.
```

---

## Sources

- [Apple Ads — Manual bidding best practices](https://ads.apple.com/app-store/best-practices/manual-bidding)
- [Apple Ads — Maximize Conversions best practices](https://ads.apple.com/app-store/best-practices/maximize-conversions)
- [Appfigures — 11 ways to optimize your Apple Search Ads campaign](https://appfigures.com/resources/guides/optimizing-your-apple-search-ads-campaign)
- [SplitMetrics — Managing and optimizing Discovery campaigns](https://splitmetrics.com/blog/apple-search-ads-discovery-campaign/)
