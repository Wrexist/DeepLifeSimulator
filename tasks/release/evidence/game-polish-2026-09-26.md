# Game-wide polish acceptance - 26 September 2026

Scope: shared interaction and presentation fixes, HUD utility buttons, Settings,
Contacts, Mail, the business empty state, market labels and save-slot safety.
Approved HUD structure, schema 51, canonical simulation and purchases are retained.

## Reproducible browser evidence

- Early life: Food Courier, Tyler Nguyen, age 20, week 1, $1,500.
- Isolated unlocked-app QA save: the existing developer tool granted $1M; a
  computer was purchased for $5,000 through Market, followed by Settings ->
  Switch Save Slot -> Continue. The computer remained owned; cash was $996,500.
  These captures are test-fixture evidence, not a claim about earned progression.
- Entry screens at 375x667 and 768x1024; reduced motion enabled. Each app opened
  through the real launcher. No page errors or horizontal viewport overflow.
- Primary Home/Work/Apps/Life/Profile checked at both sizes; portrait sheet opened.
- Settings saves before leaving, blocks duplicate requests, and retains the life
  when the canonical writer rejects. Provider round-trip and failure tests cover it.
- Locked app explanation works on tap. Direct-link guard is source-reviewed;
  attempted cold-link browser automation did not establish that acceptance case.

## Screen inventory

PASS below means entry-screen layout and startup only. It does not establish
all nested actions, long histories, transaction flows or native behavior.

| App | Compact phone | Tablet | Deeper journey acceptance |
| --- | --- | --- | --- |
| Spark | PASS | PASS | Still required |
| Contacts | PASS | PASS | Still required |
| DeepMail | PASS | PASS | Still required |
| Pulse | PASS | PASS | Still required |
| Stocks | PASS | PASS | Still required |
| Bank | PASS | PASS | Still required |
| Pets | PASS | PASS | Still required |
| Education | PASS | PASS | Still required |
| Hustle | PASS | PASS | Still required |
| Crypto | PASS | PASS | Still required |
| Real Estate | PASS | PASS | Still required |
| Dark Web | PASS | PASS | Still required |
| YouVideo | PASS | PASS | Still required |
| Streaming | PASS | PASS | Still required |
| Travel | PASS | PASS | Still required |
| Political Office | PASS | PASS | Still required |
| Statistics | PASS | PASS | Still required |
| Garage | PASS | PASS | Still required |
| Luxury | PASS | PASS | Still required |

## Remaining acceptance

- Complete secondary tabs and transaction journeys: education/loans, business,
  relationships/family, asset purchases, death/revive and heirs; capture error,
  cooldown, affordability and long-history states.
- Audit legacy absolute-week labels in finance/statistics for clearer wording.
  No account-age/economy formula was changed by this presentation pass.
- Extend character and media-art consistency: curated player portraits coexist
  with the original genetic NPC avatars and older media thumbnails.
- Check native VoiceOver, Larger Text, keyboard, iPhone/iPad safe areas, audio,
  interruptions, background/kill/relaunch, purchases/restore and ads on the exact
  signed build. Browser checks cannot close those cases.
- No OTA, merge, paid build or store submission performed.

[Gallery](visual-ux-2026-09-26/polish-gallery.html)

## Verification results

- Full local regression run completed, exit 1: 821 suites passed, one failed;
  10,015 tests passed, one failed; all 308 snapshots passed. 17 suites / 32 tests
  are existing opt-in skips. Runtime 920.678 seconds.
- The sole failure pinned the old `disabled` announcement on operable locked-app
  explanation buttons. It was updated to assert the lock label/requirement hint
  and absence of misleading disabled state. Focused recheck: 73 tests passed,
  exit 0. No gameplay assertion or quality floor was removed.
- Additional focused verification: seven suites / 82 tests passed, exit 0.
- Full preflight passed, exit 0. Source types passed after final UI changes.
- UI ratchet: gradients 148 (was 152), raw font sizes 94, heavy weights 650
  (was 652). Ceilings tightened. Final lint ratchet: zero errors / 698 warnings, exit 0,
  with the ceiling tightened to 698.
- Native and production provider acceptance remains UNREACHED.

Final failed-suite rerun (`--onlyFailures`): one suite / 73 tests passed, exit 0.
