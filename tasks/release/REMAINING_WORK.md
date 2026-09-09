# Deep Life Simulator: remaining release work and master-prompt handoff

Updated 9 September 2026. Repository: `Wrexist/DeepLifeSimulator`.
Review branch: `codex/fresh-release-workflow`, [PR #203](https://github.com/Wrexist/DeepLifeSimulator/pull/203).
Inspected implementation: `6d2346e7b55ceff19c21dd286a665469dffc4d02`.

**Verdict: HOLD for App Store release.** Five packages are verified within their
recorded scope. Seven require external, visual or native evidence. This is the
complete remaining list for the agreed next-release scope, not a claim that every
possible future feature or undiscovered defect has been enumerated.

## What is finished

| Package | Completed work | Proof and limit |
| --- | --- | --- |
| R00 | Fresh source, save, logic, product and release audit | `AUDIT.md`; baseline and gaps recorded separately |
| R01 | Stalled old saves cannot overwrite newer progress through watchdog lock release | Reproduced delayed-write regression; real mutex/double-buffer tests |
| R02 | Research advances on played weeks and replays deterministically | Mounted slot-switch, atomic completion/bonus and real-week continuation tests |
| R03 | Incomplete browser evidence fails the release gate | Missing, duplicate, malformed, failed and unreached cases tested |
| R05 | Economy/continuity checks and owned-resource cleanup | `evidence/R05-cleanup-2026-09-09.md`; clean full serial suite and opt-in simulations |

Current R05 evidence: **782 suites, 9,782 tests and 308 snapshots passed** with
clean exit. The unchanged 17 opt-in suites/32 tests skipped in the normal suite
are not counted as passes. Relevant opt-ins ran separately: 120-week save/load,
five personas each replayed three 80-week lives, four-persona 100-week retention.
Source/test types and local preflight passed. These are Node/test-renderer and
source/build checks, not native StoreKit, human playtesting or device performance.

Both remote workflows passed for the inspected implementation: Preflight
[34312514459](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/34312514459)
and EAS Update
[34312514460](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/34312514460).
Consult the latest PR checks after any later commit rather than reusing these runs.

## This completion pass

- Rechecked the only open PR, its current SHA and both successful workflows.
- Confirmed R05's later resource fixes and clean-exit evidence. The earlier
  unresolved teardown warning is superseded by that investigation, not still a
  required cleanup task.
- Corrected support-source purchase restoration, pending-recovery and local-save
  guidance. Removed an obsolete version reference and an unverified response-time
  promise. Recovery guidance now matches the original-character/slot requirement.
- Corrected the ASO guide's subtitle-testing claim. Apple's Product Page
  Optimization supports icons, screenshots and app previews, not subtitles.
- Flagged historical store version 1.5.0 and stale release-note copy before someone
  uses the metadata apply script for the next version. No version was guessed.
- Revalidated all **30 unique RGB PNGs**: ten each at 1320×2868, 1284×2778 and
  2064×2752, no alpha, full decode, dimensions and source/storyboard hashes match.
- Ran `check:aso`, `check:content` and `check:liveops`: no blocking failures.
  The keyword field is 84/100; padding it without relevance/search evidence is not
  a release requirement. Combined online live-event quiet stretches are 7 days
  for new/early and 14 days for later stages. Individual calendars have longer
  gaps, already identified as product observations rather than crashes.
- Rechecked live support/privacy pages. The published privacy disclosures are
  still stale. Candidate source edits have not been deployed.
- Retried visual access: browser tab discovery timed out, then the local support
  page returned `ERR_BLOCKED_BY_CLIENT`. No fresh screenshot or visual pass claimed.
- Ran read-only `npm run asc:status`: blocked by missing `ASC_KEY_ID`,
  `ASC_ISSUER_ID` and `ASC_KEY_P8`/`ASC_KEY_P8_PATH`. No external store mutation.

The screenshot setup initially failed because its documented `npm ci` command had
no lockfile. Added a lockfile for the already pinned Sharp version, then the exact
isolated `npm ci` command passed. Revalidated all 30 exports with that isolated
dependency and the shared-runtime fallback disabled. No image was re-rendered.

Focused release-workflow/privacy regression: 2 suites, 11 tests passed, exit 0.
Support HTML parses and all relative links resolve. Visual review is still blocked.

## Complete remaining list, in execution order

| Order | Package and detailed brief | What must be done | What is missing | Done only when |
| --- | --- | --- | --- | --- |
| 1A | [R11: Privacy and operations](R11.md) | Confirm actual provider data/consent/retention, operator facts and ASC privacy answers, visually review and publish corrected policy/support | Authorized provider/ASC evidence and deployment/visual session | Live policy, labels and candidate behavior agree |
| 1B | [R04: Player journeys](R04.md) | Exercise new life through first wage, education, business/research, relationships, poverty recovery, death/heir and navigation | Working interactive app/browser or native session | Every required journey reached, visible defects fixed and recaptured |
| 1C | [R08: Signed candidate](R08.md) | Resolve current build/version identity, run production-env gates, prepare authorized native build and verify TestFlight processing | EAS/Apple environment and processed candidate access | Exact source/version/build is signed, processed and verified |
| 2A | [R06: Native purchases](R06.md) | Catalog, quantities, permanent/mixed packs, subscription, interruption, wrong life, retry/restore and reinstall tests | R08 candidate, devices and sandbox purchase session | Correct benefit once, durable recovery and accurate support instructions |
| 2B | [R09: Devices and accessibility](R09.md) | iPhone/iPad startup/save upgrade/lifecycle, ads/ATT, modals, faces, accessibility and performance | R08 candidate and real devices | Required cases pass with device/build evidence |
| 2C | [R07: Store and screenshots](R07.md) | Reconcile next version/release notes/locales, native parity of all ten panels, ASC fields and upload order | R04/R11 evidence, native candidate and current ASC record | Copy, images, links and uploaded record match the candidate |
| 3 | [R10: Submission packet](R10.md) | Reconcile every gate, exact build, review notes, products, privacy/content answers, rollout and support plan | R06/R07/R09 completed evidence and final owner decisions | Submission packet complete and all release gates truly pass |

Rows sharing an order can be investigated independently. The queue still allows
only one active package. A blocked package does not satisfy a dependency. R07's
native screenshot comparison additionally needs the R08 candidate even though its
queue prerequisites cover the journey and disclosure work.

## Exact information needed to unblock the work

| Required input/access | Why it matters | Safe handoff |
| --- | --- | --- |
| Current App Store Connect version and build records | Source metadata still says 1.5.0; observed public listing was 1.5.5; neither establishes next draft | Authorized read-only ASC status/export or redacted screenshots of version/build state |
| EAS production build/environment evidence | Local export does not verify signing, production keys or processed native build | Build/run ID, redacted validation results and secure environment access |
| iPhone and iPad candidate session | Native modals, StoreKit, VoiceOver and real save upgrades cannot be certified from Node/web tests | TestFlight build/version, device/OS and recorded test cases |
| Sandbox purchase setup | Real SDK events, cancellations and recovery must be observed | Authorized tester session; never put credentials or full receipts into repository evidence |
| Owner/provider operational facts | Controller/contact, retention, deletion and consent configuration are not inferable from an enabled flag | Confirmed facts and redacted dashboard evidence |
| Working visual preview | Support/privacy and app changes need visible acceptance | Reachable candidate preview or device captures, named with source/build |
| Deployment/submission decision | Main merge publishes production OTA and support changes trigger Pages deployment | A concrete reviewed ref/build and action under current owner authorization |

Do not paste API private keys, passwords, OTPs or customer receipts into chat or
committed files. Public contact details already used by the app may remain public.
No new identity/account backend is required just to finish this release.

## How to turn any row into the next master prompt

Each linked brief already contains the objective, current evidence, source files,
execution cases, boundaries and acceptance requirements. Use this wrapper with the
chosen brief, rather than sending the entire historical chat:

```text
Work in Wrexist/DeepLifeSimulator. Read CLAUDE.md, tasks/release/CONTRACT.md,
queue.json, REMAINING_WORK.md and the selected Rxx.md brief. Refresh main,
open PRs, latest SHA and checks. Do not overwrite another active agent's work.

Execute Rxx's acceptance scope. First verify the stated prerequisites are now
available and recheck the finding against current source. Reproduce each defect,
implement the smallest sustainable correction, verify the relevant existing
regressions, and capture before/after for visible changes. Preserve schema,
economy, accepted UI and all validation ratchets unless this package explicitly
requires a justified change.

Record source/build identity, exact commands, exit results, actual reached cases,
redacted evidence, limitations and remaining blockers. Commit and publish to the
review branch, inspect CI on the latest SHA, and resolve failures. Close this
package only when its acceptance criteria are demonstrated. Then select/refine
the next eligible package and continue. If blocked, record the exact missing
input and continue only independent work. Do not invent device/store approval.

Finish with completed changes, verification, the updated remaining list and the
next eligible action. Never treat a skipped/unreached test as a pass. Keep
ready-for-submission, submitted, Apple-approved and published as separate states.
```

Use `npm run release:status` for the ledger, `npm run release:next` for the selected
brief, and `npm run release:check` for the final gate. A HOLD/exit 1 is expected
while these seven packages are unverified. The CLI selects and validates work;
the enabled hourly agent routine executes it. It cannot manufacture credentials,
operate an unavailable physical device or guarantee Apple approval.

## Explicitly outside the next-release requirement

New story arcs, social redesigns, additional marketing campaigns, an account/cloud
backend, speculative keyword expansion and unmeasured economy changes are future
ideas. New defects discovered by the required acceptance cases are in scope and
must be triaged into the appropriate package. Do not restart closed R05 cleanup
without new evidence or turn optional ideas into an endless launch gate.

## Primary references checked

- [Apple Product Page Optimization](https://developer.apple.com/help/app-store-connect/create-product-page-optimization-tests/overview-of-product-page-optimization)
- [Published support](https://wrexist.github.io/DeepLifeSimulator/support.html)
- [Published privacy](https://wrexist.github.io/DeepLifeSimulator/privacy.html)
- Existing screenshot-size/provider sources and initial findings: `AUDIT.md`.
