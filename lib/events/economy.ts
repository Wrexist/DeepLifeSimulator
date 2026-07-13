import type { EventTemplate } from './engine';

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
  // Pure generate(): the old body mutated a MODULE-LEVEL stock singleton at
  // selection time (before the player even resolved the event), so AAPL
  // compounded +5% every time this was rolled and the change persisted across
  // lives. The stock-market model moves prices on its own; this is now a
  // sentiment/flavor event whose choice no longer burns $100 for zero shares.
  generate: () => ({
    id: 'earnings_report',
    description: 'Strong earnings reports are lifting the market this week — tech stocks are up on the news.',
    choices: [
      { id: 'optimistic', text: 'Feel good about your investments', effects: { stats: { happiness: 2 } } },
      { id: 'ignore', text: 'Ignore the news', effects: {} },
    ],
  }),
};
