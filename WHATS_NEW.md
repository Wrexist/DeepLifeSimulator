# What's New: DeepLife Simulator

## Version 1.3.1: Smoothness & Stability Update

**Covers:** the user-reported Next Week freeze, a calmer and less-interruptive UI, and the bulk of a
five-domain audit (crashes, economy/balance, game logic, and save reliability).
**Compatibility:** all existing saves load with no breaking changes.

> Versioning note: this is the public release label **v1.3.1** (a fixes-and-polish release). Make
> sure the store "Version" field matches this when you submit the build.

---

## 📱 Store "What's New" (copy-paste ready)

```
v1.3.1: Smoothness and Stability

We squashed the "Next Week" freeze and a whole audit's worth of bugs. Smoother, calmer, fairer.

NO MORE FREEZE
- Fixed the Next Week hang several of you reported. Advancing a week is smooth now.
- Big performance pass: the dashboard no longer re-renders everything every week.
- Rarely-used screens now load on demand.

FEWER INTERRUPTIONS
- Health problems no longer interrupt you with popups on week advance. Your status now lives on your player card with clear how-to-fix tips (sickness details are still one tap away).
- Life moments and weekly "Heads Up" events are now much rarer.

CRASH FIXES
- Weekly auto-reinvest crash, an Android purchase loop, an un-dismissable popup, and several chart and saved-data edge cases are all fixed.

FAIRER, MORE REALISTIC ECONOMY
- Real-estate sales now have realistic closing costs and capital-gains tax; rental income nets upkeep.
- Fixed a maintenance-cost bug (was 50x too high).
- IPO double-credit, crypto fees, loan prepayment, an inflation cap, and mining tradeoffs are corrected.
- "Investment tip" is now a true double-or-nothing (it was quietly tilted in your favor).

LOGIC FIXES
- Multi-stage opportunities now pay out their real final stage.
- A deceased character no longer collects a final paycheck.
- Follow-up event chains actually fire now; exam and campus timing no longer drifts when you pause.

LEANER SAVES
- Capped comment threads, notifications, and casual friends in long games (family is always kept).

Thank you for the reports. Keep them coming.
Join the community: https://discord.gg/rzktazdX8v
```

---

## 📋 Full Release Notes

### ⚡ Performance: the "Next Week" freeze is gone

- **Fixed the Next Week freeze.** Advancing a week no longer waits on a hard 50 ms delay on every
  tap. The weekly update now captures the computed result and hands control back in a single step,
  so the button responds immediately.
- **No more full-dashboard re-render every week.** The home screen, player card (IdentityCard), and
  finance overview now subscribe only to the specific values they show (plus memoization), instead
  of re-rendering on every change to the whole game state.
- The player card's cash-flow breakdown is now computed only when you open it.
- Rarely-opened screens load on demand, and a stats-bar memo bug was fixed. It all adds up to
  noticeably smoother play, especially in long lifetimes.

### 🔔 Calmer, less-interruptive UI

- **Health no longer hijacks your week.** The auto popups on week advance (the zero-stat warning and
  the sickness modal) are gone. Health issues now surface passively on your player card, with clear
  guidance on how to fix them. You can still open full sickness details anytime from the disease
  badge in the top stats bar.
- **Far fewer interruptions.** Life moments and the weekly "Heads Up" events are now much rarer, for
  better pacing and fewer popups between you and the game.

### 🛡️ Crash & Soft-Lock Fixes

- Fixed a **weekly crash** caused by malformed stock holdings during auto-reinvest.
- Fixed an **Android purchase redelivery loop.** The purchase listener is now cleaned up properly
  and acknowledged transactions are finished, so purchases don't get stuck re-firing.
- Fixed a **soft-lock** where the life-moment popup couldn't be dismissed (added a proper close plus
  a fallback dismiss).
- Hardened the charts (divide-by-zero / NaN guards), added validation for parsed saved data, and
  fixed the back button on the ancestor profile screen.

### ⚖️ Economy & Balance (fairer and more realistic)

- **Real estate:** selling now includes realistic **closing costs and capital-gains tax**; rental
  income is now **net of upkeep**; and a maintenance-cost bug that overcharged by **50x** is fixed.
- **Business:** an IPO **double-tap could double-credit** your raise. It's now a single atomic
  update, and your business app's lifetime stats persist correctly.
- **Events:** the "investment tip" event is now a genuine **double-or-nothing** (it was secretly
  +25% expected value in your favor).
- **Banking & crypto:** crypto limit-buys now **reserve their fees**, bank/loan credits respect the
  money ceiling, and paying down a card now debits exactly the amount applied.
- **Long-game balance:** the inflation index is now **capped**, mining pools are a real tradeoff,
  rent-mode edge cases are guarded, and **prepaying a loan now shortens the term** instead of just
  lowering the payment.

### 🧩 Game-Logic Fixes

- **Multi-stage opportunities pay out fully.** Chains like `business_opportunity` now use their real
  stage count, so the final payout stage actually fires (a 4-stage chain was capped at 3).
- A **deceased character no longer banks** the final week's income.
- **Follow-up event chains now work.** 8 chains were effectively dead code; they fire now, and the
  event queue no longer grows unbounded.
- **Education** exam/campus cadence no longer drifts across pauses.
- **Mining** auto-repair is now charged against post-degradation durability (no more free repairs).
- Fixed a **disease bug** that could wipe out the death countdown on certain dual-symptom diseases.

### 💾 Save Reliability

- Capped `socialMedia` comment threads (both when writing and pruning) and notifications during
  pruning, so saves stay lean.
- Capped casual-friend relationships in long games. **Parents, partner/spouse, and children are
  always kept.**

---

## 🛠️ Developer Notes

Full technical breakdown (every finding with `file:line`, root cause, and fix) lives in
`tasks/audit-2026-06-21.md`. Work was partitioned by file ownership and run with parallel review
agents plus manual core-loop edits.

**Intentionally left unchanged (with rationale):**
- **Freebie reward events** (luckyCoin, mysteryPackage, scratchTicket, and similar) and **political
  money/reputation tradeoff events.** These are deliberate engagement design (the code comments call
  out "variable-ratio reinforcement") and are already low-frequency after the pacing change.
  Altering them would fight the intended design.
- **Impure `genId()` / `Date.now()` inside updaters.** Cosmetic only (IDs/timestamps on fresh
  objects, no state corruption); rewriting the call sites risked regressions for no behavior change.
- **Fully coalescing the conditional post-tick commits.** The common Next Week path is already a
  single commit after the freeze fix; the remaining commits are rare/conditional.

---

Thank you for playing and for the bug reports. They directly shaped this update.

**Join the community:** https://discord.gg/rzktazdX8v
