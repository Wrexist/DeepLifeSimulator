/**
 * Turning flat art into a lit volume.
 *
 * The avatar art is 100% flat fills — the generated SVG contains no gradient
 * at all. That is why the faces read as stickers: the plate behind them has
 * depth, and the character on top does not, so the two never look like they
 * are in the same scene.
 *
 * This injects four overlays into the generated SVG, all serving the same
 * upper-left key light the plate already uses:
 *
 *   1. Form shadow — a radial falloff darkening the lower right, which is what
 *      makes a head read as a sphere rather than a disc.
 *   2. Key light   — a warm bloom at the light source.
 *   3. Rim light   — a cool crescent on the opposite edge, separating the
 *      character from the plate behind it.
 *   4. Occlusion   — a soft darkening at the bottom, so the character sits
 *      INTO the plate instead of floating on it.
 *
 * ── Constraints this respects ─────────────────────────────────────────────
 * No SVG filters and no blend modes. `react-native-svg` support for both is
 * uneven across iOS, Android and web, and this has to render identically on
 * all three. Everything here is a plain alpha-composited gradient.
 *
 * Ids must be namespaced per instance. `SvgXml` parses this string into real
 * elements, so on the web target two avatars sharing a gradient id would land
 * in one document scope and the second would silently use the first's
 * gradient — and the family tree renders dozens at once.
 */

/** The art's own coordinate space. Every overlay is expressed in it. */
export const ART_VIEWBOX = 280;

/**
 * Adds the lighting overlays to a generated avatar SVG.
 *
 * `uid` must be unique per rendered instance. Returns the input unchanged if
 * it does not look like an SVG, so a malformed string degrades to flat art
 * rather than to a blank frame.
 */
export function addDepth(svg: string, uid: string): string {
  if (typeof svg !== 'string' || !svg.includes('</svg>')) return svg;

  const id = (name: string) => `${name}${uid}`;
  const box = ART_VIEWBOX;

  const defs =
    `<defs>` +
    // Form shadow. Starts at 0.40 so the lit half of the face is untouched.
    `<radialGradient id="${id('avFs')}" cx="34%" cy="26%" r="78%">` +
    `<stop offset="0.40" stop-color="#0E0A1E" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#0E0A1E" stop-opacity="0.40"/>` +
    `</radialGradient>` +
    `<radialGradient id="${id('avKl')}" cx="31%" cy="19%" r="44%">` +
    `<stop offset="0" stop-color="#FFF3E0" stop-opacity="0.28"/>` +
    `<stop offset="1" stop-color="#FFF3E0" stop-opacity="0"/>` +
    `</radialGradient>` +
    // Cool rim, opposite the key — the cheapest cue that the head is a volume.
    `<linearGradient id="${id('avRim')}" x1="1" y1="0.85" x2="0.45" y2="0.25">` +
    `<stop offset="0" stop-color="#8EC5FF" stop-opacity="0.42"/>` +
    `<stop offset="0.4" stop-color="#8EC5FF" stop-opacity="0"/>` +
    `</linearGradient>` +
    // Transparent at the TOP, darkest at the BOTTOM. The first version ran the
    // other way, which put a hard edge across the chest — the gradient started
    // at full strength instead of fading in — and faded out exactly where the
    // contact shadow should have been strongest.
    `<linearGradient id="${id('avOcc')}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#0E0A1E" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#0E0A1E" stop-opacity="0.32"/>` +
    `</linearGradient>` +
    `</defs>`;

  const body =
    `<rect width="${box}" height="${box}" fill="url(#${id('avFs')})"/>` +
    `<rect width="${box}" height="${box}" fill="url(#${id('avKl')})"/>` +
    `<rect width="${box}" height="${box}" fill="url(#${id('avRim')})"/>` +
    // Runs to the bottom edge of the art. Stopping short leaves a visible
    // horizontal line wherever the rect ends.
    `<rect x="0" y="${Math.round(box * 0.58)}" width="${box}" height="${box - Math.round(box * 0.58)}" fill="url(#${id('avOcc')})"/>`;

  return svg.replace('</svg>', `${defs}${body}</svg>`);
}

/** How long an eye-blink is held, and the window between blinks. */
export const BLINK = {
  closedMs: 120,
  minGapMs: 3800,
  maxGapMs: 7200,
} as const;

/** A blink delay in the authored range. Injectable rng keeps tests deterministic. */
export function nextBlinkDelay(random: () => number = Math.random): number {
  const span = BLINK.maxGapMs - BLINK.minGapMs;
  return BLINK.minGapMs + Math.floor(random() * span);
}
