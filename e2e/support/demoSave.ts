import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';

const BUNDLE_PATH = resolve(__dirname, '../../scripts/demo/demo-save.json');

export interface DemoBundle {
  entries: Record<string, string>;
  chapters: { slot: number; key: string; title: string; caption: string; netWorth: number; age: number }[];
  stateVersion: number;
}

export function loadDemoBundle(): DemoBundle {
  if (!existsSync(BUNDLE_PATH)) {
    throw new Error(
      `Demo save bundle missing at ${BUNDLE_PATH}. Run \`npm run demo:save\` first.`
    );
  }
  return JSON.parse(readFileSync(BUNDLE_PATH, 'utf8')) as DemoBundle;
}

/**
 * Write the demo saves into localStorage **before any app code runs**.
 *
 * On web, AsyncStorage is backed by localStorage, so seeding these keys is
 * indistinguishable from the app having written them itself. `addInitScript`
 * runs on every document before its scripts, which matters because the app
 * reads `currentSlot` during boot — seeding after `goto` would race it.
 *
 * `currentSlot` is set to the chapter we want to open into, so the capture run
 * lands on a loaded life rather than the main menu.
 */
export async function seedDemoSaves(page: Page, openSlot?: number): Promise<void> {
  const bundle = loadDemoBundle();
  const entries = { ...bundle.entries };
  if (openSlot != null) {
    entries.currentSlot = String(openSlot);
    entries.lastSlot = String(openSlot);
  }

  await page.addInitScript((seed: Record<string, string>) => {
    try {
      for (const [key, value] of Object.entries(seed)) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // A storage failure here should surface as a blank app, not a silent
      // half-seeded state that looks like a game bug during capture.
      // eslint-disable-next-line no-console
      console.error('[demo] failed to seed localStorage');
    }
  }, entries);
}
