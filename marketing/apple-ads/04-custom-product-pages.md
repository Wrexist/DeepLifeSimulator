# 04 — Custom Product Pages & ad variations

You cannot upload ad creative to Apple Ads. The ad in search results is generated
from your product page. The only creative levers you have are (a) the default
page's metadata and screenshots, and (b) **Custom Product Pages** attached to ad
groups as **ad variations**.

**Why this is worth the effort:** ad variations built on CPPs deliver **+9%
tap-through rate on average, +27% in search results campaigns** — MobileAction's
industry measurement, not an Apple guarantee. You may publish **70 CPPs**
(doubled from 35 in Oct 2025), all usable as ad variations.

**Only one custom ad variation is active per ad group at a time.** You may
configure several, but one serves and the others stay paused, with your default
ad continuing to run alongside it. Six pages is the right number here — one per
intent cluster, each owning one ad group, so every ad group lands on a page that
answers the search that produced it.

**Ad variations are a Search Results feature.** Today tab ads *require* a CPP as
their tap destination and Search tab ads can optionally use one, but the Product
Pages placement serves your default creative — there is no CPP to attach there.

A CPP overrides screenshots, app preview videos, and the promotional text. It
**cannot** change the app name, subtitle, icon, or description — those come from
the default listing, which is why `marketing/app_store_listing.md` still governs
the words in the ad itself.

---

## The six pages

Build each in App Store Connect → your app → **Custom Product Pages** → (+).
Each needs a reference name, screenshots, an optional preview video, and
promotional text — App Store Connect generates the unique URL itself. Then attach
in Apple Ads → ad group → **Ad variations**.

### `CPP-LifeSim` — the genre answer
**Ad groups:** `LifeSim-Core` · **Search terms it serves:** life simulator, life
sim, realistic life simulator, adulthood simulator

| Slot | Headline | Screenshot |
|---|---|---|
| 1 | **Start at 18. Own nothing.** | Character creation / scenario select |
| 2 | **Every week is a decision.** | The week loop with an event choice open |
| 3 | **Careers, love, crime, markets.** | Home HUD showing multiple systems at once |
| 4 | **Your choices compound.** | A life-history / statistics screen |
| 5 | **One life. No script.** | A dramatic life-moment card |

Promotional text: *Not a story with branches — an economy that reacts. Start at
18 with nothing and see how far the math takes you.*

**Why:** this searcher is comparison-shopping the genre and has seen five
text-based life sims already. Lead with the thing none of them have — a real
simulation underneath — not with "live any life", which every rival also says.

### `CPP-Wealth` — the money fantasy
**Ad groups:** `Money-Wealth`, `Business-Tycoon` · **Search terms:** get rich
game, billionaire simulator, rags to riches, tycoon game, business simulator

| Slot | Headline | Screenshot |
|---|---|---|
| 1 | **$0 to your first million.** | Net-worth curve climbing |
| 2 | **Loans, interest, and the debt that eats you.** | Banking / loan screen |
| 3 | **Build a company. Then an empire.** | Business management screen |
| 4 | **Or lose it all in one bad week.** | Bankruptcy / crash moment |
| 5 | **Prestige. Legacy. Generations.** | Prestige / legacy screen |

Promotional text: *Compound interest is the whole game. Borrow, invest, expand —
and find out whether you can outrun the math.*

**Why:** screenshot 4 is doing real work. Wealth-fantasy ads all promise the
climb; showing the fall is what signals a simulation with stakes, and it filters
out the idle-clicker audience who would churn on day two anyway.

### `CPP-Career` — the ladder
**Ad groups:** `Career-Job` · **Search terms:** career simulator, ceo simulator,
corporate ladder game

| Slot | Headline | Screenshot |
|---|---|---|
| 1 | **20+ careers. Minimum wage to boardroom.** | Career list |
| 2 | **Study, qualify, get promoted.** | Education / skill tree |
| 3 | **Your salary is not your net worth.** | Paycheck vs. expenses breakdown |
| 4 | **Get fired. Start over. Go higher.** | A layoff event |

Promotional text: *Pick a path, earn the qualifications, climb — or take the
shortcut and find out what it costs.*

### `CPP-Investing` — markets
**Ad groups:** `Investing-Stocks`, `RealEstate` · **Search terms:** stock market
game, trading simulator, crypto simulator, real estate tycoon

| Slot | Headline | Screenshot |
|---|---|---|
| 1 | **A market that moves without you.** | Stock chart screen |
| 2 | **Stocks. Crypto. Property.** | Portfolio overview |
| 3 | **Buy, rent out, refinance.** | Real-estate screen |
| 4 | **Every sector has its own cycle.** | Sector performance view |

Promotional text: *Sectors, cycles, crashes, and rent. Trade a market that isn't
waiting for your tap.*

**Watch this one.** It draws the closest to real-finance intent of any group.
If its install→D1-retention is materially below the account average, the traffic
is people who wanted a brokerage — tighten `03`'s negatives before cutting bids.

### `CPP-Crime` — the underground
**Ad groups:** `Crime-Underground` · **Search terms:** crime simulator, mafia
game, drug dealer game, dark web game

| Slot | Headline | Screenshot |
|---|---|---|
| 1 | **There's a faster way to get rich.** | Dark web screen |
| 2 | **Jobs, laundering, heat.** | Job list with a wanted level |
| 3 | **Get caught and it follows you.** | Arrest / bail / record consequence |
| 4 | **A whole legitimate life to lose.** | Contrast: family/career screen |

Promotional text: *The underground pays better and costs more. Launder it, spend
it, or explain it to a judge.*

**Content-rating check before publishing:** confirm the App Store age rating
already reflects this content. A CPP cannot exceed what the base listing
declares, and screenshots are reviewed. If the rating does not cover it, fix the
rating first — do not soften the page.

### `CPP-Switcher` — for people leaving another life sim
**Ad groups:** all 3 Competitor ad groups (Search Results only) ·
**Search terms:** bitlife, games like bitlife, altlife, bitlife alternative

| Slot | Headline | Screenshot |
|---|---|---|
| 1 | **Like a life sim. With an economy underneath.** | Side-by-side of a choice and its financial consequence |
| 2 | **Loans, interest, markets, rent — simulated.** | Banking + market screens |
| 3 | **20+ careers, real qualifications.** | Career/education |
| 4 | **Crime, family, prestige, legacy.** | Breadth montage |
| 5 | **Free to play. Everything's unlockable.** | Honest monetization statement |

Promotional text: *You've played the tap-a-choice life sims. This one runs the
numbers underneath every choice.*

**Rules for this page.** Never name a competitor in text or imagery — Apple
rejects it and it invites a trademark complaint. State the differentiator, let
the searcher connect it. Slot 5 matters more than it looks: switchers from
aggressively monetized rivals are specifically checking whether they are walking
into another paywall, and the app's actual stance ("never paywall core
gameplay", per `docs/STORE_LISTING.md`) is a genuine advantage — say it.

---

## Attachment map

| Campaign | Ad group | CPP |
|---|---|---|
| `DLS-US-Brand-Exact` | Brand | *default page* |
| `DLS-US-Category-Exact` | LifeSim-Core | `CPP-LifeSim` |
| | Money-Wealth | `CPP-Wealth` |
| | Career-Job | `CPP-Career` |
| | Investing-Stocks | `CPP-Investing` |
| | Business-Tycoon | `CPP-Wealth` |
| | RealEstate | `CPP-Investing` |
| | Crime-Underground | `CPP-Crime` |
| | Choices-Story | `CPP-LifeSim` |
| `DLS-US-Competitor-Exact` | all 3 | `CPP-Switcher` |
| `DLS-US-Discovery-Broad` | both | *default page* |
| `DLS-US-TodayTab` | — | `CPP-LifeSim` (Today tab **requires** a CPP) |
| `DLS-US-ProductPages` | — | *default page* — the placement has no ad variations |

Discovery keeps the default page on purpose: its traffic is undefined by
construction, so a themed page would mismatch most of it and pollute the CR
signal you are mining.

---

## Testing CPPs properly

An ad variation's numbers are **not** an A/B test — traffic is not split evenly
and the ad group's keywords differ. To actually test a page:

1. Use **Product Page Optimization** in App Store Connect for true split tests of
   the *default* page (Apple splits organic traffic evenly and reports
   significance).
2. Use CPPs in Apple Ads for **intent matching**, which is what this file does —
   judge them on the ad group's CPA and D1 retention versus the account average,
   not against each other.
3. Change one page at a time and give it two full weeks. A CPP edit requires
   review and resets the page's accumulated performance data.

---

## Sources

- [Apple — Custom product pages on the App Store](https://developer.apple.com/app-store/custom-product-pages)
- [App Store Connect Help — Configure multiple product page versions](https://www.developer.apple.com/help/app-store-connect/create-custom-product-pages/configure-multiple-product-page-versions)
- [MobileAction — Ad variations with custom product pages](https://www.mobileaction.co/blog/ad-variations-with-custom-product-pages/)
- [MobileAction — Apple doubles the custom product page limit](https://www.mobileaction.co/blog/apple-doubles-the-custom-product-page-limit/)
- [RespectASO — Custom product pages in 2026: 70 pages, keywords, limits](https://respectaso.com/blog/custom-product-pages-app-store-guide-2026/)
- [SplitMetrics — Beginner's guide to custom product pages](https://splitmetrics.com/blog/ios15-custom-product-pages-setup-guide/)
