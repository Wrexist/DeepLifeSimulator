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

/**
 * Host STACK, not a single slot. iOS presents an RN `Modal` from the view
 * controller nearest its mount point, so the root AlertHost's dialog cannot
 * present while another full-screen Modal (death screen, gem shop) is up -
 * the root VC is already presenting and UIKit silently refuses the sibling.
 * Those surfaces mount their OWN nested AlertHost inside their Modal; it
 * registers on top of the stack and takes the alerts while it is mounted, so
 * the dialog presents from the covering Modal's view controller and actually
 * appears. The root host stays as the fallback for everything else.
 */
const alertHandlers: AlertHandler[] = [];
let nextId = 1;

/**
 * Registered by each AlertHost on mount; returns the matching unregister.
 * Removal is by identity, not a blind pop, so hosts may unmount out of order
 * (the death Modal suppresses itself - and its nested host - mid-bridge).
 */
export const registerAlertHandler = (handler: AlertHandler): (() => void) => {
  alertHandlers.push(handler);
  return () => {
    const index = alertHandlers.lastIndexOf(handler);
    if (index >= 0) alertHandlers.splice(index, 1);
  };
};

/** Test seam - lets a suite assert the bridge is wired without a host. */
export const hasAlertHandler = (): boolean => alertHandlers.length > 0;

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

  // Most recently registered host wins - that is the one nested inside
  // whatever Modal currently covers the screen.
  const handler = alertHandlers[alertHandlers.length - 1];
  if (!handler) {
    // No host mounted - never swallow the decision, use the platform dialog.
    Alert.alert(
      title,
      message,
      resolved.map((b) => ({ text: b.text, onPress: b.onPress, style: b.style }))
    );
    return;
  }

  handler({ id: nextId++, title, message, buttons: resolved, options });
}

export default gameAlert;
