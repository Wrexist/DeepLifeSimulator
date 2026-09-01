# The 19 Phone Apps — UI audit, design matrix and proposals

Master Program 3 (2026-09-01). Companion to `tasks/ui-overhaul-blueprint.md`
(Program 1). Program 2 (asymmetry) was briefed but never landed on `main`;
nothing here depends on it.

Every app is hosted by `components/launcher/AppLauncher.tsx` full-screen with a
single prop, `onBack`. The host supplies only the top safe-area inset, so **each
app builds its own header, its own tab bar, its own stat tiles, chips, section
titles, empty states and (often) its own modal and toast.** That is the root of
the "19 different apps by 19 different teams" impression, and it is what the
convergence in §4 fixes.

## 1. Inventory

| # | id | Name | Entry | LOC | Header | Tabs (style) | Sub-views | Modals | Heavy weights | Bespoke primitives |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | tinder | Spark | `components/mobile/Spark/SparkApp.tsx` | 4,881 (15 files) | own + gradient wordmark + Crown | 4 bottom (custom) | Chat, Partner profile | 4 raw `<Modal>` | 41 | header ×3, tab bar, EmptyState, StatRow, hero recipe ×3 |
| 2 | contacts | Contacts | `components/mobile/ContactsApp.tsx` | 1,893 | own + spacer | 4 underline | Network detail | 3 shared + toast | 27 | header, tab bar, statsHero, Stat, Fact, EmptyHero, ActionBtn |
| 3 | mail | DeepMail | `components/mobile/Mail/MailApp.tsx` | 1,877 (4) | search field (best) | chips + 4 category tabs + folder drawer | Detail, Document | drawer `<Modal>` | 26 | everything local; 117 hardcoded hex |
| 4 | social | Pulse | `components/mobile/Pulse/PulseApp.tsx` | 7,655 (32) | own ×5 copies + wordmark | 4 bottom + FAB; Profile ×4 sub-tabs; BrandDeals ×3 | 5 overlay routes | 7 raw `<Modal>` (2 mounted twice) | 56 | header ×5, 3 tab bars, EmptyState, SectionHeader, FAB |
| 5 | stocks | Stocks | `components/mobile/StocksApp.tsx` | 1,192 | own ×2 + cash chip | 3 pills (glass) | Detail | 1 shared | 20 | header, tab bar, SectionTitle, StatCard, HeroCard, GroupCard, InfoCard, SummaryStrip |
| 6 | bank | Bank (phone) | `components/mobile/BankApp.tsx` | 1,484 (+3,705 shared banking/) | own `renderHeader` | none (scroll) | Account, Credit, Tax | 8× AmountInputModal + 4 | 17 | Stat, LedgerChip, FactCell, SectionHeader |
| 6b | bank | Bank Pro (desktop) | `components/computer/AdvancedBankApp.tsx` | 2,338 | byte-identical to 6 | 5 underline | Account, Credit | same + 3 | 26 | 9 local incl. EmptyCard copy, CreditScoreBreakdown |
| 7 | education | Education | `components/mobile/EducationApp.tsx` | 1,505 | own + unlabeled cash chip | 3 pills (role=tab ✓) | Course detail | shared Enroll + 2 hand-rolled overlays | 18 | HeroCard, StatTile, Chip, SubjectBubble, SectionTitle, DetailStat |
| 8 | company | Hustle | `components/mobile/Hustle/HustleApp.tsx` | 5,280 (14) | own ×3 + wordmark, no cash | 2 custom segments; detail = 10-section scroll | Detail, Create | 5 custom | 82 | parallel theme file, EmptyState, segment, KPICard, ActionRow |
| 9 | pet | Pets | `components/mobile/PetApp.tsx` | 1,673 | own + unlabeled gold chip | 4 pills (role=button) | Pet profile (back button INSIDE scroll) | raw `<Modal>` + toast | 23 | 10 local comps, 12 GOLD_* constants, 4 hero variants |
| 10 | bitcoin | Crypto | `components/computer/BitcoinMiningApp.tsx` | 2,257 | own + amber chip | 4 pills | Rig, Coin | 2 shared | 20 | HeroCard, StatCard, StatPill, PrimaryCTA, SectionTitle, 5 chip rows |
| 11 | realestate | Real Estate | `components/computer/RealEstateApp.tsx` | 1,666 | own + emerald chip | 4 underline | Listing | 2 shared | 33 | Kpi, DetailStat, StatChip, 3 empties, 128 style keys |
| 12 | onion | Dark Web | `components/computer/OnionApp.tsx` | 1,819 | composite terminal path + heat chip | 4 pills lowercase | 5 sub-views w/ duplicate in-body back | 3 shared | 23 | whole terminal design system (kept as skin) |
| 13 | gaming | YouVideo | `components/computer/GamingApp.tsx` | 1,481 | own + violet chip | 4 underline (inline JSX) | Video | none; toast | 32 | 12 stat cells on landing tab, 14 gear tiles |
| 14 | streaming | Streaming | `components/computer/GamingStreamingApp.tsx` | 1,580 | own + fuchsia chip (same keys as 13) | 4 pills (inline JSX) | Category, Broadcast | none; toast | 36 | 8-stat grids ×3, Go Live CTA ×4, category grid ×2 |
| 15 | travel | Travel | `components/computer/TravelApp.tsx` | 1,779 | own + teal chip | 4 underline (tabs unlabeled for a11y) | Destination | 1 hand-rolled | 49 | 4 summary strips, 3 empties, ~200 L boarding-pass chrome |
| 16 | political | Political Office | `components/computer/PoliticalApp.tsx` | 2,255 | own + sky chip | 4 underline | 5 sub-views | 6× AmountInputModal + 1 | 29 | StatCard, AggStat, ReqChip, 4 stacked CTAs |
| 17 | statistics | Statistics | `components/computer/StatisticsApp.tsx` | 1,542 | own + week chip | 4 underline | 6 detail views | none | 34 | 19 local comps; 5 number-with-label primitives |
| 18 | vehicle | Garage | `components/computer/VehicleApp.tsx` | 1,573 | own + orange chip | 3 pills | Vehicle detail | 1 shared | 29 | SpecChip, FootChip, StatCell, SpecTile, DetailRow, MiniGauge |
| 19 | luxury | Luxury | `components/computer/LuxuryApp.tsx` | 1,543 (+114) | own + blue chip (≈ Garage's) | 2 underline | bottom sheet (hand-rolled, 450 ms stacked-modal timer) | 2 ConfirmDialog + sheet + toast | 23 | StatChip, LuxuryCard, RevealItem, ArtworkBanner |

Totals: ~47,000 lines; **24 hand-rolled headers, 21 tab bars in three visual
dialects (glass pills / underline / bottom bar), ~30 stat-tile primitives, ~20
chip primitives, the same "glow blob + hairline" hero recipe copied into 14
files, 16 raw `<Modal>`s, 9 bespoke empty states, 3 hand-rolled toasts.** Of
the shared primitives Program 1 shipped, `ScreenHeader` has one consumer (the
launcher), `SegmentedControl` two (Work, Life), `Card` none of the 19,
`BaseModal` none of the 19.

Seven apps had no `ErrorBoundary` (Pets, Hustle, Travel, Statistics, Luxury,
YouVideo, Streaming): a throw in any of them took the whole Apps tab down.

## 2. Grouping by purpose

| Group | Apps | What the player does | Dominant element |
|---|---|---|---|
| **Social** | Spark, Contacts, Pulse, DeepMail | talk to people, triage messages | the list of people / messages |
| **Money** | Bank, Stocks, Crypto, Real Estate | move money, buy an asset | balance hero + ONE primary CTA |
| **Career / growth** | Education, Hustle, Political Office | invest weeks into a ladder | the current rung + its one action |
| **Creator** | YouVideo, Streaming | publish content | composer / live console + one CTA |
| **Possessions** | Garage, Luxury, Pets | buy, maintain, enjoy | the owned thing + its care actions |
| **Play / risk** | Dark Web, Travel | one-off ventures | the board of opportunities |
| **Read-only** | Statistics | look | net-worth hero |

## 3. Design matrix — what should be shared vs app-specific

| Layer | Shared (identical in all 19) | App-specific |
|---|---|---|
| Header | `AppHeader`: back (44pt, labeled) · title · right chip. Title swaps to the sub-view name. | The chip's content (cash / week / heat / followers) and tint |
| Top navigation | `SegmentedControl` (role=tab, labeled, `scrollable` when > 4) | Segment names, icons, count badge |
| Bottom navigation | Only Spark and Pulse (social apps modeled on real phone apps) keep a bottom bar | — |
| Stat tiles | `StatStrip` / `StatTile` — label + tabular value + optional tint | Which 2–3 numbers |
| Chips | `Chip` — label + optional icon, `tone` | Copy |
| Section titles | `SectionTitle` — title + optional right slot | Copy |
| Progress | `ProgressBar` (linear) + existing `ProgressRing` | Color for meaning |
| Cards | `Card` / `getGlassCard` | Content |
| Empty state | `EmptyState` (observation + nudge + CTA) | Copy (Pulse/Spark keep their illustration) |
| Modals | `BaseModal` (bottom variant) / `ConfirmDialog` / `AmountInputModal` | Content |
| Toast | `ToastNotification` via `useToast` | Copy |
| Identity color | one accent from `lib/config/theme.accent` + `withAlpha` | Which accent |
| Brand skin | none | Dark Web keeps its terminal skin (it is the fiction); Spark/Pulse keep a wordmark |

Repetition that was **false difference** (same thing, different look): pill vs
underline tab bars, `topBar` vs `header` keys, "Acquire" vs "Buy", "Restore it"
vs "Repair", "Fleet value" vs "Collection value", `Kpi` vs `StatCard` vs
`MoneyStat` vs `BoardStat` vs `MiniStat`, and the 14 copies of the hero recipe.

Difference that is **real** and stays: Mail's search-as-header, Dark Web's
terminal skin, Spark/Pulse bottom bars, Stocks' sector board as filter,
Vehicle's costed button labels ("Refuel $42" — the best button copy in the
app; other apps should copy it, not the reverse).

## 4. Convergence plan (no forks)

New primitives in `components/ui/` (each replaces N local copies):

| Primitive | Replaces | Notes |
|---|---|---|
| `AppHeader` | 24 headers | back + title + `right`; wraps nothing from `ScreenHeader` (which is the tab-screen title block, a different job) |
| `StatStrip` + `StatTile` | ~30 stat cells | horizontal strip with hairline dividers; `tint` optional |
| `Chip` | ~20 chip styles | `tone: neutral | info | success | warning | danger`, optional icon, `onPress` |
| `SectionTitle` | 12 section titles | title + optional `right` node |
| `ProgressBar` | 8 track/fill pairs | `value 0–1`, `color`, `height` |
| `withAlpha(hex, alpha)` in `lib/config/theme.ts` | 4 alpha helpers + ~120 rgba literals | one tint ladder |
| `SegmentedControl` `scrollable` variant | 21 tab bars | existing component gets a scroll variant; nothing forked |
| `EmptyState` | 9 bespoke | existing; adopted |
| `ErrorBoundary` at the launcher | 7 unwrapped apps | one wrap in `AppLauncher` around `<AppComponent>` |

## 5. Owner-approval decisions — PROPOSALS ONLY, NOT IMPLEMENTED

### Decision 1 — Merge Garage + Luxury into one "Collection" app

**Evidence.** Both implement the same loop (buy → own → maintain → insure →
sell at a loss) with different vocabulary: Repair / Restore it, Buy / Acquire,
Fleet value / Collection value, "Weekly upkeep" in both. Their headers are
byte-comparable. Their catalogs overlap semantically — Luxury sells a Hypercar,
two yachts and a private jet; Garage sells an exotic supercar, a light jet and a
helicopter — so a player wanting "an expensive car" has two unrelated apps.

**Shape.** One `AppHeader` + `SegmentedControl` `Vehicles | Luxury | Shop`; one
`AssetCard` (art, name, tier chip, value, one tap) and one `AssetDetail` whose
action rail is composed from a per-domain capability list
(`refuel | repair | restore | insure | setActive | host | verb | sell`). Buy
flows stay distinct (financing modal vs confirm).

**Is it pure UI?** Presentation, yes: `vehicles[]` / `activeVehicleId` and
`luxuryItems[]` / `luxuryHoldings{}` stay exactly as they are; every action
keeps its signature; no save-format change. Three things must stay
vehicle-only and visible as such: the driver's / pilot's licence gates, the
`activeVehicleId` slot (it feeds travel speed), and vehicle financing. A merged
"total value" header number would be a NEW aggregate and must remain
presentational (never written to state; net-worth math is untouched).

**Cost / risk.** ~600 lines net deleted. The launcher loses one tile (order is
"part of the contract" — the `?app=vehicle` / `?app=luxury` deep-link ids must
both keep resolving, so the merged app must accept both ids). Risk is player
muscle memory for two existing tiles; mitigation is keeping both icons pointing
at the merged app with the matching segment pre-selected.

**Recommendation.** Yes, merge. **Awaiting owner approval.**

### Decision 2 — Merge YouVideo + Streaming into one "Creator" app

**Evidence.** Both read the same slice (`gameState.gamingStreaming`), call the
same `computeQuality` and `monetizationSummary` with the same arguments, and
dispatch the same `buyAccessory` / `upgradePCComponent` actions with the same
price constants. The gear shop is rendered twice (14 image tiles in Studio, 14
rows in Shop) with character-for-character identical label constants. The
channel identity block, monetization readout (6 vs 8 cells of the same
object), weekly cap meter and energy gate are all implemented twice.

**Shape.** One header; `SegmentedControl` `Videos | Live | Studio`; one shared
channel block above the segments; per segment a composer (topic chips +
projected reach + Publish) or a broadcast console (category tiles + hype/cap
meters + Go Live / Stop); one history surface with a Videos/Streams filter.

**Is it pure UI?** Yes. Two things must survive verbatim: Streaming's
real-time drain loop (`setInterval` at `LIVE_TICK_MS`) and its stale-session
resolver on mount, which must keep firing whenever a live session exists even
while the Videos segment is showing; and the two independent `saveGame`
throttles become one cadence.

**Cost / risk.** ~1,200 lines net deleted. Same deep-link consideration as
Decision 1 (`?app=gaming`, `?app=streaming` both keep working).

**Recommendation.** Yes, merge — this is the cleanest of the three, since
the two apps are already one state and one action module. **Awaiting owner
approval.**

### Decision 3 — One Bank (phone Bank + desktop "Bank Pro")

**Evidence.** The catalog already registers them as ONE app id with a
`desktopComponent` swap. The header, the credit-score sparkline (~20 lines,
copy-pasted), the credit report, the account detail, the facts grid, the
savings-goal two-step and the bill list are duplicated 1:1. The phone version
has the better money-moving control (`AccountTransferPanel`, a slider); the
desktop version's transfer is a three-deep nested native-alert chain.

Desktop-exclusive today: loan refinance, card charge + reward redemption,
account-to-account transfer, budget tracking + budget targets, net-worth
composition ledger, blended APY, the economy-event banner. Phone-exclusive: the
watch-ad cash bonus. One behavioural difference worth an owner call: the
desktop loan quote counts partner income; the phone quote does not.

**Shape.** The phone app becomes the one Bank: card deck + `AccountTransferPanel`
as the base, and ONE extra "Bank Pro" section (refinance on loan rows, charge /
redeem on card rows, transfer, budget) gated by the host (`desktop` vs
`phone`) — the same visibility rule the catalog's swap encodes today, expressed
as a section instead of a second file.

**Is it pure UI?** Almost. The gating is the existing host rule, so no feature
moves between devices; but the partner-income difference in the loan quote is
gameplay and the merge must pick one (proposal: the desktop rule, since it is
the more generous and the more realistic one; owner to confirm).

**Cost / risk.** ~1,400 of 2,338 desktop lines deleted. Risk: any test pinned to
`AdvancedBankApp` (two source-scan tests reference it) moves with it.

**Recommendation.** Yes, unify, with the phone app as the base. **Awaiting
owner approval.**

### Prestige shop — do NOT flatten the six tabs

Assessed and left alone as instructed. The existing mitigation (the shop opens
on the Dynasty tab, the one with the live decision) already gives it a single
entry point; six tabs behind one deliberate destination is a different case from
an app whose landing tab has no action at all.

## 6. Launcher hierarchy

`AppLauncher` already reads one catalog, groups by host section, and hides
locked apps behind one disclosure (Program 1, Phase 5). Order is a contract.
Findings: badges are limited to four sources (Spark, Pulse scandal, Pets,
Hustle, Mail) and every badge is a real pending decision — no change. The pet
tile sits last on the phone grid by historical order; left as is.

## 7. Copy consistency

One verb per action across the 19: **Buy** (not Acquire), **Sell**, **Repair**
(not Restore it), **Study**, **Book**, **Go live**, **Post**, **Feed / Play /
Sleep**, **Hire**, **Enroll**, **Deposit / Withdraw**. Vehicle's costed labels
("Refuel $42", "Sell $18,400") are the model. Marketing blurbs inside apps
("A collection worth showing off", "Unlock world travel", "Empire snapshot") are
removed where they carry no state.

## 8. What was changed (running log — updated as phases land)

See `tasks/todo.md` for the phase checklist and the commit log for the diff.

## 9. Red team — what could still make it read as machine-made

Filled in at Phase 14.

## 10. Scores (0–100, before → after)

Filled in at Phase 14.
