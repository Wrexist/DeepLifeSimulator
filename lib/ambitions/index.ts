/**
 * Life Ambitions — public barrel.
 *
 * A Life Ambition is a lifelong aspiration chosen at character creation: a
 * themed multi-stage goal for the whole life plus a one-time payoff on
 * fulfilment. Distinct from Scenarios (starting conditions), Mindsets
 * (per-transaction modifiers), and Challenges (constrained win-condition runs).
 */

export * from './types';
export { LIFE_AMBITIONS } from './catalog';
export {
  getAmbitionById,
  getAmbitionCompletion,
  reconcileReachedMilestones,
  reconcileAmbitionProgress,
  grantAmbitionPayout,
} from './progress';
