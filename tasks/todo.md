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

- [ ] 1. Save format: five optional fields on `PoliticsState`, one carve-out
      migration, `STATE_VERSION` 46 → 47 (stub migration, no backfill, no
      `repairGameState` mirror — every default is `undefined` and every value
      would be a guess that hands out or takes away something real).
- [ ] 2. `lib/politics/parties.ts` — party standing that means something.
      `partySupport` 0-100, endorsement threshold, a real cost to switching
      sides, and party-machine campaign funding the player has not paid for.
- [ ] 3. `lib/politics/appointments.ts` — paid positions that are not the
      ladder: Party Chair, Ambassador, Cabinet Secretary, Federal Judge,
      Lobbyist, Corporate Board Seat. Eligibility, weekly pay, reputation and
      party-support consequences. One at a time.
- [ ] 4. `lib/politics/embezzlement.ts` — divert campaign / PAC money into
      personal cash. Bounded per week, builds heat, heat feeds the EXISTING
      scandal roll so getting caught uses the machinery already there.
- [ ] 5. `lib/politics/retirement.ts` — stand down voluntarily with a pension
      scaled by highest office × terms × approval, keeping the title.
- [ ] 6. Wire the weekly tick: heat decay, party-support drift, embezzlement as
      a scandal driver.
- [ ] 7. Wire income: appointment salary and pension through the ONE political
      income path (`getPoliticalWeeklySalary`), so the $50K/wk political
      per-source cap still binds and nothing mints money outside it.
- [ ] 8. Actions in `PoliticalActions.ts`, all charge/credit in ONE updater (§4.4).
- [ ] 9. A "Career" tab in `PoliticalApp` for party, appointments, embezzlement
      and retirement.
- [ ] 10. Tests per module + a save round-trip test for the new fields.
- [ ] 11. `npm test`, `type-check`, `type-check:tests`, `lint:errors`.
