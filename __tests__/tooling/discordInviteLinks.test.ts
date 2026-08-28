/**
 * Every Discord invite printed anywhere in this repo must be the ONE canonical
 * invite the app itself opens (`DISCORD_URL` in `lib/config/appConfig.ts`).
 *
 * This is a link-rot guard, and link rot here is expensive in a way a broken
 * import is not: nothing throws, nothing goes red, and the only symptom is a
 * player who tapped "join the community" and landed on Discord's "Invite
 * Invalid" page. It went wrong twice already, in the two ways it can:
 *
 *  1. **A code that does not exist.** `marketing/app_store_listing.md` carried
 *     `discord.gg/deeplifesim` in four places, two of them the App Store
 *     Connect *Support URL* — the link Apple shows to anyone looking for help.
 *     Discord's invite API answered `10006 Unknown Invite`. A vanity code is
 *     not a name you choose in a file; it has to be claimed on a server with
 *     Level 3 boosts, and writing one down does not reserve it.
 *  2. **A form that drifts.** 76 references across the 39 localization files
 *     spelled it `discord.gg/invite/<code>`. That one does redirect, so it was
 *     never broken — but two spellings of a single link is how a stale one
 *     survives a find-and-replace, and it is a spelling nobody can eyeball
 *     against the app.
 *
 * So the rule is exact-match, not merely "resolves": one code, one spelling.
 * `discord.com/invite/<code>` is rejected for the same reason — it works, and
 * it is a second spelling.
 *
 * Offline by design. It reads files; it never asks Discord whether a code is
 * live, because a test that needs the network fails on a plane.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

/** Directories that are never repo copy: dependencies, VCS, build output. */
const SKIP_DIRS = new Set(['node_modules', 'ios', 'android', 'dist', 'coverage']);
/** Live server dumps hold whatever invites the guild had, not our copy. */
const SKIP_PATHS = new Set([path.join('discord', 'backups')]);
/** This file necessarily spells out the wrong forms in order to ban them. */
const SELF = path.relative(ROOT, __filename);

const TEXT = /\.(ts|tsx|js|jsx|mjs|cjs|md|html|json|txt|ya?ml)$/;

/** The one true invite, read from the same constant the app opens. */
function canonicalCode(): string {
  const source = fs.readFileSync(path.join(ROOT, 'lib/config/appConfig.ts'), 'utf8');
  const url = source.match(/export const DISCORD_URL = '([^']+)'/)?.[1];
  expect(url).toBeDefined();
  const code = url!.match(/^https:\/\/discord\.gg\/([A-Za-z0-9-]+)$/)?.[1];
  // If DISCORD_URL itself stops being a canonical discord.gg link, every
  // assertion below is measuring against a moved target - fail loudly here.
  expect(code).toBeDefined();
  return code!;
}

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full);
    if (SKIP_PATHS.has(rel)) continue;
    if (entry.isDirectory()) yield* walk(full);
    else if (TEXT.test(entry.name) && rel !== SELF) yield full;
  }
}

/** `file:line` for every match of `re`, so a failure names where to look. */
function findAll(re: RegExp, keep: (m: RegExpExecArray) => boolean): string[] {
  const hits: string[] = [];
  for (const file of walk(ROOT)) {
    const src = fs.readFileSync(file, 'utf8');
    const scan = new RegExp(re.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = scan.exec(src)) !== null) {
      if (!keep(m)) continue;
      const line = src.slice(0, m.index).split('\n').length;
      hits.push(`${path.relative(ROOT, file)}:${line}  ${m[0]}`);
    }
  }
  return hits;
}

describe('discord invite links', () => {
  const code = canonicalCode();

  it('are all the canonical invite the app opens', () => {
    // An empty capture is the `discord.gg/...` ellipsis used in prose (see the
    // comment above DISCORD_INVITE_LABEL's consumer) - not a link, so not ours.
    const wrong = findAll(/discord\.gg\/([A-Za-z0-9_/-]*)/, (m) => m[1] !== '' && m[1] !== code);
    expect(wrong).toEqual([]);
  });

  it('never use the discord.com/invite spelling', () => {
    const wrong = findAll(/discord\.com\/invite\/[A-Za-z0-9_-]+/, () => true);
    expect(wrong).toEqual([]);
  });

  it('found the real links, so an empty result would be a broken scan', () => {
    // Without this, deleting every invite in the repo - or breaking `walk` -
    // would make the two assertions above pass by finding nothing at all.
    const found = findAll(new RegExp(`discord\\.gg/${code}`), () => true);
    expect(found.length).toBeGreaterThan(50);
  });
});
