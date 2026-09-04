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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_PATH = path.join(ROOT, 'discord/state/last-notified-pr.json');
const DRY_RUN = process.argv.includes('--dry-run');
const REPO = process.env.GITHUB_REPOSITORY || 'Wrexist/DeepLifeSimulator';
const MAX_PRS_PER_POST = 12; // Discord embed description budget, not a soft cap on shipping fast.

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

/**
 * Strips PR noise a player doesn't care about (dependency bumps, CI-only
 * changes, pure test/refactor work) so the channel reads as "what's new for
 * you", not a commit log. Conservative on purpose: an unmatched title is kept,
 * because a hidden real feature is worse than one filtered post reading dry.
 */
function isPlayerFacing(pr) {
  const title = pr.title.toLowerCase();
  const noise = [/^chore/, /^ci[:(]/, /^test[:(]/, /^deps?[:(]/, /^refactor/, /^docs?[:(]/, /bump .* to /];
  return !noise.some((re) => re.test(title));
}

function formatEntry(pr) {
  return `• ${pr.title.replace(/\s+/g, ' ').trim()} ([#${pr.number}](${pr.html_url}))`;
}

async function postToDiscord(payload) {
  const webhook = process.env.DISCORD_WEBHOOK_DEVELOPMENT;
  if (!webhook) {
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
    console.log(`No prior state found — seeding baseline at PR #${highest} without posting.`);
    if (!DRY_RUN) writeState({ lastPrNumber: highest });
    return;
  }

  const fresh = merged
    .filter((pr) => pr.number > state.lastPrNumber)
    .filter(isPlayerFacing)
    .sort((a, b) => a.number - b.number);

  if (fresh.length === 0) {
    console.log(`Nothing new since PR #${state.lastPrNumber}.`);
    return;
  }

  const highestNumber = Math.max(...merged.filter((pr) => pr.number > state.lastPrNumber).map((pr) => pr.number));
  const shown = fresh.slice(-MAX_PRS_PER_POST);
  const omitted = fresh.length - shown.length;

  const body = [
    "Here's what the team shipped behind the scenes — full release notes land in #updates when it's actually live:",
    '',
    ...shown.map(formatEntry),
    omitted > 0 ? `\n…and ${omitted} more.` : '',
  ].filter(Boolean).join('\n');

  const payload = renderAnnouncement({
    title: `🛠️ ${fresh.length} update${fresh.length === 1 ? '' : 's'} in the works`,
    body,
    color: 0x57f287,
  });

  await postToDiscord(payload);
  console.log(`Posted ${fresh.length} PR(s), advancing state to #${highestNumber}.`);

  if (!DRY_RUN) writeState({ lastPrNumber: highestNumber });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
