import { spawnSync } from 'node:child_process';

const file = process.argv[2];
if (!['discord/state/last-notified-release.json', 'discord/state/last-notified-pr.json'].includes(file)) {
  throw new Error('Expected a Discord watcher state path.');
}
function git(args, allowFailure = false) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) throw new Error(result.stderr || `git ${args[0]} failed`);
  return result;
}

// Stage first: an initial baseline is untracked, so a working-tree diff misses it.
git(['add', '--', file]);
const diff = git(['diff', '--cached', '--quiet', '--', file], true);
if (diff.status === 0) {
  console.log('Watcher state unchanged; no commit needed.');
} else {
  if (diff.status !== 1) throw new Error('Could not compare staged watcher state.');
  git(['commit', '--only', '-m', 'chore(discord): persist watcher checkpoint [skip ci]', '--', file]);
  let pushed = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    // Other main commits may arrive while the watcher is running. Never force-push.
    git(['fetch', 'origin', 'main']);
    git(['rebase', 'origin/main']);
    if (git(['push', 'origin', 'HEAD:main'], true).status === 0) { pushed = true; break; }
  }
  if (!pushed) throw new Error('Watcher state was not persisted to origin/main.');
  console.log('Watcher state persisted to origin/main. This does not imply a Discord message was posted.');
}
