# Active plan — Political Life expansion (player request, 2026-08-21)

Source: support email from a player who asked for "a focus on being a president …
campaign retirement and other positions you can have that pay, you can choose to
steal stake money, join political parties or other things that concern with
government."

What already exists in `lib/politics/`: the six-rung office ladder, elections and
re-election, scandals, PAC clean/dirty fundraising, lobbyists, policies,
alliances, government contracts, office perks. What the request names and the
game does NOT have is below.

**Not doing: monthly ticks.** The player asked for months instead of weeks. That
is story mode (v38), which shipped to TestFlight and was REMOVED after
playtesting. Rebuilding it is a reversal of a playtested decision, not a feature
request to fill — flagged to the owner instead.

## Plan

- [x] 1. Save format: five optional fields on `PoliticsState`, one carve-out
      migration, `STATE_VERSION` 46 → 47 (stub migration, no backfill, no
      `repairGameState` mirror — every default is `undefined` and every value
      would be a guess that hands out or takes away something real).
- [x] 2. `lib/politics/parties.ts` — party standing that means something.
      `partySupport` 0-100, endorsement threshold, a real cost to switching
      sides, and party-machine campaign funding the player has not paid for.
- [x] 3. `lib/politics/appointments.ts` — paid positions that are not the
      ladder: Party Chair, Ambassador, Cabinet Secretary, Federal Judge,
      Lobbyist, Corporate Board Seat. Eligibility, weekly pay, reputation and
      party-support consequences. One at a time.
- [x] 4. `lib/politics/embezzlement.ts` — divert campaign / PAC money into
      personal cash. Bounded per week, builds heat, heat feeds the EXISTING
      scandal roll so getting caught uses the machinery already there.
- [x] 5. `lib/politics/retirement.ts` — stand down voluntarily with a pension
      scaled by highest office × terms × approval, keeping the title.
- [x] 6. Wire the weekly tick: heat decay, party-support drift, embezzlement as
      a scandal driver.
- [x] 7. Wire income: appointment salary and pension through the ONE political
      income path (`getPoliticalWeeklySalary`), so the $50K/wk political
      per-source cap still binds and nothing mints money outside it.
- [x] 8. Actions in `PoliticalActions.ts`, all charge/credit in ONE updater (§4.4).
- [x] 9. A "Career" tab in `PoliticalApp` for party, appointments, embezzlement
      and retirement.
- [x] 10. Tests per module + a save round-trip test for the new fields.
- [x] 11. `npm test`, `type-check`, `type-check:tests`, `lint:errors`.

## Done

All eleven steps landed. Added after the plan was written, at the owner's request:

- [x] 12. Fix the annual-vs-weekly `/wk` mislabel across every career surface.
      `Career.levels[].salary` is WEEKLY on every ladder except `political`,
      which is ANNUAL — so a President was shown "$100,000/wk" and paid $1,923.
      One shared `displayWeeklySalary` converter, applied at six surfaces plus
      the promotion record at its SOURCE, with a source-level ratchet
      (`__tests__/careers/annualSalaryDisplay.test.ts`) so a new screen cannot
      reintroduce the raw read.

      Worth recording: an earlier survey reported that `PoliticalApp` "correctly
      divides by WEEKS_PER_YEAR". It does not — its variable was NAMED
      `salaryWeekly` and held the raw annual figure. CLAUDE.md §8 says not to
      trust a survey claim without re-reading the source; this is the second
      time that has paid.

- [x] 13. Harden to the C-9 / ARCH-1 contract. The first cut of the four new
      actions rejected from inside their `setGameState` updaters and then
      returned `{ success: true }` unconditionally — the shape
      `__tests__/refactor/updaterResultRatchet.test.ts` ratchets against, and it
      caught all four plus a `let applied` capture. Rewritten as preview/commit
      over five pure resolvers in `lib/politics/lifeOperations.ts`, which is the
      sound fix that file prescribes. The ratchet stayed at 101 — it was not
      raised.

## 2026-08-21 — follow-up pass (owner request)

- [x] Work tab lands on Career, not Street Hustle. Career is also the first
      segment now, and the one-shot effect that used to force the tab is gone
      (with Career as the default its only firing would land on the tab already
      shown, leaving a `setGameState` on every Work open for a broke player).
- [x] Three prestige bonuses verified dead and registered in
      `lib/prestige/inertBonuses.ts`, so the shop warns before taking 15,000
      points. The product call — wire, remove, or re-purpose — is the owner's
      and stays open.
- [x] Closed the blind spot that hid them: `prestigeBonusReaders` no longer
      counts a hollow reader (an empty guard body, or a predicate nothing
      calls) or a description surface as wiring.
- [x] Deleted the five uncalled helpers that made them look wired, and lowered
      the lint ceiling 842 → 797 in the same commit.
- [x] Fixed an id-collision bug found via a flaky suite: four call sites minted
      `${prefix}_${Date.now()}_${rand(0..999)}`. For pets a collision was
      silently destructive — the duplicate-id guard dropped a genuine second
      purchase, took no money, and still reported "Welcome Rex!".

### Still open for the owner

- Story mode / monthly ticks (the player's other ask) — v38, removed after
  playtesting. Not rebuilt.
- Income caps made visible but not retuned: $200K/wk company ceiling, and
  `ops_management` lifting the soft-cap floor only 25% → 45%.
- The three inert prestige bonuses: wire, remove, or re-purpose.
