/**
 * The 2026-08-23 wiring pass — every purchased effect the parallel audit
 * found dead or partial, pinned to its new consumer.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { applyStartingBonuses, getSkillGainMultiplier, getAchievementProgressMultiplier, getStartingEnergyRegenMultiplier } from '@/lib/prestige/applyBonuses';
import { SCENARIOS } from '@/lib/scenarios/scenarioDefinitions';
import { FEATURE_FLAGS } from '@/lib/config/featureFlags';
import { calculatePrestigePoints } from '@/lib/prestige/prestigePoints';
import { PRESTIGE_BONUSES, canPurchaseBonus } from '@/lib/prestige/prestigeBonuses';
import { heirStartingBonuses, LEGACY_UPGRADES } from '@/lib/legacy/legacyShop';
import { RESIDENTIAL_CATALOG } from '@/lib/realEstate/catalog';
import { EDUCATION_PROGRAMS } from '@/lib/education/programs';
import { POLITICAL_APPOINTMENTS } from '@/lib/politics/appointments';
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');
const code = (rel: string) =>
  fs.readFileSync(path.join(repoRoot, rel), 'utf8');

describe('starting_real_estate — 12,000 points now grants an actual property', () => {
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

describe('achievement_progress_multiplier — now pays prestige points', () => {
  // getEarnedAchievementCount reads claimedProgressAchievements — the
  // collected-rewards ledger, which is what prestige points credit from.
  const stateWithAchievements = (n: number): GameState => ({
    ...createTestGameState(),
    claimedProgressAchievements: Array.from({ length: n }, (_, i) => `ach_${i}`),
  } as GameState);

  it('the getter finally has a real consumer, and it pays +20%/level', () => {
    const base = calculatePrestigePoints(
      stateWithAchievements(10), 0,
      { ...createTestGameState().prestige!, unlockedBonuses: [] },
    );
    const boosted = calculatePrestigePoints(
      stateWithAchievements(10), 0,
      { ...createTestGameState().prestige!, unlockedBonuses: ['achievement_progress_multiplier'] },
    );
    expect(getAchievementProgressMultiplier(['achievement_progress_multiplier'])).toBeCloseTo(1.2, 10);
    expect(boosted.achievementBonus).toBe(Math.round(base.achievementBonus * 1.2));
    expect(base.achievementBonus).toBeGreaterThan(0);
  });

  it('does not touch the anti-farm ledger — already-credited achievements still pay nothing', () => {
    const result = calculatePrestigePoints(
      stateWithAchievements(10), 0,
      {
        ...createTestGameState().prestige!,
        unlockedBonuses: ['achievement_progress_multiplier', 'achievement_progress_multiplier'],
        achievementsCreditedForPoints: 10,
      },
    );
    expect(result.achievementBonus).toBe(0);
  });
});

describe('skill_gain_multiplier — now feeds pursuit XP', () => {
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

describe('repurchase sink closed — boolean bonuses cap at one copy', () => {
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

  it('the heir path stamps expiry AFTER the weeksLived seed (source pin)', () => {
    const src = code('lib/prestige/prestigeExecution.ts');
    const seedIdx = src.indexOf('newState.weeksLived = computeWeeksLived(childAge);');
    const stampIdx = src.indexOf('expiresWeeksLived: newState.weeksLived + weeks');
    expect(seedIdx).toBeGreaterThan(-1);
    expect(stampIdx).toBeGreaterThan(seedIdx);
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

describe('Vigorous Start — the half that works on every path (2026-08-23)', () => {
  it('boosts regen +25% during the first year of a life', () => {
    expect(getStartingEnergyRegenMultiplier(['starting_energy'], 0)).toBeCloseTo(1.25, 10);
    expect(getStartingEnergyRegenMultiplier(['starting_energy'], 51)).toBeCloseTo(1.25, 10);
  });

  it('expires after the first year, and needs the bonus', () => {
    expect(getStartingEnergyRegenMultiplier(['starting_energy'], 52)).toBe(1.0);
    expect(getStartingEnergyRegenMultiplier([], 0)).toBe(1.0);
  });

  it('windowed on weeks into THIS life, wired into the regen line (source pin)', () => {
    const src = code('contexts/game/GameActionsContext.tsx');
    expect(src).toMatch(/getStartingEnergyRegenMultiplier\(/);
    expect(src).toMatch(/weeksSinceLifeStart\(prevState\.weeksLived \|\| 0, prevState\.lifeStartWeek\)/);
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
