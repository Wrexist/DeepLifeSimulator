/**
 * The Discord-as-code system (`discord/`).
 *
 * What is pinned here is mostly the ways this class of tool goes wrong, because
 * every one of them is silent: it does not throw, it just leaves a live
 * community server in a state nobody chose.
 *
 *  1. Permission bits computed as Numbers. `1 << 35` is `8` in JavaScript, so a
 *     `Number` implementation grants MANAGE_GUILD where it meant
 *     SEND_MESSAGES_IN_THREADS — and looks completely normal in the diff.
 *  2. A matcher that does not know how Discord rewrites names, which creates a
 *     duplicate of every channel on every run.
 *  3. A rename read as "delete one, create another", abandoning the history.
 *  4. A sync that revokes the per-member access a moderator granted by hand.
 *  5. A release post carrying `package.json`'s version — the binary number
 *     (2.x), which exists on neither store, instead of the App Store version
 *     record players actually see (1.x). CLAUDE.md §9.
 *
 * Everything here runs offline. No token, no guild, no network.
 */

import fs from 'node:fs';
import path from 'node:path';

type PlanModule = typeof import('../../discord/plan.mjs');
type CopyModule = typeof import('../../discord/copy.mjs');
type ServerModule = typeof import('../../discord/server.mjs');

let P: PlanModule;
let Copy: CopyModule;
let S: ServerModule;

const GUILD_ID = '999';

beforeAll(async () => {
  P = await import('../../discord/plan.mjs');
  Copy = await import('../../discord/copy.mjs');
  S = await import('../../discord/server.mjs');
});

/**
 * Structural stand-ins for the shapes `discord/plan.mjs` declares in JSDoc.
 * They are matched by shape, not by name, so a change to the module's types
 * shows up here as a compile error rather than a silently-skipped assertion.
 */
interface LiveChannel {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
  position?: number;
  topic?: string | null;
  rate_limit_per_user?: number;
  permission_overwrites?: { id: string; type: number; allow: string; deny: string }[];
  available_tags?: { name: string; moderated?: boolean; emoji_name?: string | null }[];
}

/** Fails the test at the point of the missing value, rather than at its first use. */
function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new Error(`expected ${what} to be present`);
  return value;
}

type ChannelPlan = ReturnType<PlanModule['planChannels']>;
type ChannelOp = ChannelPlan['operations'][number];

/** The operation for one channel key, or a failure naming the key. */
const opFor = (plan: ChannelPlan, key: string): ChannelOp =>
  must(plan.operations.find((o) => o.key === key), `an operation for "${key}"`);

/** The request body of an operation, or a failure naming it. */
const bodyOf = (op: ChannelOp) => must(op.body, `a body on ${op.op} ${op.key}`);

/** Role keys → fake ids, so overwrite derivation has something to point at. */
const fakeRoleIds = () => Object.fromEntries(S.allRoles().map((r, i) => [r.key, `role-${i}`]));

const planBase = () => ({
  categories: Copy.resolveForumGuidelines(S.CATEGORIES),
  roleIds: fakeRoleIds(),
  everyoneId: GUILD_ID,
  staffRoleKeys: S.allRoles().filter((r) => r.staff).map((r) => r.key),
  phase: 'launch',
  community: true,
});

/**
 * Turn a plan's create bodies into the channels Discord would then be holding.
 *
 * Crucially it applies Discord's own name rewriting (text-like names are
 * lowercased) - a simulation that echoed the requested name back would make the
 * duplicate-creating bug invisible, which is the single bug this whole matching
 * layer exists to prevent.
 */
function applyPlan(operations: ReturnType<PlanModule['planChannels']>['operations']): LiveChannel[] {
  const TEXTY = new Set([0, 5, 15]);
  const live: LiveChannel[] = [];
  const ids = new Map<string, string>();
  let seq = 0;

  for (const op of operations) {
    if (op.op !== 'create-category' && op.op !== 'create-channel') continue;
    const body = must(op.body, `a body on ${op.op} ${op.key}`);
    const id = `live-${++seq}`;
    if (op.op === 'create-category') ids.set(op.key, id);
    const type = must(body.type, `a type on ${op.key}`);
    live.push({
      id,
      name: TEXTY.has(type) ? String(body.name).toLowerCase().replace(/\s+/g, '-') : String(body.name),
      type,
      parent_id: op.op === 'create-channel' ? ids.get(String(op.parentKey)) ?? null : null,
      position: body.position ?? 0,
      topic: body.topic ?? null,
      rate_limit_per_user: body.rate_limit_per_user ?? 0,
      ...(body.available_tags ? { available_tags: body.available_tags } : {}),
      permission_overwrites: body.permission_overwrites ?? [],
    });
  }
  return live;
}

describe('permission bits', () => {
  it('uses BigInt, so flags above bit 31 are not silently the wrong permission', () => {
    // The trap, stated: JavaScript's `<<` is a 32-bit signed operation.
    expect(1 << 35).toBe(8);
    expect(P.PERMISSIONS.CREATE_PUBLIC_THREADS).toBe(1n << 35n);
    expect(P.PERMISSIONS.SEND_MESSAGES_IN_THREADS).toBe(1n << 38n);
    expect(P.PERMISSIONS.MODERATE_MEMBERS).toBe(1n << 40n);
    expect(P.PERMISSIONS.SEND_POLLS).toBe(1n << 49n);
  });

  it('serialises to the decimal string Discord expects', () => {
    expect(P.permissionBits(['SEND_MESSAGES_IN_THREADS'])).toBe('274877906944');
    expect(P.permissionBits([])).toBe('0');
    expect(P.permissionBits(['VIEW_CHANNEL', 'SEND_MESSAGES'])).toBe('3072');
  });

  it('refuses a permission name it does not know rather than granting nothing', () => {
    // Silently ignoring a typo would produce a role with fewer permissions than
    // the config asks for, and nothing anywhere would say so.
    expect(() => P.permissionBits(['MANAGE_EVERYTHING'])).toThrow(/Unknown Discord permission/);
  });
});

describe('name normalization', () => {
  it('lowercases text-like names the way Discord does', () => {
    expect(P.normalizeChannelName('📅・This Week', 'text')).toBe('📅・this-week');
    expect(P.normalizeChannelName('🐛・Bug-Reports', 'forum')).toBe('🐛・bug-reports');
    expect(P.normalizeChannelName('📢・Announcements', 'announcement')).toBe('📢・announcements');
  });

  it('leaves voice and category names exactly as written', () => {
    // Discord stores these verbatim. Lowercasing them here would make every
    // voice channel look changed on every run.
    expect(P.normalizeChannelName('🔊・General', 'voice')).toBe('🔊・General');
    expect(P.normalizeChannelName('📌 START HERE', 'category')).toBe('📌 START HERE');
  });
});

describe('the sync converges', () => {
  it('builds the whole server from nothing', () => {
    const plan = P.planChannels({ ...planBase(), live: [] });
    expect(plan.operations.filter((o) => o.op === 'create-category').length).toBeGreaterThan(0);
    expect(plan.operations.filter((o) => o.op === 'create-channel').length).toBeGreaterThan(0);
    expect(plan.warnings).toEqual([]);
  });

  it('does nothing at all on a second run', () => {
    // The property that makes this tool usable. A sync that is not idempotent
    // duplicates the server a little more every time it is run.
    const first = P.planChannels({ ...planBase(), live: [] });
    const live = applyPlan(first.operations);
    const second = P.planChannels({ ...planBase(), live });

    const changes = second.operations.filter((o) => o.op !== 'unchanged-channel');
    expect(changes).toEqual([]);
    expect(second.orphans).toEqual([]);
    expect(second.warnings).toEqual([]);
  });

  it('rewrites no positions once the layout already matches', () => {
    const first = P.planChannels({ ...planBase(), live: [] });
    const live = applyPlan(first.operations);
    const second = P.planChannels({ ...planBase(), live });
    const resolve = (op: { id?: string }) => op.id ?? null;
    expect(P.planPositions(second.operations, resolve, live)).toEqual([]);
  });

  it('still builds the growth channels when the phase opens up', () => {
    const launch = P.planChannels({ ...planBase(), live: [] });
    const live = applyPlan(launch.operations);
    const growth = P.planChannels({ ...planBase(), live, phase: 'growth' });
    const created = growth.operations.filter((o) => o.op === 'create-channel');
    expect(created.length).toBe(S.allChannels().filter((c) => c.phase === 'growth').length);
    // …and never re-creates one it already built.
    expect(growth.orphans).toEqual([]);
  });
});

describe('renames and moves', () => {
  const withRename = () => {
    const categories = Copy.resolveForumGuidelines(S.CATEGORIES).map((c) =>
      c.key !== 'community' ? c : {
        ...c,
        channels: c.channels.map((ch) =>
          ch.key === 'general' ? { ...ch, name: '💬・lobby', previousNames: ['💬・general'] } : ch),
      });
    return { ...planBase(), categories };
  };

  it('renames a channel in place instead of abandoning it', () => {
    const live = [{ id: 'c1', name: '💬・general', type: 0, parent_id: null, position: 0, permission_overwrites: [] }];
    const plan = P.planChannels({ ...withRename(), live });
    const op = opFor(plan, 'general');
    expect(op.id).toBe('c1');
    expect(bodyOf(op).name).toBe('💬・lobby');
    expect(plan.operations.some((o) => o.op === 'create-channel' && o.key === 'general')).toBe(false);
    expect(plan.orphans).toEqual([]);
  });

  it('moves a channel between categories rather than making a second copy', () => {
    // Matching per-category rather than guild-wide is what turns a
    // reorganisation into forty duplicate channels.
    const live = [
      { id: 'cat-community', name: '💬 COMMUNITY', type: P.CHANNEL_TYPES.category, parent_id: null, position: 0, permission_overwrites: [] },
      { id: 'c2', name: '💡・ideas', type: 0, parent_id: 'somewhere-else', position: 0, permission_overwrites: [] },
    ];
    const plan = P.planChannels({ ...planBase(), live });
    const op = opFor(plan, 'ideas');
    expect(op.op).toBe('move-channel');
    expect(op.id).toBe('c2');
    expect(bodyOf(op).parent_id).toBe('cat-community');
  });

  it('reparents through the layout write when the category is created in the same run', () => {
    // The category has no id at plan time, so the PATCH cannot carry a
    // parent_id. The bulk layout write is what actually moves the channel, and
    // it only works because the CLI back-fills `parentId` on the operation once
    // the category exists - a quiet dependency worth pinning.
    const live = [{ id: 'c2', name: '💡・ideas', type: 0, parent_id: 'somewhere-else', position: 0, permission_overwrites: [] }];
    const plan = P.planChannels({ ...planBase(), live });
    const op = opFor(plan, 'ideas');
    expect(op.parentKey).toBe('community');
    expect(op.parentId).toBeNull();

    op.parentId = 'freshly-made-category';
    const entries = P.planPositions(plan.operations, (o) => o.id ?? 'new', live);
    expect(entries).toContainEqual({ id: 'c2', position: op.position, parent_id: 'freshly-made-category' });
  });
});

describe('nothing is destroyed', () => {
  it('never emits a delete for a channel the config does not describe', () => {
    const live = [{ id: 'zz', name: 'made-by-hand', type: 0, parent_id: null, position: 0, permission_overwrites: [] }];
    const plan = P.planChannels({ ...planBase(), live });
    expect(plan.orphans.map((o) => o.id)).toContain('zz');
    expect(plan.operations.some((o) => /delete|remove/i.test(o.op))).toBe(false);
  });

  it('refuses a type change Discord cannot make, rather than replacing the channel', () => {
    const live = [{ id: 'c9', name: '🐛・bug-reports', type: 0, parent_id: null, position: 0, permission_overwrites: [] }];
    const plan = P.planChannels({ ...planBase(), live });
    expect(opFor(plan, 'bug-reports').op).toBe('skip-channel');
    expect(plan.warnings.join(' ')).toMatch(/cannot become a forum/);
  });

  it('does convert text to announcement, which Discord allows and keeps the messages', () => {
    const live = [{ id: 'c8', name: '📢・announcements', type: 0, parent_id: null, position: 0, permission_overwrites: [] }];
    const plan = P.planChannels({ ...planBase(), live });
    expect(bodyOf(opFor(plan, 'announcements')).type).toBe(P.CHANNEL_TYPES.announcement);
  });

  it('leaves an integration-managed role alone instead of failing the run on it', () => {
    const plan = P.planRoles({
      desired: S.allRoles(),
      live: [{ id: 'm1', name: '💻 Developer', managed: true, permissions: '0', color: 0 }],
    });
    expect(must(plan.operations.find((o) => o.key === 'developer'), 'the developer role op').op).toBe('skip-role');
  });

  it('reports unknown roles without touching them', () => {
    const plan = P.planRoles({
      desired: S.allRoles(),
      live: [{ id: 'x1', name: 'Someone else made this', permissions: '0', color: 0 }],
    });
    expect(plan.orphans.map((r) => r.id)).toEqual(['x1']);
    expect(plan.operations.some((o) => o.id === 'x1')).toBe(false);
  });
});

describe('permission overwrites', () => {
  const ctx = () => ({
    everyoneId: GUILD_ID,
    roleIds: fakeRoleIds(),
    staffRoleKeys: S.allRoles().filter((r) => r.staff).map((r) => r.key),
  });
  const bits = (list: { id: string }[], id: string, field: 'allow' | 'deny') =>
    BigInt((list.find((o) => o.id === id) as Record<string, string>)?.[field] ?? '0');

  it('hides a hidden channel from @everyone and opens it to the named roles', () => {
    const context = ctx();
    const out = P.deriveOverwrites({ key: 'x', type: 'text', hidden: true, visibleTo: ['tester'] }, context);
    expect(bits(out, GUILD_ID, 'deny') & P.PERMISSIONS.VIEW_CHANNEL).toBeTruthy();
    expect(bits(out, context.roleIds.tester, 'allow') & P.PERMISSIONS.VIEW_CHANNEL).toBeTruthy();
  });

  it('always lets staff into a hidden channel', () => {
    // A moderator who cannot open the channel cannot moderate it, and relying
    // on every private channel listing them by hand is the omission this
    // derivation exists to remove.
    const context = ctx();
    const out = P.deriveOverwrites({ key: 'x', type: 'text', hidden: true, visibleTo: ['tester'] }, context);
    expect(bits(out, context.roleIds.moderator, 'allow') & P.PERMISSIONS.VIEW_CHANNEL).toBeTruthy();
  });

  it('locks a read-only channel including the thread bypass, but leaves reactions', () => {
    const out = P.deriveOverwrites({ key: 'y', type: 'text', readOnly: true }, ctx());
    const deny = bits(out, GUILD_ID, 'deny');
    expect(deny & P.PERMISSIONS.SEND_MESSAGES).toBeTruthy();
    // Starting a thread is otherwise a way to post in a locked channel.
    expect(deny & P.PERMISSIONS.CREATE_PUBLIC_THREADS).toBeTruthy();
    expect(deny & P.PERMISSIONS.SEND_MESSAGES_IN_THREADS).toBeTruthy();
    expect(deny & P.PERMISSIONS.ADD_REACTIONS).toBe(0n);
    expect(deny & P.PERMISSIONS.VIEW_CHANNEL).toBe(0n);
  });

  it('keeps access a moderator granted to one person by hand', () => {
    // A sync that silently revoked these would undo a moderator's decision
    // every time it ran.
    const manual = { id: 'member-42', type: 1, allow: String(P.PERMISSIONS.VIEW_CHANNEL), deny: '0' };
    const live = [{ id: 'c7', name: '👑・staff-chat', type: 0, parent_id: null, position: 0, permission_overwrites: [manual] }];
    const plan = P.planChannels({ ...planBase(), live });
    const merged = must(bodyOf(opFor(plan, 'staff-chat')).permission_overwrites, 'merged overwrites');
    expect(merged.map((o) => o.id)).toContain('member-42');
    expect(merged.find((o) => o.id === GUILD_ID)).toBeDefined();
  });

  it('every staff channel actually denies @everyone', () => {
    // The whole point of the STAFF category. A regression here is invisible
    // until somebody reads a channel they should not be able to see.
    const context = ctx();
    const staff = must(S.CATEGORIES.find((c) => c.key === 'staff'), 'the staff category');
    for (const channel of staff.channels) {
      const out = P.deriveOverwrites(channel, context);
      expect(bits(out, GUILD_ID, 'deny') & P.PERMISSIONS.VIEW_CHANNEL).toBeTruthy();
    }
    expect(bits(P.deriveOverwrites({ ...staff, type: 'category' }, context), GUILD_ID, 'deny') & P.PERMISSIONS.VIEW_CHANNEL).toBeTruthy();
  });
});

describe('a guild that is not a Community server', () => {
  it('degrades forums and announcements to text instead of failing', () => {
    const plan = P.planChannels({ ...planBase(), live: [], community: false });
    expect(bodyOf(opFor(plan, 'bug-reports')).type).toBe(P.CHANNEL_TYPES.text);
    expect(plan.warnings.join(' ')).toMatch(/Enable Community/);
  });
});

describe('onboarding', () => {
  it('reuses existing prompt and option ids so members are not asked again', () => {
    const roleIds = fakeRoleIds();
    const channelIds = Object.fromEntries(S.allChannels().map((c, i) => [c.key, `ch-${i}`]));
    const first = P.planOnboarding({ onboarding: S.ONBOARDING, roleIds, channelIds, live: null });

    const live = { ...first.body, prompts: first.body.prompts.map((p: Record<string, unknown>, i: number) => ({
      ...p,
      id: `real-prompt-${i}`,
      options: (p.options as Record<string, unknown>[]).map((o, j) => ({ ...o, id: `real-option-${i}-${j}` })),
    })) };

    const second = P.planOnboarding({ onboarding: S.ONBOARDING, roleIds, channelIds, live });
    expect(second.body.prompts[0].id).toBe('real-prompt-0');
    expect(second.body.prompts[0].options[0].id).toBe('real-option-0-0');
  });

  it('reports no change when the live flow already matches', () => {
    const roleIds = fakeRoleIds();
    const channelIds = Object.fromEntries(S.allChannels().map((c, i) => [c.key, `ch-${i}`]));
    const first = P.planOnboarding({ onboarding: S.ONBOARDING, roleIds, channelIds, live: null });
    expect(first.changed).toBe(true);
    const again = P.planOnboarding({ onboarding: S.ONBOARDING, roleIds, channelIds, live: first.body });
    // Re-sending onboarding re-runs the join flow for people who finished it.
    expect(again.changed).toBe(false);
  });
});

describe('config validation', () => {
  const config = () => ({
    categories: S.CATEGORIES,
    roles: S.allRoles(),
    onboarding: S.ONBOARDING,
    phases: S.PHASES,
  });

  it('passes on the shipped config', () => {
    const result = P.validateConfig(config());
    expect(result.errors).toEqual([]);
  });

  it('the shipped documents pass too', () => {
    expect(Copy.validateDocuments(S.CATEGORIES).errors).toEqual([]);
  });

  it('catches two channels fighting over the same name', () => {
    const categories = S.CATEGORIES.map((c, i) => i !== 0 ? c : ({
      ...c,
      channels: [...c.channels, { key: 'clash', name: '👋・WELCOME', type: 'text' as const, phase: 'launch' as const }],
    }));
    const result = P.validateConfig({ ...config(), categories });
    expect(result.errors.join(' ')).toMatch(/used by both/);
  });

  it('catches a channel granted to a role that does not exist', () => {
    const categories = S.CATEGORIES.map((c, i) => i !== 0 ? c : ({
      ...c,
      channels: c.channels.map((ch, j) => j !== 0 ? ch : { ...ch, hidden: true, visibleTo: ['nope'] }),
    }));
    expect(P.validateConfig({ ...config(), categories }).errors.join(' ')).toMatch(/unknown role "nope"/);
  });

  it('catches a duplicate key, which would break every stable reference', () => {
    const categories = S.CATEGORIES.map((c, i) => i !== 0 ? c : ({
      ...c,
      channels: [...c.channels, { key: 'welcome', name: '🆕・second', type: 'text' as const, phase: 'launch' as const }],
    }));
    expect(P.validateConfig({ ...config(), categories }).errors.join(' ')).toMatch(/Duplicate channel key/);
  });

  it('warns when too much is visible on day one', () => {
    const categories = [...S.CATEGORIES, {
      key: 'extra', name: '📦 EXTRA', phase: 'launch' as const,
      channels: Array.from({ length: 20 }, (_, i) => ({ key: `x${i}`, name: `📦・x${i}`, type: 'text' as const, phase: 'launch' as const })),
    }];
    expect(P.validateConfig({ ...config(), categories }).warnings.join(' ')).toMatch(/visible at launch/);
  });

  it('catches a document linking a channel that does not exist', () => {
    // `<#key>` references are resolved at post time; an unresolved one would
    // render as literal text in front of everyone in the server.
    const refs = Object.values(Copy.DOCUMENTS).flatMap((d) =>
      [...d.body.matchAll(/<#([a-z0-9-]+)>/g)].map((m) => m[1]));
    const keys = new Set(S.allChannels().map((c) => c.key));
    expect(refs.filter((r) => !keys.has(r))).toEqual([]);
    expect(refs.length).toBeGreaterThan(0);
  });
});

describe('the release post', () => {
  it('announces the App Store version, never the binary version', () => {
    // CLAUDE.md §9: the store record (1.x) and `package.json` (2.x) have
    // deliberately differed since 1.2.7. Naming the binary version in a player
    // announcement points at a version that exists on neither store.
    const post = Copy.renderReleasePost({ storeVersion: '1.5.0', whatsNew: 'Headline.\n\n• a thing', buildVersion: '2.10.0' });
    expect(post.embeds[0].title).toBe('🚀 Deep Life Simulator 1.5.0 is live');
    expect(post.embeds[0].title).not.toContain('2.10.0');
    // The binary number survives only in the footer, where it helps a bug
    // report line up with a crash log.
    expect(post.embeds[0].footer.text).toContain('2.10.0');
  });

  it('uses the same copy Apple is sent', async () => {
    const { APPLE } = await import('../../marketing/aso/metadata.mjs');
    const post = Copy.renderReleasePost({ storeVersion: APPLE.storeVersion, whatsNew: APPLE.whatsNew });
    const [headline] = APPLE.whatsNew.trim().split('\n');
    expect(post.embeds[0].description).toContain(headline.trim());
  });

  it('refuses copy that would not fit, rather than cutting it off mid-sentence', () => {
    // Silent truncation is the exact failure `scripts/check-aso.mjs` exists to
    // prevent on the Apple side.
    expect(() => Copy.renderReleasePost({ storeVersion: '1.5.0', whatsNew: `Headline.\n\n${'x'.repeat(4200)}` }))
      .toThrow(/Discord allows 4096/);
  });

  it('will not post an empty announcement', () => {
    expect(() => Copy.renderAnnouncement({ title: '', body: 'x' })).toThrow(/needs a title/);
    expect(() => Copy.renderAnnouncement({ title: 'x', body: '   ' })).toThrow(/needs a body/);
  });
});

describe('documents', () => {
  it('resolves channel references to real mentions', () => {
    const rendered = Copy.renderDocument('welcome', { rules: '123', roles: '456' });
    expect(rendered.embeds[0].description).toContain('<#123>');
  });

  it('degrades an unresolved reference to a readable name, not literal markup', () => {
    // A document may be posted before a growth channel exists.
    const rendered = Copy.renderDocument('welcome', {});
    expect(rendered.embeds[0].description).toContain('**#rules**');
    expect(rendered.embeds[0].description).not.toContain('<#rules>');
  });

  it('carries the marker that makes a re-run edit instead of duplicate', () => {
    const rendered = Copy.renderDocument('rules', {});
    expect(Copy.isDocMessage(rendered, 'rules')).toBe(true);
    expect(Copy.isDocMessage(rendered, 'welcome')).toBe(false);
    expect(Copy.isDocMessage({ embeds: [] }, 'rules')).toBe(false);
  });

  it('turns a forum document into post guidelines instead of a message', () => {
    // Posting into a forum creates a thread; the guidelines field is the
    // permanent "read this first" a forum actually has.
    const resolved = Copy.resolveForumGuidelines(S.CATEGORIES);
    const forum = must(resolved.flatMap((c) => c.channels).find((c) => c.key === 'bug-reports'), 'the bug-reports forum');
    // `doc` is dropped, which is what makes the message pass skip this channel.
    expect(forum.doc).toBeUndefined();
    expect(forum.topic).toContain('App version');
  });
});

describe('official links', () => {
  it('match the ones the app itself uses', () => {
    // A support channel handing out a URL the app does not use is the shape of
    // a phishing tell - the reasoning already written beside
    // DISCORD_INVITE_LABEL in appConfig.
    const source = fs.readFileSync(path.join(__dirname, '../../lib/config/appConfig.ts'), 'utf8');
    const read = (name: string) => source.match(new RegExp(`export const ${name} = '([^']+)'`))?.[1];

    expect(Copy.LINKS.appStore).toBe(read('APP_STORE_URL'));
    expect(Copy.LINKS.playStore).toBe(read('PLAY_STORE_URL'));
    expect(Copy.LINKS.privacy).toBe(read('PRIVACY_POLICY_URL'));
    expect(Copy.LINKS.support).toBe(read('SUPPORT_EMAIL'));
    expect(Copy.LINKS.discord).toBe(read('DISCORD_URL'));
  });

  it('are all https, or an email', () => {
    for (const [key, value] of Object.entries(Copy.LINKS)) {
      if (key === 'support') expect(value).toMatch(/^[^@\s]+@[^@\s]+$/);
      else expect(value).toMatch(/^https:\/\//);
    }
  });
});
