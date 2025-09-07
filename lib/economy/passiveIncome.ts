import { GameState } from '@/contexts/GameContext';
import { getStockInfo } from './stockMarket';
import { getUpgradeTier } from '@/lib/realEstate/housing';

interface PassiveIncomeBreakdown {
  stocks: number;
  realEstate: number;
  songs: number;
  art: number;
  contracts: number;
  sponsors: number;
}

export function calcWeeklyPassiveIncome(state: GameState): { total: number; breakdown: PassiveIncomeBreakdown } {
  let stocksIncome = 0;
  const holdings = state.stocksOwned || {};
  for (const [stockId, shares] of Object.entries(holdings)) {
    const info = getStockInfo(stockId);
    if (!info) continue;
    const annualDividend = info.price * info.dividendYield * shares;
    stocksIncome += Math.round(annualDividend / 52);
  }

  let realEstateIncome = 0;
  state.realEstate.forEach(property => {
    const rent = property.rent ?? 0;
    const upkeep = property.upkeep ?? 0;
    const tier = getUpgradeTier(property.upgradeLevel) || getUpgradeTier(0)!;
    realEstateIncome += Math.round(rent + tier.rentBonus - (upkeep + tier.upkeepBonus));
  });

  let songsIncome = 0;
  const music = state.hobbies?.find(h => h.id === 'music');
  if (music && music.songs) {
    songsIncome = Math.round(music.songs.reduce((sum, song) => sum + song.weeklyIncome, 0));
  }

  let artIncome = 0;
  const art = state.hobbies?.find(h => h.id === 'art');
  if (art && art.artworks) {
    artIncome = Math.round(art.artworks.reduce((sum, a) => sum + a.weeklyIncome, 0));
  }

  let contractsIncome = 0;

  let sponsorsIncome = 0;
  state.hobbies.forEach(h => {
    if (h.sponsors && h.sponsors.length > 0) {
      sponsorsIncome += Math.round(h.sponsors.reduce((sum, s) => sum + s.weeklyPay, 0));
    }
  });

  const total = Math.round(
    stocksIncome +
    realEstateIncome +
    songsIncome +
    artIncome +
    contractsIncome +
    sponsorsIncome
  );
  return {
    total,
    breakdown: {
      stocks: stocksIncome,
      realEstate: realEstateIncome,
      songs: songsIncome,
      art: artIncome,
      contracts: contractsIncome,
      sponsors: sponsorsIncome,
    },
  };
}

export type { PassiveIncomeBreakdown };
