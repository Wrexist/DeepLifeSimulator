/**
 * Mobile layout invariants for the face studio.
 *
 * These are source assertions rather than render tests because the values that
 * matter are the ones chosen at layout time, and the failure mode is a screen
 * that fits on the phone it was written on and not on a smaller one.
 */
import * as fs from 'fs';
import * as path from 'path';

const STUDIO = fs.readFileSync(path.join(__dirname, '..', 'FaceStudio.tsx'), 'utf8');

describe('the preview is sized against screen HEIGHT', () => {
  it('derives the frame height from the window, not from scale()', () => {
    // It was `height: scale(330)`, and `scale()` is WIDTH-based — a vertical
    // dimension computed from a horizontal measurement. On a 667pt-tall phone
    // the header, the sticky footer and the safe areas leave about 417pt, so a
    // 330pt preview left under 90pt of controls visible: the player saw a head
    // and had to scroll before discovering there were sliders at all.
    expect(STUDIO).toMatch(/useWindowDimensions\(\)/);
    expect(STUDIO).toMatch(/frameHeight/);
    expect(STUDIO).not.toMatch(/height: scale\(330\)/);
  });

  it('clamps at both ends', () => {
    // Unclamped, a tall phone gets a preview that pushes every control off
    // screen and a short one gets a thumbnail. Both bounds are load-bearing.
    const line = STUDIO.match(/const frameHeight = [^\n]*/)?.[0] ?? '';
    expect(line).toMatch(/Math\.min/);
    expect(line).toMatch(/Math\.max/);
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
