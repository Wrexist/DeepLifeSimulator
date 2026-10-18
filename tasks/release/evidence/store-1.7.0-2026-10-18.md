# Store version 1.7.0 - App Store Connect, 2026-10-18

**Submitted for review 2026-10-18 - WAITING_FOR_REVIEW** with build 196 (binary 2.16.0). Release type **MANUAL**: an approval does not reach players until someone presses Release in App Store Connect.

| Item | State | Evidence |
|---|---|---|
| Build 196 | `VALID` on App Store Connect | asc-release plan run 39149486566 (`ATTACH build 196 (VALID)`) |
| Version record 1.7.0 | Created (beats released 1.6.0), `releaseType: MANUAL` sent on create | asc-release apply run 39150007424 |
| Version copy | What's New + promotional text updated in en-US, es-MX, pt-BR, fr-FR, de-DE; description and keywords unchanged | `marketing/aso/metadata.mjs`, `npm run check:aso` green |
| App Information | Unchanged in all 5 locales | run 39150007424 |
| Screenshots | Carried over from 1.6.0: 10 x iPhone 6.9 / 6.5 / iPad 13 in all 5 locales, header + search assets placed | asc-screenshots plan run 39150167536 (`replace 10 -> 10` everywhere; nothing written) |
| Submission | Submitted, submission `29feb5a5-36aa-4606-8e72-2e3bc34cc88f` | asc-release apply-and-submit run 39150259499 |
| State after submit | `1.7.0 WAITING_FOR_REVIEW`, `1.6.0 READY_FOR_DISTRIBUTION` | asc-release plan run 39150404251 |

All runs were dispatched from branch `claude/store-1.7.0` (PR #243), whose only
change is the store copy above, so `main` matches what Apple holds once it merges.

Note: the 1.6.0 plan run 39149341912 stopped at "1.6.0 is not editable" before
the build lookup. A plan against a version that does not exist yet is how to
read a build's processing state without writing.

## Still open (owner)

1. On an iPhone, install TestFlight build 196 and check: the year-end bonus ad,
   the daily reward doubler and "Watch ad"; the Mindset cards on the Perks
   screen; the "Achievement Hunter" line in the Prestige breakdown; a 2.15.x
   save loading with nothing lost.
2. After Apple approves 1.7.0 and those checks pass, press **Release** in App
   Store Connect. If a check fails, cancel the review instead (asc-release
   workflow, mode `cancel-review`, confirm `CANCEL`, while it is
   WAITING_FOR_REVIEW), or reject the approved build before release.
