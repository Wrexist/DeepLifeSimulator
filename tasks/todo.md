# UI polish pass (2026-08-16) — five owner-reported issues — COMPLETE

Branch: `claude/ui-improvements-polish-lhw1rg`. Each item below came with a
screenshot from a live build.

## 1. Life Goals panel — structured, denser, cleaner
- [x] Replaced the 160pt gradient card per perk with a ~58pt row — 21 perks went
      from a ~3,400pt column to ~1,300pt
- [x] One summary bar measuring the whole catalogue, replacing 21 per-card bars
      that each measured a BINARY (a perk unlocks from one achievement, so every
      bar read 0% or 100%) plus a "0 / 1 completed" counter saying it a third time
- [x] Unlocked / Locked sections. Unlocked rows lead with what the perk DOES,
      locked rows lead with the requirement — the actionable half in each case
- [x] Dropped the nested `ScrollView` (`flex: 1` inside SettingsModal's own
      ScrollView — no definite height to flex against, and it competed for the
      gesture). The parent already scrolls

## 2. First Week Guide renders under the top stats bar
- [x] Was an absolutely-positioned sibling at `Z_INDEX.TOOLTIP` INSIDE the Home
      screen, so the tab layout's HUD won — z-index cannot arbitrate across two
      parents, so raising the number would only have moved the problem. Now a
      `Modal`: its own window, unconditionally on top, dimmed backdrop,
      tap-outside to dismiss
- [x] Removed the 200pt spacer Home reserved for it — it no longer occupies feed space

## 3. Achievements summary card — game theme
- [x] Surface tokens lifted from its neighbour in the feed (`progressLinkCard`):
      same inset, radius, slate, hairline, and a circular icon bubble instead of
      the gold-outlined rounded square that was the only one of its shape on screen
- [x] Three surfaces now say three different things — ring = percentage,
      subtitle = count, chip = the claimable count (the only actionable fact).
      It used to print "7 / 158" in the subtitle and "7 of 158" in the ring, and
      truncate "151 in progress" — a number that is just total minus completed
- [x] Progress rows carry their percentage; an 8%-filled sliver read as empty

## 4. Toasts — no emoji, smaller, less text
- [x] `utils/notificationText.ts` — emoji stripped at the CHANNEL, not the call
      site. Almost no call site contains an emoji; they arrive by concatenation
      from modules away (`JobActions` builds `levelUpText` with a 🔓 in it).
      Applied in `ToastContext` (strip + clamp) and `UIUXContext` (strip only —
      the banner owns the multi-line weekly summary). Arrows deliberately
      survive: the contextual tips say "Life → Health"
- [x] Toast surface one step down throughout — `sm` type, `sm` padding, 16pt
      icon, `md` radius, stack step 72 → 56. `hitSlop` keeps the dismiss TAP
      target at its old size
- [x] Shortened the highest-traffic copy at source (street job / crime results,
      three taps a week every week)

## 5. Mail — fewer scams, more fun interactive mail
- [x] `SCAM_WINDOW_WEEKS = 6` — at most one scam ATTEMPT per six weeks, derived
      from the week number so there is no field to store, nothing to migrate and
      nothing `emptyMailBin` can reset. Lowering the probability alone would not
      have worked: an independent per-week roll clusters, and "two in three
      weeks" is what reads as constant
- [x] Ceiling 0.42 → 0.4 and every earned add-on roughly halved. Worst-behaved
      save: an attempt every ~15 weeks, was every ~2.4
- [x] `lib/events/inboxEvents.ts` — 7 letters authored as `EventTemplate`s so
      they inherit `resolveEvent` (affordability, karma, chaining) and route to
      mail via one entry each in `routing.ts`. This is the ratio fix: every
      decision the inbox could previously put up was a bill, a summons or fraud

## Verification — all green
- [x] `npm run type-check` and `type-check:tests` — both clean
- [x] `npm run lint:errors` — clean
- [x] Full Jest suite: 586 suites, 7,563 tests passing, 1 skipped
- [x] `npm run check:routes` — 17 routes, no conflicts
- [x] `node scripts/audit/audit-save.cjs` — all clear

### The content ratchet earned its keep
`__tests__/content/contentQualityRatchet.test.ts` failed on the first full run:
the pack added 18 happiness outcomes at once and every one was under
`BIG_STAKES_THRESHOLD`, dropping `bigStakesShare` to 0.0491 against a 0.05
floor. That was correct content criticism — a pack of letters whose best
outcome decays away inside a month is a pack of letters that do not matter.
Three top branches were raised (reunion, time capsule, television) rather than
the floor lowered; the corpus moved to 0.0548 and `CURRENT` was updated with the
reasoning in place.
