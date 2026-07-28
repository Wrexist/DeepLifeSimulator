/**
 * Who owns a drag that starts on the 3D object — the object, or the page?
 *
 * ## The failure this encodes
 *
 * Both users of this hook (the face creator's preview, the luxury viewer) put
 * the object at the TOP OF A VERTICAL SCROLLVIEW, as the biggest touch target on
 * the screen, exactly where a thumb lands. The responder was claimed on touch
 * down and never released, so the most ordinary gesture on those screens — a
 * finger on the picture, swipe up to see what is below it — tilted the object a
 * few degrees and scrolled the page not at all.
 *
 * That does not get reported as "the viewer steals scroll gestures". It gets
 * reported as "the screen is frozen", because the remedy a player reaches for
 * (swipe again, harder, from the same place) does exactly as little.
 *
 * So the rule is a gesture must declare itself horizontal to be taken. These
 * tests are the rule; the PanResponder wiring around it is React Native's.
 */
import * as fs from 'fs';
import * as path from 'path';
import { claimsGesture } from '../useSpinControls';

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

describe('a horizontal drag turns the object', () => {
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

describe('the rule is the one the PanResponder actually asks', () => {
  // A correct rule that nothing calls is this project's most repeated defect —
  // the feature flag that defaulted off, the portrait field nothing read, the
  // Done handler that hardcoded null. Every one of them had passing tests of the
  // part that worked.
  //
  // Driving the real `panHandlers` would be better, but `onMoveShouldSetResponder`
  // reads a gestureState that PanResponder builds from an internal touch history;
  // synthesising one tests React Native's bookkeeping rather than this rule. So
  // the wiring is asserted on the source, and the rule itself is asserted above.
  const SRC = fs.readFileSync(path.join(__dirname, '..', 'useSpinControls.ts'), 'utf8');

  it('does not claim on touch down', () => {
    // The whole bug in one line. `() => true` here takes every gesture that
    // begins on the object before any direction exists to judge.
    expect(SRC).toMatch(/onStartShouldSetPanResponder:\s*\(\)\s*=>\s*false/);
  });

  it('decides the move with claimsGesture', () => {
    expect(SRC).toMatch(/onMoveShouldSetPanResponder:[^\n]*claimsGesture\(gesture\.dx,\s*gesture\.dy\)/);
  });

  it('keeps a drag once it has been claimed', () => {
    // The other half: a claimed turn must survive the parent ScrollView asking
    // for it back, or the object stutters to a halt mid-rotation.
    expect(SRC).toMatch(/onPanResponderTerminationRequest:\s*\(\)\s*=>\s*false/);
  });

  it('measures rotation from where the drag was claimed, not from touch down', () => {
    // The grant now arrives several points into the gesture. Measuring from zero
    // snaps the object through that travel the instant it is claimed — a jump at
    // the start of every turn, which is exactly the kind of thing that reads as
    // "cheap" without anyone being able to say why.
    expect(SRC).toMatch(/gesture\.dx\s*-\s*grab\.current\.dx/);
    expect(SRC).toMatch(/gesture\.dy\s*-\s*grab\.current\.dy/);
  });
});
