# Discord Bug Triage — 2026-09-04

Brief for a Claude Code session: fix the bugs currently sitting in the
`#bug-reports` forum and (secondarily) the historical `bug-reports` channel
it replaced. Compiled by reading every thread in both channels via the
Discord API (20 threads, all messages) and cross-referencing each report
against the live codebase (`git log`, `grep`, direct reads) rather than
transcribing the reports as-is.

## How to use this doc

Each bug below has: the verbatim player report, the specific files/functions
I traced it to, my working hypothesis for the root cause (with confidence),
and a suggested starting point. Where I found the *exact* line, treat that as
a strong lead, not a confirmed diagnosis — none of this was reproduced by
running the app, only read statically. Verify with a test or a manual repro
before shipping a fix. Where I could not narrow it past "which system," I've
said so rather than guessing.

**Reporter note:** all 8 current-channel reports are from the same person,
Discord user `a.a.a8644` (a highly detailed, trusted reporter — see the
resolved-thread history below; `isac1`, the dev, has thanked them repeatedly
and has a track record of shipping fixes fast off their reports). Treat
these as high-signal.

**Version-lag caveat:** the reporter's diagnostic block says `App version:
1.5.0 App Store / 2.5.8 website`. Those are two different, deliberately
divergent numbers (see `docs/RELEASE_RUNBOOK.md` — the App Store *version
record* and `package.json`'s `version` have been intentionally different
since 1.2.7; they are not sequential releases of each other). The
`package.json` figure, `2.5.8`, is the one that matters for code
archaeology: current `HEAD` is `2.11.0`, and `2.5.8` corresponds to commit
`9ded99f4` (2026-07-20). So the reporter's build is roughly six weeks/40+
commits behind `HEAD` at the time of the Aug 31 – Sep 4 reports. **I checked
each bug below against current `HEAD`, not just the reported version** —
where the underlying code hasn't changed since 2.5.8, the bug is presumed
still live; I've flagged the one case (Spouse/wedding) where a fix already
exists on an unpushed branch.

---

## 0. Blocker to resolve first

`claude/fix-wedding-popup-stuck-state` (local commit `8826dab9`, "Fix soft
lock: death/wedding popups no longer gated on showStatsBar", 2026-08-28) is
**not on `origin`**. It fixes exactly the "wedding planned but never occurs,
forever engaged" symptom in bug #7 below (Spouse). It has not been
independently verified — the commit message flags that `npm install` never
completed in the environment it was built in, so type-check/tests never ran,
and `app/_layout.tsx` is a CLAUDE.md-protected file whose own checklist
requires a TestFlight pass before merging. **First step: pull that branch,
run `npm run preflight:quick` + a device/simulator pass, then merge it** —
don't re-derive the fix from scratch.

---

## 1. Crypto Mines — mining produces nothing despite 600+ rigs

**Thread:** [Crypto Mines](https://discord.com/channels/{GUILD_ID}/1542863689521303662/1544375219555143690) · `a.a.a8644` · 2026-09-01

> Mining any currency does not increase holdings. I have over 600 rigs and
> they do nothing. This is incomplete feature.
>
> Mines that are offline (0% health) still charge as an expense.
>
> Thanks for including a sell option on rigs. (One at a time is not enough,
> needs a sell all option)

**Traced to:** `contexts/game/actions/weekly/applyMiningCryptos.ts:87` and
`lib/crypto/miningEarnings.ts:62`.

**Hypothesis (high confidence):** both functions gate the entire mining
payout on `warehouse.selectedCrypto` being set:

```ts
// applyMiningCryptos.ts:87
if (!input.prevWarehouse || !input.prevWarehouse.selectedCrypto) {
  return { updatedCryptos: input.prevCryptos };
}
```

If a player owns rigs but has never explicitly picked a crypto for the
warehouse to mine into (or the selection isn't persisting), the weekly tick
silently mints **zero**, every week, forever — no matter how many rigs are
owned. Nothing in the earnings path checks `minerDurability` at all
(`lib/crypto/miningEarnings.ts:117-166` sums `warehouse.miners[id]` counts
directly with no durability/health factor), so this isn't a health/damage
gate misfiring — it's the `selectedCrypto` precondition. Check: (a) is
"select a crypto" surfaced clearly in the warehouse UI, and (b) does the
selection actually persist across save/load and the weekly tick reading
`prevWarehouse` (stale-closure class of bug — see CLAUDE.md's documented
history of exactly this failure shape elsewhere in this codebase).

**"Offline mines still charge as an expense":** likely the auto-repair
deduction (`autoRepairCostInCrypto`, `applyMiningCryptos.ts:41-66`), which
*is* real, intended behavior (rigs under 50% durability get auto-repaired
for a crypto cost) — but if the player doesn't realize 0%-health rigs are
being auto-repaired (rather than just sitting idle), this reads as "I'm
being charged for nothing." Worth a UI/copy pass regardless of whether the
deduction itself is working correctly. Also worth checking: does a rig at
0% health still count as `owned` for the (currently-broken) earnings sum
above once `selectedCrypto` is fixed? If so it would earn as if at 100%
health, which is a second, separate bug once the first is fixed.

**Sell-all:** a real, cheap QoL request — `MiningActions.ts` has no
`sellAllMiners`/bulk-sell function; only per-rig actions exist.

---

## 2. Property — "Unable to sell property," game freezes

**Thread:** [Property](https://discord.com/channels/{GUILD_ID}/1542863689521303662/1544012397478547548) · `a.a.a8644` · 2026-08-31

> Unable to sell property. When clicking the button in manage property to
> sell, the game freezes. Button lights up but nothing happens.
> iOS 26.6 / App version: 1.5.0 App Store, 2.5.8 website

**Traced to:** `contexts/game/actions/RealEstateActions.ts:325`
(`sellOwnedProperty`) and its call site, `components/computer/RealEstateApp.tsx:1191`.

**Hypothesis (medium-high confidence):** `sellOwnedProperty` requires the
property to have `owned === true`:

```ts
const property = (prev.realEstate ?? []).find((p) => p.id === propertyId && p.owned);
if (!property) { log.warn(`Sell rejected: not owned`); return prev; }
```

But a property the player owns and is **renting out** to a tenant is
modeled elsewhere in this same codebase with `owned: false, status:
'rented'` (see the "renting vs owning" distinction in
`GameActionsContext.tsx`'s `moveInTogether`, which explicitly treats
`status === 'rented' && !property.owned` as "player rents this out"). If
that's the same `owned` flag `sellOwnedProperty` checks, **selling any
property the player has rented out to a tenant will silently no-op** —
exactly matching "button lights up but nothing happens" (the `onSell`
handler runs, `sellOwnedProperty` returns `prev` unchanged with only a
`log.warn`, no `gameAlert` surfaces to the player, `setManageTarget(null)`
still fires so the modal closes as if it worked). Reproduce with a property
that's currently tenanted/rented-out and see if the silent-fail path is what
fires; if so, either fix the `owned` semantics or have `sellOwnedProperty`
return a `{success, message}` the UI actually surfaces (it currently returns
`void`, unlike its siblings `maintainProperty`/`installPropertyDecor` which
do return `{success, message}` and get a `gameAlert` on failure).

---

## 3. Re-occurring pop-ups — same event notifications refire on every refresh

**Thread:** [Re-occurring pop ups.](https://discord.com/channels/{GUILD_ID}/1542863689521303662/1543993725443641414) · `a.a.a8644` · 2026-08-31 (5 screenshots attached)

> There are too many frequent pop ups of events that have already happened.
> They pop up every time the game is refreshed. In this manner are they
> re-occurring.

**Not traced to a specific line** — needs the attached screenshots
(`IMG_0024.png`–`IMG_0029.png`, on the Discord thread) to identify *which*
event type is refiring; "refreshed" strongly suggests it's tied to app
foreground/reload rather than the weekly tick itself (a genuinely new event
each week wouldn't read as "already happened"). Start at the
weekly-event/notification queue: `contexts/game/actions/weekly/applyWeeklyEvents.ts`,
`lib/events/routing.ts`, and whatever marks an event as "seen"/"resolved" —
look for a flag that's read but not persisted (or reset) on app relaunch,
which is the shape that produces "same popup on every refresh."

---

## 4. Activity Commitments — commitment level never rises, no stat bonus applies

**Thread:** [Activity Commitments](https://discord.com/channels/{GUILD_ID}/1542863689521303662/1543973485234098278) · `a.a.a8644` · 2026-08-31

> As weeks progress the commitment levels do not go up. Even after
> performing activities. As far as the Health goes there is no -20% energy
> consumption. It still base of 20 energy. Assuming this goes for the
> progress as well. This applies to the other two as well. They do not
> perform.

**Traced to:** `lib/commitments/commitmentSystem.ts` (the whole bonus/
penalty system) and `contexts/game/actions/PursuitActions.ts:148`.

**Hypothesis (high confidence) — this is a real, structural bug, not a
perception issue:**

- `getCommitmentBonuses` / `getCommitmentPenalties`
  (`lib/commitments/commitmentSystem.ts:27,66`) — the functions that turn a
  commitment into an actual energy-cost reduction / progress bonus — are
  imported **only by `components/ActivityCommitmentModal.tsx`**, the modal
  that *displays* the commitment UI. Grepped the whole repo: nothing in the
  energy-cost or progress-calculation code for career/hobbies/relationships/
  health activities calls either function. The bonuses/penalties are
  computed for display purposes only and never actually applied to
  gameplay. This is the "-20% energy consumption... still base of 20
  energy" symptom exactly.
- `commitmentLevels` (the 0-100 number that's supposed to rise with use) is
  only **written** in one place, `PursuitActions.ts:148-155`, and only
  **decayed** (never incremented) in
  `contexts/game/actions/weekly/applyAutoCheckpoint.ts:76`
  (`decayCommitmentLevels`). Whatever "Pursuit" actions are, they're
  evidently a narrow subset of the game's activities — everything else the
  player does (job work, hobbies outside Pursuits, health actions) doesn't
  touch `commitmentLevels` at all, so for most play patterns the level can
  only ever go *down* (from decay) and never up. That matches "as weeks
  progress the commitment levels do not go up. Even after performing
  activities" precisely.

**Suggested fix shape:** (1) wire `getCommitmentBonuses`/
`getCommitmentPenalties` into the actual energy-cost and progress
calculations for the four commitment areas (career/hobbies/relationships/
health) wherever those are computed per-activity; (2) find every action that
should count as "performing" a committed activity and have it call whatever
`PursuitActions.ts:148` calls to increment `commitmentLevels`, not just the
Pursuit-specific path.

---

## 5. App Initialization Error — crash scrolling near achievements/discovery

**Thread:** [App Initialization Error](https://discord.com/channels/{GUILD_ID}/1542863689521303662/1543961953041653800) · `a.a.a8644` · first reported 2026-08-31, **new detail added 2026-09-04** (today)

> Issue shown in screen recording. [ScreenRecording_08-31-2026_07-30-50_1.mov]
> App Initialization Error
>
> *(2026-09-04 update, 4 days later, on a new save slot):* I made a new save
> slot. It has something to do with achievements or discovery. Scrolling
> down to these it sends error. I'm assuming it's from after earning an
> achievement since discovery is unfinished — and using the achievement page
> on the Life > stats tab show what has been earned.

**Not traced to a specific line** — the only hard evidence is a screen
recording on the Discord thread (`ScreenRecording_08-31-2026_07-30-50_1.mov`,
not fetchable via the bot's text-only message API; pull it from the thread
directly in Discord). The reporter's own theory — a crash scrolling toward
an achievement tied to an unfinished "discovery" entry — points at
`app/(tabs)/life.tsx` (the Life > Stats tab they name) and whatever renders
the achievements list there, plus `components/depth/DiscoveryIndicator.tsx`
and `contexts/game/actions/ItemActions.ts` (discovery-adjacent). Look for an
unguarded field access on an achievement/discovery record — a `.map()` or
property read that assumes every achievement has a paired "discovery" entry,
which would throw on one that doesn't. **This is the most recent, least-
investigated report** (updated same-day as this audit) — worth following up
with the reporter for the actual error text/stack if the recording doesn't
show it clearly, since "App Initialization Error" as a generic phrase
suggests a caught error boundary is swallowing the real message.

---

## 6. Life Skills — "Unlock Skill" button broken, X button misplaced, freeze on exit

**Thread:** [Life Skills](https://discord.com/channels/{GUILD_ID}/1542863689521303662/1543959316606881953) · `a.a.a8644` · 2026-08-31

> The button in life skills "unlock skill" does not work. The UI for showing
> the X does not properly show up on the screen. When leaving the page the
> screen freezes and nothing works.
> iOS 26.6 / App version: 1.5.0 App Store, 2.5.8 website

**Traced to:** `components/SkillTreeModal.tsx` (1184 lines; `onClose`
wired at line 856, `handleUnlockNode`/`commitUnlock` at 521-580).

**Hypothesis (lower confidence — this looks like a recurrence of a known,
never-fully-solved class of bug, not a fresh logic error):** the unlock flow
itself reads correctly on a static pass — `handleUnlockNode` does
age/prerequisite checks, shows a native confirm alert, and `commitUnlock`
calls `purchaseLifeSkill` inside `setGameState`. Nothing obviously wrong.
**But** this exact complaint — a misplaced/clipped "X" close button on a
skill/life-goals-style modal, on specific devices — has come up **three
times before** in the archived threads below (`1.4`: "Entering the Life
Skills UI - the X is slightly hidden"; `1.3.5!`/`Same UI bug`: the iPhone
15/16 Pro Max-specific UI scaling issue `isac1` said Apple gave "0 answer"
on). If this is the same root cause recurring, it's a device-class-specific
layout/scaling bug, not something a static code read will find — reproduce
on the reporter's actual device profile (or a Pro Max simulator) rather than
guessing from the component source. If it's a *new*, distinct issue, the
"freeze on leaving the page" is the more actionable half: check whether
`onClose` (`SkillTreeModal.tsx:856`) or whatever `commitUnlock`'s
`setGameState` triggers downstream (achievement checks, re-render of the
whole skill tree) can throw or infinite-loop when unlocking the *last*
available node in a category.

---

## 7. Spouse — moving in skips marriage; propose/breakup say "Partner not found"; wedding gets stuck "forever engaged"

**Thread:** [Spouse](https://discord.com/channels/{GUILD_ID}/1542863689521303662/1543958652619063487) · `a.a.a8644` · 2026-08-31, two-part report

> **Part 1:** Moving in with Partner skips the marriage aspect of the game.
> Making them a spouse. The propose button is available but also says
> 'partner not found' once a ring option is chosen. Unable to breakup says
> 'partner not found'. The bugged spouse does not show up in family page.
>
> **Part 2 (after divorcing and retrying, choosing engagement instead of
> moving in):** Able to divorce and start over... choosing to get engaged
> instead of moving in together. This is also broken. The wedding is
> planned but never occurs.* Forever engaged. Can have kids.
> *After about a year can re-plan the wedding and it works as intended...
> The spouse stays on the family page and is not bugged [this time].

**Part 2 is almost certainly already fixed** — see §0 above. "Wedding
planned but never occurs, forever engaged, self-resolves after ~a year" is
exactly the soft-lock `8826dab9` fixes (WeddingPopup was gated behind
`showStatsBar`/route state; if the wedding resolved before the router
settled into `(tabs)`, the blocking flag was set with no popup on screen to
clear it — matches "forever engaged" until something incidentally
re-triggers the route check). **Merge that branch and ask the reporter to
re-test Part 2 specifically before doing any new work on it.**

**Part 1 is a distinct, NOT-yet-explained bug.** Traced the relevant
functions:

- `contexts/game/GameActionsContext.tsx:5214` (`moveInTogether`) — sets
  `livingTogether: true` on the relationship but does **not** touch its
  `type` field (stays `'partner'`). So the "moving in... making them a
  spouse" framing isn't literally true at the state level, at least not
  from this function alone — worth checking whether some *other* code path
  (a "common-law marriage after N weeks living together" mechanic, if one
  exists — I didn't find one) promotes `type` to `'spouse'` on its own.
- `contexts/game/actions/DatingActions.ts:429` (`proposeMarriage`) requires
  `r.type === 'partner'` to find the partner; if `type` really has changed
  to something else by the time the player clicks propose, this explains
  "Partner not found" on the nose. This needs live reproduction — set a
  breakpoint or log on `partner.type` right before the ring-selection
  callback fires, for a relationship that has `livingTogether: true`.
- `components/FamilyTab.tsx:246,557,584` — the family-page rendering has
  two *separately* computed identities for "the person the player is with":
  `partner` (`gameState.relationships.find(r => r.type === 'partner')`,
  line 246) and `spouse` (`gameState.family?.spouse` — a **denormalized
  copy**, not derived live from `relationships`, per the extensive comment
  in `contexts/game/actions/weekly/resolveFamilySpouse.ts`).
  `renderPartnerCard` (line 584) explicitly `return`s `null` **whenever
  `spouse` is truthy**, even if `partner` also exists. If `family.spouse`
  is stale/wrongly-set from an earlier relationship (the divorce-and-retry
  in Part 2 is exactly the kind of sequence that could leave a stale copy
  behind, per that file's own doc comment about copies outliving a
  breakup), the *new* partner would render in **neither** card — matching
  "the bugged spouse does not show up in family page." Start by logging
  `gameState.family.spouse` alongside `gameState.relationships` right after
  a move-in, particularly on a save that has been through a prior
  divorce/breakup — `resolveFamilySpouse.ts`'s own doc comment describes
  this exact class of staleness as a *previously fixed* bug (2026-07-28
  audit, GL-5), so this may be a regression or an edge case that fix didn't
  cover (e.g., the "moved in but never married" case, since
  `resolveFamilySpouse` only ever clears `family.spouse` when a *previous*
  spouse's relationship disappears — it has no path that sets it from mere
  cohabitation, so if it's getting set that way, the write is happening
  somewhere I didn't find in this pass).

---

## Also seen, not yet actionable

- **Settings > Show Tutorial** (thread, 2026-09-02): "Tutorial is
  incomplete," but the reporter self-resolved it in a follow-up message
  ("The FAQ help button next to settings more than makes up for this.").
  Low priority — a content/copy gap, not a functional bug.
- **`#beta-bugs`** (the hidden text channel that shares the same report
  template): currently **empty** — no messages. Nothing to triage there.

---

## Historical channel (`bug-reports`, pre-emoji-rename, Dec 2025 – Aug 2026)

12 older archived threads live in the original `bug-reports` forum channel
(ID `1402960140629446806`) that the current `🐛・bug-reports` channel
replaced. I read all of them. Almost every one ends with `isac1` confirming
a fix shipped in the next version, and the reports track a long, consistent
pattern: this repo's changelog (`git log`) corroborates that dozens of the
named issues (family income multiplier, parent-gender-flip-on-aging,
credit-card UI, promotion softlock, IAP/revival flow, etc.) were genuinely
fixed in the versions the threads reference. I would **not** re-open or
re-investigate these without a fresh report — they're historical record, not
an open backlog. The one exception: the **`1.5 no`** thread (2026-08-11 –
2026-08-23) has several items `isac1` said were "already fixed in the new
update coming soon" as of **2026-08-23**, three days before `2.11.0` shipped
(2026-08-26) — worth a quick diff of that thread's list (dark web
vendor/rep pacing, crime-tool shop items, prestige-shop bonuses not
applying, achievement/contact resets on prestige, political "next election"
resetting) against what actually landed in `2.11.0`+, in case something on
that list slipped.

---

## Suggested working order

1. Merge `claude/fix-wedding-popup-stuck-state` (after the verification pass
   its own commit message asks for) — closes half of #7 for free.
2. **Crypto Mines** (#1) and **Activity Commitments** (#4) — both have a
   concrete, high-confidence root cause already identified above; these are
   the fastest real fixes.
3. **Property sell** (#2) — likely a one-line `owned` semantics fix, but
   confirm the repro (rented-out property) first.
4. **Spouse Part 1** (#7) — needs live reproduction to find where/if `type`
   or `family.spouse` gets wrongly set; the leads above narrow where to
   look.
5. **Re-occurring pop-ups** (#3) and **App Initialization Error** (#5) —
   need the Discord screenshots/recording pulled and read before further
   static tracing is useful.
6. **Life Skills** (#6) — reproduce on a Pro Max-class device before
   assuming it's a fresh bug rather than the recurring scaling issue.

---

*Compiled 2026-09-04 by reading `#bug-reports` (both the current and
pre-rename channels) and `#beta-bugs` in full via the Discord API, and
cross-referencing each report against `git log`/source in
`Wrexist/DeepLifeSimulator` at `HEAD` (`e6b23e01`). Discord message links
above use the guild's numeric ID as a placeholder (`{GUILD_ID}`) since it's
a credential-adjacent value — substitute your server ID, or just open the
thread by name in Discord.*
