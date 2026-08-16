/**
 * Minimal entry point that loads Expo Router (CLAUDE.md Hard Rule #1 —
 * "entry.ts stays dumb"). All initialization logic lives in app/_layout.tsx.
 *
 * This file is `package.json` `main`, so it is the module Metro evaluates first
 * and nothing imports it — it has no exports for the same reason. It previously
 * carried a `default export function Entry() { return null }` under a comment
 * claiming "Expo Router requires a default export"; that is not true of the
 * ENTRY module (it is true of route files), nothing ever read it, and the
 * inaccurate comment invited future additions here. 2026-08-16 audit L14.
 */
import 'expo-router/entry';
