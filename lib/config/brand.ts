/**
 * The product wordmark - the ONE definition (ONB-13).
 *
 * The boot screen said "LIVE A THOUSAND LIVES / DEEP LIFE / SIMULATOR" and
 * the main menu, which it is meant to dissolve into seamlessly, said a
 * different tagline (and for a while "TYCOON"), so the game's name changed
 * mid-transition on the first thing every player sees. Every surface that
 * renders the wordmark reads it from here.
 *
 * It matches the store title, `Deep Life Simulator: Tycoon`
 * (`marketing/aso/metadata.mjs`, APPLE.name and PLAY.title): the wordmark is
 * the name before the colon. `__tests__/onboarding/wordmark.test.ts` pins that.
 */
export const STORE_TITLE = 'Deep Life Simulator: Tycoon';

/** The product name, as spoken (accessibility labels, plain copy). */
export const PRODUCT_NAME = 'Deep Life Simulator';

/** The two stacked lines of the wordmark, and the line above them. */
export const WORDMARK = {
  top: 'DEEP LIFE',
  bottom: 'SIMULATOR',
  tagline: 'LIVE A THOUSAND LIVES',
} as const;

/** The wordmark on one line, e.g. a footer fallback. */
export const WORDMARK_ONE_LINE = `${WORDMARK.top} ${WORDMARK.bottom}`;
