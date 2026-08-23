#!/usr/bin/env node
/**
 * Discord-as-code for Deep Life Simulator.
 *
 *   node discord/cli.mjs validate              config only — no token, no network
 *   node discord/cli.mjs sync                  print the plan (writes nothing)
 *   node discord/cli.mjs sync --apply          perform it
 *   node discord/cli.mjs sync --phase growth   also build the growth channels
 *   node discord/cli.mjs sync --apply --prune  move orphans into the archive
 *   node discord/cli.mjs sync --apply --onboarding   also write the join flow
 *   node discord/cli.mjs backup                write the live structure to JSON
 *   node discord/cli.mjs restore --from <file> re-create what the backup had
 *   node discord/cli.mjs announce --title T --body-file notes.md [--publish]
 *   node discord/cli.mjs release               post the current release notes
 *
 * NOTHING WRITES WITHOUT `--apply`. Every command runs as a plan first and
 * prints the exact requests it would send. That convention is borrowed from
 * `scripts/asc-release.mjs`, and it is worth more here than there: a mistake
 * against the App Store is caught in review, while a mistake against a live
 * community server is visible to everyone in it immediately.
 *
 * Environment:
 *   DISCORD_BOT_TOKEN   a bot token from the application's Bot tab
 *   DISCORD_GUILD_ID    the server id (right-click the server → Copy Server ID)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DiscordClient, loadGuildId, loadToken } from './api.mjs';
import {
  DOCUMENTS, isDocMessage, renderAnnouncement, renderDocument, renderReleasePost, resolveForumGuidelines,
  validateDocuments,
} from './copy.mjs';
import {
  CHANNEL_TYPES, PERMISSIONS, deriveOverwrites, mergeOverwrites, overwritesEqual,
  planChannels, planOnboarding, planPositions, planRoles, validateConfig,
} from './plan.mjs';
import {
  ARCHIVE_CATEGORY, CATEGORIES, ONBOARDING, PHASES, allChannels, allRoles,
} from './server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARGS = process.argv.slice(2);
const COMMAND = ARGS[0];

const has = (flag) => ARGS.includes(flag);
const valueOf = (flag, fallback = null) => {
  const i = ARGS.indexOf(flag);
  return i >= 0 && ARGS[i + 1] && !ARGS[i + 1].startsWith('--') ? ARGS[i + 1] : fallback;
};

const TTY = process.stdout.isTTY;
const C = TTY
  ? { red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', dim: '\x1b[2m', bold: '\x1b[1m', off: '\x1b[0m' }
  : { red: '', yellow: '', green: '', dim: '', bold: '', off: '' };

const say = (...a) => console.log(...a);
const die = (message) => { console.error(`${C.red}✗ ${message}${C.off}`); process.exit(1); };

/** Staff roles see every private channel — see `deriveOverwrites`. */
const STAFF_ROLE_KEYS = allRoles().filter((r) => r.staff).map((r) => r.key);

// ── Shared setup ──────────────────────────────────────────────────────────

function resolvePhase() {
  const phase = has('--all') ? 'growth' : valueOf('--phase', 'launch');
  if (!PHASES.includes(phase)) die(`Unknown phase "${phase}". Expected one of: ${PHASES.join(', ')}.`);
  return phase;
}

/**
 * Refuse to touch a guild with a config that does not validate.
 *
 * A sync is not atomic — Discord has no transaction — so a config that fails on
 * channel 21 leaves twenty channels created and the server in a state nobody
 * designed. The cheap check runs first, every time, including under `--apply`.
 */
function assertConfigValid() {
  const structure = validateConfig({ categories: CATEGORIES, roles: allRoles(), onboarding: ONBOARDING, phases: PHASES });
  const documents = validateDocuments(CATEGORIES);
  const errors = [...structure.errors, ...documents.errors];
  if (errors.length > 0) {
    console.error(`${C.red}The config does not validate — nothing was sent.${C.off}`);
    for (const error of errors) console.error(`  ✗ ${error}`);
    process.exit(1);
  }
  return { structure, documents };
}

async function connect({ dryRun }) {
  const token = loadToken();
  const guildId = loadGuildId();
  if (!token) die('DISCORD_BOT_TOKEN is not set. See discord/README.md for how to create the bot and where to put the token.');
  if (!guildId) die('DISCORD_GUILD_ID is not set. Right-click your server in Discord → Copy Server ID (Developer Mode must be on).');

  const client = new DiscordClient({ token, guildId, dryRun, reason: 'discord:sync (structure as code)' });
  const identity = await client.me().catch((error) => die(`Could not authenticate: ${error.message}`));
  const guild = await client.guild().catch((error) => die(`Could not read guild ${guildId}: ${error.message}`));
  say(`${C.dim}Connected as ${identity.username} → ${guild.name}${C.off}`);
  return { client, guild };
}

/**
 * Warn when the bot cannot do what the plan asks.
 *
 * Discord answers a permission problem with a 403 on the twentieth request, not
 * the first, so without this the failure arrives with the server half-built and
 * an error that names an endpoint rather than the cause.
 */
async function checkBotPermissions(client, guild) {
  const member = await client.selfMember().catch(() => null);
  if (!member) return;
  const roles = await client.roles().catch(() => []);
  const byId = new Map(roles.map((r) => [r.id, r]));
  let bits = 0n;
  for (const id of member.roles ?? []) bits |= BigInt(byId.get(id)?.permissions ?? 0);
  // @everyone carries the guild-wide baseline and its id is the guild's id.
  bits |= BigInt(byId.get(guild.id)?.permissions ?? 0);

  if (bits & PERMISSIONS.ADMINISTRATOR) return;
  const needed = ['MANAGE_CHANNELS', 'MANAGE_ROLES', 'SEND_MESSAGES', 'MANAGE_MESSAGES'];
  const missing = needed.filter((name) => !(bits & PERMISSIONS[name]));
  if (missing.length > 0) {
    say(`${C.yellow}⚠ The bot is missing: ${missing.join(', ')}. Give its role Administrator, or those four permissions, before applying.${C.off}`);
  }
  // Without Administrator the bot can only manage roles BELOW its own, so a
  // role list written top-down will fail partway through on the staff roles.
  const own = (member.roles ?? []).map((id) => byId.get(id)?.position ?? 0);
  const highest = own.length > 0 ? Math.max(...own) : 0;
  const above = roles.filter((r) => r.position > highest && r.name !== '@everyone');
  if (above.length > 0) {
    say(`${C.yellow}⚠ ${above.length} role(s) sit above the bot's own role and cannot be edited by it (${above.slice(0, 3).map((r) => r.name).join(', ')}${above.length > 3 ? '…' : ''}). Drag the bot's role higher in Server Settings → Roles.${C.off}`);
  }
}

// ── validate ──────────────────────────────────────────────────────────────

async function commandValidate() {
  const structure = validateConfig({ categories: CATEGORIES, roles: allRoles(), onboarding: ONBOARDING, phases: PHASES });
  const documents = validateDocuments(CATEGORIES);
  const errors = [...structure.errors, ...documents.errors];
  const warnings = [...structure.warnings, ...documents.warnings];

  say(`${C.bold}Deep Life Simulator — Discord config${C.off}`);
  say(`  ${allRoles().length} roles · ${CATEGORIES.length} categories · ${allChannels().length} channels · ${Object.keys(DOCUMENTS).length} documents`);
  for (const note of structure.notes) say(`  ${C.dim}${note}${C.off}`);

  // The release post is rendered here, offline, for one reason: it is the only
  // thing in this system whose input lives in another file that someone else
  // edits. `APPLE.whatsNew` grows every release, and the run that finds it too
  // long should be a local `validate`, not the one posting to the community.
  try {
    const { APPLE } = await import('../marketing/aso/metadata.mjs');
    renderReleasePost({ storeVersion: APPLE.storeVersion, whatsNew: APPLE.whatsNew });
    say(`  ${C.dim}Release post for ${APPLE.storeVersion} renders within Discord's limits.${C.off}`);
  } catch (error) {
    errors.push(`Release post: ${error.message}`);
  }
  say('');

  for (const warning of warnings) say(`${C.yellow}⚠ ${warning}${C.off}`);
  for (const error of errors) say(`${C.red}✗ ${error}${C.off}`);

  if (errors.length > 0) {
    say(`\n${C.red}${errors.length} error(s). Fix these before syncing.${C.off}`);
    process.exit(1);
  }
  say(`${C.green}✓ Config is valid${warnings.length > 0 ? ` (${warnings.length} warning(s))` : ''}.${C.off}`);
}

// ── sync ──────────────────────────────────────────────────────────────────

async function commandSync() {
  assertConfigValid();
  const apply = has('--apply');
  const phase = resolvePhase();
  const { client, guild } = await connect({ dryRun: !apply });
  if (apply) await checkBotPermissions(client, guild);

  const community = (guild.features ?? []).includes('COMMUNITY');
  say(`${C.dim}Phase: ${phase} · Community server: ${community ? 'yes' : 'no'}${C.off}\n`);

  // ── Roles ───────────────────────────────────────────────────────────────
  const liveRoles = await client.roles();
  const rolePlan = planRoles({ desired: allRoles(), live: liveRoles });
  const roleIds = { ...rolePlan.roleIds };

  for (const op of rolePlan.operations) {
    if (op.op === 'create-role') {
      say(`  ${C.green}+ role${C.off}   ${op.name}`);
      const created = await client.createRole(op.body);
      roleIds[op.key] = created?.id ?? null;
    } else if (op.op === 'update-role') {
      say(`  ${C.yellow}~ role${C.off}   ${op.name}  ${C.dim}${Object.keys(op.body).join(', ')}${C.off}`);
      await client.updateRole(op.id, op.body);
    } else if (op.op === 'skip-role') {
      say(`  ${C.yellow}· role${C.off}   ${op.name} — ${op.reason}`);
    }
  }

  // ── Channels ────────────────────────────────────────────────────────────
  const liveChannels = await client.channels();
  const categories = resolveForumGuidelines(CATEGORIES);
  const channelPlan = planChannels({
    categories, live: liveChannels, roleIds, everyoneId: guild.id,
    staffRoleKeys: STAFF_ROLE_KEYS, phase, community,
  });

  for (const warning of channelPlan.warnings) say(`  ${C.yellow}⚠ ${warning}${C.off}`);

  /** key → live id, filled as the plan executes. Documents and onboarding need it. */
  const channelIds = {};
  const created = new Map();

  for (const op of channelPlan.operations) {
    switch (op.op) {
      case 'create-category': {
        say(`  ${C.green}+ category${C.off}  ${op.name}`);
        const result = await client.createChannel(op.body);
        created.set(op.key, result?.id ?? null);
        // Everything under a category created in this run has to learn its
        // parent id now — the plan was built before the category existed.
        for (const next of channelPlan.operations) {
          if (next.parentKey === op.key && next.parentId === null) next.parentId = result?.id ?? null;
        }
        break;
      }
      case 'update-category':
        say(`  ${C.yellow}~ category${C.off}  ${op.name}  ${C.dim}${Object.keys(op.body).join(', ')}${C.off}`);
        await client.updateChannel(op.id, op.body);
        created.set(op.key, op.id);
        break;
      case 'create-channel': {
        say(`  ${C.green}+ channel${C.off}   ${op.name}`);
        const result = await client.createChannel({ ...op.body, ...(op.parentId ? { parent_id: op.parentId } : {}) });
        channelIds[op.key] = result?.id ?? null;
        created.set(op.key, result?.id ?? null);
        break;
      }
      case 'move-channel':
        say(`  ${C.yellow}→ channel${C.off}   ${op.name}  ${C.dim}moved into ${op.parentKey}${C.off}`);
        await client.updateChannel(op.id, op.body);
        channelIds[op.key] = op.id;
        break;
      case 'update-channel':
        say(`  ${C.yellow}~ channel${C.off}   ${op.name}  ${C.dim}${Object.keys(op.body).join(', ')}${C.off}`);
        await client.updateChannel(op.id, op.body);
        channelIds[op.key] = op.id;
        break;
      case 'unchanged-channel':
        channelIds[op.key] = op.id;
        break;
      case 'skip-channel':
        say(`  ${C.yellow}· channel${C.off}   ${op.name} — ${op.reason}`);
        break;
      default:
        break;
    }
  }

  // ── Layout ──────────────────────────────────────────────────────────────
  // `liveChannels` is the state as it was READ, so a run that created channels
  // always has work here; a run that changed nothing correctly finds none.
  const positions = planPositions(
    channelPlan.operations,
    (op) => op.id ?? created.get(op.key) ?? channelIds[op.key] ?? null,
    liveChannels,
  );
  if (positions.length > 0) {
    say(`  ${C.dim}· ordering ${positions.length} channels${C.off}`);
    await client.setPositions(positions);
  }

  // ── Documents ───────────────────────────────────────────────────────────
  await syncDocuments(client, channelPlan.operations, channelIds, apply);

  // ── Onboarding ──────────────────────────────────────────────────────────
  if (has('--onboarding')) await syncOnboarding(client, roleIds, channelIds, community, phase);

  // ── Orphans ─────────────────────────────────────────────────────────────
  await reportOrphans(client, channelPlan.orphans, rolePlan.orphans, roleIds, guild, phase);

  say('');
  if (apply) {
    say(`${C.green}✓ Synced. ${client.writes.length} write(s).${C.off}`);
  } else {
    say(`${C.bold}${client.writes.length} write(s) planned. Nothing was sent.${C.off}`);
    say(`Run ${C.bold}npm run discord:sync${C.off} to perform this plan.`);
  }
}

/**
 * Post or update every channel's pinned document.
 *
 * The bot looks for ITS OWN message carrying `dls-doc:<key>` in the embed
 * footer and edits that. Without a marker the only way to be idempotent is to
 * guess from the content, and a guess that misses posts a second copy of the
 * rules — every run, forever.
 */
async function syncDocuments(client, operations, channelIds, apply) {
  const withDocs = operations.filter((op) => op.doc && channelIds[op.key]);
  for (const op of withDocs) {
    const channelId = channelIds[op.key];
    const payload = renderDocument(op.doc, channelIds);

    // A channel created in this run (or in a dry run) has no history to read.
    let existing = null;
    if (!String(channelId).startsWith('dry:')) {
      const recent = await client.messages(channelId, 50).catch(() => []);
      existing = (recent ?? []).find((m) => isDocMessage(m, op.doc)) ?? null;
    }

    if (existing) {
      const unchanged = JSON.stringify(existing.embeds?.[0]?.description) === JSON.stringify(payload.embeds[0].description)
        && existing.embeds?.[0]?.title === payload.embeds[0].title;
      if (unchanged) continue;
      say(`  ${C.yellow}~ doc${C.off}       ${op.doc} in ${op.name}`);
      await client.editMessage(channelId, existing.id, payload);
    } else {
      say(`  ${C.green}+ doc${C.off}       ${op.doc} in ${op.name}`);
      const message = await client.createMessage(channelId, payload);
      if (apply && message?.id) await client.pinMessage(channelId, message.id).catch(() => {
        say(`  ${C.yellow}⚠ posted ${op.doc} but could not pin it — the bot needs Manage Messages in ${op.name}.${C.off}`);
      });
    }
  }
}

async function syncOnboarding(client, roleIds, channelIds, community, phase) {
  if (!community) {
    say(`  ${C.yellow}⚠ Onboarding needs a Community server. Server Settings → Enable Community, then re-run with --onboarding.${C.off}`);
    return;
  }
  const live = await client.onboarding().catch(() => null);
  const { body, missing, changed } = planOnboarding({ onboarding: ONBOARDING, roleIds, channelIds, live });

  const growthKeys = new Set(allChannels().filter((c) => c.phase === 'growth').map((c) => c.key));
  for (const problem of missing) {
    // A prompt pointing at a channel this phase does not build yet is expected,
    // not a fault — it becomes real on the run that builds it.
    const expected = problem.kind === 'channel' && growthKeys.has(problem.key) && phase === 'launch';
    say(expected ? `  ${C.dim}· ${problem.message} (growth phase)${C.off}` : `  ${C.yellow}⚠ ${problem.message}${C.off}`);
  }

  if (!changed) return;
  say(`  ${C.green}~ onboarding${C.off}  ${body.prompts.length} prompt(s), ${body.default_channel_ids.length} default channel(s)`);
  await client.setOnboarding(body).catch((error) => {
    say(`  ${C.red}✗ Onboarding was rejected: ${error.message}${C.off}`);
    say(`  ${C.dim}Everything else synced. Set the join questions by hand in Server Settings → Onboarding if this keeps failing.${C.off}`);
  });
}

/**
 * Orphans — live things the config does not describe.
 *
 * Reported by default and never deleted. Under `--prune` they are moved into a
 * hidden archive category instead: a channel's history cannot be recovered, and
 * "absent from a config file" is much more often a channel somebody created in
 * the client than a channel nobody wants. Archiving hides it from members,
 * keeps it readable by staff, and leaves the irreversible half to a person.
 */
async function reportOrphans(client, channelOrphans, roleOrphans, roleIds, guild, phase) {
  const growthPending = phase === 'launch'
    ? allChannels().filter((c) => c.phase === 'growth').length
    : 0;
  if (growthPending > 0) {
    say(`\n  ${C.dim}${growthPending} growth channel(s) not built yet — run with --phase growth when the community is ready for them.${C.off}`);
  }

  if (roleOrphans.length > 0) {
    say(`\n  ${C.dim}Roles on the server that this config does not describe (left alone):${C.off}`);
    for (const role of roleOrphans) say(`    ${C.dim}· ${role.name}${C.off}`);
  }
  if (channelOrphans.length === 0) return;

  say(`\n  ${C.dim}Channels on the server that this config does not describe:${C.off}`);
  for (const channel of channelOrphans) say(`    ${C.dim}· ${channel.name}${C.off}`);

  if (!has('--prune')) {
    say(`  ${C.dim}Left alone. Pass --prune to move them into ${ARCHIVE_CATEGORY.name} (hidden from members, never deleted).${C.off}`);
    return;
  }

  const existingArchive = channelOrphans.find((c) => c.name === ARCHIVE_CATEGORY.name && c.type === CHANNEL_TYPES.category);
  let archiveId = existingArchive?.id ?? null;
  const overwrites = deriveOverwrites({ ...ARCHIVE_CATEGORY, type: 'category' }, { everyoneId: guild.id, roleIds, staffRoleKeys: STAFF_ROLE_KEYS });

  if (!archiveId) {
    say(`  ${C.green}+ category${C.off}  ${ARCHIVE_CATEGORY.name}`);
    const result = await client.createChannel({ name: ARCHIVE_CATEGORY.name, type: CHANNEL_TYPES.category, permission_overwrites: overwrites });
    archiveId = result?.id ?? null;
  }

  for (const channel of channelOrphans) {
    if (channel.id === archiveId) continue;
    // A category cannot be nested inside another category, so an orphaned
    // category is emptied by moving its children and then left where it is.
    if (channel.type === CHANNEL_TYPES.category) continue;
    if (channel.parent_id === archiveId) continue;
    say(`  ${C.yellow}→ archive${C.off}   ${channel.name}`);
    const merged = mergeOverwrites(channel.permission_overwrites, overwrites, new Set([guild.id, ...Object.values(roleIds).filter(Boolean)]));
    const body = { parent_id: archiveId };
    if (!overwritesEqual(channel.permission_overwrites, merged)) body.permission_overwrites = merged;
    await client.updateChannel(channel.id, body);
  }
}

// ── backup / restore ──────────────────────────────────────────────────────

async function commandBackup() {
  const { client, guild } = await connect({ dryRun: false });
  const [roles, channels, onboarding] = await Promise.all([
    client.roles(), client.channels(), client.onboarding().catch(() => null),
  ]);

  const snapshot = {
    takenAt: new Date().toISOString(),
    guild: { id: guild.id, name: guild.name, features: guild.features ?? [] },
    roles: roles.map((r) => ({ id: r.id, name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable, permissions: String(r.permissions), position: r.position, managed: Boolean(r.managed) })),
    channels: channels.map((c) => ({
      id: c.id, name: c.name, type: c.type, parent_id: c.parent_id ?? null, position: c.position,
      topic: c.topic ?? null, rate_limit_per_user: c.rate_limit_per_user ?? 0,
      available_tags: c.available_tags ?? undefined,
      permission_overwrites: (c.permission_overwrites ?? []).map((o) => ({ id: o.id, type: o.type, allow: String(o.allow), deny: String(o.deny) })),
    })),
    onboarding,
  };

  const dir = valueOf('--out', path.join(ROOT, 'discord', 'backups'));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${guild.id}-${snapshot.takenAt.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`);

  say(`${C.green}✓ Backed up${C.off} ${snapshot.roles.length} roles and ${snapshot.channels.length} channels`);
  say(`  ${file}`);
  say(`  ${C.dim}Structure only — messages, members and role assignments are not in here and cannot be restored.${C.off}`);
}

/**
 * Re-create what a backup had and the guild no longer does.
 *
 * Additive by design: it never edits or removes anything that is currently
 * live. Restore runs after something was deleted by accident, and at that
 * moment the last thing anyone needs is a tool that also rewrites the parts
 * that survived.
 */
async function commandRestore() {
  const file = valueOf('--from');
  if (!file) die('restore needs --from <backup.json>. Run `node discord/cli.mjs backup` first, or point it at a file in discord/backups/.');
  if (!fs.existsSync(file)) die(`No such backup: ${file}`);

  const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
  const apply = has('--apply');
  const { client, guild } = await connect({ dryRun: !apply });

  if (snapshot.guild?.id !== guild.id) {
    say(`${C.yellow}⚠ This backup is from "${snapshot.guild?.name}" (${snapshot.guild?.id}) and you are connected to "${guild.name}" (${guild.id}).${C.off}`);
    if (!has('--force')) die('Refusing to restore across servers. Pass --force if that is genuinely what you want.');
  }

  const [liveRoles, liveChannels] = await Promise.all([client.roles(), client.channels()]);
  const liveRoleNames = new Set(liveRoles.map((r) => r.name));
  const liveChannelNames = new Set(liveChannels.map((c) => c.name));

  const missingRoles = (snapshot.roles ?? []).filter((r) => !r.managed && r.name !== '@everyone' && !liveRoleNames.has(r.name));
  const missingChannels = (snapshot.channels ?? []).filter((c) => !liveChannelNames.has(c.name));

  if (missingRoles.length === 0 && missingChannels.length === 0) {
    say(`${C.green}✓ Nothing to restore — every role and channel in that backup still exists.${C.off}`);
    return;
  }

  /** Old id → new id, so a restored channel lands under its restored parent. */
  const remapped = new Map();
  for (const role of missingRoles) {
    say(`  ${C.green}+ role${C.off}   ${role.name}`);
    const result = await client.createRole({ name: role.name, permissions: role.permissions, color: role.color, hoist: role.hoist, mentionable: role.mentionable });
    remapped.set(role.id, result?.id ?? null);
  }

  const byOldId = new Map((snapshot.channels ?? []).map((c) => [c.id, c]));
  const liveByName = new Map(liveChannels.map((c) => [c.name, c.id]));
  // Categories before their children, or a restored channel has nowhere to go.
  const ordered = [...missingChannels].sort((a, b) => (a.type === CHANNEL_TYPES.category ? -1 : 0) - (b.type === CHANNEL_TYPES.category ? -1 : 0));

  for (const channel of ordered) {
    const parentOld = channel.parent_id;
    const parentId = parentOld
      ? remapped.get(parentOld) ?? liveByName.get(byOldId.get(parentOld)?.name) ?? null
      : null;

    // Overwrites are rewritten through the remap: a deleted role that was just
    // recreated has a NEW id, and replaying the old one would either fail or —
    // worse — hit whatever now owns that snowflake.
    const overwrites = (channel.permission_overwrites ?? [])
      .map((o) => ({ ...o, id: remapped.get(o.id) ?? o.id }))
      .filter((o) => o.id === guild.id || remapped.has(o.id) || liveRoles.some((r) => r.id === o.id));

    say(`  ${C.green}+ channel${C.off}   ${channel.name}`);
    const result = await client.createChannel({
      name: channel.name, type: channel.type,
      ...(parentId ? { parent_id: parentId } : {}),
      ...(channel.topic ? { topic: channel.topic } : {}),
      ...(channel.rate_limit_per_user ? { rate_limit_per_user: channel.rate_limit_per_user } : {}),
      ...(channel.available_tags ? { available_tags: channel.available_tags } : {}),
      permission_overwrites: overwrites,
    });
    remapped.set(channel.id, result?.id ?? null);
  }

  say('');
  say(`  ${C.dim}Messages are not restored — Discord has no API for that, and a deleted channel takes its history with it.${C.off}`);
  if (apply) say(`${C.green}✓ Restored ${missingRoles.length} role(s) and ${missingChannels.length} channel(s).${C.off}`);
  else say(`${C.bold}${client.writes.length} write(s) planned. Nothing was sent — re-run with --apply.${C.off}`);
}

// ── announce / release ────────────────────────────────────────────────────

/** Resolve a channel KEY (as written in server.mjs) to a live channel object. */
async function findChannel(client, key) {
  const desired = allChannels().find((c) => c.key === key);
  if (!desired) die(`"${key}" is not a channel in discord/server.mjs. Known keys: ${allChannels().map((c) => c.key).join(', ')}`);
  const live = await client.channels();
  const match = live.find((c) => c.name === desired.name || c.name === desired.name.toLowerCase());
  if (!match) die(`"${desired.name}" does not exist on the server yet. Run \`npm run discord:sync\` first.`);
  return { desired, channel: match };
}

async function publishIfAnnouncement(client, channel, message, apply) {
  if (!has('--publish')) return;
  if (channel.type !== CHANNEL_TYPES.announcement) {
    say(`  ${C.yellow}⚠ --publish was ignored: ${channel.name} is not an announcement channel, so there is nothing to push to followers.${C.off}`);
    return;
  }
  if (!apply || !message?.id) return;
  await client.crosspost(channel.id, message.id).catch((error) => {
    say(`  ${C.yellow}⚠ Posted, but publishing to followers failed: ${error.message}${C.off}`);
  });
  say(`  ${C.dim}· published to followers${C.off}`);
}

async function commandAnnounce() {
  const apply = has('--apply');
  const title = valueOf('--title');
  const bodyFile = valueOf('--body-file');
  const body = bodyFile ? fs.readFileSync(bodyFile, 'utf8') : valueOf('--body');
  const key = valueOf('--channel', 'announcements');

  if (!title) die('announce needs --title "…".');
  if (!body) die('announce needs --body "…" or --body-file <file.md>.');

  const { client } = await connect({ dryRun: !apply });
  const { channel } = await findChannel(client, key);
  const payload = renderAnnouncement({ title, body });

  say(`\n${C.bold}${payload.embeds[0].title}${C.off}`);
  say(`${C.dim}${payload.embeds[0].description.split('\n').slice(0, 6).join('\n')}${payload.embeds[0].description.split('\n').length > 6 ? '\n…' : ''}${C.off}`);
  say(`\n  → ${channel.name}`);

  const message = await client.createMessage(channel.id, payload);
  await publishIfAnnouncement(client, channel, message, apply);

  say('');
  say(apply ? `${C.green}✓ Posted.${C.off}` : `${C.bold}Nothing was sent. Re-run with --apply to post.${C.off}`);
}

/**
 * Post the current release notes.
 *
 * The copy is `APPLE.whatsNew` from `marketing/aso/metadata.mjs` — the same
 * text sent to the App Store, read from the same file `check:aso` validates.
 * The alternative is a second copy of the release notes written for Discord,
 * and CLAUDE.md's rule about the three descriptions of one release applies just
 * as much to a fourth: a reader who finds them disagreeing cannot tell which is
 * the lie.
 */
async function commandRelease() {
  const apply = has('--apply');
  const { APPLE } = await import('../marketing/aso/metadata.mjs');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  const payload = renderReleasePost({
    // The STORE version, not package.json's. See renderReleasePost and
    // CLAUDE.md §9 — the two numbers differ on purpose and only one of them
    // exists on the product page a player is about to open.
    storeVersion: valueOf('--version', APPLE.storeVersion),
    whatsNew: APPLE.whatsNew,
    buildVersion: pkg.version,
  });

  const { client } = await connect({ dryRun: !apply });
  const { channel } = await findChannel(client, valueOf('--channel', 'update-notes'));

  say(`\n${C.bold}${payload.embeds[0].title}${C.off}`);
  say(`${C.dim}${payload.embeds[0].description.split('\n').slice(0, 8).join('\n')}\n…${C.off}`);
  say(`\n  → ${channel.name}`);

  const message = await client.createMessage(channel.id, payload);
  await publishIfAnnouncement(client, channel, message, apply);

  say('');
  if (apply) say(`${C.green}✓ Release posted.${C.off}`);
  else say(`${C.bold}Nothing was sent. Re-run with --apply to post${has('--publish') ? ' and publish' : ''}.${C.off}`);
}

// ── Dispatch ──────────────────────────────────────────────────────────────

const COMMANDS = {
  validate: commandValidate,
  sync: commandSync,
  backup: commandBackup,
  restore: commandRestore,
  announce: commandAnnounce,
  release: commandRelease,
};

async function main() {
  const run = COMMANDS[COMMAND];
  if (!run) {
    say(`${C.bold}Deep Life Simulator — Discord as code${C.off}\n`);
    say('  validate                      check the config (no token needed)');
    say('  sync [--apply] [--phase growth] [--prune] [--onboarding]');
    say('  backup [--out <dir>]');
    say('  restore --from <file> [--apply]');
    say('  announce --title T --body-file F [--channel key] [--publish] [--apply]');
    say('  release [--channel key] [--publish] [--apply]\n');
    say(`${C.dim}Nothing writes without --apply. See discord/README.md.${C.off}`);
    process.exit(COMMAND ? 1 : 0);
  }
  await run();
}

main().catch((error) => {
  console.error(`${C.red}✗ ${error?.message ?? error}${C.off}`);
  if (process.env.DEBUG) console.error(error);
  process.exit(1);
});
