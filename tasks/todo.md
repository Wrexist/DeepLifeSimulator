# Plan — Income reads one number everywhere (BBQ: "conflicting numbers") — 2026-08-22 — DONE

## Report
Surgical Director, same save, three screens, three numbers:
- Promotion modal: **$26K/wk** (was $19.25K, +35%)
- Work tab job card: **$13000/wk** — with a "Manage Job (+100%)" button right under it
- Cash Flow → Income Sources: **Job Income: $13K**

## Root cause
`Career.levels[].salary` is a BASE figure. What payroll actually credits
(`contexts/game/actions/weekly/applyCareerSalaryAndPenalty.ts`) is that base times a
stack of multipliers, and every reader applied a different subset:

| reader | premium | work_boost | perks.workBoost | life skill | DeepLife+ | political ÷52 | jail |
|---|---|---|---|---|---|---|---|
| payroll (the truth) | ✓ | ✓ | ✓ | ✓ | ✓ | n/a (skipped) | ✓ |
| promotion modal (JobActions) | ✓ | — | — | — | — | — | — |
| CareerPathCard | ✓ | — | — | — | — | — | — |
| work.tsx card `reward` | — | — | — | — | — | — | — |
| IdentityCard `jobIncome` | — | — | — | — | — | — | — |
| ShareLifeCard | — | — | — | — | — | — | — |

$26K = 13000 × 2 (premium), $13000 = the raw base. Neither is what lands when the
player has a boost, a life skill or DeepLife+.

Second, worse bug on the same line: `IdentityCard.jobIncome` reads
`levels[level].salary` for **political** too, where the ladder is ANNUAL — a President
reads **$100,000/wk** instead of $1,923, and `passive` already counts the office pay,
so Cash Flow double-counts it at 52x. It also feeds `calcWeeklyExpenses`, so the tax
line is computed off that number.

## Steps
- [x] 1. `lib/careers/weeklySalary.ts`: add `careerPayMultiplier(state)` +
      `paidWeeklySalaryForLevel(state, career, level)` + `paidWeeklyCareerSalary(state)`
      — one implementation of "what payroll credits", political and jail included.
- [x] 2. `applyCareerSalaryAndPenalty.ts` calls it, so the truth and the readers cannot drift.
- [x] 3. `work.tsx` card `reward` + "Tops out" → paid figure.
- [x] 4. `IdentityCard` → paid figure; political pay counted ONCE (job line, netted out of passive).
- [x] 5. `JobActions.promoteCareer` promotion payload → paid figure.
- [x] 6. `CareerPathCard` (expanded + compact) → paid figure.
- [x] 7. `ShareLifeCard` → paid figure.
- [x] 8. Tests: new `__tests__/economy/paidWeeklySalary.test.ts` pinning payroll ≡ readers.
- [x] 9. type-check · type-check:tests · lint:errors · targeted suites.

## Verification
- `npm run type-check` ✓ · `type-check:tests` ✓ · `lint:errors` ✓ · `check:routes` ✓
- Full Jest: **620 suites / 8126 tests pass**, 308 snapshots, 1 skipped.
- New suite `__tests__/economy/paidWeeklySalary.test.ts` — 21 tests. Behavioural,
  not source-pattern: it runs `applyCareerSalaryAndPenalty` and asserts each
  reader equals the `careerSalary` the week loop returns, for the bare base, a
  maxed raise, each multiplier alone, all of them stacked, jail, unemployment,
  an out-of-range level, a corrupt salary and an out-of-cap stored premium.
- Two existing source-pattern suites went red on the refactor and were
  re-pointed at the new indirection rather than relaxed:
  `raisePremiumConsistency` (now also pins `lib/careers/weeklySalary.ts`, so the
  chain is covered end to end) and `playerReports20260802`.

## What the reported save now reads
Surgical Director, base 13000, raise premium at the +100% cap:
promotion modal **$26K/wk** · work card **$26K/wk** · Cash Flow **$26K** —
and `payrollCredits` returns 26000. The work card also switched to `formatMoney`,
so it reads "$26K/wk" rather than "$26000/wk".
