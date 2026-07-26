/**
 * Rare watch — a steel chronograph, reconstructed from
 * `assets/images/luxury/rare_watch_collection.jpg`.
 *
 * The reference shows three watches in a case. A showcase model reduces that to
 * ONE hero piece, because three watches at this scale would each get a third of
 * the screen and none would read. The chosen subject is the centre watch: a
 * steel chronograph with a dark dial, two subdials, applied indices, a crown and
 * pushers at 3 o'clock, straight lugs and a leather strap.
 *
 * ## Why a watch reconstructs well in code
 *
 * Almost every component is a surface of revolution (case, bezel, crystal,
 * subdials, crown) or a box (lugs, strap links, pushers). There is no organic
 * geometry anywhere, which is precisely the class the img2threejs methodology
 * flags as reliable.
 *
 * ## What this does NOT reproduce — stated rather than glossed
 *
 *  - No dial PRINTING: no numerals, no brand text, no tachymeter scale. Those
 *    are texture, and the model carries no textures by design. The dial reads as
 *    a dark disc with applied indices and subdial recesses.
 *  - No hand detail beyond flat tapered batons.
 *  - The strap is straight and rigid, not draped.
 *  - Crocodile grain, brushed-vs-polished case transitions and the case-back are
 *    absent.
 *
 * It is a recognisable chronograph, not a specific reference watch.
 */

import {
  boundingRadius,
  box,
  lathe,
  merge,
  rotateY,
  torus,
  translate,
  type MeshData,
} from '@/lib/geometry/mesh';
import type { ModelPart, ProceduralModel } from './types';

const STEEL = { color: '#C9CDD4', roughness: 0.22, metalness: 1 };
const DARK_STEEL = { color: '#8A9099', roughness: 0.30, metalness: 1 };

/** Case: a stepped cylinder with a chamfered bezel edge. */
function buildCase(r: number): MeshData {
  return lathe(
    [
      { r: 0, y: -0.22 },
      { r: r * 0.86, y: -0.22 },
      { r: r * 0.97, y: -0.14 },
      { r: r, y: 0.02 },
      { r: r * 0.99, y: 0.10 },
      { r: r * 0.90, y: 0.15 },
      { r: r * 0.86, y: 0.15 },
      // Intentionally NOT closed to the axis. A solid top plate here sits 0.005
      // below the dial and z-fights it — in the first render the plate won and
      // the watch showed a blank steel face with no dial, indices or hands.
      // The dial disc closes the case instead.
    ],
    72,
  );
}

/** Bezel ring sitting proud of the case. */
function buildBezel(r: number): MeshData {
  return lathe(
    [
      { r: r * 0.86, y: 0.15 },
      { r: r * 0.94, y: 0.19 },
      { r: r * 0.90, y: 0.23 },
      { r: r * 0.78, y: 0.22 },
      { r: r * 0.78, y: 0.15 },
    ],
    72,
  );
}

export function buildWatchModel(): ProceduralModel {
  const R = 1;
  const parts: ModelPart[] = [];

  parts.push({ name: 'case', mesh: buildCase(R), material: STEEL });
  parts.push({ name: 'bezel', mesh: buildBezel(R), material: { ...STEEL, roughness: 0.12 } });

  // Dial — a slightly recessed dark disc.
  parts.push({
    name: 'dial',
    mesh: lathe([{ r: 0, y: 0.155 }, { r: R * 0.78, y: 0.155 }], 64),
    material: { color: '#15171C', roughness: 0.55, metalness: 0.05 },
  });

  // Subdials: two recesses at 3 and 9, as in the reference chronograph layout.
  for (const x of [-0.33, 0.33]) {
    const sub = lathe(
      [
        { r: 0, y: 0.158 },
        { r: 0.165, y: 0.158 },
        { r: 0.185, y: 0.150 },
      ],
      36,
    );
    translate(sub, x, 0, 0);
    parts.push({ name: `subdial${x}`, mesh: sub, material: { color: '#0E1015', roughness: 0.6, metalness: 0.05 } });

    // Polished ring around each subdial. The recesses alone were nearly
    // invisible against the dial — a bright rim is what actually defines them.
    const ring = lathe(
      [
        { r: 0.180, y: 0.152 },
        { r: 0.192, y: 0.160 },
        { r: 0.172, y: 0.161 },
      ],
      28,
    );
    translate(ring, x, 0, 0);
    parts.push({ name: `subring${x}`, mesh: ring, material: { ...STEEL, roughness: 0.14 } });
  }

  // Chapter ring — the stepped inner flange between dial and crystal. Every real
  // watch has one, and its absence is why the first render read as a plain disc
  // with sticks on it: there was no depth between the dial and the case.
  parts.push({
    name: 'chapterRing',
    mesh: lathe(
      [
        { r: R * 0.78, y: 0.152 },
        { r: R * 0.74, y: 0.150 },
        { r: R * 0.70, y: 0.156 },
        { r: R * 0.70, y: 0.162 },
      ],
      64,
    ),
    material: { color: '#2A2F38', roughness: 0.42, metalness: 0.6 },
  });

  // Minute track — 60 fine ticks on the chapter ring. Individually invisible;
  // collectively they are most of what reads as "precision instrument".
  {
    const ticks: MeshData[] = [];
    for (let i = 0; i < 60; i++) {
      const tick = box(0.012, 0.008, i % 5 === 0 ? 0.055 : 0.032);
      translate(tick, 0, 0.164, -R * 0.735);
      rotateY(tick, (i / 60) * Math.PI * 2);
      ticks.push(tick);
    }
    parts.push({
      name: 'minuteTrack',
      mesh: merge(ticks),
      material: { color: '#E4E8EE', roughness: 0.28, metalness: 0.9 },
    });
  }

  // Applied hour indices — 12 tapered batons standing on the dial.
  const indices: MeshData[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const baton = box(0.05, 0.02, 0.16);
    translate(baton, 0, 0.168, -R * 0.66);
    rotateY(baton, a);
    indices.push(baton);
  }
  parts.push({ name: 'indices', mesh: merge(indices), material: { ...STEEL, roughness: 0.15 } });

  // Hands. Hour and minute offset to a natural ~10:10 display position, which is
  // how every watch is photographed — it frames the logo and reads as "alive".
  const hour = box(0.045, 0.016, 0.44);
  translate(hour, 0, 0.196, -0.22);
  rotateY(hour, -Math.PI * 0.33);
  const minute = box(0.038, 0.016, 0.62);
  translate(minute, 0, 0.206, -0.31);
  rotateY(minute, Math.PI * 0.28);
  parts.push({
    name: 'hands',
    mesh: merge([hour, minute]),
    material: { color: '#E8ECF2', roughness: 0.18, metalness: 1 },
  });
  parts.push({
    name: 'pinion',
    mesh: lathe([{ r: 0, y: 0.222 }, { r: 0.05, y: 0.222 }, { r: 0.05, y: 0.18 }], 20),
    material: DARK_STEEL,
  });

  // Crystal — a slightly domed sapphire over the dial.
  parts.push({
    name: 'crystal',
    mesh: lathe(
      [
        { r: 0, y: 0.30 },
        { r: R * 0.50, y: 0.285 },
        { r: R * 0.72, y: 0.245 },
        { r: R * 0.78, y: 0.20 },
        { r: R * 0.78, y: 0.16 },
      ],
      64,
    ),
    material: { color: '#DCE8F5', roughness: 0.02, metalness: 0, opacity: 0.24, transmission: 0.9, ior: 1.77 },
  });

  // Crown + two chronograph pushers at 3 o'clock.
  const crown = lathe(
    [{ r: 0, y: 0 }, { r: 0.11, y: 0 }, { r: 0.12, y: 0.06 }, { r: 0.10, y: 0.12 }, { r: 0, y: 0.12 }],
    24,
  );
  // Lathes are built around +Y; lay it on its side to point out of the case.
  rotateOntoX(crown);
  translate(crown, R * 0.95, -0.03, 0);
  parts.push({ name: 'crown', mesh: crown, material: DARK_STEEL });

  for (const z of [-0.34, 0.34]) {
    const pusher = lathe([{ r: 0, y: 0 }, { r: 0.07, y: 0 }, { r: 0.07, y: 0.10 }, { r: 0, y: 0.10 }], 18);
    rotateOntoX(pusher);
    translate(pusher, R * 0.92, -0.03, z);
    parts.push({ name: `pusher${z}`, mesh: pusher, material: DARK_STEEL });
  }

  // Lugs — four short blocks where the strap attaches.
  const lugs: MeshData[] = [];
  for (const z of [-1, 1]) for (const x of [-0.42, 0.42]) {
    const lug = box(0.20, 0.20, 0.34);
    translate(lug, x, -0.06, z * R * 0.92);
    lugs.push(lug);
  }
  parts.push({ name: 'lugs', mesh: merge(lugs), material: STEEL });

  // Strap — two straight tapering sections, dark brown leather as in the
  // reference's centre watch.
  const strap: MeshData[] = [];
  for (const z of [-1, 1]) {
    const near = box(0.80, 0.13, 0.9);
    translate(near, 0, -0.10, z * 1.42);
    const far = box(0.66, 0.11, 0.9);
    translate(far, 0, -0.22, z * 2.24);
    strap.push(near, far);
  }
  parts.push({
    name: 'strap',
    mesh: merge(strap),
    material: { color: '#4A2E1E', roughness: 0.78, metalness: 0 },
  });

  const all = merge(parts.map((p) => p.mesh));
  return {
    parts,
    radius: boundingRadius(all),
    defaultPitch: -1.05,
    fidelity:
      'Recognisable steel chronograph. No dial printing, numerals or tachymeter ' +
      '(those are texture; this model ships no textures). Strap is rigid, not draped.',
  };
}

/**
 * Rotate a Y-axis lathe so it points along +X instead.
 *
 * The crown and pushers stick out of the case side, but `lathe` only revolves
 * around Y. Rotating afterwards is cheaper than generalizing the primitive to an
 * arbitrary axis for two call sites.
 */
function rotateOntoX(mesh: MeshData): MeshData {
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = mesh.positions[i], y = mesh.positions[i + 1];
    mesh.positions[i] = y;
    mesh.positions[i + 1] = -x;
  }
  for (let i = 0; i < mesh.normals.length; i += 3) {
    const x = mesh.normals[i], y = mesh.normals[i + 1];
    mesh.normals[i] = y;
    mesh.normals[i + 1] = -x;
  }
  return mesh;
}

/** Exported so a future bracelet variant can reuse it. */
export { torus as _torus };
