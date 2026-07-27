/**
 * A minimal glTF-binary reader for tests.
 *
 * ## Why hand-rolled
 *
 * The head pipeline's glTF tooling is a devDependency of the BUILD, not of the
 * app, and a test that needs an ad-hoc install is a test that quietly stops
 * running. The container this repo builds in has pruned those packages once
 * already. Everything here is the spec: a 12-byte header, then length-prefixed
 * JSON and BIN chunks.
 *
 * ## Why tests read the artifact at all
 *
 * The alternative is a hardcoded list of morph names, and this project has now
 * been bitten twice by exactly that: a test asserting "these 21 morphs exist and
 * these 3 are underivable" kept passing after the rig gained the missing three,
 * so the suite went on describing a shipped asset that had changed underneath
 * it. A list in a test file cannot notice; a reader can.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const HEAD_GLB = join(__dirname, '../../../../assets/models/head_ict.glb');

interface Gltf {
  meshes: { primitives: { material: number; attributes: Record<string, number>; targets?: unknown[] }[];
            extras?: { targetNames?: string[] } }[];
  materials: { name: string }[];
  accessors: Record<string, unknown>[];
  bufferViews: { byteOffset?: number; byteLength: number }[];
}

export interface HeadGlb {
  json: Gltf;
  bin: Buffer;
  /** Offset of the BIN chunk's data within the file. */
  binStart: number;
  /** Morph target names, in target order. */
  morphNames: string[];
  /** Material names, which the renderer looks primitives up by. */
  materials: string[];
}

/** Null when the artifact has not been built — it is gitignored input elsewhere. */
export function readHeadGlb(): HeadGlb | null {
  if (!existsSync(HEAD_GLB)) return null;
  const buf = readFileSync(HEAD_GLB);
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8')) as Gltf;
  // Chunk 1 header is 8 bytes: length + type.
  const binStart = 20 + jsonLength + 8;
  const mesh = json.meshes[0];
  return {
    json,
    bin: buf,
    binStart,
    // glTF puts target names in the MESH's extras, not the primitive's.
    morphNames: mesh?.extras?.targetNames ?? [],
    materials: (json.materials ?? []).map((m) => m.name),
  };
}

/**
 * Read a SCALAR float accessor, sparse or dense.
 *
 * The build writes the per-vertex weights sparse — most of the head is face, so
 * most values are zero — which means there is no base bufferView and the zeros
 * are implied rather than stored.
 */
export function readScalarAccessor(head: HeadGlb, index: number): Float32Array {
  const accessor = head.json.accessors[index] as {
    count: number;
    bufferView?: number;
    byteOffset?: number;
    sparse?: {
      count: number;
      indices: { bufferView: number; byteOffset?: number; componentType: number };
      values: { bufferView: number; byteOffset?: number };
    };
  };
  const out = new Float32Array(accessor.count);
  const at = (view: number, offset = 0): number =>
    head.binStart + (head.json.bufferViews[view].byteOffset ?? 0) + offset;

  if (accessor.bufferView !== undefined) {
    const base = at(accessor.bufferView, accessor.byteOffset ?? 0);
    for (let i = 0; i < accessor.count; i++) out[i] = head.bin.readFloatLE(base + i * 4);
  }
  if (accessor.sparse) {
    const { count, indices, values } = accessor.sparse;
    const iAt = at(indices.bufferView, indices.byteOffset ?? 0);
    const vAt = at(values.bufferView, values.byteOffset ?? 0);
    // 5123 = UNSIGNED_SHORT, 5125 = UNSIGNED_INT.
    const wide = indices.componentType === 5125;
    for (let i = 0; i < count; i++) {
      const index = wide ? head.bin.readUInt32LE(iAt + i * 4) : head.bin.readUInt16LE(iAt + i * 2);
      out[index] = head.bin.readFloatLE(vAt + i * 4);
    }
  }
  return out;
}

/** The primitive whose material has this name, or undefined. */
export function primitiveFor(head: HeadGlb, material: string):
  { material: number; attributes: Record<string, number>; targets?: unknown[] } | undefined {
  return head.json.meshes[0]?.primitives.find(
    (p) => head.json.materials[p.material]?.name === material,
  );
}
