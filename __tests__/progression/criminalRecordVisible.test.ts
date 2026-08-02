/**
 * Phase 2A — the criminal record was invisible.
 *
 * `wantedLevel` had 38 references in logic and ZERO in any component. It is not
 * a bookkeeping counter: street work raises it, and it then does three things
 * to the player, none of which were stated anywhere.
 *
 *   1. Illegal jobs get riskier    +3%/level arrest chance, cap 25%
 *   2. LEGITIMATE hiring suffers   −(criminalLevel×5 + wantedLevel×2)%, cap 30%
 *   3. Crises quadruple            0.2 vs 0.05 while any wanted level stands
 *
 * The second is the one that actually hurts and the least guessable: career
 * applications quietly fail more often, with the cause sitting in a
 * street-crime stat on another screen.
 *
 * What settled it as a bug rather than deliberate opacity: the game ALREADY
 * displays the direct analogue. `lib/darkweb/heat.ts` says in its own header
 * that heat "replaces the binary wantedLevel ticker", and heat has a band, a
 * label and a meter. But heat only ever covered dark-web work — street crime
 * kept feeding `wantedLevel`, which nothing showed.
 *
 * Same fix shape as the company income multiplier: ONE exported helper that
 * both the rules and the screen read, so the number displayed is the number
 * applied.
 */
import {
  summarizeCriminalRecord,
  wantedArrestBonus,
  hiringPenalty,
  wantedBand,
  MAX_WANTED_ARREST_BONUS,
  MAX_HIRING_PENALTY,
} from '@/lib/crime/criminalRecord';
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');
const code = (rel: string) =>
  fs.readFileSync(path.join(repoRoot, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the arithmetic matches what the rules always did', () => {
  it('arrest bonus is +3 per wanted level on illegal work', () => {
    expect(wantedArrestBonus(0, true)).toBe(0);
    expect(wantedArrestBonus(4, true)).toBe(12);
  });

  it('and caps, so a long record cannot make illegal work impossible', () => {
    expect(wantedArrestBonus(1000, true)).toBe(MAX_WANTED_ARREST_BONUS);
  });

  it('LEGAL work is untouched by the wanted level (the control)', () => {
    // The old inline expression was `job.illegal ? … : 0`. If this ever
    // returned non-zero, honest work would inherit a criminal's arrest odds.
    expect(wantedArrestBonus(9, false)).toBe(0);
  });

  it('hiring penalty combines both levels and caps at 30', () => {
    expect(hiringPenalty(2, 3)).toBe(2 * 5 + 3 * 2);
    expect(hiringPenalty(100, 100)).toBe(MAX_HIRING_PENALTY);
  });

  it('a clean record costs nothing at all (the control)', () => {
    const clean = summarizeCriminalRecord(0, 0);

    expect(clean.arrestBonusPct).toBe(0);
    expect(clean.hiringPenaltyPct).toBe(0);
    expect(clean.raisesCrisisRate).toBe(false);
    expect(clean.band).toBe('clean');
  });

  it('garbage input degrades to a clean record rather than NaN', () => {
    // This feeds a displayed percentage; NaN% on screen is worse than 0.
    for (const bad of [undefined, null, NaN, Infinity, -5, 'lots']) {
      const s = summarizeCriminalRecord(bad, bad);
      expect(Number.isFinite(s.arrestBonusPct)).toBe(true);
      expect(Number.isFinite(s.hiringPenaltyPct)).toBe(true);
    }
  });

  it('bands escalate with the level', () => {
    expect(wantedBand(0)).toBe('clean');
    expect(wantedBand(1)).toBe('known');
    expect(wantedBand(5)).toBe('wanted');
    expect(wantedBand(20)).toBe('hunted');
  });
});

describe('the rules and the screen read the SAME helper', () => {
  it('JobActions no longer inlines the arithmetic', () => {
    // A screen that recomputed these independently would drift — which is
    // precisely the bug this is modelled on (the company income multiplier).
    const src = code('contexts/game/actions/JobActions.ts');

    expect(src).toMatch(/wantedArrestBonus\(wantedLevel, !!job\.illegal\)/);
    expect(src).toMatch(/hiringPenalty\(criminalLevel, wantedLevel\)/);
    expect(src).not.toMatch(/Math\.min\(25, wantedLevel \* 3\)/);
    expect(src).not.toMatch(/Math\.min\(30, criminalLevel \* 5 \+ wantedLevel \* 2\)/);
  });

  it('and the Street Jobs screen states all three costs', () => {
    const src = code('app/(tabs)/work.tsx');

    expect(src).toMatch(/summarizeCriminalRecord\(gameState\.wantedLevel, gameState\.criminalLevel\)/);
    expect(src).toMatch(/chance of being caught on illegal work/);
    expect(src).toMatch(/legitimate job applications/);
    expect(src).toMatch(/record\.raisesCrisisRate/);
  });

  it('and shows nothing at all for a clean player (the control)', () => {
    // A permanent red panel on a first-week character would be its own bug —
    // the card is a consequence, not decoration.
    expect(code('app/(tabs)/work.tsx'))
      .toMatch(/record\.wantedLevel > 0 \|\| record\.criminalLevel > 0 \? \(/);
  });
});
