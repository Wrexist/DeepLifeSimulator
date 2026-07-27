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
  eyeFrontAt,
  EYE_SHELLS,
  IRIS_SILHOUETTE,
  PUPIL_SILHOUETTE,
  missingHairSpecs,
  hairSpecFor,
  neutralMorphs,
  normalizeBody,
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
    const d = Math.sqrt(dx * dx + dy * dy);
    // Against `eyeFrontAt` and not against the sclera alone. The sclera vanishes
    // behind the cornea at the limbus, which is inside the lid margin on a
    // relaxed eye — measuring it reports the eye closing where the white ends.
    return d < e.radius
      && e.z + e.radius * eyeFrontAt(d / e.radius) > surfaceZAt(mesh, e.x + dx, e.y + dy);
  };
  // 0.02 rather than 0.05. The lid line is compared against the iris below, and
  // the two are a twentieth of a radius apart on a relaxed eye — a fifth-of-a-
  // radius ruler cannot see that at all.
  const edge = (ux: number, uy: number): number => {
    let last = 0;
    for (let k = 0.02; k < 1; k += 0.02) {
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
      let onFront = 0;
      let anywhere = 0;
      for (let i = 0; i < p.length; i += 3) {
        if (hair.coverage![i / 3] < 0.1) continue;
        anywhere++;
        if (p[i + 2] < 0.6) continue;
        onFront++;
        lowest = Math.min(lowest, p[i + 1]);
      }

      // THE GUARD THE `Infinity` WAS HIDING.
      //
      // `lowest` starts at Infinity, so a style with no qualifying vertex left
      // it there and the ratio below evaluated to `Infinity > 0.3` — a pass. It
      // was passing that way for `receding`, which puts zero vertices on the
      // front of this head. A wardrobe test written because a quarter of the
      // styles were secretly one style would have let a style that renders
      // NOTHING walk straight through.
      expect(anywhere).toBeGreaterThan(200);

      // No strand on the front of the head may sit below the hairline band.
      //
      // Conditional, and the condition is the finding rather than an escape:
      // `receding` has nothing on the front at all, which is what a receding
      // hairline is. That cannot mean "nothing rendered" here, because the count
      // above has already been asserted.
      if (onFront > 0) {
        expect((lowest - lm.browY) / (lm.crownY - lm.browY)).toBeGreaterThan(0.3);
      }
    },
  );
});

describe('the silhouette has a jaw', () => {
  // Every render of this head all session came out as an egg: the base
  // ellipsoid tapers smoothly from the cheekbones to a rounded point, and there
  // was no mandible in the neutral head at all — only morphs able to widen a jaw
  // that did not exist. At `jawAngle` = 0, where a neutral face and most random
  // faces sit, the silhouette had no corner anywhere.
  //
  // The test is a width profile down the face. An ellipsoid falls away
  // continuously; a head holds its width from the cheekbone down to the gonial
  // angle and only then turns in toward the chin.
  const head = buildHeadMesh(neutral, { age: 30 });
  const lm = head.landmarks!;
  const face = lm.browY - lm.chinY;

  /**
   * Widest half-width where the plane y = `y` cuts the SURFACE, by intersecting
   * the edges — not the widest vertex within a band of it.
   *
   * The band version measured the grid. Its answer moved with the band (0.37 at
   * ±0.03, 0.24 at ±0.015, 0.42 at ±0.008 for the ratio below) and with the
   * tessellation, because a max over a band is the widest point ANYWHERE in
   * that band and where the rows fall inside it decides which point that is.
   * Raising the mesh from 96 rings to 128 moved this test from passing to
   * failing without the head changing shape at all.
   */
  const halfWidthAt = (y: number): number => {
    const p = head.positions, ix = head.indices;
    let w = 0;
    for (let t = 0; t < ix.length; t += 3) {
      for (let k = 0; k < 3; k++) {
        const a = ix[t + k] * 3, b = ix[t + ((k + 1) % 3)] * 3;
        const ya = p[a + 1], yb = p[b + 1];
        if ((ya < y) === (yb < y)) continue;
        const s = (y - ya) / (yb - ya);
        w = Math.max(w, Math.abs(p[a] + (p[b] - p[a]) * s));
      }
    }
    return w;
  };

  it('plateaus along the jaw before turning in to the chin', () => {
    // The SHAPE, not a single ratio.
    //
    // A ratio of jaw width to cheekbone width was the first attempt and it is a
    // weak discriminator: the ellipsoid measures 0.822 and the head with a
    // mandible 0.866, so any threshold that separates them is a hair's breadth
    // wide and the test passed on the egg the moment the bound was relaxed.
    //
    // What actually distinguishes a jaw is that the width HOLDS along the body
    // of the mandible and only then turns toward the chin, where an ellipsoid
    // falls away steadily the whole time. Comparing the two falls measures that
    // directly: 0.20 with the mandible against 0.48 without.
    const w = (f: number) => halfWidthAt(lm.chinY + face * f);
    const alongJaw = w(0.40) - w(0.30);
    const intoChin = w(0.30) - w(0.20);
    expect(alongJaw / intoChin).toBeLessThan(0.35);
  });

  it('keeps the jaw inside the human range rather than squaring off', () => {
    // Bigonial over bizygomatic is about 0.80 to 0.85 on a real head. The first
    // pass came out at 0.92 and the adults rendered heavy and blocky, which is
    // what sent me back to the number.
    const cheek = halfWidthAt(lm.chinY + face * 0.55);
    const jaw = halfWidthAt(lm.chinY + face * 0.22);
    expect(jaw / cheek).toBeLessThan(0.90);
  });

  it('still narrows to a chin rather than staying square', () => {
    // The other failure mode. A jaw that holds its width all the way down is a
    // brick, and the fix for an egg is not a box.
    const jaw = halfWidthAt(lm.chinY + face * 0.22);
    const chin = halfWidthAt(lm.chinY + face * 0.02);
    expect(chin / jaw).toBeLessThan(0.85);
  });

  it('is widest across the cheekbones, not the cranium', () => {
    // A real head's widest point on the face is the zygomatic arch. If the
    // cranium wins, the silhouette is an egg however good the jaw is.
    const cheek = halfWidthAt(lm.chinY + face * 0.6);
    const upper = halfWidthAt(lm.browY + (lm.crownY - lm.browY) * 0.5);
    expect(cheek).toBeGreaterThan(upper);
  });
});

describe('eyebrows', () => {
  // The procedural head had none. The scanned head has brows painted into its
  // albedo and tinted by hair colour; this one was a flat material with no
  // shader patch at all, so every fallback face rendered with a bare brow ridge.
  // Eyebrows carry more identity than almost anything else on a face, and their
  // absence is most of why these heads read as unfinished rather than simple.
  const head = buildHeadMesh(neutral, { age: 30 });
  const lm = head.landmarks!;
  const brow = head.brow!;

  it('exists, one weight per vertex', () => {
    expect(brow).toBeDefined();
    expect(brow.length).toBe(head.positions.length / 3);
    expect(Math.max(...brow)).toBeGreaterThan(0.6);
  });

  it('leaves a gap at the glabella', () => {
    // Two brows, not a bar. The first version multiplied by a term that rose
    // toward the midline, meaning to thicken each brow at its inner end; what it
    // did was boost the overlap between the two blobs, fusing them into one
    // unbroken band. Every character had a monobrow.
    // Out to 0.11 either side of the midline, measured: the brow currently
    // reaches 0.03 at 0.09-0.12 and 0.28 by 0.12-0.15, so this has margin and
    // still fails on the parameters that produced the bar. A threshold tight
    // against the midline passes on a monobrow, because the blobs never reach
    // x = 0 even when they meet.
    let onMidline = 0;
    for (let i = 0; i < brow.length; i++) {
      if (Math.abs(head.positions[i * 3]) < 0.11) onMidline = Math.max(onMidline, brow[i]);
    }
    expect(onMidline).toBeLessThan(0.10);
  });

  it('sits between the eye and the crown, on the front of the head', () => {
    for (let i = 0; i < brow.length; i++) {
      if (brow[i] < 0.2) continue;
      const y = head.positions[i * 3 + 1];
      const z = head.positions[i * 3 + 2];
      expect(y).toBeGreaterThan(lm.eyeY);
      expect(y).toBeLessThan(lm.crownY);
      expect(z).toBeGreaterThan(0);
    }
  });

  it('is symmetric', () => {
    let left = 0;
    let right = 0;
    for (let i = 0; i < brow.length; i++) {
      if (head.positions[i * 3] > 0) left += brow[i];
      else if (head.positions[i * 3] < 0) right += brow[i];
    }
    expect(left).toBeCloseTo(right, 3);
  });
});

describe('every slider does something', () => {
  // A floor on how much each morph is allowed to matter.
  //
  // This is the generalisation of three separate defects — childhood aging, body
  // composition, and the fallback's hair table — that were each written,
  // reviewed, unit-tested and invisible. The shape was always the same: the code
  // existed and did its job, and the product of its coefficients came out to
  // nothing. No test looked at the product.
  //
  // Sweeping all twenty-four morphs found a fourth: `eyeTilt` moved exactly zero
  // vertices. `eyePlacement` computed a `tilt` and returned it, and neither
  // renderer read the value. The scanned rig HAS an `eyeTilt` target, so the
  // slider worked there and did nothing here — worse than not working, because
  // it looks fixed.
  //
  // MAX displacement, not mean. Mean is right for a whole-head morph and useless
  // for a local one: a nose morph moves 26 vertices out of 9409, so its mean is
  // indistinguishable from zero however strong it is where it acts.
  const sweep = (key: string): { max: number; moved: number } => {
    const lo = buildHeadMesh({ ...neutral, morphs: { ...neutral.morphs, [key]: 0 } }, { age: 30 });
    const hi = buildHeadMesh({ ...neutral, morphs: { ...neutral.morphs, [key]: 1 } }, { age: 30 });
    let max = 0;
    let moved = 0;
    for (let i = 0; i < lo.positions.length; i += 3) {
      const d = Math.hypot(
        lo.positions[i] - hi.positions[i],
        lo.positions[i + 1] - hi.positions[i + 1],
        lo.positions[i + 2] - hi.positions[i + 2],
      );
      if (d > 1e-6) moved++;
      if (d > max) max = d;
    }
    return { max, moved };
  };

  it.each(Object.keys(neutral.morphs))('%s moves the mesh across its range', (key) => {
    const { max, moved } = sweep(key);
    expect(moved).toBeGreaterThan(20);
    // 0.005 on a head 1.9 tall. Deliberately a low bar: this is here to catch a
    // slider that does NOTHING, not to police how strong each one should be.
    expect(max).toBeGreaterThan(0.005);
  });
});

describe('childhood proportions', () => {
  // A child is not a small adult, and the game rendered one for as long as
  // nobody put the ages side by side. `applyAging` moves eleven morphs for
  // childhood — shorter face, smaller nose, narrower jaw, bigger eyes — and ages
  // 4 through 80 still rendered as the same face at slightly different sizes.
  //
  // The measurement that shows it is the ratio of cranium to face. It read 0.630
  // at six and 0.670 at eighty: barely moving, and moving the wrong way. No
  // morph can express it, because `faceLength` scales the whole head, cranium
  // included — which makes a smaller adult.
  const ratio = (age: number): number => {
    const lm = buildHeadMesh(neutral, { age }).landmarks!;
    return (lm.crownY - lm.browY) / (lm.browY - lm.chinY);
  };

  it('shrinks the cranium relative to the face as a character grows up', () => {
    const young = ratio(4);
    const grown = ratio(25);
    // A four-year-old's neurocranium is near adult size while the face is around
    // 60% and still growing, so the ratio has to be substantially higher.
    expect(young / grown).toBeGreaterThan(1.3);
  });

  it('changes monotonically through childhood and settles at sixteen', () => {
    const ages = [2, 4, 6, 8, 10, 12, 14, 16];
    const values = ages.map(ratio);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThan(values[i - 1]);
    }
    // Growth stops, rather than continuing to run past adulthood.
    expect(ratio(16)).toBeCloseTo(ratio(25), 1);
  });

  it('moves the mesh enough to be seen', () => {
    // The original defect was visible only as "these all look the same", so the
    // guard is on how far the surface actually travels. It used to be 0.034 on a
    // head 1.5 tall — two percent, across a whole human lifetime.
    const a = buildHeadMesh(neutral, { age: 6 }).positions;
    const b = buildHeadMesh(neutral, { age: 80 }).positions;
    let sum = 0;
    for (let i = 0; i < a.length; i += 3) {
      sum += Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2]);
    }
    expect(sum / (a.length / 3)).toBeGreaterThan(0.10);
  });
});

describe('body composition on the face', () => {
  // The link that is supposed to make the body simulation visible. It was
  // measured at a mean vertex movement of 0.006 on a head 1.5 tall across the
  // entire range from 8% body fat to 55% — four tenths of one percent. A player
  // could gain thirty kilos and see nothing in the one place they look.
  //
  // Body fat reached the face only by adding 0.30 to `cheekFullness`, a value
  // then multiplied by 0.14. Nothing was wrong with any individual number; the
  // product of them was the defect, and no test looked at the product.
  const at = (bodyFatPct: number, muscle = 45) =>
    buildHeadMesh(neutral, { age: 30, body: normalizeBody({ bodyFatPct, muscle }) });

  const meanMove = (a: MeshData, b: MeshData): number => {
    let sum = 0;
    for (let i = 0; i < a.positions.length; i += 3) {
      sum += Math.hypot(
        a.positions[i] - b.positions[i],
        a.positions[i + 1] - b.positions[i + 1],
        a.positions[i + 2] - b.positions[i + 2],
      );
    }
    return sum / (a.positions.length / 3);
  };

  const halfWidth = (mesh: MeshData): number => {
    let w = 0;
    for (let i = 0; i < mesh.positions.length; i += 3) w = Math.max(w, Math.abs(mesh.positions[i]));
    return w;
  };

  it('moves the face visibly between lean and obese', () => {
    expect(meanMove(at(8), at(55))).toBeGreaterThan(0.02);
  });

  it('responds to muscle as well as fat', () => {
    expect(meanMove(at(22, 5), at(22, 95))).toBeGreaterThan(0.01);
  });

  it('gets wider with fat, not narrower', () => {
    // A magnitude test alone passes on a sign error. The face has to grow.
    expect(halfWidth(at(55))).toBeGreaterThan(halfWidth(at(8)));
  });

  it('changes monotonically across the range', () => {
    const lean = at(8);
    let previous = 0;
    for (const fat of [18, 28, 40, 55]) {
      const move = meanMove(lean, at(fat));
      expect(move).toBeGreaterThan(previous);
      previous = move;
    }
  });
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
  //
  // The socket is now cut as a copy of the globe rather than as a blob bowl, so
  // there is a third thing to assert and it is the one that makes the other two
  // stable: that the closed skin HUGS the ball. While it bridged over it, the
  // opening was where two unrelated curves crossed, every bound below was
  // satisfiable by a face nobody would recognise, and the size test failed at
  // three times over.
  const cases: [string, ReturnType<typeof randomizeFace>][] = [
    ['neutral', neutral],
    ...[0, 1, 2, 3, 4, 5].map(
      (i) => [`spread-${i}`, randomizeFace(`eye${i}`, { spread: 1 })] as
        [string, ReturnType<typeof randomizeFace>],
    ),
  ];

  // Ages as well as genomes. The childhood transform compresses the face toward
  // the brow, which squashes the carved socket with it — a 34% vertical
  // compression on an aperture only 0.05 tall is exactly the kind of thing that
  // closes an eye without anything else noticing.
  const aged: [string, ReturnType<typeof randomizeFace>, number][] = [
    ...cases.map(([n, g]) => [n, g, 30] as [string, ReturnType<typeof randomizeFace>, number]),
    ...[2, 6, 12, 16, 60, 90].map(
      (age) => [`age-${age}`, neutral, age] as [string, ReturnType<typeof randomizeFace>, number],
    ),
  ];

  it.each(cases)('is a believable size on %s', (_name, g) => {
    // THE RATIO NO OTHER TEST HERE CAN SEE.
    //
    // Every aperture assertion below is in multiples of the globe's radius, so
    // all of them are blind to the globe being the wrong size. It was: the eye
    // opening measured 6% of head width against a human 20%, and the faces
    // rendered with specks for eyes while passing every bound.
    //
    // Measured against head width because that is what a viewer compares it to.
    const head = buildHeadMesh(g, { age: 30 });
    const e = eyePlacement(head, g, 30).left;
    const visible = (dx: number): boolean => {
      const d = Math.abs(dx);
      return d < e.radius
        && e.z + e.radius * eyeFrontAt(d / e.radius) > surfaceZAt(head, e.x + dx, e.y);
    };
    const edge = (u: number): number => {
      let last = 0;
      for (let k = 0.02; k <= 1; k += 0.02) {
        if (!visible(e.radius * k * u)) break;
        last = k;
      }
      return last;
    };
    let halfWidth = 0;
    for (let i = 0; i < head.positions.length; i += 3) {
      halfWidth = Math.max(halfWidth, Math.abs(head.positions[i]));
    }
    const opening = (edge(1) + edge(-1)) * e.radius;
    // Bounded on BOTH sides. A human eye opening is about 0.20 of head width;
    // this was 0.073 with a floor of 0.068 under it, which is a floor placed
    // under the defect rather than above it. A ceiling matters just as much:
    // the failure at the other end is a lidless stare, and it is the one the
    // aperture bounds below cannot see because they are all in radii.
    expect(opening / (halfWidth * 2)).toBeGreaterThan(0.150);
    expect(opening / (halfWidth * 2)).toBeLessThan(0.240);
  });

  it('closes the skin onto the globe rather than across it', () => {
    // THE CONSTRUCTION, asserted directly.
    //
    // Above and below the fissure the skin has to lie just in FRONT of the ball
    // — following it, not bridging over it. That is what makes the opening a
    // property of the fissure's shape alone, and therefore the same on every
    // face; while the socket was a blob the skin stood a third of a radius
    // proud of the globe at the edges of the orbit, so the lid line was wherever
    // a bowl and a sphere happened to cross and no aperture could move it.
    const head = buildHeadMesh(neutral, { age: 30 });
    const e = eyePlacement(head, neutral, 30).left;
    // A sunflower spiral over the eye's disc, so the samples are spread evenly
    // rather than sitting on a ring chosen to miss the fissure. Which of them
    // are lid and which are opening is decided by MEASURING, not by a band
    // written to match the constants under test.
    //
    // Out to 0.72 of a radius and no further, which is a claim about anatomy
    // and not a fudge: past there the surface is climbing to the orbital rim,
    // and the top of the globe genuinely does sit deep behind the brow. What
    // has to hug the ball is the lid, and the lid runs from the margin — 0.36
    // above the axis and 0.48 below — out to about here.
    const N = 240;
    const closed: number[] = [];
    for (let i = 0; i < N; i++) {
      const a = i * 2.39996;
      const d = e.radius * 0.72 * Math.sqrt((i + 0.5) / N);
      const front = e.z + e.radius * eyeFrontAt(d / e.radius);
      const skin = surfaceZAt(head, e.x + d * Math.cos(a), e.y + d * Math.sin(a));
      if (front > skin) continue; // open here: this sample is the fissure
      closed.push(skin - front);
    }
    // A third of the samples are lid, which is enough to be worth asserting.
    expect(closed.length).toBeGreaterThan(60);
    // Closed ON the ball rather than bridged over it. The blob bowl stood a
    // third of a radius proud of the globe at the edges of the orbit, which is
    // what made the lid line a coincidence of two curves.
    for (const gap of closed) expect(gap).toBeLessThan(e.radius * 0.40);
  });

  it('shows an iris and a pupil of human size', () => {
    // The shells are CURVATURES: each is a whole sphere buried in the one behind
    // it, so what shows is the cap that pokes through. Read as sizes they gave
    // an iris of 0.19 of the globe against a human 0.49, and every rendered face
    // had a coloured speck in a field of white.
    //
    // Pure geometry, so this needs no mesh — which is the point. Nothing else
    // here could have caught it: the socket tests measure where the skin closes,
    // and the skin closed in exactly the right place over a dot.
    expect(IRIS_SILHOUETTE).toBeGreaterThan(0.44);
    expect(IRIS_SILHOUETTE).toBeLessThan(0.54);
    // A daylight pupil is 3-4 mm across on a 24 mm globe.
    expect(PUPIL_SILHOUETTE).toBeGreaterThan(0.08);
    expect(PUPIL_SILHOUETTE).toBeLessThan(0.20);
    // And each shell has to actually break the surface of the one behind it, or
    // it is invisible however well proportioned it is.
    expect(eyeFrontAt(0)).toBeGreaterThan(1);
    expect(EYE_SHELLS.pupilOffset + EYE_SHELLS.pupilRadius)
      .toBeGreaterThan(EYE_SHELLS.irisOffset + EYE_SHELLS.irisRadius);
  });

  it.each(aged)('opens as an almond on %s', (_name, g, age) => {
    const head = buildHeadMesh(g, { age });
    const a = aperture(head, eyePlacement(head, g, age).left);

    expect(a.centre).toBe(true);
    // Closed by the skin well inside the globe, or it is a bare ball.
    //
    // These were 0.7, which is not a bound at all: 0.7 of the radius either side
    // of centre is most of the sphere. The test passed on an eyeball standing
    // proud of the face with lids only at its edges, and it took rendering the
    // head with the app's OWN shaders to see that — at thumbnail size in the
    // software rasteriser it looked fine.
    expect(a.up).toBeLessThan(0.46);
    expect(a.down).toBeLessThan(0.58);
    // And bounded below one lid at a time rather than as a sum, which a squint
    // that opens on one lid only can satisfy.
    expect(a.up).toBeGreaterThan(0.28);
    expect(a.down).toBeGreaterThan(0.38);

    // WHERE THE LIDS SIT AGAINST THE IRIS, which is the arrangement that makes
    // an eye read as relaxed. The upper lid rests over the top of the iris and
    // the lower one sits level with its bottom; a fissure centred on the globe
    // instead puts the lower lid across the iris and every face squints.
    //
    // Both bounds carry a mesh row of tolerance, deliberately stated: at this
    // tessellation the lid line resolves to about 0.03 of a radius, and a
    // tighter claim would be asserting precision the surface does not have.
    expect(a.up).toBeLessThan(IRIS_SILHOUETTE);
    expect(a.down).toBeGreaterThan(IRIS_SILHOUETTE - 0.06);
    expect(a.down).toBeGreaterThan(a.up);

    // Out to most of the globe's silhouette sideways: the fissure is what should
    // stop the eye, and sideways it should not stop before the ball ends.
    expect(a.lateral).toBeGreaterThan(0.80);
    expect(a.medial).toBeGreaterThan(0.72);
    // Wider than tall, which is what makes it an eye shape and not a circle.
    // This was bounded at 1.15, which admits a keyhole.
    //
    // A human palpebral fissure is about 3:1, and this cannot reach that: the
    // 30 mm figure is measured canthus to canthus, and the canthi are on the
    // FACE, lateral to a globe only 24 mm across. What is measured here is the
    // eyeball's exposed disc, which the silhouette caps at 2:1 by width and the
    // lids cut to about 0.85 by height. The corners past the globe are carved
    // — the orbit runs out to 1.75 radii — but there is no eye behind them to
    // measure, so they are seen and not counted.
    const ratio = (a.lateral + a.medial) / (a.up + a.down);
    expect(ratio).toBeGreaterThan(1.85);
    expect(ratio).toBeLessThan(2.6);
  });
});
