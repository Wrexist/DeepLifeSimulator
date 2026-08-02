/**
 * What a criminal record actually costs — in one place, so it can be SHOWN.
 *
 * `wantedLevel` and `criminalLevel` were read in three separate places inside
 * `JobActions`, each with its own inline arithmetic, and displayed in exactly
 * zero components. A player accumulating a wanted level from street work had no
 * way to see it, and no way to connect it to the three things it was doing to
 * them:
 *
 *   1. Illegal jobs get riskier    +3% arrest chance per wanted level, cap 25%
 *   2. LEGITIMATE hiring suffers   −(criminalLevel×5 + wantedLevel×2)% on job
 *                                  application acceptance, cap 30%
 *   3. Life goes wrong more often  the personal-crisis rate is 0.2 with any
 *                                  wanted level against 0.05 without — a 4×
 *                                  swing (`lib/events/personalCrises.ts`)
 *
 * The second is the one that actually hurts, and it is the least guessable:
 * career applications quietly fail more often, with the cause buried in a
 * street-crime stat on another screen.
 *
 * This matters more than "a stat is hidden" because the game already displays
 * the direct analogue. The dark web's `heat` — which `lib/darkweb/heat.ts` says
 * in its own header "replaces the binary wantedLevel ticker" — has a band, a
 * label and a meter. `heat` only ever covered dark-web work; street crime keeps
 * feeding `wantedLevel`, which stayed invisible.
 *
 * Exporting the arithmetic means the UI cannot drift from the rules. A screen
 * that recomputed these numbers independently would be the same bug one layer
 * up — which is exactly what happened with the company income multiplier.
 */

/** Max extra arrest chance from a wanted level, in percentage points. */
export const MAX_WANTED_ARREST_BONUS = 25;
/** Extra arrest chance per wanted level, in percentage points. */
export const ARREST_BONUS_PER_WANTED = 3;
/** Max hiring penalty from a criminal background check, in percentage points. */
export const MAX_HIRING_PENALTY = 30;
/** Hiring penalty per criminal level / per wanted level, in percentage points. */
export const HIRING_PENALTY_PER_CRIMINAL_LEVEL = 5;
export const HIRING_PENALTY_PER_WANTED_LEVEL = 2;

const safe = (n: unknown): number =>
  typeof n === 'number' && isFinite(n) && n > 0 ? n : 0;

/**
 * Extra chance of being caught on an ILLEGAL job, in percentage points.
 * Legal work is unaffected — pass `illegal: false` and this is 0.
 */
export function wantedArrestBonus(wantedLevel: unknown, illegal: boolean): number {
  if (!illegal) return 0;
  return Math.min(MAX_WANTED_ARREST_BONUS, safe(wantedLevel) * ARREST_BONUS_PER_WANTED);
}

/**
 * How much a background check costs a LEGITIMATE job application, in
 * percentage points off the acceptance chance.
 */
export function hiringPenalty(criminalLevel: unknown, wantedLevel: unknown): number {
  return Math.min(
    MAX_HIRING_PENALTY,
    safe(criminalLevel) * HIRING_PENALTY_PER_CRIMINAL_LEVEL
      + safe(wantedLevel) * HIRING_PENALTY_PER_WANTED_LEVEL,
  );
}

export type WantedBand = 'clean' | 'known' | 'wanted' | 'hunted';

/** A label for the wanted level, mirroring how dark-web heat presents itself. */
export function wantedBand(wantedLevel: unknown): WantedBand {
  const w = safe(wantedLevel);
  if (w <= 0) return 'clean';
  if (w < 4) return 'known';
  if (w < 9) return 'wanted';
  return 'hunted';
}

export function wantedBandLabel(band: WantedBand): string {
  switch (band) {
    case 'clean': return 'No record';
    case 'known': return 'Known to police';
    case 'wanted': return 'Wanted';
    case 'hunted': return 'Actively hunted';
  }
}

export interface CriminalRecordSummary {
  wantedLevel: number;
  criminalLevel: number;
  band: WantedBand;
  bandLabel: string;
  /** Extra arrest chance on illegal work, percentage points. */
  arrestBonusPct: number;
  /** Acceptance lost on legitimate job applications, percentage points. */
  hiringPenaltyPct: number;
  /** True while any wanted level is outstanding — quadruples the crisis rate. */
  raisesCrisisRate: boolean;
}

/** Everything a screen needs to explain the record, derived from the same rules. */
export function summarizeCriminalRecord(
  wantedLevel: unknown,
  criminalLevel: unknown,
): CriminalRecordSummary {
  const w = safe(wantedLevel);
  const c = safe(criminalLevel);
  const band = wantedBand(w);
  return {
    wantedLevel: w,
    criminalLevel: c,
    band,
    bandLabel: wantedBandLabel(band),
    arrestBonusPct: wantedArrestBonus(w, true),
    hiringPenaltyPct: hiringPenalty(c, w),
    raisesCrisisRate: w > 0,
  };
}
