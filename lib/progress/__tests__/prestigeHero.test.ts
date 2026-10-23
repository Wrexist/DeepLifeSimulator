import { prestigeHeroDestination } from '@/lib/progress/prestigeHero';

describe('prestigeHeroDestination (ONB2-2)', () => {
  const base = { prestigeAvailable: false, prestigeLevel: 0, prestigePoints: 0, contractsClaimable: 0 };

  it('opens the prestige flow on a first prestige', () => {
    expect(prestigeHeroDestination({ ...base, prestigeAvailable: true })).toEqual({
      modal: 'prestige',
      meta: 'Ready to prestige',
    });
  });

  it('opens the prestige flow on a REPEAT prestige too, not the history list', () => {
    expect(
      prestigeHeroDestination({ ...base, prestigeAvailable: true, prestigeLevel: 2, prestigePoints: 40 })
    ).toEqual({ modal: 'prestige', meta: 'Ready to prestige' });
  });

  it('a ready prestige outranks claimable contracts', () => {
    expect(prestigeHeroDestination({ ...base, prestigeAvailable: true, contractsClaimable: 2 }).modal).toBe('prestige');
  });

  it('falls back to contracts, then history, then shop', () => {
    expect(prestigeHeroDestination({ ...base, contractsClaimable: 1 })).toEqual({
      modal: 'prestigeShop',
      meta: '1 contract ready',
    });
    expect(prestigeHeroDestination({ ...base, prestigeLevel: 1, prestigePoints: 12 })).toEqual({
      modal: 'prestigeHistory',
      meta: '12 points · history',
    });
    expect(prestigeHeroDestination(base)).toEqual({ modal: 'prestigeShop', meta: '0 points · shop' });
  });
});
