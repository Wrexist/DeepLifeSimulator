/**
 * The childhood transform exists twice — once in TypeScript for the procedural
 * head and the eyeball placement, once as GLSL for the scanned head's five
 * materials — and the two have to agree. They cannot be tested against each
 * other directly without a GL context, so this asserts the two things that
 * actually go wrong: the magnitudes drifting apart, and the transform being
 * ill-formed.
 */
import {
  BODY,
  BODY_PROPORTION_GLSL,
  CHILD,
  CHILD_PROPORTION_GLSL,
  CHILD_PROPORTION_UNIFORMS,
  childnessAt,
  childTransform,
  childXZ,
  childY,
  type HeadFrame,
} from '@/lib/identity';

// Roughly the procedural head's proportions.
const frame: HeadFrame = { browY: 0.32, chinY: -0.60, headH: 2.1 };

describe('childnessAt', () => {
  it('is 1 at birth, 0 from sixteen, and never negative', () => {
    expect(childnessAt(0)).toBeCloseTo(1, 5);
    expect(childnessAt(16)).toBe(0);
    expect(childnessAt(40)).toBe(0);
    expect(childnessAt(-5)).toBeCloseTo(1, 5);
  });

  it('falls monotonically', () => {
    let previous = Infinity;
    for (let age = 0; age <= 18; age += 0.5) {
      const v = childnessAt(age);
      expect(v).toBeLessThanOrEqual(previous);
      previous = v;
    }
  });

  it('is finite for a nonsense age', () => {
    expect(childnessAt(NaN)).toBe(0);
    expect(childnessAt(Infinity)).toBe(0);
  });
});

describe('the shader snippet and the TypeScript agree', () => {
  // The failure this catches is somebody tuning one number and shipping a
  // scanned head whose proportions differ from the procedural one's — which,
  // because the eyeballs are placed in TypeScript and the skin is transformed in
  // GLSL, would put a child's eyes outside their head.
  it.each(Object.entries(CHILD))('uses the same %s in both', (_name, value) => {
    // Every magnitude appears in the GLSL at the precision it is emitted with.
    const asGlsl = [value.toFixed(3), value.toFixed(4)];
    expect(asGlsl.some((v) => CHILD_PROPORTION_GLSL.includes(v))).toBe(true);
  });

  it('declares every uniform either snippet reads', () => {
    for (const name of ['uChildness', 'uBrowY', 'uChinY', 'uHeadH']) {
      expect(CHILD_PROPORTION_GLSL).toContain(name);
      expect(CHILD_PROPORTION_UNIFORMS).toContain(`uniform float ${name}`);
    }
    for (const name of ['uAdiposity', 'uMuscle', 'uHeadCZ']) {
      expect(BODY_PROPORTION_GLSL).toContain(name);
      expect(CHILD_PROPORTION_UNIFORMS).toContain(`uniform float ${name}`);
    }
  });

  it.each(Object.entries(BODY))('carries the same %s into the body snippet', (_n, value) => {
    expect(BODY_PROPORTION_GLSL).toContain(value.toFixed(3));
  });

  it('places the double chin under the jaw and at the front', () => {
    // Deferred twice on the grounds that it needed the baked `_beard`
    // attribute, which the beard material already declares — a redefinition
    // error on one of the five materials this installs on. It does not: the
    // frame says where the chin is and `uHeadHalfZ` says which way is forward.
    expect(BODY_PROPORTION_GLSL).toContain('uChinY - 0.10 * faceH');
    expect(BODY_PROPORTION_GLSL).toContain('uHeadHalfZ');
    // Fat gained only. A lean character has no hollow under the jaw to carve.
    expect(BODY_PROPORTION_GLSL).toContain('max(0.0, uAdiposity)');
  });

  it('declares no attributes, so it cannot clash with a material\'s own patch', () => {
    // The beard material declares `attribute vec3 _beard` in its own
    // `onBeforeCompile`. Anything this snippet declares is added to all five
    // materials, so an attribute here is a redefinition error on exactly one of
    // them — and the shader that fails is the one nobody re-shoots.
    expect(CHILD_PROPORTION_UNIFORMS).not.toContain('attribute');
    expect(BODY_PROPORTION_GLSL).not.toContain('attribute');
    expect(CHILD_PROPORTION_GLSL).not.toContain('attribute');
  });

  it('scales depth about the head centre, not about zero', () => {
    // The exporter puts a translation on the node, so local z = 0 is not the
    // middle of the head. Scaling about it would push the whole face forward
    // instead of thickening it.
    expect(BODY_PROPORTION_GLSL).toContain('uHeadCZ + (transformed.z - uHeadCZ)');
  });

  it('is guarded so it compiles out when not installed', () => {
    expect(CHILD_PROPORTION_GLSL).toContain('#ifdef USE_CHILD_PROPORTIONS');
    expect(CHILD_PROPORTION_UNIFORMS).toContain('#define USE_CHILD_PROPORTIONS');
  });
});

describe('childTransform', () => {
  it('does nothing to an adult', () => {
    expect(childTransform(0.3, 0.1, 0.8, frame, 0)).toEqual([0.3, 0.1, 0.8]);
  });

  it('shortens the face and grows the cranium', () => {
    const c = childnessAt(3);
    // A point on the chin rises toward the brow...
    expect(childY(frame.chinY, frame, c)).toBeGreaterThan(frame.chinY);
    // ...while the crown goes the other way.
    expect(childY(frame.browY + 0.5, frame, c)).toBeGreaterThan(frame.browY + 0.5);
    // And the face narrows while the cranium widens.
    expect(childXZ(0, frame, c)).toBeLessThan(1);
    expect(childXZ(frame.browY + 0.5, frame, c)).toBeGreaterThan(1);
  });

  it('carries the neck up with the chin instead of compressing it', () => {
    // The defect: on the scanned head the brow sits at 75% of mesh height and
    // the chin at 35%, so a third of what is "below the brow" is neck and
    // shoulders. Scaling all of it toward the brow pulled a three-year-old's
    // shoulders up under their jaw.
    const c = childnessAt(3);
    const chinRise = childY(frame.chinY, frame, c) - frame.chinY;
    const collar = frame.chinY - 0.5;
    const collarRise = childY(collar, frame, c) - collar;
    // The collar moves with the chin, not proportionally further.
    expect(collarRise).toBeCloseTo(chinRise, 2);
  });

  it('stays monotonic in y, so the surface never turns inside out', () => {
    for (const age of [0, 3, 8, 14]) {
      const c = childnessAt(age);
      let previous = -Infinity;
      for (let y = -1.4; y <= 1.1; y += 0.01) {
        const v = childY(y, frame, c);
        expect(v).toBeGreaterThan(previous);
        previous = v;
      }
    }
  });

  it('is continuous — no crease at the brow or the chin', () => {
    const c = childnessAt(4);
    for (const edge of [frame.browY, frame.chinY]) {
      const step = Math.abs(childY(edge + 0.005, frame, c) - childY(edge - 0.005, frame, c));
      // A crease would show as a jump far larger than the 0.01 sample spacing.
      expect(step).toBeLessThan(0.02);
    }
  });
});
