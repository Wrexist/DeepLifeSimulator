import { formatLifeWeek } from '@/utils/formatLifeWeek';

describe('player-facing week stamps', () => {
  it.each([0, 104, 364])('starts at Week 1 for starting clock %i', start => {
    expect(formatLifeWeek(start, start)).toBe('Week 1');
    expect(formatLifeWeek(start + 1, start)).toBe('Week 2');
    expect(formatLifeWeek(start + 52, start)).toBe('Week 53');
  });
  it('identifies pre-life records instead of inventing a Week 1 event', () => {
    expect(formatLifeWeek(100, 104)).toBe('4 weeks before this life');
    expect(formatLifeWeek(103, 104)).toBe('1 week before this life');
  });
  it('handles legacy missing origins and invalid stamps honestly', () => {
    expect(formatLifeWeek(4, undefined)).toBe('Week 5');
    expect(formatLifeWeek(4, NaN)).toBe('Week 5');
    for (const stamp of [undefined, NaN, Infinity, -1]) {
      expect(formatLifeWeek(stamp, 104)).toBe('Unknown week');
    }
  });
});
