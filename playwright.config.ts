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

// YouTube Shorts is a hard 1080x1920 (9:16), and the recorder captures at the
// page's CSS-pixel size — deviceScaleFactor does NOT raise recording
// resolution. So the viewport is a real 1080x1920 and `installHiDpi` in
// e2e/support/shortsOverlay.ts makes the app lay out as a 540x960 phone inside
// it via a document zoom. That yields true 2x pixels with a phone layout.
const SHORTS_VIEWPORT = { width: 1080, height: 1920 };
const SHORTS_VIDEO = { width: 1080, height: 1920 };

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
      testMatch: /appPreview\.capture\.spec\.ts/,
    },
    {
      name: 'shorts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: SHORTS_VIEWPORT,
        deviceScaleFactor: 1,
        hasTouch: true,
        video: { mode: 'on', size: SHORTS_VIDEO },
      },
      testMatch: /shorts\.capture\.spec\.ts/,
    },
  ],
});
