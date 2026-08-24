/**
 * The notification copy normaliser.
 *
 * Two properties matter and neither is obvious from reading the regex.
 *
 * The first is what it must NOT remove. Arrows sit next door to the emoji
 * blocks in Unicode, and the contextual tips say "Life → Health, or buy food in
 * Life → Market" — that arrow is navigation, and stripping it would turn a
 * usable instruction into a broken one. Same for currency, the middle dot the
 * whole app uses as a separator, and accented letters in character names.
 *
 * The second is that removing a character mid-sentence leaves damage behind:
 * a double space, a space before a full stop, a leading gap. A stripper that
 * only strips produces "Crime failed. Wanted level up. -7 happiness" with two
 * spaces in it, which looks like the bug it was meant to fix.
 */

import {
  stripEmoji,
  clampNotification,
  toastText,
  TOAST_MAX_CHARS,
} from '@/utils/notificationText';

describe('stripEmoji', () => {
  it('removes the emoji the game actually ships in its messages', () => {
    // Every one of these was live in the codebase when this was written.
    expect(stripEmoji('🔓 Stealth skill is now level 2!')).toBe('Stealth skill is now level 2!');
    expect(stripEmoji('⬆️ Criminal Level 3 reached!')).toBe('Criminal Level 3 reached!');
    expect(stripEmoji('👶 A Baby Is Born')).toBe('A Baby Is Born');
    expect(stripEmoji('🏠 Property Alert')).toBe('Property Alert');
    expect(stripEmoji('📉 Economic Recession')).toBe('Economic Recession');
    expect(stripEmoji('You are now married! 💒')).toBe('You are now married!');
  });

  it('strips the variation selector, not just the base glyph', () => {
    // "⚠️" is U+26A0 U+FE0F. Removing only the first leaves an invisible
    // combining character that still occupies a text run.
    const out = stripEmoji('⚠️ Careful');
    expect(out).toBe('Careful');
    expect(out).not.toMatch(/[️︎]/);
  });

  it('keeps arrows - they are navigation in this app, not decoration', () => {
    expect(stripEmoji('Health is low! Go to Life → Health, or buy food in Life → Market.')).toBe(
      'Health is low! Go to Life → Health, or buy food in Life → Market.'
    );
  });

  it('keeps ordinary punctuation, currency, separators and accents', () => {
    expect(stripEmoji('Earned $1,200 · Rank 2 - nice')).toBe('Earned $1,200 · Rank 2 - nice');
    expect(stripEmoji('Zoë Ångström got a raise (+8%)')).toBe('Zoë Ångström got a raise (+8%)');
  });

  it('closes the gaps the removal opens', () => {
    expect(stripEmoji('Crime failed. 🔓 Stealth lv.2. (-7 happiness)')).toBe(
      'Crime failed. Stealth lv.2. (-7 happiness)'
    );
    expect(stripEmoji('Done 🎉 !')).toBe('Done!');
    expect(stripEmoji('  🎯 Savings Goal Reached  ')).toBe('Savings Goal Reached');
  });

  it('preserves newlines - the weekly summary banner is built from them', () => {
    expect(stripEmoji('📉 Rates up\n📈 Yields up')).toBe('Rates up\nYields up');
  });

  it('returns empty for a message that was nothing but emoji', () => {
    // The channels treat this as blank and drop the notification entirely.
    expect(stripEmoji('🎉🎉🎉')).toBe('');
  });

  it('handles empty and whitespace input without throwing', () => {
    expect(stripEmoji('')).toBe('');
    expect(stripEmoji('   ')).toBe('');
  });
});

describe('clampNotification', () => {
  it('leaves a short message exactly as it is', () => {
    expect(clampNotification('Earned $120.')).toBe('Earned $120.');
  });

  it('cuts a long message on a word boundary and marks the cut', () => {
    const long =
      'Crime failed. Wanted level up. This work took a toll on your wellbeing and ' +
      'several other things besides, at considerable length.';
    const out = clampNotification(long);

    expect(out.length).toBeLessThanOrEqual(TOAST_MAX_CHARS);
    expect(out.endsWith('…')).toBe(true);
    // A word boundary, not mid-word.
    expect(long.startsWith(out.slice(0, -1))).toBe(true);
  });

  it('does not shred a long unbroken token back to nothing', () => {
    const out = clampNotification('x'.repeat(400));
    expect(out.length).toBeGreaterThan(TOAST_MAX_CHARS * 0.9);
  });

  it('leaves no dangling punctuation before the ellipsis', () => {
    const out = clampNotification(`${'word '.repeat(30)}, tail`);
    expect(out).not.toMatch(/[\s,;:.–-]…$/);
  });
});

describe('toastText - what the channel actually applies', () => {
  it('strips and clamps in one pass', () => {
    const out = toastText(
      '🔓 Stealth skill is now level 2! This work took a toll on your wellbeing ' +
        '(-7 happiness, -3 health) and it will take a while to recover from.'
    );

    expect(out).not.toMatch(/🔓/);
    expect(out.length).toBeLessThanOrEqual(TOAST_MAX_CHARS);
  });

  it('is idempotent - sanitising an already-clean string changes nothing', () => {
    const clean = toastText('Earned $120. Rank 2. (-5 happiness, -2 health)');
    expect(toastText(clean)).toBe(clean);
  });
});
