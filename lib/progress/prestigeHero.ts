/**
 * Where the Profile tab's Prestige hero card leads, and the line that says so.
 *
 * Resolved in one place so the tap and the label can never disagree: the card
 * whose meta reads "Ready to prestige" must be the card that starts one, and a
 * badge must lead to the thing it counts.
 *
 * ONB2-2: the first branch used to also require `prestigeLevel === 0`, so a
 * dynasty eligible for its NEXT prestige read "N points · history" (in the
 * success colour, because the colour keys on availability) and the tap opened
 * the history list - Profile never offered a repeat prestige at all.
 */
export type PrestigeHeroModal = 'prestige' | 'prestigeShop' | 'prestigeHistory';

export function prestigeHeroDestination(input: {
  prestigeAvailable: boolean;
  prestigeLevel: number;
  prestigePoints: number;
  contractsClaimable: number;
}): { modal: PrestigeHeroModal; meta: string } {
  const { prestigeAvailable, prestigeLevel, prestigePoints, contractsClaimable } = input;
  if (prestigeAvailable) return { modal: 'prestige', meta: 'Ready to prestige' };
  if (contractsClaimable > 0) {
    return {
      modal: 'prestigeShop',
      meta: `${contractsClaimable} contract${contractsClaimable === 1 ? '' : 's'} ready`,
    };
  }
  if (prestigeLevel > 0) return { modal: 'prestigeHistory', meta: `${prestigePoints} points · history` };
  return { modal: 'prestigeShop', meta: `${prestigePoints} points · shop` };
}
