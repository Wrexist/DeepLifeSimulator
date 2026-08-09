'use strict';
/**
 * Event content quality as a ratchet: it may improve, it must not regress.
 *
 * ── Why measure this at all ───────────────────────────────────────────────
 *
 * A life sim's word of mouth is "you won't believe what happened to me". That
 * requires events that (a) change the life and (b) sometimes go badly. An audit
 * on 2026-08-09 found the corpus failing both:
 *
 *   - across 513 authored happiness effects the MEDIAN absolute change was 6
 *     points on a 0-100 scale, and only 24 of them (4.7%) cleared 20. So ~95%
 *     of outcomes could not change a life, and the weekly tick regresses stats
 *     anyway.
 *   - Cliffhangers resolved positive 22 times against 8 negative. The game set
 *     up conflict and then defused it 73% of the time — the partner texting a
 *     jewellery store about an anniversary gift, not cheating. Nobody
 *     screenshots that.
 *
 * Neither is visible in review: each individual `happiness: -3` looks
 * reasonable, and each happy cliffhanger reads as a nice moment. They are only
 * a problem in aggregate, which is exactly what a script is for and a reviewer
 * is not.
 *
 * ── Why a ratchet and not a threshold ─────────────────────────────────────
 *
 * Same reasoning as `coverageRatchet.js`. A threshold set at the target would
 * fail from the day it lands and train everyone to skim it; a threshold set at
 * today's value is green now and silent on tomorrow's regression. The ratchet
 * enforces the one thing both true and checkable: this must not get worse. The
 * targets stay stated (`GOALS`) rather than faked as gates.
 *
 * ── Raising the floors ────────────────────────────────────────────────────
 *
 * Raise these in the same commit that earns the improvement. Do NOT lower them
 * to get a build unstuck — that is the move this file exists to prevent.
 */

const fs = require('fs');
const path = require('path');

const EVENTS_DIR = path.join(__dirname, '..', '..', 'lib', 'events');

/** Files that are engine/routing rather than authored content. */
const NON_CONTENT = new Set(['engine.ts', 'routing.ts', 'moneyScaling.ts']);

/**
 * What good looks like. Stated, not enforced — see the header.
 *
 * `medianAbsHappiness: 15` is the stakes floor from the plan: an outcome that
 * moves a 0-100 stat by less than 15 is a nudge the player will not notice a
 * year later. `cliffhangerBadShare: 0.40` is the point at which a teaser stops
 * being a promise the game always breaks gently.
 */
const GOALS = {
  medianAbsHappiness: 15,
  bigStakesShare: 0.35,
  cliffhangerBadShare: 0.4,
};

/**
 * Measured on 2026-08-09, before any content work. Kept so a future reader can
 * see what the floors were derived from rather than trusting round numbers.
 */
const MEASURED = {
  medianAbsHappiness: 6,
  bigStakesShare: 0.0468,
  cliffhangerBadShare: 0.2667,
};

/**
 * Where the corpus stands after the first content pass (2026-08-09).
 *
 * `medianAbsHappiness` is deliberately UNCHANGED and remains the big open gap:
 * moving it from 6 to 15 means retuning several hundred authored numbers, which
 * is a balance project needing playtesting, not a mechanical sweep. Doubling
 * every effect without playing it would trade a measurable weakness for an
 * unmeasured one.
 */
const CURRENT = {
  medianAbsHappiness: 6,
  bigStakesShare: 0.0507,
  cliffhangerBadShare: 0.4,
};

/**
 * Floors: a hair under measured, so ordinary authoring noise (one event
 * retuned, one added) cannot trip the gate while a real slide still does.
 */
const FLOORS = {
  medianAbsHappiness: 6,
  bigStakesShare: 0.05,
  // Raised from 0.24 on 2026-08-09, in the commit that earned it: the two
  // partner cliffhangers that set up an affair and then resolved into an
  // anniversary gift were rewritten to land. That moved the corpus from 26.67%
  // to 40% — the stated goal — so the floor moves with it rather than leaving
  // the win free to be undone.
  cliffhangerBadShare: 0.38,
};

/** An outcome at or above this magnitude can plausibly change a life. */
const BIG_STAKES_THRESHOLD = 20;

function listContentFiles() {
  return fs
    .readdirSync(EVENTS_DIR)
    .filter((f) => f.endsWith('.ts') && !NON_CONTENT.has(f))
    .map((f) => path.join(EVENTS_DIR, f));
}

/** Every `happiness: <n>` an event effect declares, as signed numbers. */
function collectHappinessEffects(files) {
  const values = [];
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const re = /happiness:\s*(-?\d+(?:\.\d+)?)/g;
    let m;
    while ((m = re.exec(src)) !== null) values.push(Number(m[1]));
  }
  return values;
}

function median(nums) {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * How often a cliffhanger's RESOLUTION goes badly.
 *
 * Measured over `cliffhangerEvents.ts` only: that file is the one whose whole
 * premise is a promise of drama, so it is the one where always-happy endings
 * actively cost something. Sign of the happiness effects inside resolutions is
 * the proxy — a resolution that pays out positive happiness landed well.
 */
function measureCliffhangers() {
  const file = path.join(EVENTS_DIR, 'cliffhangerEvents.ts');
  if (!fs.existsSync(file)) return { positive: 0, negative: 0, badShare: 0 };
  const src = fs.readFileSync(file, 'utf8');
  const values = [];
  const re = /happiness:\s*(-?\d+(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(src)) !== null) values.push(Number(m[1]));
  const positive = values.filter((v) => v > 0).length;
  const negative = values.filter((v) => v < 0).length;
  const total = positive + negative;
  return { positive, negative, badShare: total === 0 ? 0 : negative / total };
}

/** Measure the corpus as it stands right now. */
function measureContentQuality() {
  const files = listContentFiles();
  const happiness = collectHappinessEffects(files);
  const abs = happiness.map(Math.abs);
  const big = abs.filter((v) => v >= BIG_STAKES_THRESHOLD).length;
  const cliff = measureCliffhangers();

  return {
    fileCount: files.length,
    effectCount: happiness.length,
    medianAbsHappiness: median(abs),
    bigStakesCount: big,
    bigStakesShare: happiness.length === 0 ? 0 : big / happiness.length,
    cliffhangerPositive: cliff.positive,
    cliffhangerNegative: cliff.negative,
    cliffhangerBadShare: cliff.badShare,
  };
}

module.exports = {
  GOALS,
  MEASURED,
  CURRENT,
  FLOORS,
  BIG_STAKES_THRESHOLD,
  measureContentQuality,
  listContentFiles,
  median,
};
