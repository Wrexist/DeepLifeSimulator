import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the App Store App Preview capture rig.
 *
 * This drives the **web** target. Its job is to lock the edit cheaply — shot
 * order, dwell times, caption timing — not to produce the submitted video.
 * Apple Guideline 2.3.3 wants footage captured from the shipping app, and
 * react-native-web renders differ enough from native to be a rejection risk,
 * so the locked run is re-shot on the iOS build with
 * `xcrun simctl io booted recordVideo`.
 *
 * The viewport is phone-sized in CSS pixels on purpose: react-native-web lays
 * out against the CSS width, so a 886px-wide viewport would produce a tablet
 * layout. Crispness comes from deviceScaleFactor + the larger recorded size.
 */

const PHONE = { width: 430, height: 932 }; // iPhone 15 Pro Max, CSS px
const VIDEO = { width: 860, height: 1864 }; // 2x

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.artifacts',
  timeout: 180_000,
  expect: { timeout: 30_000 },
  // Capture runs are ordered, stateful and record video — parallelism would
  // interleave them and make the dwell timings meaningless.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],

  use: {
    baseURL: process.env.DEMO_BASE_URL ?? 'http://localhost:8081',
    viewport: PHONE,
    deviceScaleFactor: 2,
    isMobile: false, // react-native-web wants real mouse/touch events, not emulation
    hasTouch: true,
    video: { mode: 'on', size: VIDEO },
    trace: 'off',
    screenshot: 'off',
  },

  projects: [
    {
      name: 'preview-capture',
      use: { ...devices['Desktop Chrome'], viewport: PHONE, deviceScaleFactor: 2, hasTouch: true },
    },
  ],
});
