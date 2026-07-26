/**
 * Showcase model invariants.
 *
 * These models are generated arithmetic, so the failure modes are arithmetic:
 * a NaN vertex, an index past the end of the buffer, a degenerate mesh. Any of
 * those renders as garbage or crashes the GL driver rather than looking merely
 * wrong, so they are asserted for every model at once.
 */

import { buildLuxuryModel, hasLuxuryModel, LUXURY_MODEL_IDS } from '@/lib/luxury/models';
import { LUXURY_CATALOG } from '@/lib/luxury/catalog';
import { boundingRadius, box, lathe, merge, flatShade, computeNormals } from '@/lib/geometry/mesh';
import { DIAMOND_CUT, buildDiamondMesh } from '@/lib/luxury/models/diamond';

describe('luxury showcase models', () => {
  it('only claims ids that exist in the real catalogue', () => {
    // A model keyed to an id nobody owns is dead code that silently never shows.
    const catalogIds = new Set(LUXURY_CATALOG.map((item) => item.id));
    for (const id of LUXURY_MODEL_IDS) {
      expect(catalogIds.has(id)).toBe(true);
    }
  });

  it('returns null for catalogue items with no model, without throwing', () => {
    expect(buildLuxuryModel('racehorse')).toBeNull();
    expect(buildLuxuryModel('private_island')).toBeNull();
    expect(buildLuxuryModel('not_a_real_id')).toBeNull();
    expect(hasLuxuryModel('racehorse')).toBe(false);
    expect(hasLuxuryModel('museum_diamond')).toBe(true);
  });

  describe.each(LUXURY_MODEL_IDS)('%s', (id) => {
    const model = buildLuxuryModel(id)!;

    it('builds with at least one part', () => {
      expect(model).not.toBeNull();
      expect(model.parts.length).toBeGreaterThan(0);
    });

    it('has finite geometry everywhere', () => {
      for (const part of model.parts) {
        for (const v of part.mesh.positions) expect(Number.isFinite(v)).toBe(true);
        for (const v of part.mesh.normals) expect(Number.isFinite(v)).toBe(true);
      }
    });

    it('has in-range indices and whole triangles', () => {
      for (const part of model.parts) {
        const vertexCount = part.mesh.positions.length / 3;
        expect(part.mesh.indices.length % 3).toBe(0);
        expect(part.mesh.indices.length).toBeGreaterThan(0);
        for (const i of part.mesh.indices) {
          expect(i).toBeGreaterThanOrEqual(0);
          expect(i).toBeLessThan(vertexCount);
        }
        expect(part.mesh.normals.length).toBe(part.mesh.positions.length);
      }
    });

    it('has unit-length normals', () => {
      for (const part of model.parts) {
        for (let i = 0; i < part.mesh.normals.length; i += 3) {
          const len = Math.hypot(part.mesh.normals[i], part.mesh.normals[i + 1], part.mesh.normals[i + 2]);
          expect(len).toBeGreaterThan(0.99);
          expect(len).toBeLessThan(1.01);
        }
      }
    });

    it('reports a usable framing radius', () => {
      // The renderer divides by this to fit the camera; zero would blow up.
      expect(model.radius).toBeGreaterThan(0.1);
      expect(model.radius).toBeLessThan(50);
    });

    it('is deterministic', () => {
      const again = buildLuxuryModel(id)!;
      expect(Array.from(again.parts[0].mesh.positions)).toEqual(Array.from(model.parts[0].mesh.positions));
    });

    it('declares valid materials', () => {
      for (const part of model.parts) {
        expect(part.material.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(part.material.roughness).toBeGreaterThanOrEqual(0);
        expect(part.material.roughness).toBeLessThanOrEqual(1);
        expect(part.material.metalness).toBeGreaterThanOrEqual(0);
        expect(part.material.metalness).toBeLessThanOrEqual(1);
        if (part.material.opacity !== undefined) {
          expect(part.material.opacity).toBeGreaterThan(0);
          expect(part.material.opacity).toBeLessThanOrEqual(1);
        }
      }
    });

    it('stays a sane triangle budget for a phone', () => {
      const tris = model.parts.reduce((n, p) => n + p.mesh.indices.length / 3, 0);
      expect(tris).toBeLessThan(40_000);
    });
  });

  describe('diamond cut proportions', () => {
    it('is as deep as a real round brilliant', () => {
      // The bug this pins: the GIA figures are fractions of girdle DIAMETER, and
      // the first implementation applied them to the RADIUS. The stone came out
      // exactly half as deep and rendered as a flat lens with no pavilion.
      const mesh = buildDiamondMesh();
      let minY = Infinity, maxY = -Infinity, maxR = 0;
      for (let i = 0; i < mesh.positions.length; i += 3) {
        minY = Math.min(minY, mesh.positions[i + 1]);
        maxY = Math.max(maxY, mesh.positions[i + 1]);
        maxR = Math.max(maxR, Math.hypot(mesh.positions[i], mesh.positions[i + 2]));
      }
      const diameter = maxR * 2;
      const totalDepth = maxY - minY;
      const expected = DIAMOND_CUT.crownHeight + DIAMOND_CUT.girdle + DIAMOND_CUT.pavilionDepth;
      // ~62% of diameter for an excellent cut.
      expect(totalDepth / diameter).toBeGreaterThan(expected - 0.03);
      expect(totalDepth / diameter).toBeLessThan(expected + 0.05);
    });

    it('puts the pavilion below the girdle and the table above it', () => {
      const mesh = buildDiamondMesh();
      let minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < mesh.positions.length; i += 3) {
        minY = Math.min(minY, mesh.positions[i + 1]);
        maxY = Math.max(maxY, mesh.positions[i + 1]);
      }
      // The pavilion is deeper than the crown is tall — that is the defining
      // proportion of a brilliant, and what makes it sparkle.
      expect(Math.abs(minY)).toBeGreaterThan(maxY * 1.5);
    });

    it('is flat-shaded so the facets survive', () => {
      // Smooth normals would average the facets into a dome and kill the
      // sparkle. Flat shading duplicates verts per triangle: 3 verts per tri.
      const mesh = buildDiamondMesh();
      expect(mesh.positions.length / 3).toBe(mesh.indices.length);
    });
  });
});

describe('geometry primitives', () => {
  it('lathe rejects degenerate input rather than emitting garbage', () => {
    expect(lathe([{ r: 1, y: 0 }], 32).indices.length).toBe(0);
    expect(lathe([{ r: 1, y: 0 }, { r: 1, y: 1 }], 2).indices.length).toBe(0);
  });

  it('lathe skips the degenerate quad where a profile touches the axis', () => {
    const disc = lathe([{ r: 0, y: 0 }, { r: 1, y: 0 }], 16);
    expect(disc.indices.length).toBe(16 * 3);
    for (const v of disc.normals) expect(Number.isFinite(v)).toBe(true);
  });

  it('box is a closed 12-triangle solid', () => {
    const b = box(1, 2, 3);
    expect(b.indices.length).toBe(36);
    expect(boundingRadius(b)).toBeCloseTo(Math.hypot(0.5, 1, 1.5), 5);
  });

  it('merge preserves triangle count and rebases indices', () => {
    const a = box(1, 1, 1);
    const b = box(1, 1, 1);
    const m = merge([a, b]);
    expect(m.indices.length).toBe(a.indices.length + b.indices.length);
    const vertexCount = m.positions.length / 3;
    for (const i of m.indices) expect(i).toBeLessThan(vertexCount);
  });

  it('merge drops empty meshes without corrupting the result', () => {
    const empty = { positions: new Float32Array(0), normals: new Float32Array(0), indices: new Uint32Array(0) };
    const m = merge([empty, box(1, 1, 1), empty]);
    expect(m.indices.length).toBe(36);
  });

  it('flatShade duplicates verts per triangle and gives each a face normal', () => {
    const flat = flatShade(box(1, 1, 1));
    expect(flat.positions.length / 3).toBe(flat.indices.length);
    for (let i = 0; i < flat.normals.length; i += 3) {
      expect(Math.hypot(flat.normals[i], flat.normals[i + 1], flat.normals[i + 2])).toBeCloseTo(1, 4);
    }
  });

  it('computeNormals survives a degenerate triangle', () => {
    const positions = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    const normals = new Float32Array(9);
    computeNormals(positions, new Uint32Array([0, 1, 2]), normals);
    for (const v of normals) expect(Number.isFinite(v)).toBe(true);
  });
});
