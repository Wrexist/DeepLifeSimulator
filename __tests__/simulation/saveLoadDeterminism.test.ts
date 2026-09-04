/**
 * A SAVE ROUND-TRIP MUST NOT CHANGE THE FUTURE — Master Program 14, §9.
 *
 * Manual: `RUN_SAVELOAD_SIM=1 npx jest saveLoadDeterminism --silent=false`
 * (`WEEKS=<n>`, `SPLIT=<n>`).
 *
 * Program 14 made the tick reproducible: the same life replayed in one process
 * now produces the same life. That is necessary and not sufficient. A player
 * does not replay a life in one process - they save, close the app, come back,
 * and continue. If the serialize/validate/migrate/merge round trip drops or
 * rewrites a field the simulation reads, the continuation diverges from the
 * life they were living, and no amount of seeded randomness helps.
 *
 * So: run a life to week N, put it through the REAL save pipeline
 * (`serializeGameState` -> `repairGameState` -> `mergeLoadedState`), continue
 * both the round-tripped state and the untouched one to week M, and require
 * them to agree.
 *
 * This is the test that would have caught the whole carve-out class CLAUDE.md
 * §7 describes ("a carve-out still has to survive the LOAD"), where fields were
 * written to disk correctly and erased on the way back in.
 */
import { runPersona, type SimPolicy, type SimWeekContext, type SimResult } from '../helpers/earlyGameSim';
import { SOCIAL_PERSONAS } from '../helpers/socialPersonas';
import { hydrateLoadedState } from '@/utils/hydrateLoadedState';
import type { GameState } from '@/contexts/game/types';

const RUN = process.env.RUN_SAVELOAD_SIM === '1';
const d = RUN ? describe : describe.skip;

jest.setTimeout(4 * 60 * 60 * 1000);

const WEEKS = Number(process.env.WEEKS ?? 60);
const SPLIT = Number(process.env.SPLIT ?? 25);

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

/**
 * An ABSENT optional array becoming an EMPTY one across the round trip.
 *
 * `repairGameState` backfills a few optional arrays it finds missing, so a live
 * state holding `mindset.traits === undefined` comes back holding `[]`. That is
 * a normalization, not data loss: every reader in the codebase defaults an
 * absent array, so the two states behave identically and continue identically.
 *
 * Deliberately narrow. It matches ONLY the synthetic `.length` key this
 * flattener emits, and ONLY the undefined-to-zero direction — an array that
 * loses entries, or a field that changes value, still fails.
 */
function isAbsentArrayNormalized(key: string, before: string, after: string): boolean {
  return key.endsWith('.length') && before === undefined as unknown as string && after === '0';
}

function differences(a: Record<string, string>, b: Record<string, string>): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: string[] = [];
  for (const k of keys) {
    if (BENIGN.test(k)) continue;
    if (a[k] === b[k]) continue;
    if (isAbsentArrayNormalized(k, a[k], b[k])) continue;
    out.push(`${k}: ${String(a[k]).slice(0, 60)} != ${String(b[k]).slice(0, 60)}`);
  }
  return out;
}

/**
 * The real load path, minus the storage layer: serialize to JSON exactly as
 * the save queue does, then hand the parsed object to `hydrateLoadedState`,
 * which is what `loadGame` itself calls (repair + validate + the key-by-key
 * slice merge). Reimplementing the merge here would test my copy of the
 * pipeline rather than the pipeline.
 */
function roundTrip(state: GameState): GameState {
  const onDisk = JSON.parse(JSON.stringify(state)) as unknown;
  return hydrateLoadedState(onDisk, { source: 'test:saveLoadDeterminism' }).state;
}

async function run(name: string, weeks: number, from?: GameState): Promise<SimResult> {
  const spec = SOCIAL_PERSONAS[name];
  const inner = spec.make();
  const policy: SimPolicy = async (ctx: SimWeekContext) => { await inner(ctx); };
  return runPersona({
    name: 'saveload', scenarioId: spec.scenarioId, seed: 1, weeks, policy,
    ...(from ? { mutateSeed: () => from } : {}),
  });
}

d('a save round trip does not change the life', () => {
  for (const name of ['CASUAL SOCIAL', 'LONER']) {
    it(`${name}: continuing from a round-tripped save matches continuing straight through`, async () => {
      const first = await run(name, SPLIT);

      // Branch A: continue from the state exactly as it is in memory.
      const straight = await run(name, WEEKS - SPLIT, first.finalState);
      // Branch B: continue from the same state after a save/load round trip.
      const reloaded = await run(name, WEEKS - SPLIT, roundTrip(first.finalState));

      const diffs = differences(
        flatten(straight.finalState as unknown as GameState),
        flatten(reloaded.finalState as unknown as GameState),
      );
      expect(diffs).toEqual([]);
    });
  }

  it('the round trip itself preserves every field the simulation reads', async () => {
    const lived = await run('CASUAL SOCIAL', SPLIT);
    const diffs = differences(
      flatten(lived.finalState as unknown as GameState),
      flatten(roundTrip(lived.finalState) as unknown as GameState),
    );
    // Anything here is a field written to disk and lost (or rewritten) on the
    // way back in - the defect class CLAUDE.md §7 calls out by name.
    expect(diffs).toEqual([]);
  });
});
