/**
 * fullscreenAppStore — a tiny provider-free global flag for "an in-phone app is
 * open, so hide the game chrome and let it run full-screen".
 *
 * The phone/computer app grids (`computer.tsx` / `mobile.tsx`) set it when an
 * app (Pulse, Crypto, …) is launched; the layout shells read it to hide the
 * TopStatsBar (`app/_layout.tsx`) and the floating tab bar (`(tabs)/_layout.tsx`),
 * and the apps themselves read it to drop the now-unneeded tab-bar bottom inset.
 *
 * Implemented with useSyncExternalStore so it needs no provider wrapper and
 * updates every subscriber on change.
 */
import { useSyncExternalStore } from 'react';

let fullscreen = false;
const listeners = new Set<() => void>();

export function setFullscreenApp(value: boolean): void {
  if (fullscreen === value) return;
  fullscreen = value;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): boolean {
  return fullscreen;
}

export function useFullscreenApp(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
