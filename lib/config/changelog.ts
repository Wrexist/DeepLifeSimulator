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
    version: '2.9.0',
    date: 'August 2026',
    headline: 'New faces, real conversations, nothing left locked',
    summary:
      'Rebuilt character creation, real Spark conversations, and a lot of stuck things moving again.',
    changes: [
      {
        category: 'new',
        title: 'Character creation, rebuilt',
        bullets: [
          'Your face is built from features you choose, not picked from a gallery of portraits.',
          'Every option shows your own face wearing it, so you choose by looking, not by reading.',
          'Your face ages with you instead of being swapped for a stranger at each age band.',
          "Children look like children now, and they inherit their parents' features.",
        ],
      },
      {
        category: 'new',
        title: 'Spark chats are a real conversation',
        bullets: [
          'The text box is gone. Pick a move: break the ice, compliment, joke, or flirt.',
          'Each match keeps its own rapport. Flirting opens at 25, dates at 45, going steady at 75.',
          'Ask them out for coffee, dinner or something reckless — each with its own cost and payoff.',
          'Not feeling it? Any match can become a friend instead.',
        ],
      },
      {
        category: 'fixed',
        title: 'The game could lock you out of itself',
        bullets: [
          'Buying a house or a company could take away the very app that manages it.',
          'Two life chapters asked for apps that those same chapters were the only way to unlock.',
          'Spending money no longer moves you backwards. Progress only ever goes up.',
        ],
      },
      {
        category: 'fixed',
        title: 'Your starting age no longer breaks the early game',
        bullets: [
          'Beginner luck, first-month events and the early grace period only ever worked at age 18.',
          'Week goals like "Survive 4 Weeks" were already complete before you had played a week.',
          'Chapter 1 opened two-thirds done and paid you for it. It starts at zero now.',
        ],
      },
      {
        category: 'new',
        title: 'The dark web sells gear',
        bullets: [
          'The tool shop had no way in, so 18 of the 19 street jobs sat locked behind it.',
          'Deliveries hand over the item you paid for, not the next one on the shelf.',
          'Getting scammed earns buyer standing, and listings rotate instead of freezing for weeks.',
        ],
      },
      {
        category: 'new',
        title: 'Friends, favours, and people who notice you are gone',
        bullets: [
          'Only your first Spark match could ever become a contact. Now any of them can.',
          'Network contacts can be asked for a favour: influence, a discount, heat relief, an intro.',
          'Neglecting family and friends costs happiness, and a neglected friend can drift away.',
        ],
      },
      {
        category: 'fixed',
        title: 'Money numbers that match what you are charged',
        bullets: [
          'Weekly Expenses and the Budget tab left out rent, income tax and student loan payments.',
          'The Net Worth breakdown did not add up to the Net Worth on the card. Now it does.',
          'Billions displayed as "$1500.00M", and losses printed as "$-1.2M" across the game.',
        ],
      },
      {
        category: 'fixed',
        title: 'Six more money fixes',
        bullets: [
          'A $40M save was told "Need $10,000" for a business action it had already paid for.',
          'A fast double-tap could buy a vehicle twice, or duplicate coins in a crypto swap.',
          'Savings had no way to pay into it, so the piggy bank sat at zero for a whole life.',
          'Buying out a rival added no revenue, and one achievement asked for more than the cap.',
          'Ad rewards read your wallet, not your worth — a property millionaire was offered $50.',
          'The poverty scholarship promised free education and paid respect. It covers tuition now.',
        ],
      },
      {
        category: 'fixed',
        title: 'Small things that were quietly wrong',
        bullets: [
          'Your obituary named a job you no longer held after you were voted out of office.',
          "An heir's age and the game clock disagreed from the moment they took over.",
          'Two ways of farming rewards by winding your device clock forward are closed.',
        ],
      },
      {
        category: 'improved',
        title: 'Faster to open, easier to read',
        bullets: [
          'Cold start is about six seconds quicker — the loading bar was waiting on nothing.',
          'The death screen scrolls properly, so every option is reachable on both tabs.',
          'Food, gym and housing cards show what they do to each stat, in the same colours as the HUD.',
          'Life Goals fits in a page or two instead of a dozen, and Contacts stays smooth in a long life.',
        ],
      },
    ],
  },
  {
    version: '2.8.0',
    date: 'August 2026',
    headline: 'A faster start, and a fairer economy',
    summary: 'Get into a life in two taps, keep your first year ad-free, and four money bugs are gone.',
    changes: [
      {
        category: 'improved',
        title: 'Start a life in two taps',
        bullets: [
          'Tap Play and you are in — no scenario, name, ambition or perk screens first.',
          'Want to pick all of that yourself? Custom life is still one tap away.',
        ],
      },
      {
        category: 'new',
        title: 'A guide that walks you to your first paycheck',
        bullets: [
          'One clear next step at a time: find work, live a week, get paid.',
          'It follows what you actually did, so it never asks for something twice.',
        ],
      },
      {
        category: 'improved',
        title: 'Your first year has no banner ads',
        bullets: [
          'New lives get a clean run at the game before any banner appears.',
        ],
      },
      {
        category: 'fixed',
        title: 'Four ways money behaved wrongly',
        bullets: [
          'Dark web jobs could pay out again without costing you any energy.',
          'Gym sessions and warehouse upgrades could be taken without paying.',
          'A warehouse could also pass its maximum level, or leave you below zero.',
          'Vehicle insurance never ran out — it now lasts its term and tells you.',
        ],
      },
      {
        category: 'improved',
        title: 'The pace picker is gone',
        bullets: [
          'Choosing how fast to live before you had played asked too much too early.',
          'Every life runs at the original pace again. Your saves carry over.',
        ],
      },
    ],
  },
  {
    version: '2.7.0',
    date: 'August 2026',
    headline: 'Polish & fixes',
    summary: 'Sharper stories, a working share link, and a lot of small repairs.',
    changes: [
      {
        category: 'improved',
        title: 'Sharing a life now links to the game',
        bullets: [
          'Send someone your obituary and they can actually install it.',
          'Share your life at any point from the Progress tab.',
        ],
      },
      {
        category: 'improved',
        title: 'Two stories that promised drama now follow through',
        bullets: [
          'A partner acting distant, and a suspicious message on their phone.',
          'Both used to resolve into nothing. Now the choices lead somewhere.',
        ],
      },
      {
        category: 'fixed',
        title: 'Advancing quickly could use out-of-date numbers',
        bullets: [
          'Tapping fast meant your stats wore down against a stale snapshot.',
          'A character could also keep ageing after they had already died.',
        ],
      },
    ],
  },
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

// Empty on purpose. The one item that lived here — "Character customization,
// rebuilt" — shipped in 2.9.0, and this file's own rule is to clear an item out
// as it lands. Add the next thing here only once it is actually being built.
export const UPCOMING: UpcomingItem[] = [];
