# Player bug reports, re-verified against HEAD (2026-09-05)

Five reports from the tester (BBQ, Discord #bug-reports, 2026-08-31/09-01, one
bumped 2026-09-05), all filed against **binary 2.5.8 / App Store 1.5.0**. HEAD
is 2.13.0, so the first question for each was not "is this a bug" but "is it
still a bug". Two were already fixed; three were not, and one of those is a
soft-lock.

Every verdict below was re-read in the source rather than taken from the
report or from a previous fix's commit message.

## Already fixed — verify on a current build, no action

| report | fixed by | evidence |
|---|---|---|
| **Recurring pop-ups of events that already happened** | save-format v50 `shownNotificationIds` | The record was an in-memory `Map` on a module singleton, while every milestone's condition is derived from the save and stays true forever — so each relaunch re-armed the whole backlog. Now persisted; an existing save seeds itself from milestones it has demonstrably passed and fires none. `__tests__/actions/smartNotificationHistory.test.ts`, 8 tests, green. The report is quoted in the code as the reason. |
| **Moving in makes them a spouse; propose/break-up say "partner not found"; spouse missing from family page** | `fffe9e9` | `moveInTogether` sets only `livingTogether` and keeps `type: 'partner'` (verified at `GameActionsContext.tsx`). The real culprit was the wedding event stamping `type = 'spouse'` by hand instead of `buildSpouseRecord`, which is why propose and break-up (both look for `type === 'partner'`) answered "partner not found". Divorce clears both the relationship and `family.spouse`. |
| **Forever engaged, wedding never occurs** | `fffe9e9` | `applyScheduledWedding` was postponing an unaffordable balance four weeks at a time until a one-year expiry, announcing each step to the logger and to nobody else. It now states the balance due. |
| **Life Skills "unlock skill" button does nothing** | `fffe9e9` + `669e075` | The confirm was raised through `gameAlert` from inside an RN Modal nesting no `AlertHost`; iOS refuses the root host's sibling presentation. 13 surfaces were fixed then, `BaseModal` (22 more consumers) yesterday. |

## Still present at HEAD — fixed here

### 1. The Life Skills modal could not be closed. **P1, soft-lock**

The tester's three sentences are one defect: *"the UI for showing the X does
not properly show up on the screen. When leaving the page the screen freezes
and nothing works."*

`SkillTreeModal`'s header is a fixed-width row holding the title, two stat
badges and the close button. RN defaults `flexShrink: 0`, so all three were
rigid; their intrinsic widths exceed the card, and `container` carries
`overflow: 'hidden'`, so the last child — the X — was clipped off the edge.

**Photographed, not argued.** Rendered against a real web export at 390pt: the
header ends at "0 Unlocked" and there is no X. iOS does not hit-test a subview
outside its parent's bounds, so even the `hitSlop` could not rescue it.

That turns a layout bug into a soft-lock, because the X was the *only* exit:
`onRequestClose` is the Android back gesture, and the backdrop was a plain
`View`. On iOS the player was sealed inside the sheet with the tab bar covered.

Fixed by letting the row give where it should and never where it must not: the
title, the stat badges and their text shrink and ellipsize (longhand
`flexShrink`/`minWidth`, not the `flex` shorthand that expands differently
under Yoga and react-native-web — `tasks/lessons.md`, 2026-09-04), the close
button is pinned `flexShrink: 0`, and the header text is capped to one line and
a 1.3 font multiplier so Dynamic Type cannot widen it again. The backdrop now
closes the sheet as well, so no future header regression can strand anyone.

Re-photographed after the fix at 390pt and 360pt: the X is on screen and the
labels ellipsize. Pinned by four tests in
`__tests__/render/skillTreePanelLayout.test.ts`; planted-violation checked.

### 2. One lost election ended the political career, permanently. **P1**

*"When going from State Representative to Governor on the last day before
you're able to promote it automatically puts you back as a Citizen. I tried
twice with same result. I had high approval on both attempts."*

Two mechanisms, and the second is the damage.

The collision is real: a State Rep seat is contested every 104 weeks and
Governor needs 208 weeks of tenure, so the seat is defended on exactly the week
the promotion unlocks. The re-election roll is clamped to at most 92%, so even
at full approval the seat is lost about one time in twelve — and the roll is
seeded on the life and the week, so replaying that week reproduces the same
loss. That is why two attempts gave one answer.

The lock is the bug. `runForOffice` measures tenure as
`career.accepted ? weeksLived - startedWeeksLived : 0`, and the office exit
sets `accepted: false`. So for every voted-out ex-official that counter is
pinned at **0 and can never grow**, and every rung with a `minWeeksInPrevious`
(Mayor 52, Governor 208, Senator and President 260) refuses forever with "you
need N more weeks in your current position" — a position they no longer hold.
The only re-entry was Council, the one office with no prerequisite, and winning
it writes `level: 0`, resetting the ladder. Meanwhile the loss notification
told the player to *"win back the seat by running again."*

Fixed by not applying a requirement that is structurally unsatisfiable: a
player who has already reached that rung and is out of office has served their
time, and `career.level` (deliberately preserved across the exit for exactly
this kind of record) is the proof. A sitting official still has to serve the
weeks, and someone who never held the rung is still refused — both pinned as
controls in `lib/politics/__tests__/officeExitEligibility.test.ts`.

### 3. Lobbyists could never be re-hired after leaving office. **P2**

*"Lobbyist that are inactive from a previous election remain inactive and
cannot be re-hired."* Exactly right. `applyOfficeExit` retires every lobbyist
to `active: false` but keeps the rows, and both hire guards tested the id
alone — so a retired roster read as a hired one. The picker also built its
"already hired" set from every row regardless of state, so those people
vanished from the catalogue too. `fireLobbyist` would have cleared the row but
has **no call site anywhere in the app**, so there was no way out from inside
the game.

Both guards are active-aware now, the catalogue offers retired lobbyists again,
and a re-hire replaces the retired row rather than appending a second entry
with the same id.

### 4. Activity Commitments: half the card was fiction. **P1 + P2**

*"As weeks progress the commitment levels do not go up... there is no −20%
energy consumption. It still base of 20 energy... This applies to the other two
as well. They do not perform."*

The **levels** half was fixed in `fffe9e9`. The rest was not:

- **Health progress was never applied.** The energy side of the health
  commitment was wired; the progress side was not. Measured on the real action,
  a walk returned health 3 / fitness 1 identically at no focus, at primary, at
  primary level 100 and at neglected — so the card's "+30% progress" and
  "−15%" were never worth anything, and the whole 0-100 level bar bought a
  health player nothing they could see. Now scaled, matching how every other
  area applies its own metric. `happinessGain` is deliberately left raw: it is
  cross-domain and already passes through the happiness taper, which must stay
  the one place that curve lives (CLAUDE.md §4.3).
- **The screens quoted the base cost while the actions charged the modified
  one.** The health tab and the hobbies modal both showed raw energy. That hid
  the discount and, worse, disagreed with the charge in both directions: a
  player with 4 energy and health as primary was shown "Need 5 energy" and
  locked out of an action costing 4, while a neglected-area player was quoted 5
  and debited 6. This is the same advertise-equals-apply rule the v48 food
  fix exists to enforce, and it is what the tester actually measured.

## Not changed, and why

| finding | call |
|---|---|
| **PAC spending is half as efficient as spending directly** — `pac.ts` grants 1 approval per $10,000 while `campaign()` grants 1 per $5,000, yet both its own comment and the action's promise "1.5× approval per $". The tester's "spending from PAC pool does not do anything but raise approval" is literally correct. | **OWNER.** The claim is comment-only, never shown to the player, so nothing on screen lies. Correcting it is a balance change (a 3× buff to a money sink) or a comment edit, and picking is the owner's. |
| **"Standing" only goes down** | **Correct on 2.5.8, fixed since.** `partySupport` gained its first reachable increaser on 2026-08-23, after the report: enacting a favoured policy is +6. What remains is real but a design call: drift pulls toward 50, so above it the score decays 1/week unconditionally, and holding the 60-point endorsement needs a favoured bill every ~6 weeks from a one-shot pool. The tester's second sentence — *"enacting the platform needs clarification"* — also stands: the party card says enacting the platform raises standing but never names which categories the party favours. |
| **Android AdMob ad units absent** | Deliberate and documented in the workflow: the units do not exist yet, iOS-only ad launch. |
