# Home freeze + four-lens audit — 25 September 2026

Branch `claude/great-davinci-cr2nh8`. Trigger: a player report that "the home
tab got frozen/stuck", plus a request for a broad improvement pass.

Four read-only audits were run in parallel (Home freeze hunt, gameplay depth,
stability/performance, UX), plus the static `npm run audit:weekly` (clean in
all five domains). Every finding below was re-read in source before acting;
three audit claims did not survive that and are listed at the end.

## 1. The Home freeze

**No render loop exists.** A scratch probe mounted Home in the real provider
tree with fresh, late-game and prestiged saves and pushed 20 state updates
through each: two commits per update, no runaway, mount under 100 ms. The
freeze agent reached the same conclusion by reading every card, the store and
the interruption queue.

**The mechanism that matches the report is a Modal handoff.** Home's reward
popups (welcome back 55, daily reward 50, community 42) are mounted only while
they hold the interruption slot. On the first launch of any new day, welcome
back closes and the daily reward it was queued ahead of takes the slot in the
next commit. iOS was still dismissing the first Modal. A presentation started
during another's dismissal is refused or stranded, and the stranded case is a
transparent full-screen layer that swallows every touch: Home visible, nothing
responding. `components/ui/AlertHost.tsx` already documents that exact
mechanism for the Revival Pack report.

Fixed in `contexts/InterruptionContext.tsx`:

- A slot that changes hands passes through `null` for `HANDOFF_SETTLE_MS`
  (450 ms) before the next surface is granted.
- A holder is no longer preempted while it still wants the slot. The ad orb's
  floating pill opts in to `preemptible` because it is not a Modal.
- `AdRewardOrb` keeps the slot while its reward sheet (a Modal) is open. It
  used to release it, which let Home popups present over the sheet.
- The daily reward and welcome back popups close on a timer fallback as well
  as the animation callback. Their latch swallowed every later tap and the back
  gesture, so a dropped native-driver callback left no exit.
- The event pill hides for a life moment only while the moment SHOWS. A
  budget-deferred moment hid the pill with nothing on screen, which reads as
  "stuck".

Unverified on device: this is the best-supported mechanism, not a reproduced
one. Worth asking the reporter which platform they were on, whether a popup was
up just before, and whether the tab bar still responded.

## 2. Fixed in this pass

| Area | Fix | Commit |
|---|---|---|
| Home | Daily-reward gate fields were missing from Home's selector, so two of the three guards were off at render and a refused claim still fired `daily_reward_claimed` | 323cbd0 |
| HUD | Each vital's quick actions now raise that vital (Health offered Rest, Energy offered Eat); Rest at full energy refused | 413cf43 |
| Balance | Quick-action and Health-tab happiness gains go through `scaledHappinessGain`; both were raw while the audit declaration and a comment said otherwise | 413cf43 |
| Freeze | Handoff settle gap, no preemption of a presented Modal, orb sheet holds the slot, close fallbacks, event pill | 1beba70 |
| Economy | Rolled outcomes no longer previewed: `investment_tip` showed which branch won, so it was risk-free profit up to $50k every 26 weeks. `EventChoice.outcomeHidden` on 8 rolled choices | 062d506 |
| Events | Karma on 11 career/travel choices sat outside `effects` and was never applied; moved in, plus a source-scan guard | 062d506 |
| Events | Tenure counted `startedWeeksLived: 0` as "no start", so the whole workplace pack never fired for a first job taken at age 18 | 062d506 |
| Events | "Friend" events used every relationship (Mom lent $50, a newborn invited you to the gym); `friendly_stranger` and `loneliness` could never fire in a first life | 062d506 |
| Events | Random wedding event no longer fires for an engaged couple or one with a wedding booked (it married them on the spot and discarded the plan and deposit) | 062d506 |
| UX | Market "Purchased!" no longer shown on top of "Purchase Failed"; recap's decision count matches the inbox pill; coach copy names the Next week button | 8954bea |
| UX | First-session coach anchors on `lifeStartWeek`, so a second life at an older age still gets it | 8954bea |
| UX | Save slots show weeks played in this life, not the absolute counter ("Weeks 364" on an unplayed life) | d855daf |
| Perf | Root `StatusBarWrapper` (PERF-A1) and `SmartNotificationTicker` no longer subscribe to the whole state | 6ec9760 |
| Stability | Tick and health-check repairs ran `repairGameState` on the committed object, so React was never told and the UI kept showing corrupt values | de8cf4d |

## 3. Recommended next (not done here — each needs a decision or a device)

Ranked by player impact.

1. **Android save budget.** No `AsyncStorage_db_size_in_MB` is set, so Android
   keeps the 6 MB default. One late-game slot holds A/B buffers, up to 5 full
   backups (with checkpoints), the checkpoint sidecar and the transient queue
   copy: roughly 3 MB, so two slots can hit SQLITE_FULL while the device has
   space. Needs a config plugin, which means a native build.
2. **The save queue serializes the full state twice per save.**
   `utils/saveQueue.ts` `persistQueue()` stringifies the unpruned payload,
   checkpoints included, synchronously before `performSave` yields, on every
   Next Week. It is a frame hitch on every save. Persist the queue only on
   background/retry, or strip checkpoints first. Save-pipeline change, so it
   needs its own careful pass.
3. **Live streaming writes state every second and saves every 10 s**
   (`GamingStreamingApp.tsx`). Accumulate in a ref and commit every ~5 s, and
   save on Stop.
4. **Always-mounted whole-state subscribers.** `SicknessModal`,
   `CureSuccessModal`, `GoalsCard`, `ElderCard`, the Apps launcher stack
   (`AppLauncher` memoizes on the whole state) and `useAchievements` (159 specs
   per mutation on the Progress screen). Same treatment as the ticker.
5. **Parents never die.** There is no parent-mortality code, so there is no
   grief or inheritance beat, which is BitLife's biggest emotional moment. Needs
   an optional `deceasedAtWeek` and a carve-out bump.
6. **Children cost nothing after birth**, while the `childcare_subsidy` policy
   subsidises a cost that does not exist. Add a weekly per-minor cost by age
   band through `chargeOrDefer`.
7. **Crime events have no legal consequence.** `police_raid` and `court_trial`
   cost energy or a fee and never jail. Add `jailWeeks` / `wantedLevel` effect
   fields and seeded verdicts.
8. **Mail for phoneless players.** Letters route to DeepMail regardless of
   device ownership; DeepMail is phone-only.
9. **Touch targets and Dynamic Type.** Gem "+" is 16pt inside a button, the
   disease badge is 15pt, and tab labels are raw `fontSize: 10` with scaling off.
10. **Exam rolls use `makeWeeklyRoll` without the life salt**, but GPA feeds
    scholarships and hiring. Declared NOT_LIFE_AFFECTING in the audit guard;
    that declaration looks wrong.

Pre-existing gate failure, not from this branch: `npm run lint:ratchet` reports
7 errors, all `import/no-unresolved` for `three` / `sharp` in
`art/game-assets-v1/source/*.mjs` (added in e71077e). Preflight fails on it.

## 4. Audit claims that did not survive re-reading

- "The wedding event charges $2,000 for a wedding that never happens." It
  does happen: `resolveEvent` special-cases `wedding`/`marry` into
  `buildSpouseRecord`. The real defect was narrower: it fired for couples
  already engaged or booked.
- "Only children age; Mom stays 45 forever." `lib/social/npcDepth.ts` ages
  every non-child NPC once a year.
- "Seven more event files put karma outside effects." They are inside
  multi-line `effects` objects; only careerEvents and travelEvents were wrong.
  The new guard test checks the enclosing object, not the line.
