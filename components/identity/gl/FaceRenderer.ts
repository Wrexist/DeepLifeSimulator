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

  /**
   * The backdrop.
   *
   * Without one the head floats on a flat fill, which is the single least
   * premium thing in the frame: a portrait is as much about what is behind the
   * subject as the subject, and a studio photograph is never shot against a
   * uniform colour. This is the cheapest version of a lit sweep — a radial
   * falloff, warm where the key light would spill and cool at the edges, with
   * the head's own shadow implied by darkening the lower half.
   *
   * Drawn FIRST with no depth write, so it never occludes the head however
   * close the camera gets, and it costs one full-screen quad of arithmetic.
   *
   * `background: null` (the default) keeps the canvas transparent instead, for
   * any surface that wants the app's own background behind the head.
   */
  function createBackdrop(): THREE.Mesh {
    const material = new THREE.ShaderMaterial({
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTop: { value: new THREE.Color('#1B2436') },
        uBottom: { value: new THREE.Color('#070A10') },
        uGlow: { value: new THREE.Color('#31405C') },
      },
      vertexShader: `
        varying vec2 vXy;
        void main() {
          vXy = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec2 vXy;
        uniform vec3 uTop, uBottom, uGlow;
        void main() {
          // Vertical sweep first, then a soft pool of light behind where the
          // head sits. Centred slightly above the origin because that is where
          // the face is once the crown is placed — see the framing note.
          float v = clamp(vXy.y * 0.14 + 0.5, 0.0, 1.0);
          vec3 base = mix(uBottom, uTop, v);
          // Centred BEHIND THE FACE, not above it. At this plane's depth the
          // frame is twice the head's height, so a pool centred on the crown
          // lights the empty top of the frame and leaves the subject against
          // the dark part — the opposite of what a portrait backdrop is for.
          float d = length(vec2(vXy.x * 0.9, vXy.y - 0.35));
          gl_FragColor = vec4(mix(base, uGlow, 0.72 * exp(-d * d * 0.055)), 1.0);
        }`,
    });
    // Big enough to fill the frustum at its depth from any aspect this canvas
    // is given; it costs nothing to be generous with two triangles.
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), material);
    mesh.position.z = -6;
    mesh.renderOrder = -1;
    return mesh;
  }

  // Only when the caller wants an opaque canvas. With a transparent one the
  // backdrop would cover the app's own surface rather than sit behind the head.
  //
  // NOT tracked in `geometries`/`materials`: those are emptied and disposed by
  // `clearRoot()` on every genome change, and the backdrop outlives the head.
  // It is freed in `dispose()` with the rest of the scene-level resources.
  const backdrop = options.background === undefined ? createBackdrop() : null;
  if (backdrop) scene.add(backdrop);

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
  const HAIR_SPEC: Record<string, {
    frac: number; low: number; base?: number;
    front?: number; side?: number; back?: number;
    strip?: number; stripW?: number; frizz?: number;
    fade?: number; fadeY?: number; part?: number; partX?: number;
    wave?: number; rows?: number; lift?: [number, number];
  }> = {
    // LENGTH IS COVERAGE, NOT THICKNESS.
    //
    // The shell is a hollow open-bottomed cap. While it hugs the skull it reads
    // as hair on a head; the moment it balloons past the silhouette you see its
    // rim and unlit interior as a flat grey plate. Rendering the shell without
    // the head made that unmistakable — the thick styles were domes with the
    // underside showing, which is what made every one of them look like a helmet.
    //
    // So thickness stays small for every style, and `low` is a threshold on the
    // baked hairline coordinate: 0.60 IS the hairline, above it is scalp, below
    // it runs down the sides and back of the skull. Lowering it lengthens the
    // cut. This technique does short-to-medium convincingly and cannot do
    // genuinely long hair.
    buzz:         { frac: 0.020, low: 0.68, base: 1.0 },
    crew:         { frac: 0.026, low: 0.64, base: 1.0, front: 0.20, side: -0.30 },
    short:        { frac: 0.032, low: 0.60, base: 1.0 },
    fringe:       { frac: 0.036, low: 0.56, base: 1.0, front: 0.50 },
    medium:       { frac: 0.040, low: 0.48, base: 1.0 },
    long:         { frac: 0.042, low: 0.16, base: 1.0, back: 0.25 },
    ponytail:     { frac: 0.036, low: 0.30, base: 1.0, back: 0.35, side: -0.45 },
    bun:          { frac: 0.034, low: 0.42, base: 1.0, back: 0.30, side: -0.35 },
    afro:         { frac: 0.052, low: 0.58, base: 1.15, frizz: 0.20 },
    curls:        { frac: 0.044, low: 0.52, base: 1.10, frizz: 0.35 },
    mohawk:       { frac: 0.058, low: 0.56, base: 1.15, strip: 1, stripW: 0.13 },
    undercut:     { frac: 0.036, low: 0.58, base: 1.0, side: -1.20 },
    quiff:        { frac: 0.040, low: 0.60, base: 0.90, front: 0.70, side: -0.50, lift: [0.10, 0.55] },
    receding:     { frac: 0.028, low: 0.74, base: 1.0 },
    // The everyday cuts. The first fifteen were shape experiments and several are
    // things nobody asks a barber for; these are what people actually wear, and
    // they are separated by PART, FADE and LIFT rather than by thickness — which
    // is why they no longer read as one haircut at four lengths.
    sidePart:     { frac: 0.034, low: 0.58, part: 0.60, partX: -0.34, side: -0.25 },
    combOver:     { frac: 0.038, low: 0.56, part: 0.45, partX: -0.46, side: -0.35, lift: [0.30, 0.10] },
    slickBack:    { frac: 0.032, low: 0.58, front: -0.10, lift: [-0.55, 0.30] },
    pompadour:    { frac: 0.044, low: 0.60, front: 0.60, side: -0.60, lift: [0.15, 0.85] },
    caesar:       { frac: 0.030, low: 0.60, front: 0.35, side: -0.25 },
    ivyLeague:    { frac: 0.032, low: 0.58, front: 0.30, side: -0.40, fade: 0.6, fadeY: 0.74 },
    taperFade:    { frac: 0.034, low: 0.54, fade: 1.0, fadeY: 0.78 },
    highFade:     { frac: 0.038, low: 0.54, fade: 1.0, fadeY: 0.86 },
    buzzFade:     { frac: 0.022, low: 0.62, fade: 1.0, fadeY: 0.82 },
    texturedCrop: { frac: 0.038, low: 0.58, front: 0.45, side: -0.55, frizz: 0.30 },
    messy:        { frac: 0.042, low: 0.52, frizz: 0.50, lift: [0.05, 0.20] },
    bowl:         { frac: 0.038, low: 0.54, front: 0.55, side: 0.25 },
    curtains:     { frac: 0.042, low: 0.50, front: 0.55, part: 0.70, partX: 0.0 },
    layered:      { frac: 0.042, low: 0.34, back: 0.15, wave: 0.30 },
    bob:          { frac: 0.040, low: 0.30, side: 0.25, back: 0.10 },
    pixie:        { frac: 0.032, low: 0.56, side: -0.35, frizz: 0.20, part: 0.35, partX: -0.40 },
    spiky:        { frac: 0.042, low: 0.60, frizz: 0.80, lift: [0.0, 0.50] },
    flatTop:      { frac: 0.048, low: 0.62, side: -0.90, lift: [0.0, 0.40] },
    wavy:         { frac: 0.042, low: 0.44, wave: 0.55 },
    cornrows:     { frac: 0.026, low: 0.58, rows: 1 },
  };

  /**
   * Facial hair, as a mix over the three baked zone weights: moustache, chin,
   * jaw. The five styles are subsets of one region, so one bake serves them all.
   */
  const BEARD_SPEC: Record<string, {
    frac: number; mix: [number, number, number]; frizz: number; density: number;
  }> = {
    // DENSITY IS NOT THICKNESS. Stubble was a thin shell — 0.006 against a full
    // beard's 0.024 — painted in the same opaque near-black, so it rendered as
    // a full beard that happened to sit closer to the jaw. What separates
    // stubble from a beard is that you can see skin THROUGH it, which is a
    // coverage property and has nothing to do with how far the hair stands off.
    stubble:   { frac: 0.005, mix: [1, 1, 1], frizz: 0.5, density: 0.40 },
    moustache: { frac: 0.016, mix: [1, 0, 0], frizz: 0.2, density: 0.94 },
    goatee:    { frac: 0.018, mix: [1, 1, 0], frizz: 0.25, density: 0.94 },
    full:      { frac: 0.024, mix: [1, 1, 1], frizz: 0.3, density: 1.0 },
  };

  const assetHairUniforms = {
    uThickness: { value: 0.2 }, uLow: { value: 0.6 },
    uBase: { value: 1 }, uFront: { value: 0 }, uSide: { value: 0 }, uBack: { value: 0 },
    uStrip: { value: 0 }, uStripW: { value: 0.2 }, uFrizz: { value: 0 },
    uFade: { value: 0 }, uFadeY: { value: 0.78 },
    uPart: { value: 0 }, uPartX: { value: 0 },
    uWave: { value: 0 }, uRows: { value: 0 },
    uLift: { value: new THREE.Vector2(0, 0) },
    uHeadMin: { value: new THREE.Vector3() },
    uHeadSize: { value: new THREE.Vector3(1, 1, 1) },
    uHeadCentre: { value: new THREE.Vector3() },
  };
  /**
   * Brow colour, driven from the hair colour.
   *
   * Darker than the hair (0.46): brows are almost always a shade or two deeper
   * than the hair on the head, and a brow that exactly matches blonde hair
   * disappears into the forehead. The mix is 0.76 rather than full, so the
   * painted brow's own darkness still supplies the shape — tinting all the way
   * flattens it into a solid stripe of colour.
   */
  /** Scratch colour for the brow desaturation; avoids an allocation per frame. */
  const GREY = new THREE.Color();

  const assetSkinUniforms = {
    uBrowColor: { value: new THREE.Color(0x2a1c14) },
    /** `genome.blemishes`, [0, 1] — freckle and mottle density. */
    uBlemish: { value: 0.2 },
  };

  const assetBeardUniforms = {
    uThickness: { value: 0.02 },
    uMix: { value: new THREE.Vector3(1, 1, 1) },
    uFrizz: { value: 0.2 },
    uDensity: { value: 1 },
    uHeadCentre: { value: new THREE.Vector3() },
  };
  let assetBeard: THREE.Mesh | null = null;
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
    if (skinMat) {
      skinMat.color.set(skin);
      // ENVIRONMENT CONTRIBUTION SCALES WITH DARKNESS.
      //
      // Diffuse response falls with albedo but specular does not, so a deep
      // skin tone lit by a rig tuned for a pale one loses its form entirely —
      // swept across the palette, the darkest two entries rendered as
      // silhouettes with bright eyes floating on them. Real deep skin reads as
      // sheen and reflected light far more than pale skin does, so giving the
      // environment more weight where the albedo is dark is closer to the
      // physics than a flat value, not a cheat to rescue the render.
      const lum = 0.3 * skinMat.color.r + 0.59 * skinMat.color.g + 0.11 * skinMat.color.b;
      skinMat.envMapIntensity = 0.45 + 0.55 * (1 - Math.min(1, lum * 1.6));
    }
    const irisMat = assetParts.iris?.material as THREE.MeshPhysicalMaterial | undefined;
    if (irisMat) irisMat.color.set(iris);

    if (assetHair) {
      // The AGED style, so recession and greying show without touching the
      // stored genome — same rule the procedural path follows.
      const spec = HAIR_SPEC[aged.hairStyle];
      assetHair.visible = aged.hairStyle !== 'bald' && !!spec;
      if (spec) {
        const u = assetHairUniforms;
        u.uThickness.value = spec.frac * assetGeomExtent;
        // Recession lifts the hairline on the top-front of the skull with age.
        // 0.12 on a field where 1.0 is the crown and 0.60 the hairline — a third
        // of the way from one to the other by 80, which is a real recession
        // without going bald in a rig that has a `bald` style of its own.
        const recession = Math.max(0, Math.min(1, (input.age - 45) / 35));
        u.uLow.value = spec.low + recession * 0.12;
        u.uBase.value = spec.base ?? 1;
        u.uFront.value = spec.front ?? 0;
        u.uSide.value = spec.side ?? 0;
        u.uBack.value = spec.back ?? 0;
        u.uStrip.value = spec.strip ?? 0;
        u.uStripW.value = spec.stripW ?? 0.2;
        u.uFrizz.value = spec.frizz ?? 0;
        u.uFade.value = spec.fade ?? 0;
        u.uFadeY.value = spec.fadeY ?? 0.78;
        u.uPart.value = spec.part ?? 0;
        u.uPartX.value = spec.partX ?? 0;
        u.uWave.value = spec.wave ?? 0;
        u.uRows.value = spec.rows ?? 0;
        u.uLift.value.set(spec.lift?.[0] ?? 0, spec.lift?.[1] ?? 0);
        const hairHex = HAIR_COLORS[Math.min(HAIR_COLORS.length - 1, Math.max(0, aged.hairColor))];
        (assetHair.material as THREE.MeshStandardMaterial).color.set(hairHex);
      }
    }
    // Brows follow the hair colour even when the character is bald: eyebrows do
    // not fall out with a shaved head, and a bald character with brows painted
    // the default brown is the same mismatch in the other direction.
    // DESATURATED, then darkened.
    //
    // Scaling the hair colour alone kept its full saturation, and a dark
    // saturated orange skews toward yellow-green through ACES: swept across the
    // palette, every blonde and light-brown character came out with distinctly
    // OLIVE eyebrows. Pulling a fifth of the way toward the colour's own
    // luminance removes the skew, and it is truer anyway — brow hair is coarser
    // and reads less saturated than the hair on the head.
    const brow = assetSkinUniforms.uBrowColor.value
      .set(HAIR_COLORS[Math.min(HAIR_COLORS.length - 1, Math.max(0, aged.hairColor))]);
    const browLum = 0.3 * brow.r + 0.59 * brow.g + 0.11 * brow.b;
    brow.lerp(GREY.setScalar(browLum), 0.22).multiplyScalar(0.56);
    // The AGED value: `applyAging` drifts this upward, which is what turns
    // freckles into age spots over a lifetime without a second field.
    assetSkinUniforms.uBlemish.value = Math.max(0, Math.min(1, aged.blemishes));
    if (assetBeard) {
      const spec = BEARD_SPEC[aged.facialHair];
      assetBeard.visible = aged.facialHair !== 'none' && !!spec;
      if (spec) {
        assetBeardUniforms.uThickness.value = spec.frac * assetGeomExtent;
        assetBeardUniforms.uMix.value.set(...spec.mix);
        assetBeardUniforms.uFrizz.value = spec.frizz;
        // Facial hair reads darker than scalp hair on the same head, so it is
        // the hair colour knocked down rather than a second palette to keep in
        // sync — a beard that does not match the hair looks like a costume.
        const hairHex = HAIR_COLORS[Math.min(HAIR_COLORS.length - 1, Math.max(0, aged.hairColor))];
        // Desaturated first, for the reason the eyebrows are — a dark saturated
        // orange skews toward yellow-green through ACES, and a blond beard came
        // out khaki.
        const beardColor = (assetBeard.material as THREE.MeshStandardMaterial).color.set(hairHex);
        const rawLum = 0.3 * beardColor.r + 0.59 * beardColor.g + 0.11 * beardColor.b;
        beardColor.lerp(GREY.setScalar(rawLum), 0.20).multiplyScalar(0.72);
        // A PALE BEARD HAS TO BE THINNER.
        //
        // Rendered on a grey-haired character the beard came out as a solid
        // light mask across the lower face — it read as a bandage, not hair.
        // A dark beard hides that it is an opaque shell because it also reads
        // as shadow; a pale one has nothing to hide behind. Grey and white hair
        // is genuinely more translucent than pigmented hair, so letting more
        // skin through at the light end is both the fix and the truth.
        const beardLum = 0.3 * beardColor.r + 0.59 * beardColor.g + 0.11 * beardColor.b;
        assetBeardUniforms.uDensity.value = spec.density * (1 - 0.68 * Math.min(1, beardLum * 2.0));
      }
    }
  }

  /**
   * Make a shell mesh move with the head.
   *
   * THIS IS NOT OPTIONAL AND IT IS NOT OBVIOUS. The hair and beard are separate
   * `THREE.Mesh`es over the SAME geometry, and three builds a fresh
   * `morphTargetDictionary` for every mesh from the geometry's morph attributes
   * — which carry no names, so the keys come out `'0'`, `'1'`, `'2'`. Every
   * caller here looks a morph up by NAME, every lookup returned `undefined`, and
   * the shells sat frozen in the neutral pose while the face moved underneath
   * them. Rail a few sliders and the skin punches out through the hair in
   * patches; the shell rendered on its own is whole, which is what proves the
   * hole is not in the coverage.
   *
   * Nothing failed. The comment two paragraphs up said the shells "inherit all
   * the morph targets and follow the face", the meshes had the right number of
   * influences, and the numbers were all zero.
   *
   * Sharing the ARRAY, rather than copying the dictionary, is what makes the
   * desync impossible rather than merely fixed: there is no second place to
   * write, so there is nothing left to keep in sync. Same geometry means the
   * same target order by construction.
   */
  function shareMorphs(source: THREE.Mesh, shell: THREE.Mesh): void {
    shell.morphTargetDictionary = source.morphTargetDictionary;
    shell.morphTargetInfluences = source.morphTargetInfluences;
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
        // 0.22, not 0.6. Combined with the old pore amplitude the normal map
        // was reading as pitted skin rather than smooth skin with pores; the
        // map is now a hint of surface, not a relief.
        normalScale: new THREE.Vector2(0.22, 0.22),
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
      // Cheap subsurface. Skin glows warm where it is thin and seen edge-on —
      // ear rims, nostrils, the edge of the jaw. Without it a smoothed head
      // reads as a mannequin, which is exactly what softening the pores made it
      // look like. Real SSS needs a second pass; a fresnel term costs nothing.
      //
      // And the EYEBROWS, which are painted into the albedo and were therefore
      // the same near-black on every character — platinum-blonde hair over
      // black brows, which reads as a mistake rather than as a choice. The
      // roughness map's blue channel carries a brow mask baked from the same
      // landmark polylines that painted them, so the two line up by
      // construction; here it just says where to tint.
      (asset.parts.skin.material as THREE.MeshPhysicalMaterial).onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, assetSkinUniforms);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\n' +
            'uniform vec3 uBrowColor;\nuniform float uBlemish;\n' +
            'float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }')
          .replace('#include <color_fragment>', '#include <color_fragment>\n' +
            (textures.roughness
              // Sampled with the same uv the roughness map uses. Mixing rather
              // than multiplying, because the painted brow is already dark: a
              // multiply would only ever make a blonde brow darker.
              ? 'vec2 skinRg = texture2D(roughnessMap, vRoughnessMapUv).gb;\n'
                + 'diffuseColor.rgb = mix(diffuseColor.rgb, uBrowColor, skinRg.y * 0.76);\n'
                // FRECKLES. `genome.blemishes` is stored in every save, drifts
                // upward with age and is inherited by children — and until now
                // nothing rendered it. A field the game maintains and never
                // shows is the same defect as a slider that moves nothing.
                //
                // The region comes from data already on the head: the roughness
                // map is matte on skin and glossy on lips, so thresholding it
                // gives "is this skin" for free, and the brow mask in blue
                // keeps them off the eyebrows. No new texture, no new bake.
                + 'float skinness = smoothstep(0.44, 0.60, skinRg.x) * (1.0 - skinRg.y);\n'
                // A HASH, not sines. This is the third time in this file that
                // a handful of sine waves has been tried for something meant to
                // look scattered — hair strands, beard stipple, and now
                // freckles — and the third time it has come out as a visible
                // lattice. Any small set of periodic functions has a period and
                // the eye finds it.
                //
                // Cells decide WHICH points carry a freckle and jitter decides
                // where inside the cell it sits, so the grid that generates them
                // never shows in the result.
                // vRoughnessMapUv, not vMapUv: this whole block is guarded on
                // the ROUGHNESS map existing, and if the albedo failed to load
                // on its own the albedo varying would not be declared and the
                // shader would fail to compile — taking the face with it.
                + 'vec2 uvF = vRoughnessMapUv * 380.0;\n'
                + 'vec2 cell = floor(uvF);\n'
                + 'vec2 jit = vec2(hash21(cell + 3.1), hash21(cell + 7.7)) - 0.5;\n'
                + 'float d = length(fract(uvF) - 0.5 - jit * 0.6);\n'
                + 'float freckle = smoothstep(0.34, 0.10, d) * step(0.86, hash21(cell));\n'
                + 'diffuseColor.rgb *= 1.0 - 0.34 * uBlemish * freckle * skinness;\n'
              : ''))
          .replace(
            '#include <dithering_fragment>',
            '#include <dithering_fragment>\n' +
              'float sss = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);\n' +
              'gl_FragColor.rgb += vec3(0.15, 0.045, 0.022) * sss;',
          );
      };
    }
    // Eyes get their own wet materials. This is the cheapest large win in a
    // portrait: sharing the skin's roughness leaves the eyes with no catchlight
    // and the whole face reads dead, however good the geometry is.
    if (asset.parts.sclera) {
      // The pupil is drawn on the SCLERA, not the iris.
      //
      // ICT's iris is an ANNULUS — the pupil is a hole in the geometry — so a
      // bright sclera showed straight through it and every eye had a white disc
      // where its pupil belongs. No shading of the iris can fix that; the
      // surface behind the hole is what has to go dark. `_irisr` is baked by the
      // build script for both surfaces on one shared scale, so the drawn pupil
      // lines up with the hole.
      const scleraMat = track(new THREE.MeshPhysicalMaterial({
        color: 0xdedbd6, roughness: 0.18, metalness: 0,
        clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.75,
      }));
      scleraMat.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float _irisr;\nvarying float vR;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvR = _irisr;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vR;')
          .replace(
            '#include <color_fragment>',
            '#include <color_fragment>\n' +
        'float r = vR;\n' +
              // THE PUPIL LIVES HERE. It has to: the iris shell is a sphere, and
              // its own specular sits on top of whatever colour it is given, so a
              // pupil painted on the iris comes out as a bright reflected disc
              // rather than a dark hole. Drawn on the sclera behind it, the
              // highlight passes over it as a glint instead of replacing it.
              // Concentric with the iris by construction — both read the same
              // angular coordinate about the same gaze axis.
              'diffuseColor.rgb = mix(vec3(0.010), diffuseColor.rgb, smoothstep(0.40, 0.50, r));\n' +
              // White, dimming where the eyeball turns away into the socket.
              'diffuseColor.rgb *= 0.90 + 0.10 * smoothstep(3.2, 1.2, r);\n' +
              // A soft shadow just outside the rim, where the limbus meets the
              // white. Real eyes are never a clean colour boundary there.
              'diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(1.0, 1.55, r));',
          );
      };
      asset.parts.sclera.material = scleraMat;
    }
    if (asset.parts.iris) {
      const irisMat = track(new THREE.MeshPhysicalMaterial({
        color: 0x4a6b8a, roughness: 0.12, metalness: 0,
        // 0.35, not 0.85, and clearcoatRoughness 0.16, not 0.10.
        //
        // At 0.85 the environment still mirrored as a pale DISC centred on the
        // pupil — visible only at close range, where it read as a white pupil
        // and made the eye look blind. A catchlight should be a glint riding
        // over the iris, and a glint is what a rougher, dimmer coat gives.
        clearcoat: 0.9, clearcoatRoughness: 0.16, envMapIntensity: 0.35,
      }));
      irisMat.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float _irisr;\nvarying float vR;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvR = _irisr;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vR;')
          .replace(
            '#include <color_fragment>',
            '#include <color_fragment>\n' +
                      // OUTSIDE THE RIM IS NOT IRIS. The shell is a full sphere, so without
              // this it covers the whole eyeball and no white can ever show.
              'if (vR > 1.02) discard;\n' +
              'float r = vR;\n' +
              // The pupil is drawn on the SCLERA behind this shell — see there.
              // What this must do is get out of its way: the iris fades to
              // nothing over the pupil rather than painting it.
              'float pupil = smoothstep(0.34, 0.50, r);\n' +
              // Limbal ring: the dark rim that separates iris from white. Its
              // absence is most of what makes a game eye look printed on.
              'float limbal = smoothstep(1.02, 0.86, r);\n' +
              // Radial fibres, and a strong lift toward the pupil.
              //
              // 1.52 at the centre rather than 1.25: the darkest eye colour in
              // the palette is #3B2415, and shaded flat it sits close enough to
              // the pupil that a brown-eyed character reads as having no pupil
              // at all — one dark mass with a catchlight on it. The contrast has
              // to come from lifting the IRIS, because the pupil is already as
              // dark as it can be.
              'float fibre = 0.88 + 0.12 * sin(r * 34.0);\n' +
              'diffuseColor.rgb *= pupil * limbal * fibre * (1.52 - 0.52 * r);\n' +
              // Cut the shell away over the pupil so the dark disc behind shows
              // through, rather than tinting it and keeping the shell's specular.
              'if (r < 0.33) discard;',
          );
      };
      asset.parts.iris.material = irisMat;
    }
    // Geometry and textures are shared and cached, so they are deliberately NOT
    // tracked for disposal — freeing them would break the next canvas to mount.
    // Materials ARE tracked, because they are created per scene.

    // Hair and facial hair: two more meshes over the SAME geometry, grown
    // outward along the normal from baked weights — `_scalp` for hair, `_beard`
    // for facial hair. Sharing the buffer means both inherit all 21 morph
    // targets and follow the face as the sliders move it; separate meshes would
    // each need their own copy of every morph.
    // Head bounds from the POSITION ATTRIBUTE, not computeBoundingBox().
    //
    // three expands a computed box over every morph target at full influence, so
    // it returns the widest face the rig can reach — extent 3.64 against the
    // neutral head's 2.00. Hair thickness is a fraction of that number and every
    // region mask is measured against it, so the shell ran 1.8x oversized (the
    // mushroom silhouette) and the masks read coordinates squeezed into the
    // middle of their range, which is why `undercut` and the fades did nearly
    // nothing. Same trap as the framing box below, in a second place.
    const posAttr = asset.parts.skin?.geometry.getAttribute('position') as
      THREE.BufferAttribute | undefined;
    if (posAttr) {
      const gb = new THREE.Box3().setFromBufferAttribute(posAttr);
      assetGeomExtent = Math.max(gb.max.x - gb.min.x, gb.max.y - gb.min.y, gb.max.z - gb.min.z) || 1;
      assetHairUniforms.uHeadMin.value.copy(gb.min);
      assetHairUniforms.uHeadSize.value.subVectors(gb.max, gb.min);
      gb.getCenter(assetHairUniforms.uHeadCentre.value);
      assetBeardUniforms.uHeadCentre.value.copy(assetHairUniforms.uHeadCentre.value);
    }

    if (asset.parts.skin?.geometry.getAttribute('_scalp')) {
      // OPAQUE, with a hard cut. Blending put the alpha ramp in
      // `dithering_fragment`, which runs AFTER `alphatest_fragment`, so alphaTest
      // never saw the lowered value: every semi-transparent fringe survived and
      // blended with the dark background into a grey haze around the silhouette.
      const hairMat = track(new THREE.MeshStandardMaterial({
        color: 0x2C1B12, roughness: 0.80, metalness: 0,
        side: THREE.FrontSide, envMapIntensity: 1.15,
        // Feathered edge, faded in `color_fragment` — BEFORE `alphatest_fragment`.
        // Lowering alpha in `dithering_fragment` (after the test) let every
        // fringe pixel survive and haze the silhouette grey; removing the fade
        // fixed that but left a hard jagged cut. Here we get both.
        //
        // THE CUTOFF HAS TO LAND WHERE THE OFFSET IS ZERO. Offset and alpha are
        // both driven by coverage, so a threshold of 0.14 against a ramp that
        // started at 0.26 hid the shell only after it had already lifted a third
        // of its thickness off the scalp: the hairline ended in a rim floating
        // above the skull with daylight under it. That gap is what a player sees.
        transparent: true, alphaTest: 0.06, depthWrite: true,
        // Coincident with the skin at that last pixel, so bias the hair forward
        // rather than let the depth test speckle along the hairline.
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      }));
      hairMat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, assetHairUniforms);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\n' +
            'attribute float _scalp;\nvarying float vAmt;\nvarying float vCov;\n' +
            'varying vec3 vHairP;\n' +
            'vec3 vHairDir;\nfloat vHairAmt;\n' +
            'uniform float uThickness, uLow, uBase, uFront, uSide, uBack, uStrip, uStripW, uFrizz;\n' +
            'uniform float uFade, uFadeY, uPart, uPartX, uWave, uRows;\n' +
            'uniform vec2 uLift;\n' +
            'uniform vec3 uHeadMin, uHeadSize, uHeadCentre;\n' +
            // Smooth in SPACE. A per-vertex hash makes neighbours diverge, which
            // tears the shell into shards at any real thickness.
            'float hnoise(vec3 p){ return 0.5 + 0.5 * sin(p.x*6.1) * sin(p.y*5.3) * sin(p.z*4.7); }')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n' +
            'vHairP = position;\n' +
            'vec3 hf = (position - uHeadMin) / max(uHeadSize, vec3(1e-4));\n' +
            'float fz = hf.z;\n' +                       // 0 nape, 1 forehead
            'float fy = hf.y;\n' +                       // 0 collar, 1 crown
            'float fx = abs(hf.x - 0.5) * 2.0;\n' +      // 0 centre, 1 side
            'float sx = (hf.x - 0.5) * 2.0;\n' +         // -1 left .. +1 right
            // Edges measured against the range the scalp field actually occupies
            // (fx to 0.74, fy from 0.47, fz 0.02..0.86), not against the head
            // box: the old smoothstep(0.40, 0.95, fx) topped out at 0.44, so
            // every side-weighted style ran at half strength.
            'float wFront = smoothstep(0.45, 0.85, fz);\n' +
            'float wSide  = smoothstep(0.20, 0.68, fx);\n' +
            'float wBack  = 1.0 - smoothstep(0.10, 0.50, fz);\n' +
            // COVERAGE AND VOLUME ARE SEPARATE. They used to be one number: the
            // region weights multiplied the coverage ramp, so a front weight did
            // not thicken the fringe, it pushed the whole coverage curve down and
            // dragged the hairline onto the eyebrows. Volume now scales thickness
            // only; a weight BELOW one still removes hair, by lifting the
            // coverage threshold, which is what an undercut or a fade does.
            'float region = clamp(uBase + uFront*wFront + uSide*wSide + uBack*wBack, 0.0, 2.5);\n' +
            'float lowHere = uLow + 0.30 * (1.0 - min(region, 1.0));\n' +
            // 0.16 wide, not 0.10: the coverage boundary is where the shell
            // rises off the skull, and a short ramp turns that rise into an
            // overhanging lip round the whole cut — the brim of the mushroom.
            'float cov = smoothstep(lowHere, lowHere + 0.16, _scalp);\n' +
            // Carving multiplies COVERAGE, so thickness reaches zero wherever
            // the hair does and no cut leaves a floating rim behind.
            //
            // Taper fade: short at the bottom of the sides, blending up. Held to
            // the sides by wSide — a fade that reaches the front is a receding
            // hairline, not a barber's cut.
            'cov *= mix(1.0, smoothstep(uFadeY - 0.08, uFadeY + 0.18, fy), uFade * wSide);\n' +
            // Parting: a narrow valley, off-centre for a side part. Forward of
            // the crown only; one that runs to the nape looks like a scar.
            'cov *= 1.0 - uPart * (1.0 - smoothstep(0.0, 0.11, abs(sx - uPartX)))\n' +
            '            * smoothstep(0.30, 0.68, fz);\n' +
            // Centre strip carves a mohawk; everything outside it goes to zero.
            'cov *= mix(1.0, 1.0 - smoothstep(uStripW, uStripW + 0.22, fx), uStrip);\n' +
            // Cornrows: many strips instead of one, running front-to-back.
            'cov *= 1.0 - uRows * 0.55 * (0.5 + 0.5 * cos(sx * 26.0));\n' +
            'vCov = cov;\n' +
            'float amt = cov * region;\n' +
            // Waves ride over the mass, so a wavy cut keeps the silhouette of
            // the cut it is a variant of.
            'amt *= 1.0 + uWave * 0.35 * sin(fy * 24.0 + fz * 6.0);\n' +
            // Thin at the nape, full at the crown. A constant offset balloons
            // the occipital region into a smooth dome that catches the rim light.
            'amt *= 0.42 + 0.58 * smoothstep(0.05, 0.62, fz);\n' +
            'amt *= 1.0 + uFrizz * (hnoise(position * 2.2) - 0.5);\n' +
            'amt = clamp(amt, 0.0, 1.6);\n' +
            'vAmt = amt;\n' +
            // Directional lift. A pompadour is not a thicker shell, it is the
            // same mass pushed up and forward at the front; offsetting purely
            // along the normal can only inflate the skull, which is why every
            // "voluminous" style used to come out as a bigger helmet.
            'vHairDir = normalize(normalize(objectNormal)\n' +
            '         + vec3(0.0, uLift.y, uLift.x) * wFront * 1.4);\n' +
            'vHairAmt = amt;')
          // THE OFFSET GOES ON AFTER THE MORPHS, NOT BEFORE.
          //
          // `begin_vertex` runs before `morphtarget_vertex`, and the NORMAL
          // attribute carries no morph deltas — so pushing the shell out there
          // offsets along the neutral pose's normal and lets the morph rotate
          // the surface out from under it. Rail a few sliders and the skin
          // punches through the hair in patches: rendering the shell alone
          // showed it whole, which is what proves it is penetration and not a
          // hole in the coverage.
          //
          // Blending in a RADIAL direction from the head centre fixes the
          // direction, because it is computed from the morphed position and so
          // follows the head. On a skull — convex almost everywhere hair grows —
          // radial is a good approximation of the normal, and keeping 40% of the
          // real normal preserves the silhouette detail radial alone would flatten.
          .replace('#include <morphtarget_vertex>', '#include <morphtarget_vertex>\n' +
            'vec3 hRadial = normalize(transformed - uHeadCentre);\n' +
            'transformed += normalize(mix(vHairDir, hRadial, 0.6)) * uThickness * vHairAmt;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\n' +
            'varying float vAmt;\nvarying float vCov;\nvarying vec3 vHairP;')
          .replace('#include <color_fragment>', '#include <color_fragment>\n' +
            // A WIDE feather. Narrow was right for killing the grey haze and
            // wrong for the hairline: the whole transition happened inside a
            // coverage band 0.04 wide, so the boundary was effectively a hard
            // isoline and interpolating it across triangles gave the fringe a
            // sawtooth edge. Over half the range it reads as hair thinning out.
            'diffuseColor.a *= smoothstep(0.02, 0.55, vCov);\n' +
            // Strand break-up, in ROUGHNESS ONLY (below). The same pattern in
            // the diffuse turned the cap into corduroy — regular light/dark
            // banding reads as ribbing in the surface, while in the specular
            // alone it reads as separate strands catching the light.
            'float strand = 0.55 * sin(vHairP.x * 233.0)\n' +
            '             + 0.27 * sin(vHairP.x * 97.0 + vHairP.z * 11.0)\n' +
            '             + 0.18 * sin(vHairP.x * 61.0 - vHairP.y * 29.0);\n' +
            // Roots darker than tips. One flat colour is most of what makes an
            // offset shell read as a plastic cap rather than as hair.
            'diffuseColor.rgb *= 0.62 + 0.52 * smoothstep(0.06, 1.10, vAmt);')
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' +
            'roughnessFactor = clamp(roughnessFactor - 0.16 * strand, 0.05, 1.0);');
      };
      assetHair = new THREE.Mesh(asset.parts.skin.geometry, hairMat);
      // Drawn after the skin; the shell is strictly outside it, so back-to-front
      // is simply skin-then-hair and no per-triangle sorting is needed.
      assetHair.renderOrder = 1;
      shareMorphs(asset.parts.skin, assetHair);
      asset.parts.skin.parent?.add(assetHair);
    }

    if (asset.parts.skin?.geometry.getAttribute('_beard')) {
      const beardMat = track(new THREE.MeshStandardMaterial({
        color: 0x241610, roughness: 0.86, metalness: 0,
        side: THREE.FrontSide, envMapIntensity: 0.9,
        transparent: true, alphaTest: 0.12, depthWrite: true,
      }));
      beardMat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, assetBeardUniforms);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\n' +
            'attribute vec3 _beard;\nvarying float vAmt;\n' +
            'uniform float uThickness, uFrizz, uDensity;\nuniform vec3 uMix, uHeadCentre;\n' +
            'vec3 vBeardDir;\nfloat vBeardAmt;\n' +
            'float bnoise(vec3 p){ return 0.5 + 0.5 * sin(p.x*15.0) * sin(p.y*13.0) * sin(p.z*11.0); }')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n' +
            'float amt = clamp(dot(_beard, uMix), 0.0, 1.0);\n' +
            'amt *= 1.0 + uFrizz * (bnoise(position * 3.0) - 0.5);\n' +
            'vAmt = amt;\n' +
            'vBeardDir = normalize(objectNormal);\nvBeardAmt = amt;')
          // After the morphs, for the reason given on the hair shell.
          .replace('#include <morphtarget_vertex>', '#include <morphtarget_vertex>\n' +
            'vec3 bRadial = normalize(transformed - uHeadCentre);\n' +
            'transformed += normalize(mix(vBeardDir, bRadial, 0.45)) * uThickness * vBeardAmt;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\n' +
            'varying float vAmt;\nuniform float uDensity;')
          // Wider feather than the hair: a beard has no edge in reality, it
          // thins out, and a hard boundary along the jaw looks painted on.
          .replace('#include <color_fragment>', '#include <color_fragment>\n' +
            'diffuseColor.a *= smoothstep(0.04, 0.52, vAmt);\n' +
            // STIPPLE, not a uniform fade. Lowering alpha evenly makes a grey
            // beard; dropping individual specks makes a sparse one, and sparse
            // is what stubble is. High frequency so the specks read as follicles
            // rather than as a pattern.
            // A FLAT alpha, not a stipple.
            //
            // Two attempts at drawing individual follicles both failed the same
            // way: a product of sines laid a lattice over the jaw and read as
            // netting, and a sum of them at incommensurate frequencies read as
            // herringbone. Any small set of sines is periodic, and the eye finds
            // the period every time.
            //
            // A five-o'clock shadow does not resolve into hairs at the size a
            // portrait is ever viewed — it is a TINT. Lowering the alpha and
            // letting the skin come through gives exactly that, costs one
            // multiply, and cannot alias into a pattern at any distance.
            'diffuseColor.a *= uDensity;\n' +
            // Tonal variation, as on the scalp. One flat near-black is most of
            // what made this read as ink rather than hair.
            'diffuseColor.rgb *= 0.78 + 0.34 * smoothstep(0.05, 0.9, vAmt);');
      };
      assetBeard = new THREE.Mesh(asset.parts.skin.geometry, beardMat);
      assetBeard.renderOrder = 1;
      shareMorphs(asset.parts.skin, assetBeard);
      asset.parts.skin.parent?.add(assetBeard);
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
    const scale = 2.45 / (Math.max(size.x, size.y, size.z) || 1);
    holder.scale.setScalar(scale);
    // HEADROOM, stated rather than left over.
    //
    // At fov 28 and z 6.2 the frame is ~3.09 units tall, so its top edge is at
    // y = 1.545. A 2.35-unit head biased up by 0.30 (plus the root's 0.12) put
    // the crown at 1.60 and the hair above that: every render sliced the top of
    // the skull off, and a haircut whose upper half is never visible reads as a
    // beret. Placing the crown at a fixed height instead of biasing the centre
    // keeps the face high in frame AND leaves room for the tallest style.
    const CROWN_Y = 1.10;
    holder.position.set(
      -centre.x * scale,
      CROWN_Y - (box.max.y - centre.y) * scale - root.position.y,
      -centre.z * scale,
    );
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
    backdrop?.geometry.dispose();
    (backdrop?.material as THREE.Material | undefined)?.dispose();
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
