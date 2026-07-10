# App Store & Google Play Localizations — Deep Life Simulator

ASO-optimized store listings for **all 39 App Store Connect locales**, ready to
paste into App Store Connect and Google Play Console. English source of truth:
`marketing/app_store_listing.md`.

## What's in each file

Each `<locale>.md` contains every store field with its hard character limit:

- `app_name` (30) — kept as `Deep Life Simulator` everywhere (brand)
- `subtitle` (30) — native, keyword-optimized (indexed by Apple)
- `promotional_text` (170) — conversion hook, editable without review
- `keywords` (100) — comma-separated, no spaces, locale-tuned search terms
- `description` (4000) — full App Store description
- `whats_new` (4000) — v2.3.1 release notes
- `gp_short_description` (80) — Google Play short description (indexed)
- `gp_full_description` (4000) — Google Play long description (indexed)
- `notes` — ASO rationale per market (not uploaded)

## Validate before uploading

```
node marketing/app-store-localizations/validate.js
```

Counts Unicode code points per field (what App Store Connect counts) and fails
on any over-limit, empty, or malformed field.

## Locale coverage (39)

| Region | Locales |
|---|---|
| English | en-US, en-GB, en-AU, en-CA |
| Europe West | de-DE, fr-FR, it, es-ES, pt-PT, nl-NL, ca |
| Nordics | sv, da, no, fi |
| Europe East/SE | pl, cs, sk, hu, ro, hr, el, ru, uk, tr |
| Americas | es-MX, pt-BR, fr-CA |
| East Asia | ja, ko, zh-Hans, zh-Hant |
| MENA | ar-SA, he |
| South/SE Asia | hi, th, vi, id, ms |

## Cross-locale indexing tricks used

- The **es-MX** and **zh-Hans** keyword fields are also indexed for the **US
  storefront** — those two keyword strings are chosen to complement en-US.
- English variants (en-GB/en-AU/en-CA) carry **different keyword strings** than
  en-US to widen total indexed coverage on storefronts that cross-index English.
- No locale repeats words already in the app name or its own subtitle (Apple
  already indexes those), and no competitor trademarks appear in any indexed field.

## Upload order (suggested)

1. Tier 1 revenue markets: en-US, ja, ko, de-DE, zh-Hans, en-GB, fr-FR
2. Tier 1 download markets: pt-BR, es-MX, id, tr, ru, hi
3. Everything else.

Google Play uses BCP-47 codes that differ slightly from Apple's; map when
uploading: `no → no-NO`, `zh-Hans → zh-CN`, `zh-Hant → zh-TW`, `ar-SA → ar`,
`he → iw-IL` (legacy code), `cs → cs-CZ`, etc.
