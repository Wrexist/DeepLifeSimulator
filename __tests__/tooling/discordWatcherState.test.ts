import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';

const script = resolve(__dirname, '../../scripts/commit-discord-state.mjs');
const scratch = resolve(__dirname, '../../tmp-bugaudit');
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

it('persists an untracked first baseline, avoids empty commits, and preserves another watcher checkpoint', () => {
  mkdirSync(scratch, { recursive: true });
  const root = mkdtempSync(join(scratch, 'discord-state-test-'));
  const remote = join(root, 'remote.git');
  const work = join(root, 'work');
  mkdirSync(work);
  git(root, 'init', '--bare', remote);
  git(work, 'init', '-b', 'main');
  git(work, 'config', 'user.name', 'Watcher test');
  git(work, 'config', 'user.email', 'watcher@example.invalid');
  writeFileSync(join(work, 'README.md'), 'fixture');
  git(work, 'add', 'README.md'); git(work, 'commit', '-m', 'initial');
  git(work, 'remote', 'add', 'origin', remote); git(work, 'push', '-u', 'origin', 'main');
  mkdirSync(join(work, 'discord/state'), { recursive: true });
  const release = 'discord/state/last-notified-release.json';
  const activity = 'discord/state/last-notified-pr.json';
  writeFileSync(join(work, release), '{"appStoreVersion":"1.5.5"}\n');
  // Reproduce the original misleading check before running the actual fix.
  expect(git(work, 'diff', '--', release)).toBe('');
  execFileSync(process.execPath, [script, release], { cwd: work });
  expect(git(work, 'show', `origin/main:${release}`)).toContain('1.5.5');
  const first = git(work, 'rev-parse', 'HEAD');
  execFileSync(process.execPath, [script, release], { cwd: work });
  expect(git(work, 'rev-parse', 'HEAD')).toBe(first);
  writeFileSync(join(work, activity), '{"lastPrNumber":210}\n');
  execFileSync(process.execPath, [script, activity], { cwd: work });
  expect(git(work, 'show', `origin/main:${activity}`)).toContain('210');
  expect(git(work, 'show', `origin/main:${release}`)).toContain('1.5.5');
  writeFileSync(join(work, release), '{"appStoreVersion":"1.5.6"}\n');
  execFileSync(process.execPath, [script, release], { cwd: work });
  expect(git(work, 'show', `origin/main:${release}`)).toContain('1.5.6');
}, 30000);
