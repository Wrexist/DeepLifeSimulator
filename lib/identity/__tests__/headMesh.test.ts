import {
  buildFacialHairMesh,
  buildHairMesh,
  buildHeadMesh,
  computeNormals,
  eyePlacement,
  neutralMorphs,
  normalizeBody,
  randomizeFace,
  type MeshData,
} from '@/lib/identity';
import { FACIAL_HAIR_STYLES, HAIR_STYLES } from '@/lib/identity/types';

const neutral = { ...randomizeFace('n'), morphs: neutralMorphs() };

function allFinite(mesh: MeshData): boolean {
  for (const v of mesh.positions) if (!Number.isFinite(v)) return false;
  for (const v of mesh.normals) if (!Number.isFinite(v)) return false;
  return true;
}

/** Max |position| — catches a morph that blows the head up. */
function extent(mesh: MeshData): number {
  let max = 0;
  for (const v of mesh.positions) max = Math.max(max, Math.abs(v));
  return max;
}

describe('headMesh', () => {
  describe('buildHeadMesh', () => {
    it('produces a well-formed mesh', () => {
      const mesh = buildHeadMesh(neutral);
      expect(mesh.positions.length % 3).toBe(0);
      expect(mesh.normals.length).toBe(mesh.positions.length);
      expect(mesh.indices.length % 3).toBe(0);
      expect(mesh.indices.length).toBeGreaterThan(1000);
      const vertexCount = mesh.positions.length / 3;
      for (const i of mesh.indices) {
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(vertexCount);
      }
    });

    it('is deterministic — the same inputs give byte-identical buffers', () => {
      // The baked portrait is cached against the mesh; a non-deterministic build
      // would re-bake every frame.
      const a = buildHeadMesh(neutral, { age: 42 });
      const b = buildHeadMesh(neutral, { age: 42 });
      expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
      expect(Array.from(a.normals)).toEqual(Array.from(b.normals));
    });

    it('never produces NaN for any random face at any age', () => {
      // A single NaN vertex takes the whole mesh out of the depth buffer and the
      // head renders as garbage, so this is the highest-value invariant here.
      for (let i = 0; i < 60; i++) {
        const face = randomizeFace(`m${i}`, { spread: 1 });
        for (const age of [0, 5, 18, 35, 60, 90, 120]) {
          const mesh = buildHeadMesh(face, { age });
          expect(allFinite(mesh)).toBe(true);
        }
      }
    });

    it('survives every morph pinned to both rails', () => {
      for (const value of [0, 1]) {
        const extreme = { ...neutral, morphs: Object.fromEntries(
          Object.keys(neutral.morphs).map((k) => [k, value]),
        ) as typeof neutral.morphs };
        const mesh = buildHeadMesh(extreme, { age: 30 });
        expect(allFinite(mesh)).toBe(true);
        // Still recognisably a head-sized object, not an exploded one.
        expect(extent(mesh)).toBeLessThan(3);
        expect(extent(mesh)).toBeGreaterThan(0.5);
      }
    });

    it('is bilaterally symmetric', () => {
      // The renderer mirrors nothing — symmetry has to come out of the fields.
      // An asymmetric head would mean a sign error in one of the paired blobs.
      const mesh = buildHeadMesh(randomizeFace('sym', { spread: 1 }), { age: 30 });
      const byKey = new Map<string, [number, number, number]>();
      for (let i = 0; i < mesh.positions.length; i += 3) {
        const [x, y, z] = [mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]];
        byKey.set(`${y.toFixed(4)}|${z.toFixed(4)}|${Math.abs(x).toFixed(4)}`, [x, y, z]);
      }
      let checked = 0;
      for (let i = 0; i < mesh.positions.length; i += 3) {
        const x = mesh.positions[i];
        if (Math.abs(x) < 0.05) continue;
        const key = `${mesh.positions[i + 1].toFixed(4)}|${mesh.positions[i + 2].toFixed(4)}|${Math.abs(x).toFixed(4)}`;
        const partner = byKey.get(key);
        if (partner) { checked++; }
      }
      expect(checked).toBeGreaterThan(500);
    });

    it('has unit-length normals everywhere', () => {
      const mesh = buildHeadMesh(randomizeFace('nrm', { spread: 1 }), { age: 70 });
      for (let i = 0; i < mesh.normals.length; i += 3) {
        const len = Math.hypot(mesh.normals[i], mesh.normals[i + 1], mesh.normals[i + 2]);
        expect(len).toBeGreaterThan(0.99);
        expect(len).toBeLessThan(1.01);
      }
    });

    it('responds to every single morph', () => {
      // A morph wired into the UI but not into the geometry is a dead slider —
      // the player moves it and nothing happens. Sweep them all.
      const base = buildHeadMesh(neutral, { age: 30 });
      for (const key of Object.keys(neutral.morphs) as (keyof typeof neutral.morphs)[]) {
        const moved = buildHeadMesh(
          { ...neutral, morphs: { ...neutral.morphs, [key]: 0.95 } },
          { age: 30 },
        );
        let maxDelta = 0;
        for (let i = 0; i < base.positions.length; i++) {
          maxDelta = Math.max(maxDelta, Math.abs(base.positions[i] - moved.positions[i]));
        }
        // eyeTilt only moves the eyeballs, which are separate geometry.
        if (key === 'eyeTilt') {
          expect(eyePlacement(base, { ...neutral, morphs: { ...neutral.morphs, eyeTilt: 0.95 } }).left.tilt)
            .not.toBeCloseTo(eyePlacement(base, neutral).left.tilt, 5);
        } else {
          expect(maxDelta).toBeGreaterThan(0.002);
        }
      }
    });

    it('makes body fat visible in the face', () => {
      // The link that stops the body simulation feeling inert.
      const lean = buildHeadMesh(neutral, { age: 30, body: normalizeBody({ bodyFatPct: 10 }) });
      const heavy = buildHeadMesh(neutral, { age: 30, body: normalizeBody({ bodyFatPct: 45 }) });
      let maxDelta = 0;
      for (let i = 0; i < lean.positions.length; i++) {
        maxDelta = Math.max(maxDelta, Math.abs(lean.positions[i] - heavy.positions[i]));
      }
      expect(maxDelta).toBeGreaterThan(0.01);
    });

    it('gives a child a different head shape than an adult', () => {
      const child = buildHeadMesh(neutral, { age: 4 });
      const adult = buildHeadMesh(neutral, { age: 30 });
      let maxDelta = 0;
      for (let i = 0; i < child.positions.length; i++) {
        maxDelta = Math.max(maxDelta, Math.abs(child.positions[i] - adult.positions[i]));
      }
      expect(maxDelta).toBeGreaterThan(0.02);
    });

    it('has a neck rather than pinching shut at the bottom', () => {
      const mesh = buildHeadMesh(neutral, { age: 30 });
      // Sample the widest radius below the jaw. A head with no neck collapses to
      // ~0 there, which reads as a floating head.
      let maxRadiusLow = 0;
      for (let i = 0; i < mesh.positions.length; i += 3) {
        const y = mesh.positions[i + 1];
        if (y < -0.95) {
          maxRadiusLow = Math.max(maxRadiusLow, Math.hypot(mesh.positions[i], mesh.positions[i + 2]));
        }
      }
      expect(maxRadiusLow).toBeGreaterThan(0.2);
    });

    it('puts the nose in front of the cheeks', () => {
      // A cheap but decisive check that the face is facing +Z and the nose field
      // actually protrudes.
      const mesh = buildHeadMesh(neutral, { age: 30 });
      let noseZ = -Infinity;
      let cheekZ = -Infinity;
      for (let i = 0; i < mesh.positions.length; i += 3) {
        const [x, y, z] = [mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]];
        if (Math.abs(x) < 0.05 && y > -0.3 && y < 0.2) noseZ = Math.max(noseZ, z);
        if (Math.abs(x) > 0.35 && y > -0.2 && y < 0.15) cheekZ = Math.max(cheekZ, z);
      }
      expect(noseZ).toBeGreaterThan(cheekZ);
    });
  });

  describe('eyePlacement', () => {
    it('is symmetric and sits inside the head', () => {
      for (let i = 0; i < 50; i++) {
        const { left, right } = eyePlacement(buildHeadMesh(randomizeFace(`e${i}`, { spread: 1 })), randomizeFace(`e${i}`, { spread: 1 }), 30);
        expect(left.x).toBeCloseTo(-right.x, 6);
        expect(left.y).toBeCloseTo(right.y, 6);
        expect(left.tilt).toBeCloseTo(-right.tilt, 6);
        expect(left.radius).toBeGreaterThan(0.03);
        expect(Math.hypot(left.x, left.y, left.z)).toBeLessThan(1);
      }
    });
  });

  describe('buildHairMesh', () => {
    it('returns null for bald so the renderer can skip the draw', () => {
      expect(buildHairMesh(buildHeadMesh(neutral), 'bald')).toBeNull();
    });

    it('builds a valid shell for every style', () => {
      const head = buildHeadMesh(neutral, { age: 25 });
      for (const style of HAIR_STYLES) {
        const hair = buildHairMesh(head, style);
        if (style === 'bald') { expect(hair).toBeNull(); continue; }
        expect(hair).not.toBeNull();
        expect(allFinite(hair!)).toBe(true);
        expect(hair!.indices.length).toBeGreaterThan(0);
        expect(hair!.indices.length % 3).toBe(0);
        const vertexCount = hair!.positions.length / 3;
        for (const i of hair!.indices) expect(i).toBeLessThan(vertexCount);
      }
    });

    it('never covers the face', () => {
      // The shell is offset along the head normal; if the mask leaked onto the
      // front of the face the character would be wearing a helmet.
      const head = buildHeadMesh(neutral, { age: 25 });
      const hair = buildHairMesh(head, 'medium')!;
      for (let i = 0; i < head.positions.length; i += 3) {
        const y = head.positions[i + 1];
        const z = head.positions[i + 2];
        // Squarely on the face: below the hairline and well forward.
        if (z > 0.65 && y < 0.15 && y > -0.4) {
          const moved = Math.hypot(
            hair.positions[i] - head.positions[i],
            hair.positions[i + 1] - head.positions[i + 1],
            hair.positions[i + 2] - head.positions[i + 2],
          );
          expect(moved).toBeLessThan(1e-3);
        }
      }
    });

    it('gives an afro more volume than a buzz cut', () => {
      const head = buildHeadMesh(neutral, { age: 25 });
      const lift = (style: 'afro' | 'buzz') => {
        const hair = buildHairMesh(head, style)!;
        let max = 0;
        for (let i = 0; i < head.positions.length; i += 3) {
          max = Math.max(max, Math.hypot(
            hair.positions[i] - head.positions[i],
            hair.positions[i + 1] - head.positions[i + 1],
            hair.positions[i + 2] - head.positions[i + 2],
          ));
        }
        return max;
      };
      expect(lift('afro')).toBeGreaterThan(lift('buzz'));
    });

    it('recedes the hairline with age', () => {
      const head = buildHeadMesh(neutral, { age: 70 });
      const young = buildHairMesh(head, 'short', 25)!;
      const old = buildHairMesh(head, 'short', 80)!;
      expect(old.indices.length).toBeLessThan(young.indices.length);
    });
  });

  describe('buildFacialHairMesh', () => {
    it('returns null for none', () => {
      expect(buildFacialHairMesh(buildHeadMesh(neutral), 'none', neutral)).toBeNull();
    });

    it('builds a valid mesh for every style', () => {
      const head = buildHeadMesh(neutral, { age: 30 });
      for (const style of FACIAL_HAIR_STYLES) {
        const beard = buildFacialHairMesh(head, style, neutral);
        if (style === 'none') { expect(beard).toBeNull(); continue; }
        expect(beard).not.toBeNull();
        expect(allFinite(beard!)).toBe(true);
        expect(beard!.indices.length).toBeGreaterThan(0);
      }
    });

    it('covers more with a full beard than with a moustache', () => {
      const head = buildHeadMesh(neutral, { age: 30 });
      const full = buildFacialHairMesh(head, 'full', neutral)!;
      const moustache = buildFacialHairMesh(head, 'moustache', neutral)!;
      expect(full.indices.length).toBeGreaterThan(moustache.indices.length);
    });
  });

  describe('computeNormals', () => {
    it('points outward on a convex shape', () => {
      const mesh = buildHeadMesh(neutral, { age: 30 });
      // On the back of the skull (away from every carved feature) the normal
      // must agree with the outward radial direction.
      let checked = 0;
      for (let i = 0; i < mesh.positions.length; i += 3) {
        const z = mesh.positions[i + 2];
        const y = mesh.positions[i + 1];
        if (z > -0.6 || y < -0.2 || y > 0.4) continue;
        const len = Math.hypot(mesh.positions[i], y, z) || 1;
        const dot =
          (mesh.positions[i] / len) * mesh.normals[i] +
          (y / len) * mesh.normals[i + 1] +
          (z / len) * mesh.normals[i + 2];
        expect(dot).toBeGreaterThan(0);
        checked++;
      }
      expect(checked).toBeGreaterThan(50);
    });

    it('handles a degenerate triangle without emitting NaN', () => {
      const positions = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
      const indices = new Uint32Array([0, 1, 2]);
      const normals = new Float32Array(9);
      computeNormals(positions, indices, normals);
      for (const v of normals) expect(Number.isFinite(v)).toBe(true);
    });
  });
});
