/**
 * A studio lighting environment, generated in code.
 *
 * ## Why this exists — it is the single biggest quality lever in the whole feature
 *
 * Direct lights alone cannot make metal or glass look like metal or glass. A
 * polished steel watch case is almost entirely REFLECTION: what you see is the
 * room around it, not the light hitting it. With only directional lights, three's
 * physical materials have nothing to reflect, so `metalness: 1` renders as flat
 * grey plastic and `transmission` renders as grey haze. That is exactly what a
 * "procedural model looks cheap" complaint usually is — not the geometry, the
 * missing environment.
 *
 * So this builds a miniature softbox studio — a large key panel, a cool fill, a
 * bright overhead strip and a dark floor — and pre-filters it into an
 * environment map with `PMREMGenerator`. Every physical material in the scene
 * then samples it for reflections and refraction.
 *
 * ## Why not `RoomEnvironment` from three/examples
 *
 * three ships one, but it lives in `three/examples/jsm/...`, which is a deep
 * path into the package's example folder. Metro resolves it inconsistently
 * across versions and it is not part of three's public API surface, so an
 * upgrade can silently break the bundle. Twenty lines of boxes here is a smaller
 * liability than that import, and it is tuned for THIS app's dark palette rather
 * than for a generic white showroom.
 */

import * as THREE from 'three';

/**
 * Build and pre-filter the studio environment.
 *
 * Returns the texture to assign to `scene.environment`, plus a disposer. The
 * PMREM render target is a real GPU allocation and must be freed with the scene.
 */
export function createStudioEnvironment(renderer: THREE.WebGLRenderer): {
  texture: THREE.Texture;
  dispose: () => void;
} {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const env = new THREE.Scene();
  const geometry = new THREE.BoxGeometry();
  geometry.deleteAttribute('uv');

  // Emissive, back-facing boxes: the scene is viewed from INSIDE, so each box is
  // a light-emitting wall. This is the standard trick for a cheap studio — the
  // "lights" are geometry, which is what gives reflections a shape (a long strip
  // reads as a softbox on a chrome edge; a point light reads as a dot).
  const panel = (color: number, intensity: number) => {
    const material = new THREE.MeshStandardMaterial({ side: THREE.BackSide });
    material.color.setHex(0x000000);
    material.emissive = new THREE.Color(color);
    material.emissiveIntensity = intensity;
    return material;
  };

  const add = (
    material: THREE.Material,
    px: number, py: number, pz: number,
    sx: number, sy: number, sz: number,
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(px, py, pz);
    mesh.scale.set(sx, sy, sz);
    env.add(mesh);
    return mesh;
  };

  const materials: THREE.Material[] = [];

  // The room shell — very dark, matching the app's near-black surfaces, so
  // nothing picks up a false white cast.
  const shell = panel(0x0a0d14, 1);
  materials.push(shell);
  add(shell, 0, 0, 0, 24, 16, 24);

  // Large warm key softbox, upper left. The dominant reflection.
  const key = panel(0xfff2e2, 9);
  materials.push(key);
  add(key, -7, 6, 5, 9, 7, 0.1);

  // Cool fill from the right — keeps shadowed metal from going dead black and
  // gives chrome the two-tone warm/cool split that reads as "studio".
  const fill = panel(0xbcd6ff, 3.2);
  materials.push(fill);
  add(fill, 8, 1, 3, 7, 8, 0.1);

  // Overhead strip. On a watch bezel or a diamond table this becomes the long
  // travelling highlight that sells polish.
  const overhead = panel(0xffffff, 12);
  materials.push(overhead);
  add(overhead, 0, 8, 0, 5, 0.1, 14);

  // Rim from behind, to separate the object from the background.
  const rim = panel(0xffffff, 6);
  materials.push(rim);
  add(rim, 0, 2, -9, 10, 6, 0.1);

  const target = pmrem.fromScene(env, 0.02);

  // The source scene has served its purpose the moment it is pre-filtered.
  geometry.dispose();
  for (const m of materials) m.dispose();
  env.clear();
  pmrem.dispose();

  return {
    texture: target.texture,
    dispose: () => target.dispose(),
  };
}

/**
 * A soft radial contact shadow, as a generated texture.
 *
 * Without one, every object hangs in the void and reads as a cut-out sticker —
 * the thing that most reliably makes 3D look unfinished. A real shadow map for
 * one object is overkill (and costs a second render pass every frame); a
 * pre-baked radial gradient on a ground plane gives 90% of the effect for the
 * price of a 64x64 texture, generated once.
 *
 * Built as a `DataTexture` rather than drawn on a canvas because React Native
 * has no canvas — this is pure arithmetic into a byte array.
 */
export function createContactShadowTexture(size = 64): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const centre = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - centre) / centre;
      const dy = (y - centre) / centre;
      const d = Math.min(1, Math.hypot(dx, dy));
      // Squared falloff with a soft shoulder: dense directly under the object,
      // fading to nothing well before the edge so the plane never shows a rim.
      const alpha = Math.pow(1 - d, 2.4);
      const i = (y * size + x) * 4;
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
      data[i + 3] = Math.round(Math.max(0, Math.min(1, alpha)) * 235);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/** The ground plane carrying the contact shadow. Returns the mesh and a disposer. */
export function createContactShadow(radius: number): {
  mesh: THREE.Mesh;
  dispose: () => void;
} {
  const texture = createContactShadowTexture();
  const geometry = new THREE.PlaneGeometry(radius * 3.4, radius * 3.4);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: 0.85,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  // Sits just below the object's lowest point; the caller positions it.
  mesh.renderOrder = -1;
  return {
    mesh,
    dispose: () => { geometry.dispose(); material.dispose(); texture.dispose(); },
  };
}
