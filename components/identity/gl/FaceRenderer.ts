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
  bindGenomeToRig,
  genomeToInfluences,
  type BodyProfile,
  type FaceGenome,
  type MeshData,
  type RigBinding,
} from '@/lib/identity';
import { createStudioEnvironment } from '@/components/luxury/gl/studioEnvironment';
import { loadHeadAsset, loadSkinTextures, type HeadAsset, type SkinTextures } from './headAsset';

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
  options: {
    background?: string;
    /**
     * Called when the scanned head finishes loading and replaces the procedural
     * one. The canvas render loop only draws when marked dirty, so without this
     * the swap would not appear until the next slider drag.
     */
    onInvalidate?: () => void;
  } = {},
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

  // --- Scanned head (ICT-FaceKit) ------------------------------------------
  //
  // When the GLB is available it replaces the procedural head entirely. The two
  // paths are kept side by side rather than the procedural one being deleted,
  // because expo-asset is a native module: an OTA build on older native code
  // has no way to read the file, and a character must always have a face.
  /**
   * Hair thickness per style, as a fraction of head size, and how high up the
   * scalp the hair mass starts. Mirrors the procedural head's spec table so the
   * two paths read as the same character, and the values are fractions for the
   * reason recorded where they are applied.
   */
  const HAIR_SPEC: Record<string, { frac: number; low: number }> = {
    buzz: { frac: 0.035, low: 0.34 },
    short: { frac: 0.055, low: 0.30 },
    medium: { frac: 0.080, low: 0.24 },
    long: { frac: 0.095, low: 0.18 },
    ponytail: { frac: 0.075, low: 0.22 },
    afro: { frac: 0.130, low: 0.30 },
    bun: { frac: 0.070, low: 0.26 },
  };
  const assetHairUniforms = {
    uThickness: { value: 0.2 },
    uLow: { value: 0.3 },
  };
  let assetHair: THREE.Mesh | null = null;
  let assetGeomExtent = 1;
  let assetParts: Record<string, THREE.Mesh> | null = null;
  let assetMeshes: THREE.Mesh[] = [];
  let assetBinding: RigBinding | null = null;
  let lastInput: FaceSceneInput = initial;

  /**
   * Push a genome onto the scanned head.
   *
   * This is the payoff of morph targets: it writes ~21 floats and touches no
   * buffers at all. The procedural path rebuilds and re-uploads the whole mesh
   * on every slider frame, which is what made dragging expensive.
   */
  function applyAssetGenome(input: FaceSceneInput): void {
    if (!assetParts || !assetBinding) return;
    // `signed`: the ICT head's morphs are linear combinations of a scan-derived
    // PCA basis, so a negative influence is a real face on the same manifold.
    // That makes every slider bipolar without baking a second target per axis —
    // the lower half was otherwise inert, since a single target only expresses
    // "more". Verified by rendering -1 / 0 / +1: three distinct plausible faces.
    const { influences: byName } = genomeToInfluences(input.genome, assetBinding, { signed: true });

    // EVERY primitive, not just the skin. Each carries the full morph set, and
    // driving only the skin would widen the face while leaving the eyeballs
    // behind in the old sockets.
    for (const mesh of assetMeshes) {
      const influences = mesh.morphTargetInfluences;
      const dict = mesh.morphTargetDictionary;
      if (!influences || !dict) continue;
      // Zero first. A morph left over from the previous genome would otherwise
      // stay applied — the classic stale-influence bug, which looks like the
      // slider you just moved affecting an unrelated feature.
      influences.fill(0);
      for (const [name, value] of Object.entries(byName)) {
        const index = dict[name];
        if (index !== undefined) influences[index] = value;
      }
    }

    const aged = applyAging(input.genome, input.age);
    const skin = SKIN_TONES[Math.min(SKIN_TONES.length - 1, Math.max(0, aged.skinTone))];
    const iris = EYE_COLORS[Math.min(EYE_COLORS.length - 1, Math.max(0, aged.eyeColor))];
    const skinMat = assetParts.skin?.material as THREE.MeshPhysicalMaterial | undefined;
    if (skinMat) skinMat.color.set(skin);
    const irisMat = assetParts.iris?.material as THREE.MeshPhysicalMaterial | undefined;
    if (irisMat) irisMat.color.set(iris);

    if (assetHair) {
      // The AGED style, so recession and greying show without touching the
      // stored genome — same rule the procedural path follows.
      const spec = HAIR_SPEC[aged.hairStyle];
      assetHair.visible = aged.hairStyle !== 'bald' && !!spec;
      if (spec) {
        assetHairUniforms.uThickness.value = spec.frac * assetGeomExtent;
        // Recession lifts the hairline on the top-front of the skull with age.
        const recession = Math.max(0, Math.min(1, (input.age - 45) / 35));
        assetHairUniforms.uLow.value = spec.low + recession * 0.18;
        const hairHex = HAIR_COLORS[Math.min(HAIR_COLORS.length - 1, Math.max(0, aged.hairColor))];
        (assetHair.material as THREE.MeshStandardMaterial).color.set(hairHex);
      }
    }
  }

  function adoptAsset(asset: HeadAsset, textures: SkinTextures): void {
    if (disposed) return;
    clearRoot();

    assetBinding = bindGenomeToRig(asset.morphNames);

    assetParts = asset.parts;
    assetMeshes = asset.meshes;

    if (asset.parts.skin) {
      asset.parts.skin.material = track(new THREE.MeshPhysicalMaterial({
        color: 0xd8a887,
        // The albedo map is near-neutral DETAIL — creases, mottling, a redder
        // mouth — so `color` carries the palette tone and multiplies through it.
        // Baking tone into the texture would mean ten of them.
        map: textures.albedo ?? null,
        roughnessMap: textures.roughness ?? null,
        normalMap: textures.normal ?? null,
        normalScale: new THREE.Vector2(0.6, 0.6),
        // roughness 1 so the MAP is the value rather than a factor scaling it
        // down; with a map absent this falls back to a sane single value below.
        roughness: textures.roughness ? 1 : 0.72,
        metalness: 0,
        // Same 0.05 as the procedural head, for the same reason: at 0.22 the skin
        // reads as moulded chocolate. Skin is mostly diffuse; the sheen is a hint.
        clearcoat: 0.05,
        clearcoatRoughness: 0.7,
        // 0.45, not the procedural head's 0.7 — see the relight note below.
        envMapIntensity: 0.45,
      }));
    }
    // Eyes get their own wet materials. This is the cheapest large win in a
    // portrait: sharing the skin's roughness leaves the eyes with no catchlight
    // and the whole face reads dead, however good the geometry is.
    if (asset.parts.sclera) {
      asset.parts.sclera.material = track(new THREE.MeshPhysicalMaterial({
        color: 0xe9e7e4, roughness: 0.14, metalness: 0,
        clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6,
      }));
    }
    if (asset.parts.iris) {
      asset.parts.iris.material = track(new THREE.MeshPhysicalMaterial({
        color: 0x4a6b8a, roughness: 0.08, metalness: 0,
        clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.4,
      }));
    }
    // Geometry and textures are shared and cached, so they are deliberately NOT
    // tracked for disposal — freeing them would break the next canvas to mount.
    // Materials ARE tracked, because they are created per scene.

    // Hair: a second mesh over the SAME geometry, grown outward along the normal
    // by the baked `_scalp` weight. Sharing the buffer means it inherits all 21
    // morph targets for free and follows the face as the sliders move it; a
    // separate hair mesh would need its own copy of every one of them.
    if (asset.parts.skin?.geometry.getAttribute('_scalp')) {
      const hairMat = track(new THREE.MeshStandardMaterial({
        color: 0x2c1b12, roughness: 0.86, metalness: 0,
        transparent: true, depthWrite: true,
      }));
      hairMat.onBeforeCompile = (shader) => {
        shader.uniforms.uThickness = assetHairUniforms.uThickness;
        shader.uniforms.uLow = assetHairUniforms.uLow;
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            '#include <common>\nattribute float _scalp;\nvarying float vScalp;\nuniform float uThickness;\nuniform float uLow;',
          )
          .replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nvScalp = _scalp;\n' +
              'transformed += normalize(objectNormal) * uThickness * smoothstep(uLow, 1.0, _scalp);',
          );
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vScalp;\nuniform float uLow;')
          .replace(
            '#include <dithering_fragment>',
            '#include <dithering_fragment>\n' +
              // Discard the bare fringe outright so it never darkens the skin
              // beneath, then fade so the hairline is soft, not a hard cap edge.
              'if (vScalp < uLow) discard;\n' +
              'gl_FragColor.a *= smoothstep(uLow, uLow + 0.22, vScalp);',
          );
      };
      assetHair = new THREE.Mesh(asset.parts.skin.geometry, hairMat);
      asset.parts.skin.parent?.add(assetHair);
      assetMeshes = [...assetMeshes, assetHair];

      // Thickness is a FRACTION of head size, resolved against the geometry's
      // own extent. That extent is KHR_mesh_quantization's local space (~3.6,
      // not the model's 36), and absolute values were ~15% of the head: the
      // shell tore into spikes as adjacent vertices were pushed apart along
      // diverging normals.
      asset.parts.skin.geometry.computeBoundingBox();
      const gb = asset.parts.skin.geometry.boundingBox;
      assetGeomExtent = gb
        ? Math.max(gb.max.x - gb.min.x, gb.max.y - gb.min.y, gb.max.z - gb.min.z) || 1
        : 1;
    }

    // Frame on the SKIN, not the whole scene. The hair shell stands off the
    // scalp, so including it shrinks the head in frame — and by a different
    // amount per haircut, which would make framing depend on the hairstyle.
    //
    // Frame from the WORLD box of the loaded scene, and scale a wrapper rather
    // than the mesh. `KHR_mesh_quantization` puts a compensating transform on
    // the node, so the mesh's own bounding box is in pre-compensation units and
    // scaling the mesh applies a second factor on top: the head rendered at a
    // fraction of its size, tiny in the middle of frame.
    const holder = new THREE.Group();
    holder.add(asset.scene);
    // Framed from the NEUTRAL position attribute, not setFromObject.
    //
    // Box3.setFromObject expands the box to cover every morph target at full
    // influence, so the frame gets sized for the most extreme face the rig can
    // reach (61 units against the neutral head's 36) and every character
    // renders small, leaving room for a face nobody chose.
    asset.scene.updateWorldMatrix(true, true);
    const framedOn = asset.parts.skin ?? asset.meshes[0];
    const box = new THREE.Box3()
      .setFromBufferAttribute(framedOn.geometry.getAttribute('position') as THREE.BufferAttribute)
      .applyMatrix4(framedOn.matrixWorld);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const scale = 2.35 / (Math.max(size.x, size.y, size.z) || 1);
    holder.scale.setScalar(scale);
    // Centred, then biased up so the FACE fills the frame rather than the neck
    // and shoulders, which occupy the lower third of the model.
    holder.position.set(-centre.x * scale, -centre.y * scale + 0.30, -centre.z * scale);
    root.add(holder);

    // Relight for the scanned head. These are NOT the procedural head's values
    // and must not be shared with it: a scan-derived mesh has real surface
    // normals and catches far more light, so the old rig (exposure 1.45, key
    // 1.7) blew the face out to a flat white mask. Measured by rendering the
    // full skin palette — the darkest tone still holds its form at 0.8, which
    // is the check that matters, since crushing deep tones is what forced the
    // procedural head up to 1.45 in the first place.
    renderer.toneMappingExposure = 0.8;
    key.intensity = 0.85;
    fill.intensity = 0.3;
    rim.intensity = 0.45;

    applyAssetGenome(lastInput);
    options.onInvalidate?.();
  }

  function update(input: FaceSceneInput): void {
    if (disposed) return;
    lastInput = input;

    // Scanned head: morph influences only, no rebuild.
    if (assetParts) {
      applyAssetGenome(input);
      return;
    }

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

  // Draw the procedural head immediately so the canvas is never blank, then
  // swap in the scanned one when it arrives. Loading is ~1 MB of parsing; making
  // the creator wait on it would show an empty frame on every open.
  update(initial);
  void Promise.all([loadHeadAsset(), loadSkinTextures()]).then(([asset, textures]) => {
    if (asset && !disposed) adoptAsset(asset, textures);
  });

  return { scene, camera, renderer, root, update, setRotation, render, resize, dispose };
}
