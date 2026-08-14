/**
 * Making a child read as a child.
 *
 * The style has no age geometry — a six-year-old and a thirty-year-old are the
 * same drawing with different hair. Every candidate art set shared that, and
 * the honest fix is a commissioned child part set. This is not that. It is the
 * one lever the art DOES expose, and it turns out to carry most of the signal.
 *
 * ── The cue ───────────────────────────────────────────────────────────────
 * Cranial ratio. In an adult head the eyes sit at the vertical middle; in an
 * infant they sit far lower, because the cranium above them is enormous
 * relative to the face. That ratio, not detail, is what makes a stylised head
 * read as young — which is why it survives at 34px in a family list.
 *
 * Measured against this art (see `depth.ts` for how): skull top 36, chin 173.
 * So the adult eye line is 104.5 and an infant's is about 120, roughly 60% of
 * the way down the skull.
 *
 * So: scale the four feature layers about the adult eye line as ONE cluster,
 * then move that line to the age-appropriate one, and give the eyes a little
 * extra size inside it. An earlier attempt scaled each feature independently
 * and pulled the face apart — the mouth drifted off the nose. They must move
 * together.
 *
 * ── Why this operates on group transforms ─────────────────────────────────
 * The art emits a fixed set of top-level layer groups, each identified by its
 * own translate. That was verified across nine configurations — clothing,
 * hats, long hair, beards, glasses, bald — and every one emits byte-identical
 * transforms, so the layers can be moved without touching a single path. Path
 * surgery is what failed the first time this system was built.
 *
 * It does couple us to the art package's internals. Two guards: every
 * transform degrades to a no-op when its group is missing, so a DiceBear
 * upgrade loses the effect rather than corrupting the face; and
 * `__tests__/avatar/childProportions.test.ts` pins these offsets against the
 * REAL generated art, so the upgrade fails a test instead of going unnoticed.
 *
 * Nothing here is persisted. Age is already in the save.
 */

/** The art's own coordinate space, shared with `depth.ts`. */
const ART_CENTER_X = 140;

/** Where the eyes sit in the adult drawing — the midpoint of skull top and chin. */
export const ADULT_EYE_Y = 104.5;

/** Where they sit at birth: about 60% of the way down the skull. */
export const INFANT_EYE_Y = 120;

/** The age at which a face is drawn with fully adult proportions. */
export const ADULT_PROPORTION_AGE = 16;

/** How much the feature cluster shrinks at birth — the forehead this opens up. */
const INFANT_FEATURE_SCALE = 0.8;

/** How much bigger an infant's eyes are, on top of the cluster. */
const INFANT_EYE_SCALE = 1.2;

/**
 * The layer groups, keyed by the transform the art gives each one.
 * ORDER IS IRRELEVANT; the exact strings are not.
 */
const FEATURE_GROUPS = [
  'translate(78 134)', // mouth
  'translate(104 122)', // nose
  'translate(76 90)', // eyes
  'translate(76 82)', // eyebrows
] as const;

const EYE_GROUP = 'translate(76 90)';

/**
 * How childlike a face of this age is drawn: 1 at birth, 0 from 16 on.
 *
 * Linear, so it is monotonic and easy to reason about — a face can never get
 * younger on a birthday. A 4-year-old lands at 75%, an 8-year-old at 50%, a
 * 12-year-old at 25%, which is a fair ladder for how fast real cranial ratio
 * actually converges.
 */
export function youthFactor(age: number): number {
  if (!Number.isFinite(age)) return 0;
  const a = Math.max(0, age);
  if (a >= ADULT_PROPORTION_AGE) return 0;
  return (ADULT_PROPORTION_AGE - a) / ADULT_PROPORTION_AGE;
}

/**
 * Wraps the group carrying exactly `transform` in an extra transform.
 *
 * Returns the input unchanged when the group is absent, which is the whole
 * degradation story: a face that misses this is the adult drawing, not a
 * broken one.
 */
function wrapGroup(svg: string, transform: string, extra: string): string {
  const open = `<g transform="${transform}">`;
  const start = svg.indexOf(open);
  if (start < 0) return svg;

  // Walk to the matching close tag; the groups nest.
  //
  // A self-closing `<g … />` opens and closes in one tag, so counting it as an
  // opener would leave `depth` permanently above zero and this function would
  // return the art unchanged — proportions silently off, no error anywhere.
  // Today's art emits none (11 groups, 0 self-closing), but this walk exists to
  // survive an art-package upgrade, which is the one moment that could change.
  const tag = /<(\/?)g\b[^>]*?(\/?)>/g;
  tag.lastIndex = start + open.length;
  let depth = 1;
  let end = -1;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(svg))) {
    if (match[2] === '/') continue;
    depth += match[1] === '/' ? -1 : 1;
    if (depth === 0) {
      end = match.index + match[0].length;
      break;
    }
  }
  if (end < 0) return svg;

  return `${svg.slice(0, start)}<g transform="${extra}">${svg.slice(start, end)}</g>${svg.slice(end)}`;
}

/** A scale about a fixed point, written the way SVG wants it. */
function scaleAbout(x: number, y: number, factor: number, toY: number = y): string {
  return `translate(${x} ${round(toY)}) scale(${round(factor)}) translate(-${x} -${round(y)})`;
}

/** Trims float noise so the output is stable and diffable. */
function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/**
 * Re-proportions a generated avatar SVG for a character of this age.
 *
 * A no-op at 16 and above, and on anything that is not an SVG.
 */
export function applyChildProportions(svg: string, age: number): string {
  if (typeof svg !== 'string' || !svg.includes('</svg>')) return svg;

  const youth = youthFactor(age);
  if (youth <= 0) return svg;

  const clusterScale = 1 - (1 - INFANT_FEATURE_SCALE) * youth;
  const eyeY = ADULT_EYE_Y + (INFANT_EYE_Y - ADULT_EYE_Y) * youth;
  const cluster = scaleAbout(ART_CENTER_X, ADULT_EYE_Y, clusterScale, eyeY);

  let out = svg;
  for (const group of FEATURE_GROUPS) {
    out = wrapGroup(out, group, cluster);
  }

  // Applied INSIDE the cluster wrapper — `wrapGroup` finds the inner group —
  // so it is expressed in the cluster's own space and the eyes stay put
  // relative to the brows they sit under.
  const eyeScale = 1 + (INFANT_EYE_SCALE - 1) * youth;
  return wrapGroup(out, EYE_GROUP, scaleAbout(ART_CENTER_X, ADULT_EYE_Y, eyeScale));
}
