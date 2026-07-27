/**
 * The shader-program cache key, which is not something you would think to test.
 *
 * three's default `customProgramCacheKey()` is `onBeforeCompile.toString()`.
 * That is how five materials patching the shader in five different ways each
 * end up with their own compiled program. Wrapping every one of them in the
 * SAME installer closure makes that string identical for all five, and three
 * then compiles one program and hands it to the lot.
 *
 * What that looked like: the beard received the skin's program, lost the
 * `_beard` attribute and the `vAmt` varying it needs, and vanished. Five facial
 * hair styles all rendering as clean-shaven, and the eyes drawn by the wrong
 * shader too. No error, no warning, no failing test — the suite was green and
 * the type checker was happy.
 *
 * It was found by looking at a contact sheet of the beards. This test is the
 * cheap version of that.
 */
import { installChildProportions, type PatchableMaterial } from '../gl/childInstall';

const uniforms = { uChildness: { value: 0 }, uBrowY: { value: 0 } };

function material(id: string, patch?: string): PatchableMaterial {
  return {
    uuid: id,
    // Distinct source text per material, as the real ones have.
    onBeforeCompile: patch
      ? (shader) => { shader.vertexShader += `\n// ${patch}`; }
      : undefined,
  };
}

describe('installChildProportions', () => {
  it('leaves every material a distinct program cache key', () => {
    const mats = [
      material('skin', 'skin patch'),
      material('hair', 'hair patch'),
      material('beard', 'beard patch'),
      material('sclera', 'sclera patch'),
      material('iris', 'iris patch'),
    ];
    for (const m of mats) installChildProportions(m, uniforms);

    const keys = mats.map((m) => m.customProgramCacheKey!());
    expect(new Set(keys).size).toBe(mats.length);
  });

  it('keeps materials distinct even when none had a patch of its own', () => {
    // Falls back to the uuid, which three guarantees is unique.
    const a = material('a');
    const b = material('b');
    installChildProportions(a, uniforms);
    installChildProportions(b, uniforms);
    expect(a.customProgramCacheKey!()).not.toBe(b.customProgramCacheKey!());
  });

  it('still runs the material\'s own patch', () => {
    const m = material('skin', 'skin patch');
    installChildProportions(m, uniforms);
    const shader = { uniforms: {} as Record<string, unknown>, vertexShader: 'x' };
    m.onBeforeCompile!(shader, null);
    expect(shader.vertexShader).toContain('// skin patch');
  });

  it('adds its uniforms and its GLSL', () => {
    const m = material('skin');
    installChildProportions(m, uniforms);
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: '#include <common>\nvoid main(){\n#include <project_vertex>\n}',
    };
    m.onBeforeCompile!(shader, null);
    expect(shader.uniforms).toHaveProperty('uChildness');
    expect(shader.vertexShader).toContain('uniform float uChildness');
    expect(shader.vertexShader).toContain('USE_CHILD_PROPORTIONS');
    // The transform must land before the projection, not after it.
    expect(shader.vertexShader.indexOf('uChildness > 0.0'))
      .toBeLessThan(shader.vertexShader.indexOf('#include <project_vertex>'));
  });
});
