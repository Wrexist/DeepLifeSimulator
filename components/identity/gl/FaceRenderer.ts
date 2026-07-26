/**
 * three.js scene for the procedural head.
 *
 * The ONLY file in the project that imports three. Everything it renders comes
 * from `lib/identity/headMesh`, which knows nothing about three — so the scene
 * graph here is thin by design and the geometry stays testable without a GPU.
 *
 * ## Why a hand-built scene instead of react-three-fiber
 *
 * R3F would add a React reconciler on top of an already-nested 8-level context
 * tree for a scene that is four meshes and two lights. The reconciler's value is
 * declarative scene composition, which this does not need, and its cost is a
 * second render loop plus a React-version coupling on a package that has broken
 * across RN upgrades before. A plain imperative scene is ~200 lines, has one
 * owner, and disposes deterministically — which matters a lot more here, because
 * leaking a GL context on a phone is how you get a crash rather than a slowdown.
 *
 * ## Lifecycle contract
 *
 * `create()` → `update()` any number of times → `dispose()` exactly once.
 * Every GPU resource is tracked and freed in `dispose()`; nothing else in the
 * app is allowed to hold a reference to a `THREE.*` object.
 */

import * as THREE from 'three';
import {
  applyAging,
  buildFacialHairMesh,
  buildHairMesh,
  buildHeadMesh,
  eyePlacement,
  EYE_COLORS,
  HAIR_COLORS,
  SKIN_TONES,
  type BodyProfile,
  type FaceGenome,
  type MeshData,
} from '@/lib/identity';
import { createStudioEnvironment } from '@/components/luxury/gl/studioEnvironment';

export interface FaceSceneInput {
  genome: FaceGenome;
  age: number;
  body?: BodyProfile;
}

/** Everything the renderer owns. Opaque to callers. */
export interface FaceScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  root: THREE.Group;
  update(input: FaceSceneInput): void;
  setRotation(yaw: number, pitch: number): void;
  render(): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

function toBufferGeometry(mesh: MeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  if (mesh.coverage) {
    // Feeds the hair/beard alpha so the hairline is soft rather than stepped.
    geometry.setAttribute('coverage', new THREE.BufferAttribute(mesh.coverage, 1));
  }
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Material for the hair/beard shells.
 *
 * A standard material cannot fade by a custom attribute, so the coverage weight
 * is patched into the shader with `onBeforeCompile` rather than by writing a
 * whole custom shader — this keeps three's lighting, tone mapping and fog
 * intact, which a hand-rolled ShaderMaterial would throw away.
 */
function makeShellMaterial(color: THREE.ColorRepresentation, roughness: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    transparent: true,
    depthWrite: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float coverage;\nvarying float vCoverage;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCoverage = coverage;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vCoverage;')
      .replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\n' +
          // Discard the fully-bare fringe so it never darkens the skin beneath.
          'if (vCoverage < 0.06) discard;\n' +
          'gl_FragColor.a *= smoothstep(0.06, 0.45, vCoverage);',
      );
  };
  return material;
}

/**
 * Build the scene.
 *
 * `gl` is the expo-gl context object. Typed loosely because its RN type is not
 * a `WebGLRenderingContext` — it is a native-backed lookalike — and three only
 * needs it to satisfy the context interface at runtime.
 */
export function createFaceScene(
  gl: WebGLRenderingContext & { drawingBufferWidth: number; drawingBufferHeight: number },
  initial: FaceSceneInput,
  options: { background?: string } = {},
): FaceScene {
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;

  const renderer = new THREE.WebGLRenderer({ context: gl, antialias: true, alpha: true });
  renderer.setSize(width, height, false);
  renderer.setClearColor(new THREE.Color(options.background ?? '#0F172A'), options.background ? 1 : 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // 1.45, not 1.1. The studio environment is deliberately dark (it matches the
  // app's near-black surfaces), and at 1.1 the deeper skin tones crushed to
  // almost pure black — the face was unreadable for a large part of the
  // palette. Exposure is the right lever: brightening the skin colour instead
  // would have made the whole tone range wrong.
  renderer.toneMappingExposure = 1.45;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 100);

  // Image-based lighting. Skin is a dielectric with a real specular sheen and
  // eyes are wet spheres — both need something to reflect. With directional
  // lights alone the face renders matte and slightly plastic, which is the
  // single biggest thing separating a "game head" from a rendered one.
  const studio = createStudioEnvironment(renderer);
  scene.environment = studio.texture;
  camera.position.set(0, 0.05, 6.2);
  camera.lookAt(0, -0.02, 0);

  // Three-point-ish lighting. A single light makes any procedural head look
  // like a clay blob — the fill and rim are what give the cheekbones and jaw an
  // edge to catch, which is most of what makes the morphs legible at all.
  // Softened now that the environment carries the base lighting — the previous
  // intensities were compensating for its absence and would blow out over it.
  const key = new THREE.DirectionalLight(0xfff4e8, 1.7);
  key.position.set(-2.2, 2.6, 3.4);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.6);
  fill.position.set(2.8, -0.4, 2.0);
  const rim = new THREE.DirectionalLight(0xffffff, 0.65);
  rim.position.set(0.6, 1.2, -3.2);
  const ambient = new THREE.AmbientLight(0xffffff, 0.26);
  scene.add(key, fill, rim, ambient);

  const root = new THREE.Group();
  // The mesh is authored ~1.7 units tall around the origin; nudge it up so the
  // face — not the neck — sits in the centre of frame.
  root.position.y = 0.12;
  scene.add(root);

  // --- Owned GPU resources ------------------------------------------------
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  let headMesh: THREE.Mesh | null = null;
  let hairMesh: THREE.Mesh | null = null;
  let beardMesh: THREE.Mesh | null = null;
  const eyeMeshes: THREE.Mesh[] = [];
  let disposed = false;

  function track<T extends THREE.BufferGeometry | THREE.Material>(resource: T): T {
    if (resource instanceof THREE.BufferGeometry) geometries.push(resource);
    else materials.push(resource);
    return resource;
  }

  function clearRoot(): void {
    for (const child of [...root.children]) root.remove(child);
    // Dispose eagerly rather than at the end of the session. The creator rebuilds
    // the head on every slider drag; deferring would accumulate hundreds of
    // orphaned buffers on the GPU within a few seconds of interaction.
    for (const g of geometries.splice(0)) g.dispose();
    for (const m of materials.splice(0)) m.dispose();
    eyeMeshes.length = 0;
    headMesh = hairMesh = beardMesh = null;
  }

  function update(input: FaceSceneInput): void {
    if (disposed) return;
    clearRoot();

    const { genome, age, body } = input;
    // Aged genome for COLOUR only — the geometry applies its own aging inside
    // buildHeadMesh, and applying it twice would double every drift.
    const aged = applyAging(genome, age);

    const head = buildHeadMesh(genome, { age, body });
    const skin = SKIN_TONES[Math.min(SKIN_TONES.length - 1, Math.max(0, aged.skinTone))];
    const headMaterial = track(new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(skin),
      roughness: 0.72,
      metalness: 0,
      // Clearcoat cut 0.22 -> 0.05. At 0.22 it put a wet lacquered sheen over
      // the whole head and the skin read as moulded chocolate — the gloss was
      // the single loudest "this is plastic" cue, worse than any geometry
      // problem. Skin is mostly diffuse; the sheen has to be a hint, not a coat.
      clearcoat: 0.05,
      clearcoatRoughness: 0.7,
      envMapIntensity: 0.7,
    }));
    headMesh = new THREE.Mesh(track(toBufferGeometry(head)), headMaterial);
    root.add(headMesh);

    // Eyes. Seated against the socket the skin mesh actually carved.
    const eyes = eyePlacement(head, genome, age);
    const iris = EYE_COLORS[Math.min(EYE_COLORS.length - 1, Math.max(0, aged.eyeColor))];
    // Eyes are wet: low roughness plus a strong environment response is what
    // produces the catchlight that makes a face look alive rather than dead.
    const scleraMat = track(new THREE.MeshStandardMaterial({
      color: 0xe8e6e2, roughness: 0.18, envMapIntensity: 0.9,
    }));
    const irisMat = track(new THREE.MeshStandardMaterial({
      color: new THREE.Color(iris), roughness: 0.10, envMapIntensity: 1.9,
    }));
    const pupilMat = track(new THREE.MeshStandardMaterial({
      color: 0x0a0a0c, roughness: 0.06, envMapIntensity: 2.0,
    }));
    for (const e of [eyes.left, eyes.right]) {
      const ball = new THREE.Mesh(track(new THREE.SphereGeometry(e.radius, 24, 18)), scleraMat);
      ball.position.set(e.x, e.y, e.z);
      const irisMesh = new THREE.Mesh(track(new THREE.SphereGeometry(e.radius * 0.46, 20, 14)), irisMat);
      irisMesh.position.set(e.x, e.y, e.z + e.radius * 0.70);
      const pupil = new THREE.Mesh(track(new THREE.SphereGeometry(e.radius * 0.20, 14, 10)), pupilMat);
      pupil.position.set(e.x, e.y, e.z + e.radius * 0.88);
      root.add(ball, irisMesh, pupil);
      eyeMeshes.push(ball, irisMesh, pupil);
    }

    const hairHex = HAIR_COLORS[Math.min(HAIR_COLORS.length - 1, Math.max(0, aged.hairColor))];

    const beard = buildFacialHairMesh(head, genome.facialHair, genome);
    if (beard) {
      const beardColor = new THREE.Color(hairHex).multiplyScalar(0.72);
      beardMesh = new THREE.Mesh(track(toBufferGeometry(beard)), track(makeShellMaterial(beardColor, 0.92)));
      root.add(beardMesh);
    }

    // Hair uses the AGED style so recession and greying show without touching
    // the stored genome.
    const hair = buildHairMesh(head, aged.hairStyle, age);
    if (hair) {
      hairMesh = new THREE.Mesh(track(toBufferGeometry(hair)), track(makeShellMaterial(hairHex, 0.78)));
      root.add(hairMesh);
    }
  }

  function setRotation(yaw: number, pitch: number): void {
    root.rotation.y = yaw;
    // Clamped: past ~30 degrees the camera looks up the character's nose, and
    // there is no geometry inside the head to look at.
    root.rotation.x = Math.max(-0.5, Math.min(0.5, pitch));
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
    // forceContextLoss releases the native GL context. Without it the context
    // survives the component unmount and a few creator visits exhaust the
    // per-process context limit, which surfaces as a hard crash rather than a
    // blank view.
    try { renderer.forceContextLoss(); } catch { /* not available on every driver */ }
  }

  update(initial);

  return { scene, camera, renderer, root, update, setRotation, render, resize, dispose };
}
