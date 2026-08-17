# UI/UX pass 2 (2026-08-16) — three owner-reported issues — COMPLETE

Branch: `claude/ui-improvements-polish-lhw1rg`. Orchestrated: Fable 5
orchestrator, Opus 5 implementation/audit/fix agents. Landed as per-workstream
commits (`b46ff7f` death screen, `1f56435` market, `dd3d7a8` Spark v45, plus
the audit-fix commit).

## Workstream A — Death screen scrolling — DONE
- [x] Whole card content scrolls: hero (tombstone/title/cause/identity card),
      tab bar, active page and its actions all live inside ONE ScrollView;
      the pinned hero + pinned footer structure is gone. Every action
      reachable on both tabs (Revive / Revival Pack / gems / mindset picker /
      Start New Life / Read Story / Share)
- [x] The definite-height flex-chain lesson in DeathPopupStyles.ts re-derived
      and kept true; audit confirmed the restructure is a pure re-parent
      (padding conserved, no absolute element moved inside scroll content)

## Workstream B — Life tab market — DONE
- [x] StatEffectChips (new shared component): per-stat pills with lucide
      icons in the HUD's stat colors (Heart red / Zap blue / Smile amber /
      Dumbbell purple). Applied to food, gym AND housing (rentals never
      showed their weekly grant; gym tiles mis-colored health green)
- [x] "Sliding under the bars" was TRANSPARENCY, not clipping: the tab bar's
      glass blur only exists on web, so 0.7 alpha read straight through on
      device → 0.96. Market category row now an opaque band
- [x] Four per-tab "?" badges consolidated to one info button (also fixes
      "Housing"/"Items" label truncation); all help copy preserved verbatim

## Workstream C — Spark chat — DONE (STATE_VERSION 45)
- [x] Keyboard bug structurally removed: no TextInput remains, so no
      keyboard can rise; option panel pinned above the home indicator
- [x] Choice-driven conversation: break the ice / ask about their real
      interests / compliment / joke / flirt (25 rapport) / date at 45
      (coffee $25, dinner $120, reckless $300) / go steady at 75. Rapport
      0-100 with header band label; per-option weeksLived cooldowns; success
      odds from rapport + happiness/reputation/fitness + personality fit
      (27 personalities → 10 tones, full default coverage); injectable rng
- [x] §4.4: one updater commits charge + rapport + cooldown + messages +
      promotion, re-checked against prev; anti-bigamy stays a single pure
      authority (resolveMatchPromotion). sendSparkMessage/generateNpcReply
      deleted with their only caller (the composer)
- [x] v45 carve-out: rapport + conversationCooldowns optional on SparkMatch,
      stub migration, no backfill/mirror; docs synced (CLAUDE.md/DEV.md/
      WORKFLOW.md); carve-out round-trip suite extended (14→16)
- [x] New suite __tests__/dating/sparkConversation.test.ts (74 tests)

## Phase 2 — Audit — DONE (0 critical, 4 moderate all fixed, 7 nits triaged)
- [x] M1: header heart no longer bypasses the rapport economy — routes
      through the same go_steady gate/handler as the chip, shows the gate
      reason when locked. promoteMatchToRelationship now has no production
      caller (kept exported, documented)
- [x] M2: befriending an unpromoted match asks for confirmation (it closes
      the dating path); availability reason now honest per promotion kind
      ("You made this one a friend" / "You're already together")
- [x] M3: orphaned lib/dating/npcReplyPool.ts (+ its live CI gate) deleted;
      deletion comment records the successor (lib/spark/conversationContent)
- [x] M4: lib/spark AND lib/markets added to the eslint error block (both
      verified clean); CLAUDE.md §5 count corrected to 58-of-59
- [x] N3 (dead result field) removed; N7 (glass comment premise) corrected.
      N1/N2/N5/N6 recorded as accepted/deliberate; pre-existing lint:ratchet
      overage (933 base → 931 HEAD, this branch net -2) flagged, not ours

## Phase 3 — Verification — DONE
- [x] Both type-checks clean · lint clean on all touched files
- [x] Full Jest: 586 suites / 7,627 tests passing (1 skipped) — count down
      one suite from mid-pass because npcReplyPool.test.ts was deleted
- [x] check:routes clean · audit-save all clear (v45 canonical)
