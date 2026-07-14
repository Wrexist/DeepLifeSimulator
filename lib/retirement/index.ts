/**
 * Retirement & Elder endgame — public surface.
 *
 * Pure logic for the ~65+ life chapter, built on the existing aging/income/
 * death/legacy systems (it extends them; it adds no punishing decay):
 *   • pension.ts        — retire eligibility, pension formula, retire reducer,
 *                         weekly retirement income (canonical stats.money path).
 *   • elderActivities.ts — age-gated elder activities (cost/cooldown, bounded fx).
 *   • legacySummary.ts   — elder legacy-planning read model (reuses inheritance).
 *   • constants.ts       — balance tuning.
 */
export * from './constants';
export * from './pension';
export * from './elderActivities';
export * from './legacySummary';
