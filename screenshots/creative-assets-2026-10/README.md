# App Store creative assets — Header + Search Results (iOS 27)

The two optional creative assets App Store Connect added under
**Product Page → Header and Search Results** (Apple's renamed "Feature Banner").

| Placement | File | Pixels | Ratio |
| --- | --- | --- | --- |
| Product page header | [header-3840x1646.png](header-3840x1646.png) | 3840 × 1646 | 21:9 |
| Search results | [search-results-3840x2560.png](search-results-3840x2560.png) | 3840 × 2560 | 3:2 |

Both are RGB PNGs with **no alpha channel**, which Apple requires
([creative assets specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications)).

## Upload

1. **Header** tab → *Upload* → `header-3840x1646.png`.
2. **Search Results** tab → *Upload* → `search-results-3840x2560.png`.
   Do not tick "use header asset in search results": the header is too wide to read
   as a thumbnail.
3. Submit with the next version, or standalone through Asset Library, which is
   reviewed against the latest live build.

## Design decisions

- **Same system as the live screenshot set** (`screenshots/player-stories-2026-09`):
  navy ground, one blue accent (`#62B4FF`), the bundled DLS font, real gameplay
  captures shown straight on. No emoji, gradient text or tilted phones (see
  `docs/store-screenshot-design.md`).
- **Header — one idea:** "Small start. Big life." over five real screens (property,
  company, home, garage, travel). The headline and subline sit in the centre ~2000 px,
  so even a 4:3 crop on narrow devices keeps them whole. The bottom band fades out
  because the system draws app info over it.
- **Search results — say what it is:** a big two-line headline, four plain tags
  (Career · Wealth · Family · Property) and three large screens that stay readable
  at thumbnail size.
- **4+ safe on purpose.** Apple requires every creative asset to meet 4+ even though
  the app is rated higher. Dating, dark web, crime and crypto screens are left out.
  No pricing, URLs, awards or other-platform references.
- Captures come from `screenshots/appstore-2026/rich-captures/`, unaltered web
  captures of example game states. Confirm UI parity with the submitted iOS build.

## Rebuild

Uses the globally installed Playwright + Chromium and Pillow:

```bash
node screenshots/creative-assets-2026-10/source/build.mjs
```
