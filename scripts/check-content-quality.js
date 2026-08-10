#!/usr/bin/env node
'use strict';
/**
 * Content-quality gate. Fails only when a metric DROPS below its floor.
 *
 * Run after touching `lib/events/**`. Wired into `npm run preflight`, and the
 * reasoning lives in `scripts/lib/contentQualityRatchet.js` — read that first if
 * this is failing, because the fix is almost never to lower a floor.
 */

const {
  GOALS,
  FLOORS,
  MEASURED,
  BIG_STAKES_THRESHOLD,
  INERT_EVENT_CEILING,
  measureContentQuality,
} = require('./lib/contentQualityRatchet');

const pct = (n) => `${(n * 100).toFixed(2)}%`;

/**
 * One row per tracked metric. `format` keeps the report readable.
 *
 * `direction: 'down'` marks a CEILING — a metric where lower is better, which
 * inverts both the pass test and the "raise the floor" advice. It is spelled
 * out per-metric rather than inferred, because a gate that silently guesses
 * which way a number should move is a gate that will one day pass a regression.
 */
const METRICS = [
  {
    key: 'inertEventShare',
    label: 'Events where NO branch does anything',
    format: pct,
    direction: 'down',
    limit: INERT_EVENT_CEILING,
    describe:
      'the honest "the game did nothing" number — an event whose every choice ' +
      'moves happiness only, by a couple of points, is not a decision',
  },
  {
    key: 'soloHappinessMedian',
    label: 'Median |Δ| where happiness is the ONLY effect',
    format: (v) => String(v),
    describe:
      'regression signal only — half of these are the decline branch of a real ' +
      'choice, where small is CORRECT. See hypothesis 3 in the ratchet',
  },
  {
    key: 'medianAbsHappiness',
    label: 'Median |Δhappiness| (all outcomes)',
    format: (v) => String(v),
    describe:
      'tracked for regression only — 78% of these outcomes also move money, ' +
      'relationship or health, so this alone understates what an event does',
  },
  {
    key: 'bigStakesShare',
    label: `Outcomes ≥ ${BIG_STAKES_THRESHOLD} points`,
    format: pct,
    describe: 'share of outcomes big enough to matter a year later',
  },
  {
    key: 'cliffhangerBadShare',
    label: 'Cliffhangers that end badly',
    format: pct,
    describe: 'how often a teased conflict is not defused',
  },
];

function main() {
  const actual = measureContentQuality();

  console.log('\nContent quality — event corpus');
  console.log(
    `  ${actual.fileCount} content files · ${actual.effectCount} authored happiness effects · ` +
      `${actual.soloHappinessCount} of them happiness-only\n`
  );

  let failed = false;
  const reachedGoal = [];

  for (const metric of METRICS) {
    const value = actual[metric.key];
    const down = metric.direction === 'down';
    const bound = down ? metric.limit : FLOORS[metric.key];
    const goal = GOALS[metric.key];
    const ok = down ? value <= bound : value >= bound;
    if (!ok) failed = true;
    // A null goal means "tracked for regression only" — see the ratchet header.
    const hasGoal = goal !== null && goal !== undefined;
    const met = hasGoal && (down ? value <= goal : value >= goal);
    if (met) reachedGoal.push(metric);

    const status = !ok ? 'FAIL' : met ? 'GOAL' : 'ok  ';
    console.log(
      `  [${status}] ${metric.label}: ${metric.format(value)} ` +
        `(${down ? 'ceiling' : 'floor'} ${metric.format(bound)}, ` +
        `${hasGoal ? `goal ${metric.format(goal)}` : 'no target — regression only'})`
    );
    if (!ok) {
      console.log(
        `         ↳ ${down ? 'rose above the ceiling' : 'dropped below the floor'} — ` +
          `${metric.describe}.` +
          (MEASURED[metric.key] !== undefined
            ? ` Was ${metric.format(MEASURED[metric.key])} when the ratchet landed.`
            : '')
      );
    }
  }

  console.log(
    `\n  Cliffhanger resolutions: ${actual.cliffhangerPositive} positive · ` +
      `${actual.cliffhangerNegative} negative`
  );
  console.log(
    `  Multi-choice events: ${actual.multiChoiceEventCount} · ` +
      `${actual.inertEventCount} with nothing at stake` +
      (actual.inertEventCount > 0 ? ` (${actual.inertEventIds.join(', ')})` : '')
  );

  if (reachedGoal.length > 0) {
    console.log('\n  🎉 Goal reached. Consider tightening the bound to lock it in:');
    for (const m of reachedGoal) {
      console.log(
        `     ${m.direction === 'down' ? 'INERT_EVENT_CEILING' : `FLOORS.${m.key}`} → ${actual[m.key]}`
      );
    }
    console.log(
      '     (bounds sit a hair off measured on purpose, so retuning one event\n' +
        '      cannot trip the gate — a bound already within that hair is done.)'
    );
  }

  if (failed) {
    console.error(
      '\n✗ Content quality regressed.\n' +
        '  Do NOT lower the floors to get unstuck — raise the content back up.\n' +
        '  See scripts/lib/contentQualityRatchet.js for why these exist.\n'
    );
    process.exit(1);
  }

  console.log('\n✓ Content quality holding at or above every floor.\n');
}

main();
