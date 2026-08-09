import { useEffect, useState } from 'react';
import { useNavigationContainerRef } from 'expo-router';

/**
 * True once expo-router's root navigator can actually accept a navigation.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 *
 * Several tab screens redirect the player away in a `useEffect`: the computer
 * screen bounces you to Work while you are in jail and to Home if you sold the
 * computer. Those effects run on the screen's FIRST commit, and when that
 * screen is the entry route — a restored web URL, a deep link, a notification
 * tap — the root navigator has not mounted yet. `router.replace` then throws
 *
 *     Attempted to navigate before mounting the Root Layout component.
 *
 * which nothing on the way up handles, so the player gets the crash screen
 * instead of the screen they asked for. Reproduced by loading `/computer`
 * directly without owning a computer, and confirmed by isolation: stubbing out
 * those two `router.replace` calls makes the crash disappear.
 *
 * ── Why NOT `useRootNavigationState()` ────────────────────────────────────
 *
 * That is the usual advice and it does not work here — measured, not assumed.
 * Gating on `useRootNavigationState()?.key` still crashed, because the router
 * publishes a root state before the container ref is mounted. The throw comes
 * from `assertIsReady`, which tests exactly one thing:
 *
 *     store.navigationRef.isReady()
 *
 * so that is what this hook tests, via the public `useNavigationContainerRef`.
 *
 * `isReady()` is a plain method, not reactive — a component does not re-render
 * when it flips. Hence the subscription: the container emits `state` once it
 * mounts, which is the earliest point a redirect can succeed.
 */
export function useNavigationReady(): boolean {
  const ref = useNavigationContainerRef();
  const [ready, setReady] = useState(() => !!ref?.isReady?.());

  useEffect(() => {
    if (ready || !ref) return undefined;
    if (ref.isReady()) {
      setReady(true);
      return undefined;
    }
    const unsubscribe = ref.addListener?.('state', () => {
      if (ref.isReady()) setReady(true);
    });
    return unsubscribe;
  }, [ref, ready]);

  return ready;
}
