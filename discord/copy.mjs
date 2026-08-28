/**
 * Everything the bot writes: the pinned documents, the release post, the
 * announcement shell.
 *
 * These live in the repo rather than in Discord for the same reason the channel
 * list does — a rules post edited in the client is a rules post nobody can
 * review, diff or roll back. The sync EDITS these in place, so fixing a typo is
 * a commit and a `discord:sync`, not a hunt through scrollback.
 *
 * Every document is posted as an embed carrying `dls-doc:<key>` in its footer.
 * That marker is the whole idempotency mechanism: on a later run the bot looks
 * for its own message with that footer and edits it. Change a footer key and
 * the next sync posts a duplicate.
 */

import { DOC_MARKER, PROGRESSION_ROLES, TOPIC_ROLES } from './server.mjs';

/**
 * Official links.
 *
 * Kept in step with `lib/config/appConfig.ts` by
 * `__tests__/tooling/discordConfig.test.ts`, which reads that file and fails if
 * either side drifts. They are the same links shown in-app, and a support
 * channel handing out a URL the app does not use is the exact shape of a
 * phishing tell — which is the reasoning already written next to
 * `DISCORD_INVITE_LABEL` in appConfig.
 */
export const LINKS = {
  appStore: 'https://apps.apple.com/us/app/deep-life-simulator/id6749675615',
  playStore: 'https://play.google.com/store/apps/details?id=com.deeplife.simulator',
  betaHub: 'https://wrexist.github.io/DeepLifeSimulator/android/',
  privacy: 'https://wrexist.github.io/DeepLifeSimulator/privacy.html',
  support: 'deeplifesimulator@gmail.com',
  discord: 'https://discord.gg/rzktazdX8v',
};

/** Embed accent colors, matched to the category the document sits in. */
const ACCENT = {
  welcome: 0x5865f2,
  rules: 0xed4245,
  roles: 0x9b59b6,
  links: 0x3ba55d,
  thisWeek: 0xf1c40f,
  ideas: 0xeb459e,
  bugs: 0xe67e22,
  roadmap: 0x8e44ad,
  beta: 0x9b59b6,
  release: 0x5865f2,
  levels: 0xf59e0b,
};

const topicList = TOPIC_ROLES.map((r) => `${r.emoji} **${r.name.replace(/^\S+\s/, '')}**`).join(' · ');

const progressionLadder = PROGRESSION_ROLES
  .map((r) => `\`Lv ${String(r.level).padStart(3)}\`  ${r.name}`)
  .join('\n');

// The same ladder with each rank's reward. Rendered from PROGRESSION_ROLES so
// the promise printed here and the permission granted by `atLeastLevel()` in
// server.mjs cannot drift: a rank whose room is removed loses its line here in
// the same edit. A rank with no `unlock` prints the title alone, deliberately.
const progressionRewards = PROGRESSION_ROLES
  .map((r) => `\`Lv ${String(r.level).padStart(3)}\`  ${r.name}${r.unlock ? `\n${' '.repeat(8)}${r.unlock}` : ''}`)
  .join('\n');

/**
 * The pinned documents, by key. A channel opts in with `doc: '<key>'`.
 *
 * `body` is Discord-flavoured markdown and must stay under 4096 characters —
 * `validateDocuments()` enforces it, because Discord answers an over-long embed
 * with a 400 that names the field and not the channel.
 */
/** @type {Record<string, {title: string, accent: number, body: string}>} */
export const DOCUMENTS = {
  welcome: {
    title: '👋 Welcome to Deep Life Simulator',
    accent: ACCENT.welcome,
    body: [
      'Build a career. Make money. Buy property. Start a business. Fall in love, have children, and leave something behind — or lose all of it and start again.',
      '',
      '**Start here**',
      '📜 <#rules> — seven rules, thirty seconds.',
      '🎭 <#roles> — pick what you want to see. The server hides the rest.',
      '🔗 <#official-links> — every real link. If a link is not there, it is not us.',
      '',
      '**Then**',
      '💬 <#general> — say hello.',
      '🏆 <#achievements> — show what you have built.',
      '🐛 <#bug-reports> — found something broken? This is the fastest way to get it fixed.',
      '📅 <#this-week> — one post, every week, on everything that changed.',
      '',
      '**One thing worth knowing:** the ideas people post here ship. <#ideas> is read before every update, and the change log says so when a suggestion makes it in.',
    ].join('\n'),
  },

  rules: {
    title: '📜 Rules',
    accent: ACCENT.rules,
    body: [
      '**1. Be decent.** Disagree about the game as much as you like. Attacks on people are not part of that.',
      '',
      '**2. No harassment, hate or slurs.** No warnings for this one.',
      '',
      '**3. Keep it safe for work.** No sexual content, gore or shock material anywhere on the server.',
      '',
      '**4. The dark web in the game stays in the game.** Deep Life has fictional crime in it. Talking about the in-game systems is fine. Real illegal activity — sourcing, buying, hacking, fraud, piracy — is not, and it is the one topic that gets a ban without a conversation.',
      '',
      '**5. No cheats, mods, hacked saves or paid accounts.** Sharing them takes the game away from everyone else who plays it honestly.',
      '',
      '**6. No advertising or DM soliciting.** Creators, see the Creator Hub — there is a proper place for your links.',
      '',
      '**7. Never post your receipt, order id, or full email.** Not even in <#purchase-support>. Staff will never DM you first, never ask for a password, and never ask you to pay for anything outside the App Store or Google Play. Anyone who does is not us — report them.',
      '',
      '_Discord\'s [Terms](https://discord.com/terms) and [Community Guidelines](https://discord.com/guidelines) apply on top of these. Staff decisions are final; if you think one was wrong, say so in a DM to a moderator rather than in channel._',
    ].join('\n'),
  },

  roles: {
    title: '🎭 Pick your channels',
    accent: ACCENT.roles,
    body: [
      'This server does not show you forty channels on the way in. You choose what you care about and the rest stays out of the way — you can change it any time.',
      '',
      '**New here?** The choices appear as you join. Nothing to do.',
      '',
      `**Joined earlier?** React below and the channel appears for you.\n\n${topicList}`,
      '',
      '**Roles you earn**',
      '🧪 **Beta Tester** — join the beta and post real feedback. Ask in <#beta-info>.',
      '🎥 **Content Creator** — making Deep Life videos or streams. Ask in <#content-creators>.',
      '🏆 **Veteran** — around long enough, and helpful enough, that people recognise you.',
      '💎 **DeepLife+** — a member of the subscription.',
      '',
      '**Roles you level into**',
      'Talking here earns levels, and levels earn titles:',
      '',
      progressionLadder,
      '',
      '_What each rank unlocks is in <#levels>. Levels deliberately do **not** buy in-game money — paying people to post is how a server fills up with people posting for the sake of it._',
    ].join('\n'),
  },

  levels: {
    title: '🏅 Ranks',
    accent: ACCENT.levels,
    body: [
      'Talking here earns experience, and experience earns rank. Ten of them, from the day you arrive to the top of the ladder.',
      '',
      progressionRewards,
      '',
      '**How experience is earned**',
      'Posting in any public channel. There is a short cooldown between messages that count, so a conversation earns and a wall of one-word replies does not - the fastest way up is to be someone worth talking to.',
      '',
      '**What ranks never buy**',
      'In-game money, gems, or anything that touches your save. Paying people to post buys posts, and what that produces is noise. Ranks buy status, earlier news, and access to the people building the game.',
      '',
      '_Rooms you have not reached yet are invisible rather than locked - nothing here is a door you can rattle. Reach the rank and the room simply appears._',
    ].join('\n'),
  },

  links: {
    title: '🔗 Official links',
    accent: ACCENT.links,
    body: [
      'These are the only official Deep Life Simulator links. Anything else — a "free gems" site, a download mirror, a giveaway DM — is not us.',
      '',
      `🍎 **App Store** — ${LINKS.appStore}`,
      `🤖 **Google Play** — ${LINKS.playStore}`,
      `🧪 **Android Beta Hub** — ${LINKS.betaHub}`,
      `🔒 **Privacy Policy** — ${LINKS.privacy}`,
      `📧 **Support email** — ${LINKS.support}`,
      `💬 **This server** — ${LINKS.discord}`,
      '',
      '**Staff will never** DM you first, ask for your password, ask you to install anything, or take payment anywhere except the App Store and Google Play.',
      '',
      '_A note on version numbers: the store shows one number and the app shows another. That is deliberate and not a sign of a fake build — quote the number from Settings → About when you report a bug._',
    ].join('\n'),
  },

  'this-week': {
    title: '📅 This week in Deep Life',
    accent: ACCENT.thisWeek,
    body: [
      'One post a week, pinned here, covering everything that moved:',
      '',
      '🚀 **Shipped** — what went out and what it changes.',
      '🎁 **Live now** — events, offers and anything time-limited.',
      '💡 **From you** — suggestions from <#ideas> that made it in.',
      '🐛 **Fixed** — reports from <#bug-reports> that are done.',
      '🔮 **Next** — what is being built right now.',
      '',
      '_If you only open one channel, open this one._',
    ].join('\n'),
  },

  ideas: {
    title: '💡 How to suggest something',
    accent: ACCENT.ideas,
    body: [
      '**One idea per message.** That is the whole format — it lets everyone else vote with a reaction, and it lets a good idea be found again three months later.',
      '',
      'What helps:',
      '• What you were doing when you wanted it.',
      '• What the game does now, and what you wish it did.',
      '• Why it would make the game better for someone who is not you.',
      '',
      'What happens next: this channel is read before every update. Ideas that ship get named in <#this-week> and in the in-game change log — you will be able to point at the thing you asked for.',
      '',
      '_Not every idea can ship, and some are already built and waiting. A "no" here is usually a "not this way" — ask._',
    ].join('\n'),
  },

  roadmap: {
    title: '🔮 Where Deep Life is going',
    accent: ACCENT.roadmap,
    body: [
      'No dates here on purpose — a roadmap that promises a date turns into a countdown to disappointment. This is the direction, updated as it changes, and <#this-week> is where "it shipped" actually gets announced.',
      '',
      '**In progress**',
      '💎 **Your collection, remembered** — buying the island stops being a line item. Big purchases become moments worth looking back on, and a completed collection means something across every life you play, not just this one.',
      '📈 **A stock market that actually moves** — sector trends and the news ticker start pushing the SAME prices you trade on, not a shadow copy only the game can see.',
      '🏠 **A house you can actually live in** — decoration, room upgrades and additions that show up, not just a number on a receipt.',
      '',
      '**Being designed**',
      '💒 **Exclusive invitations** — host a gala at your venue today; being invited to someone else\'s (the owners\' enclosure, a stadium box, a launch party) is next.',
      '🎓 **Classes that pay off** — enroll, actually attend, and watch it change your stats and your job prospects.',
      '📺 **Streaming and content that grows** — numbers that move because you are actually live, not because a timer ticked.',
      '',
      '**Where ideas for this list come from**',
      'Almost entirely <#ideas>. If you want to know why something is or is not on here, ask — a lot of "not on the roadmap" is really "tell me more."',
    ].join('\n'),
  },

  'bug-reports': {
    title: '🐛 Reporting a bug',
    accent: ACCENT.bugs,
    /**
     * This one becomes a forum channel's POST GUIDELINES rather than a pinned
     * message — see `resolveForumGuidelines`. A forum enforces the shape a
     * text channel only asks for: every report gets a title, tags and its own
     * thread, so "game broken" cannot bury the report underneath it.
     */
    body: [
      'One post per bug, please — a post can be tagged, answered and marked fixed. A message in a stream of five hundred cannot.',
      '',
      '**Title:** what broke, in a few words. "Crash when opening Market" — not "help".',
      '',
      '**Then paste this and fill it in:**',
      '```',
      'Device:      iPhone 15 / Pixel 8 / ...',
      'OS version:  iOS 26.1 / Android 15',
      'App version: Settings → About (e.g. 2.10.0)',
      'What happened:',
      'What you expected:',
      'Steps to reproduce:',
      '  1.',
      '  2.',
      'Every time, or just once?',
      'Screenshot or screen recording:',
      '```',
      '',
      '**The three that matter most** are the app version, the device, and the steps. A report without them usually cannot be reproduced, and a bug that cannot be reproduced cannot be fixed — that is what the ❓ Needs info tag means when you see it on your post.',
      '',
      '**Tag your post** with the platform and the area (Crash, Money / Economy, Save / Progress, UI). Staff add ✅ Confirmed and 🛠️ Fixed next update as it moves.',
      '',
      '**Before you post,** check <#known-issues> — it may already be on the list with a fix on the way.',
      '',
      '**Never post a receipt, order id or your full email**, here or anywhere else on the server.',
    ].join('\n'),
  },

  'beta-info': {
    title: '🧪 Joining the beta',
    accent: ACCENT.beta,
    body: [
      'Beta builds go out before release. They are more interesting and less stable — that is the trade.',
      '',
      `**Android** — join through the Beta Hub: ${LINKS.betaHub}`,
      '**iOS** — TestFlight invites go out here first. Ask and you are on the list.',
      '',
      '**What is expected**',
      '• Play normally and say what felt wrong, in <#beta-feedback>.',
      '• Anything reproducible goes in <#beta-bugs>, with the build number.',
      '• Do not post screenshots of unreleased features outside this category.',
      '',
      '**What you get**: the 🧪 Beta Tester role, features weeks early, and a real say in what ships — beta feedback has changed releases more than once.',
      '',
      '_Beta saves are real saves. They are also the ones most likely to meet a new bug — keep a cloud backup before you start._',
    ].join('\n'),
  },
};

/**
 * The embed footer that lets a later run find and edit this exact message.
 * @param {string} key
 */
export function docFooter(key) {
  return `${DOC_MARKER}:${key} · edited automatically — do not copy this message`;
}

/**
 * True when a message is the bot's own copy of `key`.
 * @param {{embeds?: {footer?: {text?: string}}[]}|null|undefined} message
 * @param {string} key
 */
export function isDocMessage(message, key) {
  return (message?.embeds ?? []).some((e) => (e?.footer?.text ?? '').startsWith(`${DOC_MARKER}:${key}`));
}

/**
 * A document as a Discord message payload.
 * @param {string} key
 * @param {Record<string, string|null>} [channelIds]
 * @returns {{embeds: {title: string, description: string, color: number, footer: {text: string}}[]}}
 */
export function renderDocument(key, channelIds = {}) {
  const doc = DOCUMENTS[key];
  if (!doc) throw new Error(`Unknown document "${key}"`);
  return {
    embeds: [{
      title: doc.title,
      description: linkChannels(doc.body, channelIds),
      color: doc.accent,
      footer: { text: docFooter(key) },
    }],
  };
}

/**
 * Turn `<#channel-key>` into a real Discord channel mention.
 *
 * The documents are written against channel KEYS because ids do not exist until
 * the channel does, and a document that hard-coded them could only ever be
 * written after the sync that needs it. An unresolved key degrades to its own
 * name in bold rather than rendering as literal `<#ideas>`, so a document is
 * still readable in a guild where that channel has not been built yet.
 */
/**
 * @param {string} body
 * @param {Record<string, string|null>} channelIds
 */
export function linkChannels(body, channelIds) {
  return body.replace(/<#([a-z0-9-]+)>/g, (whole, key) => {
    const id = channelIds[key];
    return id ? `<#${id}>` : `**#${key}**`;
  });
}

/**
 * Forum channels take their guidance as the channel's post guidelines, not as a
 * pinned message — posting into a forum would create a thread, and a permanent
 * "read this first" thread is exactly what the guidelines field is for.
 *
 * @param {import('./server.mjs').CategorySpec[]} categories
 * @returns {import('./server.mjs').CategorySpec[]}
 */
export function resolveForumGuidelines(categories) {
  return categories.map((category) => ({
    ...category,
    channels: category.channels.map((channel) => {
      if (channel.type !== 'forum' || !channel.doc) return channel;
      const doc = DOCUMENTS[channel.doc];
      if (!doc) throw new Error(`Channel "${channel.key}" references unknown document "${channel.doc}"`);
      // `doc` is dropped so the message pass skips this channel entirely.
      const { doc: _doc, ...rest } = channel;
      return { ...rest, topic: `${doc.title}\n\n${doc.body}` };
    }),
  }));
}

/** Discord's embed limits. Over one of them is a 400 naming the field, not the channel. */
const EMBED = { title: 256, description: 4096, footer: 2048, forumGuidelines: 4096 };

// ── Release + announcement posts ──────────────────────────────────────────

/**
 * The release post.
 *
 * **The version here is the STORE version, not `package.json`.** Those are
 * different numbers on purpose and have been since 1.2.7 — the App Store
 * Connect version record is what players see on the product page (1.5.x), while
 * `package.json` is the binary (2.10.x) that TestFlight and crash reports use.
 * CLAUDE.md §9 has the reasoning. Announcing the binary number to players would
 * name a version that does not exist on either store, so
 * `__tests__/tooling/discordRelease.test.ts` pins this.
 *
 * The body is `APPLE.whatsNew` from `marketing/aso/metadata.mjs` — the same
 * copy Apple is sent, verbatim. One release described twice is one release
 * where a reader who finds them disagreeing cannot tell which is the lie.
 *
 * @param {{storeVersion: string, whatsNew: string, buildVersion?: string}} input
 * @returns {{embeds: {title: string, description: string, color: number, fields: {name: string, value: string, inline: boolean}[], footer: {text: string}}[]}}
 */
export function renderReleasePost({ storeVersion, whatsNew, buildVersion }) {
  if (!storeVersion) throw new Error('renderReleasePost needs a storeVersion (marketing/aso/metadata.mjs APPLE.storeVersion)');
  if (!whatsNew || !whatsNew.trim()) throw new Error('renderReleasePost needs the release copy (APPLE.whatsNew)');

  const [headline, ...rest] = whatsNew.trim().split('\n');
  const detail = rest.join('\n').trim();
  const description = [`**${headline.trim()}**`, '', detail].join('\n');

  // Refused, not truncated. `APPLE.whatsNew` may be up to 4000 characters and
  // the bold headline plus the blank line push a full-length one past Discord's
  // 4096, so this is reachable. Cutting it silently is the exact failure this
  // repo already pays for on the App Store side — Apple truncates a long
  // subtitle mid-word with no error, which is why `check-aso.mjs` exists. A
  // release post that stops mid-sentence in front of the whole community is
  // worse than a command that refuses to send.
  if ([...description].length > EMBED.description) {
    throw new Error(
      `The release copy is ${[...description].length} characters and Discord allows ${EMBED.description}. ` +
      'Shorten APPLE.whatsNew in marketing/aso/metadata.mjs, or post the long form as an announcement with a link.',
    );
  }

  return {
    embeds: [{
      title: `🚀 Deep Life Simulator ${storeVersion} is live`,
      description,
      color: ACCENT.release,
      fields: [
        { name: '🍎 App Store', value: `[Update now](${LINKS.appStore})`, inline: true },
        { name: '🤖 Google Play', value: `[Update now](${LINKS.playStore})`, inline: true },
      ],
      footer: {
        // The binary version goes in the footer, small, where it helps a bug
        // report line up with a crash log — and nowhere near the headline,
        // where it would read as the version to look for in the store.
        text: buildVersion ? `Build ${buildVersion} · report anything odd in #bug-reports` : 'Report anything odd in #bug-reports',
      },
    }],
  };
}

/** A plain announcement. */
/**
 * @param {{title: string, body: string, color?: number}} input
 * @returns {{embeds: {title: string, description: string, color: number}[]}}
 */
export function renderAnnouncement({ title, body, color = ACCENT.welcome }) {
  if (!title?.trim()) throw new Error('An announcement needs a title.');
  if (!body?.trim()) throw new Error('An announcement needs a body.');
  if ([...title.trim()].length > EMBED.title) {
    throw new Error(`Announcement title is ${[...title.trim()].length} characters; Discord allows ${EMBED.title}.`);
  }
  if ([...body.trim()].length > EMBED.description) {
    throw new Error(`Announcement body is ${[...body.trim()].length} characters; Discord allows ${EMBED.description}. Split it, or link to the long version.`);
  }
  return { embeds: [{ title: title.trim(), description: body.trim(), color }] };
}

// ── Validation ────────────────────────────────────────────────────────────

/**
 * @param {import('./server.mjs').CategorySpec[]} categories
 * @returns {{errors: string[], warnings: string[]}}
 */
export function validateDocuments(categories) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  const channelKeys = new Set(categories.flatMap((c) => c.channels.map((ch) => ch.key)));
  const used = new Set();

  for (const [key, doc] of Object.entries(DOCUMENTS)) {
    if ([...doc.title].length > EMBED.title) errors.push(`Document "${key}" title is ${[...doc.title].length} characters; Discord allows ${EMBED.title}.`);
    if ([...doc.body].length > EMBED.description) errors.push(`Document "${key}" body is ${[...doc.body].length} characters; Discord allows ${EMBED.description}.`);
    if ([...docFooter(key)].length > EMBED.footer) errors.push(`Document "${key}" footer is too long.`);

    for (const [, ref] of doc.body.matchAll(/<#([a-z0-9-]+)>/g)) {
      if (!channelKeys.has(ref)) errors.push(`Document "${key}" links <#${ref}>, which is not a channel in this config.`);
    }
  }

  for (const category of categories) {
    for (const channel of category.channels) {
      if (!channel.doc) continue;
      used.add(channel.doc);
      if (!DOCUMENTS[channel.doc]) errors.push(`Channel "${channel.key}" references unknown document "${channel.doc}".`);
      if (channel.type === 'forum') {
        const doc = DOCUMENTS[channel.doc];
        const length = doc ? [...`${doc.title}\n\n${doc.body}`].length : 0;
        if (length > EMBED.forumGuidelines) {
          errors.push(`Forum "${channel.key}" guidelines are ${length} characters; Discord allows ${EMBED.forumGuidelines}.`);
        }
      }
    }
  }

  for (const key of Object.keys(DOCUMENTS)) {
    if (!used.has(key)) warnings.push(`Document "${key}" is not attached to any channel — nothing will ever post it.`);
  }

  return { errors, warnings };
}
