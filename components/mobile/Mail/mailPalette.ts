/**
 * DeepMail's palette, once.
 *
 * The four Mail files carried 117 hardcoded hex literals between them - the
 * same Gmail greys and blues re-typed as `darkMode ? '#8AB4F8' : '#1A73E8'` at
 * every call site. Nothing was wrong with the colours; the problem was that a
 * single change (or a single typo) had to be found in four files, and two of
 * the pairs had already drifted apart by one shade.
 *
 * So the palette is data: two records with the same keys, picked by mode. The
 * names say what a colour MEANS in this app (link, warn, positive, rule), never
 * what it looks like, because the light and dark values of one role are not the
 * same colour and never will be.
 *
 * `linkStrong` and `onAccent` are deliberately mode-INDEPENDENT: they are the
 * fill of a solid blue button and the text on top of it, and both have to keep
 * their contrast against each other rather than against the page.
 *
 * This is a mail-client skin, not the game's accent system - DeepMail looks
 * like a mail client on purpose (see MailApp's docblock), which is why these
 * live here rather than being folded into `accent.*`.
 */

export interface MailPalette {
  /** Screen background. */
  bg: string;
  /** Raised panel (drawer, document card). */
  surface: string;
  /** Quiet inset panel (the resolved-outcome block). */
  surfaceMuted: string;
  /** Search field fill. */
  field: string;
  /** The result banner behind a resolved action. */
  banner: string;
  /** Hairline/rim on cards, chips and choice buttons. */
  border: string;
  /** Link + active text/icon: light blue on dark, Google blue on light. */
  link: string;
  /** Solid accent fill (buttons, the active-tab underline). Mode-independent. */
  linkStrong: string;
  /** Text/icon on top of `linkStrong`. Mode-independent. */
  onAccent: string;
  /** Deadline / unverified-sender amber. */
  warn: string;
  /** Rim of an urgent (last week to act) chip. */
  warnBorder: string;
  /** Fill of an urgent chip or the drawer's waiting row. */
  warnSurface: string;
  /** The star. Mode-independent - a starred message reads the same either way. */
  star: string;
  /** "Nothing was taken", defences, the report button. */
  positive: string;
  /** A debit on a document, and the "you were scammed" head. */
  negative: string;
  /** The heavier rule above a document's total. */
  rule: string;
  /** The light rule between document rows. */
  ruleLight: string;
}

export const MAIL_PALETTE: { dark: MailPalette; light: MailPalette } = {
  dark: {
    bg: '#0F141A',
    surface: '#151B23',
    surfaceMuted: '#151B23',
    field: '#1C2530',
    banner: '#202B37',
    border: '#2A3441',
    link: '#8AB4F8',
    linkStrong: '#1A73E8',
    onAccent: '#FFFFFF',
    warn: '#FDD663',
    warnBorder: '#5C4813',
    warnSurface: 'rgba(249,171,0,0.13)',
    star: '#F9AB00',
    positive: '#81C995',
    negative: '#F28B82',
    rule: '#3C4A5A',
    ruleLight: '#2A3441',
  },
  light: {
    bg: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceMuted: '#F8F9FA',
    field: '#F1F3F4',
    banner: '#E8F0FE',
    border: '#DADCE0',
    link: '#1A73E8',
    linkStrong: '#1A73E8',
    onAccent: '#FFFFFF',
    warn: '#B06000',
    warnBorder: '#F9AB00',
    warnSurface: '#FEF7E0',
    star: '#F9AB00',
    positive: '#188038',
    negative: '#C5221F',
    rule: '#BDC1C6',
    ruleLight: '#E8EAED',
  },
};

/** The palette for the mode in play. */
export function mailPalette(darkMode: boolean): MailPalette {
  return darkMode ? MAIL_PALETTE.dark : MAIL_PALETTE.light;
}

/**
 * The tinted surface behind an active chip / selected drawer row. Derived
 * rather than stored because the two modes reach it differently: dark tints the
 * page with the light blue, light uses Google's own flat `#E8F0FE`.
 */
export function linkSurface(darkMode: boolean): string {
  return darkMode ? 'rgba(138,180,248,0.14)' : '#E8F0FE';
}
