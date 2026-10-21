# Fandom wiki, AlternativeTo and directories

## Fandom wiki

Fandom is the most-cited domain in Google AI Mode, and game wikis rank for
"how do I…" questions. A small but accurate wiki beats a big empty one.

**Create:** https://community.fandom.com/wiki/Special:CreateNewWiki
- Name: **Deep Life Simulator Wiki** · URL: `deeplifesimulator` · Topic: Games
- Main page first line: "Deep Life Simulator is a free life simulation game
  for iOS and Android by an independent developer. Players live one week at a
  time…" (same wording as the site, so every source agrees).

**First 15 pages** (each 150–400 words, a short intro sentence that answers
"what is X" directly, then a table):

| Page | Source of truth in the repo |
|---|---|
| Deep Life Simulator (main) | `support-site/guide.html` |
| Careers | career ladders and salaries in `contexts/game/initialState.ts` |
| Education | `lib/education/` |
| Stock market | `lib/stocks/`, `lib/markets/` |
| Crypto | `lib/crypto/` |
| Real estate and renting | `lib/realEstate/` |
| Companies and IPOs | `lib/business/` (IPO after 26 weeks owned) |
| Loans and arrears | `lib/banking/`, `overdueBalance` notes in CLAUDE.md §7 v31 |
| Mindsets | `lib/mindset/effects.ts` (card text is generated, copy it as-is) |
| Death, heirs and legacy | `lib/legacy/` |
| Prestige and dynasty | `lib/prestige/`, `lib/dynasty/` |
| Relationships and Spark | `lib/social/`, `lib/spark/` |
| Crime and dark web | `lib/crime/`, `lib/darkweb/` |
| Politics | `lib/politics/` |
| Live Ops events | `support-site/liveops.json` |

Invite the most active Discord players as editors (a #wiki channel). Link the
wiki from the support site and Discord once it has 10 pages.

## AlternativeTo (15 minutes)

1. Sign in at https://alternativeto.net and choose **Add application**.
2. Name: Deep Life Simulator. Platforms: iPhone, iPad, Android. License: Free
   (with in-app purchases). Category: Games.
3. Description (first line is what shows in lists):
   > A free week-by-week life simulator for iOS and Android with a real
   > economy: jobs, rent, loans with interest, a moving stock market and crypto,
   > property, companies, family and an heir who inherits it all.
4. Tags: life-simulation, text-based, simulation, tycoon.
5. On the BitLife page, choose **Suggest alternative** and add Deep Life
   Simulator. Do the same on "Life Simulator", "Alter Ego" and "AltLife" pages
   if they exist.
6. Ask Discord players who know the game to "like" it there.

## Directories (one evening, then done)

Pick relevant ones only and write a different description for each.

| Site | Why |
|---|---|
| itch.io (page with store links; a web build later) | Big indie audience |
| IndieDB | Indie game directory, devlog posts get indexed |
| Product Hunt (launch the next big update, not the app as "new") | Backlink + tech audience |
| Indie Hackers product page | Backlink, dev audience |
| Wikidata | Only after 2–3 independent articles exist (needs sources) |

## Custom domain (when ready, ~$10/year)

A root domain lets the site carry `robots.txt` and `llms.txt` (which only work
at a domain root) and builds its own reputation. Buy a short domain, add it
in repo Settings › Pages › Custom domain, then update the share link only by
making the old `/get/` page redirect (the old address is compiled into shipped
apps and must keep working).
