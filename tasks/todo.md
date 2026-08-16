# UI/UX pass 2 (2026-08-16) — three owner-reported issues, orchestrated

Branch: `claude/ui-improvements-polish-lhw1rg` (continues the previous polish
pass). Orchestrator: Fable 5. Implementation + audit: Opus 5 agents, one per
workstream — the three touch disjoint files, so they run in parallel and land
as separate commits.

## Workstream A — Death screen scrolling (`components/DeathPopup.tsx` + Styles)
Owner report: Summary tab cannot scroll at all — the purple Start New Life
button is unreachable; Legacy tab's scroll region is a small strip. Root cause
(recon): the hero block (tombstone art → "You Died" → cause → character card →
Summary/Legacy segmented control) is pinned ABOVE the per-tab ScrollViews, so
only the leftover ~40% of the card scrolls.
- [ ] Restructure so the ENTIRE card content scrolls: hero + tab content in one
      scroll surface per tab (or one ScrollView with a sticky segmented control)
- [ ] Both tabs: every action reachable (Start New Life, Read Story, Share,
      Revive, Revival Pack, Get More Gems)
- [ ] Keep the flex-chain lesson documented in DeathPopupStyles.ts (definite
      height on `content`) intact or consciously replace it
- [ ] Verify: type-check, lint, `__tests__/render` + any death/legacy suites

## Workstream B — Life tab structure + Market restore chips
Owner report: Life tab should be more structured/clean; food items' RESTORES
lines should be color-coded with icons per stat.
- [ ] `app/(tabs)/market.tsx` food cards: replace the plain blue "+3 Health /
      +2 Energy / +2 Happiness" text stack with compact icon chips —
      Heart/red, Zap/blue, Smile/amber, matching the HUD stat colors
- [ ] Same treatment for any other card in the market that lists stat restores
      (gym/items) so the pattern is consistent
- [ ] Fix the clipped "Buy Food" header sliding under the category tab bar
      (visible in the screenshot) and content scrolling under the bottom tab bar
- [ ] Tidy the two stacked tab rows (segmented control + category tabs with
      per-tab "?" buttons) into something calmer
- [ ] Verify: type-check, lint, render suite for life/market

## Workstream C — Spark chat: keyboard + choice-based conversations
Owner report: keyboard covers the composer (can't see what you typed, can't
send/close); wants OPTIONS instead of free text — compliment, ask on a date,
etc. — a fully functional, fun, interactive system.
- [ ] C1 Keyboard: `KeyboardAvoidingView` following the Pulse pattern
      (`components/mobile/Pulse/screens/PostDetailScreen.tsx`), thread scrolled
      to end on keyboard open — fixes the shipped bug regardless of C2
- [ ] C2 Conversation options replace the free-text composer:
      - `lib/spark/conversation.ts` (new): option catalog (icebreaker, ask
        about interests, compliment, joke, flirt, ask on a date, go steady),
        availability gated on per-match rapport + game state, success odds from
        charisma/personality fit, NPC responses per personality per outcome
      - Per-match `rapport` (0–100) + option cooldowns on `SparkMatch` —
        optional fields, absent = fresh match ⇒ STATE_VERSION 45 carve-out
        stub migration per §7 (comment in saveMigrations, CLAUDE.md/DEV.md/
        WORKFLOW.md version sync, types.ts docs)
      - Date flow: ask on a date → venue choice (coffee/dinner/adventure, cash
        + energy costs) → outcome lands as chat messages + rapport/happiness
        moves; charge inside the same updater that applies the effect (§4.4)
      - Going steady routes through the existing `promoteMatchToRelationship`
        (anti-bigamy guard intact); befriending through `promoteMatchToFriend`
      - Actions injectable-rng for tests; UI renders option chips above the
        (removed) composer, energy costs shown on the chips
- [ ] C3 Tests: new suite for conversation actions — §4.4 double-tap
      atomicity, energy/cash gating, rapport bounds, cooldowns, availability
      gates, migration round-trip for the new carve-out
- [ ] Verify: type-check both configs, lint, spark/save suites

## Phase 2 — Audit (Opus 5 agent)
- [ ] Review the combined diff against CLAUDE.md hard rules: §4.4 gate→grant,
      §4.2 week counters, Hard Rule #7 (no one-sided accent borders), §7 save
      format discipline, z-index constants, scaling — plus the usual
      over-grading check (re-read sources before believing findings)

## Phase 3 — Orchestrator verification & landing
- [ ] `npm run type-check` + `type-check:tests` + `lint:errors`
- [ ] Full Jest suite, `check:routes`, `node scripts/audit/audit-save.cjs`
- [ ] Three commits (one per workstream), push
