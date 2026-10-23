/**
 * Share a rendered view as an image, falling back to text.
 *
 * A text obituary in a chat gets read once; a picture of a finished life gets
 * reposted to Stories, TikTok and Discord. So share surfaces try the image
 * first and keep the text share as the floor.
 *
 * Both native modules load lazily inside try/catch (CLAUDE.md §4.6): an OTA
 * update can land this JS on a binary built before react-native-view-shot and
 * expo-sharing were added. There `require` either throws (expo-sharing's
 * `requireNativeModule`) or `captureRef` rejects (view-shot), and either way
 * the caller gets `false` and shares text exactly as it did before.
 *
 * Platform split: iOS's share sheet takes a file URL AND the message, so the
 * image travels with the link text through React Native's `Share`. Android's
 * `Share` cannot attach files, so the image goes through expo-sharing, which
 * carries no message - which is why the card itself prints the link.
 */
import type { RefObject } from 'react';
import { Platform, Share } from 'react-native';
import { logger } from '@/utils/logger';

interface ViewShotModule {
  captureRef: (
    view: unknown,
    options: { format: 'png' | 'jpg'; quality?: number; result: 'tmpfile'; width?: number; height?: number },
  ) => Promise<string>;
}

interface SharingModule {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (url: string, options?: { mimeType?: string; dialogTitle?: string; UTI?: string }) => Promise<void>;
}

function loadViewShot(): ViewShotModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-view-shot');
    return mod && typeof mod.captureRef === 'function' ? (mod as ViewShotModule) : null;
  } catch (err) {
    logger.debug('[shareImage] react-native-view-shot unavailable', { err: String(err) });
    return null;
  }
}

function loadSharing(): SharingModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-sharing');
    return mod && typeof mod.shareAsync === 'function' ? (mod as SharingModule) : null;
  } catch (err) {
    logger.debug('[shareImage] expo-sharing unavailable', { err: String(err) });
    return null;
  }
}

export interface ImageShareOptions {
  /** Text sent with the image where the platform allows it (iOS). */
  message: string;
  /** Share-sheet title. */
  title?: string;
  /** Output width in pixels; the view is scaled to it. */
  width?: number;
}

/**
 * Capture `ref` as a PNG and open the share sheet with it.
 * Returns true when the image share sheet opened, false when the caller
 * should fall back to a text share. Never throws.
 */
export async function shareViewAsImage(ref: RefObject<unknown>, options: ImageShareOptions): Promise<boolean> {
  if (Platform.OS === 'web' || !ref.current) return false;
  const viewShot = loadViewShot();
  if (!viewShot) return false;

  let uri: string;
  try {
    uri = await viewShot.captureRef(ref.current, { format: 'png', result: 'tmpfile', width: options.width });
  } catch (err) {
    logger.warn('[shareImage] capture failed, falling back to text', { err: String(err) });
    return false;
  }

  try {
    if (Platform.OS === 'ios') {
      await Share.share({ url: uri, message: options.message, title: options.title });
      return true;
    }
    const sharing = loadSharing();
    if (!sharing || !(await sharing.isAvailableAsync())) return false;
    await sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: options.title, UTI: 'public.png' });
    return true;
  } catch (err) {
    logger.warn('[shareImage] share sheet failed, falling back to text', { err: String(err) });
    return false;
  }
}
