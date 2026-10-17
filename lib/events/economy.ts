import type { EventTemplate } from './engine';

// `market_dip`, not `market_crash`: that id belongs to the economy-state crash
// in `economyEvents.ts`, registered in the same pool. Sharing it made this
// small weekly dip render as the crash (the "Economic Event" header and the
// macro effects panel key on the id) and share its cooldown and log identity.
export const marketCrash: EventTemplate = {
  id: 'market_dip',
  category: 'economy',
  weight: 0.2,
  generate: () => ({
    id: 'market_dip',
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
    description: 'Strong earnings reports are lifting the market this week - tech stocks are up on the news.',
    choices: [
      { id: 'optimistic', text: 'Feel good about your investments', effects: { stats: { happiness: 2 } } },
      { id: 'ignore', text: 'Ignore the news', effects: {} },
    ],
  }),
};
