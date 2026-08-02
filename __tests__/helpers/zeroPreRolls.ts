/**
 * A `PreRolls` with every roll pinned to its zero/empty value.
 *
 * The week tick's subsystems read their randomness from a `PreRolls` bag built
 * once per tick, so any test driving a subsystem has to supply one. Tests were
 * inlining the whole literal — twelve copies in `subsystemEquivalence` alone,
 * plus one more in `relationshipHealthWrap`.
 *
 * That is not merely repetitive. When `luxuryIncident` was added to `PreRolls`,
 * every one of those literals went stale at the same moment, and because they
 * sit inside a `WeekContext` object (sometimes behind an `as WeekContext` cast
 * that hides the error entirely) the subsystems under test simply read
 * `undefined` for that roll while the suites stayed green. A test cannot prove
 * anything about a roll it never supplies.
 *
 * One factory means the next field added to `PreRolls` breaks compilation HERE,
 * once, instead of going quietly missing everywhere at the same time.
 */
import type { PreRolls } from '@/contexts/game/actions/weekly/preTick';

export function zeroPreRolls(overrides: Partial<PreRolls> = {}): PreRolls {
  return {
    careerAcceptDelay: 1,
    stockPickRoll: 0,
    childGender: 'male',
    childIdSuffix: 'x',
    childPersonality: 0,
    relBreakup: [],
    relDisappointed: [],
    policeEncounter: 0,
    minerDegradation: 0,
    diseaseComplication: [],
    diseaseProgression: [],
    petSickness: [],
    petSicknessType: [],
    vehicleAccident: [],
    vehicleAccidentSeverity: [],
    luxuryIncident: [],
    timestamp: 0,
    ...overrides,
  };
}
