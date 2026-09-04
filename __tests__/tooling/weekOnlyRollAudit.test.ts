/**
 * EVERY WEEK-ONLY ROLL MUST BE DECLARED — Master Program 13, §11.
 *
 * `utils/seededRoll.ts` exposes two roll factories and the difference between
 * them is the difference between a world and a calendar:
 *
 *   makeWeeklyRoll(weeksLived)         - keyed on the WEEK alone. Every life
 *                                        draws the same number in week N.
 *   makeLifeRoll(state, weeksLived)    - folds `lineageId:generationNumber` in,
 *                                        so each life draws its own stream.
 *
 * CLAUDE.md §4.3 has said since Program 8 that a life-affecting roll must never
 * be keyed on the week alone. That rule was enforced by hand, per call site,
 * which is a rule nobody can check: Program 13 found the single biggest roll in
 * the game - the weekly event fire gate and pick in `lib/events/engine.ts` -
 * still on the week-only factory two programs later, and measured the cost
 * (365 authored templates, 33 ever delivered across twelve lives).
 *
 * So the discipline is machine-checked now. Every `makeWeeklyRoll` call site
 * must appear below with a classification. Adding one without a reason fails
 * here, which is the only place the omission is visible - a week-only roll
 * compiles, type-checks, passes its own unit tests and looks right in review.
 *
 * The three legitimate classifications:
 *
 *   SALT_IN_KEY        the life IS folded in, just by hand: the call site
 *                      builds `${lineageId}:${generationNumber}` into the key
 *                      string. Equivalent to `makeLifeRoll`; older spelling.
 *   INTENTIONALLY_GLOBAL  the draw describes the WORLD, not the life. Two lives
 *                      living the same week SHOULD see the same macro economy.
 *   NOT_LIFE_AFFECTING the draw cannot change the life: it picks flavour, or
 *                      it is keyed on an id that is already unique per life.
 *
 * Anything else is a bug, and the fix is `makeLifeRoll`.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const RUNTIME_DIRS = ['app', 'components', 'contexts', 'hooks', 'lib', 'services', 'src', 'utils'];

type Kind = 'SALT_IN_KEY' | 'INTENTIONALLY_GLOBAL' | 'NOT_LIFE_AFFECTING';

/**
 * file -> [kind, why]. One entry per FILE, not per line: line numbers churn on
 * every edit above them, and a file that already reasons about the salt tends
 * to keep doing so. A NEW file using the week-only factory is what this catches.
 */
const DECLARED: Record<string, [Kind, string]> = {
  'utils/seededRoll.ts': [
    'NOT_LIFE_AFFECTING',
    'the factory itself, plus `makeLifeRoll` which is built on it',
  ],
  'lib/economy/luckyBonus.ts': [
    'SALT_IN_KEY',
    'key is `lucky-bonus:${lineageId}:${generationNumber}`',
  ],
  'lib/events/cliffhangerEvents.ts': [
    'SALT_IN_KEY',
    'builds `lifeSalt` locally and keys both the fire gate and the pick on it',
  ],
  'lib/lifeMoments/lifeMomentGenerator.ts': [
    'SALT_IN_KEY',
    'builds `lifeSalt` locally; keys `life-moment-fire:${lifeSalt}`',
  ],
  'lib/events/economyEvents.ts': [
    'INTENTIONALLY_GLOBAL',
    'the length of a calm macro-economic stretch. The recession/boom cycle is ' +
      'the WORLD; two lives in the same week share one economy on purpose, the ' +
      'same way the stock tape is shared. Salting it would give every life a ' +
      'private economy, which is a different game.',
  ],
  'lib/events/lifeEvents.ts': [
    'NOT_LIFE_AFFECTING',
    'the follow-up gate for a chained event, keyed on ' +
      '`chain-${eventId}-${choiceId}-${followUpEventId}`. Reaching this call at ' +
      'all requires the player to have been shown that event and to have picked ' +
      'that choice, which is already a property of the life; the roll only ' +
      'decides whether the sequel to a chain the life is ALREADY in arrives.',
  ],
  'lib/social/npcDepth.ts': [
    'NOT_LIFE_AFFECTING',
    'NPC mood drift, want rotation and per-interaction flavour, keyed on the ' +
      'relationship id. These move colour and a +/-1 bond nudge, never money, ' +
      'health or an unlock. Worth revisiting if an NPC mood ever gates ' +
      'something material: seeded ids like `parent1` and `met-w2` are shared ' +
      'across lives, so those streams DO collide today.',
  ],
  'contexts/game/actions/weekly/applyEducationProgression.ts': [
    'NOT_LIFE_AFFECTING',
    'the fractional part of the education-speed multiplier, plus exam and ' +
      'campus-event gates keyed on the education id. The speed roll pays out an ' +
      'EXPECTED value equal to the purchased multiplier over the length of a ' +
      'programme, so the stream identity does not change what a player gets.',
  ],
  'contexts/game/actions/weekly/applyIncome.ts': [
    'NOT_LIFE_AFFECTING',
    'beginner luck: a $0-N top-up during the first weeks of a life. Bounded, ' +
      'one-directional and closed after `BEGINNER_LUCK_WEEKS`.',
  ],
  'contexts/game/GameActionsContext.tsx': [
    'NOT_LIFE_AFFECTING',
    'the shared weekly roll stream handed to the crypto/darkweb/politics/stock/' +
      'rent subsystem ticks. Those subsystems key on their own namespaces and ' +
      'operate on holdings the life chose to acquire; the tape they price ' +
      'against is deliberately global (see economyEvents above).',
  ],
};

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) yield full;
  }
}

function callSites(): string[] {
  const hits: string[] = [];
  for (const dir of RUNTIME_DIRS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of walk(abs)) {
      const src = fs.readFileSync(file, 'utf8');
      // `makeWeeklyRoll(` as a CALL, not the import line or a mention in prose.
      const lines = src.split('\n');
      const called = lines.some((l, i) => {
        if (!/\bmakeWeeklyRoll\s*\(/.test(l)) return false;
        if (/^\s*import\b/.test(l)) return false;
        // A line that is only a comment is prose about the factory, not a call.
        const before = l.slice(0, l.indexOf('makeWeeklyRoll'));
        if (/(^|\s)(\/\/|\*)/.test(before)) return false;
        return i >= 0;
      });
      if (called) hits.push(path.relative(ROOT, file));
    }
  }
  return hits.sort();
}

describe('week-only seeded rolls are declared', () => {
  it('every makeWeeklyRoll call site carries a classification', () => {
    const undeclared = callSites().filter((f) => !DECLARED[f]);
    expect(undeclared).toEqual([]);
  });

  it('no declaration outlives its call site', () => {
    const live = new Set(callSites());
    const stale = Object.keys(DECLARED).filter((f) => !live.has(f));
    expect(stale).toEqual([]);
  });

  it('the weekly event roll is life-salted, not week-only', () => {
    // The specific regression Program 13 fixed, pinned by name: this is the
    // roll that decides WHETHER an event fires and WHICH one, for every life.
    const src = fs.readFileSync(path.join(ROOT, 'lib/events/engine.ts'), 'utf8');
    const code = src
      .split('\n')
      .filter((l) => !/^\s*(\*|\/\/)/.test(l))
      .join('\n');
    expect(code).toContain('makeLifeRoll(state, state.weeksLived || 0)');
    expect(/\bmakeWeeklyRoll\s*\(/.test(code)).toBe(false);
  });
});
