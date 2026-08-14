# Bug report 2026-08-14 — "Can't access apps, can't claim reward"

Reported by a player via support. Week 3, $2,522, age 19, DeepLife+ (VIP),
Gen 1. Three screenshots attached to the report. The reporter is deliberately
not named here — a support ticket is not consent to publish, and a name in a
tracked file outlives the ticket it came from.

## What the screenshots actually say

The two app-grid shots (23:05) show `$1,747`. The home shot (23:04) — taken one
minute EARLIER — shows `$2,522`. So the player spent ~$775 between them, and the
desktop launcher in the later shot proves what on: a computer.

In the later shots exactly two apps are open — **Contacts** and **Bank** — and
every other app on both the Mobile and Desktop pages carries a padlock. Those two
are the only tier-1 rows in `FEATURE_UNLOCKS`, so the save is sitting at
`unlockTier === 1`. At $2,522 it would have been at tier 2 (`wealth >= 2_000`),
which opens Spark, Pulse, Stocks, Education, Pets and Real Estate.

**The player bought a computer and the app grid locked behind them.** That is
the exact takeaway `lib/progress/featureUnlocks.ts` rule 2 says cannot happen
("NOTHING IS EVER TAKEN AWAY... the rule holds by construction").

## Root cause

`wealthMark()` is `Math.max(liquid, liveNetWorth, peakNetWorth)`. Only the last
term is monotonic, and `Math.max` of a monotonic term with two non-monotonic ones
is **not monotonic** — the moment a live term is the maximum, spending lowers the
result.

`lifetimeStatistics.peakNetWorth` is supposed to be the floor that stops that,
but it is stamped in exactly one place: `applyLifetimeStatistics`, once per week
tick, from `computeDecayInputs(prevState)` — the balance at the START of the
tick. Money earned and spent between two Next Week presses is never sampled, so
the "high-water mark" never sees it. Mid-week income is a large share of early
play (hustles, gigs, streaks, ad and VIP grants), which is how this save reached
$2,522 with a peak still under $2,000.

Same defect hits the chapter spine: `ch2_save_2k` reads `wealthMark`, and
`applyChapterProgress` needs every goal true in the SAME tick, so a player who
spends what they saved can pass each goal in a different week and never complete
the chapter.

## Second defect — the reward that cannot be claimed

`LifeChapterCard`'s completed state renders a **solid amber, full-width,
bold-dark-text bar** reading "Complete! +$800 · +35 gems next week". It is a
`View`. There is no `onPress`, by design — the week tick owns granting
(`applyChapterProgress`) and a second granting path in the card would be one
re-wire away from paying twice. That reasoning is right; the styling is not. The
element is shaped exactly like the app's primary CTA, so it gets tapped, and a
dead tap reads as a bug — which is precisely what the report says.

## Plan

- [x] Confirm the tier from the screenshots (Contacts + Bank = tier 1)
- [x] Confirm the chapter tick itself works (`__tests__/onboarding/featureUnlocks.test.ts`, 60 passed)
- [x] `lib/progress/wealthRatchet.ts` — pure O(1) helper raising
      `lifetimeStatistics.peakNetWorth` to the liquid balance whenever it is higher
- [x] Wire it into `wrappedSetGameState` (`contexts/game/GameStateContext.tsx`) —
      the one choke point every writer already passes through. `buyItem` and
      ~hundreds of other call sites write money directly, so hooking the
      MoneyActions helpers alone would have been whack-a-mole
- [x] `LifeChapterCard` — the completed state becomes a status banner, not a
      button-shaped `View`, and says when the reward lands
- [x] Tests: the reported save, replayed
- [x] `npm run type-check`, targeted suites, `tasks/lessons.md`

## Not done, and why

- The card is still read-only. Making it claimable would re-create the double-pay
  path the tick was built to remove; the fix is to stop it looking tappable.
- The tick's asset-inclusive stamp is left alone. The ratchet is liquid-only so it
  can stay O(1) on the state-write path — walking holdings/property/luxury on
  every `setGameState` would be a real cost, and the weekly stamp already covers
  the asset side.
