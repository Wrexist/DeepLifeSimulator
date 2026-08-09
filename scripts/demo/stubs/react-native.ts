/**
 * Minimal `react-native` stand-in so the save pipeline can be imported by a
 * plain Node script.
 *
 * The demo-save generator only needs pure functions out of
 * `utils/saveValidation`, but that module reaches `utils/logger` →
 * `services/RemoteLoggingService`, which imports `AppState` at module top
 * level. Nothing here is ever exercised — the generator never subscribes to
 * app state — so these are inert shapes, not behaviour.
 *
 * Wired in via `paths` in `scripts/demo/tsconfig.json`; it is not on any
 * app build path.
 */

export type AppStateStatus = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

export const AppState = {
  currentState: 'active' as AppStateStatus,
  addEventListener: (_type: string, _handler: (state: AppStateStatus) => void) => ({
    remove: () => {},
  }),
  removeEventListener: () => {},
};

export const Platform = {
  OS: 'web' as const,
  select: <T,>(spec: Record<string, T>): T | undefined => spec.web ?? spec.default,
};

export const NativeModules: Record<string, unknown> = {};

export default { AppState, Platform, NativeModules };
