/**
 * Showcase model types — what a procedural luxury item is.
 *
 * A model is a list of named parts, each with its own material. That is the
 * shape the img2threejs methodology produces (a hierarchy of components with
 * per-part materials) and it is the right one here: a watch is a steel case, a
 * glass crystal, a printed dial and a leather strap, and collapsing those into
 * one mesh would force a single material onto all four.
 *
 * No three.js in this file. The renderer maps `PartMaterial` onto whatever it
 * uses; the models never know.
 */

import type { MeshData } from '@/lib/geometry/mesh';

/** Renderer-agnostic PBR description of a part's surface. */
export interface PartMaterial {
  /** Hex colour. */
  color: string;
  /** [0, 1]. 0 = mirror, 1 = fully diffuse. */
  roughness: number;
  /** [0, 1]. Metals are 1, dielectrics 0 — the in-between is rarely physical. */
  metalness: number;
  /** [0, 1]. Below 1 enables blending. */
  opacity?: number;
  /**
   * [0, 1]. Physically-based light transmission (glass, gemstone). Distinct
   * from `opacity`: transmission refracts, opacity just blends.
   */
  transmission?: number;
  /** Index of refraction. 1.5 = glass, 2.417 = diamond. */
  ior?: number;
  /** Hex. Non-black makes the part self-lit (lume, screens). */
  emissive?: string;
  /** [0, 1]. A clear lacquer over the base — car paint, polished lacquer. */
  clearcoat?: number;
}

export interface ModelPart {
  name: string;
  mesh: MeshData;
  material: PartMaterial;
}

/** A complete showcase object, ready to hand to the renderer. */
export interface ProceduralModel {
  parts: ModelPart[];
  /** Largest extent from the origin — the renderer frames the camera from it. */
  radius: number;
  /** Initial camera pitch in radians. Some objects read badly dead-level. */
  defaultPitch?: number;
  /**
   * Honest fidelity note, surfaced in dev tooling and the docs.
   *
   * The skill's transparency rule: never claim a reconstruction is exact when it
   * is stylized. Each model states plainly what it does and does not reproduce.
   */
  fidelity?: string;
}
