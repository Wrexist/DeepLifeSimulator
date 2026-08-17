/**
 * Notification copy normalisation — one place, applied at the CHANNEL.
 *
 * ## Why this is not a find-and-replace over the call sites
 *
 * Almost no toast call site contains an emoji. They arrive by concatenation:
 * `JobActions` builds `levelUpText` with a 🔓 in it and hands the assembled
 * string to a result object, which travels through two more modules before a
 * screen shows it. A sweep over the call sites would have missed every one of
 * those and, worse, would have gone stale the first time someone appended a new
 * fragment. Sanitising where the message ENTERS the notification channel is the
 * only version of this that stays true.
 *
 * The rule is deliberately narrow: strip pictographs, keep everything a
 * sentence needs. Arrows in particular (U+2190–U+21FF) are NOT stripped — the
 * contextual tips say "Life → Health", and that arrow is navigation, not
 * decoration.
 */

/**
 * Pictograph ranges.
 *
 * Explicit `\u{...}` ranges rather than `\p{Extended_Pictographic}` — Hermes
 * has shipped the `u` flag and code-point escapes for far longer than it has
 * had Unicode property escapes, and this string runs on every device.
 *
 *  - 1F000–1FAFF  emoji proper, including skin-tone modifiers
 *  - 2600–27BF    misc symbols + dingbats (⚠ ✅ ✨ ❌)
 *  - 2B00–2BFF    ⬆ ⭐ and friends
 *  - FE0E/FE0F    variation selectors, which would otherwise be left behind
 *  - 200D         zero-width joiner, ditto
 *  - 20E3         combining enclosing keycap
 */
const PICTOGRAPHS =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}]/gu;

/**
 * Keycap sequences: digit/# /* + optional U+FE0F + U+20E3.
 * Examples: 1️⃣, #️⃣, *️⃣
 * Must be removed BEFORE the main PICTOGRAPHS pass, as that only strips the
 * combining keycap (U+20E3) and leaves the base character behind.
 */
const KEYCAP_SEQUENCES = /[0-9#*]\u{FE0F}?\u{20E3}/gu;

/**
 * Strip emoji and tidy up what they leave behind.
 *
 * Removing a character mid-sentence leaves double spaces and orphaned
 * punctuation (`"Done!  Rank 2"`, `"· "`), so the collapse pass is part of the
 * job rather than a nicety.
 */
export function stripEmoji(text: string): string {
  if (!text) return '';
  return text
    .replace(KEYCAP_SEQUENCES, '')
    .replace(PICTOGRAPHS, '')
    // Collapse the runs of whitespace the removal opened up, but keep newlines:
    // the weekly-summary banner joins its lines with "\n" and relies on them.
    .replace(/[^\S\n]{2,}/g, ' ')
    // A space that now sits before punctuation, or after an opening bracket.
    .replace(/[^\S\n]+([.,!?;:)\]])/g, '$1')
    .replace(/([([])[^\S\n]+/g, '$1')
    .replace(/[^\S\n]+\n/g, '\n')
    .replace(/\n[^\S\n]+/g, '\n')
    .trim();
}

/**
 * How much of a message a toast will show before it stops being glanceable.
 *
 * The toast renders two lines and truncates, so anything past this length was
 * never read — it just made the surface taller while it was on screen. Trimming
 * here (rather than only in the view) also keeps the accessibility label honest:
 * a screen reader was previously read the full paragraph that sighted players
 * only ever saw two lines of.
 */
export const TOAST_MAX_CHARS = 96;

/** Truncate on a word boundary, with an ellipsis, or return the input. */
export function clampNotification(text: string, max: number = TOAST_MAX_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  // Reserve 1 char for the ellipsis so output never exceeds max.
  const maxBody = max - 1;
  const cut = trimmed.slice(0, maxBody);
  const lastSpace = cut.lastIndexOf(' ');
  // Only break on a word boundary when one exists reasonably near the end —
  // otherwise a long unbroken token would be cut back to almost nothing.
  const body = lastSpace > maxBody * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${body.replace(/[\s,;:.–-]+$/, '')}…`;
}

/**
 * The full treatment for a message about to be shown in a toast: no emoji, no
 * double spaces, no paragraph. Banners get `stripEmoji` only — they are taller
 * by design and carry the multi-line weekly summary.
 */
export function toastText(text: string): string {
  return clampNotification(stripEmoji(text));
}
