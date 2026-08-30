/**
 * The session's content, held in one place.
 *
 * WHY A MODULE HOLDER RATHER THAN STATE. Live-ops content is fetched once per
 * session and is the same for every surface that reads it. Putting it in React
 * state would mean a provider, a re-render on arrival, and a load-order
 * question at every call site; putting it here means every reader gets a
 * synchronous answer immediately - the local catalogue - which is upgraded in
 * place if and when the network produces something better.
 *
 * THE EPOCH is what lets a memoised consumer notice the upgrade. It is bumped
 * only when the resolved content actually changes, so a fetch that returns the
 * same thing does not invalidate every hub memo in the tree.
 */
import { localContent, fetchLiveOpsContent, type ResolvedContent } from './remote';
import { trackContentResolved } from './analytics';

let content: ResolvedContent = localContent();
let epoch = 0;
let loaded = false;

/** The content in force right now. Always safe, always synchronous. */
export function getLiveOpsContent(): ResolvedContent {
  return content;
}

/** Bumped when the content changes, so memos can depend on it. */
export function getContentEpoch(): number {
  return epoch;
}

/**
 * Load remote content once per session. Never throws, never blocks.
 *
 * Awaiting this is optional by design: the local catalogue is already in place
 * before it is called, so a caller that fires and forgets loses nothing but the
 * upgrade. The boot path does exactly that.
 */
export async function initLiveOpsContent(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const next = await fetchLiveOpsContent();
    const changed =
      next.source !== content.source ||
      next.paused !== content.paused ||
      next.events.length !== content.events.length ||
      next.events.some((e, i) => e.id !== content.events[i]?.id);
    content = next;
    if (changed) epoch += 1;
    trackContentResolved(next.source, next.events.length, next.rejected.length, next.paused);
  } catch {
    // `fetchLiveOpsContent` already swallows everything; this is the belt to
    // its braces, because a throw here would land on the boot path.
  }
}

/** Test hook - resets the module holder between cases. */
export function resetLiveOpsContent(next?: ResolvedContent): void {
  content = next ?? localContent();
  epoch += 1;
  loaded = false;
}
