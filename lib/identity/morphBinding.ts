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

/** Strip a trailing side marker so `jawWidthLeft` and `jaw_width_R` both match. */
function stripSide(normalized: string): string {
  return normalized.replace(/(left|right|_l|_r|l|r)$/, '');
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

/** Markers a rig uses to name the opposing half of a bipolar axis. */
const NEGATIVE_MARKERS = /(narrow|down|in|less|decr|shrink|small|thin|short)/i;

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
    const aliases = ALIASES[key] ?? [normalize(key)];
    for (const entry of rig) {
      if (claimed.has(entry.name)) continue;
      if (!NEGATIVE_MARKERS.test(entry.name)) continue;
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
): { influences: Record<string, number>; oneSided: FaceMorphKey[] } {
  const influences: Record<string, number> = {};
  const oneSided: FaceMorphKey[] = [];

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
