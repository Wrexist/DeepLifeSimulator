/**
 * Parenting action loop — public surface.
 *
 * Children (ages 0-18) can be raised through age-appropriate parenting actions
 * that modestly and cumulatively raise their nurture stats. Those stats feed
 * the existing heir / prestige-child pipeline (childSimulation, childStats,
 * heirGeneration) which prefer them when present.
 */
export * from './types';
export * from './catalog';
export * from './parentingLogic';
