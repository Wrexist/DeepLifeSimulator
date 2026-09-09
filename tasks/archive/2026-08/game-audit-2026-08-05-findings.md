# Whole-game audit — 2026-08-05

Five parallel audits (noise/confusion · UI & visual polish · navigation/IA ·
gameplay depth & late-game · economy/balance), plus the repo's own
`npm run audit:weekly`.

**Baseline before any change:** `npm run type-check` clean · 465 suites /
5,706 tests green · `audit:weekly` 100% green across all five domains.

That last point frames everything below. **Every automated invariant in this
repo passes.** The problems the owner reports — noisy, confusing, thin late game
— are all in the space the static analyzers cannot see: what the player is
*told*, what *interrupts* them, and what is left to *do* after week 300.

---

## 1. The headline finding

> **The game is simultaneously too loud and completely mute.**

Three of the four player-feedback channels rendered nothing, while the channels
that *did* render fired on uncoordinated timers with no shared queue.

| Channel | State found | Consequence |
|---|---|---|
| `feedbackSystem.{success,error,warning,info}(msg)` | **Every message discarded.** Routed to `showAchievementToast(msg, cat, **0**)`; that helper gates on `reward > 0`, correctly. | Long-press a vital → "Rest" → phone buzzes, *nothing else happens*. A refused tap ("Need $12 for a healthy meal") was indistinguishable from a successful one. |
| Toast severity `warning` | **Suppressed at the provider.** `return`ed before rendering. | Every rejection on the Work screen — job application, promotion, raise, retirement — was silent. |
| `info` banners | Filtered out of `UIUXOverlay`. **72 week-loop call sites** flush into it. | Eviction, arrears, marriage, divorce, birth: no message. |
| `SmartNotificationTicker` | Fires haptic + **error sound** with no visible copy. | Once a week the phone buzzes angrily with nothing on screen. Reads as a bug. |

The `info` and `warning` suppressions were *deliberate* (the code comments
explain the original reasoning: banners covered the header; warnings overlapped
the status bar). The reasoning was sound; the remedy was too blunt. Deleting a
severity tier to fix a *position* problem removes the one message type that must
never be optional — failure feedback.

The `feedbackSystem` case was not deliberate. It is a pure wiring bug, and it is
the single most likely source of "I tapped something and I don't know what
happened."

---

## 2. What was shipped in this pass

All verified against source before changing, and covered by tests.

### Feedback channels — un-muted
- **New `utils/toastBridge.ts`** — a module-level handle on the real toast
  channel, so non-React callers can reach it (the same ref pattern
  `achievementToast.ts` already used, pointed at the correct channel).
- `feedbackSystem` now routes to the toast channel instead of the achievement
  popup. The `reward > 0` gate stays — it was correct; the channel was wrong.
- `warning` toasts restored, defaulting to the **bottom** slot (which already
  offsets by `insets.bottom`), preserving the original no-status-bar-overlap
  intent.
- Toast stacking offsets are now counted **per position group** — a bottom toast
  behind one top toast was being pushed 72pt off its own anchor.
- `SmartNotificationTicker` messages now travel with the buzz. This was blocked
  *by* the bug above and unblocked by fixing it.
- Deleted a second, dead `useToast` in `feedbackSystem.ts` — same name as the
  real one, zero importers, pointed at nothing.

### Interruption noise — reduced
- **Ad orb**: repeat cadence `110–210s` → `360–600s` (it was appearing 6–8×
  per 15-minute session); no more haptic on *appearance* (an unprompted offer
  should not buzz); moved from `Z_INDEX.TOAST` (400) to `DROPDOWN` (100) — at
  TOAST it floated **above the MODAL layer**, covering the weekly result sheet
  and the death screen.
- **Premium promo**: it respected *no* guard at all and could land on top of the
  death screen. Now uses the same blocking predicate as the orb, re-checked at
  fire time (its 1.8s delay is long enough for the tick to raise a death).
- **Contextual tips**: dismissal was wiped every week, so tapping the X
  accomplished nothing — the tip returned on the next Next Week, forever. Now a
  real 12-week cooldown.

### Correctness
- **Welcome-back bonus double-grant** (gate→grant, CLAUDE.md §4.4). The updater
  stamps `lastLogin = now`, but `computeWelcomeBackBonus` floors `daysAway` back
  up to 1 — so a second `onClose` in the same React batch paid another half-week
  of salary. Now rejects against `prev`.
- **Prestige card opened a shop.** The one card in the game reading "Ready to
  prestige" could not start a prestige. Now opens `PrestigeModal`.

### UI / polish
- **`BaseModal` rendered dark chrome in light mode** — hardcoded
  `colors.dark.*` / `palette.dark800` with no `useTheme()`. A light-mode player
  tapping "Money" in the HUD got a slate-900 dialog over a white app. Affected
  all six HUD breakdown modals. Colour is now resolved per-render.
- **Legibility floor**: 7 sites below 10pt raised to 10, including
  **`fontScale(7.5)` on the paywall** and three `fontSize: 8` job badges that
  were *unscaled* (i.e. still 8pt on a Pro Max).
- **`hitSlop` + a11y labels** on 7 close buttons that were 32–40pt against
  Apple's 44pt floor — the most frustrating possible missed tap, because the
  player is trying to leave.
- **Android back** restored on 4 modals that silently swallowed it
  (`FamilyTreeModal`, `MemoryBookModal` ×2, `LegacyOverviewTab`,
  `SimpleTutorialModal`).
- **Safe-area insets** on the two Pulse bottom sheets sitting under the home
  indicator. Uses the real inset rather than a scaled constant — `scale()`
  shrinks toward 0.7 on small devices, so the padding was getting *smallest*
  exactly where it was already tightest.

### Truthful navigation copy
16 strings across `HelpModal`, `FirstWeekGuide` and `IdentityCard` told players
to visit the "Health tab", "Mobile tab", "Computer tab", "Hobbies tab",
"Achievements tab" — **none of which have been tabs since the tab merge**. The
tab bar is Home / Work / Apps / Life. A stuck player who opened Help was sent
somewhere that is not on screen.

### Tests added
- `__tests__/utils/feedbackToastChannel.test.ts` (11) — asserts the channel is
  **reachable**, not merely present. This is the failure class `lessons.md`
  records twice: "is it called?" is a different question from "does it work?",
  and only one of them had a test.
- `__tests__/onboarding/navigationCopy.test.ts` (4) — pins the copy to the real
  tab set, and cross-checks that tab set against `_layout.tsx` so the next nav
  change has to update the copy with it.

**Result: 470 suites / 5,721 tests green, type-check clean.**

---

## 3. Hard Rule #7 — clean

169 one-sided `border*Width` sites were classified individually. **Zero
violations.** All are section dividers, active-tab underlines, the Pulse
thread-indent hairline, or bottom-sheet top hairlines. No
`borderStartWidth`/`borderEndWidth` logical-property bypasses either. The sweep
held.

One edge worth a second opinion: `workScreenStyles.ts` `crimeJobActionContainer`
pairs `borderTopWidth: 0.5` with a red tint on a card footer. I read it as an
allowed section divider (full-width, separates body from action area), but it is
the closest thing in the codebase to the banned look.

---

## 4. The structural problems left open

These are real, verified, and **too large to land safely in this pass**. They are
the input to the feature list in `game-feature-roadmap-2026-08-05.md`.

### 4.1 No interruption queue (the biggest remaining noise win)
There are **four independent popup priority chains that cannot see each other**.
Worst realistic single "Next Week" press: daily-reward popup + weekly result
sheet + notification buzz + premium promo + ad orb + up to 4 stat pills +
achievement toast = **7 concurrent surfaces, 3 of them RN Modals with
independent backdrops**, arriving on staggered `setTimeout`s in an order nobody
defined.

The fix is one `InterruptionQueue` with an explicit priority enum
(`DEATH > WEDDING > LIFE_MOMENT > EVENT_INBOX > GOAL > DAILY_REWARD >
WEEK_RESULT > PROMO > AD_ORB`) presenting strictly one at a time. Every surface
registers with it instead of owning a `visible` boolean plus an ad-hoc
`!blockingModalUp` expression. **This is the single highest-leverage change
available.** Two of its symptoms are patched above; the architecture is not.

### 4.2 The Journal is permanently empty
`journal: []` in `initialState` has **no writer anywhere in the repo**. The one
surface that could answer "what just happened to me?" always renders its empty
state — on the same screen Help tells players to visit. Combined with the muted
`info` channel, the player has *no* way to review a week. Both are one fix: write
journal entries from the same 72 flush sites, and the week digest becomes both a
transient toast and a permanent scrollable record.

### 4.3 The economy's late game runs backwards
Passive income is multiplied by `0.9^floor((netWorth − 10M) / 10M)`, floored at
0.25 — and **$10M is also the prestige threshold**. Success starts being
throttled at exactly the dollar figure where the game says "you've won."

### 4.4 Half of all mandatory costs are still silently forgiven
The v31 arrears system covers **six** bill lines. Luxury upkeep, vehicle running
costs, crime fines, student loans, mining power and subscriptions are all charged
*after* the money writeback and floor at `Math.max(0, …)`. A player owning the
full luxury collection owes **$556,820/wk**; if they cannot pay, the shortfall
vanishes — they keep the collection *and* the $301,200/wk of yields, and book
zero arrears. **The mega-yacht is free the moment you go broke.**

### 4.5 The ad orb is a net-worth-scaled faucet on a real-time clock
1.5% of net worth per tap, on a wall-clock timer decoupled from `weeksLived`.
Taking every orb doubles net worth roughly every 2.2 hours of real time. It is
invisible to the tax brackets and to the net-worth soft cap. (Cadence is now ~3×
slower, but the *rate limit* is still real-time, not game-week.)

### 4.6 Renting a home is behind a $5,000 computer and a Chapter-3 lock
Rent — a week-1 survival need with an eviction failure state — is tab 2 of the
Real Estate app, which is desktop-only and tier-3 gated. A player in their first
30 weeks, bleeding vitals, cannot see that housing exists.

### 4.7 Three competing design systems
`spacing.md` means **12** in `lib/config/theme.ts` and **16** in
`utils/scaling.ts`; a third copy lives in the orphaned `utils/designSystem.ts`
(373 lines, one consumer). 55 files import two of them. This is the root cause of
the 35 distinct font sizes, 46 border radii and 90 icon sizes — identical-looking
cards are 4pt apart depending on which import the author reached for. **Settle
this before any mechanical sweep**, or the sweep has no target.

### 4.8 The unlock spine ends at week 120
`featureUnlocks.ts`: `if (prestiged || weeksLived >= 120) return 5;` — every app,
tab and system is unlocked by week 120 or $200k net worth. There is nothing left
to reveal for the remaining ~4,000 weeks of a life.

---

## 5. Where the game flattens

Verified against the live `incomeScale` model and the content catalogs.

| Week | What the player is doing | Money a constraint? |
|---:|---|---|
| 50 | 2 street jobs/week, get hired, buy a phone. Net worth $30–40k | **Hard yes** — cheapest property is $95,000 |
| 200 | Career ladder done, education running, first company | Yes |
| 500 | All properties, all companies, skill tree bought out. $20–30M | Mostly no |
| **900–1,100** | **← THE FLATTENING POINT** | **No** |
| 1,000–4,200 | Next Week with a portfolio | No |

At the flattening point the player owns all 5 companies (maxed for $12.0M
total), all 12 properties, all 20 skill nodes, and has had every system unlocked
since week 120. **Roughly 70% of a life is played after the game runs out of
things to give.**

Contributing hard numbers:
- **5 companies, one per type** — `company.ts` keys the company by
  `id: companyType`, so duplicates are impossible.
- **Nothing anywhere is gated on `prestigeLevel >= 2`.** Income multiplier caps
  at 1.5×, point multiplier caps at level 10, scenario gems pay out on the
  *first* prestige only. There is no answer to "why prestige a 5th time".
- **Legacy points**: accrual is quadratic (1,275 by week 500, 5,050 by week
  1,000) against a shop that costs **340 points total** and is bought out by
  week ~260. The currency is dead for 75% of a long life.
- **Ambitions**: 8, each consumed permanently across lives → inert after life 8.
- **The reward ladder ends around week 100.** The entire 5-chapter arc is worth
  ~$30k and ~400 gems. At week 50 a chapter reward is ~40% of net worth; at week
  500 the *entire remaining ladder* is 0.05% of it.
- **Events don't scale**: ~400 templates, flat amounts, max ±$150,000. A "$200
  unexpected bill" fires at $200M net worth.
- **The weekly decision budget never grows**: 40 energy/week from age 18 to 98.
  A billionaire has the same weekly action budget as a teenager.

### Built systems nobody can see
- `lib/automation/` — 7 files, ticked every week, **zero UI**. A player can never
  create a rule.
- `getDynastyTier` — 6 tiers with titles and descriptions, **zero consumers**. A
  working cross-life progression bar no player has ever seen.
- `calcWeeklyExpenses` — a 292-line expense model whose only caller is the HUD,
  computing a *different* number than the tick actually charges.
- `timeLimit` on all 23 scenarios — **never read by any code**.
- The 52-entry achievement array in `initialState.ts` — its `completed` flag has
  no writer.

---

## 6. Suggested order for the remaining work

1. **The interruption queue** (§4.1) and **the journal writer** (§4.2). Together
   these are the whole "noisy and confusing" complaint.
2. **Settle the token collision** (§4.7). Everything mechanical is blocked
   behind this one decision.
3. **Housing out of the investment app** (§4.6) — a week-1 need at a week-1
   location.
4. **Economy**: arrears coverage (§4.4), the ad-orb game-week gate (§4.5), and
   fold rental + luxury income into the tax base. Each needs `incomeScale`
   re-run and probably new ratchet floors.
5. **The feature roadmap** — see `game-feature-roadmap-2026-08-05.md`.
