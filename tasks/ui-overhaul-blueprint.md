# UI Overhaul Master Program 1 — Forensic Audit & Redesign Blueprint

Date: 2026-09-01 · Branch: `claude/deep-life-ui-overhaul-ft9qhb` · Phase: **audit only, no visual changes yet**

Trigger: tester feedback — *"The GUI is too complex and it has to be simple and it
looked like you used AI to code it."* This document treats that as a correct
diagnosis and locates the evidence. Every claim below is cited to a file/line
that was read during the audit.

---

## 1. Current UI diagnosis

The game-logic layer is disciplined (gates, charges and labels derive from the
same helpers; accessibility and reduced-motion are consistently honoured). The
**presentation layer has a design system on paper and none in practice**:

- `lib/config/theme.ts` is coherent (documented WCAG reasoning, small palette) —
  but almost nothing consumes it: **7,333 hand-written style keys** across 269
  `StyleSheet.create` blocks, **212 distinct hex literals** (4,756 occurrences),
  **156 distinct borderColor values**.
- `components/ui/BaseModal.tsx` promises to replace "43+ individually-styled
  modals"; it has **6 importers** while **101 files use a raw `<Modal>`**.
  There is **no Button, no Card, no Text primitive at all** — 162 files use raw
  `TouchableOpacity`.
- Every feature shipped its own card + gradient + badge + modal and nothing was
  ever removed. Result: the Home feed stacks up to ~20 modules of identical
  visual weight (admitted in `components/ui/SectionGroup.tsx:1-12`), the HUD
  shows ~13 numbers and ~21 tap targets permanently (`TopStatsBar.tsx`, 1,888
  lines with its styles), and one "Next Week" tap can queue **up to eight
  dismissable surfaces**.

The tester saw the sum of three failures: **no enforced primitives**, **purely
additive feature design**, and an **uncoordinated interrupt/monetization layer**.

## 2. Biggest sources of complexity (ranked)

1. **The interrupt layer.** ~30 surfaces can render above gameplay. One week
   tap can produce: stat floaters → recap → toasts → life moment/weekly event →
   result sheet → interstitial ad → welcome-back (600ms) → daily reward (800ms)
   → Discord popup (1400ms) → notification ticker (1600ms) → premium promo
   (1800ms). The priority queue (`contexts/InterruptionContext.tsx`) orders
   them but nothing **budgets** them.
2. **Home = five answers to one question.** NextGoalsCard, WeekAheadCard,
   LifeChapterCard, AmbitionCard, ScenarioChallengeCard, WeeklyChallengeCard,
   LiveEventsCard — five of them are the *same* checklist-with-progress-bars
   component in different accent hues (`home.tsx:766-800`).
3. **The HUD.** 13 numeric readouts, 4 icon circles, 3 gesture models on the
   same targets (tap/long-press, with gems *inverting* the convention —
   tap = buy, `TopStatsBar.tsx:929-940`), 9 owned modals — and the game's
   primary action (advance week) is an unlabeled ~40pt circle in its corner.
4. **Navigation depth, not tab count.** The bar is already a healthy 4 tabs.
   Below it: 4 tabs → segmented controls → a 19-tile app grid → sub-apps each
   with 2–5 internal tabs (**~70 nested destinations**) → modals. Trading a
   stock is 5 levels deep. Life→Market stacks **two segmented controls**
   (8 pills on screen; the workaround is documented at `market.tsx:519-534`).
5. **Work (1,759 lines).** Job cards carry up to **9 metadata chips** (~70–110
   numbers per scroll), buttons have **11 text states** (9 non-actionable),
   promotion progress renders **three times** in the first screenful, and the
   employed button reads `Manage Job (+100%)`.
6. **Progression.** No primary action; 15 tap destinations; **12 modals behind
   12 independent useState booleans** (`progression.tsx:79-90`); achievements
   shown twice on the screen (three times counting Home); prestige shown up to
   three times; monetization (Legacy Pass, DeepLife+) inside a "Tools" grid
   next to the diary.
7. **Onboarding ends on the worst screen.** The "Play" quick-start routes to
   Perks — "step 4 of 4" with 3 phantom completed steps, 21 perks of which
   **20 are locked on a first run**, plus an 11-entry Mindset tab, whose own
   copy tells the player to skip it (`Perks.tsx:614`).
8. **Three overlapping tutorial systems** (plus two inline job nudges), two of
   which are effectively dead: `FirstWeekGuide` (718 lines) is only reachable
   in a ~500ms race window and never on a second life; `SimpleTutorialModal`
   and `FirstSessionCoach` both fire at week 1.
9. **Monetization sprawl.** 8 distinct paywall/store presentations; 4 files
   each mount their own `SubscriptionModal`; on Home alone, 4 persistent store
   affordances (crown, gold store button, gem `+`, banner ad) plus whatever
   popup holds the interrupt slot.

## 3. Biggest "AI-generated" visual signals

1. **The kicker/crest card template, stamped nine times.** Nine cards share a
   byte-identical container differing in exactly one property — the border
   hue (blue/purple/pink/sky/sky/violet/yellow/blue/white). The hue encodes
   nothing; stacked, it reads as a rainbow. Each re-declares its own
   `crest`/`iconBubble` circle (9 + 13 independent definitions) and an
   ALL-CAPS kicker (`WHAT NEXT`, `LIFE AMBITION`, `WEEKLY CHALLENGE`, …).
2. **Decorative gradients.** 262 `<LinearGradient>` instances in 137 files; 47
   distinct literal color arrays, 35 used exactly once. Work's background is a
   gradient **between two identical colors** (`work.tsx:1024`). IdentityCard's
   is between two near-identical slates. `components/ui/Gradient.tsx` records
   that 75 call sites rendered *flat* for an unknown period and nobody noticed
   — proof the gradients carry no information. Worst tell: the launcher's **19
   hand-authored gradients each with a comment justifying the color choice**
   (`computer.tsx:244-419`).
3. **Everything is emphasis.** 50 distinct fontSize values (including
   imperceptible half-steps like 11.5/12.5 ×132) and **1,317 of 2,168 weight
   declarations at 700+ vs. 7 at regular 400**. There is no body text, so
   nothing reads as a headline.
4. **Glass that isn't.** 74 files import `glassmorphismStyles`, mostly for the
   shadow helper; the "Liquid Glass" tab bar is documented as having **no
   backdrop blur on device** (`glassmorphismStyles.ts:142-164`). Blur-fill +
   rgba surface + hairline border + shadow on containers inside containers.
5. **Badge/emoji taxonomies.** 5-type emoji badge system in the market
   (`⭐🔓💎✓🔥`, `utils/marketBadges.ts`), emoji hero icons on cards that
   otherwise use a disciplined 228-file lucide set, `color + '20'`/`+ '1F'`
   opacity-suffix hacks, chips on chips.
6. **Default indigo→violet.** `gradientPrimary: ['#6366F1','#8B5CF6']` plus
   `#A78BFA #8B5CF6 #C084FC #818CF8 #38BDF8` co-present on the Home feed.
7. **Contradictory stat colors at first contact.** Onboarding perk cards paint
   happiness RED and energy AMBER (`perksFlow.ts:getStatColor`) — the opposite
   of the HUD the player meets seconds later (`lib/config/statIdentity.ts:14-28`
   documents the three-way disagreement).

## 4. Screens requiring complete redesign

| Screen | Why |
|---|---|
| **Home feed** (`home.tsx` + 9 card components + IdentityCard) | 20 modules, 5 duplicate checklists, no primary action, ~29 reachable modals |
| **TopStatsBar HUD** | 13 readouts / 21 targets / 9 modals / 3 gesture models; primary action unlabeled |
| **Work** (`work.tsx`) | 9-chip cards, 11 button states, triple promotion progress |
| **App launcher** (`computer.tsx` + `mobile.tsx`) | 19 undifferentiated gradient tiles, 2 near-duplicate implementations, locked-tile wall |
| **Progression** | 12 modals, 9-tool junk drawer, no primary action, duplicated achievements/prestige |
| **Onboarding wizard** (Perks step; Ambitions step) | Quick-start lands on a 95%-locked grid; Ambitions duplicates a Home card |
| **The interrupt layer** (cross-cutting) | Needs a per-tick budget and full queue coverage |

## 5. Screens requiring moderate redesign

- **Market** — merge Items/Food/Housing into one list with headers, move Gym to
  Health, delete the 4-chip filter bar (filters ~8 items), cut badges 5→1.
- **Health** — group 14 identical CTA cards (Free/Medical/Luxury), promote
  treatment into the disease card when sick, label the collapsed vitals digits,
  render diet plans as a single-choice selector.
- **Life shell** — Family must stop masquerading as a segment; resolve the
  double tab bar.
- **MainMenu** — structurally healthy (4–6 elements, no promos); just shorten
  the ~1s staggered entrance and fix the wizard it leads into.
- **SaveSlots** — off the happy path; simplify its 3 nested confirm dialogs
  opportunistically.

## 6. Screens that are already strong (do not break)

- `apps.tsx` — a model host component.
- `life.tsx` *architecture* (mount-on-first-visit, deep links with consume-once
  nonce, a11y hiding) — only its Family segment and stacking are wrong.
- The 4-tab bottom bar and the 9→4 merge reasoning.
- `FamilyTab`'s no-partner empty state (`FamilyTab.tsx:1054-1097`) — icon, one
  sentence, one CTA, three steps. **This is the house style to generalize.**
- Empty states app-wide (never dead ends), lock reasons that state the
  shortfall, gate/label/charge parity, accessibility and reduced-motion
  discipline, `CollapsibleSection` with persisted ids and live summaries,
  `InterruptionContext` as a mechanism, `theme.ts` and `statIdentity.ts` as
  content, `ui/Gradient.tsx` (solves a real iOS 26 crash — keep as plumbing
  even as decorative uses are removed).

## 7. Navigation problems

1. **Duplicate front doors.** Five routes are `href: null` yet still pushed by
   name — `lib/goals/catalogue.ts` (9 pushes), `lib/depth/systemRoutes.ts:52-71`,
   `home.tsx:819` — rendering a second, un-chromed copy of Market/Health/
   Progress with no tab highlighted, while the canonical `life?segment=` /
   `apps?app=` forms exist and are used elsewhere. **One door per room.**
2. **Three tab idioms** (native tab bar, SegmentedControl, per-app custom tab
   rows) and **tabs inside tabs inside tabs** (~70 nested destinations).
3. **A fake segment**: Life's "Family" pill launches a modal and leaves the
   selection unchanged (`life.tsx:107-109`).
4. **Shape-shifting tab**: buying a computer silently changes the Apps tab from
   9 tiles/2 columns to 19 tiles/3 columns and swaps `BankApp` for a different
   5-tab `AdvancedBankApp`.
5. Duplicated feature reachability with divergent implementations: two Bank
   apps, two launcher catalogs with different gradients for the same app and a
   `paw`/`pet` id mismatch aliased in three files.

## 8. Information architecture problems

- "What should I do next?" answered by 5 concurrent cards; "how healthy am I?"
  answered on 4 surfaces; achievements in 3 places; prestige in 5; date/age in
  2 (HUD + HeroStrip).
- Monetization interleaved with content everywhere instead of one store.
- Notifications split across an auto ticker, a manual center, and an inbox pill.
- Life Story / Timeline / Journal / Share Life are four tiles for one concept
  ("your story").
- Legacy Contracts live on the sixth of six scrolling tabs inside a modal
  behind a card behind a tab — five levels deep.
- Two weekly caps (per-job `1/3` ring, global `3/8` note) shown as unrelated
  facts on the same screen.

## 9. Components to REMOVE

| Component | Evidence |
|---|---|
| `AncestorProfileModal.tsx` (255 L), `LeaderboardModal.tsx` (513 L) | zero importers |
| `TutorialManager` + `SimpleTutorialModal` + `enhancedTutorialData` + `showWelcomePopup` trigger | superseded by FirstSessionCoach |
| `FirstWeekGuide` modal (718 L) | dead by construction (500ms race, device-wide flag); harvest its 8 steps into FirstSessionCoach |
| Inline "Find your first job" CTA (`home.tsx:704-733`) + `ContextualTip 'no_job'` | third and fourth copies of the coach's message |
| `WeeklyResultSheet` | `LastWeekRecap` covers it non-blockingly; its dismiss button is even labeled "Next Week" |
| `HeroStrip` on Home | duplicates the HUD date box |
| `CareerPathCard` compact instance (`work.tsx:1218`) | strictly-weaker duplicate of the hero card 100px above |
| `PremiumCrownButton` (or the equivalent duplicate store entry) | 4 concurrent store affordances on Home |
| Market filter bar + 4-of-5 badge types | filters ~8 items; empty "Owned" state on week 1 |
| Glass generators except the shadow helper (`glassmorphismStyles.ts:39-225`) | importers overwhelmingly take only `getPlatformShadows` |
| Dead styles: `computer.tsx:918` `categoryTabsWrapper`, `PrestigePreviewCard.tsx:120-122` empty `containerDark` | vestigial |
| Perks + Ambitions steps from the FTUE path | 20/21 perks locked; Ambitions already lives on Home |

## 10. Components to CONSOLIDATE

| Merge | Into |
|---|---|
| 7 breakdown modals (Energy/Health/Happiness byte-identical; Bank superset; Money/Gems same skeleton; NetWorth hand-rolled) | **1 `StatBreakdownModal`** `{title, current, incomes[], drains[], footnote}` (~1,600 of 1,990 lines saved) |
| 9 kicker/crest cards | **1 `Card` primitive** (+ `IconBubble`); one border color |
| 5 checklist cards on Home | **1 Goals surface** showing the top 1–3 objectives across all systems, rest behind disclosure |
| `computer.tsx` + `mobile.tsx` launchers | **1 `AppLauncher`** with one shared catalog module (fixes paw/pet and the Bank gradient fork) |
| 8 paywall/store surfaces | **2**: one subscription paywall, one gem store; single mounted `SubscriptionModal` |
| 4 `AlertHost` mounts | 1 (root) |
| `SmartNotificationTicker` + `SmartNotificationCenter` + `EventInboxPill` | 1 inbox surface |
| Life Story + Timeline + Journal + Share Life | 1 "Your Story" surface with internal tabs |
| Criminal-level + criminal-record cards; the two weekly caps | 1 crime-standing card; 1 cap line |
| `WatchAdRewardButton` | into `AdRewardOrb`'s CTA (1 call site each) |
| `GradientButton`/`LoadingButton` | one `Button` primitive with variants |
| Vehicle+Luxury, Gaming+Streaming sub-apps (later phase) | 2 apps instead of 4 |

## 11. Components to REDESIGN

- **TopStatsBar** → ~7 readouts: 3 vital rings (tap=breakdown, one gesture
  model; delta arrows default off), one money chip (bank/net-worth inside the
  breakdown), gems chip (tap=breakdown, `+`=buy), one date/age line, one
  **labeled** primary Next Week button. Settings/help/store collapse into one
  overflow. Modals via one `ModalName` union (the pattern it already uses).
- **JobCard** → max 3 chips visible; remaining metadata behind card expansion;
  2–3 button states (`Apply` / disabled-with-reason / `Manage`).
- **HealthCard list** → grouped, opinionated (surface treatment when sick).
- **PrestigeShopModal** → 6 scrolling tabs flattened to sectioned list.
- **SegmentedControl usage** → never stacked two-deep; never hosts a launcher.
- **Perks screen** → post-first-life surface reached from the death/new-life
  flow, not FTUE step 4.
- **Onboarding stat colors** → delete `perksFlow.getStatColor` and
  `palette.health/happiness/energy`; `statIdentity.ts` becomes the only source.

## 12. Recommended simplicity principles (the new rules)

1. **One primary action per screen**, visually dominant and labeled. Home's is
   "Live this week". If everything is important, nothing is.
2. **One card. One border. Meaning lives in the icon and the words**, never in
   a decorative hue. Color appears only when it means something (the 4
   semantics + `statIdentity`).
3. **Type does the hierarchy**: 6 sizes, 3 weights, body text is *regular*.
   Bold regains meaning the day it becomes rare.
4. **No decorative gradients, no faux glass.** Flat surface + hairline border +
   spacing. (Keep `ui/Gradient.tsx` as plumbing; starve its call sites.)
5. **Plain text is allowed.** Not every fact is a chip; not every group is a
   card.
6. **A tick may interrupt at most twice.** Everything else lands in the inbox.
   Every surface that can appear over gameplay must hold a queue slot.
7. **One door per room.** Every destination has exactly one canonical route;
   `check:routes`-style guard for pushes to `href:null` routes.
8. **Progressive disclosure is the default**: basic → detail → advanced, using
   the existing `CollapsibleSection` machinery. Locked content collapses to a
   count, it doesn't wallpaper the screen.
9. **One store.** Monetization lives behind one entry point plus contextual
   moments — never four persistent affordances at once.
10. **Icons are lucide.** Emoji only inside diegetic phone apps (Pulse, Pets,
    Travel), where it is content, not chrome.

## 13. Recommended new visual direction — "Quiet Ledger"

A calm, confident, print-inspired dark UI. It keeps the existing slate ground
and indigo brand but uses them the way a well-set book uses ink:

- **Ground**: `dark900/800` flat surfaces; a single `rgba(255,255,255,0.08)`
  hairline separates planes; shadow only on true overlays (sheets, modals).
- **One accent**: brand indigo, reserved for the primary action and active
  states. Semantic green/amber/red/blue keep their jobs. The violet/sky/pink
  satellite accents retire.
- **Type-first hierarchy**: numbers get a tabular treatment; labels are small
  regular-weight muted text; only values and headings are semibold. Kickers
  survive only as one shared small-caps style, not nine colored ones.
- **Space over chrome**: sections separated by whitespace and a heading, not by
  nested containers.
- **Motion = feedback only**: state changes animate; nothing breathes, pulses,
  glows, drifts, or shines while idle (also a battery win).
- Complies with Hard Rule #7 by construction (full hairline borders, no accent
  stripes).

## 14. Exact implementation order

Ordered by (player frequency × importance × current UX damage × visual
impact), respecting dependencies. Each phase is releasable on its own.

**Phase 0 — Foundations (no visible change)**
1. Build primitives: `Card`, `Button`, `Text` (type scale), `IconBubble`,
   `StatBreakdownModal`; extend `BaseModal` adoption.
2. Single stat-color source (`statIdentity`); delete the two contradictors.
3. Lint guards: ban new `LinearGradient`/glass imports outside an allowlist,
   ban raw `fontSize:` literals in new code, keep Hard Rule #7's checker.
4. Delete dead code (§9 zero-importer rows, dead styles).

**Phase 1 — Kill the noise (biggest felt win, smallest risk)**
5. Interruption budget (≤2/tick) + enroll every unqueued surface
   (Sickness/Cure, ticker, interstitial, review sheet).
6. Remove tutorial triplication; keep FirstSessionCoach, port FirstWeekGuide's
   steps into it. Remove WeeklyResultSheet. One AlertHost.
7. Consolidate paywalls 8→2; one store entry on Home; unmount the four
   `visible={false}` modals (`home.tsx:969-972`).

**Phase 2 — The HUD** (§11 TopStatsBar spec; promote a labeled Next Week).

**Phase 3 — Home** (unified Goals surface; IdentityCard diet — health block →
Health, gem claim → store, ~4 nested card levels → 1; one prestige row; remove
HeroStrip; re-cut remaining cards on the `Card` primitive).

**Phase 4 — Work** (JobCard 3-chip redesign, button-state collapse, single
promotion progress, merged crime cards, Skills-tab fold into Street, kill the
identical-color gradient).

**Phase 5 — Structure** (one `AppLauncher` + shared catalog, pinned apps +
"All apps", locked apps → one collapsed row; Market flatten + Gym → Health;
Life segment fixes; route dedup in `goals/catalogue.ts`, `depth/systemRoutes.ts`,
`home.tsx:819`; extend `check:routes` to guard it).

**Phase 6 — Progression & onboarding** (12 modals → `ModalName` union and ~4
surfaces; 9 tools → 3 + "Your Story"; Perks/Ambitions out of FTUE; Customize
behind "Edit look"; Challenges tab gated post-prestige).

**Phase 7 — Sub-app pass** (per-app re-cut on the primitives; merge
Vehicle+Luxury, Gaming+Streaming; one Bank app; PrestigeShop flatten).

**Verification per phase**: `npm run preflight:quick`, `__tests__/startup` for
anything touching `app/`, `__tests__/render` + the market/HUD suites for
re-cut screens, and a device smoke test before any `React.lazy` change (§5
CLAUDE.md). No save-format changes are required by any phase except retiring
`showWelcomePopup` reads (field can stay inert, the v38 precedent).

---

### Appendix: headline metrics to ratchet

| Metric | Today | Target |
|---|---|---|
| Surfaces one tick can present | 8+ | ≤2 + inbox |
| Home modules at full weight | ~20 | ≤6 |
| HUD numeric readouts / tap targets | 13 / ~21 | ≤7 / ≤10 |
| Distinct card container styles | 9+ | 1 |
| Checklist cards answering "what next" | 5 | 1 |
| `<LinearGradient>` instances | 262 | <20 (semantic only) |
| Distinct fontSize values | 50 | 6 |
| Weight ≥700 share of declarations | 61% | <25% |
| Paywall/store surfaces | 8 | 2 |
| Modals reachable from Home | ~29 | ≤10 |
| FTUE screens (quick path) | Menu→Perks(4/4) | Menu→Play |
| Launcher implementations / catalogs | 2 / 2 | 1 / 1 |
