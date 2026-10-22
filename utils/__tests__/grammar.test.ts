import { withArticle, plural, countOf } from '@/utils/grammar';
import { buildMilestones } from '@/lib/statistics/milestones';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

describe('grammar helpers', () => {
  it('picks the article from the first letter', () => {
    expect(withArticle('Exotic Supercar')).toBe('an Exotic Supercar');
    expect(withArticle('Entry Supercar')).toBe('an Entry Supercar');
    expect(withArticle('Sedan')).toBe('a Sedan');
  });

  it('pluralises on the count', () => {
    expect(countOf(1, 'week')).toBe('1 week');
    expect(countOf(0, 'week')).toBe('0 weeks');
    expect(countOf(3, 'property', 'properties')).toBe('3 properties');
    expect(plural(1, 'remains', 'remain')).toBe('remains');
  });
});

describe('milestone labels carry no "(s)" placeholders', () => {
  it('one property reads singular, two companies read plural', () => {
    const base = createTestGameState();
    const state = createTestGameState({
      lifetimeStatistics: { ...base.lifetimeStatistics!, totalPropertiesOwned: 1, totalCompaniesOwned: 2 },
    });
    const labels = buildMilestones(state).map((m) => m.label);
    expect(labels.join('\n')).not.toMatch(/\(s\)/);
    expect(labels).toContain('Owned 1 property');
    expect(labels).toContain('Founded 2 companies');
  });
});
