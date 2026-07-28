/**
 * Who owns a drag that starts on a control — the control, or the page under it?
 *
 * ## The failure this encodes
 *
 * Three PanResponders on the face studio claimed the gesture on TOUCH DOWN and
 * refused to release it: the 3D head, which is the biggest touch target on the
 * screen, and the morph slider, six of which span most of the width below it.
 * Between them they covered most of what a thumb can land on.
 *
 * So the most ordinary gesture available — finger down, swipe up to see more —
 * turned the head a few degrees, or silently rewrote whichever morph was under
 * the finger to whatever value it was over, and scrolled the page not at all.
 *
 * That does not get reported as "the controls steal scroll gestures". It gets
 * reported as "the screen is frozen", because the remedy a player reaches for
 * (swipe again, harder, from the same place) does exactly as little.
 *
 * So a drag must declare itself horizontal to be taken. These tests are the
 * rule; the PanResponder wiring around it is React Native's.
 */
import * as fs from 'fs';
import * as path from 'path';
import { claimsHorizontalDrag as claimsGesture } from '../gestures';

describe('a vertical drag belongs to the page', () => {
  it('does not claim a straight upward swipe', () => {
    // THE BUG, as a single assertion. This is the scroll gesture.
    expect(claimsGesture(0, -140)).toBe(false);
  });

  it('does not claim a swipe that drifts sideways on the way up', () => {
    // Nobody swipes in a straight line. A thumb arcs, so a real "scroll down the
    // page" gesture carries 20-40 points of horizontal drift — and a rule keyed
    // on "any horizontal movement at all" would take every one of them.
    expect(claimsGesture(30, -160)).toBe(false);
    expect(claimsGesture(-45, 200)).toBe(false);
  });

  it('does not claim a diagonal where neither axis clearly wins', () => {
    // Ambiguous goes to the page, not the object: guessing wrong on the page
    // costs a frozen screen, guessing wrong on the object costs one missed turn.
    expect(claimsGesture(100, 100)).toBe(false);
    expect(claimsGesture(100, -95)).toBe(false);
  });
});

describe('a horizontal drag belongs to the control', () => {
  it('claims a straight sideways drag, either direction', () => {
    expect(claimsGesture(60, 0)).toBe(true);
    expect(claimsGesture(-60, 0)).toBe(true);
  });

  it('claims one that is mostly sideways', () => {
    expect(claimsGesture(120, 30)).toBe(true);
  });

  it('claims early enough to feel immediate', () => {
    // The object must start turning within a few points of travel. A threshold
    // the size of a scroll-detection slop would make turning feel like it
    // needed a shove.
    expect(claimsGesture(6, 0)).toBe(true);
  });
});

describe('a stationary finger is not a drag', () => {
  it('ignores jitter', () => {
    // A finger resting on the object reports one or two points of movement.
    // Claiming those would take the gesture before the player had made one.
    expect(claimsGesture(0, 0)).toBe(false);
    expect(claimsGesture(2, 0)).toBe(false);
    expect(claimsGesture(-3, 1)).toBe(false);
  });
});

describe('the rule is the one both PanResponders actually ask', () => {
  // A correct rule that nothing calls is this project's most repeated defect —
  // the feature flag that defaulted off, the portrait field nothing read, the
  // Done handler that hardcoded null. Every one of them had passing tests of the
  // part that worked.
  //
  // Driving the real `panHandlers` would be better, but `onMoveShouldSetResponder`
  // reads a gestureState that PanResponder builds from an internal touch history;
  // synthesising one tests React Native's bookkeeping rather than this rule. So
  // the wiring is asserted on the source, and the rule itself is asserted above.
  const read = (...parts: string[]) =>
    fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8');
  const SOURCES: [string, string][] = [
    ['the head preview', read('components', 'luxury', 'useSpinControls.ts')],
    ['the morph slider', read('components', 'identity', 'MorphSlider.tsx')],
  ];

  it.each(SOURCES)('%s does not claim on touch down', (_name, src) => {
    // The whole bug in one line. `() => true` here takes every gesture that
    // begins on the control before any direction exists to judge.
    expect(src).toMatch(/onStartShouldSetPanResponder:\s*\(\)\s*=>\s*false/);
  });

  it.each(SOURCES)('%s decides the move with the shared rule', (_name, src) => {
    expect(src).toMatch(/onMoveShouldSetPanResponder:[^\n]*claimsHorizontalDrag\(gesture\.dx,\s*gesture\.dy\)/);
  });

  it.each(SOURCES)('%s keeps a drag once it has been claimed', (_name, src) => {
    // The other half: a claimed drag must survive the parent ScrollView asking
    // for it back, or the control stutters to a halt mid-gesture.
    expect(src).toMatch(/onPanResponderTerminationRequest:\s*\(\)\s*=>\s*false/);
  });

  it('the head measures rotation from where the drag was claimed', () => {
    // The grant now arrives several points into the gesture. Measuring from zero
    // snaps the object through that travel the instant it is claimed — a jump at
    // the start of every turn, which is exactly the kind of thing that reads as
    // "cheap" without anyone being able to say why.
    const src = read('components', 'luxury', 'useSpinControls.ts');
    expect(src).toMatch(/gesture\.dx\s*-\s*grab\.current\.dx/);
    expect(src).toMatch(/gesture\.dy\s*-\s*grab\.current\.dy/);
  });

  it('the slider measures its value from where the drag was claimed', () => {
    // Same arithmetic, and here the error is visible as a value: the pre-claim
    // travel would be counted twice, so every drag would start with a few
    // percent it had not earned.
    const src = read('components', 'identity', 'MorphSlider.tsx');
    expect(src).toMatch(/gesture\.dx\s*-\s*grabDxRef\.current/);
  });

  it('the slider still jumps to the finger once a drag is claimed', () => {
    // What the fix gives up is editing on a bare TOUCH. Dragging from anywhere
    // on the track must still take the value to the finger, or the fix has
    // traded an accidental-edit bug for a control that only nudges.
    const src = read('components', 'identity', 'MorphSlider.tsx');
    expect(src).toMatch(/clamp01\(evt\.nativeEvent\.locationX \/ w\)/);
  });
});
