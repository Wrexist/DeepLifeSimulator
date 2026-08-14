# App Store & Google Play metadata

**The copy lives in `metadata.mjs`, not here.** This file explains the thinking;
the fields themselves are code so their character counts can be measured rather
than claimed.

```bash
node scripts/check-aso.mjs           # audit
node scripts/check-aso.mjs --emit    # audit, then print every field to paste
```

The emitted block is what goes into App Store Connect and Play Console. Do not
retype it — every count in the header is measured at the moment of printing.

---

## Why this is code and not a document

The version this replaces (`../aso-v2.7.0-paste-ready.md`) wrote its character
counts by hand next to the copy. They were correct when written and wrong one
edit later. It also stated a rule — *never repeat a word already in the app
name, Apple indexes those anyway* — and then broke that rule in its own
subtitle, which spent eight of thirty characters re-indexing **life** and
**sim**, both already in *Deep Life Simulator*.

That is not carelessness. It is what happens when the rule and the copy live in
different paragraphs of prose and nothing checks one against the other. Now
something does.

---

## What Apple actually indexes

This drives every decision below, and it is where most listings lose reach.

| Field | Indexed? | Notes |
|---|---|---|
| App name (30) | **Yes — highest weight** | The most valuable characters in the listing |
| Subtitle (30) | **Yes — second** | Not a tagline slot. It is a keyword slot that has to read well |
| Keywords (100) | **Yes** | Comma-separated, no spaces, singular only |
| IAP display names | **Yes** | Almost always wasted. Ours currently say "100 Gems", "Starter Pack" |
| Category | Yes, automatically | So "simulation" and "game" in the keyword field buy nothing |
| Description (4000) | **No** | Apple does not index it. It is a pure conversion surface |
| Promotional text (170) | No | But it updates **without a review cycle** |
| What's New | No | — |

**Apple matches across fields.** "life" in the name plus "story" in the keywords
already covers the phrase *life story*. So a term must appear in exactly one
field; a second copy is a slot thrown away. `check-aso.mjs` fails on one.

Google Play is different in the way that matters most: **it does index the long
description.** So the two long descriptions are not the same text — the Play one
carries the target terms naturally, and the audit checks that it does.

---

## The changes, and what each is worth

**Name → `Deep Life Simulator: Tycoon`** (27/30, was 19/30). Eleven of the most
valuable characters in the listing were empty. The suffix keeps the brand intact
and spends them on the highest-volume term in this genre the name did not
already carry. *This is the one change that needs a review cycle and a decision
— see Risks.*

**Subtitle → `Careers, crime, crypto, heirs`** (29/30). The previous subtitle
duplicated the name. This one shares no term with any other field and adds four
distinct high-intent terms.

**Keywords → 99/100**, no overlap with name or subtitle, no competitor marks,
singular forms.

**A second keyword field.** The US storefront indexes an app's **es-MX**
metadata alongside its en-US metadata, so adding the Spanish localisation buys
another 100 characters of keywords that US searchers can match — while also
serving Spanish-speaking users properly. This is the largest piece of unused
capacity in the listing and the single highest-leverage item here.

Two honest caveats, because this is the part people overstate:

- Apple does not document it. Treat it as well-established practice, not a
  guarantee, and confirm it with a before/after on impressions.
- It must be a **real** localisation. A Spanish keyword field bolted onto an
  English description is a bad experience for everyone it reaches, so the
  subtitle and description are translated too.

`en-GB` is included for completeness and is currently identical to en-US. UK,
Australian, Canadian and Irish storefronts fall back to en-US when it is absent,
so unlike es-MX it adds nothing unless the terms genuinely differ. It is listed
so the next person does not have to work out why it was skipped.

**IAP display names.** Apple indexes them; ours currently carry no search value
at all. `metadata.mjs` has five renames that stay accurate to what is sold.

---

## The accuracy audit

Two claims in the previous copy are **not true of this build**, and the audit
now fails on both:

- **"No forced ads."** `lib/ads/interstitial.ts` shows full-screen interstitials
  at in-game year boundaries. They are gated hard — a two-year grace, a
  three-minute floor, off entirely once ads are removed — but they are
  unavoidable, which is what "forced" means.
- **"No pay-to-win — everything can be earned."** `utils/iapConfig.ts` sells
  Work Pay Boost (+50% earnings, $1.99), Mindset (50% faster promotions), Fast
  Learner, and Unlock All Perks ($6.99). DeepLife+ adds +25% career income.
  Those are permanent gameplay advantages bought with money, and they are not
  in the gem shop.

Also removed: **"One life is about an hour."** A life is one tap per in-game
week across roughly sixty years. Story mode, which batched weeks, was removed
after playtesting.

Overselling is an App Store Review 2.3.1 problem, but the rejection is the cheap
outcome. The expensive one is passing review and then meeting a player who
installed on "no forced ads", hit one at the second year boundary, and left a
one-star review. **Rating is an input to the ranking this entire file exists to
raise**, so a false claim does not trade honesty for installs. It trades honesty
for fewer installs, slightly later.

What replaced them is specific and checkable: ads only at year-end breaks, none
in the first two in-game years, one purchase removes them. That is a better line
than the false one anyway, because it is falsifiable and therefore believable.

`CLAIMS` in `metadata.mjs` pairs every promise with the code that backs it.
Anything added later that sounds like a promise belongs there with its evidence.

---

## Risks and decisions still open

1. **Renaming the app needs a call.** `Deep Life Simulator: Tycoon` requires a
   review cycle and slightly dilutes a brand that already ranks for "deep life".
   The gain is real but it is the only irreversible-feeling item here. If the
   answer is no, keep the name and the rest still stands — move `tycoon` into
   the keyword field and drop `money` to make room.
2. **`bitlife` is deliberately absent.** It is the obvious high-volume term and
   it is a competitor trademark: App Store Review 5.2.5, and a takedown risk on
   Play. It would also bring traffic expecting a different game.
3. **Test the subtitle rather than trust it.** Apple's Product Page Optimization
   runs a real A/B test on the subtitle, icon and screenshots, free, up to three
   treatments. The subtitle here is a considered guess; PPO is how you turn it
   into a measured one.
4. **The IAP renames are optional** and need App Store Connect edits.

---

## Field-by-field ownership

| Field | Where it lives | Changes need a review cycle? |
|---|---|---|
| Name, subtitle, keywords | `metadata.mjs` → App Store Connect | Yes |
| Description | `metadata.mjs` | Yes |
| Promotional text | `metadata.mjs` | **No** — the only field you can change any time |
| What's New | `WHATS_NEW.md` | Ships with the build |
| Screenshots | `screenshots/appstore-2026/` | Yes. See `docs/store-screenshot-design.md` |
