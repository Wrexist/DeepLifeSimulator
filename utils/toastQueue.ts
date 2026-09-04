/**
 * What happens when the same toast is raised twice.
 *
 * ## Why this exists
 *
 * Repeating an action repeats its toast. Three taps on the market's Buy button
 * pushed three byte-identical "Ate Instant Ramen. Completely full..." pills,
 * which filled the cap of three and covered the HUD — hiding the very stats the
 * meal had just changed (screenshot report, 2026-09-04). The player learned
 * nothing from pills two and three that pill one had not already said.
 *
 * ## The rule
 *
 * A message identical to one ALREADY ON SCREEN is not new information: it bumps
 * that toast's tally and takes a fresh id (which remounts the pill and so
 * restarts its auto-dismiss countdown, instead of letting the second tap's
 * toast expire on the first tap's clock). Anything else appends, and the queue
 * is capped at `maxVisible` with the newest kept.
 *
 * Identity is message + tier + position, so a success and an error that happen
 * to read the same still stack separately. Deduping is deliberately only
 * against LIVE toasts: repeating an action a minute later, once the first pill
 * has gone, should say so again rather than silently incrementing nothing.
 *
 * ## Why it is a pure function and not an inline updater
 *
 * It is a queue reducer, and the interesting cases (a repeat that is not the
 * newest entry, a repeat at the cap, two tiers with the same text) are
 * awkward to reach through a rendered provider and trivial to state here.
 * `ToastContext` holds the React state; this decides what the next queue is.
 */

/** The subset of a toast this reducer needs. `ToastContext.Toast` satisfies it. */
export interface QueuedToast {
  id: string;
  message: string;
  type: string;
  position?: string;
  /** Times this message has been raised while on screen. Starts at 1. */
  count: number;
}

/** How many toasts may be on screen at once. */
export const MAX_VISIBLE_TOASTS = 3;

/** Same message, same tier, same slot — the definition of a repeat. */
function isRepeat(a: QueuedToast, b: QueuedToast): boolean {
  return a.message === b.message && a.type === b.type && a.position === b.position;
}

/**
 * The queue after raising `incoming`.
 *
 * Returns a new array; never mutates `current`.
 */
export function enqueueToast<T extends QueuedToast>(
  current: readonly T[],
  incoming: T,
  maxVisible: number = MAX_VISIBLE_TOASTS
): T[] {
  const duplicate = current.findIndex((t) => isRepeat(t, incoming));
  if (duplicate !== -1) {
    const bumped = current.slice();
    bumped[duplicate] = {
      ...bumped[duplicate],
      id: incoming.id,
      count: bumped[duplicate].count + 1,
    };
    return bumped;
  }

  const appended = [...current, incoming];
  return appended.length > maxVisible ? appended.slice(-maxVisible) : appended;
}

/** The text to render: the message, plus a tally once it has repeated. */
export function toastDisplayMessage(toast: Pick<QueuedToast, 'message' | 'count'>): string {
  return toast.count > 1 ? `${toast.message}  x${toast.count}` : toast.message;
}
