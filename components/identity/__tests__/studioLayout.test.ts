/**
 * Mobile layout invariants for the face studio.
 *
 * These are source assertions rather than render tests because the values that
 * matter are the ones chosen at layout time, and the failure mode is a screen
 * that fits on the phone it was written on and not on a smaller one.
 */
import * as fs from 'fs';
import * as path from 'path';
import { frameHeightFor, railLayout } from '../studioLayout';

const STUDIO = fs.readFileSync(path.join(__dirname, '..', 'FaceStudio.tsx'), 'utf8');

/** iPhone SE / 8 — the shortest screen this app is expected to run on. */
const SE = 667;
/** iPhone 15 Pro Max, the other end. */
const MAX = 932;

describe('the preview is sized against screen HEIGHT', () => {
  it('derives the frame height from the window, not from scale()', () => {
    // It was `height: scale(330)`, and `scale()` is WIDTH-based — a vertical
    // dimension computed from a horizontal measurement. On a 667pt-tall phone
    // the header, the sticky footer and the safe areas leave about 417pt, so a
    // 330pt preview left under 90pt of controls visible: the player saw a head
    // and had to scroll before discovering there were sliders at all.
    expect(STUDIO).toMatch(/useWindowDimensions\(\)/);
    expect(STUDIO).toMatch(/frameHeightFor\(windowHeight\)/);
    expect(STUDIO).not.toMatch(/height: scale\(330\)/);
  });

  it('clamps at both ends', () => {
    // Unclamped, a tall phone gets a preview that pushes every control off
    // screen and a short one gets a thumbnail. Both bounds are load-bearing.
    expect(frameHeightFor(4000)).toBe(360);
    expect(frameHeightFor(200)).toBe(230);
  });

  it('leaves room for controls on the shortest phone', () => {
    // The point of the whole rule: the head must not eat the screen. ~417pt of
    // usable height on an SE, so a frame over about 280 puts the first slider
    // below the fold.
    expect(frameHeightFor(SE)).toBeLessThan(280);
  });

  it('applies the computed height over the static style', () => {
    expect(STUDIO).toMatch(/\[styles\.frame, \{ height: frameHeight \}\]/);
  });
});

describe('the commit action stays reachable', () => {
  it('keeps the footer OUTSIDE the ScrollView', () => {
    // The primary action must not be at the end of a ten-section scroll. It is
    // already outside — this pins it, because moving it inside would be an easy
    // and invisible regression.
    const scrollEnd = STUDIO.lastIndexOf('</ScrollView>');
    const footer = STUDIO.indexOf('style={styles.footer}');
    expect(scrollEnd).toBeGreaterThan(-1);
    expect(footer).toBeGreaterThan(scrollEnd);
  });

  it('reserves scroll padding so the last control clears the footer', () => {
    expect(STUDIO).toMatch(/scroll: \{[^}]*paddingBottom: scale\(\d+\)/);
  });
});

describe('the control list stays short enough to navigate', () => {
  it('opens one group at a time', () => {
    // A single string, not a set: with six anatomical groups plus skin, hair,
    // hair colour and beard, multi-open turns the screen into one long list
    // with no landmarks.
    expect(STUDIO).toMatch(/useState<string \| null>\(GROUPS\[0\]\.title\)/);
  });
});

describe('the action rail fits inside the frame it lives in', () => {
  // THE REGRESSION THE HEIGHT FIX ITSELF INTRODUCED, TWICE.
  //
  // The rail is absolutely positioned inside the preview frame, so shrinking the
  // frame clips its last control — Reset, the one a player reaches for after a
  // slider goes wrong.
  //
  // The first fix was a guessed threshold (`frameHeight < 300`) with a guessed
  // compact size, verified against a screenshot harness whose labels were plain
  // 9px text. The app's labels are pills with padding, about twice as tall. The
  // harness said it fit; on an SE it needed 289pt inside a 253pt frame and
  // Reset was still clipped. That is why the rule is now measured height
  // against available height, and why these assert the fit rather than the
  // numbers someone chose.

  it('fits on the shortest phone', () => {
    const frame = frameHeightFor(SE);
    expect(railLayout(frame).height).toBeLessThanOrEqual(frame);
  });

  it('fits on the tallest phone', () => {
    const frame = frameHeightFor(MAX);
    expect(railLayout(frame).height).toBeLessThanOrEqual(frame);
  });

  it('fits at every height in between', () => {
    for (let h = 480; h <= 1100; h += 1) {
      const frame = frameHeightFor(h);
      expect(railLayout(frame).height).toBeLessThanOrEqual(frame);
    }
  });

  it('fits on every device the app actually runs on', () => {
    // Width and height are NOT independent — the app is portrait-locked
    // (`orientation: "portrait"` in app.config.js) — so sweeping the scale
    // factor against an unrelated height posits devices that cannot exist. The
    // real constraint is that `scale()` is width-based and clamped (1.3 on
    // phones, 1.8 on tablets) while the frame is height-based and capped at 360,
    // which pulls hardest on a tablet: a rail 1.8x larger inside a frame that
    // stopped growing.
    const devices: [string, number, number][] = [
      ['iPhone SE', 375, 667],
      ['iPhone 13 mini', 375, 812],
      ['iPhone 15', 393, 852],
      ['iPhone 15 Pro Max', 430, 932],
      ['iPad mini', 744, 1133],
      ['iPad Pro 12.9', 1024, 1366],
    ];
    for (const [name, width, height] of devices) {
      // Mirrors `scale()` in utils/scaling.ts.
      const tablet = Math.min(width, height) >= 744;
      const factor = Math.min(Math.max(width / 375, 0.7), tablet ? 1.8 : 1.3);
      const frame = frameHeightFor(height);
      const fit = railLayout(frame, factor).height * factor;
      expect({ name, fits: fit <= frame }).toEqual({ name, fits: true });
    }
  });

  it('gives up size before labels, and labels before a control', () => {
    // Ordering matters: an unlabelled dice is usable, a clipped Reset is not.
    expect(railLayout(400).labels).toBe(true);
    expect(railLayout(400).button).toBeGreaterThan(railLayout(300).button);
    expect(railLayout(250).labels).toBe(false);
  });

  it('keeps the full-size rail where there is room for it', () => {
    // The compact size is a concession to small screens, not the default.
    expect(railLayout(frameHeightFor(MAX)).button).toBe(46);
  });

  it('never drops a control', () => {
    // Even below the smallest tier. Four buttons overflowing by a few points
    // beats three buttons and a missing recovery path.
    for (const frame of [360, 300, 253, 230, 120]) {
      expect(railLayout(frame).button).toBeGreaterThan(0);
    }
  });

  it('is the rule the screen actually uses', () => {
    // The rail is styled from `railLayout`'s output, not from a copy of it.
    expect(STUDIO).toMatch(/const rail = railLayout\(frameHeight, scale\(100\) \/ 100\)/);
    expect(STUDIO).toMatch(/width: scale\(rail\.button\)/);
    const block = STUDIO.slice(
      STUDIO.indexOf('styles.actions, railStyle'),
      STUDIO.indexOf('</View>', STUDIO.indexOf('Reset')),
    );
    expect((block.match(/size=\{btnStyle\}/g) ?? []).length).toBe(4);
    expect((block.match(/showLabel=\{rail\.labels\}/g) ?? []).length).toBe(4);
  });
});

describe('the head announces that it turns', () => {
  it('says so on the frame', () => {
    // A 3D preview that looks like a picture gets treated like one, and the
    // player never finds the profile view — which is where chin projection,
    // nose bridge and brow ridge actually show what they do.
    expect(STUDIO).toMatch(/styles\.spinHint/);
    expect(STUDIO).toMatch(/Drag . to turn/);
  });
});
