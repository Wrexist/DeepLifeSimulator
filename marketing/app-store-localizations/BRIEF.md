# Localization Brief - Deep Life Simulator App Store / Google Play Listings

This brief defines the exact format and quality bar for every locale file in this
folder. The English source copy lives in `marketing/app_store_listing.md`.

## Goal

Produce a **native-quality, ASO-optimized** store listing for each locale - not a
literal translation. Copy must read like it was written by a native copywriter for
a mobile game, and keyword choices must target what people in that market actually
type into App Store search.

## File format (STRICT - parsed by validate.js)

One file per locale: `<locale-code>.md` (e.g. `de-DE.md`, `pt-BR.md`, `zh-Hans.md`).

Each field is a `##` heading followed by a fenced ```text block. Headings must be
exactly these keys, in this order:

| Heading | Store field | Hard limit (chars) |
|---|---|---|
| `## app_name` | App Store name | 30 |
| `## subtitle` | App Store subtitle | 30 |
| `## promotional_text` | App Store promotional text | 170 |
| `## keywords` | App Store keyword field | 100 |
| `## description` | App Store description | 4000 |
| `## whats_new` | App Store "What's New" (v2.3.1) | 4000 |
| `## gp_short_description` | Google Play short description | 80 |
| `## gp_full_description` | Google Play full description | 4000 |
| `## notes` | ASO rationale (not uploaded) | - |

Limits are counted in Unicode code points, spaces and punctuation included.
**Always verify with the validator before finishing** - never trust a manual count:

```
node marketing/app-store-localizations/validate.js marketing/app-store-localizations/<file>.md
```

## Field rules

### app_name
Keep the brand: `Deep Life Simulator` in every locale (Latin script everywhere -
this is how the app ships). Do not localize the name.

### subtitle (30 chars - highest-leverage indexed field)
Craft a native subtitle containing the market's highest-volume genre keyword
(e.g. the local term for "life simulator"). It must sound like marketing copy,
not a keyword string. Do not just translate "Real Economics. Real Choices." if a
higher-volume native phrasing fits.

### keywords (100 chars - comma-separated, NO spaces after commas)
- Lowercase where the script has case; singular forms; no duplicate concepts.
- **Never repeat words already in the app name or subtitle** - Apple indexes those
  already; repeating wastes characters.
- Never include `bitlife`, `the sims`, `模拟人生`, or other competitor trademarks.
- Never waste characters on `app`, `free`, `game` alone.
- Mix native-language terms with English terms where the market genuinely searches
  in English (e.g. JP/KR/Nordics/NL often search "life simulator" in English).
- Prioritize high-search-volume genre terms: life simulator/life sim, career,
  money/rich, tycoon, business, investing, choices, story, billionaire, jail/crime -
  in whatever form has volume locally. Use ASO knowledge of that market.
- Use every character you reasonably can (aim 90-100), but never exceed 100.

### promotional_text (170 chars)
Punchy hook shown above the description; not indexed, pure conversion copy.
Theme: start at 18 with nothing → loans, stocks, real estate, crime, dynasties →
build generational wealth or collapse.

### description (App Store, aim 2000-3500 chars)
Adapt the English full description (section 5 of the source). Keep the structure:
differentiator first (real economic engine), then careers, economy mechanics,
choices/relationships/crime, prestige & generational wealth, events, cloud save,
fairness/no pay-to-win, closing CTA. Use uppercase (or locale-appropriate) section
headers and `•` bullets like the source. Localize currency examples naturally.
The claim "This isn't BitLife" may be kept in body copy (never in keywords/subtitle).

### whats_new (condense to ~600-1000 chars)
Condense the v2.3.1 notes (source section 6): 70+ bug fixes, purchase system
overhaul, fairness/pity systems, relationship consequences, performance gains,
"we listened to your feedback" framing, Discord link `discord.gg/invite/rzktazdX8v`.

### gp_short_description (80 chars)
Google Play short description - indexed and shown first; hook + top keyword.

### gp_full_description (aim 2500-4000 chars)
Adapt source section 7. Google Play indexes description text, so weave the top
5-8 local keywords naturally throughout (especially first 160 chars), without
keyword stuffing. Keep the `✓` feature list.

### notes
3-8 bullets in English: which local keywords you targeted and why, local search
behavior assumptions, and anything the store owner should A/B test.

## Tone

Confident, direct, second person. This is a strategy-first life sim: consequences,
compound interest, bankruptcy, dynasties. Avoid machine-translation stiffness -
prefer how successful local sim/tycoon games actually write. Numbers, feature
counts (20+ careers, 80+ events), and factual claims must match the source.
