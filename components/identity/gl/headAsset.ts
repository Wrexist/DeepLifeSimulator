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
  /** The single head mesh, for driving `morphTargetInfluences`. */
  mesh: THREE.Mesh;
  /** Morph target names, in the index order `morphTargetInfluences` uses. */
  morphNames: string[];
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
  gltf.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  if (meshes.length !== 1) {
    logger.warn('[headAsset] expected exactly one mesh', { found: meshes.length });
    return null;
  }
  const mesh = meshes[0];
  const dict = mesh.morphTargetDictionary;
  if (!mesh.geometry.morphAttributes.position?.length || !dict) {
    logger.warn('[headAsset] head has no morph targets — sliders would be inert');
    return null;
  }
  // morphTargetDictionary maps name -> index; invert it so index order (which is
  // what morphTargetInfluences is addressed by) is authoritative.
  const morphNames: string[] = [];
  for (const [name, index] of Object.entries(dict)) morphNames[index] = name;

  return { scene: gltf.scene, mesh, morphNames };
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
}
