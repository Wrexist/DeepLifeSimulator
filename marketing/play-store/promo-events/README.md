# Google Play promotional content (Play Console → Kampanjinnehåll)

Play "events" are free placement: the Events tab, search results, the store
listing, and an opt-in start notification during the preview window. Google
reviews every submission against its content guidelines, and the rules below
are the ones that decide whether an event is accepted.

## The rules that shape every event here

| Rule | Consequence for this repo |
|---|---|
| The event must be real and live in the app for its whole window | Every Play event maps 1:1 to a Live Ops event in `support-site/liveops.json` (or `lib/liveops/catalogue.ts`) with the same UTC window |
| It must apply to **all** users (except new-user offers) | The in-game event carries **no** `eligibility.stages` filter. `autumn_foundations`, `second_act`, `winter_ledger` are stage-gated and cannot be promoted |
| Tagline ≤ 80 chars, specific; description 100–500, no bullets, no "tap" | Copy lives next to the event in the `*-SV.md` file, with a claim → code table |
| Images 1920×1080 + 1080×1080, JPG / 24-bit PNG, **no text, logos, borders, rounded corners**; focal point inside 10 % sides / 15 % top / 20 % bottom | Built by `build_halloween.py` from `art/game-assets-v1/renders` so the art matches the store screenshots |
| Max 4 weeks; submit ≥ 4 days ahead, ≥ 14 days to request featuring, ≤ 60 days ahead | Keep the submit-by date in the calendar |
| Games get 4 broad-audience featuring requests per quarter | Spend them on the biggest moments |
| A submitted event cannot be edited | Proof-read before submitting |

Sources: Play Console Help — *Create promotional content* (answer 12932541) and
*content quality guidelines* (answer 12929944).

## Events

| Event | Window (UTC) | In-game id | Guide |
|---|---|---|---|
| Halloween "Nothing to Fear" | 2026-10-16 → 2026-11-06 | `halloween_nothing_to_fear` | `2026-10-halloween-SV.md` |
| Holidays "Home for the Holidays" | 2026-12-18 → 2027-01-04 | `winter_holidays_home` | `2026-12-holidays-SV.md` |

## Rebuilding the art

```
python marketing/play-store/promo-events/build_halloween.py
python marketing/play-store/promo-events/build_winter.py
```

Needs Pillow + numpy. Deterministic (fixed seeds), so a rebuild reproduces the
uploaded file byte for byte.
