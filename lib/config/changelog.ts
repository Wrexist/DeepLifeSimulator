// User-facing update log shown in the "What's New" popup (Main Menu + Settings).
//
// KEEP THIS PLAYER-FRIENDLY. Every line here is read by players in the app, so:
//   • Describe what changed for the PLAYER — features, balance, fixes they feel.
//   • No engineering/internal jargon (no "backend", "refactor", "migration",
//     tooling, or how the work was produced). Just the game.
//   • Newest release goes FIRST (index 0 is treated as the latest).
//
// When you cut a new release, add an entry at the top with the new version and
// bump nothing else — `LATEST_VERSION` is derived from the first entry.

export type ChangeCategory = 'new' | 'improved' | 'fixed';

export interface ChangelogChange {
  /** Colored tag shown next to the line: New / Improved / Fixed. */
  category: ChangeCategory;
  /** Short bold headline, e.g. "Season rewards". */
  title: string;
  /** One friendly sentence of detail. */
  description: string;
}

export interface ChangelogEntry {
  /** Marketing version, matches package.json (e.g. "2.5.8"). */
  version: string;
  /** Friendly date label, e.g. "July 2026". */
  date: string;
  /** Optional one-line summary shown under the version header. */
  summary?: string;
  changes: ChangelogChange[];
}

// Newest first. Index 0 is the current release.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.5.8',
    date: 'July 2026',
    summary: 'A smoother, more reliable DeepLife.',
    changes: [
      {
        category: 'fixed',
        title: 'Bug fixes',
        description:
          'Fixes across your saves, the economy and the in-app store for a more dependable run.',
      },
      {
        category: 'improved',
        title: 'Performance',
        description: 'Smoother, cleaner gameplay with stability improvements throughout.',
      },
      {
        category: 'improved',
        title: 'Polish',
        description: 'A round of refinements based on the issues you reported.',
      },
    ],
  },
  {
    version: '2.5.1',
    date: 'May 2026',
    summary: 'Purchases and the economy, tightened up.',
    changes: [
      {
        category: 'fixed',
        title: 'Purchases fixed',
        description:
          'The in-app store now loads reliably, with smoother, more dependable checkout and restores.',
      },
      {
        category: 'improved',
        title: 'Economy rebalanced',
        description:
          'Closed a batch of money exploits so your wealth reflects real progress and the late game stays challenging.',
      },
      {
        category: 'fixed',
        title: 'Season rewards',
        description:
          'Unclaimed rewards are now collected automatically when a season rolls over, so you never lose what you earned.',
      },
      {
        category: 'improved',
        title: 'Stability & polish',
        description: 'A range of fixes for a smoother, more reliable experience.',
      },
    ],
  },
  {
    version: '1.8.7',
    date: 'Earlier',
    summary: 'A big stability and balance pass.',
    changes: [
      {
        category: 'improved',
        title: 'Financial overhaul',
        description:
          'Reworked bankruptcy, debt collection, loans and lifestyle costs for a more believable money game.',
      },
      {
        category: 'improved',
        title: 'Health & happiness',
        description: 'Overhauled the disease system and tuned how your stats rise and fall.',
      },
      {
        category: 'improved',
        title: 'Family & poverty',
        description: 'Balanced child expenses and added a clearer path out of poverty.',
      },
      {
        category: 'fixed',
        title: 'Crime & justice',
        description: 'Improved wanted levels and the jail system.',
      },
    ],
  },
];

/** The current release version — the newest entry in the log. */
export const LATEST_VERSION: string = CHANGELOG[0]?.version ?? '';
