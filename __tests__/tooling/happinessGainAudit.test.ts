/**
 * EVERY HAPPINESS GAIN GOES THROUGH THE CURVE — Master Program 14.
 *
 * `lib/economy/happinessGain.ts` makes a happiness gain worth less the happier
 * a life already is, which is what stops every persona pinning at the 0-100
 * cap and converging on one emotional trajectory. A curve is only worth having
 * if gains cannot route around it, and during Program 14 they could: the fix
 * was applied at two obvious choke points, measured, and found to be covering
 * between 1 and 3.5 points a week out of a much larger flow. Three more rounds
 * of "find the next writer, scale it, re-measure" followed.
 *
 * So the writers are enumerated here instead. Adding a new positive write to
 * `stats.happiness` without either routing it through `scaledHappinessGain` or
 * declaring why it does not need to fails this test.
 *
 * The three ways a site is legitimately exempt:
 *
 *   TICK_CHOKE_POINT  it writes `ctx.newStats.happiness` inside the weekly
 *                     tick, whose NET movement is scaled once at the end of
 *                     the updater. Scaling here as well would double-count.
 *   NOT_PLAYER        it moves a PET's happiness, an NPC's, or a child's, not
 *                     the player's stat.
 *   NOT_A_GAIN        it sets a starting value (a new life, an heir), or the
 *                     delta it adds is always negative.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const DIRS = ['lib', 'contexts', 'utils', 'components', 'services', 'hooks', 'src'];

function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/** file -> why this file's positive happiness writes need no scaling. */
const DECLARED: Record<string, string> = {
  // ── TICK_CHOKE_POINT: covered by the single net scaling in the week loop ──
  'contexts/game/GameActionsContext.tsx':
    'TICK_CHOKE_POINT. The four direct writes here (relationship support, anniversaries, ' +
    'housing, savings goals) are inside the weekly updater, whose net movement is scaled ' +
    'once after every subsystem has run.',
  'contexts/game/actions/weekly/applyCareerSalaryAndPenalty.ts': 'TICK_CHOKE_POINT (and the delta is a penalty).',
  'contexts/game/actions/weekly/applyDietPlan.ts': 'TICK_CHOKE_POINT.',
  'contexts/game/actions/weekly/applyEducationProgression.ts': 'TICK_CHOKE_POINT.',
  'contexts/game/actions/weekly/applyEducationStress.ts': 'TICK_CHOKE_POINT (and the delta is a penalty).',
  'contexts/game/actions/weekly/applyLuxuryItems.ts': 'TICK_CHOKE_POINT.',
  'contexts/game/actions/weekly/applyPets.ts': 'TICK_CHOKE_POINT.',
  'contexts/game/actions/weekly/applyPregnancyProgression.ts': 'TICK_CHOKE_POINT.',

  // ── NOT_PLAYER ───────────────────────────────────────────────────────────
  'contexts/game/actions/PetActions.ts': "NOT_PLAYER: moves a pet's own happiness field.",
  'lib/prestige/childStats.ts': "NOT_PLAYER: derives a CHILD's starting stats.",
  'lib/legacy/heirGeneration.ts': "NOT_PLAYER: derives an HEIR's starting stats for the next life.",

  // ── NOT_A_GAIN ───────────────────────────────────────────────────────────
  'contexts/game/actions/JobActions.ts': 'NOT_A_GAIN: `happinessPenalty` is negative at both sites.',
  'lib/prestige/applyBonuses.ts': 'NOT_A_GAIN: a one-off prestige bonus applied at the start of a life.',
  'lib/travel/milestones.ts': 'NOT_A_GAIN: sums a milestone total that is then handed to `applyStatsDelta`.',
  'lib/travel/operations.ts': 'NOT_A_GAIN: sums a trip total that is then handed to `applyStatsDelta`.',
  'contexts/game/actions/TravelActions.ts': 'routes through `applyStatsDelta`, which scales.',
  'contexts/game/actions/DatingActions.ts':
    'the three direct writes (date, proposal, wedding) scale explicitly; the anniversary ' +
    'line routes through `updateStats` -> `applyStatsDelta`.',
  'lib/events/hobbyEvents.ts':
    'authored event effects. Every one lands through `applyEventStatDeltas`, which scales.',

  // ── UI / dev tooling ─────────────────────────────────────────────────────
  'components/TopStatsBar.tsx': 'quick actions route through `updateStats` -> `applyStatsDelta`.',
  'components/computer/TravelApp.tsx': 'display preview of a trip total; the commit goes through TravelActions.',
  'components/health/GymCard.tsx': 'routes through `updateStats` -> `applyStatsDelta`.',
  'components/jail/JailScreen.tsx': 'routes through `updateStats` -> `applyStatsDelta`.',
  'lib/simulation/ComprehensiveGameSimulator.ts': 'dev-only simulator, never on a player tick.',
  'lib/simulation/RealActionSimulator.ts': 'dev-only simulator, never on a player tick.',
  'src/debug/actionSimulator.ts': 'dev-only simulator, never on a player tick.',
};

/** Lines that add something to a happiness field without going through the curve. */
function unscaledWrites(): string[] {
  const hits: string[] = [];
  const walk = (dir: string) => {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) return;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === '__tests__') continue;
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(rel); continue; }
      if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
      const src = codeOnly(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
      for (const line of src.split('\n')) {
        if (!/happiness\s*[:=][^;]*\+/.test(line)) continue;
        if (/scaledHappinessGain/.test(line)) continue;
        // `+ -x` and `+ (` are penalties or groupings, not plain gains.
        if (/happiness\s*[:=][^;]*\+\s*[-(]/.test(line)) continue;
        hits.push(rel);
        break;
      }
    }
  };
  DIRS.forEach(walk);
  return [...new Set(hits)].sort();
}

describe('every happiness gain goes through the diminishing-returns curve', () => {
  it('no file writes an unscaled happiness gain without a declaration', () => {
    const undeclared = unscaledWrites().filter((f) => !DECLARED[f]);
    expect(undeclared).toEqual([]);
  });

  it('no declaration outlives the file it describes', () => {
    const stale = Object.keys(DECLARED).filter((f) => !fs.existsSync(path.join(ROOT, f)));
    expect(stale).toEqual([]);
  });

  it('the week loop scales its net happiness movement exactly once', () => {
    const src = codeOnly(fs.readFileSync(path.join(ROOT, 'contexts/game/GameActionsContext.tsx'), 'utf8'));
    // One application of the NET scaling, measured from AFTER decay. Measuring
    // it from before decay would scale the decay down too - the first cut did
    // exactly that and diluted the drain it was meant to leave alone.
    //
    // Counted on the net-scaling expression specifically, not on the helper
    // name: this file also holds one out-of-tick action (a +15 grant) that
    // scales its own gain, and that is correct.
    const netApplications = src.match(/happinessAfterDecay \+ scaledHappinessGain\(happinessAfterDecay/g) ?? [];
    expect(netApplications.length).toBe(1);
  });
});
