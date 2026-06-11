# DeepLife Simulator — Consolidated Bug/Exploit/Fun Audit (June 11, 2026)

Six parallel audits: economy/exploits, crash & state, save/load, prestige, jail/soft-lock, new-user fun.
Baseline: all 2356 tests pass; the real 500-week loop ends ~$723 @ age 27 (default loop not trivially exploitable).

Severity legend: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low

---

## ✅ ALREADY FIXED (committed)
- FirstWeekGuide never showed correctly (age-18 blank / age-20+ hidden). 🟠
- jailWeeks could overshoot the 52-week cap at non-nextWeek write-sites. 🟡
- Jail screens crash on partial save (unguarded `educations.find`). ⚪
- CLAUDE.md STATE_VERSION doc drift (18 → 19). ⚪

---

## TIER A — Economy exploits (game-breaking)
- 🔴 **C-1 Banking money printer.** `checking-default` is a weekly 1:1 mirror of `stats.money`; `withdrawCashFromAccount` credits `stats.money` then the mirror is re-synced next week → repeatable free cash. Same desync makes loan/card payments from checking cost nothing (**H-1**) and lets card rewards be farmed (**M-5**). Fix is UI-aware (the Bank UIs use checking as the payment source) → route payments through `stats.money`, make deposit/withdraw on mirrored accounts correct or hide them. *Files: BankingActions.ts, LoanActions.ts, lib/banking/operations.ts, weeklyTick.ts, components/{mobile,computer}/*BankApp.*
- 🟠 **H-2 Free infinite mining.** `applyMiningCryptos` credits mined crypto but never debits the computed `totalPowerCost`; durability never reduces yield.
- 🟠 **H-3 Crypto staking printer.** 2–5% **per week** with full principal refund (~14×/yr), uncapped. Rates read as annual mislabeled weekly. (`MiningActions.ts`)
- 🟠 **H-4 Risk-free dark-web job grinding.** Stage failure only resets progress + adds (decaying) heat — no cash/jail/cooldown. Brute-force any payout. (`lib/darkweb/operations.ts`, `CrimeActions.ts`)
- 🟠 **H-5 Prestige-point farming.** `basePoints` from *total* (partly inherited) net worth + achievement bonus recomputed from cumulative achievements each reset = double-counting across resets.
- 🟡 **M-1** Repeatable unsecured-debt discharge via flat 0.5 BTC new identity. **M-2** content income decay keyed to array index not elapsed weeks. **M-3** loan DTI uses stale weeklyPayment, no max-loan cap. **M-6** mining auto-repair undercharged. **M-7** real-estate down-payment floored instead of rejected.
- ⚪ L-1 crypto round-trip has no commission · L-3 same-week dividend capture · L-4 crypto/stock tax dodge · L-5 uncapped perk income product · L-6 Airbnb variance pinned to 2× cap.

## TIER B — Crash / save corruption (handle with save-system-auditor care)
- 🔴 **C1 Migration-skip crash.** Save path re-stamps a half-migrated save's `version` up to current, so skipped migrations never run → later undefined-nested-field crash. Fix: save path must never advance its own version.
- 🟠 **H1 repairGameState** doesn't backfill nested `banking`/`darkWeb`/`cryptoMarket` → crash on partial corruption (esp. CloudSync apply path).
- 🟠 **H2 Validator drift.** `validateGameEntry` requires arrays `repairGameState` doesn't create → a save that saved fine won't load (locked out). Fix: one shared `REQUIRED_ARRAY_FIELDS`.
- 🟠 **H3 Vaccination state corruption** — one overloaded local conflates `diseaseImmunities` and `vaccinations`.
- 🟡 **M-4 Prestige gate is UI-only** (`executePrestige` has no internal net-worth gate; `prestigeAvailable` never set true). Contained fix: re-validate inside `executePrestige`.
- 🟡 **M2** dark-web raids extend jail while already jailed (no `inJail` guard). **M1-crash** `curable:false` diseases = scripted death with misleading "seek treatment" UI.
- ⚪ L2/L3/L4 finite-guard gaps (vehicle price, diet cost, mining credit) → money NaN on already-corrupt input · L5 jailWeeks not clamped in save repair · L7 (fixed) · L8 revive cost constant.

## TIER D — Fun / balance (product decisions)
- 🟠 Energy regen +30/wk starves the loop after week 1 (~1–2 jobs/wk). Suggest ~50–55 early-game.
- 🟠 $900 smartphone wall delays the whole Mobile half of the game ~3–4 weeks for no-phone "Easy" starts. Suggest ~$600 or a starter phone.
- 🟠 FirstWeekGuide step `reward` fields are declared but never granted; the guide points to a non-existent "Challenges tab" and `utils/dailyChallenges.ts` is rendered nowhere. Wire up or remove.
- 🟡 Earliest achievements (first_dollar/job/purchase) grant 0 gems — flat first milestones. Day-1 login gem reward is gated behind tutorial completion. First money goal ($200) is pre-satisfied by several scenarios. Non-illegal street jobs drain happiness/health hard.

---

### Recommended order
1. 🔴 C-1/H-1 banking printer (worst exploit) — focused, tested, save-auditor review.
2. 🟠 Quick-win exploit hardening: H-2 mining cost, M-4 prestige gate, H-3 staking rate — small, contained.
3. 🔴/🟠 Save robustness: C1 version-stamp + H1/H2 repair/validator unification — one careful batch.
4. 🟠 Fun batch: energy regen + smartphone price + wire/remove the guide rewards & daily challenges.
5. Remaining mediums/lows as cleanup.
