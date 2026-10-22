/**
 * LATE-10: the Life Skills tree advertised effects the game does not apply
 * ("Unlock C-suite positions", "+5 max relationships", "+10 max energy",
 * "Skills decay -50%", "Unlock all education paths") while
 * `getLifeSkillModifiers` applied something else. The tree now reads
 * `LIFE_SKILL_EFFECT_TEXT`, and this pins every number in that text to the
 * modifier the node actually applies - the §4.9 "copy is generated from the
 * table" rule, enforced from the other side.
 */
import fs from 'fs';
import path from 'path';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import {
  getLifeSkillModifiers,
  LIFE_SKILL_EFFECT_TEXT,
  LIFE_SKILL_IDS,
  NEUTRAL_LIFE_SKILL_MODIFIERS,
  type LifeSkillModifiers,
} from '@/lib/skillTrees/lifeSkillEffects';

/** The applied effect of one node, as whole percentages. */
function appliedPercents(id: string): number[] {
  const mods = getLifeSkillModifiers(createTestGameState({ unlockedLifeSkills: [id] }));
  const out: number[] = [];
  (Object.keys(NEUTRAL_LIFE_SKILL_MODIFIERS) as (keyof LifeSkillModifiers)[]).forEach((key) => {
    const delta = mods[key] - NEUTRAL_LIFE_SKILL_MODIFIERS[key];
    if (Math.abs(delta) < 1e-9) return;
    // jobApplicationBonus is already in percentage points; the rest are fractions.
    out.push(Math.round(Math.abs(key === 'jobApplicationBonus' ? delta : delta * 100)));
  });
  return out.sort((a, b) => a - b);
}

/** Every percentage the text states. */
function statedPercents(text: string): number[] {
  return [...text.matchAll(/(\d+)%/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
}

describe('Life Skill effect text matches what the node applies', () => {
  it.each(LIFE_SKILL_IDS.map((id) => [id]))('%s', (id) => {
    const text = LIFE_SKILL_EFFECT_TEXT[id];
    expect(text.length).toBeGreaterThan(0);
    expect(statedPercents(text)).toEqual(appliedPercents(id));
  });

  it('promises none of the mechanics the game does not have', () => {
    const all = Object.values(LIFE_SKILL_EFFECT_TEXT).join(' | ');
    expect(all).not.toMatch(/C-suite|max relationships|max energy|decay -50|all education paths/i);
  });

  it('the tree reads the table instead of hand-written strings', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../components/SkillTreeModal.tsx'), 'utf8');
    const literalEffects = source.match(/^\s+effect: '/gm) ?? [];
    expect(literalEffects).toHaveLength(0);
    expect((source.match(/effect: lifeSkillEffectText\('/g) ?? []).length).toBe(LIFE_SKILL_IDS.length);
  });
});
