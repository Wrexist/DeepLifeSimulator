# Achievement UI - 6 October 2026

Owner approved the detailed achievement illustrations and requested matching UI/UX.

- [x] Rework achievement cards with larger art, flowing metadata and clear actions.
- [x] Match Home summary and sheet framing; preserve compact navigation and reward logic.
- [x] Check source types, lint, focused achievement tests and compact/tablet browser interactions.

Cards now give individual illustrations 96 scaled points, with readable titles,
separate rarity/tier/reward metadata, cream 48-point claim actions and restrained
teal borders on canonical navy. Home highlights reuse the same individual art.
The sheet is capped at 680 points on tablets. Filters and sorting have 44-point
minimum targets and exposed states; progress exposes its real numeric value.
Fixed an observed category error: `trip` inside `Triple Digits` matched Travel;
whole-word trip matching and cash classification now place it under Wealth.
Claim eligibility, rewards, persistence and game state schema are unchanged.

Validation:
- Source TypeScript and changed-file ESLint: exit 0, no diagnostics.
- 24 tests in two achievement suites passed, Jest exit 0 (see test-run.log).
  Includes duplicate-claim and prestige re-mint protection.
- Browser widths 320, 375 and 768: open, category filter, sort checked state,
  secret toggle, claim and close passed; zero page errors. Claim targets 48px.
- Inspected compact screenshots and tablet claimed state. Evidence uses isolated
  local browser saves and reduced motion; no player save was modified.
- An initial broad Jest invocation was interrupted (not a pass); corrected
  focused run completed. Initial browser run required restarting the local server.

[Phone preview](release/evidence/achievement-ui-2026-10-06/in-app-375.png)
[Interaction evidence](release/evidence/achievement-ui-2026-10-06/browser.json)

Remaining: native VoiceOver/Larger Text and device acceptance, plus 156 individual
illustrations tracked in achievement-art-redesign-2026-10-06.md. Next: extend the
approved artwork catalogue and carry these measured card rules to its consumers.
Nothing published, merged, or built for distribution.
