# Discord automation + server professionalization — plan

Owner request: a bot that (1) posts GitHub activity to #future-updates as
structured "hype" marketing, (2) posts App Store / Google Play releases to
#updates the moment they go live, (3) watches bug reports (Discord +
deeplifesimulator@gmail.com) and auto-fixes them on a working branch (no PR),
and (4) brings every other channel up to a professional, structured,
automated standard. Architecture: Claude scheduled Routines
(`create_trigger`), not a long-running bot process.

Existing infra this builds on (do not duplicate):
- `discord/` — server-as-code, `discord/copy.mjs` render helpers
  (`renderReleasePost`, `renderAnnouncement`), `discord/cli.mjs`.
- `.github/workflows/discord.yml` — already posts to #update-notes on GitHub
  `release: published`, gated on `DISCORD_BOT_TOKEN` + `DISCORD_GUILD_ID`
  secrets (not yet set).
- `docs/ASC-AUTOMATION.md` / `scripts/asc-release.mjs` — read-only App Store
  status via `ASC_KEY_ID`/`ASC_ISSUER_ID`/`ASC_KEY_P8` (already configured as
  repo secrets).
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (already configured as a repo secret).

## 1. Webhooks (posting side — no bot token needed)
- [x] Create #updates webhook ("Store Release Bot"), saved to `.env.local` as
      `DISCORD_WEBHOOK_UPDATES`.
- [ ] Create/collect #future-updates webhook ("GitHub Hype Bot") — waiting on
      user to paste the URL; save as `DISCORD_WEBHOOK_FUTURE_UPDATES`.

## 2. Store release watcher → #updates
- [ ] `scripts/notify-store-release.mjs`: reads last-notified version from a
      small state file, calls the existing ASC status check + Google Play
      Developer API, and if either version is new AND newly live, posts via
      `discord/copy.mjs`'s `renderReleasePost` to `DISCORD_WEBHOOK_UPDATES`.
- [ ] Scheduled Routine (hourly-ish) that runs it via `device_bash` against
      the real repo (needs `requires_local_device: true`) OR a GitHub Actions
      cron using the secrets already in Actions — prefer GitHub Actions for
      this one since it only needs read-only API calls and no repo edits.

## 3. GitHub → #future-updates hype poster
- [ ] `scripts/notify-github-activity.mjs`: reads recent merged PRs / commits
      since last run (state file), drafts a short "structured marketing"
      style embed (what shipped, why a player should care) using
      `renderAnnouncement`, posts to `DISCORD_WEBHOOK_FUTURE_UPDATES`.
- [ ] Scheduled Routine, daily, `requires_local_device: true` (drafting good
      copy is the reasoning-heavy part, better done by a live Claude turn
      than a static script).

## 4. Bug-report → auto-fix pipeline
- [ ] Blocked on two things — see "Needs you" below (bot token for reading
      Discord messages; deeplifesimulator@gmail.com inbox access).
- [ ] Design: scheduled Routine, `requires_local_device: true`, reads new
      bug-reports posts + new inbox mail, cross-references against
      `tasks/lessons.md` and CLAUDE.md Hard Rules, investigates root cause,
      fixes on a new branch off main (never main directly), commits, no PR
      (per your choice). Every fix must respect §4.3/§4.4 (try/catch on
      weekly tick, atomic money grants) and run the relevant test suite
      before committing (§8 "never mark work done without proof").
- [ ] Git hygiene needed first: set `user.name`/`user.email` locally, and
      investigate the ~2000-file `git status` diff (likely line-ending noise)
      so an automated commit never sweeps in unrelated changes.

## 5. Server-wide professionalization
- [ ] Run `npm run discord:plan` (read-only) to see the full diff between the
      live server and `discord/server.mjs` (bug-reports converts from a plain
      text channel to a tagged Forum channel, other channels likely
      renamed/reordered with emoji prefixes, etc).
- [ ] Show the user the diff before running `discord:sync --apply` — this is
      a real structural change to their live server, not just automation
      wiring.

## Needs the user (things I can't/shouldn't do myself)
1. Paste the #future-updates ("GitHub Hype Bot") webhook URL.
2. Discord bot token: retrieving it requires completing an MFA/password
   prompt in Discord's own UI — I won't ever enter your password. Needed for
   (a) the existing `discord.yml` release-announcer workflow and (b) reading
   messages in #bug-reports for the auto-fix pipeline.
3. deeplifesimulator@gmail.com access: this session's connected Gmail is
   isacmolin@gmail.com, not deeplifesimulator@gmail.com — need a decision on
   how to grant access (separate connector login, or a forward rule from that
   inbox into a mailbox already connected).
4. Approve `discord:sync --apply` after reviewing the plan diff in step 5.

