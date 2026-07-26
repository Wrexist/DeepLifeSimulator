/**
 * Yacht — a superyacht profile, serving both `luxury_yacht` and `mega_yacht`.
 *
 * Reconstructed from `assets/images/luxury/mega_yacht.jpg`. One builder at two
 * scales: the mega-yacht is the same naval architecture with more length and an
 * extra deck, which is also how the real vessels differ.
 *
 * ## Construction
 *
 * The hull is a LOFT — a series of cross-sections swept along the keel, each
 * with its own beam, draft and flare. That is how hulls are actually drawn
 * (a lines plan is exactly this table of stations), and it is why a hull is
 * tractable in code while a car body is not: the shape is defined by a handful
 * of station curves rather than by continuous sculpted surfacing.
 *
 * ## What this does NOT reproduce
 *
 *  - No railings, tenders, davits, radar mast detail, or window mullions.
 *  - Superstructure is stepped blocks, not the compound-curved glasshouse of a
 *    real modern superyacht.
 *  - No wake, water, or sea — the model is the vessel alone.
 *
 * It reads as a superyacht in silhouette and from three-quarters. It is not a
 * specific hull.
 */

import {
  boundingRadius,
  box,
  computeNormals,
  merge,
  translate,
  type MeshData,
} from '@/lib/geometry/mesh';
import type { ModelPart, ProceduralModel } from './types';

export type YachtScale = 'luxury' | 'mega';

/** One hull station: its position along the keel and its cross-section. */
interface Station {
  /** -1 = transom (stern), +1 = bow. */
  t: number;
  /** Half-beam at the deck. */
  beam: number;
  /** Depth below the waterline. */
  draft: number;
  /** Deck height above the waterline. */
  freeboard: number;
  /** 0 = slab sides, 1 = strong flare. */
  flare: number;
}

/**
 * Station table — the lines plan.
 *
 * Fine entry at the bow (narrow, deep, heavily flared), maximum beam slightly
 * aft of midships, and a broad flat transom. That distribution is what makes a
 * hull read as a fast displacement yacht rather than a barge.
 */
const STATIONS: Station[] = [
  { t: -1.00, beam: 0.82, draft: 0.16, freeboard: 0.34, flare: 0.10 },
  { t: -0.80, beam: 0.92, draft: 0.26, freeboard: 0.36, flare: 0.15 },
  { t: -0.50, beam: 1.00, draft: 0.32, freeboard: 0.38, flare: 0.20 },
  { t: -0.15, beam: 1.00, draft: 0.34, freeboard: 0.40, flare: 0.26 },
  { t: 0.20, beam: 0.94, draft: 0.33, freeboard: 0.44, flare: 0.34 },
  { t: 0.52, beam: 0.78, draft: 0.30, freeboard: 0.50, flare: 0.46 },
  { t: 0.76, beam: 0.54, draft: 0.25, freeboard: 0.58, flare: 0.60 },
  { t: 0.90, beam: 0.30, draft: 0.18, freeboard: 0.66, flare: 0.72 },
  { t: 1.00, beam: 0.05, draft: 0.06, freeboard: 0.76, flare: 0.80 },
];

/** Vertical samples per station, deck edge down to keel. */
const RIB = 7;

/** Loft the station table into a hull shell. */
function buildHull(length: number, beamScale: number): MeshData {
  const cols = STATIONS.length;
  const positions = new Float32Array(cols * RIB * 3);
  let p = 0;

  for (const s of STATIONS) {
    const x = s.t * length;
    for (let k = 0; k < RIB; k++) {
      const v = k / (RIB - 1); // 0 at deck edge, 1 at keel
      // Half-beam falls off toward the keel; `flare` bends the curve outward
      // near the deck, which is what gives a hull its shoulder.
      const shape = Math.pow(1 - v, 0.55 + s.flare * 0.75);
      const halfBeam = s.beam * beamScale * shape;
      const y = s.freeboard - v * (s.freeboard + s.draft);
      positions[p] = x;
      positions[p + 1] = y;
      positions[p + 2] = halfBeam;
      p += 3;
    }
  }

  // Mirror to the port side and stitch.
  const half = cols * RIB;
  const allPositions = new Float32Array(half * 2 * 3);
  allPositions.set(positions, 0);
  for (let i = 0; i < half; i++) {
    allPositions[(half + i) * 3] = positions[i * 3];
    allPositions[(half + i) * 3 + 1] = positions[i * 3 + 1];
    allPositions[(half + i) * 3 + 2] = -positions[i * 3 + 2];
  }

  const tris: number[] = [];
  const quad = (a: number, b: number, c: number, d: number) => { tris.push(a, b, c, a, c, d); };
  for (let i = 0; i < cols - 1; i++) {
    for (let k = 0; k < RIB - 1; k++) {
      const a = i * RIB + k;
      const b = (i + 1) * RIB + k;
      quad(a, a + 1, b + 1, b);
      quad(half + b, half + b + 1, half + a + 1, half + a);
    }
    // Close the keel line between the two halves.
    const keelA = i * RIB + RIB - 1;
    const keelB = (i + 1) * RIB + RIB - 1;
    quad(keelA, keelB, half + keelB, half + keelA);
  }
  // Transom.
  for (let k = 0; k < RIB - 1; k++) {
    quad(k, half + k, half + k + 1, k + 1);
  }

  const indices = new Uint32Array(tris);
  const normals = new Float32Array(allPositions.length);
  computeNormals(allPositions, indices, normals);
  return { positions: allPositions, normals, indices };
}

/** Flat main deck, so the hull is not an open trough from above. */
function buildDeck(length: number, beamScale: number): MeshData {
  const cols = STATIONS.length;
  const positions = new Float32Array(cols * 2 * 3);
  for (let i = 0; i < cols; i++) {
    const s = STATIONS[i];
    positions[i * 6] = s.t * length;
    positions[i * 6 + 1] = s.freeboard;
    positions[i * 6 + 2] = s.beam * beamScale;
    positions[i * 6 + 3] = s.t * length;
    positions[i * 6 + 4] = s.freeboard;
    positions[i * 6 + 5] = -s.beam * beamScale;
  }
  const tris: number[] = [];
  for (let i = 0; i < cols - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
    tris.push(a, c, d, a, d, b);
  }
  const indices = new Uint32Array(tris);
  const normals = new Float32Array(positions.length);
  computeNormals(positions, indices, normals);
  return { positions, normals, indices };
}

export function buildYachtModel(scaleKind: YachtScale = 'luxury'): ProceduralModel {
  const mega = scaleKind === 'mega';
  const length = mega ? 4.6 : 3.4;
  const beamScale = mega ? 1.0 : 0.88;
  const decks = mega ? 3 : 2;

  const parts: ModelPart[] = [];

  parts.push({
    name: 'hull',
    mesh: buildHull(length, beamScale),
    // White topsides, not the reference's navy. The reference is shot in
    // daylight; this renders on the app's near-black surface, where a #1B2740
    // hull read as a shadow with only the superstructure visible. A white hull
    // is also the more common superyacht livery, so nothing is lost.
    material: { color: '#E8ECF1', roughness: 0.26, metalness: 0.08, clearcoat: 0.8 },
  });
  parts.push({
    name: 'deck',
    mesh: buildDeck(length, beamScale),
    material: { color: '#C4A87C', roughness: 0.75, metalness: 0 },
  });

  // Superstructure: stepped decks, each shorter and narrower, set aft of the bow
  // as on a real motor yacht.
  for (let d = 0; d < decks; d++) {
    const w = beamScale * (1.5 - d * 0.26);
    const len = length * (0.86 - d * 0.16);
    const h = 0.34;
    const y = 0.40 + h * (d + 0.5);
    const superstructure = box(len, h, w);
    translate(superstructure, -length * 0.10 - d * length * 0.05, y, 0);
    parts.push({
      name: `deck${d}`,
      mesh: superstructure,
      material: { color: '#F0F2F5', roughness: 0.30, metalness: 0.05, clearcoat: 0.6 },
    });

    // Continuous window band — one dark strip per deck, which is most of what
    // reads as "superyacht" at a glance.
    const glass = box(len * 0.92, 0.12, w * 1.01);
    translate(glass, -length * 0.10 - d * length * 0.05, y + 0.04, 0);
    parts.push({
      name: `glass${d}`,
      mesh: glass,
      material: { color: '#0B1622', roughness: 0.06, metalness: 0.2, opacity: 0.85 },
    });
  }

  // Radar mast.
  const mast = box(0.10, 0.55, 0.10);
  translate(mast, -length * 0.24, 0.42 + 0.34 * decks + 0.24, 0);
  parts.push({ name: 'mast', mesh: mast, material: { color: '#E7EAEE', roughness: 0.35, metalness: 0.4 } });

  const all = merge(parts.map((p) => p.mesh));
  return {
    parts,
    radius: boundingRadius(all),
    defaultPitch: -0.22,
    fidelity:
      'Lofted hull from a real station table; superstructure is stepped blocks, ' +
      'not compound-curved glasshouse. No railings, tenders or mast detail.',
  };
}
