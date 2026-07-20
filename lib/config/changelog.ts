// User-facing NEWS & UPDATES feed shown in the "What's New" popup
// (Main Menu top-right button + Settings).
//
// KEEP THIS PLAYER-FRIENDLY. Every line here is read by players in the app, so:
//   • Describe what changed for the PLAYER — features, balance, fixes they feel.
//   • No engineering/internal jargon (no "backend", "refactor", "migration",
//     "audit", tooling, servers, or how the work was produced). Just the game.
//   • Newest release goes FIRST (index 0 is treated as the latest).
//
// When you cut a new release, add an entry at the top with the new version and
// bump nothing else — `LATEST_VERSION` is derived from the first entry.

export type ChangeCategory = 'new' | 'improved' | 'fixed';

export interface ChangelogChange {
  /** Colored tag shown next to the line: New / Improved / Fixed. */
  category: ChangeCategory;
  /** Short bold headline, e.g. "Redeem codes". */
  title: string;
  /** One or two friendly sentences of detail. */
  description: string;
}

export interface ChangelogEntry {
  /** Marketing version, matches package.json (e.g. "2.5.8"). */
  version: string;
  /** Friendly date label, e.g. "July 2026". */
  date: string;
  /** Punchy news headline for this release (shown as the post title). */
  headline: string;
  /** One-line summary shown under the headline. */
  summary: string;
  changes: ChangelogChange[];
}

// Newest first. Index 0 is the current release.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.5.8',
    date: 'July 2026',
    headline: 'A fresh main menu and a brand-new What’s New feed',
    summary: 'A smoother first impression, and an easy way to keep up with every update.',
    changes: [
      {
        category: 'new',
        title: 'What’s New feed',
        description:
          'Tap the button on the main menu any time to catch up on the latest features, improvements and fixes — you’re reading it now.',
      },
      {
        category: 'improved',
        title: 'Brand-new main menu',
        description:
          'A cleaner, perfectly symmetric menu that loads instantly and rotates through fresh artwork every time you open the game.',
      },
      {
        category: 'fixed',
        title: 'App-wide polish pass',
        description:
          'A sweep across 20 in-game apps resolved 30 issues, from small visual glitches to real gameplay bugs.',
      },
      {
        category: 'fixed',
        title: 'Cleaner fresh installs',
        description:
          'New installs no longer show a stray “Unnamed Character” in your save slots.',
      },
      {
        category: 'improved',
        title: 'Rock-solid saves',
        description:
          'Your older saves keep loading safely as the game keeps growing.',
      },
    ],
  },
  {
    version: '2.5.7',
    date: 'July 2026',
    headline: 'The big one: new life systems, a new look, and a fairer economy',
    summary:
      'A major update touching nearly every corner of the game — new ways to live, a redesigned look, and a huge fix-and-balance sweep.',
    changes: [
      {
        category: 'new',
        title: 'More life to live',
        description:
          'Ten new life-stage systems add fresh events and choices from your first job all the way to your final years.',
      },
      {
        category: 'new',
        title: 'New ways to earn & spend',
        description:
          'Go live with streaming, pick up subscriptions and memberships, and set savings goals to hit your targets.',
      },
      {
        category: 'new',
        title: 'Your character has a face',
        description:
          'A new portrait system gives every character a real, age-aware face that grows up as you do.',
      },
      {
        category: 'new',
        title: 'Redeem codes',
        description:
          'Enter promo codes under Settings → Redeem Code to claim gems, cash, perks and more.',
      },
      {
        category: 'new',
        title: 'Reward orbs, upgraded',
        description:
          'The reward orb can now fully refill your Health, Happiness and Energy — not just hand you cash.',
      },
      {
        category: 'improved',
        title: 'A unified premium look',
        description:
          'A top-to-bottom “Slate Glass” redesign brings one clean dark style across the menu, tabs and onboarding, with redesigned event pop-ups.',
      },
      {
        category: 'improved',
        title: 'Simpler navigation',
        description:
          'The bottom bar is now four focused tabs — Home, Work, Apps and Life — with tidy sub-menus.',
      },
      {
        category: 'improved',
        title: 'Life Ambitions & Scenarios',
        description:
          'Redesigned ambition cards with a milestone timeline, plus crisper, clearer starting-scenario screens.',
      },
      {
        category: 'fixed',
        title: 'The bugs you reported',
        description:
          'Fixed a big batch you flagged: being unable to have kids, blank event banners, events not firing, early terminal diseases, unreachable bank actions, flat company income, duplicate partners, missing proposal rings, the tab bar covering buttons, stuck dark-web jobs, and more.',
      },
      {
        category: 'fixed',
        title: 'A fairer economy',
        description:
          'Closed money exploits — including selling underwater property or vehicles to wipe debt for free and a few “money printers” — and fixed a serious bug where a new game could overwrite the wrong save slot.',
      },
      {
        category: 'fixed',
        title: 'No more freezes',
        description:
          'Fixed a “Next Week” soft-lock, crashes on older saves, and a freeze that could happen after watching a reward ad — and hardened weekly progression so a hiccup in one system can’t stall your whole game.',
      },
      {
        category: 'fixed',
        title: 'Everyday fixes',
        description:
          'Corrected money formatting, education completion and upgrade caps, and aligned the Health tab so vitals never overlap.',
      },
    ],
  },
  {
    version: '2.5.1',
    date: 'May 2026',
    headline: 'Purchases and the economy, tightened up',
    summary: 'The in-app store and your wealth, made more dependable.',
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
    headline: 'A big stability and balance pass',
    summary: 'Foundational fixes to how money, health and family play.',
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
