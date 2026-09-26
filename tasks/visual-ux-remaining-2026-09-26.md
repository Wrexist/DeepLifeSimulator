Latest follow-through: [26 September polish evidence](release/evidence/game-polish-2026-09-26.md).
Save-slot safety is now implemented and browser/provider verified. All 19 app
entry screens have phone/tablet captures; their nested journeys remain open.

# Everything remaining after the visual rebuild

Status checked 26 September 2026 against PR #229, head `1a95a49b`.
Current remote main remains `9e729ac2`; the PR is a draft and is not merged.

## Verified now

All final-head checks pass: full tests, coverage ratchet, preflight, quality and
CodeRabbit status. Supabase Preview is intentionally skipped, not failed.
CI: 821 suites / 10,011 tests / 308 snapshots passed; existing opt-in skips are
17 suites / 32 tests. Coverage: statements 60.81%, branches 43.04%, functions
52.72%, lines 62.18%; no ratchet regression. Local preflight and iOS export pass.

Implemented: shared navy tokens/primitives, five primary tabs, preserved HUD,
Home/Profile portraits, improved Work/Apps/Life/Bank surfaces, six curated
portraits, six original 3D destinations, reduced-motion-aware feedback and seven
sound cues. Save schema 51 and canonical simulation/purchase services remain.

[Screenshot gallery](release/evidence/visual-ux-2026-09-26/gallery.html).
These are browser screenshots. No new signed native candidate was created.

## Important scope correction

The completed work is a substantial implementation, but the entire original
premium-product brief is not fully accepted. Earlier wording that all
implementation was complete was too broad. The list below separates unfinished
product polish, unverified behavior and optional expansion. Green CI does not
establish that every screen matches the reference quality.

## 1. Next coding pass: complete the visual system and screen review

- [ ] Build a per-screen acceptance matrix for every tab, mini-app, modal and
  onboarding step, including unlocked/late-life states. The five primary screens
  have browser captures; that is not an exhaustive playable-app review.
- [ ] Finish remaining color, spacing, radius and typography migration where
  screen-local rules still exist. Audit semantic money/vital colors and functional
  emoji. The ratchet still measures 152 gradient elements, 94 raw font sizes and
  652 heavy weights; these are ceilings, not proof the final design is consistent.
- [ ] Compact-phone density: review hero/art heights and spacing so important
  actions/objectives are easy to reach. In the 375 x 667 Work capture, Apply is
  below the initial viewport. The early-life Apps screen also has a large empty
  region. Improve these without changing unlock rules or stuffing in fake data.
- [ ] Review Home's objective selection, completed/empty goals, employed versus
  unemployed states, long names and large wealth values. Verify 2-4 useful goals
  where appropriate rather than expanding every game system onto Home.
- [ ] Finish a coherent finances navigation across phone Bank and Advanced Bank:
  align Overview/Income/Assets/Loans access, composition and transactions around
  real data. The new shared net-worth overview alone is not the full redesign.
- [ ] Finish Profile's progression hierarchy and all secondary destinations:
  achievements, statistics, collections where supported, legacy and help.
- [ ] Review Life activities and family/relationships for clear effect, cost,
  requirement, cooldown and locked-state explanations. Their domain logic remains
  existing; not every relationship state received a new visual treatment.
- [ ] Review Apps categories and the locked/empty experience with phone-only,
  computer-only, both devices and no device. Existing icon artwork was retained;
  no entirely new OS icon family was generated.
- [ ] Verify consistent pressed/disabled/loading/selected, empty, locked, error,
  insufficient-money and offline states throughout the whole app.
- [ ] Complete dark/light contrast and text-scaling review across old saves and
  every modal, beyond the targeted contrast corrections already implemented.

## 2. Finish the art, motion and sound acceptance

- [ ] Review the six scenes in every actual placement (Work, Health, Education,
  Hustle and Contacts), including scrolling, tab switches and backgrounding.
- [ ] Record a short real gameplay video showing press feedback, progress changes,
  ambient scene movement, portrait selection and Next Week. Screenshots cannot
  establish animation quality or timing.
- [ ] Audit/finish the existing achievement, promotion, XP, currency and successful
  purchase feedback so timing, haptics and reduced motion form one system. Some
  existing effects remain; this is not a claim that those systems lack effects.
- [ ] On a native build, tune the seven cues for volume, overlap and latency; test
  Settings mute, iOS silent switch, headphones, calls/audio interruptions,
  background/resume and missing-backend fallback. Do not add continuous noise.

Optional content expansion after that review (not an automatic release blocker):
more home/career/business/vehicle scenes, richer original props, a broader curated
portrait roster and more age/presentation diversity. The current six portraits
are deliberately static, not a layered soft-3D hair/clothing or aging system;
editable aging/genetics remain in Custom mode. A layered or animated portrait
system would be a separate architectural/art decision, not a missing toggle.
Real-time 3D is not required for the agreed 2.5D direction.

## 3. Save and journey regression follow-ups

- [x] Reproduced and fixed the save-slot-switch risk on PR #229. Historical investigation: Settings still
  suspends life autosave and navigates without first explicitly awaiting a save.
  Test a recent market purchase, slot switch and reload. If it loses progress,
  fix through the owning save flow and add a behavioral regression. This is a
  source-backed investigation item, not a newly reproduced failure in this pass.
- [ ] After that behavior is safe, review the older pre-save setTimeout/200ms
  yields noted in tasks/todo.md; remove only demonstrably redundant delays.
- [ ] Exercise full first-life, first-wage, education cash/loan, low-cash recovery,
  business research, dating/family, death/revive and heir journeys (R04).
- [ ] Verify rapid Next Week taps, important-event presentation, recap accuracy,
  generation changes and old-save continuity using canonical transitions.
- [ ] Recheck welcome-back -> daily-reward modal handoff on device, which remains
  an existing native acceptance item. Do not reopen already merged fixes as if
  their implementation were still outstanding.

## 4. Signed candidate and native acceptance ? required before release

- [ ] Prepare the precise candidate version/build after reading current EAS and
  TestFlight history. Historical release-queue version numbers are not current
  store evidence. Record source SHA, binary version, build number and profile.
- [ ] Verify production signing and provider configuration without printing keys:
  save signing, RevenueCat/receipt verification, ads/ATT, Firebase and debug flags.
- [ ] Obtain separate authorization for a native build, then create/process the
  candidate in TestFlight (R08). expo-audio/expo-asset require a new native binary.
- [ ] Check compact iPhone, standard/large iPhone and iPad: safe areas, Dynamic
  Island, orientation, keyboard, reachable controls and modal priority.
- [ ] Check VoiceOver labels/order, Larger Text, contrast, non-color meaning,
  reduced motion and practical touch targets.
- [ ] Check cold start online/offline, slow/failing requests, background/kill/
  relaunch, old-save upgrade, slots, cloud/recovery and character persistence.
- [ ] Measure startup, Next Week, modal/scroll responsiveness, memory and stability
  on early and large late-life saves on an older supported device (R09).
- [ ] Test real sandbox purchases, subscriptions, cancellation, interrupted
  fulfillment, restore, repeated callbacks and wrong-slot/life recovery (R06).
- [ ] Test rewarded ads success/cancel/no-fill/offline, exactly-once rewards,
  remove-ads entitlements, ATT choices and banner impression reporting (R09).
- [ ] Fix reproduced defects, rebuild as needed and repeat affected acceptance
  against that exact new binary. Mocks/browser captures do not close these rows.

## 5. Store and release work ? separate from the visual implementation

- [ ] Refresh live App Store Connect fields through read-only inspection; verify
  support/privacy/EULA links and actual provider/consent behavior (R11).
- [ ] Reconcile App Privacy, content/age answers and owner-confirmed operational
  details. Source privacy corrections are not proof of live deployment.
- [ ] Update release notes, in-app changelog and localized store copy for changes
  actually new since the public build (R07).
- [ ] Capture final native marketing screenshots and compare every advertised
  screen/feature against the accepted build; verify current upload specifications.
  The browser captures in this report are review evidence, not store uploads.
- [ ] Assemble candidate identity, acceptance evidence, review instructions,
  metadata, monetization details, support/rollout/rollback plan (R10).
- [ ] Obtain explicit approval for merge/release actions, then verify submission,
  Apple review and publication as separate states. Do not infer permission to
  publish production OTA, submit to Apple or send community announcements.

## Recommended order

1. Review the screenshots and complete compact-layout, token and secondary-screen
   polish; reproduce the save-slot-switch risk in parallel with that review.
2. Finish the full journey/state matrix and motion/audio review; fix observed issues.
3. Freeze the candidate, then perform a separately authorized signed build.
4. Run R06/R09 native acceptance and resolve failures on the exact candidate.
5. Complete R07/R11 store/privacy parity, R10 packet and authorized release.

For a broader Android release, schedule its own signed build and equivalent
native purchase/ads/accessibility checks. An iOS export proves nothing about that
platform. Existing historical release-queue metadata must be refreshed, not
blindly treated as the current live store state.

## After identity refinement

Completed: original street-line identity, compact destination strips, concrete destination copy, quieter shared headers, menu branding, player record with life-relative week.

Next: carry this treatment through secondary apps and creator, review every state with real gameplay, then validate the signed iOS candidate. Portrait variety and editable/custom avatar parity remain art work; this pass did not replace the portrait system or complete the entire product revamp.
