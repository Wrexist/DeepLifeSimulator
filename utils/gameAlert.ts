/**
 * gameAlert - the in-app replacement for React Native's `Alert.alert`.
 *
 * The game carried its core messaging on 268 native `Alert.alert` calls: every
 * lock explanation, every onboarding validation, every save failure. A native
 * alert is an OS dialog in the OS font, unstyleable and un-brandable, dropped
 * on top of a bespoke glass UI - the single loudest "this is unfinished" signal
 * left in the product.
 *
 * The signature deliberately MIRRORS `Alert.alert(title, message, buttons)` so
 * converting a call site is a one-word edit and cannot silently change
 * behaviour. Button `style` follows the platform vocabulary
 * ('default' | 'cancel' | 'destructive').
 *
 * SAFETY: unlike `showGlobalToast`, a dropped alert can strand the player - it
 * often carries a decision ("Delete this save?"). So when no host is mounted
 * (boot, tests, a headless render) this falls back to the real native
 * `Alert.alert` rather than no-oping. The dialog is always shown; only its
 * dressing depends on the host.
 */
import { Alert } from 'react-native';

export type GameAlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface GameAlertButton {
  text: string;
  onPress?: () => void;
  style?: GameAlertButtonStyle;
}

export interface GameAlertOptions {
  /** Visual tone of the badge. Inferred from the buttons when omitted. */
  tone?: 'default' | 'warning' | 'danger' | 'success';
  /** Android-style dismiss-on-backdrop. Defaults to true when a cancel exists. */
  cancelable?: boolean;
}

export interface GameAlertRequest {
  id: number;
  title: string;
  message?: string;
  buttons: GameAlertButton[];
  options?: GameAlertOptions;
}

type AlertHandler = (request: GameAlertRequest) => void;

let alertHandler: AlertHandler | null = null;
let nextId = 1;

/** Registered by AlertHost on mount. Pass null on unmount to clear. */
export const setAlertHandler = (handler: AlertHandler | null): void => {
  alertHandler = handler;
};

/** Test seam - lets a suite assert the bridge is wired without a host. */
export const hasAlertHandler = (): boolean => alertHandler !== null;

/**
 * Show a themed in-app alert. Drop-in for `Alert.alert`.
 *
 * With no buttons, renders a single "OK" - the same default the platform uses.
 */
export function gameAlert(
  title: string,
  message?: string,
  buttons?: GameAlertButton[],
  options?: GameAlertOptions
): void {
  const resolved: GameAlertButton[] =
    buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }];

  if (!alertHandler) {
    // No host mounted - never swallow the decision, use the platform dialog.
    Alert.alert(
      title,
      message,
      resolved.map((b) => ({ text: b.text, onPress: b.onPress, style: b.style }))
    );
    return;
  }

  alertHandler({ id: nextId++, title, message, buttons: resolved, options });
}

export default gameAlert;
