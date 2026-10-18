#!/usr/bin/env node
// scripts/play-release.mjs
//
// Moves an Android build that Google Play already holds from one track to
// another (internal -> production by default), as a staged rollout or a full
// release, with the release notes from marketing/aso/metadata.mjs. Also reads
// what every track holds, and raises (or completes) a staged rollout.
//
//   node scripts/play-release.mjs --status
//   node scripts/play-release.mjs --promote --version-code <n> --rollout 0.2          (plan: validate, write nothing)
//   node scripts/play-release.mjs --promote --version-code <n> --rollout 0.2 --apply  (commit: sent for Google's review)
//   node scripts/play-release.mjs --set-rollout 0.5 [--apply]                         (raise a staged rollout; 1 = everyone)
//
// Flags: --from <track> (default internal), --to <track> (default production).
//
// Safety: every change happens inside a Play EDIT. Without --apply the edit is
// validated by Google and then DELETED, so a plan run proves the change would
// be accepted and changes nothing. Only --apply commits.
//
// Credentials: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (the key file's contents) or
// GOOGLE_PLAY_SERVICE_ACCOUNT_PATH. In CI they come from the repo secret the
// Android build workflow already uses; see .github/workflows/play-release.yml.

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  PlayClient,
  loadServiceAccount,
  findTrack,
  latestVersionCode,
  releaseWithVersionCode,
  parseRollout,
  releaseNotesFor,
  buildRelease,
  describeTrack,
  PLAY_PACKAGE,
} from './lib/playRelease.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARGS = process.argv.slice(2);
const has = (flag) => ARGS.includes(flag);
const valueOf = (flag, fallback = null) => {
  const i = ARGS.indexOf(flag);
  return i >= 0 && ARGS[i + 1] && !ARGS[i + 1].startsWith('--') ? ARGS[i + 1] : fallback;
};

// Throws rather than exiting, so the `finally` that discards an uncommitted
// edit still runs on a refusal.
function die(message) {
  throw new Error(message);
}

async function main() {
  const apply = has('--apply');
  const from = valueOf('--from', 'internal');
  const to = valueOf('--to', 'production');
  const mode = has('--promote') ? 'promote' : has('--set-rollout') ? 'set-rollout' : 'status';

  const account = loadServiceAccount();
  if (!account) die('Set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (or GOOGLE_PLAY_SERVICE_ACCOUNT_PATH).');

  const { PLAY } = await import(pathToFileURL(path.join(ROOT, 'marketing/aso/metadata.mjs')).href);
  const client = new PlayClient({ account });

  console.log(`Google Play · ${PLAY_PACKAGE} · ${mode}${mode === 'status' ? '' : apply ? ' · APPLY (commits)' : ' · PLAN (validated, then discarded)'}`);

  const edit = await client.createEdit();
  let committed = false;
  try {
    const { tracks = [] } = await client.listTracks(edit.id);
    const { listings = [] } = await client.listListings(edit.id);
    const languages = listings.map((l) => l.language);

    console.log('\nTracks');
    for (const t of tracks) console.log(`  ${describeTrack(t)}`);
    console.log(`\nListing languages: ${languages.join(', ') || '(none)'}`);

    if (mode === 'status') return;

    const target = findTrack(tracks, to) ?? { track: to, releases: [] };
    let release;

    if (mode === 'promote') {
      const source = findTrack(tracks, from);
      if (!source) die(`Track "${from}" has no releases.`);
      const versionCode = valueOf('--version-code') ?? latestVersionCode(source);
      if (!versionCode) die(`Track "${from}" holds no version code.`);
      const sourceRelease = releaseWithVersionCode(source, versionCode);
      if (!sourceRelease) die(`Version code ${versionCode} is not on "${from}". It holds: ${describeTrack(source)}`);
      if (releaseWithVersionCode(target, versionCode)) die(`Version code ${versionCode} is already on "${to}".`);
      const staged = (target.releases ?? []).find((r) => r.status === 'inProgress');
      if (staged) {
        die(`"${to}" already has a staged rollout in progress (${describeTrack({ track: to, releases: [staged] })}). Complete or halt it first (--set-rollout 1, or the Play Console).`);
      }
      const rollout = parseRollout(valueOf('--rollout', '0.2'));
      const notes = releaseNotesFor(PLAY.releaseNotes, languages);
      release = buildRelease({ versionCode, name: sourceRelease.name, rollout, releaseNotes: notes });
      console.log(`\nPromote ${versionCode} (${sourceRelease.name ?? 'unnamed'}) ${from} -> ${to}, ${rollout < 1 ? `staged ${Math.round(rollout * 100)}%` : 'full release'}`);
      console.log(`  release notes: ${notes.map((n) => `${n.language} (${n.text.length})`).join(', ') || 'none'}`);
    } else {
      const staged = (target.releases ?? []).find((r) => r.status === 'inProgress');
      if (!staged) die(`"${to}" has no staged rollout in progress to change.`);
      const rollout = parseRollout(valueOf('--set-rollout'));
      if (rollout < 1 && rollout <= (staged.userFraction ?? 0)) {
        die(`A staged rollout can only grow: "${to}" is already at ${Math.round((staged.userFraction ?? 0) * 100)}%.`);
      }
      release = buildRelease({
        versionCode: staged.versionCodes[0],
        name: staged.name,
        rollout,
        releaseNotes: staged.releaseNotes,
      });
      console.log(`\nRollout on ${to}: ${Math.round((staged.userFraction ?? 0) * 100)}% -> ${Math.round(rollout * 100)}%`);
    }

    await client.updateTrack(edit.id, to, [release]);
    await client.validateEdit(edit.id);
    console.log('  Google validated the change.');

    if (apply) {
      await client.commitEdit(edit.id);
      committed = true;
      console.log(`  COMMITTED. "${to}" now has: ${describeTrack({ track: to, releases: [release] })}`);
      if (to === 'production') console.log('  Google reviews production changes before they reach players.');
    } else {
      console.log('  Plan only: the edit is discarded. Re-run with --apply to commit.');
    }
  } finally {
    if (!committed) await client.deleteEdit(edit.id).catch(() => {});
  }
}

main().catch((e) => {
  console.error(`✖ ${e?.message || String(e)}`);
  process.exit(1);
});
