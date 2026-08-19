---
name: eas-build
description: Trigger an EAS build for iOS or Android
disable-model-invocation: true
args: "[platform]"
---

# EAS Build

Trigger an EAS Build for DeepLife Simulator. This skill requires explicit user invocation since it has side effects (starts a cloud build).

## Arguments

- `ios` → build for iOS only
- `android` → build for Android only
- No argument → ask the user which platform

## Pre-Build Checklist

Before triggering the build, verify:

1. Run `npm run preflight:quick` (type-check)
2. Check that `app.config.js` has the correct version and build number
3. Confirm the build profile to use (production or preview)

## Build Commands

- iOS production: `eas build --platform ios --profile production`
- Android production: `eas build --platform android --profile production`
- iOS preview: `eas build --platform ios --profile preview`

## After Build

- Provide the EAS build URL for monitoring
- Remind the user to check build status with `eas build:list`

## After Submit

A submission takes 10-25 minutes and spends nearly all of it in EAS's queue and
the store upload. That is normal, not a hang. The release workflows schedule
with `--no-wait` and watch the result with `scripts/wait-for-eas-submission.mjs`;
from a laptop the same check is
`npm run submit:watch -- --platform <ios|android>` — pass the platform this
skill was invoked with, since the watcher's wording and the follow-up differ.

`FINISHED` means the store ACCEPTED THE UPLOAD, which is not the same as
accepting the build:

- **iOS** — Apple validates afterwards, and that is where ITMS-91064 and the
  purpose-string rejections surface as Invalid Binary. Confirm the build reaches
  TestFlight before calling the release done.
- **Android** — Play processes the bundle afterwards and can reject it there.
  Confirm the release shows up on the chosen track in the Play Console.
