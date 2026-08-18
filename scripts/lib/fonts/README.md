# Fonts used by the store-screenshot generators

`InterTight.woff2` — **Inter Tight**, variable weight 500–800, latin subset
(44 KB), from Google Fonts (`fonts.gstatic.com/s/intertight/v9`).
Licensed **SIL Open Font License 1.1**, which permits embedding and
redistribution: <https://openfontlicense.org>.

## Why it is committed rather than fetched

The generators render in headless Chromium on whatever machine runs them. CI
and this container have **no Apple fonts and no Inter** — `fc-list` returns
DejaVu, FreeSans and Liberation Sans and nothing else. A stack of
`-apple-system, 'SF Pro Display', …` therefore falls through to **Liberation
Sans**, an Arial metric clone, so the headline that shipped was set in a
different, blander typeface than the one the CSS asked for, and it changed
depending on who ran the script.

Embedding the file as a base64 `@font-face` makes the render deterministic:
same bytes in, same pixels out, on any machine, with no network call at
generation time.

Nothing here ships in the app — preflight §11 (`scripts/lib/assetBudget.js`)
counts only files under `assets/` reachable through a static `require()`.
