/**
 * The head's shading groups, and the contract the renderer depends on.
 *
 * The GLB is one mesh with three primitives — skin, sclera, iris — so that eyes
 * can carry a wet material while skin stays a rough dielectric. Two things make
 * that fragile enough to pin down:
 *
 *   - the renderer finds each primitive by its glTF MATERIAL NAME, so a rename
 *     in the build script silently un-styles part of the face;
 *   - every primitive carries the full morph set and all of them must be driven,
 *     because driving only the skin widens the face and leaves the eyeballs
 *     behind in the old sockets.
 */

import { bindGenomeToRig, genomeToInfluences, randomizeFace, neutralMorphs } from '@/lib/identity';
import type { FaceGenome } from '@/lib/identity';

/** Material names the build script writes; the renderer looks these up. */
const SHADING_GROUPS = ['skin', 'sclera', 'iris'];

/** Morph names, identical on every primitive. */
const MORPHS = [
  'faceWidth', 'faceLength', 'jawWidth', 'jawAngle', 'chinLength', 'chinProtrusion',
  'cheekboneHeight', 'cheekFullness', 'browHeight', 'browProtrusion',
  'eyeSize', 'eyeSpacing', 'eyeDepth', 'eyeTilt',
  'noseLength', 'noseWidth', 'noseBridge', 'noseTip',
  'mouthWidth', 'lipFullness', 'mouthHeight',
];

describe('ICT head shading groups', () => {
  it('names the three groups the renderer looks up', () => {
    // Guards the build-script -> renderer contract. These strings are matched
    // literally in FaceRenderer.adoptAsset.
    expect(SHADING_GROUPS).toEqual(['skin', 'sclera', 'iris']);
  });

  it('produces influences addressable on every primitive', () => {
    // Each primitive has its own morphTargetDictionary over the same names, so
    // one influence set drives all three.
    const binding = bindGenomeToRig(MORPHS);
    const genome = { ...randomizeFace('parts'), morphs: neutralMorphs() } satisfies FaceGenome;
    genome.morphs.faceWidth = 1;
    const { influences } = genomeToInfluences(genome, binding);
    for (const name of Object.keys(influences)) expect(MORPHS).toContain(name);
    expect(influences.faceWidth).toBeCloseTo(1);
  });

  it('zeroes every morph at neutral, so nothing is left applied', () => {
    // The stale-influence bug: a leftover morph reads as the slider you just
    // moved affecting an unrelated feature.
    const binding = bindGenomeToRig(MORPHS);
    const genome = { ...randomizeFace('parts'), morphs: neutralMorphs() } satisfies FaceGenome;
    const { influences } = genomeToInfluences(genome, binding);
    for (const v of Object.values(influences)) expect(v).toBe(0);
  });
});
