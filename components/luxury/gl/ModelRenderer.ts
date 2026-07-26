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
import { createContactShadow, createStudioEnvironment } from './studioEnvironment';

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
  // Metals lean harder on the environment than dielectrics do — that ratio is
  // most of what separates "polished steel" from "grey paint".
  const envIntensity = 0.9 + spec.metalness * 0.7;
  const common = {
    color: new THREE.Color(spec.color),
    roughness: spec.roughness,
    metalness: spec.metalness,
    transparent: spec.opacity !== undefined && spec.opacity < 1,
    opacity: spec.opacity ?? 1,
    emissive: spec.emissive ? new THREE.Color(spec.emissive) : new THREE.Color(0x000000),
    envMapIntensity: envIntensity,
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

  // The environment map is what makes metal look like metal. Without it,
  // `metalness: 1` has nothing to reflect and renders as flat grey. Assigned to
  // scene.environment so EVERY physical material picks it up automatically.
  const studio = createStudioEnvironment(renderer);
  scene.environment = studio.texture;

  // Bright key + cool fill + strong rim. Luxury product photography is lit hard
  // and from behind — the rim is what puts an edge on chrome and glass, and
  // without it a metal watch case reads as flat grey plastic.
  // Direct lights are now a SUPPLEMENT to the environment, not the whole look,
  // so they are much softer than before — at the old intensities they blew out
  // the image-based lighting and flattened exactly the reflections it adds.
  // They survive to give crisp specular hits the low-res env map cannot.
  const key = new THREE.DirectionalLight(0xfff6ea, 1.35);
  key.position.set(-3, 4, 4);
  const fill = new THREE.DirectionalLight(0xc6dcff, 0.45);
  fill.position.set(4, -1, 2);
  const rim = new THREE.DirectionalLight(0xffffff, 0.9);
  rim.position.set(1, 2, -5);
  scene.add(key, fill, rim, new THREE.AmbientLight(0xffffff, 0.12));

  const root = new THREE.Group();
  scene.add(root);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  // The shadow is a sibling of `root`, NOT a child: it must stay flat on the
  // ground while the object spins above it. Parenting it to the rotating group
  // would swing the shadow through the air with the model.
  let shadow: { mesh: THREE.Mesh; dispose: () => void } | null = null;
  let disposed = false;

  function clearRoot(): void {
    for (const child of [...root.children]) root.remove(child);
    for (const g of geometries.splice(0)) g.dispose();
    for (const m of materials.splice(0)) m.dispose();
    if (shadow) {
      scene.remove(shadow.mesh);
      shadow.dispose();
      shadow = null;
    }
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
    // Ground the object. Measured from the model's actual lowest vertex rather
    // than assumed at y=0, because the diamond sits on a plinth and the yacht's
    // keel hangs well below the origin — a fixed plane would float under one and
    // cut through the other.
    let lowest = Infinity;
    for (const part of model.parts) {
      for (let i = 1; i < part.mesh.positions.length; i += 3) {
        if (part.mesh.positions[i] < lowest) lowest = part.mesh.positions[i];
      }
    }
    if (!isFinite(lowest)) lowest = 0;
    shadow = createContactShadow(model.radius);
    shadow.mesh.position.y = lowest - model.radius * 0.012;
    scene.add(shadow.mesh);

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
    studio.dispose();
    scene.environment = null;
    scene.clear();
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch { /* not available on every driver */ }
  }

  update(initial);
  return { update, setRotation, render, resize, dispose };
}
