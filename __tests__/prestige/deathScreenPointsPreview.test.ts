/**
 * F1 / F2 — the death screen quoted a prestige-points figure the game does not
 * award, and carried an unreachable second path to end the same life.
 *
 * F1. The "Prestige Points Earned" preview computed its own number:
 *
 *     (netWorth / 10000) + (weeksLived / 5) + (achievements * 20)
 *       + (prestigeLevel * 100)
 *
 * `calculatePrestigePoints` — the function that actually awards them — shares
 * not one term with that. The preview invented a `weeksLived / 5` term and a
 * flat `prestigeLevel * 100`; it paid DOUBLE per achievement and paid for every
 * achievement rather than only the newly credited ones (the anti-farm rule H-5
 * exists for); and it omitted the generation, age, career, property, company
 * and child bonuses, the 1.1^level multiplier and the +25% child-path bonus
 * entirely.
 *
 * This is the number shown at the exact moment the player decides whether to
 * prestige, and `PrestigeModal` was already calling the real function — so the
 * two screens quoted different figures for the same decision.
 *
 * F2. `PrestigeModal` was rendered in `DeathPopup` with
 * `visible={showPrestigeModal}` against a state nothing ever set to true.
 * Unreachable dead wiring — and it must STAY unreachable: the modal calls
 * `executePrestige(path, childId)` on confirm, which rebuilds the save, and the
 * death screen already owns that transition through `startNewLifeFromLegacy`
 * and the heir picker. Two live competing paths to end one life is how the heir
 * flow loses a save.
 *
 * 2026-08-01 audit round 4.
 */
import fs from 'fs';
import path from 'path';
import { calculatePrestigePoints } from '@/lib/prestige/prestigePoints';
import { defaultPrestigeData } from '@/lib/prestige/prestigeTypes';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'DeathPopup.tsx'),
  'utf8',
);
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** The formula the preview used to use, kept here so the gap is measurable. */
const oldPreviewFormula = (
  netWorth: number,
  weeksLived: number,
  achievements: number,
  prestigeLevel: number,
): number =>
  Math.floor((netWorth / 10000) + (weeksLived / 5) + (achievements * 20) + (prestigeLevel * 100));

describe('F1 - the preview quotes the real award', () => {
  it('calls calculatePrestigePoints rather than reimplementing it', () => {
    expect(CODE).toMatch(/const earnedPoints = calculatePrestigePoints\(/);
  });

  it('no trace of the invented terms remains', () => {
    // `weeksLived / 5` and `prestigeLevel * 100` appear nowhere in
    // `calculatePrestigePoints`; they were this preview's own inventions.
    expect(CODE).not.toMatch(/weeksLived \/ 5/);
    expect(CODE).not.toMatch(/prestigeLevel \* 100/);
    expect(CODE).not.toMatch(/totalNetWorth \/ 10000/);
  });

  it('passes the live prestige data, not a hardcoded level', () => {
    expect(CODE).toMatch(/gameState\.prestige \|\| defaultPrestigeData/);
  });

  it('the two formulas really did disagree (the premise)', () => {
    // If they had agreed, this would be a tidy-up rather than a finding. A
    // mid-life player with two prior prestiges is an ordinary case.
    const state: GameState = createTestGameState({
      weeksLived: 1_500,
      generationNumber: 3,
      date: { ...createTestGameState().date, age: 62 },
    });
    const prestigeData = { ...defaultPrestigeData, prestigeLevel: 2, totalPrestiges: 2 };
    const netWorth = 4_500_000;

    const real = calculatePrestigePoints(state, netWorth, prestigeData, 'reset').total;
    const old = oldPreviewFormula(netWorth, 1_500, 0, 2);

    // 950 previewed against 658 awarded — a 44% overstatement, and in the
    // direction that matters: the player is promised more than they receive.
    expect(old).toBeGreaterThan(real);
    expect(old - real).toBeGreaterThan(real * 0.25);
  });

  it('the real formula is the one that pays, and it is not linear in net worth', () => {
    // The old preview divided net worth by 10,000 continuously; the real one
    // floors per MILLION, so a $999,999 life previews 99 points and is awarded
    // 0. That gap lands hardest on the players closest to the decision.
    const state = createTestGameState();
    const justUnder = calculatePrestigePoints(state, 999_999, defaultPrestigeData, 'reset');
    const justOver = calculatePrestigePoints(state, 1_000_001, defaultPrestigeData, 'reset');

    expect(justOver.basePoints - justUnder.basePoints).toBe(100);
    expect(oldPreviewFormula(999_999, 0, 0, 0)).toBeGreaterThan(justUnder.total);
  });

  it('the preview and PrestigeModal now agree', () => {
    // The control that matters: both surfaces must quote one number.
    const modalSrc = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'PrestigeModal.tsx'), 'utf8',
    );

    expect(modalSrc).toMatch(/calculatePrestigePoints\(/);
    expect(CODE).toMatch(/calculatePrestigePoints\(/);
  });
});

describe('F2 - the death screen has exactly one path to end the life', () => {
  it('does not render PrestigeModal', () => {
    expect(CODE).not.toMatch(/<PrestigeModal/);
  });

  it('carries no dead state or handler for it', () => {
    expect(CODE).not.toMatch(/showPrestigeModal/);
    expect(CODE).not.toMatch(/handleHidePrestige/);
  });

  it('does not import it either', () => {
    expect(CODE).not.toMatch(/import PrestigeModal/);
  });

  it('the modal really does execute a prestige (why it must stay out)', () => {
    // The premise for keeping it unreachable rather than wiring a button: it
    // rebuilds the save on confirm, and this screen already owns that.
    const modalSrc = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'PrestigeModal.tsx'), 'utf8',
    );

    expect(modalSrc).toMatch(/executePrestige\(selectedPath, selectedChildId\)/);
  });

  it('the death screen still has its own transition (the control)', () => {
    // Removing the dead modal must not have removed the real path.
    expect(CODE).toMatch(/startNewLifeFromLegacy/);
  });
});
