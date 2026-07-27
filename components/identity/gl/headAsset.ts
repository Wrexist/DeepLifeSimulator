/**
 * Loading the character head GLB.
 *
 * The head is built offline by `scripts/build-ict-head.mjs` from ICT-FaceKit
 * (MIT) and ships as one binary glTF with 21 semantic morph targets whose names
 * are the app's own `FACE_MORPH_KEYS`. This module turns that file into a
 * three.js geometry exactly once per process.
 *
 * ## Why a module-level cache
 *
 * Parsing is ~1 MB of quantized, sparse-encoded glTF. The creator screen can be
 * opened, closed and reopened freely, and a per-mount parse would stutter the
 * transition every time. The parsed GEOMETRY is shared and never mutated —
 * morphs are driven through `morphTargetInfluences`, which lives on the Mesh,
 * not the geometry, so any number of meshes can share one buffer safely.
 *
 * ## Why it may legitimately fail
 *
 * `expo-asset` and `expo-gl` are native modules, so an OTA build running older
 * native code will not have them (DEV.md § Native modules). Every failure path
 * resolves to `null` rather than throwing: the caller falls back to the
 * procedural head, and a character always has a face.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { logger } from '@/utils/logger';
import { deriveEyeAxes, IRIS_FIT_TOLERANCE, type EyeAxes } from './eyeAxis';

export interface HeadAsset {
  /**
   * The loaded glTF scene root, NOT the bare mesh.
   *
   * `KHR_mesh_quantization` stores positions as integers and compensates with a
   * transform on the node. Handing out the mesh alone loses that transform, and
   * scaling the mesh applies a second one on top of it — which rendered the
   * head at a fraction of its size, sitting tiny in the middle of frame.
   */
  scene: THREE.Object3D;
  /** The skin mesh — the one whose morph names define the rig. */
  mesh: THREE.Mesh;
  /**
   * Every mesh in the asset. All of them must be driven: each primitive carries
   * the full morph set, and driving only the skin would widen the face while
   * leaving the eyeballs behind in the old sockets.
   */
  meshes: THREE.Mesh[];
  /**
   * Meshes keyed by glTF material name — `skin`, `sclera`, `iris`.
   *
   * The head is one mesh with three primitives so that skin and eyes can carry
   * genuinely different materials; three surfaces that as three Meshes. The
   * names are the build script's contract.
   */
  parts: Record<string, THREE.Mesh>;
  /** Morph target names, in the index order `morphTargetInfluences` uses. */
  morphNames: string[];
  /**
   * Eye centres, gaze axes and angular scale, refitted from the sclera.
   *
   * Null when the asset carries no `_irisr`, or when the refit failed to
   * reproduce it — in which case the eye shaders keep using the per-vertex
   * attribute. See `eyeAxis.ts` for why the reconstruction exists and what it
   * replaces.
   */
  eyeAxes: EyeAxes | null;
}

let cached: HeadAsset | null | undefined;
let inFlight: Promise<HeadAsset | null> | null = null;

/** Lazy native-module load, per the project convention. */
function loadExpoAsset(): typeof import('expo-asset') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-asset');
  } catch (err) {
    logger.warn('[headAsset] expo-asset unavailable', { error: String(err) });
    return null;
  }
}

/**
 * Read the bundled GLB as an ArrayBuffer.
 *
 * On a device the asset resolves to a `file://` URI that `fetch` can read; in a
 * web bundle it is an http URL. Both go through `fetch`, so there is one path
 * rather than a platform branch that only one of them ever exercises.
 */
async function readGlb(): Promise<ArrayBuffer | null> {
  const expoAsset = loadExpoAsset();
  if (!expoAsset) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@/assets/models/head_ict.glb');
    const asset = expoAsset.Asset.fromModule(mod);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (!uri) return null;
    const res = await fetch(uri);
    return await res.arrayBuffer();
  } catch (err) {
    logger.warn('[headAsset] could not read head_ict.glb', { error: String(err) });
    return null;
  }
}

/**
 * Pull the single skinned head geometry out of the parsed glTF.
 *
 * The build script writes exactly one mesh with one primitive, so anything else
 * means the asset was rebuilt differently and the caller should fall back
 * rather than render whichever mesh happened to come first.
 */
function extractGeometry(gltf: { scene: THREE.Object3D }): HeadAsset | null {
  const meshes: THREE.Mesh[] = [];
  const parts: Record<string, THREE.Mesh> = {};
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes.push(m);
    const name = (m.material as THREE.Material | undefined)?.name;
    if (name) parts[name] = m;
  });
  if (meshes.length === 0) {
    logger.warn('[headAsset] no meshes in the asset');
    return null;
  }
  const mesh = parts.skin ?? meshes[0];
  const dict = mesh.morphTargetDictionary;
  if (!mesh.geometry.morphAttributes.position?.length || !dict) {
    logger.warn('[headAsset] head has no morph targets — sliders would be inert');
    return null;
  }
  // morphTargetDictionary maps name -> index; invert it so index order (which is
  // what morphTargetInfluences is addressed by) is authoritative.
  const morphNames: string[] = [];
  for (const [name, index] of Object.entries(dict)) morphNames[index] = name;

  return { scene: gltf.scene, mesh, meshes, parts, morphNames, eyeAxes: fitEyeAxes(parts.sclera) };
}

/**
 * Refit the iris coordinate from the SCLERA, once, at load.
 *
 * The sclera and not the iris: the build script fits one sphere per eye to the
 * sclera and uses that one centre for both surfaces, and the iris shell is then
 * pushed outward along the same radii — so refitting a sphere to the iris finds
 * the pushed radius from an annulus, which is a badly conditioned fit. Measured
 * on the shipped asset it lands 0.005 further forward and triples the residual,
 * for a surface that shares the sclera's axis by construction.
 */
function fitEyeAxes(sclera: THREE.Mesh | undefined): EyeAxes | null {
  const attr = sclera?.geometry?.getAttribute('_irisr');
  const pos = sclera?.geometry?.getAttribute('position');
  if (!attr || !pos || attr.count !== pos.count) return null;
  // Through the accessors rather than off `.array`: the asset is quantized, so
  // the raw buffer is normalized integers and reading it directly would fit a
  // sphere to the wrong numbers.
  const irisR = new Float32Array(attr.count);
  const positions = new Float32Array(pos.count * 3);
  for (let i = 0; i < attr.count; i++) {
    irisR[i] = attr.getX(i);
    positions[i * 3] = pos.getX(i);
    positions[i * 3 + 1] = pos.getY(i);
    positions[i * 3 + 2] = pos.getZ(i);
  }
  const axes = deriveEyeAxes(irisR, positions);
  if (!axes) {
    logger.warn('[headAsset] could not refit the iris axes — using the baked attribute');
    return null;
  }
  if (axes.residual > IRIS_FIT_TOLERANCE) {
    logger.warn('[headAsset] iris refit does not reproduce the bake — using the baked attribute', {
      residual: axes.residual,
    });
    return null;
  }
  return axes;
}

/**
 * Load (or return the cached) head asset. Never throws.
 *
 * Concurrent callers share one in-flight promise — the creator mounts the
 * canvas and the portrait capture at the same time, and without this they would
 * each parse the file.
 */
export async function loadHeadAsset(): Promise<HeadAsset | null> {
  if (cached !== undefined) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const buffer = await readGlb();
    if (!buffer) {
      cached = null;
      return null;
    }
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.parseAsync(buffer, '');
      cached = extractGeometry(gltf as unknown as { scene: THREE.Object3D });
    } catch (err) {
      logger.warn('[headAsset] GLTF parse failed', { error: String(err) });
      cached = null;
    }
    return cached ?? null;
  })();

  const result = await inFlight;
  inFlight = null;
  return result;
}

/** Test seam — lets a suite reset the module cache between cases. */
export function __resetHeadAssetCache(): void {
  cached = undefined;
  inFlight = null;
  textureCache = undefined;
}

export interface SkinTextures {
  albedo: THREE.Texture | null;
  roughness: THREE.Texture | null;
  normal: THREE.Texture | null;
}

let textureCache: SkinTextures | undefined;

/**
 * Build a three.js texture from a bundled image, the React Native way.
 *
 * `THREE.TextureLoader` cannot be used here: it goes through `ImageLoader`,
 * which needs `document.createElement('img')`. Under expo-gl the supported route
 * is to hand the renderer an Expo asset directly — its `texImage2D` accepts an
 * object carrying `localUri` and uploads it natively.
 *
 * Every failure returns null and the caller ships an untextured material, which
 * still renders a correct (if plainer) face. Texture loading must never be able
 * to take the creator down.
 */
async function loadTexture(mod: unknown, srgb: boolean): Promise<THREE.Texture | null> {
  const expoAsset = loadExpoAsset();
  if (!expoAsset) return null;
  try {
    const asset = expoAsset.Asset.fromModule(mod as never);
    await asset.downloadAsync();
    if (!asset.localUri && !asset.uri) return null;
    const texture = new THREE.Texture();
    (texture as unknown as { image: unknown }).image = {
      data: asset,
      width: asset.width ?? 1024,
      height: asset.height ?? 1024,
      localUri: asset.localUri ?? asset.uri,
    };
    // glTF's UV origin is the opposite of three's default, and the head's UVs
    // were written to glTF convention by the build script. Left flipped, the
    // lips and eye-socket shading land on the wrong side of the face.
    texture.flipY = false;
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  } catch (err) {
    logger.warn('[headAsset] texture load failed', { error: String(err) });
    return null;
  }
}

/** Load (or return the cached) skin texture set. Never throws. */
export async function loadSkinTextures(): Promise<SkinTextures> {
  if (textureCache) return textureCache;
  try {
    const [albedo, roughness, normal] = await Promise.all([
      /* eslint-disable @typescript-eslint/no-var-requires */
      loadTexture(require('@/assets/textures/face_albedo.png'), true),
      loadTexture(require('@/assets/textures/face_roughness.png'), false),
      loadTexture(require('@/assets/textures/face_normal.png'), false),
      /* eslint-enable @typescript-eslint/no-var-requires */
    ]);
    textureCache = { albedo, roughness, normal };
  } catch (err) {
    logger.warn('[headAsset] skin textures unavailable', { error: String(err) });
    textureCache = { albedo: null, roughness: null, normal: null };
  }
  return textureCache;
}
