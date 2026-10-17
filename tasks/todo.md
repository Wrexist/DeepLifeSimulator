# Mindsets that shape a whole life - 17 October 2026

Branch `claude/mindset-design-2026-10-17`. Owner: "do the bigger design job, make it perfected, clean and professional". Mindsets were street-work-only after PR #239; each now keeps its ORIGINAL promise, in the system its name names. One active Mindset per life.

Design rules: one table (`lib/mindset/effects.ts`) is the only place a number lives; every consumer reads it through one resolver; the copy every screen shows is GENERATED from the table, so it cannot drift; each Mindset has exactly one upside and one downside, modest (10-25%); no new GameState fields; deterministic; tick and UI read the same seam.

| Mindset | Upside | Downside | Seams |
|---|---|---|---|
| Frugal | Market prices -10% | Luxury items give -25% happiness | `getItemPurchasePrice`, luxury happiness |
| Workaholic | Career pay +10% | Health wears down 20% faster | `careerPayMultiplier`, decay (tick + vitalDrift) |
| Socialite | Bond from calls/hangouts +25% | Social activities cost +25% | `resolveInteraction`, hangout/date/gift costs |
| Optimist | Weekly happiness gains +15% | Street jobs succeed 5% less | tick net happiness scaling, street table |
| Perfectionist | Promotion progress +15% | Happiness wears down 20% faster | `applyCareerProgress`, decay |
| Adventurous | Trips -15% cost, +25% happiness | Restless: happiness wears down 25% faster after 26 weeks without a trip | `quoteTrip`, trip benefit, decay |
| Gambler | Illegal street pay +25% | +5% arrest risk | street table |
| Risk Averse | Arrest risk -25% | Street pay -5% | street table |
| Investor | Dividends and rent +15% | Property costs +5% to buy | dividends tick, rent multiplier, `quotePropertyPurchase` |
| Big Spender | Luxury items give +25% happiness | Market prices +10% | luxury happiness, `getItemPurchasePrice` |
| Hustler | Street pay +15% | Relationships fade 25% faster | street table, relationship decay ctx |

- [x] 1. `lib/mindset/effects.ts`: table, `mindsetEffects(state)` resolver (restless resolved there, heir trip history capped to this life), `describeMindsetEffects` / `mindsetEffectLines` generator (upsides first); `config.ts` cards generated, taglines state no numbers.
- [x] 2. Seams wired (tick and screen read the same function each): `careerPayMultiplier`, `applyCareerProgress` (player bonuses now their own rounded step - a 6.5-point week rounded a +15% Mindset AND the +10/15% Leadership life skill away), decay in tick + `vitalDrift`, `scaledHappinessGain` gainMult, `resolveInteraction` bond mult (calls/hangouts/dates), hangout/date/gift prices, neglect loss via `processWeeklyNPCDepth`, `quoteTrip` + `tripHappiness`, `getItemPurchasePrice` / new `getFoodPurchasePrice`, `luxuryItemHappiness`, dividends via new `dividendYieldModifiers` (the Stocks estimate ignored policy + Investing skill before), rent multiplier, `quotePropertyPurchase`. Street table: Optimist, Gambler, Risk Averse, Hustler only.
- [x] 3. UI: Perks cards (tagline + green/amber effect lines, hint copy, recommendations), IdentityCard Active Mindset (canonical reader, live restless line), heir screen says the Mindset is inherited; contact/date/luxury/travel/market/stocks screens show the adjusted numbers.
- [x] 4. Tests: `mindsetEffects.test.ts` (55: table, generated copy, street, resolver), `mindset/mindsetLifeSeams.test.ts` (26: every seam with vs without, 4 on the real tick). Soak `RUN_MINDSET_SIM=1 npx jest mindsetPersonas` (72 lives x 100 weeks): no Mindset dominates - each within ~10% net worth / ~3 happiness of none, trade-offs visible (Workaholic min health 46 -> 41).
- [x] 5. Full suite 930 suites / 11,034 pass (33 RUN_* skipped), both type-checks 0, lint 0 errors / 673 warnings, ui/content/routes OK.

# Full audit + ad revenue pass - 17 October 2026

Branch `claude/audit-polish-ads-2026-10-17` from `main` 094e4119 (2.15.6). Baseline: 879 suites / 10,321 tests pass; type-check, test types, lint, routes and content pass; weekly audit had one high (fixed below). Six audits ran (economy, tick stability, save, cleanliness, content, ad research); every item below was re-read in source before it was listed.

**Ads (owner request: what popular games do to maximise ad revenue, policy-safe only)**
- [x] Load reliability: retry 2-64 s backoff, no-fill never trips a breaker, one breaker per format (the failing interstitial slot no longer silences rewarded + banner), 55-min freshness, foreground refresh, load-on-tap with a 4 s wait, `placement` on `ad_shown` / `ad_rewarded`. `lib/ads/loadPolicy.ts`, `services/AdMobService.ts`, 12 tests.
- [x] Reward orb: no longer goes silent for the session after a courtesy grant - waits for a loaded ad and re-checks every 30 s. 2 tests.
- [x] Remove Ads blurb claimed "The reward orb keeps working" (the orb is hidden for payers); copy now matches.
- [x] "Report an Ad" row in Settings (App Review 2.5.18) - editable email draft, nothing sent automatically.
- [x] Daily reward doubler: opt-in "Watch ad: +N more gems" (cap 50/day), only when a real ad can show, never for payers; inherits the daily claim's game-week gate. 8 tests.
- [x] Year-end break: opt-out rewarded interstitial (+15 gems) at the in-game year boundary, with the 5 s intro + No thanks AdMob requires. Pacing: 2 years into a life, never in the first 2 min of a session, 3 min between fullscreen ads, 5 min after a chosen rewarded ad, 4 per session, never for payers or over a blocking modal; preloads 6 weeks ahead. iOS uses the committed "Ad-win" unit. 32 tests.
- [x] `EXPO_PUBLIC_ADMOB_REWARDED_INTERSTITIAL_ANDROID` / `_IOS` set in EAS production and GitHub secrets (2026-10-17); preflight fails a rewarded-interstitial unit left in the standard interstitial variable.

**Exploits / wrong state (P0-P1)**
- [x] Savings-goal reward farm (create/fund/withdraw repeat): one rewarded completion per week. 4 tests.
- [x] `vehicle_theft` "gone for good" kept the car and paid insurance: new `lose_vehicle` special. 2 tests.
- [x] Intro screen entered onboarding without a slot guard (weekly audit high).
- [x] Life moment: a refused cost still paid the reward - now one pure resolver in one updater (`lib/events/lifeMomentResolution.ts`).
- [x] Prestige reset shed family-business loans and wiped `dynastyStats`; rewind re-armed the daily login gems; checkpoint sidecar was never pruned; NaN saved as null loaded silently; prestige/new life reset sound/haptics/theme. All fixed, 35 save tests.
- [x] Street crime: caught attempts skipped the caps and a double tap could jail twice; one shared re-check now runs in both branches; bail scales with the sentence. 11 tests.

**Economy faucets (P1, measured by the economy audit)**
- [x] Company staff were a one-time $500 fee for a permanent income multiplier (30 hires paid back in 5.7 weeks): staff now draw the weekly wage the Contacts copy always claimed. 16 tests.
- [x] Pulse "viral this week" counted every viral post of the life (+$50/wk each, forever): this week's only. 4 tests.
- [x] Bitcoin halving fired on week 1 for every start age 22+ (absolute-week trap): first halving now lands 208 weeks into the life. 6 tests.
- [x] Company scandal: free apology was repeatable and a double tap charged Restructure twice: one response per scandal. 6 tests.
- [x] YouVideo subscribers compounded with no ceiling ($42k/wk at 208 weeks): conversion saturates (now $10.7k/wk). 9 tests.
- [x] Caught crimes kept the loot (a caught-but-successful attempt netted the take minus 10%): an arrest now pays nothing; the toast says the take was seized. 2 tests.
- [x] Property upgrade tiers were a flat $10k/$25k/$50k for appreciation on the FULL value (~830%/yr on an $8M penthouse): price is max(floor, value x 1%/2.5%/5%), unchanged at or under $1M. Charge, gate and Manage sheet read `getUpgradeTierCost`. 4 tests.
- [x] OWNER calls (owner said "do these", 2026-10-17; branch `claude/economy-owner-calls-2026-10-17`). Each re-measured in source before changing. Verified: full suite 10,997 pass / 32 skipped, both type-checks 0, lint 0 errors (673 warnings, ceiling 679), ui/content/routes gates OK, unseeded-randomness ratchet lowered 55 -> 37.
  - OWNER decisions left: Mindset effects are street-work only (wiring the original salary/travel/stock promises is a design job); jailed company owners still pay wages with no income; Legacy Pass paid capstone is now a Youth Pill bundle; Achievement Hunter (4,000 pts) can never repay its cost; a car bought near 100 reputation can lose a little on sale (exact refund needs a new field).
  - [x] Lobbyist post: $9k/wk (~5x the President) gated only on office rank 2. Now $4k/wk (below the board seat and the CEO rung); a take the player's reputation cannot cover is refused (take-then-resign at 0 rep minted +15); the offer list prices swaps like the tap. 15 tests.
  - [x] Prestige point value: the $100M -> $10M threshold cut (2026-03-09) left the 100 pts/$1M rate, so a threshold prestige paid 1,000 base points against a shop priced for 10,000 (median bonus 3 lives, legendary 7). Base points now anchored to the threshold: 10,000 at $10M, linear below, sqrt above, old rate as a floor. Bonus copy fixed (Wealth Magnet, Learner, Boosts, Life Master, Perfect Start); Family Business granted nothing with a carried business; dead-overlap bonuses flagged "No effect". 27 tests.
  - [x] Pulse brand deals: accept-everything paid $82k/wk at 50K followers and $15.6M/wk at 1M with ZERO posts (25% on accept + 75% streamed regardless of delivery, ~15x the event's rate, no stacking limit, outside the social cap). Now paid per delivered post (shares sum to the contract, accept pays nothing), $0.010-0.020/follower/post capped $10k/post. Old streamed deals honoured to expiry; old-rate offers withdrawn. 13 tests.
  - [x] Channel memberships paid after tax and outside the soft cap: payout computed before the tax, in the taxed cash line, soft-capped like ad revenue ($74,850/wk creator now pays $26,820). Idempotency stamp still written once. 7 tick tests.
  - [x] Fully upgraded factory nets ~$5k/wk at 10 staff: measured every type fully built; the factory is in line (57-week payback) - the RESTAURANT was the outlier ($400 wage = 3.4% of base, hired to 20, 38-week payback). A general employee now earns max(industry wage, 5% of base income), derived from the 11-20 headcount band. 20 tests.
  - [x] Follow-up: company payroll is now deducted from taxable income, capped at the week's company income (0 while jailed) - `companyPayrollTaxDeduction`. 8 tests incl. a real-tick A/B that fails without it. Left: jailed owners still pay wages with no income (design call).
  - [x] Follow-up copy: Cash Flow projects membership income (own row) and the payroll deduction (`calcWeeklyExpenses` `taxDeduction`); Help copy says brand deals pay per post.
  - [x] Fun/balance follow-up audit: 10 findings + 5 small ones, each re-read in source. Fixing:
    - [x] P1 Pet competitions: one entry per week across all pets, max 5 living pets, seeded roll inside the updater, best show worth ~$60/entry. 24 tests.
    - [x] P1 Legacy Shop heir bonuses: an heir with all 19 upgrades started identical to one with none (merge overwrote them). `applyHeirStartingBonuses` runs once after the merge, before dynasty Trial handicaps; intelligence upgrades now grant real completed degrees. "Prestige Points Master" measured the spendable balance and now completes on the first prestige - it now counts lifetime prestige points to 100,000. 25 tests.
    - [x] P1 A bought home can't be moved into later: "Make this my home" on the Manage sheet (`canMoveIn` verdict shared by button, hint and action), stopping a rental moves a homeless owner back in, buy toggle defaults ON for the homeless. Sale dialog now itemises closing costs + gains tax from `quotePropertySale`, the function the sale pays with. 29 tests.
    - [x] P1 Mindset: every mindset now has one real street-work effect applied inside `performStreetJob`'s updater (one table, `lib/mindset/streetWork.ts`) and copy that states it; the second post-job write (paid on refused taps, Gambler used Math.random) is gone. OWNER: wiring the original salary/travel/stock promises is a bigger design job. 48 tests.
    - [x] P1 Traits panel: lines built from the real rules; scenario traits now apply (fit +20 fitness, smart hacking 2, criminal record level 2, caring child bond 90, tough/disciplined/determined street-work effects). 27 tests.
    - [x] P2 Job applications: a pending application is now REVIEWED (seeded roll at its real odds) and a failure is a rejection with an actionable reason; both rolls read one `jobApplicationOdds`. Entry tier (fast food, janitor, retail...) bases at 80% (96% over both draws), skilled careers at 50% - measured: at 50 the average-worker persona missed the entry-ladder gate and the loner's happiness gate (unemployed weeks). The clean criminal level 1 no longer costs 5 points (every life paid it, and it made the attempt-5 guarantee unreachable). Early-career boost counts from the FIRST start in this life, so quit-and-rehire cannot re-arm it. 33 tests.
    - [x] P2 Vehicle buy/sell reputation: sale removes the full bonus (floored at 0); pilot/driver licence + reputation floor enforced on `resolveBuyVehicle`. 25 tests.
    - [x] P2 Contact loans: lent cash repayable after 4 weeks, one loan per contact; borrowed cash due in 8 weeks, collected by the WEEKLY TICK (cash first, rest to overdueBalance, -15 bond). 20 tests + 2 real-tick tests.
    - [x] P2 Street-job rank: `getStreetJobTerms` drives payout and card; +5%/rank capped at rank 4. 8 tests.
    - [x] P2 Rewind re-opens achievement / chapter / weekly-challenge rewards: `carryClaimLedgers` unions the claim ids from the live life (achievements both gates, chapters, the same weekly-challenge instance). Ambition claims deliberately not carried (their points rewind with the snapshot). Residual: a claimed challenge that has since rotated away is not recorded anywhere.
    - [x] P3 Sale dialog itemised (see home item); disease recovery keeps fractional progress so Resilience/single-stat bonuses shorten illness; Legacy Pass paid capstone "Heritable Legacy Trait" did nothing (activeTraits has no reader, not carried) -> now a Youth Pill bundle (OWNER: paid-track reward change); Long Road moves weeksLived + every seed-stamped marker without counting played weeks, and ages the family; dynasty goal reads `getPrestigeThreshold`.
- [x] Discord reward finalized when the save failed (saveGame RESOLVES false): all three sites check the result. 4 tests.
- [x] v54 migration: career salaries, street pay and item prices stored by value now take the 2026-08 rescales; pre-Program-8 saves get a deterministic `lineageId`. STATE_VERSION 54, docs synced.
- [x] Zero-stat death counter counted weeks that ended above zero (pets etc. add health after it was decided), so a life could die with no HUD warning. Verified the new test fails without the fix.
- [x] Mail: an event-backed letter was stamped "answered" for a choice the event then refused. 2 tests.

**Content that contradicts its copy (P1)**
- [x] Failed vote enacted the bill; gambles previewed their result; treatment was the worst choice; unaffordable choices failed silently (now "Need $X", never a soft-lock); job offer promised a raise; "invest" choices only lost; duplicate event ids; diet plan charged week 1 twice; raw ids and "/month" copy.
- [x] Impossible achievements retargeted to what exists (ids kept); political achievements unlock at the right office.

**Cleanliness / display (P2)**
- [x] Deleted 4 zero-importer modules and the broken `test:comprehensive` (ts-node not installed) with its 2 files; `as any` now enforced in 64 of 65 `lib/` dirs; AGENTS.md save version.
- [x] Journal / welcome-back showed the absolute week ("Week 365" on an age-25 start); now life-relative. 3 tests.
- [x] Hobby happiness skipped the diminishing-returns curve (and the audit). 1 test.

# DeepLife Glossy asset style frame - 5 October 2026

## Internal TestFlight candidate - 10 October 2026

- [x] Build 2.15.2 (191) from PR #233 / `680a7a51` via GitHub Actions run [38056456464](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/38056456464). Verification, macOS build and TestFlight upload all passed; App Store Connect accepted the upload.
- [ ] Confirm Apple processing shows the build as `VALID` in App Store Connect, then run native iPhone/iPad acceptance for the current source. The ASC page required login in this session, so processing status is not verified. [Dated evidence](release/evidence/testflight-2.15.2-2026-10-10.md).
- The PR is still open and unmerged. This is an internal QA upload; no production OTA or public App Store release was triggered.

- [x] Owner approved corrected grounded work/MacBook preview. Reviewed theme consistency and mapped mounted asset consumers. [Rollout review](modern-theme-rollout-2026-10-05.md).
- [x] Implemented Work Career thumbnails (food service, office, study) through existing JobCard/SceneCard. Focused tests, types, lint and compact/tablet browser checks pass. [Evidence](work-modern-2026-10-05.md).
- [x] Aligned Home identity/divider surfaces and removed shared button glass/glow. Compact and tablet layout bounds unchanged; navigation and 12 focused tests pass. [Evidence](home-modern-2026-10-05.md).
- [x] Grounded contextual art integrated in Education, Contacts, Hustle and Health. Eight phone/tablet browser cases, source types and lint pass. [Evidence](context-modern-2026-10-06.md).
- [x] Revised Start/Legacy heroes prepared for Group D review; four matching scenario cards now use approved props with contain framing. Six flow tests, source types/lint and phone/tablet selection checks pass. [Evidence](entry-modern-2026-10-06.md).
- [x] Owner rejected static wallet/album slides as boring. Built an interactive three-chapter UX proposal with direction choices, weekly story reveals and a people-focused legacy; six browser layouts and keyboard/reduced-motion checks pass. [Preview and evidence](immersive-entry-2026-10-06.md).
- [x] Owner authorized integration. Replaced placeholder logo with actual app icon in preview and app; added skippable interactive Custom life opening leading to existing Scenarios/Identity. Quick Start and Continue preserved. 74 focused tests and three browser sizes pass. [Evidence](entry-integration-2026-10-06.md).
- [x] Completed entry-art batch: 11 new studio props, all 69 life-path/challenge/perk/mindset options mapped; SaveSlots solid framing and refresh-loop fix. 152 focused tests, source/test types, lint and phone/tablet journeys pass. [Evidence and art review](entry-art-completion-2026-10-06.md).
- [x] Profile/reward framing and Apps launcher materials aligned: approved metal rarity badges, trophy/crown renders, solid navy toast/tiles. 49 focused checks and phone/tablet Profile, achievement-sheet and launcher journeys pass. [Evidence](profile-celebration-modern-2026-10-06.md).
- [x] Completed individual achievement artwork for all 159 catalogue IDs. Original PNGs, 512px runtime WebPs and stable-ID mappings are complete; source/runtime transparency, catalogue counts and all map/file references were audited. [Full 159-art gallery and validation](achievement-art-completion-2026-10-10.md). Phone/tablet browser layout and all 159 runtime image loads verified; native-device acceptance and release checks remain separate. [In-app evidence](release/evidence/achievement-art-in-app-acceptance-2026-10-10.md).

- [x] Create three Blender/Cycles style icons, linked studio, PNG/GLB exports and navy/light 48px/160px review sheet. [Evidence](astra-gate1-2026-10-05.md).
- [x] Owner approved Gate 1; completed all 12 Group A icons and passed file/geometry/alpha checks. [Gate 2 evidence](astra-gate2-2026-10-05.md).
- [x] Owner approved Gate 2; six tiers and five badge-kit assets completed, including platinum/laurel/100 preview. [Gate 3 evidence](astra-gate3-2026-10-05.md).
- [x] Owner selected front-facing badges with clean centered numbers. Rebuilt all four finishes and laurel; preserved Group A/B exports; validation passed.
- [x] Owner approved Gate 3 with skinny matching-metal numerals. Three Group D heroes and 390x844 phone previews completed; alpha, geometry, exports and reserved bands pass. [Gate 4 evidence](astra-gate4-2026-10-05.md).
- [ ] Gate 4: owner rejected the toy-like artwork/scenes. Owner approved the grounded work direction. Completed requested powered silver MacBook and bag clearance corrections; revised phone preview ready. Remaining heroes still need this direction. Do not advance to loops or intake. [Pilot evidence](astra-grounded-hero-2026-10-05.md).

# Gem wallet and contextual work art - 28 September 2026

- [x] Centered HUD gem text; replaced the read-only popup with Top up / Spend gems using existing IAP and upgrade owners. Added ten original matching 3D props and compact action-specific Work art. [Changes, screenshots and verification](gem-wallet-work-art-2026-09-28.md).
- [ ] Verify this change on the next signed iPhone/iPad candidate: Larger Text, gem IAP purchase/cancel/retry and persisted balance. The previous 2.15.0 build does not contain these edits.

# Authorized TestFlight candidate - 27 September 2026

- [x] Uploaded all current work and started the macOS local TestFlight workflow for **2.15.0**, pinned to 875b63a2 after preflight, quality, full tests and coverage passed. [Run 36352338525](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/36352338525): verification in progress; compilation/submission/Apple processing pending. [Execution checklist](testflight-2.15.0-2026-09-27.md).

# Current audit count - 27 September 2026

- User-reported remaining count: **0**. This supersedes earlier 40/26 counts; historical findings and native acceptance evidence remain separate.
- [ ] Native creator keyboard/Larger Text verification: UNREACHED; local and connected remote hosts are Windows, no iPhone/iPad or iOS simulator access detected. [Prepared device protocol and evidence](release/evidence/creator-native-acceptance-2026-09-27.md). Next: connect a native candidate or run a user-assisted device session.
- [x] Character creator layout: tighter categories with 44-point targets, scalable two-line option labels, Next/Done name entry and tablet identity columns. [Evidence and screenshots](release/evidence/character-layout-2026-09-27.md). Native text/keyboard acceptance remains open.

# Audit fixes - 26 September 2026

- [x] Implement D01-D06 and D12: mutex-owned prestige, durable celebration/retry, strict money entry, committed campaign feedback and life-relative planning/Profile counts.
- [x] Verify 40 focused regressions and capture compact phone/tablet changes.
- [x] Save/finance CI: 826 suites / 10,047 tests / 308 snapshots; preflight and quality passed. Further UI follow-through: 26 focused tests and source/test types pass; results in [fix evidence](release/evidence/audit-fixes-2026-09-26.md).
- [x] D07/D08/D10/D11: Pulse identity, enrollment contrast, locked-control semantics and reduced motion. Family target is 44 points high.
- [x] D09/D13/D14: separate 44-point gem controls, life-relative record labels and canonical career requirement names. 22 focused tests, source/test types and compact/tablet browser evidence pass. [Evidence](release/evidence/audit-labels-2026-09-26.md).
- [x] V01 compact Home: first goal is 80px higher and fully visible at 375x667; first-job CTA remains 44px. 17 focused tests, source types, lint and phone/tablet checks pass. [Evidence and screenshots](release/evidence/home-compact-2026-09-26.md).
- [x] V02 Work: first eligible Apply is 80px higher and visible at 375x667; salary, requirements and 44px action retained. 17 focused tests, source types, lint and browser interactions pass. [Evidence](release/evidence/work-compact-2026-09-26.md).
- [x] V03 Life: first activity is 347px higher and fully visible at 375x667; compact vitals retain icons/values and expand on demand. 46 focused tests, source types, lint and browser interactions pass. [Evidence](release/evidence/life-compact-2026-09-26.md).
- [x] V04 Profile: achievements are 521px higher at 375x667; compact portrait, life stats disclosure and optional catalogue prioritize progress. 22 focused tests, source types, lint and browser interactions pass. [Evidence](release/evidence/profile-hierarchy-2026-09-26.md).
- [x] V05 creator: portrait controls are 233.5px higher at 375x667; compact preview, plain surfaces, optional aging and a footer that reserves space. 59 focused tests, source types, lint and portrait/custom draft interactions pass. [Evidence](release/evidence/creator-layout-2026-09-26.md).
- [x] V06: one illustrated family for portrait presets, custom avatars and NPCs; aging, stored DNA and reduced motion preserved. 172 focused tests pass. [Evidence and screenshots](release/evidence/avatar-family-2026-09-26.md).
- [x] V07: five original fictional media illustrations shared by YouVideo and Streaming; 48.8% smaller cover files. 34 focused tests and browser upload/stream journeys pass. [Evidence and screenshots](release/evidence/media-identity-2026-09-26.md).
- [x] V07 revision: bold creator thumbnails, compact red YouVideo composer and violet Streaming console with primary actions visible at 320/375/768px. 40 focused tests pass. [Evidence and screenshots](release/evidence/creator-platform-2026-09-27.md).
- [x] Creator UI cleanup: all topics visible, compact reach disclosure, no duplicate status card and stable Streaming selection. 7 focused regressions and 320/375/768px browser journeys pass. [Evidence](release/evidence/creator-ui-cleanup-2026-09-27.md).
- [x] V08 pet/travel/vehicle batch: 52 local illustrations, shared loading fallback, approved design pinned in AGENTS/presentation guide. 43 focused tests and phone/tablet browser journeys pass. [Evidence and gallery](release/evidence/life-art-2026-09-27.md).
- [x] V08 complete: all 12 luxury items now match the illustrated catalogue family; 83.8% smaller art files. 32 focused tests and phone/tablet purchase/collection checks pass. [Evidence and gallery](release/evidence/luxury-art-2026-09-27.md).
- [x] V09 Stocks: securities start 270px higher on compact phones; sector disclosure retains filters. 27 focused tests, source types and three-width browser interactions pass. [Evidence and screenshots](release/evidence/stocks-hierarchy-2026-09-27.md).
- [x] Stock curves: distinct seeded illustrative charts from startup, rounded strokes, real quotes/change preserved. 18 focused tests, source types and phone/tablet revisit checks pass. [Screenshots and evidence](release/evidence/stock-curves-2026-09-27.md).
- [x] V10 Finances: one compact overview and canonical assets/debts breakdown; accounts 206px higher in Bank and 994px higher in Bank Pro at 375px. Banking and recorded-history checks pass. [Evidence and screenshots](release/evidence/finance-hierarchy-2026-09-27.md).
- [x] V11 tabs: visible 44-point overflow controls, active-tab reveal on resize, natural-width Travel labels and wrapping fixed labels. 8 focused regressions and Bank/Travel browser journeys pass. [Evidence and screenshots](release/evidence/tab-overflow-2026-09-27.md).
- [x] V12 currency/units: canonical Health, Work, Statistics and pilot-license prices; explicit weekly/per-job units, corrected weekly salary record. 65 focused tests and phone/tablet checks pass. [Evidence and screenshots](release/evidence/currency-units-2026-09-27.md).
- [x] V13 Education: Enroll free for zero-cost/fully funded courses, exact weeks throughout and named automatic classes; paid commitments remain explicit. 23 focused tests and phone/tablet enrollment flows pass. [Evidence and screenshots](release/evidence/education-copy-2026-09-27.md).
- [x] V14 Contacts: visible costs/effects, borrowing and lending obligations, weekly/affordability/max-bond reasons and preserved family eligibility. 26 focused tests and phone/tablet journeys pass. [Evidence and screenshots](release/evidence/contacts-clarity-2026-09-27.md).
- [x] V15 Pulse: 30 authored public posts drawn without repetition, plus context-aware contact voices from actual recent events/interactions and mood/personality. 32 focused tests and phone/tablet feed checks pass. [Evidence and screenshots](release/evidence/pulse-personality-2026-09-27.md).
- [x] V16 Navigation: one leading Back/title layout across app headers; shared 44-point Back in DeepMail root/detail with accurate destination labels. 38 focused tests, source/test types and phone/tablet navigation checks pass. [Evidence and screenshots](release/evidence/navigation-consistency-2026-09-27.md).
- [x] V17 Typography: Company Detail/cards and five shared component families use canonical text styles, wrapping metadata and 44-point action/disclosure targets. 32 focused tests and 320/375/768px company journeys pass. [Evidence and screenshots](release/evidence/typography-cleanup-2026-09-27.md).
- [x] V18 Semantic colors: fixed cash identity across 15 headers, HUD-aligned pet vitals, explicit signed weekly effects and neutral zero/empty summaries. 30 focused tests, source/test types and phone/tablet adoption checks pass. [Evidence and screenshots](release/evidence/semantic-colors-2026-09-27.md).
- [x] A01 browser/source pass: retained perk/mindset drafts, rejected non-finite scenario inputs and verified portrait/custom start-save-reload on phone/tablet. [Evidence and screenshots](release/evidence/custom-onboarding-2026-09-27.md). A01 native/permutation acceptance remains open.
- [x] A02 browser/source pass: corrected delayed-hire records, rehire tenure/pay notices and termination history; first pay, promotion, quit/reapply and retirement regressions pass. [Evidence and screenshots](release/evidence/career-lifecycle-2026-09-27.md). Native/permutation acceptance remains open.
- [x] A03 browser/source pass: synchronous Next Week guard, completion-owned busy state, committed-progress ad gating, pending-decision suppression and reduced-motion loading. 64 focused regressions and phone/tablet rapid-tap checks pass. [Evidence and screenshots](release/evidence/weekly-loop-2026-09-27.md). Signed native acceptance remains open.
- [x] A04 browser/source pass: free recovery leads at critical health; treatment/Rest guidance and active-diet affordability/cancellation clarified; badge overlap fixed. Focused regressions and phone/tablet recovery at $0 pass. [Evidence and screenshots](release/evidence/health-recovery-2026-09-27.md). Native/permutation acceptance remains open.
- [x] A05 browser/source pass: owned/shortfall guidance, access-item sale confirmations, canonical resale labels and creator equipment cash gates. 47 focused tests and phone/tablet inventory save-reopen checks pass. [Evidence and screenshots](release/evidence/market-equipment-2026-09-27.md). Native/permutation acceptance remains open.
- [x] A06 source/browser pass: full-balance withdrawals, minimum-balance caps, overdraft/cash-ceiling protection and navy notifications above navigation. 267 focused tests and phone/tablet deposit-reopen checks pass. [Evidence and screenshots](release/evidence/banking-lifecycle-2026-09-27.md). Full-suite/device gates recorded separately; native/permutation acceptance remains open.
- [x] A06 banking follow-through: complete money parsing, debt-capped repayment Max, clear recurring bills and accessible forms. 86 focused tests and phone/tablet account, card, loan and bill journeys passed. [Evidence and screenshots](release/evidence/banking-journeys-2026-09-27.md). Native and broader delinquency permutations remain open.
- [x] A07 source/browser pass: strict stock/crypto amounts, pending-order commitments, recurring-buy clarity and weekly labels. 230 focused tests and phone/tablet buy/sell/cancel, save-reopen, real weekly recurring-buy and offline-loaded mining journeys passed. [Evidence and screenshots](release/evidence/trading-lifecycle-2026-09-27.md). Native/permutation acceptance remains open.
- [x] Money-entry sliders: shared drag/preset/Max control across player money forms, including banking. 164 distinct focused tests with Education; phone/tablet stock and account-opening checks passed. [Screenshots and evidence](release/evidence/amount-sliders-2026-09-27.md). Native acceptance remains open.
- [x] A08 source/browser pass: study costs/readiness, pause guidance and withdrawal confirmation; student-loan continuity and real weekly graduation verified on phone/tablet. [Evidence and screenshots](release/evidence/education-lifecycle-2026-09-27.md). Native/permutation acceptance remains open.
- [x] A09 source/browser pass: committed founding/hiring/IPO/acquisition feedback, exact offer amounts, severance confirmation, protected named headcount and fresh-state transaction guards. Phone/tablet founding, research, real-week campaign progression, sale and low-resource checks passed. [Evidence and screenshots](release/evidence/business-lifecycle-2026-09-27.md). Full-suite timing and native/permutation gates are recorded separately.
- [x] A10 transaction/family-planning pass: fresh-state date/gift/wedding gates, one-time engagement cancellation, shared conception eligibility and explicit birth-cost confirmation. Phone/tablet conception, cancellation and save/reopen passed. [Evidence and screenshots](release/evidence/relationships-family-2026-09-27.md). Full-suite/native results and remaining feedback work are recorded there.
- [ ] Next: A10 committed relationship feedback and remaining family journeys, then A11 Pets. [Remaining register](whole-app-audit-2026-09-26.md): 26 acceptance/operational items remain open, including native acceptance.
- No production deployment or signed native acceptance.

# Whole-app audit - 26 September 2026

- [x] Audit current source, 5 tabs / 19 app entries, nested/onboarding states and core save/game logic.
- [x] Compile [58-item prioritized register](whole-app-audit-2026-09-26.md) with screenshots, reproductions and native acceptance gaps.
- [x] Original D01-D14 implementation follow-through is recorded above; the audit below remains historical evidence.
- Audit only; no gameplay fix or production release performed. Current code CI: 822 suites / 10,016 tests / 308 snapshots passed.

# HUD circle edge refinement - 26 September 2026

- [x] Replace nested rounded clipping with inset vector circles; retain icons and hit targets.
- [x] Check phone/tablet browser renders and focused HUD tests.
- [ ] Verify the curves on a signed iPhone build.
- Evidence: [circle edges](release/evidence/hud-circle-edges-2026-09-26.md).

# Reddit promotion - 26 September 2026

- [ ] 27 September additional posts: concise player copy prepared and MobileGames rules screened; verify 14-day account interval and publish after Reddit login. T3 signed out; Chrome navigation times out. [Drafts and status](../marketing/reddit-player-posts-2026-09-27.md).
- [x] 27 September: reviewed all three public posts, identified the direct criticism of formulaic AI copy, and prepared a shorter player campaign plus 20-second footage brief. [Campaign and evidence](../marketing/reddit-next-campaign-2026-09-27.md).
- [ ] Capture first-job gameplay from a verified public build before the next campaign; current local UI changes are not proof of store availability.
- [x] Published and verified new r/SideProject retrospective and r/aigamedev AI-development discussion; shortened playmygame involvement line and replied to onboarding feedback. [Evening evidence](../marketing/reddit-posts-2026-09-26-evening.md).
- [x] Screened r/MobileGaming and r/indiegames and skipped them under their live promotion/AI rules. Stop further repeat promotion today; respond to real feedback first.
- [x] Prepare transparent r/tycoon announcement and inspect today's iOSGaming rules.
- [x] Published r/playmygame post `1wqv57a` through logged-in Chrome; permalink and initial moderation state verified.
- [x] Reviewed viral LifeSimulators thread: [findings and revised copy](../marketing/reddit-viral-review-2026-09-26.md). Further posts wait for this evidence to inform content; historical bugs are not current-build findings.
- Copy and evidence: [selected promotion](../marketing/reddit-selected-2026-09-26.md).

# Whole-game polish follow-through - 26 September 2026

- Cleaned HUD utility circles per screenshot: one round surface, no inner bloom;
  gold store keeps its footprint without an expanding pulse.
- Settings now leads with preferences, uses shared tabs, has clearer switches and
  a compact header. Slot switching awaits a durable save and explains failure.
- Shared modal, button, app-header, stat-strip and empty-state refinements;
  Contacts/Mail/Hustle polish, specific Market labels, and direct-link lock checks.
- Browser: all five tabs and all 19 app entry screens at compact phone/tablet sizes;
  computer purchase survives save-slot switch/reload. Isolated QA fixture labelled.
- [Acceptance inventory and evidence](release/evidence/game-polish-2026-09-26.md).
- Next: nested transaction/player journeys and native accessibility/provider
  acceptance. No merge, OTA, paid build or store submission performed.

# Identity refinement ? 2026-09-26

- Implemented original street-line artwork across menu, player record and compact destination strips; removed generic motivational copy and oversized title badges. Approved HUD and save schema 51 unchanged.
- Evidence: [identity checklist](deeplife-identity-2026-09-26.md), [remaining work](visual-ux-remaining-2026-09-26.md). Signed-device acceptance is still outstanding.

# Current work

## Premium presentation, characters, 3D destinations and audio - 26 September 2026

Branch `codex/visual-ux-rebuild-2026-09-26`, based on current main `9e729ac2`.
[Checklist](visual-ux-rebuild-2026-09-26.md) and
[evidence](release/evidence/visual-ux-rebuild-2026-09-26.md).

- [x] Shared presentation tokens/primitives, five-tab navigation and main-screen polish.
- [x] Six curated GPT portraits; preserve custom avatar codec, genetics and old saves.
- [x] Six original 3D destinations, bundled renders, reduced-motion-aware movement.
- [x] Seven original sound effects, real Settings switch and committed-week feedback.
- [x] Browser phone/tablet inspection, creator modes, portrait save/reload, Bank and week feedback.
- [x] Production iOS export: 4,051 modules, 13.7 MB Hermes bundle, exit 0.
- [x] Full-suite evidence and focused follow-up (16 suites / 141 tests) recorded; draft PR #229 opened.
- [x] Complete local preflight exits 0; GitHub preflight/quality green on code `fe47c98f`.
- [x] Final-head CI on `1a95a49b`: 821 suites / 10,011 tests / 308 snapshots; coverage, preflight and quality pass.
- [ ] Complete remaining product polish and native acceptance: [prioritized next work](visual-ux-remaining-2026-09-26.md).
- [ ] Exact signed native build acceptance: audio/silent switch/interruption,
  VoiceOver/Larger Text, compact iPhone/iPad, purchases/restore/ads, old saves and
  background/kill/relaunch. No paid build, OTA or submission authorized here.

Prior local work remains in named stash `pre-sync-local-work-2026-09-26`.
Do not pop it into the presentation branch. Schema remains 51; HUD structure,
canonical weekly/save/purchase owners and production release state are unchanged.

## Purchases lost on reload (YouVideo, App Store 1.2.5 CA) — 25 September 2026

Branch `claude/intelligent-davinci-386ee7`. `saveGame()` read `gameStateRef`,
which a post-commit effect refreshes, so `setGameState(...); saveGame()`
persisted the PRE-action state; "Switch save slot" then suspends autosave and
a reload drops the purchase.

- [x] Failing provider-level test: action + `saveGame()` in one handler → persisted payload and a reloaded slot contain the action (on `main`: `microphone: false` on disk).
- [x] Fix in `saveGame`: wait for the commit that carries every update dispatched before the call, then read. No per-call-site patches, no save-format change.
- [x] Keep R3-S1 and the slot pairing safe (a load committing inside that wait must not be written into the previous slot). Mutation-checked: guard off → slot 1 overwritten.
- [x] Save + integration (53 suites / 587), stress + startup (55 / 908), full suite on the merged tree (816 / 817; the red one is the wall-clock tick benchmark, also red on `main` on this Windows machine, A/B shows no cost). Type-checks 0. Lessons entry written.
- [x] `npm run preflight`: `main` was at 703 lint warnings against a 701 ceiling (two new `require()`s in `lib/review/__tests__/inAppReview.test.ts`, from #220). Fixed with the repo's line-level disable convention rather than raising the ceiling.
- [ ] PR with the save-system risk box; watch CI's tick-timing number against `main`'s 3.98 ms/tick.
- [x] Follow-up implemented on PR #229: Settings saves durably before suspending for the slot picker. Provider regression and real browser computer-purchase/switch/reload verified.
- [ ] Follow-up (not this PR): drop the now-redundant `setTimeout(0)` / 200 ms pre-save yields (home, work, DeathPopup, Discord grant, restoreFromCloud, resolveEvent).

## Home freeze + four-lens audit — 25 September 2026

Branch `claude/great-davinci-cr2nh8`. Report: [home-freeze-and-audits](home-freeze-and-audits-2026-09-25.md).

- [x] Reproduce the Home freeze statically and dynamically (no render loop; Modal handoff identified).
- [x] Interruption queue: handoff settle gap, no preemption of a presented Modal, orb sheet holds the slot, popup close fallbacks.
- [x] Gameplay: hidden gamble outcomes, lost karma, first-job tenure, friend-only social events, wedding gate.
- [x] UX: HUD quick actions, market toasts, recap count, coach anchor/copy, save-slot weeks.
- [x] Perf/stability: root layout + ticker narrow subscriptions; repairs on clones.
- [ ] Verify the freeze fix on an iOS device (welcome back → daily reward on a new day).
- [x] Android save budget raised (64 MB), subscription lookup fixed, exams per life, store metadata 1.6.0 + data safety, version 2.15.0.
- [ ] Run `tasks/release/MASTER-PROMPT-growth-revenue-local.md` in a local session with Claude in Chrome: ship 2.15.0, launch Android, grow revenue.

## Banner impression measurement — 24 September 2026

- [x] Reproduce missing RevenueCat display events from banner paid callbacks.
- [x] Report display/revenue with the same impression ID, preserving refresh uniqueness and failure isolation.
- [ ] Inspect final-head CI and verify delivery on the exact signed iOS candidate; existing native gates remain open.

Evidence: [banner measurement](release/evidence/banner-impression-measurement-2026-09-24.md). No ad frequency, pricing or consent changes; no deployment.

## Owner review pass - 18 September 2026

Branch `codex/restore-precompact-hud` (built on `1e766685`, v2.13.0, schema 51),
not pushed. Owner-directed fixes plus MP08/MP09:

- Restored the pre-compact two-column HUD (`TopStatsBar` from `421e2008`),
  removing the compact disclosure layout the owner rejected.
- Replaced the flat HUD discs with a shared `LiquidGlassDisc` material (body +
  accent bloom + faint sheen), removing the season disc's 1px white border that
  anti-aliased into rim crescents. Kept gradient-free to hold the UI ratchet.
- Added a left-edge `RemoveAdsOrb` that deep-links to the shop's No Ads
  purchase; gated off when ads are removed or IAP is disabled.
- Work job cards now name their toll (`Happiness -3` / `Health -2`).
- MP08: wallet forecast excludes crypto-paid mining power, labels projected rent
  as an occupancy estimate, and settles standing arrears; property/loan sheets
  show upfront cash deltas (education already did).
- MP09: the recap's promotion badge opens Work.
- Weekly audit burned down to fully clean: typed the `WeekContext` test fixture,
  deleted three dead modules, and removed all 54 `as GameState` test casts
  (factory / named sub-types / one DELIBERATE-CORRUPTION marker).
- MP11: three connected story arcs (work pressure, family plans, side project),
  each a setup + two responses + a weight-0 delayed-consequence sequel, via the
  declarative `followUpEventId` API.
- MP12: bond support now scales by band (close 1, trusted 2, confidant 95+ 3)
  with the +3 ceiling unchanged, so depth beats headcount at the top of the
  ladder instead of only at the bottom.
- MP13: three non-wealth life capstones (family, career, community) recognise a
  completed path at death and pay legacy points into the next life, named on the
  death screen. Existing currency, no new save field.

Verification: source + test type-checks clean, eslint 0 errors, lint ratchet OK,
UI ratchet at ceilings, route check OK, weekly audit fully clean. Full suite
804 suites / 9881 tests / 308 snapshots green. PR #215 open with all checks
(`update`, `quality`, CodeRabbit) passing; not merged.

Next: no in-repo defects outstanding from the review; remaining work is product
(MP10-MP13) and the external release gates R04/R06/R07/R08/R09/R10.

## TestFlight lint repair - 12 September 2026

Run 34655502072 failed on seven missing asset-tool imports, not the 700 warnings.
Install the asset project's locked dependencies before lint in all four affected
build workflows, matching EAS Update/preflight. YAML/order checks pass; local
lint and latest PR results are recorded in the repair PR. A fresh build run must
use the corrected workflow revision; no native build is verified by this repair.
Evidence: [TestFlight tooling](release/evidence/testflight-tooling-2026-09-12.md).

## Discord player notes - 12 September 2026

Replace linked PR titles with authored, playful player notes from the PR's
`Player update notes` section. Skip technical-only merges; keep upcoming versus
live wording honest. Strip GitHub links from release copy too. Offline tests and
lint results are in the PR; no Discord messages sent or edited.
Evidence: [player notes](release/evidence/discord-player-notes-2026-09-12.md).

## Five-point follow-up — 11 September 2026

- [x] Investigate repair signals and synthetic old-save continuity; no repeated repair reproduced. Historical player cause remains unknown; diagnostic denominator added.
- [x] Correct screen/week tracking and label purchase-flow quotes without inventing revenue. Signed-build revenue reconciliation remains open.
- [x] Improve the existing return journey with a concrete goal and next action.
- [x] Explain active premium benefits truthfully, including trial limitations.
- [x] Decompose the matched-week Apple download decline by Search/Browse before store edits.
- [ ] Verify focused regressions, UI evidence, full relevant gates and latest PR checks.

Baseline: origin/main 67528146, no open PRs. Work branch:
codex/retention-measurement-followup. No store edits, production publish or paid build.
Evidence: [five-point follow-up](release/evidence/five-point-followup-2026-09-11.md).
Next external acceptance: rebuilt signed candidate for screen telemetry, consent,
purchase/restore, real old saves and native accessibility. No measured retention
or trial-conversion uplift is claimed yet.

## Provider statistics audit — 11 September 2026

Read-only Firebase/GA4, RevenueCat and App Store Connect review completed for
acquisition, trial outcomes, measured retention, monetization and reliability
signals. Private dated evidence is stored outside this public repository at
`../DeepLife-statistikaudit-2026-09-11.md`; do not publish its business metrics.
PR #211 is merged; main watcher checkpoints now persist; no open PRs at review.
Next: segment save-repair signals by app/save version and reproduce old-save
hydration before making a fix. Then reconcile screen/week/purchase measurement
with consent and transaction deduplication preserved. Native performance,
provider billing/AdMob reconciliation and signed-device release acceptance
remain unverified. No runtime or provider configuration changes in this audit.

## Discord watcher repair — 11 September 2026

Observed run 34578762105 repeatedly seeds both baselines and then reports no
state change: git diff ignores the new untracked checkpoint files. Plan: stage
before comparing, persist with tested Git helper, serialize watcher commits,
show explicit no-post/sent outcomes, verify and prepare PR. Do not backfill old
announcements or send test messages without the owner's explicit message scope.

## Post-merge continuation — 10 September 2026

PR #209 merged as `4046365e`; its four final CI gates passed. Main production
update and support deployment were running when this task started. No open PRs.
Current plan: close the observed missing analytics permission refresh on return
from iOS Settings; test denied/error/rapid lifecycle transitions, run preflight,
record evidence and prepare a separate PR. Native consent, cached ad requests and
the designated deletion rehearsal remain explicit acceptance cases.

Evidence and exact device steps: [R11 resume consent](release/evidence/R11-resume-consent-2026-09-10.md).
Focused verification: 5 suites / 40 tests passed. Policy revision 3 is now live,
verified directly after the successful support deployment. Native defaults still
require a rebuilt binary; a main OTA does not supply them.
The owner can run an iPhone rehearsal on a fresh installation with no real
purchases. Next after this PR's CI: reconcile and prepare the exact signed build
and its TestFlight instructions. The local standalone EAS CLI is unavailable;
no new cloud build or submission has been dispatched.

## Priority execution — 10 September continuation

Current bounded plan: add a player-reviewed deletion request with existing
provider IDs only; verify unavailable/failed SDK paths, no provider initialization
or consent changes, compact/tablet presentation and final PR checks. Provider
deletion rehearsal and signed-device consent remain separate acceptance gates.

- [x] Refresh main, PR #209 and its successful final-head checks.
- [ ] R11: reconcile actual App Privacy/provider settings with the code data/consent map.
- [ ] R04: exercise remaining journeys, reproduce and fix reachable player defects.
- [ ] R08/R06/R09: resolve candidate identity and available native acceptance access.
- [ ] R07/R10: prepare exact metadata/submission evidence, retaining unresolved gates.
- [ ] Verify changes, update the review branch and inspect final checks.

Continuation evidence: [privacy/provider reconciliation](release/evidence/R11-privacy.md)
and [actual TestFlight candidate](release/evidence/R08-candidate-2026-09-10.md).
Isac Molin is the owner-confirmed individual operator in Sweden; Molin Inc. is
an unregistered project name. The owner monitors support and reports no prior deletion
requests. A researched deletion procedure is drafted, not yet adopted. Local work adds
fail-closed ATT and UMP ad-request gating. A follow-up adds separate optional usage
analytics, default denied native purposes and withdrawal handling. Its full local
run caught one eager-storage startup import; fixed, then six focused suites / 40
tests passed. Final-head CI must confirm the full suite. These Firebase defaults
require a new native build. Latest native
upload is 2.14.0 (186), older than these fixes.
Full local verification: 787 suites / 9,822 tests / 308 snapshots pass, preflight
exit 0, zero source/test type and lint errors. Analytics property 545257707 has
2-month event / 14-month user retention (activity reset on); its iOS stream
reports missing consent signals. The optional control passed web phone/tablet
inspection, opt-in persistence and withdrawal persistence. Next: verify actual
native signals and system ATT revocation, then a minimal player privacy-request
ID flow and a designated test-account deletion rehearsal.

Follow-up: prior `f6279b48` CI now PASS (789 suites / 9,835 tests / 308 snapshots).
The player privacy-request ID flow is implemented with 23 focused tests passing,
preflight exit 0 and phone/tablet web evidence. New request-flow CI remains to
be inspected after push. Native ID/consent checks and a designated test-account
deletion rehearsal are still required; no real request or deletion was sent.

## Release audit refresh — 10 September 2026

- [x] Clear verified stale Git lock, fast-forward main, preserve and reapply local popup fix.
- [x] Refresh open/merged PRs and actual CI/build history.
- [x] Repair local dependency installation and rerun automated audits, full tests and preflight.
- [x] Review save/state, logic/economy/performance and release/provider evidence.
- [x] Write a dated prioritized release audit with verified results and explicit external gaps.
- [x] Fix reproduced save-replay and weekly-cash recap defects with behavioral regressions.
- [x] Repair current Apple API compatibility and Windows tooling without weakening checks.
- [x] Install reviewed mobile skills; add concise future-chat guidance and repair stale local skills.
- [x] Verify combined changes locally, document native/device limits and preserve [draft PR #209](https://github.com/Wrexist/DeepLifeSimulator/pull/209).
- [ ] Inspect PR #209 checks at its final head; native acceptance remains separate.

Latest: [10 September audit and ordered release list](release/evidence/ios-quality-audit-2026-09-10.md).
Candidate branch: `codex/ios-release-quality-2026-09-10`; native/provider gates remain HOLD.

Updated 10 September 2026. This is the short entry point, not a second release queue.
Verify current main, PR heads and provider records before acting.

## Start here

- [Master-prompt backlog](MASTER_PROMPT_BACKLOG.md): 35 scoped packages with dependencies and acceptance criteria.
- [Task guide](README.md): where plans and evidence belong.
- [Initial audit ledger](archive/todo-before-cleanup-2026-09-09.md) and [full pre-integration ledger](archive/todo-before-integration-2026-09-09.md): both preserved verbatim at their named revisions.
- [Lessons](lessons.md): recurring engineering constraints and past corrections.

## Active release

[PR #203](https://github.com/Wrexist/DeepLifeSimulator/pull/203) merged the
release queue and save/research/validation fixes at `c32f2b9`.
Use the [remaining-work guide](release/REMAINING_WORK.md),
[release queue](release/queue.json), and [execution contract](release/CONTRACT.md).
[PR #206](https://github.com/Wrexist/DeepLifeSimulator/pull/206) merged verified
save/load timeout handling and evidence ancestry validation at `a470e79`.
Cleanup [PR #205](https://github.com/Wrexist/DeepLifeSimulator/pull/205) merged at
`6c89195`. User authorized the reviewed merge loop on 9 September 2026.

| Package | Remaining acceptance |
|---|---|
| R11 | Verified provider/operator facts, accurate live privacy/support and store answers |
| R04 | Reached player journeys and visual acceptance |
| R08 | Exact signed production candidate and processed TestFlight identity |
| R06 | Native purchases, interruption, recovery and Restore |
| R09 | iPhone/iPad lifecycle, ads, accessibility and performance |
| R07 | Current store record, release notes, locales and native screenshot parity |
| R10 | Complete evidence and submission packet |

The release remains HOLD until the required evidence exists. Do not reuse stale
“dispatch 2.13.0” instructions without checking current build/store records.
R00/R01/R02/R03/R05 have recorded implementation evidence. #206 corrects unpublished
local commit references; native/store acceptance remains separate.

## Recently merged

| PR | Finished implementation | Still separate |
|---|---|---|
| #197 | Purchase persistence/recovery, legacy migration repairs, journal and claim continuity | Native and cross-install recovery boundaries |
| #199 | Education quotes/atomic enrollment and loan/pension cash-flow corrections | Full post-bills forecast and optional deferment |
| #201 | Compact HUD and one first-job/goal surface | Native layout/accessibility acceptance |
| #200 | Reusable assets and recap presentation | HomeScene intentionally not mounted on Home |
| #204 | Ten game-themed store stories in three sizes | Native parity and current store upload |

## MP27: CI gates and handoff corrections — PR #207

Master prompt: close the confirmed ordinary-component/content/liveops CI gap.
Add a small relevant-path workflow running existing UI/content/liveops ratchets;
add weekly/manual coverage and run it on coverage-workflow/configuration changes.
Keep all floors, native release gates and existing EAS behavior unchanged.
Validate YAML, representative matching/nonmatching paths, actual ratchet commands
and a full coverage measurement. Review the diff, open a focused PR after MP00,
inspect its current checks and merge only when they pass. Keep provider/device
release gates explicitly blocked when their evidence is unavailable.

- [x] Confirm missing ordinary-component filters and absent coverage cadence.
- [x] Add targeted workflows and document their cadence.
- [x] Validate YAML/path cases and unchanged quality/coverage floors locally.
- [x] Confirm full-checkout CI on the latest [PR #207](https://github.com/Wrexist/DeepLifeSimulator/pull/207) head.
- [x] Preserve concurrent ledger history and correct master-prompt repo paths.
- [x] PR #207 merged on 9 September; main `ea9880d0` EAS Update passed. Do not repeat MP27.

## Next product work after release

1. MP08: authoritative cash/arrears/rental/noncash forecast before commitments.
2. MP09: causal weekly recap with useful actions.
3. MP10–MP13: path discovery, connected arcs, deliberate relationships and non-wealth endings.

Later experiments, maintenance, Android and marketing remain separate packages
in the backlog. Historical hypotheses are not confirmed defects.

## Repository cleanup

- [x] Inspect current source, PRs, TODOs and literal source markers.
- [x] Archive old reports, preserve historical evidence and add navigation.
- [x] Remove only verified unreferenced generated outputs from `undefined/`.
- [x] Verify references/content preservation and relevant local checks.
- [x] Publish [cleanup PR #205](https://github.com/Wrexist/DeepLifeSimulator/pull/205) and inspect latest CI. Latest integrated checks passed before merge.

## MP00 integration review

- [x] Inspect both PR heads, review comments and completed CI logs.
- [x] Repair the encoding fixture exception after its historical report moved.
- [x] Verify cleanup CI and merge #205 at its checked head.
- [x] Merge verified #206 save/load acquisition and evidence ancestry corrections.
- [x] Refresh merged #203 and integrate its release queue without restoring old TODO history.
- [x] Refresh release blockers and execute independent MP27. R11 source is now published; native/provider acceptance remains blocked.

Integration note: if #203 updates this file, retain its live release entries and
the navigation above. Do not restore the archived 1,500-line mixed history.

## Android growth — free levers (2026-09-25)

Measured first: production v2.13.0, 57 installs, 14 listing visitors / 28 days
at **93 % conversion** — the bottleneck is traffic, not the listing.

- [x] Halloween Live Ops event for ALL stages (`support-site/liveops.json`, Oct 16 → Nov 6, 250 gems); verified the 2.13.0 validator/objectives accept it; calendar + liveops suites green.
- [x] Play promotional-content art (1920×1080 + 1080×1080, no text) + field-by-field guide (`marketing/play-store/promo-events/`).
- [x] Play Console event SUBMITTED 2026-09-25 on the owner's explicit go-ahead (id 4832155368004637099, Oct 16 → Nov 6, 176 countries, AI declaration: not labelled - owner's call).
- [x] Share loop: every share now ends in one cross-platform link (`SHARE_LANDING_URL` → `support-site/get/`); Android shares used to send readers to the App Store, and the life-story share carried no link. Pinned by `__tests__/social/shareLinks.test.ts`.
- [x] Support site: Google Play badges, stale "closed beta" copy fixed, absolute OG image.
- [ ] Owner: merge #219 before Oct 16, ship 2.15.0 (carries the share fix), submit the holiday event Oct 19 - Dec 4.
- [x] All-stage December event `winter_holidays_home` (Dec 18 → Jan 4, 200 gems; late-stage budget 850/900) + winter art + guide. Owner submits the Play event between Oct 19 and Dec 4.
- [x] Skipped a "Major update" Play event for 2.15.0: it is fixes only, and Play rejects routine updates.
- [x] Reddit posts filled with per-subreddit tracked links.

## Internal TestFlight candidate - 11 October 2026

- [x] Build 2.15.3 (192) from PR #233 / `9238d19b` via GitHub Actions run [38109492651](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/38109492651). Verification, macOS build and TestFlight upload passed; App Store Connect accepted the upload. [Evidence](release/evidence/testflight-2.15.3-2026-10-11.md).
- [ ] Confirm build 192 is `VALID` in App Store Connect, then verify on device that live streaming advances and Life Skills is stable.

- [x] Build 2.15.4 (193) from `cbc16ed7` via run [38137834634](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/38137834634); upload accepted. [Evidence](release/evidence/testflight-2.15.4-2026-10-11.md).
- [ ] Verify on device: stream recap, one-button Life Skills unlock, locked-app guidance.

## App Store screenshot refresh - 11 October 2026 (2.15.5)

- [x] Fresh captures from HEAD: update `scripts/capture-rich-state.mjs` to the current onboarding/menu flow and add the new moments (stream recap, skill unlock, video recap, Life Skills tree).
- [x] Re-cut the storyboard: first three frames carry the search result on their own; every claim still asserted against capture text.
- [x] Render all sizes (iPhone 6.9 / 6.5, iPad 13) with the existing compositor; review every frame by eye.
- [x] Upload tooling: `scripts/asc-screenshots.mjs` + a dispatch-only workflow using the existing ASC secrets; dry run first, then replace the sets on the editable version.
- [x] Store 1.6.0 created and filled by `asc-release` (full listing, 5 languages, build 194 attached); screenshots uploaded to every locale. [Evidence](release/evidence/store-1.6.0-2026-10-11.md).
- [x] 1.6.0 submitted for review with build 195 (2.15.6) on 2026-10-12 - WAITING_FOR_REVIEW. [Evidence](release/evidence/store-1.6.0-2026-10-11.md).
