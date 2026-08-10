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
  measureContentQuality,
} = require('./lib/contentQualityRatchet');

const pct = (n) => `${(n * 100).toFixed(2)}%`;

/** One row per tracked metric. `format` keeps the report readable. */
const METRICS = [
  {
    key: 'soloHappinessMedian',
    label: 'Median |Δ| where happiness is the ONLY effect',
    format: (v) => String(v),
    describe:
      'the honest "does this event matter" number — an outcome that moves ' +
      'nothing but happiness, by a few points, is an outcome that does nothing',
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
    const floor = FLOORS[metric.key];
    const goal = GOALS[metric.key];
    const ok = value >= floor;
    if (!ok) failed = true;
    // A null goal means "tracked for regression only" — see the ratchet header.
    const hasGoal = goal !== null && goal !== undefined;
    if (hasGoal && value >= goal) reachedGoal.push(metric);

    const status = !ok ? 'FAIL' : hasGoal && value >= goal ? 'GOAL' : 'ok  ';
    console.log(
      `  [${status}] ${metric.label}: ${metric.format(value)} ` +
        `(floor ${metric.format(floor)}, ` +
        `${hasGoal ? `goal ${metric.format(goal)}` : 'no target — regression only'})`
    );
    if (!ok) {
      console.log(
        `         ↳ dropped below the floor — ${metric.describe}. ` +
          `Was ${metric.format(MEASURED[metric.key])} when the ratchet landed.`
      );
    }
  }

  console.log(
    `\n  Cliffhanger resolutions: ${actual.cliffhangerPositive} positive · ` +
      `${actual.cliffhangerNegative} negative`
  );

  if (reachedGoal.length > 0) {
    console.log('\n  🎉 Goal reached — raise the floor in this commit to lock it in:');
    for (const m of reachedGoal) {
      console.log(`     FLOORS.${m.key} → ${actual[m.key]}`);
    }
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
