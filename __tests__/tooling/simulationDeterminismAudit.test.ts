/**
 * THE SIMULATION MAY NOT READ THE WALL CLOCK OR AN UNSEEDED DIE — Program 14.
 *
 * CLAUDE.md §4.3: "Never add a `Math.random()` to the tick or to an event
 * `generate()`; never key a life-affecting roll on the week alone." Program 13
 * machine-checked the second half of that sentence
 * (`weekOnlyRollAudit.test.ts`). This checks the first half, and it exists
 * because the rule was being broken in five places while everyone believed it
 * held:
 *
 *   `generateNPCGoals`            two `Math.random()` draws, ON THE WEEKLY TICK,
 *                                 written into the save.
 *   `addMemory`'s default id      `mem_${Date.now()}_${Math.random()}`.
 *   `applyChoiceConsequences`     the same, on the event-answer path.
 *   `performHealthActivity`       ten raw draws deciding which disease is cured.
 *   `swipeProfile` / Spark ids    `${prefix}-${Date.now()}-${Math.random()}`.
 *   `createCheckpoint`            `cp_<week>_<Date.now()>`.
 *
 * Every one of them made the SAME LIFE replay differently, and none of them was
 * visible: the simulation harness seeds `Math.random` for its own runs, so a
 * draw that is unreproducible in the app looks perfectly reproducible in a test.
 * That is precisely why this has to be a static check rather than a simulation.
 *
 * Three tiers, strongest first.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

/** Strip comments and string bodies so a mention in prose is not a call. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

const RANDOM_CALL = /\bMath\s*\.\s*random\s*\(/;
const CLOCK_CALL = /\bDate\s*\.\s*now\s*\(|\bnew\s+Date\s*\(\s*\)/;

function read(rel: string): string {
  return codeOnly(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function filesIn(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => path.join(dir, f));
}

// ── TIER 1: the week loop itself. Zero tolerance, no allowlist. ─────────────
const WEEK_LOOP = [
  ...filesIn('contexts/game/actions/weekly'),
  'contexts/game/GameActionsContext.tsx',
];

// ── TIER 2: what the week loop imports, one hop into `lib/`. ────────────────
/** Resolve an `@/...` import to a repo-relative file, or null. */
function resolveAlias(spec: string): string | null {
  if (!spec.startsWith('@/')) return null;
  const base = spec.slice(2);
  for (const cand of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (fs.existsSync(path.join(ROOT, cand))) return cand;
  }
  return null;
}

/** Every `@/lib/...` module the week loop pulls in, transitively (2 hops). */
function tickReachableLibModules(): string[] {
  const seen = new Set<string>();
  const frontier = [...WEEK_LOOP];
  for (let hop = 0; hop < 3 && frontier.length; hop++) {
    const next: string[] = [];
    for (const file of frontier.splice(0)) {
      const abs = path.join(ROOT, file);
      if (!fs.existsSync(abs)) continue;
      const src = fs.readFileSync(abs, 'utf8');
      // VALUE imports only — `import type` is erased by tsc and cannot execute.
      for (const m of src.matchAll(/^\s*import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gm)) {
        const rel = resolveAlias(m[1]);
        if (!rel || !rel.startsWith('lib/') || seen.has(rel)) continue;
        seen.add(rel);
        next.push(rel);
      }
    }
    frontier.push(...next);
  }
  return [...seen].sort();
}

/**
 * `lib/` modules on the tick path that still contain an unseeded draw or a
 * clock read, each with the reason it is not a determinism bug. A NEW entry
 * here needs a real reason; the default answer is to thread the seeded roll.
 */
const DECLARED_TICK_REACHABLE: Record<string, string> = {
  'lib/social/npcDepth.ts':
    'three `rng ? rng(k) : Math.random()` fallbacks (life-event gate, life-event pick, mood decay). ' +
    'The tick passes the seeded stream at every one of those call sites; the fallback serves live ' +
    'UI callers. `generateNPCGoals` deliberately has NO fallback (Program 14) because that is the ' +
    'one the tick was reaching.',
  'lib/economy/stockMarket.ts':
    'a `rng ? ... : Math.random()` fallback in the Box-Muller draw. The weekly tick always passes ' +
    'the seeded generator; the fallback is for offline price-model exploration.',
  'lib/education/educationSystem.ts':
    '`runExam` and `shouldTriggerCampusEvent` take an optional seeded roll and the tick passes it. ' +
    '`getAvailableClasses` and `getRandomCampusEvent` are UI-driven and are NOT reached from the ' +
    'tick - see the UI-surface note in the Program 14 report.',
  'lib/lifeMoments/lifeMomentGenerator.ts':
    'the word appears only in a comment recording that this path was moved OFF `Math.random()`.',
  'lib/lifeMoments/consequenceTracker.ts':
    'clock reads only, and only into `timestamp` / `createdAt`, which are a display log: nothing ' +
    'sorts, gates or compares them. The id on this path was made deterministic in Program 14.',
  'lib/events/seededPayload.ts':
    'the seeded payload helper itself; its fallback is the documented non-tick path.',
  'lib/progress/cloud.ts': 'cloud sync scheduling, not simulation.',
  'lib/analytics/context.ts': 'analytics envelope timestamps.',
  'lib/liveops/session.ts': 'Live Ops windows are REAL UTC time by design (docs/LIVEOPS.md).',
  'lib/liveops/content.ts': 'Live Ops remote-content cache freshness, real time by design.',
  'lib/liveops/state.ts': 'Live Ops event windows are real UTC time by design (docs/LIVEOPS.md).',
  'lib/liveops/claim.ts': 'Live Ops claim ledger keys on the parsed window start, real time by design.',
  'lib/utils/bootBreadcrumbs.ts': 'startup diagnostics.',
  'lib/timeMachine/checkpointSystem.ts':
    'a `timestamp` field for display. The checkpoint ID was made deterministic in Program 14.',
  'lib/subscription/deepLifePlus.ts': 'entitlement expiry is real subscription time.',
  'lib/config/appConfig.ts': 'build/config metadata.',

  // ── Clock reads that land in DISPLAY METADATA only ────────────────────────
  // Each of these writes a real timestamp into a field nothing sorts, gates or
  // compares: it is there so a screen can say "3 days ago". They were checked
  // one by one for Program 14, not waved through as a group — the same sweep
  // found and fixed two that were NOT metadata (the prestige family-tree node
  // id and the Time Machine checkpoint id, both clock-derived keys inside
  // saved state).
  'lib/challenges/weeklyChallenges.ts':
    'one `Date.now()`, and it feeds only `startedAt`. Rotation itself is gated on ' +
    '`weeksLived` - the anti-exploit note at the top of the function is accurate.',
  'lib/depth/discoverySystem.ts': '`discoveredAt` / `lastUsed`, display only.',
  'lib/legacy/inheritance.ts': '`date` on inheritance log entries, display only.',
  'lib/legacy/lifeRecord.ts': '`timestamp` on a life record, display only.',
  'lib/legacy/ribbonSystem.ts': '`earnedTimestamp` on a ribbon, display only.',
  'lib/lifeMoments/memoryIntegration.ts': '`date` on a memory entry, display only.',
  'lib/skillTrees/lifeSkillEffects.ts': '`updatedAt`, display only.',
  'lib/prestige/prestigeExecution.ts':
    'a `timestamp` on the prestige record, display only. The family-tree node ID on ' +
    'this path WAS clock-derived and is deterministic as of Program 14.',
  'lib/legacyPass/legacyPass.ts':
    'the Legacy Pass season is REAL calendar time by design, like Live Ops windows: ' +
    'which season is running is a property of the world, not of the life.',
  'lib/social/socialMedia.ts':
    'the remaining draws are in `calculateFollowerGrowth` / `calculateFollowerGrowthFull`, ' +
    'which have no callers outside this file, and in the seeded helpers\' own ' +
    '`() => Math.random()` default parameters. Everything the Pulse app actually reaches - ' +
    'the viral check, post engagement, follower gain and ad revenue - takes a seeded roll as ' +
    'of Program 14. The viral check is the one to read: it carried an "ANTI-EXPLOIT: ' +
    'deterministic hash instead of Math.random()" comment over a hash of `Date.now()`.',
};

describe('the simulation does not read the wall clock or an unseeded die', () => {
  it('TIER 1: no Math.random() anywhere in the week loop', () => {
    const offenders = WEEK_LOOP.filter((f) => RANDOM_CALL.test(read(f)));
    // No allowlist by design. The week loop is where a stray draw costs a
    // player a reproducible life, and there has never been a good reason for
    // one here: every subsystem already receives a seeded roll stream.
    expect(offenders).toEqual([]);
  });

  it('TIER 2: every tick-reachable lib module with a draw or a clock read is declared', () => {
    const reachable = tickReachableLibModules();
    const flagged = reachable.filter((f) => {
      const src = read(f);
      return RANDOM_CALL.test(src) || CLOCK_CALL.test(src);
    });
    const undeclared = flagged.filter((f) => !DECLARED_TICK_REACHABLE[f]);
    expect(undeclared).toEqual([]);
  });

  it('TIER 2: no declaration outlives the module it describes', () => {
    const stale = Object.keys(DECLARED_TICK_REACHABLE).filter(
      (f) => !fs.existsSync(path.join(ROOT, f)),
    );
    expect(stale).toEqual([]);
  });

  it('TIER 3: the repo-wide count of files drawing unseeded randomness only goes DOWN', () => {
    // A ratchet, in the shape this repo already uses for lint warnings, test
    // types and coverage. Most of the remaining files are UI flavour (a toast
    // wobble, a fake social feed) where a seeded draw would buy nothing, so the
    // goal is not zero - the goal is that the number never grows unnoticed.
    // Lower it in the commit that earns it; never raise it to get unstuck.
    const CEILING = 55;
    const dirs = ['lib', 'contexts', 'utils', 'components', 'services', 'hooks', 'src'];
    const hits: string[] = [];
    const walk = (dir: string) => {
      const abs = path.join(ROOT, dir);
      if (!fs.existsSync(abs)) return;
      for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === '__tests__') continue;
        const rel = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(rel);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          if (RANDOM_CALL.test(read(rel))) hits.push(rel);
        }
      }
    };
    dirs.forEach(walk);
    expect(hits.length).toBeLessThanOrEqual(CEILING);
  });
});
