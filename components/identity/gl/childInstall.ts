/**
 * Installs the childhood proportion transform onto a three.js material.
 *
 * A separate module from `FaceRenderer` because it needs no three: the material
 * is taken structurally, so the cache-key invariant below can be asserted in a
 * plain unit test. Importing `FaceRenderer` to reach it would drag in
 * `GLTFLoader`, which jest cannot parse, and the test would not run — and this
 * is precisely a defect that a not-running test would have let through.
 */
import { BODY_PROPORTION_GLSL, CHILD_PROPORTION_GLSL, CHILD_PROPORTION_UNIFORMS } from '@/lib/identity';

/**
 * The part of a three.js material this installer touches.
 *
 * Structural rather than `THREE.Material` so the cache-key invariant can be
 * asserted in a plain unit test — the defect it guards against needs no GPU to
 * reproduce, and a test that needed one would not run.
 */
export interface PatchableMaterial {
  uuid: string;
  onBeforeCompile?: (shader: any, renderer: any) => void;
  customProgramCacheKey?: () => string;
}

/**
 * Install the childhood proportion transform on one material.
 *
 * Every mesh in the head needs it: skin, hair, beard, sclera and iris. Miss one
 * and a child's eyeballs sit outside their head.
 *
 * ## The cache key is not optional
 *
 * three's default `customProgramCacheKey()` is `onBeforeCompile.toString()`,
 * which is how five materials that patch the shader differently each end up
 * with their own compiled program. Wrapping them all in the identical closure
 * below makes that string identical too — so three compiles ONE program and
 * hands it to all five. The beard gets the skin's, loses its `_beard` attribute
 * and its `vAmt` varying, and disappears: five facial-hair styles all rendering
 * as clean-shaven, plus eyes drawn by the wrong shader.
 *
 * There is no error and no warning. It was found by shooting the beard sheet,
 * which is the entire reason to have one.
 */
export function installChildProportions(
  material: PatchableMaterial,
  uniforms: Record<string, { value: number }>,
): void {
  const previous = material.onBeforeCompile;
  // The uuid as well as the original patch's source. Source alone is not enough:
  // two materials built by the same factory — `makeShellMaterial` makes both the
  // procedural hair and the procedural beard — carry byte-identical closures, so
  // they would collide for exactly the same reason the wrapper does. The uuid is
  // unique per material by construction, which makes the key unique too.
  const key = `${material.uuid}:${previous ? previous.toString() : ''}`;
  material.customProgramCacheKey = () => `child:${key}`;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${CHILD_PROPORTION_UNIFORMS}`)
      // BEFORE `project_vertex`, so it runs after every other patch here has had
      // its say — the morph blend, the hair shell's outward offset, the beard's.
      // Hooking an earlier chunk would scale some of those and not others,
      // depending on which chunk each one happened to attach to.
      .replace(
        '#include <project_vertex>',
        `${CHILD_PROPORTION_GLSL}\n${BODY_PROPORTION_GLSL}\n#include <project_vertex>`,
      );
  };
}
