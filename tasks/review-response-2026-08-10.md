# A 3-star review, measured

> ★★★☆☆ "It's too much to read and it's not a real competitor to BitLife. If you
> wanted to be like that, ads would surely ruin it already, so start without them
> to get more users. Secondly, make the mechanics easier to understand, then it
> will be a true life simulator competitor."

Three claims. Each was measured against the code before deciding anything,
because the last several times a plausible-sounding diagnosis was acted on
without measuring it, it was wrong.

---

## 1. "Ads would surely ruin it — start without them" → **HALF TRUE, and the
true half is fixed**

The reviewer's instinct already matched half the codebase and contradicted the
other half, which is why the complaint reads as sharper than the policy is.

| Surface | Grace before a new player sees it | Verdict |
|---|---|---|
| Interstitial | **104 weeks** (2 game years), only on a year boundary, 3-minute floor, suppressed whenever a modal is up | Already conservative |
| Rewarded (orb, Pulse) | Opt-in — the player taps it | Fine by construction |
| **Banner** | **None. Rendered on the home tab from week one.** | The problem |

So the banner was the *only* ad a new player ever met, and they met it
immediately — in the session where they are still deciding whether to keep the
app. The interstitial policy already agreed with this reviewer; the banner had
simply never been held to the same standard.

**Fixed:** `BANNER_GRACE_WEEKS = WEEKS_PER_YEAR` in `components/BannerAd.tsx`.
A new player now has a completely ad-free first game year. One year rather than
the interstitial's two, because a banner is far less intrusive than a
full-screen takeover — what matters is that the first session is clean, and a
first session is nowhere near 52 weeks of play.

`__tests__/ads/newPlayerAdGrace.test.ts` pins the invariant that matters —
**week one is clean** — rather than the constants, so tuning revenue later
cannot silently walk an ad back into the first session.

**Not done: removing ads entirely.** The reviewer's stronger version ("start
without them") is a real strategy, but it trades a known revenue line for an
unmeasured retention gain, and this app has no analytics history to size either
side. The funnel now reports through Firebase, so the honest sequence is: ship
the clean first year, watch D1/D7 retention and ARPDAU, then decide with data.
Removing the entire ad business on one review would be the same class of
mistake as the four balance guesses recorded in `tasks/todo.md`.

---

## 2. "Too much to read" → **TRUE, but not where it looks**

Measured the two obvious suspects first, and both came back clean:

- **Event text is tight.** 392 authored event descriptions, **median 13 words**,
  p90 23, max 31. Only 4% exceed 25 words. This is not a wall of text.
- **Screen copy is modest.** ~870 words of user-visible string literals across
  all of onboarding plus the main tabs combined.

The reading burden is **structural, not verbal**: there are **six screens
between opening the app and playing a single week**.

```
MainMenu → SaveSlots → Scenarios → Customize → Ambitions → Perks → play
```

BitLife's comparison point is one tap. Six screens of choices — each asking a
player to understand a system they have not seen yet — is the "too much to
read" a reviewer feels even when no individual screen is wordy. Perks and
Ambitions in particular ask for decisions whose consequences are meaningless
until you have played.

### Proposal: a "Just start" path

Add one button on MainMenu that skips straight to week one with sensible
defaults (recommended scenario, random identity, no ambition, no perks), and
let the player set those later from inside the game. Keep the full flow for
anyone who wants it.

This is deliberately **not** implemented here. It changes the first-run
experience for every new player, and the right shape depends on whether
Ambitions and Perks can be chosen mid-life without breaking their own rules —
that needs a design decision, not a patch.

---

## 3. "Make the mechanics easier to understand" → **TRUE, and the most valuable
of the three**

The least specific complaint and the most important one. What a new player
meets on the HUD alone: health, happiness, energy, money, savings, gems,
generation, age, date, week-of-month, plus stat trend arrows and a danger
badge. Four tabs, each with sub-tabs (Work has Street Hustle / Career / Crime
Jobs; Life has Health / Market / Stats / Family).

Concrete, low-risk candidates, cheapest first:

1. **Progressive disclosure of the HUD.** Show health/happiness/energy/money in
   the first game year; reveal savings, gems and prestige as they become
   reachable. Nothing is removed — it arrives when it means something.
2. **One-line "why" on every number.** Tapping a stat already opens a breakdown
   modal; the first line should be plain language ("Happiness falls a little
   every week. Rest, socialise or spend to hold it up"), not a contributor
   table.
3. **A first-week guide that teaches one loop.** `FirstWeekGuide.tsx` exists —
   it should teach exactly one thing (advance a week, see what changed) rather
   than survey the app.
4. **Name the trend arrows.** A red ↓ next to 55 means nothing until you know
   whether that is per week or since last tick.

---

## What was NOT concluded

The review says "not a real competitor to BitLife". That is a positioning
judgement, not a defect, and it is the one line here with no measurable claim
inside it. The three specific complaints underneath it are all actionable and
all real; the headline is not something to redesign around.

Worth noting for whoever reads this next: this review landed the same day story
mode was removed for being too complicated. The reviewer and the product owner
independently reported the same thing — the game asks too much before it gives
anything back. That agreement is the strongest signal in this document.
