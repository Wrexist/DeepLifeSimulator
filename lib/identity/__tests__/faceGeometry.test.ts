/**
 * Geometric invariants for the procedural head.
 *
 * ## Why these and not more "is it finite" tests
 *
 * `headMesh.test.ts` already asserts that the buffers are watertight, symmetric,
 * free of NaN and responsive to every morph, and all of that passed while the
 * head rendered with hair growing out of its eyebrows, twenty-four haircuts that
 * were the same haircut, and two eyeballs buried so deep that no white was
 * visible on any face. None of those defects violates a numeric property.
 *
 * What they DO violate is a spatial relationship that can be stated: hair is
 * above the brow, hair is not on the face, the eye shows through its socket, the
 * opening is wider than it is tall. Each test here is one defect that shipped,
 * written so it fails on the geometry that produced it.
 */
import {
  buildHairMesh,
  buildHeadMesh,
  eyePlacement,
  missingHairSpecs,
  hairSpecFor,
  neutralMorphs,
  randomizeFace,
  HAIR_STYLES,
  type MeshData,
} from '@/lib/identity';

const neutral = { ...randomizeFace('geom'), morphs: neutralMorphs() };

/**
 * Front-most surface z directly above (x, y), by intersecting the triangles.
 *
 * Deliberately not a vertex search. The first version of this test sampled the
 * nearest vertices inside a small box and returned -Infinity when the box
 * happened to be empty — which the caller then read as "the eyeball is in
 * front", so the test passed on a head whose eyes were completely buried. A
 * measurement with holes in it is worse than no measurement, because it reports
 * success.
 */
function surfaceZAt(mesh: MeshData, x: number, y: number): number {
  const p = mesh.positions;
  const ix = mesh.indices;
  let best = -Infinity;
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
    const ax = p[a], ay = p[a + 1], bx = p[b], by = p[b + 1], cx = p[c], cy = p[c + 1];
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (d === 0) continue;
    const w0 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d;
    const w1 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
    if (w0 < 0 || w1 < 0 || w0 + w1 > 1) continue;
    const z = w0 * p[a + 2] + w1 * p[b + 2] + (1 - w0 - w1) * p[c + 2];
    if (z > best) best = z;
  }
  return best;
}

/** How far the eyeball shows before the skin closes over it, in radii. */
function aperture(mesh: MeshData, e: { x: number; y: number; z: number; radius: number }) {
  const visible = (dx: number, dy: number): boolean => {
    const rr = e.radius ** 2 - dx * dx - dy * dy;
    return rr > 0 && e.z + Math.sqrt(rr) > surfaceZAt(mesh, e.x + dx, e.y + dy);
  };
  const edge = (ux: number, uy: number): number => {
    let last = 0;
    for (let k = 0.05; k <= 1; k += 0.05) {
      if (!visible(e.radius * k * ux, e.radius * k * uy)) break;
      last = k;
    }
    return last;
  };
  return {
    centre: visible(0, 0),
    up: edge(0, 1), down: edge(0, -1),
    lateral: edge(1, 0), medial: edge(-1, 0),
  };
}

describe('hair spec table', () => {
  it('covers every style in HAIR_STYLES', () => {
    // The check that was missing. The renderer's table had all thirty-four
    // styles and the procedural head's had eleven; the rest fell through to
    // `short`, so a quarter of the wardrobe was one haircut.
    expect(missingHairSpecs()).toEqual([]);
  });

  it('has no spec for bald, and none for an unknown style', () => {
    expect(hairSpecFor('bald')).toBeNull();
    expect(hairSpecFor('not-a-style')).toBeNull();
  });

  it('gives the styles distinguishable shapes', () => {
    // Distinct `low` values alone would let two styles differ by a number and
    // still render identically, so compare the whole parameter vector.
    const shapes = new Set(
      HAIR_STYLES.filter((s) => s !== 'bald').map((s) => JSON.stringify(hairSpecFor(s))),
    );
    expect(shapes.size).toBe(HAIR_STYLES.length - 1);
  });
});

describe('hair placement', () => {
  const head = buildHeadMesh(neutral, { age: 28 });
  const lm = head.landmarks!;

  it.each(HAIR_STYLES.filter((s) => s !== 'bald'))('%s does not grow on the face', (style) => {
    const hair = buildHairMesh(head, style, 28)!;
    expect(hair).not.toBeNull();

    // The face: forward-facing, below the brow. Nothing here should carry hair,
    // whatever the style's length. The bug this catches rendered `long`, `bob`,
    // `layered`, `bowl`, `ponytail` and `bun` as a brown mask over the eyes and
    // cheeks, because the hair's descent below the hairline was a constant rate
    // and the forehead is below the hairline.
    let worst = 0;
    const p = head.positions;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i + 1] > lm.browY - 0.02) continue;
      if (p[i + 2] < 0.55) continue;
      worst = Math.max(worst, hair.coverage![i / 3]);
    }
    expect(worst).toBeLessThan(0.05);
  });

  it.each(HAIR_STYLES.filter((s) => s !== 'bald'))(
    '%s leaves a forehead between the brow and the hairline',
    (style) => {
      // The hairline used to be an absolute y of 0.34, against a brow ridge at
      // 0.30 on a head 1.5 tall: four hundredths of forehead, so the hair grew
      // out of the eyebrows.
      //
      // Measured at coverage 0.1 rather than 0.5 — the renderer starts fading
      // hair in at 0.06, so the lowest VISIBLE strand is what a player sees,
      // and a threshold of 0.5 is loose enough to let the original defect back
      // in. Every style currently clears 0.44 of the cranium.
      const hair = buildHairMesh(head, style, 28)!;
      const p = head.positions;
      let lowest = Infinity;
      for (let i = 0; i < p.length; i += 3) {
        if (p[i + 2] < 0.6) continue;
        if (hair.coverage![i / 3] < 0.1) continue;
        lowest = Math.min(lowest, p[i + 1]);
      }
      expect((lowest - lm.browY) / (lm.crownY - lm.browY)).toBeGreaterThan(0.3);
    },
  );
});

describe('eye seating', () => {
  // There is no eyelid geometry: the skin is one closed surface, so the lids
  // ARE wherever it passes in front of the globe. That makes the eye's whole
  // appearance a consequence of how the socket and the ball are sized against
  // each other, and it has failed in both directions.
  //
  // Too deep or too far back and the ball vanishes — the shipped version seated
  // it a full radius behind the socket floor, so no white was visible on any
  // face and what showed was a speck of iris. Too shallow, or a socket as tall
  // as the ball, and nothing ever crosses it: a white sphere stuck to a cheek.
  //
  // Both look fine in the numbers. The aperture is the thing to assert.
  const cases: [string, ReturnType<typeof randomizeFace>][] = [
    ['neutral', neutral],
    ...[0, 1, 2, 3, 4, 5].map(
      (i) => [`spread-${i}`, randomizeFace(`eye${i}`, { spread: 1 })] as
        [string, ReturnType<typeof randomizeFace>],
    ),
  ];

  it.each(cases)('opens as an almond on %s', (_name, g) => {
    const head = buildHeadMesh(g, { age: 30 });
    const a = aperture(head, eyePlacement(head, g, 30).left);

    expect(a.centre).toBe(true);
    // Open enough to read as an eye rather than a pinhole...
    expect(a.up + a.down).toBeGreaterThan(0.3);
    // ...and closed by the skin well inside the globe, or it is a bare ball.
    expect(a.up).toBeLessThan(0.7);
    expect(a.down).toBeLessThan(0.7);
    // Wider than tall, which is what makes it an eye shape and not a circle.
    expect((a.lateral + a.medial) / (a.up + a.down)).toBeGreaterThan(1.15);
  });
});
