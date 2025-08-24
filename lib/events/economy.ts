import type { EventTemplate } from './engine';
import { adjustStockPrice } from '../economy/stockMarket';

export const marketCrash: EventTemplate = {
  id: 'market_crash',
  category: 'economy',
  weight: 0.2,
  generate: () => ({
    id: 'market_crash',
    description: 'The stock market dips, tempting you to invest.',
    choices: [
      { id: 'buy', text: 'Buy the dip', effects: { money: -100, stats: { happiness: 5 } } },
      { id: 'hold', text: 'Hold your cash', effects: {} },
    ],
  }),
};

export const sideGig: EventTemplate = {
  id: 'side_gig',
  category: 'economy',
  weight: 0.3,
  generate: () => ({
    id: 'side_gig',
    description: 'A friend offers a weekend side gig for extra cash.',
    choices: [
      { id: 'accept', text: 'Take the gig', effects: { money: 150, stats: { energy: -10 } } },
      { id: 'decline', text: 'Decline politely', effects: { stats: { happiness: 2 } } },
    ],
  }),
};

export const earningsReport: EventTemplate = {
  id: 'earnings_report',
  category: 'economy',
  weight: 0.3,
  generate: () => {
    adjustStockPrice('aapl', 1.05);
    return {
      id: 'earnings_report',
      description: 'Positive earnings report boosts AAPL stock by 5%.',
      choices: [
        { id: 'buy', text: 'Invest $100 in AAPL', effects: { money: -100 } },
        { id: 'ignore', text: 'Ignore', effects: {} },
      ],
    };
  },
};
