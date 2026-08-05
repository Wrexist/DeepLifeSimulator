// User-facing NEWS & UPDATES feed shown in the "What's New" popup
// (Main Menu top-right button + Settings).
//
// KEEP THIS PLAYER-FRIENDLY. Every line here is read by players in the app, so:
//   • Describe what changed for the PLAYER — features, balance, fixes they feel.
//   • No engineering/internal jargon (no "backend", "refactor", "migration",
//     "audit", tooling, servers, or how the work was produced). Just the game.
//   • Never name tools, vendors or the development process. A player wants to
//     know what changed in their game, not how the sausage was made.
//   • Newest release goes FIRST (index 0 is treated as the latest).
//
// Each change is a short title plus BULLETS — never a paragraph. Bullets scan in
// a glance on a phone; prose does not, and the popup is something people skim on
// their way back into a save.
//
// When you cut a new release, add an entry at the top with the new version and
// bump nothing else — `LATEST_VERSION` is derived from the first entry.

export type ChangeCategory = 'new' | 'improved' | 'fixed';

export interface ChangelogChange {
  /** Colored tag shown next to the line: New / Improved / Fixed. */
  category: ChangeCategory;
  /** Short bold headline, e.g. "Redeem codes". */
  title: string;
  /**
   * The detail, as scannable bullets. Keep each to one line on a phone —
   * roughly 90 characters — so the list stays a list and not a wall.
   */
  bullets: string[];
}

export interface ChangelogEntry {
  /** Marketing version, matches package.json (e.g. "2.6.0"). */
  version: string;
  /** Friendly date label, e.g. "August 2026". */
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
    version: '2.6.0',
    date: 'August 2026',
    headline: 'The Economy Update',
    summary: 'Investing works, wages make sense, and money finally has consequences.',
    changes: [
      {
        category: 'new',
        title: 'Rent a place to live',
        bullets: [
          'A rental ladder from a shared room up to a penthouse lease.',
          'Your home now gives you weekly health, happiness and energy.',
          'Sleeping rough wears you down, so a roof is worth working for.',
          'Buying still beats renting — it stops the rent and keeps the benefits.',
        ],
      },
      {
        category: 'new',
        title: 'Fall behind and you lose the place',
        bullets: [
          'Four straight weeks behind on rent and your landlord evicts you.',
          'You get warned from the second week, with a countdown.',
          'Clearing what you owe resets the clock completely, every time.',
          'Eviction stops the rent but not the debt — and a shared room is always affordable.',
        ],
      },
      {
        category: 'fixed',
        title: 'Your home finally does what it says',
        bullets: [
          'Owned homes listed an energy bonus that was never actually paid.',
          'It is paid now, and owning a home helps your health as well.',
        ],
      },
      {
        category: 'fixed',
        title: 'The stock market works',
        bullets: [
          'Share prices drifted toward zero over a long life, however well you played.',
          'Prices now grow over time, and riskier stocks pay more on average.',
          'Portfolios the old behaviour wiped out are restored when you load your save.',
        ],
      },
      {
        category: 'improved',
        title: 'Wages that make sense',
        bullets: [
          'Entry-level jobs paid as little as $40 a week next to a $95,000 apartment.',
          'Every career now starts at a livable wage and keeps its own ceiling.',
          'No job pays less than it did before.',
        ],
      },
      {
        category: 'improved',
        title: 'Work beats hustling',
        bullets: [
          'Street jobs paid more per week than holding down an actual career.',
          'They are now a real bridge out of unemployment, not the better plan.',
          'Your first property is a long-term goal again, not an early purchase.',
        ],
      },
      {
        category: 'improved',
        title: 'Property is an investment, not a printer',
        bullets: [
          'Rent used to repay a property in under four years.',
          'Yields are now realistic, so landlording competes with careers instead of replacing them.',
          'Renting a home costs less too — the same rate drives both.',
        ],
      },
      {
        category: 'new',
        title: 'Bills you can actually miss',
        bullets: [
          'Rent, tax and tuition you cannot cover are no longer quietly forgiven.',
          'They become an overdue balance, paid first out of next week’s income.',
          'Falling behind costs a late fee and drags your credit score.',
          'It never grows on a week you paid what you could, so you can always climb out.',
        ],
      },
      {
        category: 'new',
        title: 'Economic policy has teeth',
        bullets: [
          'Inflation runs for the first time, instead of being a number that never moved.',
          'Policies you enact now push the cost of starting and upgrading a business.',
        ],
      },
      {
        category: 'improved',
        title: 'A much smaller download',
        bullets: [
          'The app installs around 200 MB lighter.',
          'Every piece of artwork looks exactly as it did before.',
        ],
      },
      {
        category: 'fixed',
        title: 'Time, crime and consequences',
        bullets: [
          'The week counter no longer drifts out of step with the month.',
          'Getting arrested can no longer shorten a sentence you were already serving.',
          'Police fines scale with your wealth, so crime still costs something when rich.',
          'A hiccup in any weekly system can no longer swallow your whole week.',
        ],
      },
    ],
  },
  {
    version: '2.5.13',
    date: 'August 2026',
    headline: 'Fair play, and saves you can trust',
    summary: 'Your purchases stay yours, the economy plays straight, and your progress is safe.',
    changes: [
      {
        category: 'fixed',
        title: 'Purchases survive prestige',
        bullets: [
          'Remove Ads, lifetime premium, gold upgrades and unspent youth pills now carry across lives.',
          'Starting a new generation no longer resets anything you paid for.',
        ],
      },
      {
        category: 'fixed',
        title: 'A straight economy',
        bullets: [
          'Closed several ways to mint unlimited money and gems.',
          'Luxury items, hobby tournaments and staking now charge what they show.',
          'Rewards that promised a bonus but delivered nothing are wired up properly.',
        ],
      },
      {
        category: 'fixed',
        title: 'Your saves are safer',
        bullets: [
          'Fixed a recovery path that could lose a save it was meant to rescue.',
          'Older saves keep loading cleanly as the game grows.',
          'Automatic backups are more reliable.',
        ],
      },
      {
        category: 'improved',
        title: 'Honest numbers everywhere',
        bullets: [
          'Family income, property returns and business figures now match what you actually receive.',
          'Prestige bonuses that were advertised but inactive now do what the card says.',
        ],
      },
      {
        category: 'fixed',
        title: 'Events that finish',
        bullets: [
          'Event chains can no longer get stuck part-way and block later stories.',
          'Anniversaries now fire for couples who married while the week advanced.',
        ],
      },
    ],
  },
  {
    version: '2.5.10',
    date: 'July 2026',
    headline: 'DeepLife+, daily rewards and a cleaner store',
    summary: 'A proper membership, a fairer daily claim, and a store that behaves.',
    changes: [
      {
        category: 'new',
        title: 'DeepLife+ membership',
        bullets: [
          'A redesigned in-app membership screen with everything included laid out clearly.',
          'Reachable from your player card, the gem shop and the reward sheet.',
          'Terms and privacy links are right there before you subscribe.',
        ],
      },
      {
        category: 'fixed',
        title: 'A fair daily claim',
        bullets: [
          'Changing your device clock can no longer farm the daily gem reward.',
          'The claim card fits properly on every screen size.',
        ],
      },
      {
        category: 'improved',
        title: 'The store, tidied up',
        bullets: [
          'The shop loads reliably instead of hanging on an empty screen.',
          'Purchases and restores work correctly on Android.',
        ],
      },
      {
        category: 'fixed',
        title: 'Layout polish',
        bullets: [
          'Player card, upsell seals and call-to-action buttons scale correctly on small phones.',
          'The What’s New feed scrolls all the way to the end.',
        ],
      },
    ],
  },
  {
    version: '2.5.8',
    date: 'July 2026',
    headline: 'A fresh main menu and a brand-new What’s New feed',
    summary: 'A smoother first impression, and an easy way to keep up with every update.',
    changes: [
      {
        category: 'new',
        title: 'What’s New feed',
        bullets: [
          'Tap the button on the main menu any time to catch up on every update.',
          'You are reading it right now.',
        ],
      },
      {
        category: 'improved',
        title: 'Brand-new main menu',
        bullets: [
          'A cleaner, perfectly symmetric menu that loads instantly.',
          'Fresh artwork every time you open the game.',
        ],
      },
      {
        category: 'fixed',
        title: 'App-wide polish pass',
        bullets: [
          'A sweep across 20 in-game apps resolved 30 issues.',
          'Everything from small visual glitches to real gameplay bugs.',
        ],
      },
      {
        category: 'fixed',
        title: 'Cleaner fresh installs',
        bullets: [
          'New installs no longer show a stray “Unnamed Character” in your save slots.',
        ],
      },
      {
        category: 'improved',
        title: 'Rock-solid saves',
        bullets: ['Your older saves keep loading safely as the game keeps growing.'],
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
        bullets: [
          'Ten new life-stage systems add fresh events and choices.',
          'From your first job all the way to your final years.',
        ],
      },
      {
        category: 'new',
        title: 'New ways to earn & spend',
        bullets: [
          'Go live with streaming and build an audience.',
          'Pick up subscriptions and memberships.',
          'Set savings goals and track them to the finish.',
        ],
      },
      {
        category: 'new',
        title: 'Your character has a face',
        bullets: [
          'Every character gets a real portrait that ages as you do.',
        ],
      },
      {
        category: 'new',
        title: 'Redeem codes',
        bullets: [
          'Enter promo codes under Settings → Redeem Code.',
          'Claim gems, cash, perks and more.',
        ],
      },
      {
        category: 'new',
        title: 'Reward orbs, upgraded',
        bullets: [
          'The reward orb can now fully refill Health, Happiness and Energy.',
          'Not just hand you cash.',
        ],
      },
      {
        category: 'improved',
        title: 'A unified premium look',
        bullets: [
          'One clean dark style across the menu, tabs and onboarding.',
          'Redesigned event pop-ups throughout.',
        ],
      },
      {
        category: 'improved',
        title: 'Simpler navigation',
        bullets: [
          'Four focused tabs: Home, Work, Apps and Life.',
          'Tidy sub-menus instead of a crowded bar.',
        ],
      },
      {
        category: 'improved',
        title: 'Life Ambitions & Scenarios',
        bullets: [
          'Redesigned ambition cards with a milestone timeline.',
          'Crisper, clearer starting-scenario screens.',
        ],
      },
      {
        category: 'fixed',
        title: 'The bugs you reported',
        bullets: [
          'Being unable to have kids, and duplicate partners appearing.',
          'Blank event banners and events that never fired.',
          'Terminal diseases arriving far too early.',
          'Unreachable bank actions and flat company income.',
          'Missing proposal rings, stuck dark-web jobs, and the tab bar covering buttons.',
        ],
      },
      {
        category: 'fixed',
        title: 'A fairer economy',
        bullets: [
          'Selling underwater property or vehicles no longer wipes debt for free.',
          'Closed several money exploits.',
          'Fixed a serious bug where a new game could overwrite the wrong save slot.',
        ],
      },
      {
        category: 'fixed',
        title: 'No more freezes',
        bullets: [
          'Fixed a “Next Week” soft-lock and crashes on older saves.',
          'Fixed a freeze that could happen after watching a reward ad.',
        ],
      },
      {
        category: 'fixed',
        title: 'Everyday fixes',
        bullets: [
          'Corrected money formatting, education completion and upgrade caps.',
          'Aligned the Health tab so vitals never overlap.',
        ],
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
        bullets: [
          'The in-app store now loads reliably.',
          'Smoother, more dependable checkout and restores.',
        ],
      },
      {
        category: 'improved',
        title: 'Economy rebalanced',
        bullets: [
          'Closed a batch of money exploits.',
          'Your wealth reflects real progress and the late game stays challenging.',
        ],
      },
      {
        category: 'fixed',
        title: 'Season rewards',
        bullets: [
          'Unclaimed rewards are collected automatically when a season rolls over.',
          'You never lose what you earned.',
        ],
      },
      {
        category: 'improved',
        title: 'Stability & polish',
        bullets: ['A range of fixes for a smoother, more reliable experience.'],
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
        bullets: [
          'Reworked bankruptcy, debt collection and loans.',
          'Rebalanced lifestyle costs for a more believable money game.',
        ],
      },
      {
        category: 'improved',
        title: 'Health & happiness',
        bullets: [
          'Overhauled the disease system.',
          'Tuned how your stats rise and fall.',
        ],
      },
      {
        category: 'improved',
        title: 'Family & poverty',
        bullets: [
          'Balanced child expenses.',
          'Added a clearer path out of poverty.',
        ],
      },
      {
        category: 'fixed',
        title: 'Crime & justice',
        bullets: ['Improved wanted levels and the jail system.'],
      },
    ],
  },
];

/** The current release version — the newest entry in the log. */
export const LATEST_VERSION: string = CHANGELOG[0]?.version ?? '';

/**
 * Work in progress, shown under the released entries.
 *
 * Only list things a player would recognise and genuinely wants, and only when
 * they are actually being built — a roadmap that never ships is worse than no
 * roadmap. Keep it short. Clear this out as each item lands in a release above.
 */
export interface UpcomingItem {
  title: string;
  bullets: string[];
}

export const UPCOMING: UpcomingItem[] = [
  {
    title: 'Character customization, rebuilt',
    bullets: [
      'Face, hair and style choices that actually carry into the game.',
      'A redesigned look-builder with a proper preview.',
      'Your appearance stays consistent as your character ages.',
    ],
  },
];
