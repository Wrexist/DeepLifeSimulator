/**
 * THE SAME LIFE PRODUCES THE SAME LIFE — Master Program 14, §6 and §30.
 *
 * Manual: `RUN_REPRO_SIM=1 npx jest simulationReproducibility --silent=false`
 * (`RUNS=<n>`, `WEEKS=<n>`).
 *
 * Program 13 measured that the EVENT stream replays byte-identically and
 * reported, as an open finding, that happiness did not. That report named
 * `Date.now()` as the likely cause. It was wrong, and the way it was shown to
 * be wrong is worth keeping: freezing the clock for a whole run changed
 * nothing, so the clock was not the culprit and the search had to continue.
 *
 * What it actually was, found by diffing two identical runs field by field
 * until the first one that differed, then fixing it and diffing again - seven
 * rounds, seven defects, every one an unseeded draw or a wall-clock id written
 * into saved state:
 *
 *   1. `generateNPCGoals`      `Math.random()` ON THE WEEKLY TICK.
 *   2. `addMemory`             `mem_${Date.now()}_${Math.random()}`.
 *   3. `performHealthActivity` ten raw draws deciding which disease is cured.
 *   4. Spark match/message ids `${prefix}-${Date.now()}-${Math.random()}`.
 *   5. `createCheckpoint`      `cp_<week>_<Date.now()>`.
 *   6. Pulse posts             engagement, virality, follower gain, ad revenue,
 *                              and every post/comment/notification id.
 *   7. `playConversationOption` defaulted its outcome roll to `Math.random`.
 *
 * This test is what stops an eighth. It is `RUN_*`-gated because it is a real
 * simulation (minutes, not milliseconds); the static guard that runs on every
 * commit is `__tests__/tooling/simulationDeterminismAudit.test.ts`.
 */
import { runPersona, type SimPolicy, type SimWeekContext, type SimResult } from '../helpers/earlyGameSim';
import { SOCIAL_PERSONAS } from '../helpers/socialPersonas';
import type { GameState } from '@/contexts/game/types';

const RUN = process.env.RUN_REPRO_SIM === '1';
const d = RUN ? describe : describe.skip;

jest.setTimeout(4 * 60 * 60 * 1000);

const RUNS = Number(process.env.RUNS ?? 3);
const WEEKS = Number(process.env.WEEKS ?? 80);

/**
 * Fields that are ALLOWED to differ: a real timestamp written into a display
 * log. Each was checked individually for Program 14 - nothing sorts, gates or
 * compares any of them, and two fields that looked like this class and were
 * NOT (the prestige family-tree node id, the Time Machine checkpoint id) were
 * fixed rather than added here.
 */
const BENIGN = /updatedAt|lastPlayTimestamp|timestamp|lastSaved|lastLogin|createdAt|discoveredAt|lastUsed|startedAt|earnedTimestamp/i;

function flatten(o: unknown, prefix = '', out: Record<string, string> = {}, depth = 0): Record<string, string> {
  if (depth > 5) return out;
  if (o === null || typeof o !== 'object') { out[prefix] = JSON.stringify(o); return out; }
  if (Array.isArray(o)) {
    out[`${prefix}.length`] = String(o.length);
    o.slice(0, 40).forEach((v, i) => flatten(v, `${prefix}[${i}]`, out, depth + 1));
    return out;
  }
  for (const k of Object.keys(o as object).sort()) {
    flatten((o as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k, out, depth + 1);
  }
  return out;
}

async function runOnce(name: string, snaps: Record<string, string>[]): Promise<SimResult> {
  const spec = SOCIAL_PERSONAS[name];
  const inner = spec.make();
  const policy: SimPolicy = async (ctx: SimWeekContext) => {
    await inner(ctx);
    snaps.push(flatten(ctx.state() as unknown as GameState));
  };
  return runPersona({ name: 'repro', scenarioId: spec.scenarioId, seed: 1, weeks: WEEKS, policy });
}

/** The first week and field at which two runs of the same life disagree. */
function firstDivergence(a: Record<string, string>[], b: Record<string, string>[]): string | null {
  for (let w = 0; w < Math.min(a.length, b.length); w++) {
    const keys = new Set([...Object.keys(a[w]), ...Object.keys(b[w])]);
    for (const k of keys) {
      if (BENIGN.test(k)) continue;
      if (a[w][k] !== b[w][k]) {
        return `week ${w}, ${k}: ${String(a[w][k]).slice(0, 60)} != ${String(b[w][k]).slice(0, 60)}`;
      }
    }
  }
  return null;
}

d('the same life produces the same life', () => {
  for (const name of ['LONER', 'CASUAL SOCIAL', 'ROMANCE-FOCUSED', 'FRIENDSHIP-FOCUSED', 'CAREER-OBSESSED']) {
    it(`${name}: ${RUNS} runs of ${WEEKS} weeks agree on every field, every week`, async () => {
      const base: Record<string, string>[] = [];
      await runOnce(name, base);
      const divergences: string[] = [];
      for (let i = 1; i < RUNS; i++) {
        const other: Record<string, string>[] = [];
        await runOnce(name, other);
        const d0 = firstDivergence(base, other);
        if (d0) divergences.push(`run ${i + 1}: ${d0}`);
      }
      expect(divergences).toEqual([]);
    });
  }
});
