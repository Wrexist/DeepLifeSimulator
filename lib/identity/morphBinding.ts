/**
 * Binding the face genome to a rig's actual blendshapes.
 *
 * ## The problem this exists to solve
 *
 * The app drives morphs called `jawWidth`, `noseBridge`, `cheekboneHeight`. A
 * real rig calls them something else — and every rig calls them something
 * different:
 *
 *   MetaHuman / ARKit  jawOpen, mouthSmileLeft, browOuterUpLeft
 *   Blender-authored   jaw_width, nose_bridge, Cheekbone Height
 *   MakeHuman targets  head-scale-horiz-more, nose-hump-incr
 *
 * Wire the app to a guessed name list and every mismatch becomes a DEAD SLIDER:
 * the player drags it, nothing moves, and nothing anywhere reports a problem.
 * That failure is silent, which is what makes it dangerous — it looks exactly
 * like a working build.
 *
 * So binding is explicit, fuzzy where it can safely be, and it REPORTS what it
 * could not bind. `bindGenomeToRig` returns the unmatched list precisely so a
 * dev build can surface it instead of shipping controls that do nothing.
 *
 * ## Left/right pairs
 *
 * ARKit-style rigs split most shapes into `…Left` / `…Right`. Our genome is
 * symmetric by design (the head mesh is mirrored), so one app morph legitimately
 * drives BOTH sides. That is handled here rather than at each call site.
 *
 * No three.js, no GL — this is a pure name-and-number problem, so it is fully
 * testable without an asset or a GPU.
 */

import { FACE_MORPH_KEYS, type FaceMorphKey, type FaceGenome } from './types';

/** Normalize a morph name for comparison: case, separators and side suffixes. */
function normalize(name: string): string {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Strip a side marker so `jawWidthLeft`, `jaw_width_R` and MakeHuman's
 * `l-eye-scale` all collapse to the same base.
 *
 * Sides appear as a SUFFIX in ARKit/Blender rigs and as a PREFIX in MakeHuman
 * (`l-eye-…`, `r-cheek-…`). Both are handled, because an unhandled prefix means
 * the left and right shapes never pair up and a single app morph ends up driving
 * one eye — visibly wrong, and not something a name-only test would notice
 * unless it is looking for it.
 *
 * The suffix branch deliberately does NOT strip a bare trailing `l`/`r`. It used
 * to, and that quietly truncated any name ending in those letters:
 * `…-incr` became `…-inc`, `head-rectangular` became `headrectangula`. Bare
 * single letters are only a side marker when separated (`jaw_width_r`), and
 * separators are already gone by the time this runs — so the only safe forms to
 * match here are the spelled-out ones.
 */
function stripSide(normalized: string): string {
  const withoutPrefix = normalized.replace(/^([lr])(?=[a-z]{3})/, '');
  return withoutPrefix.replace(/(left|right)$/, '');
}

/**
 * Strip MakeHuman's bipolar direction suffix to get the axis stem.
 *
 * MakeHuman names every slider as a PAIR — `nose-scale-horiz-decr` and
 * `nose-scale-horiz-incr` are two ends of one axis. Matching has to happen on
 * the stem (`nosescalehoriz`), or each half binds as if it were its own morph.
 */
function stripDirection(normalized: string): string {
  return normalized.replace(/(incr|decr|forward|backward|up|down|in|out|less|more)$/, '');
}

/**
 * Aliases from our morph keys to names real rigs use.
 *
 * Deliberately hand-written rather than inferred. A wrong automatic match is
 * worse than no match: an unbound slider is inert and reported, but a slider
 * bound to the WRONG blendshape actively deforms the face and looks like a
 * modelling bug rather than a wiring one.
 *
 * ARKit names appear here even though ARKit is an EXPRESSION set, because a
 * route-A preset rig may be all that is available and a few of its shapes do
 * overlap usefully (jaw and brow especially). Route B — artist-authored
 * sculpting shapes — should match our own names directly and need no aliases.
 */
const ALIASES: Partial<Record<FaceMorphKey, string[]>> = {
  jawWidth: ['jawwidth', 'jawscale', 'jawopen'],
  jawAngle: ['jawangle', 'jawforward', 'jawsquare'],
  chinLength: ['chinlength', 'chinheight', 'chin'],
  chinProtrusion: ['chinprotrusion', 'chinforward', 'mentalis'],
  cheekboneHeight: ['cheekboneheight', 'cheekbone', 'cheeksquint'],
  cheekFullness: ['cheekfullness', 'cheekpuff', 'cheeks'],
  browHeight: ['browheight', 'browinnerup', 'browouterup', 'browup'],
  browProtrusion: ['browprotrusion', 'browridge', 'browdown'],
  eyeSize: ['eyesize', 'eyewide', 'eyeopen'],
  eyeSpacing: ['eyespacing', 'eyedistance'],
  eyeDepth: ['eyedepth', 'eyesocket'],
  eyeTilt: ['eyetilt', 'eyeangle', 'eyecanthus'],
  noseLength: ['noselength', 'nosescale'],
  noseWidth: ['nosewidth', 'nosesneer', 'nostril', 'nostrilwidth'],
  noseBridge: ['nosebridge', 'bridgewidth', 'bridgeheight'],
  noseTip: ['nosetip', 'tipsize', 'tiprotation'],
  mouthWidth: ['mouthwidth', 'mouthstretch', 'mouthsmile'],
  lipFullness: ['lipfullness', 'lipthickness', 'mouthpucker', 'upperlip', 'lowerlip'],
  mouthHeight: ['mouthheight', 'mouthposition'],
  earSize: ['earsize', 'earscale', 'ear'],
  faceWidth: ['facewidth', 'headwidth'],
  faceLength: ['facelength', 'faceheight', 'headheight'],
  foreheadSlope: ['foreheadslope', 'forehead', 'templewidth'],
  neckThickness: ['neckthickness', 'neckscale', 'neck'],
};

/**
 * Markers a rig uses to name the opposing half of a bipolar axis.
 *
 * ANCHORED TO THE END, and that anchoring is load-bearing. The first version was
 * unanchored and included `in`, so it matched inside `incr` — meaning every one
 * of MakeHuman's ~1000 `-incr` targets, the POSITIVE half of every axis, was
 * classified as negative. Both halves of every slider would then have driven the
 * same direction: a face that deforms identically whichever way you drag.
 */
const NEGATIVE_MARKERS =
  /(narrow|down|in|less|decr|shrink|small|thin|short|backward|concave|compress)$/i;

/**
 * MakeHuman target stems, per app morph.
 *
 * MakeHuman is the chosen head source, and unlike ARKit it is a genuine
 * SCULPTING set — every one of our 24 morphs has a real counterpart, so the
 * creator's sliders can all be live rather than hidden.
 *
 * These are exact stems (direction suffix already removed) and they are matched
 * in the alias pass, NOT the fuzzy prefix pass. That is deliberate: with ~1000
 * targets in play, substring matching would bind `noseLength` to
 * `nose-scale-horiz` — which is width. A wrong binding deforms the face and
 * reads as a modelling bug; an unbound morph is inert and reported.
 *
 * PROVISIONAL until checked against a real install. `scripts/makehuman-targets.mjs
 * --verify` reports every stem here that matches nothing, so a wrong guess fails
 * loudly at build time instead of becoming a dead slider.
 */
const MAKEHUMAN_STEMS: Record<FaceMorphKey, string[]> = {
  faceWidth: ['headscalehoriz'],
  faceLength: ['headscalevert'],
  jawWidth: ['chinbones'],
  jawAngle: ['chinprognathism'],
  chinLength: ['chinheight'],
  chinProtrusion: ['chinprominent'],
  cheekboneHeight: ['cheekbones'],
  cheekFullness: ['cheekinner'],
  browHeight: ['eyebrowstrans'],
  browProtrusion: ['foreheadnubian'],
  eyeSize: ['eyescale'],
  eyeSpacing: ['eyemove'],
  eyeDepth: ['eyepush1'],
  eyeTilt: ['eyecorner1'],
  noseLength: ['nosescalevert'],
  noseWidth: ['nosescalehoriz'],
  noseBridge: ['nosehump'],
  noseTip: ['nosepointwidth'],
  mouthWidth: ['mouthscalehoriz'],
  lipFullness: ['mouthupperlipvolume', 'mouthlowerlipvolume'],
  mouthHeight: ['mouthtrans'],
  earSize: ['earscale'],
  foreheadSlope: ['foreheadscalevert'],
  neckThickness: ['neckscalehoriz'],
};

export interface RigBinding {
  /** App morph key -> the rig morph names it drives (often a left/right pair). */
  bound: Record<string, string[]>;
  /**
   * App morph key -> rig morphs for the NEGATIVE half of the axis.
   *
   * Some rigs ship bipolar pairs (`jawWidth` + `jawWidthNarrow`). Without this
   * the bottom half of such a slider would be inert even though the rig can
   * express it — a dead half-slider, and exactly the silent failure the rest of
   * this module exists to prevent.
   */
  negative: Record<string, string[]>;
  /** App morph keys with no match in this rig. These are DEAD SLIDERS. */
  unbound: FaceMorphKey[];
  /** Rig morphs nothing drives. Pure bundle cost — feed to the optimizer. */
  unused: string[];
}

/**
 * Work out which of the rig's morphs each app morph should drive.
 *
 * Matching runs in three passes, most confident first, and a rig morph is
 * claimed only once — so an exact match always beats an alias, and an early
 * loose match can never steal a name a later key would have matched exactly.
 */
export function bindGenomeToRig(rigMorphNames: readonly string[]): RigBinding {
  const bound: Record<string, string[]> = {};
  const claimed = new Set<string>();

  const rig = rigMorphNames.map((name) => ({
    name,
    norm: normalize(name),
    base: stripSide(normalize(name)),
    /** Side AND direction removed — the bipolar axis a MakeHuman target sits on. */
    stem: stripDirection(stripSide(normalize(name))),
  }));

  const claim = (key: FaceMorphKey, predicate: (r: (typeof rig)[number]) => boolean) => {
    for (const entry of rig) {
      if (claimed.has(entry.name)) continue;
      if (!predicate(entry)) continue;
      (bound[key] ||= []).push(entry.name);
      claimed.add(entry.name);
    }
  };

  // Pass 1 — exact, ignoring case/separators/side.
  for (const key of FACE_MORPH_KEYS) {
    const target = normalize(key);
    claim(key, (r) => r.norm === target || r.base === target);
  }
  // Pass 2 — declared aliases.
  for (const key of FACE_MORPH_KEYS) {
    if (bound[key]) continue;
    const aliases = ALIASES[key];
    if (!aliases) continue;
    claim(key, (r) => aliases.includes(r.norm) || aliases.includes(r.base));
  }
  // Pass 2b — MakeHuman axis stems. Exact match on the stem, so the positive
  // half of a bipolar pair binds here and pass 4 collects its opposite. Runs
  // before the fuzzy pass because with ~1000 targets loaded, substring matching
  // reliably picks the wrong one.
  for (const key of FACE_MORPH_KEYS) {
    if (bound[key]) continue;
    const stems = MAKEHUMAN_STEMS[key];
    claim(key, (r) => !NEGATIVE_MARKERS.test(r.norm) && stems.includes(r.stem));
  }
  // Pass 3 — alias as a prefix (`jawWidth` matching `head_jawWidth_ctrl`).
  // Last and narrowest: substring matching is where wrong bindings come from,
  // so it only runs for keys still unbound after the confident passes.
  for (const key of FACE_MORPH_KEYS) {
    if (bound[key]) continue;
    const aliases = ALIASES[key] ?? [normalize(key)];
    claim(key, (r) => aliases.some((a) => r.norm.includes(a)));
  }

  // Pass 4 — opposing shapes. Runs after everything else so it can only claim
  // names no positive binding wanted.
  const negative: Record<string, string[]> = {};
  for (const key of FACE_MORPH_KEYS) {
    if (!bound[key]) continue;
    // 4a — MakeHuman axis stems. Exact, so it runs first for the same reason
    // pass 1 does: the loose branch below matches `nosescalehoriz` against
    // noseLength's `nosescale` alias, and noseLength is tried first, so without
    // this ordering noseWidth silently loses its negative half.
    for (const entry of rig) {
      if (claimed.has(entry.name)) continue;
      if (!NEGATIVE_MARKERS.test(entry.name)) continue;
      if (!MAKEHUMAN_STEMS[key].includes(entry.stem)) continue;
      (negative[key] ||= []).push(entry.name);
      claimed.add(entry.name);
    }
  }
  // 4b — marker-suffixed opposites (`jawWidthNarrow`), for rigs that are not
  // MakeHuman. Loose, so it only sees what 4a left behind.
  const mhStems = new Set(Object.values(MAKEHUMAN_STEMS).flat());
  for (const key of FACE_MORPH_KEYS) {
    if (!bound[key]) continue;
    const aliases = ALIASES[key] ?? [normalize(key)];
    for (const entry of rig) {
      if (claimed.has(entry.name)) continue;
      if (!NEGATIVE_MARKERS.test(entry.name)) continue;
      // Never let a loose alias swallow another key's MakeHuman axis.
      if (mhStems.has(entry.stem)) continue;
      const stem = entry.norm.replace(NEGATIVE_MARKERS, '');
      if (aliases.some((a) => stem === a || stem.startsWith(a)) || stem === normalize(key)) {
        (negative[key] ||= []).push(entry.name);
        claimed.add(entry.name);
      }
    }
  }

  const unbound = FACE_MORPH_KEYS.filter((key) => !bound[key]);
  const unused = rigMorphNames.filter((name) => !claimed.has(name));
  return { bound, negative, unbound, unused };
}

/**
 * Turn a genome into per-rig-morph influences, ready for
 * `mesh.morphTargetInfluences`.
 *
 * Genome morphs are [0, 1] with 0.5 neutral; a blendshape influence is [0, 1]
 * with 0 neutral. A morph therefore maps to `(value - 0.5) * 2`, and the
 * negative half has nowhere to go on a rig with only one shape per axis — a
 * "narrower jaw" needs a `jawNarrow` shape that most rigs do not have.
 *
 * Rather than silently clamping (which makes the lower half of every slider
 * inert — a dead slider by another name), the negative half is reported in
 * `oneSided` so the UI can constrain those controls to 0.5-1 instead of
 * pretending the full range works.
 */
export function genomeToInfluences(
  genome: FaceGenome,
  binding: RigBinding,
  options: {
    /**
     * Allow NEGATIVE influences, making a single target drive both halves.
     *
     * Only correct for rigs whose morphs are LINEAR — the ICT head's axes are
     * combinations of a scan-derived PCA basis, so -1 is a real face on the same
     * manifold as +1, and the slider becomes bipolar for free rather than by
     * baking a second target per axis.
     *
     * It is WRONG for an artist-authored blendshape. Negating a sculpt does not
     * produce its opposite; it produces the sculpt inside out. Hence opt-in, set
     * by the renderer that knows which asset it loaded, rather than a default.
     */
    signed?: boolean;
  } = {},
): { influences: Record<string, number>; oneSided: FaceMorphKey[] } {
  const influences: Record<string, number> = {};
  const oneSided: FaceMorphKey[] = [];

  if (options.signed) {
    for (const key of FACE_MORPH_KEYS) {
      const targets = binding.bound[key];
      if (!targets) continue;
      const raw = genome.morphs[key];
      const value = typeof raw === 'number' && isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0.5;
      const signedValue = (value - 0.5) * 2;
      for (const name of targets) influences[name] = signedValue;
      // A declared opposing target would double-apply the same direction here,
      // so it is held at zero rather than driven.
      for (const name of binding.negative[key] ?? []) influences[name] = 0;
    }
    // Nothing is one-sided: the full slider range is expressible.
    return { influences, oneSided };
  }

  for (const key of FACE_MORPH_KEYS) {
    const targets = binding.bound[key];
    if (!targets) continue;
    const raw = genome.morphs[key];
    const value = typeof raw === 'number' && isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0.5;
    const signed = (value - 0.5) * 2;
    const magnitude = Math.max(0, Math.min(1, Math.abs(signed)));

    const negatives = binding.negative[key];
    if (signed < 0 && (!negatives || negatives.length === 0)) {
      // The rig cannot express this direction. Report it so the UI can clamp
      // the control to its usable half rather than leave the bottom inert.
      if (!oneSided.includes(key)) oneSided.push(key);
    }

    // Drive whichever half the value asks for, and hold the other at zero —
    // leaving a stale influence behind would blend both directions at once.
    for (const name of targets) influences[name] = signed >= 0 ? magnitude : 0;
    for (const name of negatives ?? []) influences[name] = signed < 0 ? magnitude : 0;
  }

  return { influences, oneSided };
}

/**
 * Human-readable report for a dev build.
 *
 * Exists so that "the sliders do nothing" is discovered at integration time by
 * whoever wires the asset, not after release by a player.
 */
export function describeBinding(binding: RigBinding): string {
  const lines: string[] = [];
  const boundCount = Object.keys(binding.bound).length;
  lines.push(`Bound ${boundCount}/${FACE_MORPH_KEYS.length} app morphs.`);
  if (binding.unbound.length) {
    lines.push(`DEAD SLIDERS (${binding.unbound.length}) — hide these in the UI:`);
    lines.push(`  ${binding.unbound.join(', ')}`);
  }
  if (binding.unused.length) {
    lines.push(`Unused rig morphs (${binding.unused.length}) — strip via optimize-head-glb --keep:`);
    lines.push(`  ${binding.unused.slice(0, 20).join(', ')}${binding.unused.length > 20 ? ' …' : ''}`);
  }
  return lines.join('\n');
}
