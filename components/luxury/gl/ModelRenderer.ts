/**
 * three.js scene for a procedural showcase model.
 *
 * Sibling of `components/identity/gl/FaceRenderer.ts` and deliberately a
 * separate file rather than a generalization of it. The face renderer's job is
 * genome → mesh → eye placement, all of which is specific to a head; this one
 * takes an already-built `ProceduralModel` and maps its parts onto materials.
 * Merging them would mean a single component with two disjoint code paths and a
 * mode flag, which is worse than 120 lines of similar-looking lifecycle.
 *
 * Same hard rule as the face renderer: every GPU resource is tracked and freed
 * in `dispose()`. Leaking a native GL context on a phone is a crash, not a
 * slowdown.
 */

import * as THREE from 'three';
import type { MeshData } from '@/lib/geometry/mesh';
import type { PartMaterial, ProceduralModel } from '@/lib/luxury/models';

export interface ModelScene {
  update(model: ProceduralModel): void;
  setRotation(yaw: number, pitch: number): void;
  render(): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

function toBufferGeometry(mesh: MeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Build the three.js material for a part.
 *
 * `MeshPhysicalMaterial` rather than `MeshStandardMaterial` specifically for
 * `transmission` and `ior` — those are what make the diamond behave like a
 * gemstone instead of frosted plastic, and they are the entire reason the stone
 * is worth rendering in 3D at all. Physical is heavier, so it is used ONLY for
 * parts that actually declare transmission or clearcoat.
 */
function toMaterial(spec: PartMaterial): THREE.Material {
  const needsPhysical = spec.transmission !== undefined || spec.clearcoat !== undefined;
  const common = {
    color: new THREE.Color(spec.color),
    roughness: spec.roughness,
    metalness: spec.metalness,
    transparent: spec.opacity !== undefined && spec.opacity < 1,
    opacity: spec.opacity ?? 1,
    emissive: spec.emissive ? new THREE.Color(spec.emissive) : new THREE.Color(0x000000),
  };
  if (!needsPhysical) return new THREE.MeshStandardMaterial(common);

  return new THREE.MeshPhysicalMaterial({
    ...common,
    transmission: spec.transmission ?? 0,
    ior: spec.ior ?? 1.5,
    clearcoat: spec.clearcoat ?? 0,
    clearcoatRoughness: 0.08,
    // Transmission needs a thickness to refract THROUGH; at 0 the material
    // renders as a flat tint and the stone loses all its depth.
    thickness: spec.transmission ? 0.9 : 0,
    // Back faces matter for a gemstone — most of what you see looking into a
    // diamond is its own pavilion from the inside.
    side: spec.transmission ? THREE.DoubleSide : THREE.FrontSide,
  });
}

export function createModelScene(
  gl: WebGLRenderingContext & { drawingBufferWidth: number; drawingBufferHeight: number },
  initial: ProceduralModel,
): ModelScene {
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;

  const renderer = new THREE.WebGLRenderer({ context: gl, antialias: true, alpha: true });
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, width / height, 0.05, 200);

  // Bright key + cool fill + strong rim. Luxury product photography is lit hard
  // and from behind — the rim is what puts an edge on chrome and glass, and
  // without it a metal watch case reads as flat grey plastic.
  const key = new THREE.DirectionalLight(0xfff6ea, 3.0);
  key.position.set(-3, 4, 4);
  const fill = new THREE.DirectionalLight(0xc6dcff, 1.0);
  fill.position.set(4, -1, 2);
  const rim = new THREE.DirectionalLight(0xffffff, 2.2);
  rim.position.set(1, 2, -5);
  scene.add(key, fill, rim, new THREE.AmbientLight(0xffffff, 0.35));

  const root = new THREE.Group();
  scene.add(root);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  let disposed = false;

  function clearRoot(): void {
    for (const child of [...root.children]) root.remove(child);
    for (const g of geometries.splice(0)) g.dispose();
    for (const m of materials.splice(0)) m.dispose();
  }

  function update(model: ProceduralModel): void {
    if (disposed) return;
    clearRoot();
    for (const part of model.parts) {
      const geometry = toBufferGeometry(part.mesh);
      const material = toMaterial(part.material);
      geometries.push(geometry);
      materials.push(material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = part.name;
      // Transmissive parts draw last so opaque geometry behind them is already
      // in the framebuffer for them to refract.
      mesh.renderOrder = part.material.transmission ? 1 : 0;
      root.add(mesh);
    }
    // Frame the camera from the model's own radius, so a watch and a yacht both
    // fill the viewport without per-model camera tuning.
    const dist = Math.max(1.6, model.radius * 3.1);
    camera.position.set(0, model.radius * 0.35, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  function setRotation(yaw: number, pitch: number): void {
    root.rotation.y = yaw;
    root.rotation.x = Math.max(-1.35, Math.min(1.35, pitch));
  }

  function render(): void {
    if (disposed) return;
    renderer.render(scene, camera);
  }

  function resize(w: number, h: number): void {
    if (disposed || w <= 0 || h <= 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    clearRoot();
    scene.clear();
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch { /* not available on every driver */ }
  }

  update(initial);
  return { update, setRotation, render, resize, dispose };
}
