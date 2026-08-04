/**
 * R4-X2 — five prestige bonuses that unlock a system the player cannot reach.
 *
 * The prestige shop sells Auto-Invest (5,000), Auto-Pay (4,000), Auto-Save
 * (3,000), Auto-Renew (2,500) and up to five stacking Automation Slots (2,000
 * each, escalating 2.5x per level). Their capability checks are real —
 * `lib/automation/automationGuards.ts` reads every one of these ids, and the
 * week loop calls `processAutomationRules` every tick. Nothing downstream
 * exists:
 *
 *   - `automation` is not a field in `initialState.ts`, so `state.automation`
 *     is `undefined` for every player and the tick's execution block opens with
 *     `if (!prevState.automation) return prevState;`
 *   - nothing anywhere writes an automation RULE. No rule-builder UI, no
 *     action, no default rule set, no automation screen in `components/` or
 *     `app/` at all.
 *
 * So the engine runs weekly over an empty list on a slice that does not exist,
 * gated by unlocks the player paid five figures of prestige points for.
 *
 * Hidden rather than implemented — building a rule builder is a feature, not an
 * audit fix — and hidden rather than deleted, which is the same call R4-X7 made
 * for `INERT_POLICY_KEYS`: deleting the rows erases the record of what they
 * were for and strands the ids in the save of anyone who already bought one.
 *
 * The half that is easy to get wrong, and the reason this file exists: hiding
 * them from the shop while `prestige_bonuses_all` still counted the full
 * catalogue would swap a purchase that does nothing for a 25,000-point
 * achievement that can never complete.
 *
 * 2026-08-01 audit round 4.
 */
import fs from 'fs';
import path from 'path';
import {
  PRESTIGE_BONUSES,
  PURCHASABLE_PRESTIGE_BONUSES,
  INERT_BONUS_IDS,
  isInertBonus,
  getBonusById,
  getBonusesByCategory,
} from '@/lib/prestige/prestigeBonuses';
import {
  hasAutomationBonus,
  isAutomationEnabled,
  processAutomationRules,
  createDefaultAutomationState,
} from '@/lib/automation/automationEngine';
import { createTestGameState } from '../helpers/createTestGameState';

const ROOT = path.join(__dirname, '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('R4-X2 — the premise: automation is unreachable', () => {
  it('the five ids are really sold, and for real money', () => {
    for (const id of INERT_BONUS_IDS) {
      const entry = PRESTIGE_BONUSES.find((b) => b.id === id);
      expect(`${id}: ${!!entry}`).toBe(`${id}: true`);
      expect(entry!.cost).toBeGreaterThan(0);
    }

    const headline = INERT_BONUS_IDS
      .map((id) => PRESTIGE_BONUSES.find((b) => b.id === id)!.cost)
      .reduce((a, b) => a + b, 0);
    expect(headline).toBe(16_500);
  });

  it('`automation` is not seeded into initial state', () => {
    // This is the load-bearing fact. Without the slice the engine's own
    // execution block returns early for every player, forever.
    expect(createTestGameState().automation).toBeUndefined();
    expect(read('contexts/game/initialState.ts')).not.toMatch(/^\s*automation:\s*\{/m);
  });

  it('the tick bails when the slice is absent', () => {
    expect(read('contexts/game/GameActionsContext.tsx'))
      .toMatch(/if \(!prevState\.automation\) return prevState;/);
  });

  it('nothing in the app can create an automation rule', () => {
    // If a rule builder ever ships, this fails and whoever shipped it is told
    // to delete INERT_BONUS_IDS — which is the correct outcome.
    const uiFiles = [
      ...fs.readdirSync(path.join(ROOT, 'components')),
      ...fs.readdirSync(path.join(ROOT, 'app')),
    ];

    expect(uiFiles.some((f) => /^automation/i.test(f))).toBe(false);
  });

  it('the guards DO read the ids (which is why this looks wired)', () => {
    const guards = read('lib/automation/automationGuards.ts');
    for (const id of INERT_BONUS_IDS) {
      expect(`${id}: ${guards.includes(id)}`).toBe(`${id}: true`);
    }
  });

  it('a player who BOUGHT one still has automation switched off', () => {
    // The sharpest statement of the finding. The bonus is owned, the capability
    // predicate agrees it is owned, and the system is still off — not because
    // the purchase failed, but because `state.automation` does not exist.
    const owner = createTestGameState({
      prestige: { ...createTestGameState().prestige, unlockedBonuses: ['automation_auto_save'] },
    } as never);

    expect(hasAutomationBonus(owner, 'automation_auto_save')).toBe(true);
    expect(isAutomationEnabled(owner)).toBe(false);
    expect(processAutomationRules(owner)).toEqual([]);
  });

  it('there is a default-state factory, and nothing calls it', () => {
    // `createDefaultAutomationState` is the missing writer, sitting unused.
    // That is what "half-built" looks like from the inside.
    expect(typeof createDefaultAutomationState).toBe('function');
    expect(createDefaultAutomationState().rules).toEqual([]);

    const callers = ['contexts', 'components', 'app', 'utils', 'hooks']
      .flatMap((dir) => {
        const walk = (d: string): string[] =>
          fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
            e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
        return walk(path.join(ROOT, dir));
      })
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) => read(path.relative(ROOT, f)).includes('createDefaultAutomationState'));

    expect(callers).toEqual([]);
  });
});

describe('R4-X2 — they are out of the shop', () => {
  it('no category renders an inert bonus', () => {
    for (const category of ['starting', 'multiplier', 'unlock', 'qol', 'special'] as const) {
      for (const bonus of getBonusesByCategory(category)) {
        expect(`${category}/${bonus.id}: ${isInertBonus(bonus.id)}`)
          .toBe(`${category}/${bonus.id}: false`);
      }
    }
  });

  it('the purchasable list is the catalogue minus exactly those five', () => {
    expect(PURCHASABLE_PRESTIGE_BONUSES).toHaveLength(PRESTIGE_BONUSES.length - 5);
    for (const id of INERT_BONUS_IDS) {
      expect(`${id} purchasable: ${PURCHASABLE_PRESTIGE_BONUSES.some((b) => b.id === id)}`)
        .toBe(`${id} purchasable: false`);
    }
  });

  it('the purchase action refuses one even if the id reaches it', () => {
    // The shop is a render; this is the actual gate. A stale screen, a deep
    // link or the next caller that forgets must not be able to spend points.
    const src = read('contexts/game/MoneyActionsContext.tsx');

    expect(src).toMatch(/if \(isInertBonus\(bonusId\)\) \{/);
    expect(src).toMatch(/That bonus is not available yet\./);
  });
});

describe('R4-X2 — nothing already owned is broken (the controls)', () => {
  it('an already-purchased inert bonus still resolves by id', () => {
    // Anyone who bought one before this change must still see its real name
    // and description rather than a blank row.
    for (const id of INERT_BONUS_IDS) {
      const found = getBonusById(id);
      expect(`${id}: ${found?.name ?? 'MISSING'}`).not.toBe(`${id}: MISSING`);
    }
  });

  it('the ids stay in the catalogue rather than being deleted', () => {
    for (const id of INERT_BONUS_IDS) {
      expect(`${id} in catalogue: ${PRESTIGE_BONUSES.some((b) => b.id === id)}`)
        .toBe(`${id} in catalogue: true`);
    }
  });

  it('a normal bonus is still buyable and still rendered', () => {
    // The filter must not have emptied the shop.
    expect(getBonusesByCategory('qol').length).toBeGreaterThan(0);
    expect(isInertBonus('immortality')).toBe(false);
    expect(PURCHASABLE_PRESTIGE_BONUSES.some((b) => b.id === 'immortality')).toBe(true);
  });

  it('"unlock all bonuses" is measured against what the shop sells', () => {
    // The trade this whole change turns on: the achievement must stay
    // completable. Its behavioural proof lives in prestigeAchievements.test.ts;
    // this pins that it reads the right list.
    expect(read('lib/prestige/prestigeAchievements.ts'))
      .toMatch(/>= PURCHASABLE_PRESTIGE_BONUSES\.length/);
    expect(read('lib/prestige/prestigeAchievements.ts'))
      .not.toMatch(/>= PRESTIGE_BONUSES\.length/);
  });
});
