/**
 * The pure half of the Discord sync: desired state + live state → an ordered
 * list of operations. No network, no `process.env`, no clock.
 *
 * Everything that can be wrong about a sync is decided here — what counts as
 * "the same channel", which overwrites we own, what we refuse to touch — so
 * all of it can be tested without a guild. `api.mjs` only executes what this
 * file returns.
 */

/**
 * @typedef {import('./server.mjs').ChannelSpec} ChannelSpec
 * @typedef {import('./server.mjs').CategorySpec} CategorySpec
 * @typedef {import('./server.mjs').RoleSpec} RoleSpec
 * @typedef {import('./server.mjs').OnboardingPromptSpec} OnboardingPromptSpec
 */

/**
 * A permission overwrite as Discord stores it. `allow` and `deny` are DECIMAL
 * STRINGS, not numbers — see PERMISSIONS below for why that matters.
 * @typedef {{id: string, type: number, allow: string, deny: string}} Overwrite
 */

/**
 * A live channel, as the API returns it. Only the fields this planner reads.
 * @typedef {Object} LiveChannel
 * @property {string} id
 * @property {string} name
 * @property {number} type
 * @property {string|null} [parent_id]
 * @property {number} [position]
 * @property {string|null} [topic]
 * @property {number} [rate_limit_per_user]
 * @property {Overwrite[]} [permission_overwrites]
 * @property {{name: string, moderated?: boolean, emoji_name?: string|null}[]} [available_tags]
 */

/**
 * A live role, as the API returns it.
 * @typedef {Object} LiveRole
 * @property {string} id
 * @property {string} name
 * @property {string|number} [permissions]
 * @property {number} [color]
 * @property {boolean} [hoist]
 * @property {boolean} [mentionable]
 * @property {boolean} [managed]
 * @property {number} [position]
 */

/**
 * The body of a channel create/update. Every field this planner ever sends.
 * @typedef {Object} ChannelBody
 * @property {string} [name]
 * @property {number} [type]
 * @property {number} [position]
 * @property {string} [topic]
 * @property {number} [rate_limit_per_user]
 * @property {string|null} [parent_id]
 * @property {Overwrite[]} [permission_overwrites]
 * @property {{name: string, moderated: boolean, emoji_name: string|null, emoji_id: null}[]} [available_tags]
 */

/**
 * @typedef {Object} RoleBody
 * @property {string} [name]
 * @property {string} [permissions]
 * @property {number} [color]
 * @property {boolean} [hoist]
 * @property {boolean} [mentionable]
 */

/**
 * One step of a channel plan. `body` is absent on `unchanged-channel` and
 * `skip-channel`, which exist so the caller can still resolve ids and explain
 * itself without a second pass over the config.
 * @typedef {Object} ChannelOperation
 * @property {'create-category'|'update-category'|'create-channel'|'update-channel'|'move-channel'|'unchanged-channel'|'skip-channel'} op
 * @property {string} key
 * @property {string} name
 * @property {string} [id]
 * @property {string} [doc]
 * @property {string} [parentKey]
 * @property {string|null} [parentId]
 * @property {number} [position]
 * @property {string} [reason]
 * @property {ChannelBody} [body]
 */

/**
 * @typedef {Object} RoleOperation
 * @property {'create-role'|'update-role'|'skip-role'} op
 * @property {string} key
 * @property {string} name
 * @property {string} [id]
 * @property {string} [reason]
 * @property {RoleBody} [body]
 */

// ── Permissions ───────────────────────────────────────────────────────────
/**
 * Discord permission flags.
 *
 * BigInt, and not negotiable. JavaScript's bitwise operators coerce to a signed
 * 32-bit integer, so `1 << 35` evaluates to `8` — `SEND_MESSAGES_IN_THREADS`
 * would silently become `MANAGE_GUILD`. Sixteen of Discord's flags now live
 * above bit 31 and the API takes the value as a decimal STRING for exactly this
 * reason. A `Number` implementation does not fail; it grants the wrong
 * permission and looks fine in the diff.
 */
export const PERMISSIONS = {
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_AUDIT_LOG: 1n << 7n,
  PRIORITY_SPEAKER: 1n << 8n,
  STREAM: 1n << 9n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  SEND_TTS_MESSAGES: 1n << 12n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  VIEW_GUILD_INSIGHTS: 1n << 19n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  USE_VAD: 1n << 25n,
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_WEBHOOKS: 1n << 29n,
  MANAGE_GUILD_EXPRESSIONS: 1n << 30n,
  USE_APPLICATION_COMMANDS: 1n << 31n,
  REQUEST_TO_SPEAK: 1n << 32n,
  MANAGE_EVENTS: 1n << 33n,
  MANAGE_THREADS: 1n << 34n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  CREATE_PRIVATE_THREADS: 1n << 36n,
  USE_EXTERNAL_STICKERS: 1n << 37n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
  USE_EMBEDDED_ACTIVITIES: 1n << 39n,
  MODERATE_MEMBERS: 1n << 40n,
  SEND_VOICE_MESSAGES: 1n << 46n,
  SEND_POLLS: 1n << 49n,
};

/** @param {string[]} names @returns {string} the decimal string Discord expects */
export function permissionBits(names) {
  let bits = 0n;
  for (const name of names) {
    const bit = PERMISSIONS[name];
    if (bit === undefined) throw new Error(`Unknown Discord permission: ${name}`);
    bits |= bit;
  }
  return bits.toString();
}

/** Discord's numeric channel types, by the names used in server.mjs. */
export const CHANNEL_TYPES = { text: 0, voice: 2, category: 4, announcement: 5, forum: 15 };

/** Overwrite target kinds. */
const OVERWRITE_ROLE = 0;

/**
 * Type changes Discord will accept on an existing channel.
 *
 * Text and announcement are the same underlying channel with a different
 * delivery mode, so PATCHing between them keeps every message. Nothing else
 * converts — a forum is a different object — and attempting it returns a
 * 400 that reads like a validation error rather than an impossibility.
 */
const CONVERTIBLE = new Set(['0>5', '5>0']);

/**
 * How Discord itself will rewrite a name, so we compare like with like.
 *
 * Text, announcement and forum names are lowercased and have whitespace runs
 * turned into single dashes on the server. Voice and category names are stored
 * exactly as sent. Comparing a desired `📅・This-Week` against the live
 * `📅・this-week` without this returns "different", and the sync would create a
 * second channel on every run — the classic way one of these tools fills a
 * server with duplicates.
 *
 * Emoji and the `・` separator survive untouched, which is why they are safe to
 * use in the config.
 */
export function normalizeChannelName(name, type) {
  const raw = String(name ?? '').trim();
  if (type === 'voice' || type === 'category') return raw;
  return raw.toLowerCase().replace(/\s+/g, '-');
}

/** Roles match on name, case-insensitively; Discord preserves the case it is given. */
export function normalizeRoleName(name) {
  return String(name ?? '').trim().toLowerCase();
}

/**
 * Every name a desired thing may currently be living under.
 * `previousNames` is what turns a rename in the config into a rename on the
 * server rather than an abandoned channel plus a new empty one.
 */
/**
 * @param {{name: string, previousNames?: string[]}} desired
 * @param {string} type
 */
function candidateNames(desired, type) {
  return [desired.name, ...(desired.previousNames ?? [])].map((n) => normalizeChannelName(n, type));
}

// ── Overwrites ────────────────────────────────────────────────────────────

/**
 * The permission overwrites this config OWNS for a channel.
 *
 * Derived from the declarative flags (`hidden` / `visibleTo` / `readOnly` /
 * `postableBy`) rather than written out per channel, because a hand-written
 * overwrite table is where a private channel quietly becomes public: forty
 * channels each with their own allow/deny pair is forty chances to omit the
 * deny. One derivation, tested once.
 *
 * @param {{key?: string, name?: string, type?: string, hidden?: boolean, visibleTo?: string[], readOnly?: boolean, postableBy?: string[], channels?: unknown}} channel
 * @param {{everyoneId: string, roleIds: Record<string, string|null>, staffRoleKeys: string[]}} ctx
 * @returns {Overwrite[]}
 */
export function deriveOverwrites(channel, ctx) {
  const { everyoneId, roleIds, staffRoleKeys } = ctx;
  /** @type {Map<string, {id:string,type:number,allow:bigint,deny:bigint}>} */
  const byId = new Map();
  const at = (id) => {
    if (!byId.has(id)) byId.set(id, { id, type: OVERWRITE_ROLE, allow: 0n, deny: 0n });
    return byId.get(id);
  };
  const idOf = (key) => roleIds[key] ?? null;

  const isVoice = channel.type === 'voice';

  if (channel.hidden) {
    const everyone = at(everyoneId);
    everyone.deny |= PERMISSIONS.VIEW_CHANNEL;
    if (isVoice) everyone.deny |= PERMISSIONS.CONNECT;

    // Staff can always see a hidden channel. A moderator who cannot open the
    // channel cannot moderate it, and the alternative — remembering to list
    // them on every private channel — is the omission this exists to prevent.
    const grantees = new Set([...(channel.visibleTo ?? []), ...staffRoleKeys]);
    for (const key of grantees) {
      const id = idOf(key);
      if (!id) continue;
      const entry = at(id);
      entry.allow |= PERMISSIONS.VIEW_CHANNEL | PERMISSIONS.READ_MESSAGE_HISTORY;
      if (isVoice) entry.allow |= PERMISSIONS.CONNECT | PERMISSIONS.SPEAK;
    }
  }

  if (channel.readOnly && !isVoice) {
    const everyone = at(everyoneId);
    // Reactions and reading threads stay open on purpose: a channel nobody can
    // react in is a channel people stop opening. `CREATE_PUBLIC_THREADS` is
    // denied alongside SEND_MESSAGES because starting a thread is otherwise a
    // way to post in a locked channel.
    everyone.deny |= PERMISSIONS.SEND_MESSAGES
      | PERMISSIONS.CREATE_PUBLIC_THREADS
      | PERMISSIONS.CREATE_PRIVATE_THREADS
      | PERMISSIONS.SEND_MESSAGES_IN_THREADS;

    for (const key of new Set([...(channel.postableBy ?? []), ...staffRoleKeys])) {
      const id = idOf(key);
      if (!id) continue;
      const entry = at(id);
      entry.allow |= PERMISSIONS.SEND_MESSAGES
        | PERMISSIONS.CREATE_PUBLIC_THREADS
        | PERMISSIONS.SEND_MESSAGES_IN_THREADS;
    }
  }

  return [...byId.values()]
    .map((o) => ({ id: o.id, type: o.type, allow: o.allow.toString(), deny: o.deny.toString() }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Fold the overwrites we own into whatever the channel already has.
 *
 * Overwrites for ids the config knows nothing about are KEPT. Those are almost
 * always a person granted access to one channel by hand, and a sync that
 * silently revoked them would be a tool that undoes moderator decisions every
 * time it runs. We replace what we manage and leave the rest alone.
 *
 * @param {Overwrite[]|undefined} live
 * @param {Overwrite[]} managed
 * @param {Set<string>} managedIds
 * @returns {Overwrite[]}
 */
export function mergeOverwrites(live, managed, managedIds) {
  const kept = (live ?? []).filter((o) => !managedIds.has(o.id));
  return [...kept, ...managed]
    .map((o) => ({ id: o.id, type: o.type, allow: String(o.allow ?? '0'), deny: String(o.deny ?? '0') }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Set-equality on overwrites, order-insensitive.
 * @param {Overwrite[]|undefined} a
 * @param {Overwrite[]|undefined} b
 */
export function overwritesEqual(a, b) {
  const norm = (list) => (list ?? [])
    .map((o) => `${o.id}:${o.type}:${String(o.allow ?? '0')}:${String(o.deny ?? '0')}`)
    .sort()
    .join('|');
  return norm(a) === norm(b);
}

// ── Role plan ─────────────────────────────────────────────────────────────

/**
 * @param {{desired: RoleSpec[], live: LiveRole[]}} input
 * @returns {{operations: RoleOperation[], roleIds: Record<string, string|null>, orphans: LiveRole[]}}
 */
export function planRoles({ desired, live }) {
  const liveByName = new Map();
  for (const role of live) liveByName.set(normalizeRoleName(role.name), role);

  /** @type {RoleOperation[]} */
  const operations = [];
  /** @type {Record<string, string|null>} */
  const roleIds = {};
  const claimed = new Set();

  for (const role of desired) {
    const names = [role.name, ...(role.previousNames ?? [])].map(normalizeRoleName);
    const match = names.map((n) => liveByName.get(n)).find(Boolean);
    const permissions = permissionBits(role.permissions ?? []);

    if (!match) {
      roleIds[role.key] = null;
      operations.push({ op: 'create-role', key: role.key, name: role.name, body: {
        name: role.name, permissions, color: role.color ?? 0,
        hoist: Boolean(role.hoist), mentionable: Boolean(role.mentionable),
      } });
      continue;
    }

    claimed.add(match.id);
    roleIds[role.key] = match.id;

    // `managed` roles belong to an integration (a bot's own role, a Twitch
    // sub role). Discord refuses to edit them and the request fails the whole
    // run, so a name collision with one is reported, not retried.
    if (match.managed) {
      operations.push({ op: 'skip-role', key: role.key, name: role.name, id: match.id,
        reason: 'managed by an integration — Discord does not allow editing it' });
      continue;
    }

    /** @type {RoleBody} */
    const changes = {};
    if (match.name !== role.name) changes.name = role.name;
    if (String(match.permissions) !== permissions) changes.permissions = permissions;
    if ((match.color ?? 0) !== (role.color ?? 0)) changes.color = role.color ?? 0;
    if (Boolean(match.hoist) !== Boolean(role.hoist)) changes.hoist = Boolean(role.hoist);
    if (Boolean(match.mentionable) !== Boolean(role.mentionable)) changes.mentionable = Boolean(role.mentionable);

    if (Object.keys(changes).length > 0) {
      operations.push({ op: 'update-role', key: role.key, name: role.name, id: match.id, body: changes });
    }
  }

  // Roles we did not claim. Reported only — a role can carry a member's
  // identity, a colour they chose, or an integration's access, and none of that
  // is ours to delete because it is missing from a file.
  const orphans = live.filter((r) => !claimed.has(r.id) && !r.managed && r.name !== '@everyone');

  return { operations, roleIds, orphans };
}

// ── Channel plan ──────────────────────────────────────────────────────────

function forumTags(tags) {
  return (tags ?? []).map((t) => ({
    name: t.name,
    moderated: Boolean(t.moderated),
    emoji_name: t.emoji ?? null,
    emoji_id: null,
  }));
}

function tagsEqual(live, desired) {
  const norm = (list) => (list ?? [])
    .map((t) => `${t.name}:${Boolean(t.moderated)}:${t.emoji_name ?? ''}`)
    .sort()
    .join('|');
  return norm(live) === norm(desired);
}

/**
 * @param {object} input
 * @param {CategorySpec[]} input.categories   CATEGORIES from server.mjs
 * @param {LiveChannel[]} input.live          live channels from the guild
 * @param {Record<string, string|null>} input.roleIds
 * @param {string} input.everyoneId
 * @param {string[]} input.staffRoleKeys
 * @param {string} [input.phase]              'launch' builds only launch channels
 * @param {boolean} [input.community]         guild has the COMMUNITY feature
 * @returns {{operations: ChannelOperation[], orphans: LiveChannel[], warnings: string[]}}
 */
export function planChannels({ categories, live, roleIds, everyoneId, staffRoleKeys, phase = 'launch', community = false }) {
  /** @type {ChannelOperation[]} */
  const operations = [];
  /** @type {string[]} */
  const warnings = [];
  const claimed = new Set();
  const managedIds = new Set([everyoneId, ...Object.values(roleIds).filter(Boolean)]);

  const liveByName = new Map();
  for (const ch of live) {
    // Index under BOTH normalizations. A live text channel called
    // `📅・this-week` and a live voice channel called `🔊・General` need
    // different rules, and we do not know a desired channel's type until we
    // look it up — so both spellings point at the same object and the
    // type check below is what decides whether the match is usable.
    liveByName.set(ch.name, ch);
    liveByName.set(String(ch.name).toLowerCase(), ch);
  }

  const wanted = (thing) => phase === 'launch' ? thing.phase !== 'growth' : true;

  /** Resolves a desired thing to a live channel, honouring previousNames. */
  const findLive = (desired, type) => {
    for (const name of candidateNames(desired, type)) {
      const hit = liveByName.get(name);
      if (hit) return hit;
    }
    return null;
  };

  // Categories first: a channel cannot be created under a parent that does not
  // exist yet, so the whole category pass is ordered ahead of the channel pass.
  /** @type {Record<string,{id:string|null, key:string}>} */
  const categoryRefs = {};
  let categoryPosition = 0;

  for (const category of categories) {
    if (!wanted(category)) continue;
    const desiredOverwrites = deriveOverwrites({ ...category, type: 'category' }, { everyoneId, roleIds, staffRoleKeys });
    const match = findLive(category, 'category');
    const position = categoryPosition++;


    if (match && match.type !== CHANNEL_TYPES.category) {
      warnings.push(`"${category.name}" exists but is not a category (type ${match.type}). Rename the existing channel or remove it, then sync again.`);
      categoryRefs[category.key] = { id: null, key: category.key };
      continue;
    }

    if (!match) {
      categoryRefs[category.key] = { id: null, key: category.key };
      operations.push({ op: 'create-category', key: category.key, name: category.name, position, body: {
        name: category.name, type: CHANNEL_TYPES.category, position,
        permission_overwrites: desiredOverwrites,
      } });
      continue;
    }

    claimed.add(match.id);
    categoryRefs[category.key] = { id: match.id, key: category.key };
    const merged = mergeOverwrites(match.permission_overwrites, desiredOverwrites, managedIds);
    /** @type {ChannelBody} */
    const changes = {};
    if (match.name !== category.name) changes.name = category.name;
    if (!overwritesEqual(match.permission_overwrites, merged)) changes.permission_overwrites = merged;
    if (Object.keys(changes).length > 0) {
      operations.push({ op: 'update-category', key: category.key, name: category.name, id: match.id, body: changes });
    }
  }

  for (const category of categories) {
    if (!wanted(category)) continue;
    let position = 0;

    for (const channel of category.channels) {
      if (!wanted(channel)) continue;

      // A guild that is not a Community server has neither announcement nor
      // forum channels. Degrade to text and say so, rather than failing the
      // run: a brand-new guild should still build, and enabling Community is a
      // one-time click that the warning names.
      let type = channel.type;
      if (!community && (type === 'announcement' || type === 'forum')) {
        warnings.push(`"${channel.name}" wants to be a ${type} channel, which needs Community enabled on the server. Created it as a text channel — enable Community (Server Settings → Enable Community) and sync again to convert it.`);
        type = 'text';
      }
      const typeId = CHANNEL_TYPES[type];
      if (typeId === undefined) throw new Error(`Unknown channel type "${channel.type}" on "${channel.key}"`);

      const parent = categoryRefs[category.key];
      const desiredOverwrites = deriveOverwrites({ ...channel, type }, { everyoneId, roleIds, staffRoleKeys });
      const match = findLive(channel, type);
      const slot = position++;

      if (!match) {
        operations.push({ op: 'create-channel', key: channel.key, name: channel.name, doc: channel.doc,
          parentKey: category.key, parentId: parent.id, position: slot, body: {
            name: channel.name, type: typeId, position: slot,
            ...(channel.topic ? { topic: channel.topic } : {}),
            ...(channel.slowmode ? { rate_limit_per_user: channel.slowmode } : {}),
            ...(type === 'forum' ? { available_tags: forumTags(channel.tags) } : {}),
            permission_overwrites: desiredOverwrites,
          } });
        continue;
      }

      claimed.add(match.id);

      if (match.type !== typeId && !CONVERTIBLE.has(`${match.type}>${typeId}`)) {
        warnings.push(`"${channel.name}" already exists as channel type ${match.type} and cannot become a ${type} — Discord does not convert between them. Rename the existing one (or move it out with --prune) and sync again to get the ${type}.`);
        operations.push({ op: 'skip-channel', key: channel.key, name: channel.name, id: match.id, reason: 'type conflict' });
        continue;
      }

      const merged = mergeOverwrites(match.permission_overwrites, desiredOverwrites, managedIds);
      /** @type {ChannelBody} */
      const changes = {};
      if (match.name !== channel.name) changes.name = channel.name;
      if (match.type !== typeId) changes.type = typeId;
      if ((match.topic ?? '') !== (channel.topic ?? '')) changes.topic = channel.topic ?? '';
      if ((match.rate_limit_per_user ?? 0) !== (channel.slowmode ?? 0)) changes.rate_limit_per_user = channel.slowmode ?? 0;
      if (type === 'forum' && !tagsEqual(match.available_tags, forumTags(channel.tags))) {
        changes.available_tags = forumTags(channel.tags);
      }
      if (!overwritesEqual(match.permission_overwrites, merged)) changes.permission_overwrites = merged;

      // The parent is compared separately from the bulk reorder because moving
      // a channel between categories is the one change worth naming in the
      // printed plan — it is what a reorganisation looks like, and it is also
      // what a duplicate-creating matcher would have got wrong.
      const parentChanged = parent.id !== null && (match.parent_id ?? null) !== parent.id;
      if (parentChanged) changes.parent_id = parent.id;

      if (Object.keys(changes).length > 0) {
        operations.push({
          op: parentChanged ? 'move-channel' : 'update-channel',
          key: channel.key, name: channel.name, id: match.id, doc: channel.doc,
          parentKey: category.key, parentId: parent.id, position: slot, body: changes,
        });
      } else {
        operations.push({ op: 'unchanged-channel', key: channel.key, name: channel.name, id: match.id,
          doc: channel.doc, parentKey: category.key, parentId: parent.id, position: slot });
      }
    }
  }

  const orphans = live.filter((ch) => !claimed.has(ch.id));
  return { operations, orphans, warnings };
}

/**
 * The single bulk position write, built from the plan once every id is known.
 *
 * One request rather than one per channel: Discord renumbers siblings on every
 * individual position PATCH, so forty separate writes fight each other and land
 * in an order nobody chose (and burn forty rate-limit tokens doing it).
 *
 * @param {ChannelOperation[]} operations
 * @param {(op: ChannelOperation) => string|null|undefined} resolveId
 * @param {LiveChannel[]|null} [live]  when given, returns [] if nothing moved
 * @returns {{id: string, position: number, parent_id?: string}[]}
 */
export function planPositions(operations, resolveId, live = null) {
  /** @type {{id: string, position: number, parent_id?: string}[]} */
  const entries = [];
  let categoryPosition = 0;
  for (const op of operations) {
    if (op.op === 'create-category' || op.op === 'update-category') {
      const id = resolveId(op);
      if (id) entries.push({ id, position: categoryPosition++ });
    }
  }
  for (const op of operations) {
    if (!['create-channel', 'update-channel', 'move-channel', 'unchanged-channel'].includes(op.op)) continue;
    const id = resolveId(op);
    const parentId = op.parentId ?? null;
    if (id && parentId) entries.push({ id, position: op.position, parent_id: parentId });
  }

  // Nothing to say when the layout is already the layout. A sync that finds no
  // work should make NO requests — otherwise "0 changes" still burns a
  // rate-limit token and prints a write, and the only way to tell a real change
  // from the standing noise is to read the payload.
  if (live) {
    const byId = new Map(live.map((c) => [c.id, c]));
    const settled = entries.every((entry) => {
      const current = byId.get(entry.id);
      if (!current) return false;
      if (current.position !== entry.position) return false;
      return entry.parent_id === undefined || (current.parent_id ?? null) === entry.parent_id;
    });
    if (settled) return [];
  }

  return entries;
}

// ── Onboarding ────────────────────────────────────────────────────────────

/**
 * Resolve the config's onboarding prompts against real ids.
 *
 * Existing prompt and option ids are REUSED when the titles still match.
 * Discord treats a new id as a new prompt, so regenerating them would reset
 * every member's answers and re-run onboarding for people who finished it
 * months ago.
 */
/**
 * @param {object} input
 * @param {{defaultChannels: string[], prompts: OnboardingPromptSpec[]}} input.onboarding
 * @param {Record<string, string|null>} input.roleIds
 * @param {Record<string, string|null>} input.channelIds
 * @param {Record<string, any>|null} [input.live]
 */
export function planOnboarding({ onboarding, roleIds, channelIds, live }) {
  /** @type {{kind:'role'|'channel', key:string, message:string}[]} */
  const missing = [];
  const liveByTitle = new Map((live?.prompts ?? []).map((p) => [p.title, p]));

  const prompts = onboarding.prompts.map((prompt, promptIndex) => {
    const existing = liveByTitle.get(prompt.title);
    const existingOptions = new Map((existing?.options ?? []).map((o) => [o.title, o]));

    const options = prompt.options.map((option, optionIndex) => {
      const roles = (option.roles ?? []).map((k) => {
        const id = roleIds[k];
        if (!id) missing.push({ kind: 'role', key: k, message: `onboarding option "${option.title}" grants role "${k}", which does not exist yet` });
        return id;
      }).filter(Boolean);
      const channels = (option.channels ?? []).map((k) => {
        const id = channelIds[k];
        // Routine at launch phase rather than an error: an option may point at a
        // growth channel that has not been built. The option still grants its
        // role, so the member is ready the moment the channel appears — the
        // caller decides how loudly to say so.
        if (!id) missing.push({ kind: 'channel', key: k, message: `onboarding option "${option.title}" offers "${k}", which has not been built yet` });
        return id;
      }).filter(Boolean);

      return {
        id: existingOptions.get(option.title)?.id ?? String(optionIndex),
        title: option.title,
        description: option.description ?? null,
        emoji: option.emoji ? { name: option.emoji, id: null, animated: false } : undefined,
        role_ids: roles,
        channel_ids: channels,
      };
    });

    return {
      id: existing?.id ?? String(promptIndex),
      type: 0, // MULTIPLE_CHOICE
      title: prompt.title,
      options,
      single_select: Boolean(prompt.singleSelect),
      required: Boolean(prompt.required),
      in_onboarding: prompt.inOnboarding !== false,
    };
  });

  const defaultChannelIds = onboarding.defaultChannels
    .map((k) => {
      const id = channelIds[k];
      if (!id) missing.push({ kind: 'channel', key: k, message: `onboarding default channel "${k}" has not been built yet` });
      return id;
    })
    .filter(Boolean);

  const body = { prompts, default_channel_ids: defaultChannelIds, enabled: true, mode: 1 };
  return { body, missing, changed: !onboardingEqual(body, live) };
}

/**
 * Compare only the fields we send.
 *
 * Discord's onboarding response carries state we never set (per-option
 * `description` defaults it fills in, `guild_id`, emoji ids) so a deep equality
 * against the raw response is always false, and a sync that always rewrites
 * onboarding is a sync that re-runs the join flow for members who finished it.
 */
/**
 * @param {Record<string, any>} body
 * @param {Record<string, any>|null|undefined} live
 */
export function onboardingEqual(body, live) {
  if (!live) return false;
  const shape = (o) => JSON.stringify({
    enabled: Boolean(o.enabled),
    mode: o.mode ?? 0,
    defaults: [...(o.default_channel_ids ?? [])].sort(),
    prompts: (o.prompts ?? []).map((p) => ({
      title: p.title,
      single: Boolean(p.single_select),
      required: Boolean(p.required),
      inOnboarding: p.in_onboarding !== false,
      options: (p.options ?? []).map((opt) => ({
        title: opt.title,
        roles: [...(opt.role_ids ?? [])].sort(),
        channels: [...(opt.channel_ids ?? [])].sort(),
        emoji: opt.emoji?.name ?? null,
      })),
    })),
  });
  return shape(body) === shape(live);
}

// ── Offline validation ────────────────────────────────────────────────────

/** Discord's own structural limits. Exceeding one is a 400 mid-run, half applied. */
const LIMITS = {
  channelName: 100,
  // Forums take four times the topic of a text channel, because that field is
  // where their post guidelines live. Checking every channel against 1024 would
  // reject a perfectly legal set of bug-report instructions.
  topic: 1024,
  forumTopic: 4096,
  channelsPerCategory: 50,
  guildChannels: 500,
  guildRoles: 250,
  forumTags: 20,
};

/**
 * Config checks that need no guild and no token.
 *
 * The point is to fail on the laptop rather than halfway through a run that has
 * already created twenty channels. A partial sync is recoverable — the next run
 * finishes it — but only if you find out before it starts that channel 21 was
 * never going to be accepted.
 *
 * @param {object} input
 * @param {CategorySpec[]} input.categories
 * @param {RoleSpec[]} input.roles
 * @param {{defaultChannels: string[], prompts: OnboardingPromptSpec[]}} input.onboarding
 * @param {readonly string[]} input.phases
 * @returns {{errors: string[], warnings: string[], notes: string[]}}
 */
export function validateConfig({ categories, roles, onboarding, phases }) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];
  /** @type {string[]} */
  const notes = [];

  const roleKeys = new Set(roles.map((r) => r.key));
  const channelKeys = new Set();
  const seenChannelNames = new Map();
  const seenRoleNames = new Map();
  let totalChannels = categories.length;

  for (const role of roles) {
    if (seenRoleNames.has(normalizeRoleName(role.name))) {
      errors.push(`Two roles are both named "${role.name}" (${seenRoleNames.get(normalizeRoleName(role.name))} and ${role.key}). Roles match on name, so one would overwrite the other.`);
    }
    seenRoleNames.set(normalizeRoleName(role.name), role.key);
    for (const perm of role.permissions ?? []) {
      if (PERMISSIONS[perm] === undefined) errors.push(`Role "${role.key}" asks for unknown permission "${perm}".`);
    }
  }
  if (roles.length > LIMITS.guildRoles) errors.push(`${roles.length} roles exceeds Discord's limit of ${LIMITS.guildRoles}.`);

  for (const category of categories) {
    if (!phases.includes(category.phase)) errors.push(`Category "${category.key}" has phase "${category.phase}" — expected one of ${phases.join(', ')}.`);
    for (const key of category.visibleTo ?? []) {
      if (!roleKeys.has(key)) errors.push(`Category "${category.key}" is visible to unknown role "${key}".`);
    }
    if (category.channels.length > LIMITS.channelsPerCategory) {
      errors.push(`Category "${category.key}" holds ${category.channels.length} channels; Discord allows ${LIMITS.channelsPerCategory}.`);
    }
    totalChannels += category.channels.length;

    for (const channel of category.channels) {
      if (channelKeys.has(channel.key)) errors.push(`Duplicate channel key "${channel.key}". Keys are the stable identity — they cannot repeat.`);
      channelKeys.add(channel.key);

      if (CHANNEL_TYPES[channel.type] === undefined) errors.push(`Channel "${channel.key}" has unknown type "${channel.type}".`);
      if (!phases.includes(channel.phase)) errors.push(`Channel "${channel.key}" has phase "${channel.phase}" — expected one of ${phases.join(', ')}.`);

      const normalized = normalizeChannelName(channel.name, channel.type);
      if ([...normalized].length > LIMITS.channelName) errors.push(`Channel "${channel.key}" name is ${[...normalized].length} characters; Discord allows ${LIMITS.channelName}.`);
      if (seenChannelNames.has(normalized)) {
        errors.push(`"${channel.name}" is used by both "${seenChannelNames.get(normalized)}" and "${channel.key}". Channels are matched by name across the whole guild, so duplicates would fight over the same live channel.`);
      }
      seenChannelNames.set(normalized, channel.key);

      const topicLimit = channel.type === 'forum' ? LIMITS.forumTopic : LIMITS.topic;
      if (channel.topic && [...channel.topic].length > topicLimit) {
        errors.push(`Channel "${channel.key}" topic is ${[...channel.topic].length} characters; Discord allows ${topicLimit}.`);
      }
      for (const key of channel.visibleTo ?? []) {
        if (!roleKeys.has(key)) errors.push(`Channel "${channel.key}" is visible to unknown role "${key}".`);
      }
      for (const key of channel.postableBy ?? []) {
        if (!roleKeys.has(key)) errors.push(`Channel "${channel.key}" grants posting to unknown role "${key}".`);
      }
      if (channel.hidden && (channel.visibleTo ?? []).length === 0) {
        warnings.push(`Channel "${channel.key}" is hidden and grants no role — only staff will ever see it. Add "visibleTo" if that is not what you meant.`);
      }
      if (channel.type === 'forum' && (channel.tags ?? []).length > LIMITS.forumTags) {
        errors.push(`Forum "${channel.key}" declares ${channel.tags.length} tags; Discord allows ${LIMITS.forumTags}.`);
      }
      if (channel.tags && channel.type !== 'forum') {
        warnings.push(`Channel "${channel.key}" declares forum tags but is a ${channel.type} channel — the tags will be ignored.`);
      }
      if (channel.slowmode && (channel.slowmode < 0 || channel.slowmode > 21600)) {
        errors.push(`Channel "${channel.key}" slowmode must be 0–21600 seconds.`);
      }
    }
  }

  if (totalChannels > LIMITS.guildChannels) errors.push(`${totalChannels} channels exceeds Discord's limit of ${LIMITS.guildChannels}.`);

  for (const key of onboarding.defaultChannels) {
    if (!channelKeys.has(key)) errors.push(`Onboarding default channel "${key}" is not a channel in this config.`);
  }
  for (const prompt of onboarding.prompts) {
    for (const option of prompt.options) {
      for (const key of option.roles ?? []) {
        if (!roleKeys.has(key)) errors.push(`Onboarding option "${option.title}" grants unknown role "${key}".`);
      }
      for (const key of option.channels ?? []) {
        if (!channelKeys.has(key)) errors.push(`Onboarding option "${option.title}" grants unknown channel "${key}".`);
      }
    }
  }

  // An onboarding option that unlocks a channel the option cannot make visible
  // is a dead end: the member ticks the box and lands nowhere.
  const byKey = new Map();
  for (const category of categories) for (const channel of category.channels) byKey.set(channel.key, channel);
  for (const prompt of onboarding.prompts) {
    for (const option of prompt.options) {
      for (const key of option.channels ?? []) {
        const channel = byKey.get(key);
        if (channel && !channel.hidden) {
          warnings.push(`Onboarding option "${option.title}" offers "${key}", but that channel is visible to everyone already — the choice does nothing.`);
        }
      }
    }
  }

  // The launch budget. Not a Discord limit — a judgement about how a server
  // reads to somebody who has just joined. Hidden channels do not count: nobody
  // sees them until they opt in.
  const launchVisible = categories
    .filter((c) => c.phase !== 'growth' && !c.hidden)
    .flatMap((c) => c.channels.filter((ch) => ch.phase !== 'growth' && !ch.hidden));
  notes.push(`Launch phase: ${launchVisible.length} channels visible to a new member before they pick anything.`);
  if (launchVisible.length > 25) {
    warnings.push(`${launchVisible.length} channels are visible at launch. Empty channels make a server look dead — consider moving some to phase "growth".`);
  }

  return { errors, warnings, notes };
}
