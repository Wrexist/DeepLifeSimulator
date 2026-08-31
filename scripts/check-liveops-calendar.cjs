#!/usr/bin/env node
/**
 * Live-ops calendar runway check.
 *
 * WHY THIS EXISTS. v2.11.0 shipped the live-events system rendering nothing,
 * because four of its six event windows had closed before the build went out.
 * Nothing failed, nothing warned: the card simply renders empty when no window
 * is open, so a stale calendar and a healthy one look identical from the
 * outside, in the app and in CI alike. That is the failure this prevents.
 *
 * WHAT IT MEASURES. Runway: how many days from now until a progression stage
 * runs out of events. Per stage, because "the calendar has events" is not the
 * question - a calendar full of late-game content is empty for a new player,
 * and they are the ones who conclude the hub is not for them.
 *
 * WHY IT IS NOT A JEST TEST. It is time-dependent by nature: it passes today
 * and fails in three months with no code change. Inside the suite that would
 * start failing unrelated PRs on a date, which is how a useful signal becomes
 * something people learn to skip. It runs in `preflight` instead, so it blocks
 * a RELEASE - the only moment a stale calendar can actually reach a player -
 * and on a weekly schedule, where it warns early and blocks nobody.
 *
 * TWO CALENDARS, DIFFERENT COSTS TO FIX:
 *   support-site/liveops.json  - published; a push to main fixes it in a minute
 *   lib/liveops/catalogue.ts   - compiled in; only a new build fixes it
 * Both are reported, because they fail on different timescales.
 *
 * Exit 1 when runway is under the threshold. Exit 0 otherwise.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLISHED = path.join(ROOT, 'support-site', 'liveops.json');
const COMPILED = path.join(ROOT, 'lib', 'liveops', 'catalogue.ts');

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days of runway below which this fails. Raised by the weekly watch job. */
const MIN_RUNWAY_DAYS = Number(process.env.LIVEOPS_MIN_RUNWAY_DAYS || 14);

/** Stages an event can target. Mirrors PROGRESSION_STAGES. */
const STAGES = ['new', 'early', 'mid', 'late', 'endgame'];

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

/**
 * Events from the published JSON.
 *
 * A file that will not parse is a hard failure rather than "no remote events":
 * it is served to every player, and the difference between "you published
 * nothing" and "you published something broken" is the whole point of checking.
 */
function readPublished() {
  if (!fs.existsSync(PUBLISHED)) {
    return { events: [], error: `missing: ${path.relative(ROOT, PUBLISHED)}` };
  }
  try {
    const payload = JSON.parse(fs.readFileSync(PUBLISHED, 'utf-8'));
    if (payload.paused === true) {
      return { events: [], paused: true };
    }
    const disabled = new Set(Array.isArray(payload.disabledEventIds) ? payload.disabledEventIds : []);
    const events = (Array.isArray(payload.events) ? payload.events : [])
      .filter((e) => e && typeof e.id === 'string' && !disabled.has(e.id))
      .map(toEvent)
      .filter(Boolean);
    return { events, disabled };
  } catch (error) {
    return { events: [], error: `unparseable JSON: ${error.message}` };
  }
}

/**
 * Events from the compiled-in catalogue.
 *
 * Read with a regex rather than by importing TypeScript, so this stays a plain
 * node script with no build step in front of it. The regex is anchored on the
 * object shape the catalogue actually uses, and `__tests__/liveops` asserts it
 * finds exactly the events the real module exports - so it cannot silently
 * drift into reading half the file and reporting a short runway.
 */
function readCompiled() {
  if (!fs.existsSync(COMPILED)) {
    return { events: [], error: `missing: ${path.relative(ROOT, COMPILED)}` };
  }
  const src = fs.readFileSync(COMPILED, 'utf-8');
  // Anchor on the ASSIGNMENT, not on the first '[' after the name - that one
  // belongs to the type annotation `readonly LiveEventDefinition[]`, and
  // starting there parsed an empty array and reported the catalogue dead.
  const declaration = /export\s+const\s+LOCAL_EVENTS[^=]*=\s*\[/.exec(src);
  const arrayStart = declaration ? declaration.index + declaration[0].length - 1 : -1;
  if (arrayStart < 0) {
    return { events: [], error: 'could not find the LOCAL_EVENTS array' };
  }

  // Brace-matching rather than a line-shape regex. The first version of this
  // split on four-space indentation, the file uses two, and it silently read
  // ZERO events and reported the catalogue as dead - a false alarm that would
  // have trained someone to ignore this check within a week. Counting braces
  // does not care how the file is formatted.
  const events = [];
  let depth = 0;
  let objectStart = -1;
  for (let i = arrayStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '[' && depth === 0 && i !== arrayStart) continue;
    if (ch === '{') {
      if (depth === 0) objectStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && objectStart >= 0) {
        events.push(parseEventBlock(src.slice(objectStart, i + 1)));
        objectStart = -1;
      }
    } else if (ch === ']' && depth === 0) {
      break;
    }
  }

  const parsed = events.filter(Boolean);
  if (parsed.length === 0) {
    // Zero events from a file that exists means the parser lost its footing,
    // not that the catalogue is empty - and reporting "no runway" for that is
    // the false alarm described above. Say which it is.
    return { events: [], error: 'found the array but parsed no events - the parser needs updating' };
  }
  return { events: parsed };
}

/** Pull the fields this check needs out of one event literal. */
function parseEventBlock(block) {
  const pick = (field) => {
    const m = new RegExp(`\\b${field}:\\s*'([^']+)'`).exec(block);
    return m ? m[1] : null;
  };
  const id = pick('id');
  const startsAt = pick('startsAt');
  const endsAt = pick('endsAt');
  if (!id || !startsAt || !endsAt) return null;

  const stagesMatch = /stages:\s*\[([^\]]*)\]/.exec(block);
  const stages = stagesMatch
    ? stagesMatch[1]
        .split(',')
        .map((v) => v.trim().replace(/['"]/g, ''))
        .filter(Boolean)
    : null;

  return toEvent({
    id,
    startsAt,
    endsAt,
    kind: pick('kind'),
    eligibility: stages ? { stages } : undefined,
  });
}

/** Exported for the test that pins this parser against the real module. */
module.exports = { readCompiled, readPublished, runwayDays, longestNearGap };

function toEvent(raw) {
  const startsAt = Date.parse(raw.startsAt);
  const endsAt = Date.parse(raw.endsAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) return null;
  return {
    id: raw.id,
    kind: raw.kind,
    startsAt,
    endsAt,
    stages: raw.eligibility && Array.isArray(raw.eligibility.stages) ? raw.eligibility.stages : null,
  };
}

/** Events that count as coverage for one stage. */
function relevantTo(events, stage) {
  // `returning` events are excluded. They are real coverage but only for
  // someone who has been away, so counting them would hide a gap from every
  // player who shows up daily - which is everyone the calendar is written for.
  return events.filter((e) => e.kind !== 'returning' && (!e.stages || e.stages.includes(stage)));
}

const HORIZON_DAYS = 400;

/**
 * How many days until this stage is out of events for good.
 *
 * The LAST covered day, not the first uncovered one. Those are different
 * numbers and the difference matters: this check first reported zero runway for
 * a calendar with six months of events in it, because nothing happened to be
 * running on the day it ran. "There is a hole today" and "the calendar is
 * dying" are separate problems with separate fixes, so they are measured
 * separately - see `longestNearGap`.
 */
function runwayDays(events, stage, now) {
  const relevant = relevantTo(events, stage);
  let last = 0;
  for (let day = 0; day < HORIZON_DAYS; day++) {
    const at = now + day * DAY_MS;
    if (relevant.some((e) => at >= e.startsAt && at < e.endsAt)) last = day + 1;
  }
  return last;
}

/** How long the calendar goes quiet, at worst, inside `withinDays`. */
function longestNearGap(events, stage, now, withinDays) {
  const relevant = relevantTo(events, stage);
  let longest = 0;
  let run = 0;
  for (let day = 0; day < withinDays; day++) {
    const at = now + day * DAY_MS;
    const covered = relevant.some((e) => at >= e.startsAt && at < e.endsAt);
    run = covered ? 0 : run + 1;
    if (run > longest) longest = run;
  }
  return longest;
}

/** A quiet stretch this long inside the near horizon is worth saying out loud. */
const MAX_GAP_DAYS = Number(process.env.LIVEOPS_MAX_GAP_DAYS || 30);
const NEAR_HORIZON_DAYS = 90;

function main() {
  const now = Date.now();
  const published = readPublished();
  const compiled = readCompiled();

  console.log('');
  console.log('LIVE OPS CALENDAR RUNWAY');
  console.log('='.repeat(60));
  console.log(c.dim(`  as of ${new Date(now).toISOString().slice(0, 10)}  ·  threshold ${MIN_RUNWAY_DAYS} days`));
  console.log('');

  const problems = [];
  const warnings = [];

  for (const [label, source, fixCost] of [
    ['published  (support-site/liveops.json)', published, 'a push to main'],
    ['compiled   (lib/liveops/catalogue.ts)', compiled, 'a NEW BUILD'],
  ]) {
    if (source.error) {
      console.log(`  ${c.red('FAIL')}  ${label} - ${source.error}`);
      problems.push(`${label}: ${source.error}`);
      continue;
    }
    if (source.paused) {
      console.log(`  ${c.yellow('WARN')}  ${label} - the whole system is PAUSED`);
      continue;
    }
    console.log(`  ${label}   ${c.dim('fix: ' + fixCost)}`);
    console.log(c.dim('       stage     runway   longest quiet stretch (next 90d)'));
    for (const stage of STAGES) {
      const days = runwayDays(source.events, stage, now);
      const gap = longestNearGap(source.events, stage, now, NEAR_HORIZON_DAYS);
      const ok = days >= MIN_RUNWAY_DAYS;
      const mark = ok ? c.green('ok  ') : c.red('LOW ');
      const gapText = gap >= MAX_GAP_DAYS ? c.yellow(`${gap}d quiet`) : c.dim(`${gap}d quiet`);
      console.log(`     ${mark} ${stage.padEnd(8)} ${String(days).padStart(4)}d    ${gapText}`);
      if (!ok) problems.push(`${label}: '${stage}' runs out in ${days} days (needs ${MIN_RUNWAY_DAYS}) - fix costs ${fixCost}`);
      if (gap >= MAX_GAP_DAYS) warnings.push(`${label}: '${stage}' goes quiet for ${gap} days straight in the next ${NEAR_HORIZON_DAYS}`);
    }
    console.log('');
  }

  // Combined is what a player with a network connection actually sees. Reported
  // last because it is the most flattering number, and leading with it would
  // hide a compiled-in calendar that has quietly died behind a healthy
  // published one - which is exactly the state an offline player is in.
  const all = [...published.events, ...compiled.events];
  console.log('  combined   (what an online player sees)');
  for (const stage of STAGES) {
    const days = runwayDays(all, stage, now);
    const gap = longestNearGap(all, stage, now, NEAR_HORIZON_DAYS);
    console.log(
      `     ${days >= MIN_RUNWAY_DAYS ? c.green('ok  ') : c.red('LOW ')} ${stage.padEnd(8)} ${String(days).padStart(4)}d    ${gap >= MAX_GAP_DAYS ? c.yellow(`${gap}d quiet`) : c.dim(`${gap}d quiet`)}`,
    );
  }
  console.log('');
  console.log('='.repeat(60));

  for (const w of warnings) console.log(c.yellow(`  ! ${w}`));
  if (warnings.length > 0) {
    console.log(c.dim('    A quiet stretch is not a failure - it is a stage with nothing to do'));
    console.log(c.dim('    for that long, which is how a player learns the card is not for them.'));
    console.log('');
  }

  if (problems.length === 0) {
    console.log(c.green('✓ Every stage has runway.'));
    console.log('');
    return 0;
  }

  console.log(c.red('✗ The live-ops calendar is running out.'));
  console.log('');
  for (const p of problems) console.log(c.red(`   - ${p}`));
  console.log('');
  console.log('  A stale calendar is INVISIBLE from the outside: the card renders');
  console.log('  nothing and the build looks completely healthy. That is how');
  console.log('  v2.11.0 shipped this system doing nothing at all.');
  console.log('');
  console.log('  To fix: add windows to support-site/liveops.json (live in about a');
  console.log('  minute, no build) or lib/liveops/catalogue.ts (needs a release).');
  console.log('  docs/LIVEOPS.md has the event model.');
  console.log('');
  return 1;
}

if (require.main === module) {
  process.exit(main());
}
