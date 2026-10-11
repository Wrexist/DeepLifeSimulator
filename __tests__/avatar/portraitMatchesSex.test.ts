import { PORTRAITS, randomPortrait } from '@/lib/avatar/portraits';

/**
 * The dice must not contradict the name. A fresh character used to open as
 * "Justin Martin" under a feminine portrait about half the time (2026-10-10).
 */
describe('randomPortrait with a sex', () => {
  const presents = (id: string) => PORTRAITS.find((p) => p.id === id)?.presents;

  it.each(['male', 'female'] as const)('only rolls %s portraits', (sex) => {
    for (let i = 0; i < 50; i++) {
      expect(presents(randomPortrait(undefined, i / 50, sex))).toBe(sex);
    }
  });

  it('still never repeats the previous portrait on a re-roll', () => {
    const female = PORTRAITS.filter((p) => p.presents === 'female');
    for (const prev of female) {
      expect(randomPortrait(prev.id, 0.5, 'female')).not.toBe(prev.id);
    }
  });
});
