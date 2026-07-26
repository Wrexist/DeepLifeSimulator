/**
 * Museum-grade diamond — a round brilliant cut, built to real proportions.
 *
 * Reconstructed from `assets/images/luxury/museum_diamond.jpg`: a round
 * brilliant on a polished black stone plinth, lit from above against a dark
 * background.
 *
 * ## Why this object is the best possible procedural subject
 *
 * The round brilliant is not an artistic shape — it is a SPECIFICATION. The
 * Tolkowsky/GIA "ideal" proportions below are published numbers, so the geometry
 * here is not an approximation of the reference photo; it is the same cut the
 * photo shows, generated from its own definition. Every facet lands where a real
 * one does.
 *
 * That also means it needs no texture and no reference projection, which is the
 * usual fidelity lever for procedural reconstruction. The stone's entire
 * appearance is geometry plus a refractive material.
 *
 * ## Facet inventory (58, the standard count)
 *
 *   table            1   the flat octagonal top
 *   crown bezels     8   kite facets from table edge to girdle
 *   crown stars      8   triangles between table edge and bezel peaks
 *   upper girdles   16   pairs meeting the girdle between bezels
 *   girdle          16   the thin vertical band
 *   pavilion mains   8   long facets from girdle to culet
 *   lower girdles   16   pairs flanking each main
 *   culet            1   (modelled as a point — modern cuts are pointed)
 *
 * ## Flat shading is mandatory
 *
 * `flatShade` is applied at the end. Smooth normals would average the facets
 * into a continuous dome and the stone would read as a glass pebble — a
 * brilliant cut IS its edges, and every highlight the eye reads as "sparkle" is
 * a facet boundary catching the light.
 */

import {
  boundingRadius,
  computeNormals,
  flatShade,
  lathe,
  merge,
  translate,
  type MeshData,
} from '@/lib/geometry/mesh';
import type { ProceduralModel } from './types';

/**
 * GIA "excellent" round brilliant proportions, as fractions of girdle diameter.
 * These are real published values, not tuned-by-eye numbers.
 */
const CUT = {
  /** Table width / girdle diameter. */
  table: 0.56,
  /** Crown height / girdle diameter. */
  crownHeight: 0.162,
  /** Girdle band thickness / girdle diameter. */
  girdle: 0.030,
  /** Pavilion depth / girdle diameter. */
  pavilionDepth: 0.431,
  /** How far up the crown the bezel peaks sit, relative to crown height. */
  starRatio: 0.55,
  /** How far down the pavilion the lower-girdle facets reach. */
  lowerGirdleRatio: 0.78,
} as const;

/**
 * Build the stone.
 *
 * Vertices are laid out as explicit facet rings rather than lathed, because a
 * brilliant is an 8-fold POLYHEDRON, not a surface of revolution: the girdle
 * scallops up and down between bezel and upper-girdle facets, which a lathe
 * cannot express.
 */
export function buildDiamondMesh(): MeshData {
  const R = 1; // girdle RADIUS; the whole stone is normalized to this
  // Every CUT figure is a fraction of girdle DIAMETER, so vertical dimensions
  // scale by D, not R. The first pass used R for the heights and produced a
  // stone exactly half as deep as a real one — it rendered as a flat lens with
  // no pavilion to speak of, which is the single most recognisable thing about
  // a brilliant cut.
  //
  // The table is the exception and correctly uses R: table WIDTH is 0.56 * D,
  // so the table RADIUS is 0.56 * R.
  const D = R * 2;
  const tableR = R * CUT.table;
  const crownY = D * CUT.crownHeight;
  const girdleTop = 0;
  const girdleBot = -D * CUT.girdle;
  const culetY = girdleBot - D * CUT.pavilionDepth;

  const positions: number[] = [];
  const tris: number[] = [];
  const push = (x: number, y: number, z: number): number => {
    positions.push(x, y, z);
    return positions.length / 3 - 1;
  };

  // --- Ring definitions ---------------------------------------------------
  // 8-fold symmetry. "main" directions carry the bezels and pavilion mains;
  // "between" directions sit halfway and carry the star/girdle scallops.
  const MAIN = 8;
  const mainAngle = (i: number) => (i / MAIN) * Math.PI * 2;
  const betweenAngle = (i: number) => ((i + 0.5) / MAIN) * Math.PI * 2;

  // Table octagon.
  const table: number[] = [];
  for (let i = 0; i < MAIN; i++) {
    const a = mainAngle(i);
    table.push(push(tableR * Math.sin(a), crownY, tableR * Math.cos(a)));
  }

  // Bezel peaks — partway down the crown, on the "between" directions, so each
  // bezel is a kite spanning from a table EDGE down to the girdle.
  const starY = crownY * (1 - CUT.starRatio);
  const starR = tableR + (R - tableR) * CUT.starRatio * 0.9;
  const stars: number[] = [];
  for (let i = 0; i < MAIN; i++) {
    const a = betweenAngle(i);
    stars.push(push(starR * Math.sin(a), starY, starR * Math.cos(a)));
  }

  // Girdle. Scalloped: slightly higher under a bezel, lower between them. The
  // scallop is what makes a real girdle read as a wavy band rather than a
  // cylinder, and it is visible in the reference photo.
  const girdleUpper: number[] = [];
  const girdleLower: number[] = [];
  const SCALLOP = D * 0.012;
  for (let i = 0; i < MAIN * 2; i++) {
    const a = (i / (MAIN * 2)) * Math.PI * 2;
    const onMain = i % 2 === 0;
    const yTop = girdleTop + (onMain ? SCALLOP : -SCALLOP * 0.4);
    const yBot = girdleBot + (onMain ? SCALLOP : -SCALLOP * 0.4);
    girdleUpper.push(push(R * Math.sin(a), yTop, R * Math.cos(a)));
    girdleLower.push(push(R * Math.sin(a), yBot, R * Math.cos(a)));
  }

  // Lower-girdle break points on the pavilion, between the mains.
  const lgY = girdleBot + (culetY - girdleBot) * CUT.lowerGirdleRatio;
  const lgR = R * (1 - CUT.lowerGirdleRatio) * 1.25;
  const lowers: number[] = [];
  for (let i = 0; i < MAIN; i++) {
    const a = betweenAngle(i);
    lowers.push(push(lgR * Math.sin(a), lgY, lgR * Math.cos(a)));
  }

  const culet = push(0, culetY, 0);

  // --- Crown ---------------------------------------------------------------
  // Table face, as a fan.
  for (let i = 1; i < MAIN - 1; i++) tris.push(table[0], table[i], table[i + 1]);

  for (let i = 0; i < MAIN; i++) {
    const next = (i + 1) % MAIN;
    // Star facet: table edge + the bezel peak between them.
    tris.push(table[i], stars[i], table[next]);
    // Bezel (kite): from the bezel peak down to the girdle main point.
    const gMain = girdleUpper[(i * 2 + 2) % (MAIN * 2)];
    tris.push(stars[i], gMain, table[next]);
    tris.push(stars[i], girdleUpper[(i * 2 + 1) % (MAIN * 2)], gMain);
    // Upper-girdle facets, flanking the bezel.
    tris.push(table[i], girdleUpper[(i * 2) % (MAIN * 2)], stars[i]);
    tris.push(stars[i], girdleUpper[(i * 2) % (MAIN * 2)], girdleUpper[(i * 2 + 1) % (MAIN * 2)]);
  }

  // --- Girdle band ---------------------------------------------------------
  for (let i = 0; i < MAIN * 2; i++) {
    const n = (i + 1) % (MAIN * 2);
    tris.push(girdleUpper[i], girdleLower[i], girdleUpper[n]);
    tris.push(girdleLower[i], girdleLower[n], girdleUpper[n]);
  }

  // --- Pavilion ------------------------------------------------------------
  for (let i = 0; i < MAIN; i++) {
    const gA = girdleLower[(i * 2) % (MAIN * 2)];
    const gB = girdleLower[(i * 2 + 1) % (MAIN * 2)];
    const gC = girdleLower[(i * 2 + 2) % (MAIN * 2)];
    // Two lower-girdle facets down to the break point.
    tris.push(gA, lowers[i], gB);
    tris.push(gB, lowers[i], gC);
    // Main pavilion facet from the break point to the culet.
    const prev = (i + MAIN - 1) % MAIN;
    tris.push(gA, lowers[prev], lowers[i]);
    tris.push(lowers[i], culet, lowers[prev]);
  }

  const pos = new Float32Array(positions);
  const idx = new Uint32Array(tris);
  const nrm = new Float32Array(pos.length);
  computeNormals(pos, idx, nrm);

  // Facet edges are the entire point — see the file header.
  return flatShade({ positions: pos, normals: nrm, indices: idx });
}

/** The polished stone plinth the reference photo stands the diamond on. */
function buildPlinth(radius: number): MeshData {
  const h = 0.18;
  return lathe(
    [
      { r: 0, y: -h },
      { r: radius * 0.98, y: -h },
      { r: radius, y: -h + 0.02 },
      { r: radius, y: -0.02 },
      { r: radius * 0.98, y: 0 },
      { r: 0, y: 0 },
    ],
    64,
  );
}

/**
 * The full showcase model.
 *
 * The stone is lifted so its culet just touches the plinth, matching the
 * reference — where the diamond sits point-down on the polished surface with
 * its dispersion scattering across it.
 */
export function buildDiamondModel(): ProceduralModel {
  const stone = buildDiamondMesh();
  // Lift so the culet rests exactly on the plinth top (y = 0). Same D-not-R
  // correction as above — this must track `buildDiamondMesh` or the stone
  // floats or sinks.
  const culetDrop = 2 * (CUT.girdle + CUT.pavilionDepth);
  translate(stone, 0, culetDrop, 0);

  const plinth = buildPlinth(1.35);

  return {
    parts: [
      {
        name: 'plinth',
        mesh: plinth,
        material: { color: '#14161C', roughness: 0.18, metalness: 0.35 },
      },
      {
        name: 'stone',
        mesh: stone,
        // High transmission + near-zero roughness is what makes it read as a
        // gemstone rather than frosted glass. `ior` 2.417 is diamond's real
        // refractive index — the reason a brilliant throws rainbows at all.
        material: {
          color: '#EAF2FF',
          roughness: 0.02,
          metalness: 0,
          opacity: 0.55,
          transmission: 0.92,
          ior: 2.417,
        },
      },
    ],
    radius: Math.max(boundingRadius(stone), boundingRadius(plinth)),
    // Slight downward tilt so the crown facets catch the key light, as in the
    // reference. A dead-level view flattens the whole stone.
    defaultPitch: -0.12,
  };
}

/** Re-exported for tests that want to assert the raw cut without the plinth. */
export { CUT as DIAMOND_CUT };

export function _mergeForTest(model: ProceduralModel): MeshData {
  return merge(model.parts.map((p) => p.mesh));
}
