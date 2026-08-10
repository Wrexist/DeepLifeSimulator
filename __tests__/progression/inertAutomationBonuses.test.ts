/**
 * R4-X2 — five prestige bonuses whose system no longer exists.
 *
 * The prestige shop's catalogue still carries Auto-Invest (5,000), Auto-Pay
 * (4,000), Auto-Save (3,000), Auto-Renew (2,500) and Automation Slots (2,000,
 * stacking to five) — but they are hidden from the shop and refused by the
 * purchase action, because the system they unlocked was never reachable.
 *
 * **The engine is now deleted** (2026-08-06). `lib/automation/` — the rule
 * engine, its guards, its types and the four `auto*.ts` executors — read
 * `state.automation`, a key that was typed on `GameState` but was never in
 * `initialState.ts`, never migrated, never repaired and never written by
 * anything. `createDefaultAutomationState()`, the only writer, had zero
 * callers. So the tick's updater bailed on its first line
 * (`if (!prevState.automation) return prevState;`) for every save that has ever
 * existed. No STATE_VERSION bump was needed to remove it: no save carries the
 * key. All four rule types are already shipped by wired, tested,
 * UI-reachable subsystems — pay → `banking.billPayRules` + `applyLoanAutopay`,
 * save → `applySavingsGoals`, renew → `applySubscriptions`,
 * invest → `applyAutoReinvest`.
 *
 * What remains is the part that is still live and still easy to get wrong: the
 * five catalogue rows are kept (deleting them would strand the ids in the save
 * of anyone who bought one before they were inerted, and blank out their row in
 * the info modal), they must stay out of `PURCHASABLE_PRESTIGE_BONUSES`, the
 * purchase action must refuse one that reaches it anyway, and
 * `prestige_bonuses_all` must count the purchasable list — counting the full
 * catalogue would make a 25,000-point achievement that can never complete.
 *
 * 2026-08-01 audit round 4; engine deleted 2026-08-06.
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

const ROOT = path.join(__dirname, '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('R4-X2 — the premise', () => {
  it('the five ids are really in the catalogue, and priced', () => {
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

  it('the automation engine is gone, so nothing can quietly re-arm them', () => {
    // If `lib/automation/` ever comes back it must come back WITH a state
    // slice, a migration and a rule-builder UI — at which point INERT_BONUS_IDS
    // should be emptied and this file rewritten, not silently satisfied.
    expect(fs.existsSync(path.join(ROOT, 'lib', 'automation'))).toBe(false);
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
