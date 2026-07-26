/**
 * Shared geometry primitives — plain buffers, no three.js.
 *
 * Extracted so the luxury showcase models and the procedural head can share one
 * definition of "a mesh" and one normal-computation routine. Same architectural
 * bet as `lib/identity/headMesh.ts`: the maths lives here and is unit-tested
 * without a GPU; three.js only ever appears in the renderer that consumes these
 * arrays.
 *
 * Everything is built from lathes, extrusions and boxes. That is deliberate —
 * the objects this serves (a brilliant-cut diamond, a watch case, a hull) are
 * hard-surface and surfaces of revolution, which is exactly the class that
 * reconstructs faithfully in code. Organic subjects are not, and are not
 * attempted here.
 */

/** Plain geometry buffers — the renderer's only input. */
export interface MeshData {
  /** xyz triples. */
  positions: Float32Array;
  /** xyz triples, unit length, one per vertex. */
  normals: Float32Array;
  /** Triangle list. */
  indices: Uint32Array;
  /**
   * Optional per-vertex weight in [0, 1]. Used by the head's hair shells for a
   * soft alpha edge; unused by the luxury models, which have hard boundaries.
   */
  coverage?: Float32Array;
}

/**
 * Smooth vertex normals by area-weighted face accumulation.
 *
 * Area weighting (the un-normalized cross product) rather than a plain average:
 * lathe and fan meshes have wildly different triangle sizes near their poles,
 * and an unweighted average shades those as if faceted.
 */
export function computeNormals(positions: Float32Array, indices: Uint32Array, out: Float32Array): void {
  out.fill(0);
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i] * 3;
    const ib = indices[i + 1] * 3;
    const ic = indices[i + 2] * 3;

    const ax = positions[ia], ay = positions[ia + 1], az = positions[ia + 2];
    const e1x = positions[ib] - ax, e1y = positions[ib + 1] - ay, e1z = positions[ib + 2] - az;
    const e2x = positions[ic] - ax, e2y = positions[ic + 1] - ay, e2z = positions[ic + 2] - az;

    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;

    out[ia] += nx; out[ia + 1] += ny; out[ia + 2] += nz;
    out[ib] += nx; out[ib + 1] += ny; out[ib + 2] += nz;
    out[ic] += nx; out[ic + 1] += ny; out[ic + 2] += nz;
  }
  for (let i = 0; i < out.length; i += 3) {
    const len = Math.hypot(out[i], out[i + 1], out[i + 2]);
    if (len > 1e-8) {
      out[i] /= len; out[i + 1] /= len; out[i + 2] /= len;
    } else {
      // A vertex with no usable area — a seam duplicate, or one no triangle
      // references. Point it outward rather than leaving a zero normal, which
      // renders as a black speck.
      const plen = Math.hypot(positions[i], positions[i + 1], positions[i + 2]);
      if (plen > 1e-8) {
        out[i] = positions[i] / plen;
        out[i + 1] = positions[i + 1] / plen;
        out[i + 2] = positions[i + 2] / plen;
      } else {
        // The vertex sits exactly ON the origin, so there is no outward
        // direction to derive from its position. The previous `|p| || 1` form
        // left it at (0,0,0) — a black speck. The diamond's plinth and the
        // watch's crown both close their lathe profiles at r=0, y=0, so this is
        // hit in practice, not theoretically.
        out[i] = 0; out[i + 1] = 1; out[i + 2] = 0;
      }
    }
  }
}

/**
 * FLAT normals — one normal per face, vertices duplicated per triangle.
 *
 * The diamond needs this and smooth normals would ruin it: a brilliant cut IS
 * its facet edges. Smoothing them averages the crown and pavilion into a
 * continuous curve and the stone reads as a glass blob with no sparkle, because
 * every hard edge that catches a highlight has been rounded away.
 */
export function flatShade(mesh: MeshData): MeshData {
  const triCount = mesh.indices.length / 3;
  const positions = new Float32Array(triCount * 9);
  const normals = new Float32Array(triCount * 9);
  const indices = new Uint32Array(triCount * 3);

  for (let t = 0; t < triCount; t++) {
    const ia = mesh.indices[t * 3] * 3;
    const ib = mesh.indices[t * 3 + 1] * 3;
    const ic = mesh.indices[t * 3 + 2] * 3;

    const ax = mesh.positions[ia], ay = mesh.positions[ia + 1], az = mesh.positions[ia + 2];
    const bx = mesh.positions[ib], by = mesh.positions[ib + 1], bz = mesh.positions[ib + 2];
    const cx = mesh.positions[ic], cy = mesh.positions[ic + 1], cz = mesh.positions[ic + 2];

    let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-9) {
      nx /= len; ny /= len; nz /= len;
    } else {
      // Degenerate (zero-area) triangle — `|n| || 1` left this at (0,0,0),
      // which shades black. Substitute a valid unit normal instead.
      nx = 0; ny = 1; nz = 0;
    }

    const o = t * 9;
    positions[o] = ax; positions[o + 1] = ay; positions[o + 2] = az;
    positions[o + 3] = bx; positions[o + 4] = by; positions[o + 5] = bz;
    positions[o + 6] = cx; positions[o + 7] = cy; positions[o + 8] = cz;
    for (let k = 0; k < 3; k++) {
      normals[o + k * 3] = nx; normals[o + k * 3 + 1] = ny; normals[o + k * 3 + 2] = nz;
    }
    indices[t * 3] = t * 3; indices[t * 3 + 1] = t * 3 + 1; indices[t * 3 + 2] = t * 3 + 2;
  }
  return { positions, normals, indices };
}

/** A point on a lathe profile, in (radius, height). */
export interface ProfilePoint {
  r: number;
  y: number;
}

/**
 * Revolve a profile around the Y axis.
 *
 * The workhorse: a watch case, a bezel, a plinth, a diamond girdle and a glass
 * are all lathes. `segments` is the radial resolution; low values are a
 * legitimate style choice (an 8-segment lathe is an octagon, which is what a
 * brilliant cut's crown actually is).
 */
export function lathe(profile: ProfilePoint[], segments: number, options: { closed?: boolean } = {}): MeshData {
  const rings = profile.length;
  if (rings < 2 || segments < 3) {
    return { positions: new Float32Array(0), normals: new Float32Array(0), indices: new Uint32Array(0) };
  }
  const cols = segments + 1; // duplicate seam column so the wrap is clean
  const positions = new Float32Array(rings * cols * 3);
  const normals = new Float32Array(rings * cols * 3);

  let p = 0;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < cols; j++) {
      const theta = (j / segments) * Math.PI * 2;
      positions[p] = profile[i].r * Math.sin(theta);
      positions[p + 1] = profile[i].y;
      positions[p + 2] = profile[i].r * Math.cos(theta);
      p += 3;
    }
  }

  const tris: number[] = [];
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * cols + j;
      const b = a + cols;
      // Skip degenerate quads where the profile pinches to the axis.
      const rA = profile[i].r;
      const rB = profile[i + 1].r;
      if (rA > 1e-9) tris.push(a, b, a + 1);
      if (rB > 1e-9) tris.push(b, b + 1, a + 1);
    }
  }
  if (options.closed) {
    // Cap the ends with fans when the profile does not already reach the axis.
    if (profile[0].r > 1e-9) capFan(positions, tris, 0, cols, segments, profile[0].y, true);
    if (profile[rings - 1].r > 1e-9) {
      capFan(positions, tris, (rings - 1) * cols, cols, segments, profile[rings - 1].y, false);
    }
  }

  const indices = new Uint32Array(tris);
  computeNormals(positions, indices, normals);
  return { positions, normals, indices };
}

/** Fan-cap a lathe end onto its own axis centre. Appends to `positions` in place is not possible, so reuse ring verts. */
function capFan(
  positions: Float32Array,
  tris: number[],
  ringStart: number,
  cols: number,
  segments: number,
  _y: number,
  flip: boolean,
): void {
  // Triangulate the ring as a fan from its first vertex. Slightly less even than
  // a true centre-vertex fan, but it needs no extra vertices — which keeps
  // `positions` a fixed allocation.
  for (let j = 1; j < segments - 1; j++) {
    const a = ringStart;
    const b = ringStart + j;
    const c = ringStart + j + 1;
    if (flip) tris.push(a, c, b);
    else tris.push(a, b, c);
  }
  void positions; void cols;
}

/** Axis-aligned box centred on the origin. */
export function box(w: number, h: number, d: number): MeshData {
  const x = w / 2, y = h / 2, z = d / 2;
  const positions = new Float32Array([
    -x, -y, z, x, -y, z, x, y, z, -x, y, z, // +Z
    x, -y, -z, -x, -y, -z, -x, y, -z, x, y, -z, // -Z
    -x, -y, -z, -x, -y, z, -x, y, z, -x, y, -z, // -X
    x, -y, z, x, -y, -z, x, y, -z, x, y, z, // +X
    -x, y, z, x, y, z, x, y, -z, -x, y, -z, // +Y
    -x, -y, -z, x, -y, -z, x, -y, z, -x, -y, z, // -Y
  ]);
  const tris: number[] = [];
  for (let f = 0; f < 6; f++) {
    const o = f * 4;
    tris.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  const indices = new Uint32Array(tris);
  const normals = new Float32Array(positions.length);
  computeNormals(positions, indices, normals);
  return { positions, normals, indices };
}

/** Torus in the XZ plane. */
export function torus(radius: number, tube: number, radialSegments: number, tubularSegments: number): MeshData {
  const cols = tubularSegments + 1;
  const rows = radialSegments + 1;
  const positions = new Float32Array(rows * cols * 3);
  let p = 0;
  for (let i = 0; i < rows; i++) {
    const v = (i / radialSegments) * Math.PI * 2;
    for (let j = 0; j < cols; j++) {
      const u = (j / tubularSegments) * Math.PI * 2;
      const r = radius + tube * Math.cos(v);
      positions[p] = r * Math.sin(u);
      positions[p + 1] = tube * Math.sin(v);
      positions[p + 2] = r * Math.cos(u);
      p += 3;
    }
  }
  const tris: number[] = [];
  for (let i = 0; i < radialSegments; i++) {
    for (let j = 0; j < tubularSegments; j++) {
      const a = i * cols + j;
      const b = a + cols;
      tris.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const indices = new Uint32Array(tris);
  const normals = new Float32Array(positions.length);
  computeNormals(positions, indices, normals);
  return { positions, normals, indices };
}

/** Translate a mesh in place and return it (fluent). */
export function translate(mesh: MeshData, dx: number, dy: number, dz: number): MeshData {
  for (let i = 0; i < mesh.positions.length; i += 3) {
    mesh.positions[i] += dx;
    mesh.positions[i + 1] += dy;
    mesh.positions[i + 2] += dz;
  }
  return mesh;
}

/** Scale a mesh about the origin. Recomputes normals (non-uniform scale skews them). */
export function scale(mesh: MeshData, sx: number, sy: number, sz: number): MeshData {
  for (let i = 0; i < mesh.positions.length; i += 3) {
    mesh.positions[i] *= sx;
    mesh.positions[i + 1] *= sy;
    mesh.positions[i + 2] *= sz;
  }
  computeNormals(mesh.positions, mesh.indices, mesh.normals);
  return mesh;
}

/** Rotate about the Y axis. */
export function rotateY(mesh: MeshData, radians: number): MeshData {
  const c = Math.cos(radians), s = Math.sin(radians);
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = mesh.positions[i], z = mesh.positions[i + 2];
    mesh.positions[i] = x * c + z * s;
    mesh.positions[i + 2] = -x * s + z * c;
  }
  computeNormals(mesh.positions, mesh.indices, mesh.normals);
  return mesh;
}

/** Rotate about the Z axis. */
export function rotateZ(mesh: MeshData, radians: number): MeshData {
  const c = Math.cos(radians), s = Math.sin(radians);
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = mesh.positions[i], y = mesh.positions[i + 1];
    mesh.positions[i] = x * c - y * s;
    mesh.positions[i + 1] = x * s + y * c;
  }
  computeNormals(mesh.positions, mesh.indices, mesh.normals);
  return mesh;
}

/** Concatenate meshes into one buffer set. */
export function merge(meshes: MeshData[]): MeshData {
  const usable = meshes.filter((m) => m && m.indices.length > 0);
  if (usable.length === 0) {
    return { positions: new Float32Array(0), normals: new Float32Array(0), indices: new Uint32Array(0) };
  }
  let vCount = 0;
  let iCount = 0;
  for (const m of usable) {
    vCount += m.positions.length;
    iCount += m.indices.length;
  }
  const positions = new Float32Array(vCount);
  const normals = new Float32Array(vCount);
  const indices = new Uint32Array(iCount);
  let vo = 0, io = 0, base = 0;
  for (const m of usable) {
    positions.set(m.positions, vo);
    normals.set(m.normals, vo);
    for (let i = 0; i < m.indices.length; i++) indices[io + i] = m.indices[i] + base;
    base += m.positions.length / 3;
    vo += m.positions.length;
    io += m.indices.length;
  }
  return { positions, normals, indices };
}

/** Largest distance from the origin — used to frame the camera. */
export function boundingRadius(mesh: MeshData): number {
  let max = 0;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    max = Math.max(max, Math.hypot(mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]));
  }
  return max;
}
