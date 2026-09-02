# UI hierarchy rules — Master Program 4 (asymmetry + editorial judgement)

Companion to `tasks/ui-overhaul-blueprint.md` (Program 1: noise) and
`tasks/phone-apps-audit.md` (Program 3: duplication). This program adds the
missing third thing: **judgement** — every major screen decides what matters
most RIGHT NOW and makes that visible; everything else defers. Tokens live in
`lib/config/hierarchy.ts`.

## 1. The core rule

Every major screen has **exactly one dominant element**. Before touching a
screen, answer: what is dominant, why, what player state makes it dominant,
what decision it supports, what becomes secondary, and what yielded space.
If those cannot be answered, do not invent asymmetry.

## 2. Weight scale (four tiers, `lib/config/hierarchy.ts`)

| Tier | Role | Type | Surface / position | Colour |
|---|---|---|---|---|
| **1 Dominant** | the one thing the situation is about | `tier1Title` 20/700 or `tier1Value` 28/600 tabular | full width, first in its band, `rhythm.major` below it; the primary action sits with it | the single accent (primary action) or a SEMANTIC colour when the state is urgent |
| **2 Primary supporting** | card titles, section headings, the current fact | `tier2` 15/600 | on a `Card`, `rhythm.group` between siblings | text colour; icon may carry an identity hue |
| **3 Secondary** | body copy, list rows, options | `tier3` 13/400 | plain rows with hairlines, no card of its own, `rhythm.tight` | `textSecondary` |
| **4 Metadata** | captions, fractions, kickers, timestamps | `tier4` 11/500, `kicker` 10/600 caps | `rhythm.micro` from what it labels | `textMuted` always |

Rules: one tier-1 per screen; tier-1 and chrome never compete (a screen title
is tier 2 — see `ScreenHeader`); weight 700 is reserved for tier 1 and the
one CTA; colour is never the only axis of a change.

## 3. Rhythm scale (`rhythm`, from `responsiveSpacing` — no new numbers)

| Step | Value | Separates |
|---|---|---|
| `micro` | `xs` (4) | a label from its value |
| `tight` | `sm` (8) | related rows inside one component |
| `group` | 12 | cards in one band (the `Card` margin) |
| `section` | `md` (16) | bands of different content |
| `major` | `lg` (24) | the dominant element from everything else |

The whitespace explains grouping: tight inside a thought, wide at a change of
hierarchy. The feed must not scroll like a metronome.

## 4. Asymmetry means at least two axes

scale · weight · position · density · rhythm · span · colour. One changed axis
reads as an accident. Examples used here: the Work hero grows AND gains the
one CTA; the HUD's critical vital changes colour AND weight; Home's lead goal
row grows AND its supporting rows drop an axis (no icon bubble, tier 3).

## 5. State-derived dominance (the decision logic, per screen)

| Screen | Lead | Chosen by |
|---|---|---|
| HUD | Next week (only saturated fill); a critical vital's number goes danger-red | always; `stats.<vital> <= CRITICAL_VITAL` |
| Home | prestige CTA → urgent tip → lead goal row | `isPrestigeAvailable` → `useContextualTip` (health/happiness < 25, energy < 15, money < 50) → `buildGoalRows()[0]` |
| Work | employed: current job + Promote (eligible) / Manage; unemployed: the job board | `canPromote` / `currentJob` |
| Health | sick: Treatment (issues + cures); healthy: vitals | active diseases or a critical vital |
| Market | Food leads when energy is critical, else Items | `stats.energy <= CRITICAL_VITAL` |
| Progress | Prestige full-width lead; Legacy Pass supports | `prestigeAvailable` / claimables in the sub-line |
| Luxury / Stocks / Crypto / Travel | land on what the player OWNS or is DOING when there is any | `owned.length`, holdings, a running rig, a trip in flight |

Not made state-driven, on purpose: MainMenu (already a clean ladder), the
launcher (order is a contract), Statistics (read-only, one hero).

## 6. Colour discipline

Accent colour = the primary action or a semantic state. Never decoration,
never identity on a container, never five things at once. No new gradients,
glass, glow or badges. The HUD is the reference: one green (Next week), the
rest neutral surfaces with identity colour on icons only.

## 7. Asymmetry costs space

Whenever something grows, name what yielded. This program's ledger:
IdentityCard's centred 80pt hero → a 48pt strip and its reference rows fold;
the employed job's duplicate list card is gone; Progress's half-width Legacy
Pass card becomes a row; the cures leave the activities list while they lead;
567 dead work styles are deleted.

## 8. Primitive decisions (Program 3 follow-ups)

- **Flat Button**: not created. One primary per screen uses the existing
  `GradientButton`; quiet secondary actions are `Chip size="md"` or a text
  link. A second button system would add surface, not hierarchy.
- **Chip `disabled`**: not added. Spark's gated options are the only case and
  carry a cost line the primitive should not grow to hold.
- **AppHeader wordmark slot**: not added. A wordmark competes with the
  screen's dominant element; Spark/Pulse keep their own by design.
- **`ScreenHeader`** title moved from 22/800 to tier 2 — chrome must not be
  the largest type on a screen.

## 9. Tests

`five-second`: what is this screen about, what matters most, what can I do.
`squint`: does one thing dominate. `equal-weight`: is any equality meaningful.
`state-change`: does the lead move when the state does. `human-design`: did a
human decide, or were components distributed.

---

## Report — Master Program 4 (2026-09-02)

### 1–2. Repository state; the Program 2 gap

Branch `claude/ui-hierarchy-asymmetry-pass-fwqtue` off `main` at `b0d44a0`
(PR #183, Program 3). Program 1 (PR #182) and Program 3 confirmed present by
reading the primitives and screens they describe. Program 2 confirmed absent:
no commit on any branch, no file, only the two "never landed" notes.

### 3. Screens audited

Home, HUD, Work (5 states), Life shell, Market, Health (3 states), Progress,
MainMenu, Scenarios, Customize, Perks, and the landing view of all 19 phone
apps — four independent read-only passes plus a Playwright walkthrough of the
web export at 390pt (baseline, then after each round) and 360pt.

### 4–13. Screens changed, per §48

| Screen | Problem | Dominant element | Why | Player state | Axes | Yielded space | Removed / deprioritised | Behaviour |
|---|---|---|---|---|---|---|---|---|
| **HUD** | four saturated fills of equal weight; gems = cash; critical vitals invisible | **Next week** | the game's primary action | always; a vital ≤ 20 turns its number red+bold | colour + weight | date box and cash chip → neutral surface; gems chip → outline; seasonal disc → neutral | two saturated fills, one gradient disc | none |
| **Home** | permanent centred identity hero; 3 equal goal rows; lead never moved | **the lead slot**: prestige CTA → crisis tip → lead goal row | most consequential decision first | `isPrestigeAvailable` / `useContextualTip` / `buildGoalRows()[0]` | scale + position + density | IdentityCard 80pt hero → 48pt strip; 5-tile grid + 4–6 reference rows fold (closed by default); Card double gutter removed | the identity hero; equal goal rows; "This week" band now follows the lead | none |
| **Work** | no dominant element in any state; hero without action; held job rendered twice; chrome largest | employed: **the held job + its one action**; unemployed: **the first applicable job** | the decision the state calls for | `canPromote` / `currentJob` / requirement + hiring checks | scale + position + colour (one CTA) | the held job's list card; the screen subtitle; 3 restating headings; 567 dead style keys | Promote/Manage from the list; 'Quit instead' link (lives in the Manage sheet) | none — same `promoteCareer`, same sheet |
| **Health** | 14 identical cards; cures 5th/7th/8th when sick | sick: **Treat this first** (issues + the 3 cures); healthy: vitals | a disease is a countdown, not an activity | active disease or health ≤ 20 | position + scale + colour (danger rim) | the cures leave the list while promoted | — | none |
| **Market** | 3 equal sections; hungry player saw gym memberships first | energy critical: **Food**; else Items | the one state the screen can answer | energy ≤ 20 | position + one lead line | — | rental row title 18 → 16 | none |
| **Progress** | 50/50 hero, state-invariant | **Prestige** full width | the dynasty spine, the one irreversible act | `prestigeAvailable` colours the sub-line; claimables badge | span + scale | Legacy Pass half-card → a row | 4 dead styles (a 24pt title) | none |
| **Life shell / ScreenHeader / wizard** | chrome was the largest type on Work, Life, Progress and three wizard screens | the content and the CTA | chrome must sit a tier under content | — | scale | title 22/800 → 17/600; wizard header 24 → 18; wizard CTA raw 20 → scaled 18 | Life's segment-restating subtitle | none |
| **Luxury / Stocks / Crypto / Travel / Statistics** | landed on the same strip-over-rows regardless of what the player owned | what the player **owns or is doing** | Garage / Education already did this | owned items / holdings / a rig / a trip in flight; net worth first | position | — | — | landing tab only |
| **Spark** | LIKE/NOPE/SUPER stamps logged as dead | — | they were broken (`Animated > 0` is always false), not unused | drag | — | 3 `as any` casts | — | drag feedback now draws |

**Tests**: `stateDrivenHierarchy.render.test` (9 state-change assertions),
plus every suite touching these screens, and the full suite (see §19).

### 5–6. Dominant element and state logic per screen — see the table and `§5` above.

### 7–8. Scales — `lib/config/hierarchy.ts`; §2–3 above.

### 9–10. Removed / deprioritised — the table's two columns; the ledger in §7.

### 11–12. Primitives

Extended: `Card` (no self-margin; containers own gutters), `HealthIssuesCard`
(`lead`), `ProfileCard` (typed Animated drivers). Created: none — see §8.

### 13. Raw font sizes: 368 → 243. Dead `workScreenStyles` keys (122), the
wizard CTA. The remaining 243 were audited: TestRunner / DevTools / LogViewer /
JailScreen / PrestigeModal / SettingsModalStyles carry most; none competes
with a screen's dominant element. Left for the ratchet, not a sweep.

### 14. Dead code: 567 work style keys, 4 Progress styles, 3 Spark casts. The
Spark stamps were kept and FIXED rather than removed — they are the swipe
animation's feedback, and "dead" was a symptom of the `> 0` gate.

### 15. Phone apps still owed a hierarchy pass

Contacts (StatStrip over identical cards; 'at risk' is a tab label, not a
promotion), Bank (a debt tile tints red and nothing else moves), Dark Web
(two co-equal panels), Streaming (Go live is a text link in the hero footer),
Real Estate ('needs work' is a chip under the strip), Travel's destination
grid (ten interchangeable tiles when no trip is in flight). Each needs a
state-driven lead the way the five above got one.

### 16. Responsive: captured at 360 / 390 / 430pt. 360 surfaced two real
defects — the HUD's truncated primary action (fixed: the arrow yields) and a
clipped month in the date box (pre-existing, not fixed; see §21). 430: no
overflow. Every new tier-1 text carries `maxFontSizeMultiplier` and
`numberOfLines`.

### 17. Accessibility: every new pressable has a role and a label (net-worth
cell names both numbers; Legacy Pass row names tier and percent; Manage chip
says what the sheet holds); the Spark stamps are `pointerEvents="none"`;
reduced-motion paths untouched. Colour is never the only axis (critical vital
= colour + weight; issues lead = scale + rim; goal lead = scale + crest +
bar height).

### 18. Routes: `check:routes` OK — 17 routes, one door per room. No
navigation structure changed.

### 19. Tests: `npm test` — 722 suites passed, 9,182 tests passed, 2 skipped
(pre-existing), 0 failed. `type-check` and `type-check:tests` clean.
`npm run preflight` (routes, the 11-section check script, `lint:errors`,
`lint:ratchet`, `ui:ratchet`, content, live-ops) — passed.

### 20. Ratchets (lowered in the commits that earned them; none raised):
gradients 155 → 153 · raw font sizes 368 → 243 · heavy weights 755 → 693 ·
lint warnings 748 → 728 · lint errors 0 · test-tree type errors 0.

### 21. Remaining issues (honest)

- The Health screen paints health GREEN while the HUD paints it RED
  (`statIdentity`); pre-existing, outside this program's files, and the one
  colour-meaning contradiction a player still meets.
- The launcher's equal tiles are half empty at three unlocked apps.
- Work's board still carries three layers of chrome before the first card
  (title, segments, fold header + note).
- The 'This week' band is empty on a fresh save, so the gap under the lead
  is wider than `rhythm.major` there.
- 13 phone apps keep the strip-over-rows template (§15).
- The three Program 3 merges remain owner decisions; untouched.

### 22. Scores (0–100, honest)

| Category | Before | After | Basis |
|---|---|---|---|
| Hierarchy | 35 | 70 | one dominant element on Home, HUD, Work, Health, Market, Progress; 13 apps unchanged |
| Simplicity | 60 | 68 | 567 dead styles gone; chrome a tier down; Home reference rows folded |
| State-aware design | 20 | 65 | six screens + five apps choose their lead from state; tested |
| Editorial judgement | 30 | 65 | what yielded is named per screen; no permanent hero remains on Home |
| Visual rhythm | 40 | 60 | one scale, used on the changed screens; the empty band gap is still uneven |
| Distinctiveness | 45 | 55 | quieter, not yet distinctive; no new decoration by rule |
| Coherence | 75 | 78 | gutters unified; tiers shared; HUD colours now mean something |
| Mobile usability | 65 | 74 | 360pt primary-action truncation fixed; month clip remains |
| Accessibility | 70 | 76 | labels on every new pressable; two-axis rule |
| Human-design quality | 30 | 62 | the squint test now has an answer on the main screens |
| **Overall UI quality** | **45** | **67** | |

---

## Report — Master Program 5, consistency closure (2026-09-02)

### 1. Program 4's remaining issues, verified against the code
- Health green vs HUD red — REAL and wider than reported: the Health screen, HealthCard, the sickness modal (energy and happiness swapped) and Statistics ("Mood" in gold, fitness green) all disagreed with `statIdentity`; nine different "low" thresholds existed. Fixed at the root (§2).
- 13 apps on the template — PARTLY: a landing-by-landing audit of 15 apps found 7 that correctly keep their structure and 8 escape candidates; 7 escaped (§4–6).
- Work's three chrome layers — REAL; reduced (§7).
- The three merges — unchanged in `appCatalog.ts`; still owner decisions.

### 2. Health semantic consistency
`vitalState()` in `lib/config/hierarchy.ts` is the one ladder: critical ≤ 20 (danger), low ≤ 40 (warning), fair, good — only a PROBLEM takes a colour, so a screen of fine numbers stays as quiet as the HUD. Identity comes from `STAT_IDENTITY` everywhere a vital is drawn (Health rings and summary, HealthCard chips, SicknessModal, Statistics, GymCard now fitness purple). The rule that disambiguates the shared hues (danger red IS health's red): identity paints the icon and ring, state paints only the number. Tips fire on the critical band, the same line at which the HUD turns red and Home calls it a crisis. The HUD's dead grader is deleted. `theme.palette.money` (wrong value, no readers) is gone. Pinned by `__tests__/render/vitalState.test.ts`.

### 3. State contradictions found and fixed
| Contradiction | Fix |
|---|---|
| health `#34D399` on Health / HealthCard vs `#EF4444` HUD | STAT_IDENTITY |
| energy amber, happiness green in SicknessModal | STAT_IDENTITY |
| "Mood" in gold, fitness in money-green (Statistics) | "Happiness", identity colours |
| 25 / 30 / 40 / 50 / 15 "low" thresholds | one ladder |
| danger red as a primary button (Health 'vitality', "Free" price in red) | action accent is the info blue; Free is a gain |
| `LoadingButton secondary` == `danger` (Sell wore destructive red) | secondary is the flat tonal |
| green = selected (active diet) vs green = success | active is tonal + check |
| six locked treatments; "- Locked" + lock icon + reason on one card | grey lock + reason line; one disabled opacity |
| Buy / Purchase / Acquire; Close / Done | Buy; Done for sheet dismissal |
Not changed, on purpose: crime stays red (illegal = risk is a real semantic); the Sparkles / Star / Crown icon overloads (a sweep, not a closure item); "Got it" on the coach (a teaching voice).

### 4–6. The template audit
KEEP (7): DeepMail (rows are the content, chips carry state), Pulse (scandal banner already pre-empts the feed), YouVideo (the composer is the model), Political (timeline + costed CTA), Spark (deck), Education (tab already state-chosen), Hustle (a real tier-1 hero). ESCAPED (7): Streaming (current activity + history), Real Estate (lead state + action), Bank ("Due now" slot by severity), Contacts (worst at-risk triage card leads), Dark Web (threat monitor leads at burning heat), Pets (critical banner under the stage, sick pet selected), Garage (costed Refuel / Repair replaces the details bar when urgent). Deferred: Bank Pro (Program 3 proposes deleting it).

### 7. Work chrome
Title → segments → fold header → card. The three generic instruction sentences are gone; the board note ("4 openings · new in 8 wks") and the crime tab's cap line ride in their fold summaries. Chrome budget recorded: Home 0 layers before content (the coach or the identity strip IS content), Work 2 (title, segments), Life 2 (title, segments), Market 1 (fold header), Health 1 (fold header).

### 8. Button hierarchy
No new component. `LoadingButton` `secondary` became the flat tonal secondary; `GradientButton` gained `emphasis="secondary"`; `Chip` md is the 44pt quiet action. Rule applied: one saturated button per viewport - the first job the player can take on each Work board (none when the hero holds Promote), the first cure when treatment leads on Health, the recommended item (or the first meal when food leads) on Market, "Go live" on Streaming.

### 9. Typography: 243 → 94 raw sizes. Modal/screen titles → `tier1Title`; the two hero numbers → `tier1Value`; card and section titles → `tier2`; bodies in those files → `fontScale()` with scaled line boxes. Kept raw with reasons: splash wordmark, the two last-resort crash screens, the tab-bar label (scaling deliberately off), the animated toast, dev tooling.

### 10. Dead code: `CareerPathCard` (602 L), `ui/InfoButton`, `onboarding/GlassActionButton`, `AnimatedMoneyNative`, 148 dead style keys (four wrongly pruned keys restored - see lessons).

### 11. Edge-state hierarchy (`stateDrivenHierarchy.render.test`, 16 cases): sick + starving + broke + promotion → one tip (health first) above one goal ladder; disease + critical energy → one treatment lead with energy as a row; starving + recommended item → one saturated Buy; quiet state → no tip, no treatment, no red, goals lead, identity and net worth visible; health 0 → the countdown leads; negative cash → one lead.

### 12–14. Responsive 390 / 360 captures of Home, Work, Health, Market, Stats: no clipping, no truncation. Every new pressable carries a role and label; tier-1 text carries `maxFontSizeMultiplier`; reduced motion untouched. Routes: 17, one door per room.

### 15. Tests: `npm test` — 723 suites passed, 9,191 tests passed, 2 skipped (pre-existing), 0 failed. `type-check` and `type-check:tests` exit 0. `npm run preflight` — passed (exit 0).

### 16. Ratchets, lowered to what was earned: gradients 153 → 152 · raw font sizes 243 → 94 · heavy weights 693 → 652 · lint warnings 748 → 722 (ceiling 728, lowered next) · lint errors 0 · test-tree type errors 0.

### 17. Remaining issues (honest)
- Icon overloads (Sparkles / Star / Crown / Check) still carry several meanings; a sweep for another program.
- Bank Pro keeps the statement-first landing pending the owner's merge decision.
- Six apps keep the strip-first shape by choice; Contacts' "Avg bond" and Bank's three totals are inventory, not decisions.
- The 94 raw sizes left are the documented keep list plus dev tooling.
- The coach card and a crisis tip can both show in a first session with a crisis (rare: health falls below 20 before the first pay).

### 18. Scores (0–100)
| Category | P4 | P5 | Basis |
|---|---|---|---|
| Semantic consistency | 50 | 82 | one identity source, one state ladder, red = danger |
| Hierarchy | 70 | 76 | seven more landings choose from state; one primary per screen |
| Simplicity | 68 | 72 | Work chrome, dead code, tonal lists |
| Template repetition | 45 | 68 | 7 escapes with reasons; 7 keeps with reasons |
| Visual rhythm | 60 | 64 | tier tokens on the modal surfaces |
| Action clarity | 55 | 78 | one saturated button per viewport; Sell no longer red |
| Responsiveness | 74 | 76 | verified at 360/390 |
| Accessibility | 76 | 79 | vital numbers announce their band; labels on new pressables |
| Human-design quality | 62 | 70 | every kept template has a written reason |
| UI polish | 60 | 72 | contradictions closed; locked / disabled / copy unified |
| **Overall** | **67** | **74** | |

## Report — Master Program 6, the first 30 minutes (2026-09-02)

Branch `claude/ui-hierarchy-asymmetry-pass-fwqtue`, two commits on top of
Program 5. Plan, minute map and proposals: `tasks/todo.md` (Program 6).

### 1. Minute-by-minute map (measured, not imagined)

Method: a Quick Start in the web export of HEAD, driven by Playwright as a
text-skipping player (Play → coach → Apply → Next week ×20), plus four
read-only audits verified against the code. Each row is what was on screen.

| min | week | on screen before | on screen after |
|---|---|---|---|
| 0–1 | 0 | Play → HUD 100/100/100, $1,500, coach "You need work / Find a job" | same |
| 1–4 | 0 | Work board, 4 jobs at $110, Apply → hired → coach "Hired. Now live a week / Got it" (Got it retired the coach for good) | Got it folds the card; the coach returns with the wage |
| 4–5 | 1 | Daily Reward modal ("+1 gem", "$25 money bonus" for a 25-gem grant), "+25 Gems" floater, "🌟 Perfect Week!" toast, recap "+$142 · Career +16%", vitals 95/91 with no cause | coach "You earned $142 / That's the loop… Life → Health tops them up for free"; recap "+$142 · Promotion 13% · Each week −7 happiness · −6 health · No home · Natural decay · Line Cook shifts · free fixes in Health"; "1 decision waiting" (the starter envelope); no modal, no toast |
| 5–8 | 2–4 | identical taps; happiness −10/wk unexplained; "Career +48%" | drift line grows with the grace ramp (−7 → −13); "Promotion 39%" |
| 8–10 | 5 | Apps: Spark/Stocks/Education/Pets already open (tier 2 by a peak that counted the bike and phone); lead goal "Have 80+ fitness · 0/4 objectives" at fitness 10 | padlocks hold until cash reaches $2,000; the challenge row is hidden below tier 2; the routed goal ("Build a cash buffer", later "Get your health back up") is always second |
| 10–12 | 6 | Chapter 1 +$800 +35 gems, banner "Progression and Contacts… now available" (open since week 0) | banner names the money and gems only |
| 12–16 | 7–8 | happiness 39 → 17; tip "Feeling down? Do activities you enjoy or socialize!" (no route); disease; "Saved" pill over the net-worth figure | tip "Happiness is low. Meditation and a walk in Life → Health are free." routes to Health; "Saved" lives beside the Gen badge |
| 16–30 | 9–13 | happiness 0 → health 0 → "You Died. MEDIOCRE." | unchanged for a player who ignores every surface (balance, §12); a player who follows the recap line ends week 20 at 68/87/$2,561 |

### 2. Confusion points found → fixed / left

Fixed: the reward popup's two false numbers; "Career +48%" read as a weekly
gain; "Hold $5,000 in cash · 0/3 done" under a 30% bar; a chapter banner
announcing apps the player already used; a "Perfect Week" for a week not
played; a homeless banner pointing at an app the player cannot reach; tips
with no destination; the coach deleting its own payoff; the daily reward
landing on the wage's tick; padlocks that opened on tick one.

Left (owner content): Chapter 2 ships two pre-ticked goals (phone, "Make a
Friend" via the seeded parents); the Ambition picker asks a week-1 player for
a lifelong commitment; every weekly challenge is mid-game content (hidden from
the goal feed below tier 2, the card itself untouched); "Earn $500 · 0/3
goals" still reads as a fraction of the goal rather than of the chapter.

### 3. Pacing problems

The first tick carried four surfaces (modal, floater, toast, recap) — now one
card and one recap. Weeks 2–5 are still advance-and-watch: the only inputs
are street jobs and the free activities; the starter envelope (week 1), the
first-paycheck bonus (weeks 2–5) and the windfall (weeks 5–8) sit in the
inbox pill and were never opened by the scripted player. Promotion needs a
manual tap on Work at ~week 8; the tip and the recap both say so now.

### 4. First meaningful decision, first success, first setback

Decision: which entry job (minute 2–4; ceiling / climb / toll differ, pay
does not) — and now the starter envelope on tick one (save $300 vs invest in
yourself). Success: the first wage at minute 4, with the loop named. Setback:
the vitals slide, now named on the tick it starts, with its causes and the
free fix one tap away; then a disease at ~week 8, for which the Health
screen's treatment lead (Program 4) already works — the careful script cured a
depression at week 8 for $2,000.

### 5. Consequence and discovery improvements

`lib/economy/vitalDrift.ts` is the one projection of next week's vital
changes; the recap line is its only surface, and a parity test pins it to the
tick's formula. Discovery: the routed catalogue row is pinned second in the
goal feed; the Apps padlocks now hold until the stated condition; a hire that
resolves on a later tick pushes a "Hired:" banner with the wage.

### 6. First personal goal and return hook

The first goal the player can hold is "Build a cash buffer $2k / $5k" (a
routed row from minute 4) with the chapter's "Earn $500" above it; the first
one they choose is the starter envelope. Return hook: the recap's cliffhanger
teaser and the drift line together give a reason to tap once more and a
reason to open Health; the daily reward now arrives on tap two.

### 7. Tests (all from a fresh life)

`__tests__/firstSession/firstSessionSignals.test.ts` (starter event on tick
one, hire banner, chapter banner honesty, Perfect Week gating, coach
contract), `firstThirtyMinutes.render.test.tsx` (coach fold → payoff with the
second loop, daily reward on tick two not one, reward popup copy, recap drift
line + route, Promotion label, quiet state, tip routes, week-8 collision:
three problems → one lead + one routed goal), `firstTickProgression.test.ts`
(the real provider loop on the real onboarding seed: peak = HUD net worth,
tier 1 after tick one), `lib/economy/__tests__/vitalDrift.test.ts` (parity
with `computeDecayInputs`, causes worst-first, malformed state). Updated:
goalsCardRows, featureUnlocks, lifeRelativeGates, stateDrivenHierarchy,
subsystemEquivalence (snapshot gains `hiredNotification` only).

### 8. Verification

type-check, type-check:tests, lint:ratchet 0 errors / 722 warnings (ceiling
722), ui ratchets 152 / 94 / 652 (at ceiling), check:routes 17, full Jest
suite and preflight — recorded in the commit messages and the closing
summary. Two scripted players on the new export: the text-skipper (unchanged
outcome, §12) and the careful player (alive at week 20).

### 9. Remaining problems (proposals in tasks/todo.md §Phase 12)

1. Balance: a passive new life dies at week 13 (poverty-doubled decay + the
   homeless penalty every scenario starts with + the job toll = −13
   happiness a week). Three options with numbers.
2. Reachability: the $45/wk Shared Room exists but the only rent UI is a
   computer-only, tier-2 app.
3. Chapter 2's pre-ticked goals; the week-1 Ambition picker; weekly
   challenges as mid-game content.
4. The floating event pill covers whatever scrolls under it (a goal fraction,
   an activity's stat row) — the same trade every floating pill makes.

### 10. Scores (0–100, honest)

| dimension | before | after |
|---|---|---|
| first-session clarity | 45 | 72 |
| agency | 40 | 52 |
| decision quality | 45 | 55 |
| consequence clarity | 25 | 70 |
| game feel | 50 | 58 |
| pacing | 40 | 62 |
| discovery | 35 | 64 |
| personal investment | 35 | 48 |
| early goal formation | 40 | 60 |
| return motivation | 40 | 55 |
| accessibility | 60 | 66 |
| overall | 41 | 60 |

Agency and investment move least: the weeks between the first wage and the
first promotion still offer nothing to decide, and that is content and
balance, not hierarchy.
