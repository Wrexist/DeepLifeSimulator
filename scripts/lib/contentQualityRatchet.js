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
  // NULL, deliberately. This was 15, and 15 was wrong — chasing it would have
  // inflated happiness on events that already land hard through money,
  // relationship and karma. It is now a no-regression signal with no target,
  // and a metric with no target should say so rather than pretend its floor is
  // an ambition.
  medianAbsHappiness: null,
  // ALSO NULL, and for a sharper reason than the one above. This carried a goal
  // of 10 for exactly one day. Two measurements retired it — see hypothesis 3
  // in the CURRENT block. The FLOOR is untouched at 5: the regression
  // protection this metric actually provides is real and stays.
  soloHappinessMedian: null,
  bigStakesShare: 0.35,
  cliffhangerBadShare: 0.4,
  // The metric that replaced it, and the only one of the three attempts that
  // survived scrutiny. A CEILING, not a floor — lower is better, so it ratchets
  // downward. See `INERT_EVENT_CEILING`.
  inertEventShare: 0,
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
 *
 * ── THE GOAL OF 15 WAS WRONG, AND THAT MATTERS MORE THAN THE GAP ──────────
 * The original audit measured only happiness numbers and concluded the corpus
 * was toothless. Measuring the effect OBJECTS instead: of 517 outcomes that
 * touch happiness, **78% also move another axis** — money, relationship,
 * health, energy, reputation — and 21.5% carry a big change there (relationship
 * ≥10 or money ≥$100). The anniversary event reads as "+15 happiness" but is
 * really −$200, relationship +15, and a karma hit if you forget.
 *
 * So happiness is one component of most outcomes, not the outcome. Driving its
 * median to 15 would have inflated it on events that already land hard through
 * other mechanics — happiness swinging wildly while the real consequences sat
 * elsewhere. That is a content sweep that makes the game WORSE, and the metric
 * would have reported it as progress.
 *
 * `medianAbsHappiness` is therefore kept only as a no-regression signal, with
 * its goal lowered to the measured value. The real target is
 * `soloHappinessMedian`: the median magnitude of outcomes that move happiness
 * and nothing else. Those are the ones where a small number genuinely means
 * nothing happened — and 42.5% of them are under 5 points.
 *
 * ── THREE HYPOTHESES ALREADY TESTED AND DISPROVED (2026-08-09) ────────────
 * Recorded so nobody spends the afternoon re-testing them:
 *
 * 1. "Flavour events drag the median down." `nearMissEvents.ts` declares in its
 *    own header that it has "no major stat consequences; they exist purely for
 *    psychological tension", so it looked like the culprit. Excluding all 41 of
 *    its effects moves the median from 6 to... 6. The low stakes are systemic
 *    across the corpus, not one file, so segmenting the metric would hide the
 *    problem rather than measure it better.
 *
 * 2. "Non-divergent choices can be detected statically." A regex pass over
 *    choice sets (same sign, spread < 10) reported 63% — and the first example
 *    inspected was a false positive, a ternary that does branch on outcome.
 *    Correcting for computed effects swung the answer to 0%. Two attempts, two
 *    wrong numbers: choice divergence needs a real parser or a human, and a
 *    gate built on that regex would have been worse than no gate.
 *
 * 3. "Trivial happiness-only outcomes are a content weakness, and driving
 *    `soloHappinessMedian` to 10 fixes it." (2026-08-10) This was MY OWN goal
 *    from the day before, and two measurements retired it:
 *
 *    a. It is unreachable by the work it implies. Of 113 happiness-only
 *       outcomes, 46 are under 5 points. Simulating the most thorough pass
 *       anyone could honestly make — every non-flavour trivial outcome raised
 *       to 10 — moves the median to 8, not 10, because the mass of the
 *       distribution sits at exactly 5 (29 of them) and 8 (12). The last two
 *       points can only be bought by retuning `nearMissEvents.ts` as well,
 *       i.e. by overruling a documented authoring decision to move a
 *       statistic. `contentQualityRatchet.test.ts` runs that simulation, so
 *       this is a checked claim rather than a remembered one.
 *
 *    b. The population it targets is mostly correct as authored. Of those 46,
 *       24 are the DECLINE branch of a choice set ("Skip the sales", "Politely
 *       decline", "Just spectate") and 16 more are `nearMissEvents.ts`, which
 *       documents itself as deliberate flavour. Declining an offer SHOULD do
 *       almost nothing — that is what makes the other branch a decision. The
 *       metric was reading good choice architecture as weak content.
 *
 *    The structural check settles it: of 235 multi-choice events, exactly TWO
 *    have no branch that does anything, and both are in the flavour file. So
 *    233 of 235 already offer at least one outcome that moves a life. The
 *    corpus does not have the problem this goal was chasing.
 *
 *    That check became `inertEventShare`, below. Note what it does NOT depend
 *    on: the decline-branch word list used to establish (b) is a heuristic of
 *    exactly the kind that produced two wrong answers in hypothesis 2, so it
 *    was used to UNDERSTAND the corpus and deliberately not shipped as a gate.
 */
const CURRENT = {
  medianAbsHappiness: 6,
  soloHappinessMedian: 5,
  // 2026-08-16: the inbox event pack (lib/events/inboxEvents.ts) added 18
  // happiness outcomes at once, and the gate caught it — every one was under
  // the threshold, which dropped the share to 0.0491 and failed the floor. The
  // finding was correct content criticism, not a measurement artefact: a pack
  // of seven letters whose very best outcome decays away in a month is a pack
  // of seven letters that do not matter. Three top branches were raised (the
  // reunion, the time capsule, the television appearance) rather than the floor
  // being lowered, which moved the corpus to 0.0548.
  bigStakesShare: 0.0548,
  cliffhangerBadShare: 0.4,
  inertEventShare: 0.0083,
};

/**
 * Floors: a hair under measured, so ordinary authoring noise (one event
 * retuned, one added) cannot trip the gate while a real slide still does.
 */
const FLOORS = {
  medianAbsHappiness: 6,
  soloHappinessMedian: 5,
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

/** Below this magnitude, a happiness-only outcome is not an outcome. */
const TRIVIAL_THRESHOLD = 5;

/**
 * CEILING for `inertEventShare` — the one metric here where lower is better, so
 * it ratchets DOWN rather than up. Measured at 2/235 = 0.85%; the ceiling sits
 * a hair above at 1.5% so adding one flavour event does not trip the gate while
 * a real slide (a run of events authored with nothing at stake) still does.
 *
 * The goal is 0, and unlike the median goal this one is honestly reachable:
 * both current offenders are in `nearMissEvents.ts`, and giving either a single
 * branch with real teeth would clear it. It is deliberately NOT done here —
 * that file's header argues those events exist for tension rather than stakes,
 * and overruling a documented authoring decision to move a number by 0.85
 * points is the exact move this whole file exists to prevent.
 */
const INERT_EVENT_CEILING = 0.015;

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

/**
 * Median magnitude of outcomes that move happiness AND NOTHING ELSE.
 *
 * The honest version of "does this event matter". A `happiness: 3` sitting next
 * to `money: -200` and `relationship: +15` is a rounding detail on a real
 * decision; a `happiness: 3` on its own is the whole outcome, and it is nothing.
 */
function measureSoloHappiness(files) {
  const solo = [];
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/effects:\s*\{([\s\S]{0,300}?)\}\s*,?\s*(?:karma|special|\}|\n\s*\})/g)) {
      const body = m[1];
      const h = body.match(/happiness:\s*(-?\d+)/);
      if (!h) continue;
      const OTHER = /(money|moneyPct|relationship|health|energy|fitness|reputation|approvalRating):/;
      if (!OTHER.test(body)) solo.push(Math.abs(Number(h[1])));
    }
  }
  return { count: solo.length, median: median(solo) };
}

/**
 * Events where NO branch does anything — every choice moves happiness only, by
 * less than `TRIVIAL_THRESHOLD`.
 *
 * This is the honest version of "the game did nothing", and the reason it
 * replaced the `soloHappinessMedian` goal (hypothesis 3 above). It asks a
 * question about the EVENT rather than the outcome, which is what makes it
 * immune to the mistake the median made: a small number on the decline branch
 * of a real decision is good authoring, and only becomes a problem when EVERY
 * branch is like that. No word list, no guess about which branch is the
 * "passive" one — if any single choice has teeth, the event is a decision.
 *
 * Single-choice events (`[{ id: 'skip', text: 'Continue' }]` acknowledgements,
 * and the no-op guards event generators return when their preconditions fail)
 * are excluded: they are not decisions, so they cannot be bad ones.
 */
function measureInertEvents(files) {
  const OTHER = /(money|moneyPct|relationship|health|energy|fitness|reputation|approvalRating):/;
  let events = 0;
  const inert = [];

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    // Event blocks start at `id: 'x',` immediately followed by category/description.
    const starts = [...src.matchAll(/id:\s*'([a-z0-9_]+)',\s*\n\s*(?:category|description)/g)];
    for (let i = 0; i < starts.length; i++) {
      const block = src.slice(starts[i].index, i + 1 < starts.length ? starts[i + 1].index : src.length);
      if (!/choices:\s*\[/.test(block)) continue;
      const bodies = [
        ...block.matchAll(/effects:\s*\{([\s\S]{0,300}?)\}\s*,?\s*(?:karma|special|\}|\n\s*\})/g),
      ].map((m) => m[1]);
      if (bodies.length < 2) continue;
      events++;
      const allTrivial = bodies.every((b) => {
        if (OTHER.test(b)) return false;
        const h = b.match(/happiness:\s*(-?\d+)/);
        return h ? Math.abs(Number(h[1])) < TRIVIAL_THRESHOLD : false;
      });
      if (allTrivial) inert.push(starts[i][1]);
    }
  }

  return { events, inert, share: events === 0 ? 0 : inert.length / events };
}

/** Measure the corpus as it stands right now. */
function measureContentQuality() {
  const files = listContentFiles();
  const happiness = collectHappinessEffects(files);
  const abs = happiness.map(Math.abs);
  const big = abs.filter((v) => v >= BIG_STAKES_THRESHOLD).length;
  const cliff = measureCliffhangers();
  const solo = measureSoloHappiness(files);
  const inertEvents = measureInertEvents(files);

  return {
    multiChoiceEventCount: inertEvents.events,
    inertEventCount: inertEvents.inert.length,
    inertEventIds: inertEvents.inert,
    inertEventShare: inertEvents.share,
    soloHappinessCount: solo.count,
    soloHappinessMedian: solo.median,
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
  TRIVIAL_THRESHOLD,
  INERT_EVENT_CEILING,
  measureContentQuality,
  measureSoloHappiness,
  measureInertEvents,
  listContentFiles,
  median,
};
