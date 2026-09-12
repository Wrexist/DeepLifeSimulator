#!/usr/bin/env node
// scripts/notify-github-hype.mjs
//
// Turns recently-merged PRs into one "here's what's new" post in
// #🛠️・development. Deliberately NOT one post per PR — a channel that fires on
// every merge trains readers to ignore it. This batches everything merged
// since the last run into a single structured announcement.
//
// It used to target #future-updates, a channel `discord/server.mjs` described
// as pre-existing and which no longer exists in the guild (2026-09-04). Rather
// than recreate an empty channel for one automated feed, the posts go to
// #development, whose topic already covers them: work in progress, things that
// may never ship. The secret was renamed with it, so the name still says where
// the posts land.
//
// State: discord/state/last-notified-pr.json — the highest merged PR number
// already posted. The scheduled workflow commits it back with GITHUB_TOKEN.
//
//   node scripts/notify-github-hype.mjs           post if there's anything new
//   node scripts/notify-github-hype.mjs --dry-run  print, write nothing, don't advance state
//
// Needs: DISCORD_WEBHOOK_DEVELOPMENT, GITHUB_TOKEN (Actions provides this
// automatically; a repo-scoped PAT works too for local runs), GITHUB_REPOSITORY
// (owner/repo — Actions sets this automatically).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderAnnouncement } from '../discord/copy.mjs';
import { playerNotesFromPr, developmentNoteBody } from '../discord/playerNotes.mjs';
import { watcherSummary } from './lib/watcherSummary.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_PATH = path.join(ROOT, 'discord/state/last-notified-pr.json');
const DRY_RUN = process.argv.includes('--dry-run');
const REPO = process.env.GITHUB_REPOSITORY || 'Wrexist/DeepLifeSimulator';

function readState() {
  try {
    return { ...JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')), _isFirstRun: false };
  } catch {
    // No state file yet: seed to "everything merged so far is already old
    // news" rather than dumping the whole PR history into the channel.
    return { lastPrNumber: 0, _isFirstRun: true };
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

async function githubApi(pathname) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'deeplife-hype-bot' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com${pathname}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${pathname} failed: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

/** Merged PRs, newest first, via the search API (cheap: one call, sorted). */
async function fetchRecentMergedPrs() {
  const q = encodeURIComponent(`repo:${REPO} is:pr is:merged`);
  const data = await githubApi(`/search/issues?q=${q}&sort=updated&order=desc&per_page=30`);
  return data.items ?? [];
}

async function postToDiscord(payload) {
  const webhook = process.env.DISCORD_WEBHOOK_DEVELOPMENT;
  if (!webhook) {
    if (!DRY_RUN) throw new Error('DISCORD_WEBHOOK_DEVELOPMENT missing; no announcement sent or checkpoint advanced.');
    console.warn('DISCORD_WEBHOOK_DEVELOPMENT is not set — printing the post instead of sending it.');
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  if (DRY_RUN) {
    console.log('[dry-run] would POST to Discord:', JSON.stringify(payload, null, 2));
    return;
  }
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Discord webhook post failed: HTTP ${res.status} ${await res.text()}`);
}

async function main() {
  const state = readState();
  const merged = await fetchRecentMergedPrs();

  if (state._isFirstRun) {
    const highest = merged.length ? Math.max(...merged.map((pr) => pr.number)) : 0;
    watcherSummary(`${DRY_RUN ? 'DRY RUN: would seed' : 'BASELINE ONLY: seeding'} PR #${highest}; no Discord message sent. State must be persisted by the following step.`);
    if (!DRY_RUN) writeState({ lastPrNumber: highest });
    return;
  }

  const fresh = merged
    .filter((pr) => pr.number > state.lastPrNumber)
    .sort((a, b) => a.number - b.number);

  if (fresh.length === 0) {
    watcherSummary(`NO POST: no new player-facing PRs since #${state.lastPrNumber}.`);
    return;
  }

  const highestNumber = Math.max(...merged.filter((pr) => pr.number > state.lastPrNumber).map((pr) => pr.number));
  const notes = [...new Set(fresh.flatMap(playerNotesFromPr))];
  if (!notes.length) {
    watcherSummary('NO POST: no authored player update notes; technical changes stay out of Discord.');
    if (!DRY_RUN) writeState({ lastPrNumber: highestNumber });
    return;
  }
  const payload = renderAnnouncement({
    title: '✨ Your next chapter is taking shape',
    body: developmentNoteBody(notes),
    color: 0x57f287,
  });
  payload.allowed_mentions = { parse: [] };

  await postToDiscord(payload);
  watcherSummary(DRY_RUN ? 'DRY RUN: activity announcement not sent; state unchanged.' : `SENT: Discord accepted ${fresh.length} PR(s); checkpoint #${highestNumber}.`);

  if (!DRY_RUN) writeState({ lastPrNumber: highestNumber });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
