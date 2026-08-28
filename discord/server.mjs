/**
 * The Deep Life Simulator Discord server, as data.
 *
 * This file IS the server. Change a name here, run `npm run discord:sync`, and
 * the live guild follows. Nothing in `discord/` reads the guild to decide what
 * the guild should be — that direction only ever goes one way, or the config
 * stops being the source of truth the first time someone edits Discord by hand.
 *
 * Two fields are load-bearing and easy to skip:
 *
 *   `key`            Stable identity. NEVER change one. Everything else about a
 *                    channel — its name, its emoji, its category — can move
 *                    freely, and `key` is what keeps backups, the archive and
 *                    the onboarding prompts pointing at the same thing.
 *
 *   `previousNames`  What this channel USED to be called. The sync matches a
 *                    live channel by name (Discord hands out ids, we cannot
 *                    know them in advance), so a rename with no breadcrumb
 *                    reads as "delete one, create another" — which would
 *                    abandon the history and the pins. Rename in `name`, push
 *                    the old value onto `previousNames`, sync, and the channel
 *                    is renamed in place. The entry can be dropped once every
 *                    guild you sync has been through it.
 *
 * `phase` is the other one to understand before adding channels — see PHASES.
 */

/**
 * Launch small. A server where every channel has activity reads as busy; the
 * same community spread over forty channels reads as abandoned, and that
 * impression is made in the first thirty seconds by someone who has not posted
 * yet. `sync` builds `launch` only; `--phase growth` unlocks the rest once
 * there are people to fill them.
 *
 * Growth channels that ALREADY exist are still kept in step — a phase gates
 * creation, never updates, so promoting a channel is a one-word edit and
 * demoting one never hides it from members who are using it.
 */
/**
 * @typedef {Object} RoleSpec
 * @property {string} key                stable identity — never change one
 * @property {string} name               what members see
 * @property {number} [color]
 * @property {boolean} [hoist]           shown as its own group in the member list
 * @property {boolean} [mentionable]
 * @property {boolean} [staff]           sees every private channel automatically
 * @property {string[]} [permissions]    guild-wide permission flag names
 * @property {string[]} [previousNames]  what this role used to be called
 * @property {number} [level]            progression roles only
 * @property {string} [emoji]            topic roles only
 * @property {string[]} [channels]       topic roles only — what the role unlocks
 */

/*
 * A warning about the typedefs below, learned the hard way: never write a bare
 * `@everyone` (or any other `@word`) inside a JSDoc description. TypeScript's
 * parser reads it as the start of a new tag and DISCARDS every `@property`
 * after it — the typedef silently loses half its fields and the only symptom is
 * "Property 'doc' does not exist on type 'ChannelSpec'" somewhere else entirely.
 * Say "ordinary members" instead.
 */

/**
 * @typedef {Object} ForumTagSpec
 * @property {string} name
 * @property {string} [emoji]
 * @property {boolean} [moderated]       only staff can apply it
 */

/**
 * @typedef {Object} ChannelSpec
 * @property {string} key                stable identity — never change one
 * @property {string} name
 * @property {'text'|'voice'|'announcement'|'forum'} type
 * @property {'launch'|'growth'} phase
 * @property {string} [topic]
 * @property {string[]} [previousNames]  what this channel used to be called
 * @property {boolean} [readOnly]        ordinary members cannot post
 * @property {boolean} [hidden]          ordinary members cannot see it
 * @property {string[]} [visibleTo]      role keys that can see a hidden channel
 * @property {string[]} [postableBy]     role keys that can post in a readOnly one
 * @property {number} [slowmode]         seconds between messages, per member
 * @property {string} [doc]              key into copy.mjs DOCUMENTS
 * @property {ForumTagSpec[]} [tags]     forum channels only
 */

/**
 * @typedef {Object} CategorySpec
 * @property {string} key
 * @property {string} name
 * @property {'launch'|'growth'} phase
 * @property {ChannelSpec[]} channels
 * @property {boolean} [hidden]
 * @property {string[]} [visibleTo]
 * @property {string[]} [previousNames]
 */

/**
 * @typedef {Object} OnboardingOptionSpec
 * @property {string} key
 * @property {string} title
 * @property {string} [description]
 * @property {string} [emoji]
 * @property {string[]} [roles]          role keys granted by this choice
 * @property {string[]} [channels]       channel keys unlocked by this choice
 */

/**
 * @typedef {Object} OnboardingPromptSpec
 * @property {string} key
 * @property {string} title
 * @property {boolean} [singleSelect]
 * @property {boolean} [required]
 * @property {boolean} [inOnboarding]
 * @property {OnboardingOptionSpec[]} options
 */

export const PHASES = ['launch', 'growth'];

/** Bot-authored documents carry this in `footer.text` so a re-run edits rather than duplicates. */
export const DOC_MARKER = 'dls-doc';

// ── Colors ────────────────────────────────────────────────────────────────
// Role colors read as a hierarchy in the member list, so they are picked as a
// ramp rather than one at a time: staff cool, community warm, progression
// climbing from grey to gold.
const C = {
  developer: 0x5865f2,
  moderator: 0x3ba55d,
  creator: 0xeb459e,
  vip: 0xf1c40f,
  tester: 0x9b59b6,
  veteran: 0xe67e22,
  player: 0x95a6a6,
  topic: 0x4f545c,
  progression: [
    0x99aab5, 0xb0bec5, 0x78909c, 0x4dd0e1, 0x26a69a,
    0x66bb6a, 0xffa726, 0xef5350, 0xab47bc, 0xffd54f,
  ],
};

/**
 * Roles.
 *
 * `permissions` names Discord permission flags (see PERMISSIONS in plan.mjs) —
 * these are the GUILD-wide grants, not per-channel ones. Per-channel access is
 * derived from the channel's own `readOnly` / `hidden` / `visibleTo` flags, so
 * no role here needs a channel-shaped permission.
 *
 * Order matters: Discord sorts roles by position and the sync writes them in
 * this order, highest first. A role must sit ABOVE anything it moderates.
 */
/** @type {RoleSpec[]} */
export const ROLES = [
  {
    key: 'developer',
    name: '💻 Developer',
    color: C.developer,
    hoist: true,
    mentionable: true,
    staff: true,
    permissions: ['ADMINISTRATOR'],
  },
  {
    key: 'moderator',
    name: '🛡️ Moderator',
    color: C.moderator,
    hoist: true,
    mentionable: true,
    staff: true,
    // Deliberately NOT Administrator. A moderator needs to remove a message and
    // time somebody out; nothing on this list can change the server's shape,
    // which means a compromised moderator account cannot undo the config.
    permissions: [
      'KICK_MEMBERS', 'BAN_MEMBERS', 'MODERATE_MEMBERS', 'MANAGE_MESSAGES',
      'MANAGE_THREADS', 'MANAGE_NICKNAMES', 'VIEW_AUDIT_LOG', 'MENTION_EVERYONE',
    ],
  },
  {
    key: 'creator',
    name: '🎥 Content Creator',
    color: C.creator,
    hoist: true,
    mentionable: true,
    permissions: ['ATTACH_FILES', 'EMBED_LINKS'],
  },
  {
    key: 'vip',
    name: '💎 DeepLife+',
    color: C.vip,
    hoist: true,
    mentionable: false,
    permissions: [],
  },
  {
    key: 'tester',
    name: '🧪 Beta Tester',
    color: C.tester,
    hoist: true,
    mentionable: true,
    permissions: [],
  },
  {
    key: 'veteran',
    name: '🏆 Veteran',
    color: C.veteran,
    hoist: false,
    mentionable: false,
    permissions: [],
  },
  {
    key: 'player',
    name: '🎮 Player',
    color: C.player,
    hoist: false,
    mentionable: false,
    permissions: [],
  },
];

/**
 * Topic roles — the opt-in half of onboarding.
 *
 * Each one grants a hidden channel. They exist as ROLES as well as onboarding
 * options because onboarding only runs for people JOINING: every member who is
 * already here would otherwise be locked out of the channels it gates, with no
 * way in. With a role behind it, `🎭・roles` can hand out the same access.
 */
/** @type {RoleSpec[]} */
export const TOPIC_ROLES = [
  { key: 'topic-money', name: '💰 Making Money', emoji: '💰', channels: ['investing'] },
  { key: 'topic-careers', name: '💼 Careers', emoji: '💼', channels: ['careers'] },
  { key: 'topic-business', name: '🏢 Businesses', emoji: '🏢', channels: ['businesses'] },
  { key: 'topic-property', name: '🏠 Real Estate', emoji: '🏠', channels: ['real-estate'] },
  { key: 'topic-relationships', name: '❤️ Relationships', emoji: '❤️', channels: ['relationships'] },
  { key: 'topic-underworld', name: '🌑 The Dark Web', emoji: '🌑', channels: ['dark-web'] },
  { key: 'topic-compete', name: '🏅 Competing', emoji: '🏅', channels: ['leaderboards'] },
  { key: 'topic-updates', name: '🔔 Game Updates', emoji: '🔔', channels: [] },
  { key: 'topic-beta', name: '🧪 Beta Testing', emoji: '🧪', channels: ['beta-info', 'beta-feedback'] },
];

/**
 * Progression roles.
 *
 * The ladder is cosmetic ON PURPOSE. Discord XP that converts into game
 * currency pays people to post, and what it buys is noise — the reward has to
 * be status, access and recognition, none of which can be farmed. The rewards
 * that hang off these (early announcements, beta access, a developer Q&A) are
 * things a chatty spammer gains nothing from.
 *
 * The sync CREATES these roles; awarding them on message activity is a levelling
 * bot's job (MEE6 / Carl-bot / Lurkr all read a role-per-level table). See the
 * README — this file is where you copy the level→role mapping from.
 */
/** @type {RoleSpec[]} */
export const PROGRESSION_ROLES = [
  { key: 'level-1', name: '👤 New Citizen', level: 1 },
  { key: 'level-5', name: '🧑 Resident', level: 5 },
  { key: 'level-10', name: '💼 Professional', level: 10 },
  { key: 'level-20', name: '💰 Entrepreneur', level: 20 },
  { key: 'level-30', name: '🏢 Business Tycoon', level: 30 },
  { key: 'level-40', name: '📈 Investor', level: 40 },
  { key: 'level-50', name: '💎 Millionaire', level: 50 },
  { key: 'level-75', name: '👑 Billionaire', level: 75 },
  { key: 'level-90', name: '🏛️ Dynasty', level: 90 },
  { key: 'level-100', name: '🌎 Life Legend', level: 100 },
].map((r, i) => ({ ...r, color: C.progression[i], hoist: false, mentionable: false, permissions: [] }));

// ── Channels ──────────────────────────────────────────────────────────────
//
// Channel flags, all optional and all defaulting to the permissive answer:
//
//   readOnly   @everyone cannot post. Reactions and threads stay open, because
//              a locked channel with no way to react is a channel people stop
//              opening. Staff can post.
//   hidden     @everyone cannot SEE it. Grant access with `visibleTo`.
//   visibleTo  Role keys that can see a hidden channel.
//   postableBy Role keys that can post in a readOnly channel, beyond staff.
//   slowmode   Seconds between messages, per member.
//   doc        Key into `copy.mjs` DOCUMENTS. The sync posts it and pins it,
//              and EDITS it in place on later runs.
//   tags       Forum channels only — the post tags members pick from.

/** @type {CategorySpec[]} */
export const CATEGORIES = [
  {
    key: 'start-here',
    name: '📌 START HERE',
    phase: 'launch',
    channels: [
      { key: 'welcome', name: '👋・welcome', type: 'text', phase: 'launch', readOnly: true, doc: 'welcome',
        topic: 'What Deep Life Simulator is, and where to go next.' },
      { key: 'rules', name: '📜・rules', type: 'text', phase: 'launch', readOnly: true, doc: 'rules',
        topic: 'Seven rules. Read once, then go play.' },
      { key: 'roles', name: '🎭・roles', type: 'text', phase: 'launch', readOnly: true, doc: 'roles',
        topic: 'Pick the channels you want to see.' },
      { key: 'official-links', name: '🔗・official-links', type: 'text', phase: 'launch', readOnly: true, doc: 'links',
        topic: 'Every official Deep Life Simulator link. If it is not here, it is not us.' },
      // Pre-existing, named by hand - see the note above update-notes for why
      // this keeps its plain name instead of the emoji・key convention.
      { key: 'download-ios', name: 'download-ios', type: 'text', phase: 'launch', readOnly: true,
        topic: 'How to get on iOS - App Store link and, when the App Store build is behind, the TestFlight/beta path.' },
    ],
  },
  {
    key: 'news',
    name: '📢 NEWS & UPDATES',
    phase: 'launch',
    channels: [
      // Announcement channels let other servers follow the feed, which is the
      // whole point of putting release news in one. They need the guild to be a
      // Community server; the sync degrades them to plain text with a warning
      // rather than failing, so a non-Community guild still builds.
      { key: 'announcements', name: '📢・announcements', type: 'announcement', phase: 'launch', readOnly: true,
        topic: 'This is happening. Major news only — patch detail lives in update-notes.' },
      { key: 'update-notes', name: '🚀・update-notes', type: 'announcement', phase: 'launch', readOnly: true,
        topic: 'Exactly what changed, every release. Posted automatically.' },
      // Pre-existing channels (created before this file described the server),
      // named by hand rather than via the emoji・key convention above - kept
      // as named so a sync never silently relabels something the owner
      // already pointed people at. Both are posted to by
      // scripts/notify-store-release.mjs and scripts/notify-github-hype.mjs
      // via webhook, on a schedule - see .github/workflows/discord-watchers.yml.
      { key: 'updates', name: 'updates', type: 'text', phase: 'launch', readOnly: true,
        topic: 'The live App Store / Google Play version, posted the moment it actually changes - not when it is submitted.' },
      { key: 'future-updates', name: 'future-updates', type: 'text', phase: 'launch', readOnly: true,
        topic: 'What shipped behind the scenes, batched from merged PRs - the preview before update-notes/updates makes it official.' },
      { key: 'this-week', name: '📅・this-week', type: 'text', phase: 'launch', readOnly: true, doc: 'this-week',
        topic: 'The one channel to check on a Monday. What shipped, what is live, what is next.' },
      { key: 'roadmap', name: '🔮・roadmap', type: 'text', phase: 'launch', readOnly: true,
        topic: 'Where the game is going. Not a promise of dates.' },
      { key: 'development', name: '🛠️・development', type: 'text', phase: 'growth', readOnly: true,
        topic: 'Work in progress — screenshots, experiments, things that may never ship.' },
      { key: 'polls', name: '🗳️・polls', type: 'text', phase: 'growth', readOnly: true, postableBy: ['veteran'],
        topic: 'Official polls. You decide.' },
      { key: 'events', name: '🎁・events', type: 'text', phase: 'growth', readOnly: true,
        topic: 'Limited-time events, competitions and giveaways.' },
    ],
  },
  {
    key: 'community',
    name: '💬 COMMUNITY',
    phase: 'launch',
    channels: [
      { key: 'general', name: '💬・general', type: 'text', phase: 'launch', slowmode: 3,
        topic: 'Anything. Be decent.' },
      { key: 'game-chat', name: '🎮・game-chat', type: 'text', phase: 'launch',
        topic: 'Deep Life Simulator itself — strategies, questions, what just happened in your life.' },
      { key: 'achievements', name: '🏆・achievements', type: 'text', phase: 'launch', slowmode: 30,
        topic: 'Net worth, businesses, careers, houses, heirs. Screenshot it.' },
      { key: 'screenshots', name: '📸・screenshots', type: 'text', phase: 'launch', slowmode: 30,
        topic: 'The absurd, the tragic and the extremely rich.' },
      { key: 'ideas', name: '💡・ideas', type: 'text', phase: 'launch', doc: 'ideas',
        topic: 'One idea per message so people can vote with reactions.' },
      { key: 'memes', name: '😂・memes', type: 'text', phase: 'growth', slowmode: 15,
        topic: 'Keep it about the game and keep it clean.' },
      { key: 'community-discussion', name: '🗣️・community-discussion', type: 'text', phase: 'growth',
        topic: 'Long-form talk about game systems, balance and design.' },
    ],
  },
  {
    key: 'deep-life',
    name: '💰 DEEP LIFE',
    phase: 'launch',
    // Every channel here is opt-in: hidden from @everyone and handed out by the
    // onboarding prompt (and by 🎭・roles for members who joined before it).
    // That is what stops a new player meeting forty channels at once.
    channels: [
      { key: 'careers', name: '💼・careers', type: 'text', phase: 'launch', hidden: true, visibleTo: ['topic-careers'],
        topic: 'Job ladders, promotions, salary negotiation, the political track.' },
      { key: 'investing', name: '📈・investing', type: 'text', phase: 'launch', hidden: true, visibleTo: ['topic-money'],
        topic: 'Stocks, crypto, mining, and losing it all in one week.' },
      { key: 'real-estate', name: '🏠・real-estate', type: 'text', phase: 'launch', hidden: true, visibleTo: ['topic-property'],
        topic: 'Renting, buying, flipping, and what the upkeep actually costs.' },
      { key: 'businesses', name: '🏢・businesses', type: 'text', phase: 'growth', hidden: true, visibleTo: ['topic-business'],
        topic: 'Founding, hiring, scaling, selling.' },
      { key: 'relationships', name: '❤️・relationships', type: 'text', phase: 'growth', hidden: true, visibleTo: ['topic-relationships'],
        topic: 'Spark, dating, marriage, children, heirs.' },
      { key: 'dark-web', name: '🌑・dark-web', type: 'text', phase: 'growth', hidden: true, visibleTo: ['topic-underworld'],
        topic: 'The in-game underworld: street jobs, gear, heat and prison. Fiction only — see rule 4.' },
      { key: 'leaderboards', name: '🏅・leaderboards', type: 'text', phase: 'growth', hidden: true, visibleTo: ['topic-compete'],
        readOnly: true, topic: 'Standings. Submissions go in achievements.' },
    ],
  },
  {
    key: 'support',
    name: '🆘 SUPPORT',
    phase: 'launch',
    channels: [
      { key: 'help', name: '🆘・help', type: 'text', phase: 'launch',
        topic: 'Stuck? Ask here. For crashes and payment problems use the channels below.' },
      // A forum, not a text channel. "game broken" in a 500-message channel is
      // not a bug report; a forum post carries a title, tags and its own thread,
      // so a report can be triaged, answered and marked Fixed without scrolling.
      // The template lives in the post guidelines (`doc`).
      {
        key: 'bug-reports', name: '🐛・bug-reports', type: 'forum', phase: 'launch', doc: 'bug-reports',
        topic: 'One post per bug. Fill in the template — a report without a version and a device cannot be fixed.',
        tags: [
          { name: 'iOS', emoji: '🍎' },
          { name: 'Android', emoji: '🤖' },
          { name: 'Crash', emoji: '💥' },
          { name: 'Money / Economy', emoji: '💰' },
          { name: 'Save / Progress', emoji: '💾' },
          { name: 'UI', emoji: '🎨' },
          { name: 'Needs info', emoji: '❓', moderated: true },
          { name: 'Confirmed', emoji: '✅', moderated: true },
          { name: 'Fixed next update', emoji: '🛠️', moderated: true },
        ],
      },
      { key: 'known-issues', name: '⚠️・known-issues', type: 'text', phase: 'launch', readOnly: true,
        topic: 'Confirmed problems and where the fix is. Check before reporting.' },
      { key: 'purchase-support', name: '💳・purchase-support', type: 'text', phase: 'growth',
        topic: 'Purchases, DeepLife+, restores. Never post a receipt with your full email or order id.' },
      { key: 'technical-support', name: '📱・technical-support', type: 'text', phase: 'growth',
        topic: 'Crashes, devices, cloud saves, login.' },
    ],
  },
  {
    key: 'testing',
    name: '🧪 TESTING',
    phase: 'launch',
    channels: [
      { key: 'beta-info', name: '🧪・beta-info', type: 'text', phase: 'launch', readOnly: true, doc: 'beta-info',
        hidden: true, visibleTo: ['topic-beta', 'tester'],
        topic: 'How to join the beta, and what is expected of a tester.' },
      { key: 'beta-feedback', name: '🧪・beta-feedback', type: 'text', phase: 'launch',
        hidden: true, visibleTo: ['topic-beta', 'tester'],
        topic: 'What the build felt like. Impressions belong here; reproducible faults go in beta-bugs.' },
      { key: 'beta-bugs', name: '🐛・beta-bugs', type: 'text', phase: 'growth',
        hidden: true, visibleTo: ['topic-beta', 'tester'],
        topic: 'Faults found in a beta build only. Same template as bug-reports.' },
      { key: 'experimental', name: '🔬・experimental', type: 'text', phase: 'growth',
        hidden: true, visibleTo: ['topic-beta', 'tester'],
        topic: 'Features being tried before anyone commits to them. Say if you hate it.' },
    ],
  },
  {
    key: 'creator-hub',
    name: '🎨 CREATOR HUB',
    phase: 'growth',
    channels: [
      { key: 'content-creators', name: '🎥・content-creators', type: 'text', phase: 'growth',
        topic: 'For people making Deep Life content. Ask about the Content Creator role here.' },
      { key: 'videos', name: '📹・videos', type: 'text', phase: 'growth', postableBy: ['creator'], readOnly: true,
        topic: 'Community videos.' },
      { key: 'fan-art', name: '🎨・fan-art', type: 'text', phase: 'growth',
        topic: 'Your own work only.' },
      { key: 'creator-showcase', name: '⭐・creator-showcase', type: 'text', phase: 'growth', readOnly: true,
        topic: 'Picked by the team.' },
    ],
  },
  {
    key: 'voice',
    name: '🔊 VOICE',
    phase: 'launch',
    channels: [
      { key: 'vc-general', name: '🔊・General', type: 'voice', phase: 'launch' },
      { key: 'vc-gaming', name: '🎮・Gaming', type: 'voice', phase: 'growth' },
      { key: 'vc-chill', name: '💬・Chill', type: 'voice', phase: 'growth' },
    ],
  },
  {
    key: 'staff',
    name: '👑 STAFF',
    phase: 'launch',
    // Hidden at the CATEGORY level and again on every channel. Discord resolves
    // a channel's own overwrites over its parent's, so a channel that inherited
    // its privacy would be exposed by anyone adding a single overwrite to it —
    // which is exactly the edit someone makes in a hurry.
    hidden: true,
    visibleTo: ['developer', 'moderator'],
    channels: [
      { key: 'staff-chat', name: '👑・staff-chat', type: 'text', phase: 'launch', hidden: true, visibleTo: ['developer', 'moderator'] },
      { key: 'mod-alerts', name: '🚨・mod-alerts', type: 'text', phase: 'launch', hidden: true, visibleTo: ['developer', 'moderator'] },
      { key: 'moderation-log', name: '📋・moderation-log', type: 'text', phase: 'launch', hidden: true, visibleTo: ['developer', 'moderator'] },
      { key: 'server-analytics', name: '📊・analytics', type: 'text', phase: 'growth', hidden: true, visibleTo: ['developer', 'moderator'] },
      { key: 'internal-dev', name: '🛠️・internal-dev', type: 'text', phase: 'launch', hidden: true, visibleTo: ['developer'] },
    ],
  },
];

/**
 * Where orphans go under `--prune`.
 *
 * Not a deletion. A channel carries conversations that nobody can get back, and
 * "it is missing from a config file" is not evidence that the conversations are
 * worthless — most often it means somebody made the channel in the Discord UI
 * and never came back here. Archiving hides it from members, keeps it readable
 * by staff, and leaves the decision to delete with a person.
 */
export const ARCHIVE_CATEGORY = { key: 'archive', name: '🗄️ ARCHIVE', hidden: true, visibleTo: ['developer', 'moderator'] };

/**
 * Discord Onboarding — the "what are you interested in?" screen.
 *
 * `mode: 'advanced'` counts these opt-in choices toward Discord's own
 * requirements, which is what lets the default channel list stay as short as it
 * is. Requires the guild to be a Community server.
 */
/** @type {{defaultChannels: string[], prompts: OnboardingPromptSpec[]}} */
export const ONBOARDING = {
  /** Everything a member sees before choosing anything. Keep it tiny. */
  defaultChannels: ['welcome', 'rules', 'roles', 'official-links', 'announcements', 'this-week', 'general', 'game-chat', 'help'],
  prompts: [
    {
      key: 'interests',
      title: 'What do you want to talk about?',
      // Multi-select and skippable: this decides which channels exist for them,
      // and a forced single choice would hide six channels to save one tap.
      singleSelect: false,
      required: false,
      inOnboarding: true,
      options: TOPIC_ROLES.filter((r) => r.channels.length > 0).map((r) => ({
        key: r.key,
        title: r.name,
        description: undefined,
        emoji: r.emoji,
        roles: [r.key],
        channels: r.channels,
      })),
    },
    {
      key: 'player-type',
      title: 'How do you play?',
      singleSelect: false,
      required: false,
      inOnboarding: true,
      options: [
        { key: 'topic-updates', title: '🔔 Tell me when the game updates', emoji: '🔔', roles: ['topic-updates'], channels: [] },
        { key: 'topic-beta', title: '🧪 I want to test unreleased builds', emoji: '🧪', roles: ['topic-beta'], channels: ['beta-info', 'beta-feedback'] },
      ],
    },
  ],
};

/**
 * Every role the config defines, in write order (highest first).
 * @returns {RoleSpec[]}
 */
export function allRoles() {
  return [
    ...ROLES,
    ...TOPIC_ROLES.map((r) => ({ ...r, color: C.topic, hoist: false, mentionable: false, permissions: [] })),
    ...PROGRESSION_ROLES,
  ];
}

/**
 * Every channel the config defines, flattened, each carrying its parent category key.
 * @returns {(ChannelSpec & {category: string})[]}
 */
export function allChannels() {
  return CATEGORIES.flatMap((cat) => cat.channels.map((ch) => ({ ...ch, category: cat.key })));
}
