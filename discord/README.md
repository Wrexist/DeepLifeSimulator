# Discord as code

The Deep Life Simulator Discord server lives in this folder. Change a file, run
one command, and the live server follows — no clicking through Server Settings,
no forgetting which channel you made private.

```bash
npm run discord:validate    # check the config. No token, no network.
npm run discord:plan        # show exactly what a sync would do. Writes nothing.
npm run discord:sync        # do it
```

## First time: 10 minutes

**1. Make the bot.**
[discord.com/developers/applications](https://discord.com/developers/applications)
→ **New Application** → name it *Deep Life Sync* → **Bot** → **Reset Token** and
copy the token. It is shown once.

**2. Invite it, with Administrator.**
**OAuth2 → URL Generator** → scopes `bot` and `applications.commands` → bot
permission **Administrator** → open the generated URL and add it to the server.

Administrator is genuinely the right answer here, not laziness: the sync creates
private channels, and a bot without Administrator is itself subject to the
`@everyone` denial it just wrote — so it loses the ability to edit the pinned
document in the channel it created a moment earlier. It also needs to sit
*above* every role it manages. **Server Settings → Roles → drag *Deep Life Sync*
to the top.** `sync` warns you when it does not.

**3. Get the server id.** Turn on **User Settings → Advanced → Developer Mode**,
then right-click the server → **Copy Server ID**.

**4. Turn on Community.** **Server Settings → Enable Community.** Without it
Discord has no announcement channels, no forums and no onboarding, so
`📢・announcements`, `🚀・update-notes` and `🐛・bug-reports` are built as plain
text channels instead. The sync says so rather than failing, and converts them
on the next run once Community is on.

**5. Put the two values in your shell** (never in a file that gets committed):

```bash
export DISCORD_BOT_TOKEN='…'
export DISCORD_GUILD_ID='…'
```

**6. Look before you leap.**

```bash
npm run discord:plan        # read this output
npm run discord:sync        # then this
npm run discord:onboarding  # and the join flow, once channels exist
```

## Day to day

Everything is in **`server.mjs`**. Rename a channel, move it to another
category, hide it behind a role — then `npm run discord:sync`.

**Renaming.** Put the old name in `previousNames`:

```js
{ key: 'businesses', name: '🏢・businesses', previousNames: ['💰・businesses'], … }
```

Channels are matched by name, because Discord assigns the ids. Without the
breadcrumb a rename reads as *delete one, create another* — and the new one is
empty. Drop the entry once every server you sync has been through it.

**Never change a `key`.** That is the stable identity behind backups, documents
and onboarding. The name is the part that is free to move.

**Launch small.** Every channel carries `phase: 'launch' | 'growth'`. `sync`
builds `launch` only — about 17 channels visible to a new member. Empty channels
make a server look dead, and that impression is formed in the first thirty
seconds. When there are enough people to fill them:

```bash
npm run discord:sync:growth
```

A phase gates *creation* only. A growth channel that already exists is still
kept in step, and moving a channel back to `growth` never hides it from members
already using it.

## What it will and will not do

**It never deletes anything.** Not a channel, not a role, not a message. A
channel that exists on the server but not in `server.mjs` is reported and left
alone; `--prune` moves it into a hidden `🗄️ ARCHIVE` category instead, where
staff can still read it. A channel's history cannot be recovered, and "missing
from a config file" much more often means somebody made it in the client than
that nobody wants it. Deleting stays a human decision.

**It preserves access granted by hand.** If a moderator gave one person access
to one channel, the sync keeps that overwrite. It only replaces the ones for
roles it knows about.

**Nothing writes without `--apply`.** Every command runs as a plan first and
prints the exact requests it would send. The npm scripts named `:plan` are the
dry runs; the ones named `:sync`, `:announce` and `:release` pass `--apply`.

**It will not convert a text channel into a forum.** Discord cannot, so it says
so and skips, rather than replacing your bug reports with an empty forum. Rename
the old one and sync again. Text ↔ announcement *is* convertible and is done in
place, keeping every message.

## Commands

| Command | What it does |
|---|---|
| `npm run discord:validate` | Config only — duplicate names, unknown roles, Discord's limits, whether the release post fits. No token needed. |
| `npm run discord:plan` | Everything `sync` would do, printed. Writes nothing. |
| `npm run discord:sync` | Reconcile the launch phase. |
| `npm run discord:sync:growth` | …and the growth channels. |
| `npm run discord:sync:prune` | …and move orphans into the archive. |
| `npm run discord:onboarding` | Write the "what are you interested in?" join flow. |
| `npm run discord:backup` | Dump the live structure to `discord/backups/`. |
| `npm run discord:release` | Post the current release notes to `🚀・update-notes`. |
| `node discord/cli.mjs restore --from <file> --apply` | Re-create what a backup had and the server no longer does. |
| `node discord/cli.mjs announce --title "…" --body-file notes.md --publish --apply` | Post an announcement. |

`--publish` pushes an announcement-channel post to every server that follows
this one. It is ignored, with a warning, in a normal text channel.

## Release posts

```bash
npm run discord:release          # preview
npm run discord:release -- --apply --publish
```

The copy comes from `APPLE.whatsNew` in `marketing/aso/metadata.mjs` — the same
text sent to the App Store, so the release is not described twice in two places
that can disagree.

**The version in the post is the App Store version (1.5.x), not
`package.json`'s (2.10.x).** Those numbers differ on purpose and have since
1.2.7 — see CLAUDE.md §9. The store record is what a player sees on the product
page; the binary version appears only in the footer, where it helps a bug report
line up with a crash log. `__tests__/tooling/discordSync.test.ts` pins this.

It can also run itself: `.github/workflows/discord-release.yml` posts on a
published GitHub release, or on demand from the Actions tab. It needs
`DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID` as repository secrets.

## The files

| File | What is in it |
|---|---|
| `server.mjs` | **The server.** Roles, categories, channels, onboarding, progression. This is the file you edit. |
| `copy.mjs` | The pinned documents (welcome, rules, links, the bug-report template) and the release renderer. |
| `plan.mjs` | Pure. Desired + live → an ordered list of operations. Every decision about what counts as "the same channel" is here. |
| `api.mjs` | The REST client. Rate limits, retries, and the `dryRun` guard. |
| `cli.mjs` | The commands. |

No dependencies — Node 22's `fetch` is all of it. `npm run discord:validate`
works in a fresh clone with nothing installed.

## Levels

`server.mjs` defines the progression roles (`👤 New Citizen` → `🌎 Life Legend`)
and the sync creates them. **Awarding them on activity is a levelling bot's
job** — MEE6, Carl-bot and Lurkr all take a level → role table, and
`PROGRESSION_ROLES` is where you copy it from. This CLI runs once and exits; it
is not a gateway bot and does not watch messages.

Levels deliberately buy status, early news, beta invites and developer Q&As —
**never in-game currency.** Paying people to post buys posts, and what that
produces is noise.

## When something goes wrong

**"Missing Permissions" partway through.** The bot's role is below the roles it
is editing. Drag it to the top of Server Settings → Roles.

**A duplicate channel appeared.** The channel was renamed in the Discord client
and the config was not told. Add the current live name to `previousNames`, sync,
and it renames the original back — then delete the duplicate by hand.

**Onboarding was rejected.** It needs Community enabled and at least seven
default channels. The error is printed and the rest of the sync still applies;
worst case, set the join questions in Server Settings → Onboarding by hand.

**A run died halfway.** Nothing to undo — run it again. Everything already
created is matched and left alone, and only the remainder is built.
