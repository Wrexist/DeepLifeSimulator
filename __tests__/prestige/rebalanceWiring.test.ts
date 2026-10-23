/**
 * The 2026-08-23 wiring pass — every purchased effect the parallel audit
 * found dead or partial, pinned to its new consumer.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { applyStartingBonuses, getSkillGainMultiplier, getAchievementHunterPointsPerAchievement, getStartingEnergyRegenMultiplier } from '@/lib/prestige/applyBonuses';
import { SCENARIOS } from '@/lib/scenarios/scenarioDefinitions';
import { FEATURE_FLAGS } from '@/lib/config/featureFlags';
import { calculatePrestigePoints } from '@/lib/prestige/prestigePoints';
import { PRESTIGE_BONUSES, canPurchaseBonus } from '@/lib/prestige/prestigeBonuses';
import { heirStartingBonuses, LEGACY_UPGRADES } from '@/lib/legacy/legacyShop';
import { continueAsChild } from '@/lib/prestige/prestigeExecution';
import { RESIDENTIAL_CATALOG } from '@/lib/realEstate/catalog';
import { EDUCATION_PROGRAMS } from '@/lib/education/programs';
import { POLITICAL_APPOINTMENTS } from '@/lib/politics/appointments';
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');
const code = (rel: string) =>
  fs.readFileSync(path.join(repoRoot, rel), 'utf8');

describe('starting_real_estate - 12,000 points now grants an actual property', () => {
  it('grants the cheapest catalogue property to a fresh life', () => {
    // The killed pattern: filtering state.realEstate, which is [] on every
    // fresh life because state only holds properties the player bought.
    const fresh = createTestGameState({ realEstate: [] });
    const out = applyStartingBonuses(fresh, ['starting_real_estate']);
    const granted = (out.realEstate || []).find(p => p.owned);
    expect(granted).toBeDefined();
    expect(granted!.id).toBe(RESIDENTIAL_CATALOG[0].id);
    expect(granted!.purchasePrice).toBe(RESIDENTIAL_CATALOG[0].price);
    expect(granted!.currentValue).toBe(RESIDENTIAL_CATALOG[0].price);
  });

  it('grants nothing without the bonus (the control)', () => {
    const out = applyStartingBonuses(createTestGameState({ realEstate: [] }), []);
    expect((out.realEstate || []).some(p => p.owned)).toBe(false);
  });

  it('does not duplicate an already-owned copy', () => {
    const owned = createTestGameState({
      realEstate: [{ ...RESIDENTIAL_CATALOG[0], owned: true }],
    });
    const out = applyStartingBonuses(owned, ['starting_real_estate']);
    expect((out.realEstate || []).filter(p => p.id === RESIDENTIAL_CATALOG[0].id)).toHaveLength(1);
  });
});

describe('achievement_progress_multiplier (Achievement Hunter) - pays for every achievement claimed this life', () => {
  // getEarnedAchievementCount reads claimedProgressAchievements - the
  // collected-rewards ledger of THIS life, which prestige wipes.
  const stateWithAchievements = (n: number): GameState => ({
    ...createTestGameState(),
    claimedProgressAchievements: Array.from({ length: n }, (_, i) => `ach_${i}`),
  });
  const prestigeWith = (unlockedBonuses: string[], achievementsCreditedForPoints = 0) => ({
    ...createTestGameState().prestige!,
    unlockedBonuses,
    achievementsCreditedForPoints,
  });

  it('pays 25 points per claimed achievement per level, as its own breakdown line', () => {
    expect(getAchievementHunterPointsPerAchievement([])).toBe(0);
    expect(getAchievementHunterPointsPerAchievement(['achievement_progress_multiplier'])).toBe(25);
    expect(getAchievementHunterPointsPerAchievement(['achievement_progress_multiplier', 'achievement_progress_multiplier'])).toBe(50);

    const none = calculatePrestigePoints(stateWithAchievements(40), 0, prestigeWith([]));
    const l1 = calculatePrestigePoints(stateWithAchievements(40), 0, prestigeWith(['achievement_progress_multiplier']));
    expect(none.achievementHunterBonus).toBe(0);
    expect(l1.achievementHunterBonus).toBe(1_000);
    // The anti-farm base is the same with or without the bonus.
    expect(l1.achievementBonus).toBe(none.achievementBonus);
  });

  it('keeps paying in a later life: re-earning achievements is the hunt it sells', () => {
    // Every achievement already credited toward the base (peak reached in an
    // earlier life): the base pays nothing, the Hunter still pays.
    const result = calculatePrestigePoints(
      stateWithAchievements(10), 0,
      prestigeWith(['achievement_progress_multiplier', 'achievement_progress_multiplier'], 10),
    );
    expect(result.achievementBonus).toBe(0);
    expect(result.achievementHunterBonus).toBe(500);
  });

  it('can pay back its price: level 1 (4,000) returns in about four 40-achievement lives', () => {
    const bonus = PRESTIGE_BONUSES.find((b) => b.id === 'achievement_progress_multiplier')!;
    const perLife = calculatePrestigePoints(stateWithAchievements(40), 0, prestigeWith(['achievement_progress_multiplier'])).achievementHunterBonus;
    expect(bonus.cost / perLife).toBeLessThanOrEqual(4);
    // The old +20% rule's whole-game ceiling, for the record: 160 x 10 x 20%.
    expect(160 * 10 * 0.2).toBeLessThan(bonus.cost / 10);
  });

  it('the bonus total includes it', () => {
    const none = calculatePrestigePoints(stateWithAchievements(20), 0, prestigeWith([]));
    const l1 = calculatePrestigePoints(stateWithAchievements(20), 0, prestigeWith(['achievement_progress_multiplier']));
    // 20 x 25 = 500 before the prestige multiplier (>= 1), so at least 500.
    expect(l1.total - none.total).toBeGreaterThanOrEqual(500);
  });
});

describe('skill_gain_multiplier - now feeds pursuit XP', () => {
  it('the pursuit action reads the prestige multiplier (source pin)', () => {
    const src = code('contexts/game/actions/PursuitActions.ts');
    expect(src).toMatch(/getSkillGainMultiplier/);
    expect(src).toMatch(/prestigeSkillMult/);
  });

  it('the getter still answers 1.2 with the bonus, 1.0 without', () => {
    expect(getSkillGainMultiplier(['skill_gain_multiplier'])).toBe(1.2);
    expect(getSkillGainMultiplier([])).toBe(1.0);
  });
});

describe('social bonuses reach the dating paths (source pin)', () => {
  it('date and gift gains both consult the prestige relationship multiplier', () => {
    const src = code('contexts/game/actions/DatingActions.ts');
    expect(src.match(/getRelationshipGainMultiplier/g)!.length).toBeGreaterThanOrEqual(2);
  });
});

describe('repurchase sink closed - boolean bonuses cap at one copy', () => {
  const BOOLEAN_IDS = [
    'starting_reputation', 'starting_energy', 'skill_gain_multiplier',
    'stat_decay_reduction', 'auto_save_energy', 'auto_manage_properties',
    'auto_invest_dividends', 'increased_energy_regen', 'reduced_event_frequency',
    'early_item_access', 'early_real_estate',
  ];

  it('every include()-style bonus carries a maxLevel', () => {
    for (const id of BOOLEAN_IDS) {
      const bonus = PRESTIGE_BONUSES.find(b => b.id === id)!;
      expect(`${id}: ${bonus.maxLevel}`).toBe(`${id}: 1`);
    }
  });

  it('a second copy is refused', () => {
    for (const id of BOOLEAN_IDS) {
      const bonus = PRESTIGE_BONUSES.find(b => b.id === id)!;
      expect(canPurchaseBonus(bonus, [id])).toBe(false);
      expect(canPurchaseBonus(bonus, [])).toBe(true);
    }
  });
});

describe('legacy buffs finally have a writer', () => {
  it('the shop sells the mentor and the charm', () => {
    expect(LEGACY_UPGRADES.some(u => u.effect.kind === 'buff' && u.effect.buff === 'mentor')).toBe(true);
    expect(LEGACY_UPGRADES.some(u => u.effect.kind === 'buff' && u.effect.buff === 'luckyCharm')).toBe(true);
  });

  it('heirStartingBonuses carries them as week durations', () => {
    const out = heirStartingBonuses(['legacy_mentor', 'legacy_heirloom_charm']);
    expect(out.buffs.mentor).toBe(104);
    expect(out.buffs.luckyCharm).toBe(104);
    expect(heirStartingBonuses([]).buffs).toEqual({});
  });

  it('the heir path dates expiry from the HEIR\'s weeksLived, not week 0', () => {
    // Was a source pin (seed line before stamp line). It is behavioural now:
    // the 2026-10-17 heir-bonus defect showed a pin on line ORDER passes while
    // a later line discards the result. A 30-year-old heir starts at
    // weeksLived 624 (§4.2), so a buff stamped before the seed would read 104.
    const base = createTestGameState();
    const parent: GameState = {
      ...base,
      weeksLived: 2_600,
      legacyUpgrades: ['legacy_education', 'legacy_tutors', 'legacy_mentor'],
      family: {
        ...base.family,
        children: [{
          id: 'kid', name: 'Kid Tester', type: 'child', relationshipScore: 80,
          personality: 'calm', gender: 'male', age: 30,
        }],
      },
    };
    const heir = continueAsChild(parent, 'kid');

    expect(heir.weeksLived).toBe(624);
    expect(heir.legacyBuffs?.mentor?.expiresWeeksLived).toBe(624 + 104);
  });
});

describe('familyBusinesses survive the reset path (source pin)', () => {
  it('createResetGameState carries them without a generation increment', () => {
    const src = code('lib/prestige/prestigeExecution.ts');
    const resetIdx = src.indexOf('function createResetGameState');
    const heirIdx = src.indexOf('generationsHeld: (fb.generationsHeld || 0) + 1');
    const carryIdx = src.indexOf('newState.familyBusinesses = oldState.familyBusinesses.map(fb => ({ ...fb }))');
    expect(carryIdx).toBeGreaterThan(resetIdx);
    expect(carryIdx).toBeLessThan(heirIdx);
  });
});

describe('every education id referenced by a gate exists in the catalogue', () => {
  // The law_degree-vs-law_school class: an id in no catalogue is a gate nobody
  // can ever pass. Cross-check the appointment requirements (where the Federal
  // Judge sat unobtainable) against the programme catalogue.
  const programIds = new Set(EDUCATION_PROGRAMS.map(p => p.id));

  it('political appointments', () => {
    for (const post of POLITICAL_APPOINTMENTS) {
      for (const eduId of post.requirements.education ?? []) {
        expect(`${post.id} requires ${eduId}: ${programIds.has(eduId)}`)
          .toBe(`${post.id} requires ${eduId}: true`);
      }
    }
  });
});

describe('Vigorous Start - the half that works on every path (2026-08-23)', () => {
  it('boosts regen +25% during the first year of a life', () => {
    expect(getStartingEnergyRegenMultiplier(['starting_energy'], 0)).toBeCloseTo(1.25, 10);
    expect(getStartingEnergyRegenMultiplier(['starting_energy'], 51)).toBeCloseTo(1.25, 10);
  });

  it('expires after the first year, and needs the bonus', () => {
    expect(getStartingEnergyRegenMultiplier(['starting_energy'], 52)).toBe(1.0);
    expect(getStartingEnergyRegenMultiplier([], 0)).toBe(1.0);
  });

  it('windowed on weeks into THIS life, wired into the regen line (source pin)', () => {
    // The regen is composed once in lib/economy/energyRegen.ts (TICK2-2), and
    // the tick reads it from the pre-tick state.
    const regen = code('lib/economy/energyRegen.ts');
    expect(regen).toMatch(/getStartingEnergyRegenMultiplier\(/);
    expect(regen).toMatch(/weeksSinceLifeStart\(state\.weeksLived \|\| 0, state\.lifeStartWeek\)/);
    expect(code('contexts/game/GameActionsContext.tsx')).toMatch(/weeklyEnergyRegen\(prevState\)/);
  });
});

describe('scenario rewards carry no dead fields (2026-08-23)', () => {
  it('every rewards object holds gems only', () => {
    for (const scenario of SCENARIOS) {
      const keys = Object.keys(scenario.rewards ?? {});
      expect(`${scenario.id}: ${keys.sort().join(',')}`).toBe(`${scenario.id}: ${keys.length ? 'gems' : ''}`);
    }
  });
});

describe('the zero-reader feature flags stay deleted (2026-08-23)', () => {
  it('analytics / bootBreadcrumbs / weeklyEvents are gone from FEATURE_FLAGS', () => {
    const flags = FEATURE_FLAGS as Record<string, unknown>;
    expect(flags.analytics).toBeUndefined();
    expect(flags.bootBreadcrumbs).toBeUndefined();
    expect(flags.weeklyEvents).toBeUndefined();
  });
});
