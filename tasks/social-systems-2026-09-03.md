# Master Program 11 — Social Life, Relationships, Family, Emergent Stories

Branch `claude/deep-life-social-systems-xtuu69`, on top of Program 10 (`4eaa778`).
Programs 1–10 untouched.

The brief's question: **does this game feel like a life with other people in it?**
Answered by measurement, not by reading the code — seven social personas driven
through the real `nextWeek()` for 250 weeks each
(`__tests__/helpers/socialPersonas.ts`, `RUN_SOCIAL_PERSONAS=1`), before and
after every change.

---

## 1. The complete social system map

| system | entry | state | progression | player actions | events | consequences | end states |
|---|---|---|---|---|---|---|---|
| **Relationships** | `initialState` seeds Mom + Dad; Spark promotion; the `intro` favour; **(new)** the tier-1 meeting door | `relationships[]` — `parent · friend · partner · spouse · child`, score 0–100 | score via interactions; type via promotion (partner → spouse) | Call, Hang Out, Bond, Ask $, Lend $, Remove | `applyRelationshipHealth`, `applyNPCDepthTick` | happiness drag, breakup, drift | breakup · drift · divorce · death · (family: never removed) |
| **NPC depth** | attached on first tick to every relationship | `npcGoals`, `npcOpinion` (trust/attraction/respect), `npcMemories` (TTL 52w), `npcMood`, `npcWant` | wants rotate every 4 weeks; satisfying pays 4/2/1/0 | the same interactions | `rollNPCLifeEvent` (15%/NPC/wk) | −2 bond per fully-ignored want cycle | memory decay |
| **Spark** (tier 2) | swipe 30/wk free | `sparkApp` — swipes, matches, messages, premium, likedYou, catfish, jealousy | rapport 0–100 gates Flirt 25 / Ask on a date 45 / Go steady 75 | swipe, converse, promote to friend/partner, boost, subscribe, report/expose | jealousy spawn, catfish | promotion → a real relationship | unmatch · promotion · catfish |
| **Contacts** (tier 1) | aggregates every "person" across five systems | `favorLedger`; the relationship records themselves | bond, favour ledger | Call/Hang Out/Bond/Ask/Lend/Remove; redeem & repay favours; ask a network favour | favours expire (12w) | money, reputation, dark-web heat, an introduction | favour redeemed/expired · contact removed |
| **Family** | partner → spouse; `haveChild` (Life → Family) | `family.spouse`, `family.children[]` (`ChildInfo` + 13 traits + nurture stats + grandchildren) | children age +1/52; nurture stats move on parenting actions | 3 parenting actions/week, age-banded, cooled down | pregnancy, birth, anniversaries, scheduled wedding | heir quality at prestige; inheritance | child → heir → prestige |
| **Pulse** | tier 2 | followers, posts, NPC comments | influence ladder | post, comment | brand deals, scandals | money, reputation | — |
| **Pets** | tier 2 | `pets[]` with bond | bond decay | feed/walk/vet | sickness | happiness | death |
| **Events** | weekly tick | `pendingEvents`, `eventLog`, `choiceHistory` | 68 `category: 'relationship'` templates | one choice per event | sequels via `followUpEventId`, `relationId`-bound effects | money, bond, karma | — |
| **Life moments** | 5%/wk, pity 30 | `lifeMoments.pendingMoment` | 20 templates, 7 social | one choice | `unlock_event` payoffs | stats, karma | — |
| **Goals / chapters / ambitions** | derived | — | `soon_find_partner`, `soon_deepen_friendships`, chapter 2's social goal, the `true_love` ambition | — | — | reward bundles | — |

## 2. Existing relationship entry paths (before this program)

A repo-wide search for producers of a `Relationship` returned **three**:

| producer | tier | cost | notes |
|---|---|---|---|
| `promoteMatchToRelationship` (partner) | 2 | swipes + rapport 75 | anti-bigamy: one partner ever |
| `promoteMatchToFriend` | 2 | swipes | uncapped |
| `intro` favour (`resolveNonMoneyFavor`) | 3 | a redeemed favour | `FAVOR_KIND_BY_CONTACT` offers `intro` **only** on a `business` contact — a travel contact |

## 3. Missing entry paths — the Program 9 gap, confirmed and quantified

**The gap is real and it is total.** A player below tier 2 could not meet anybody.
The repository already documented the consequence in a comment on
`ch2_make_friend`: the chapter goal deliberately counted the seeded Mom and Dad,
"because Spark is the only route, and finishing chapter 2 is what UNLOCKS
Spark". So the tutorial chapter's social goal was complete on frame one for every
life and paid its share of the $2,800 bundle for a state nobody earned. The
comment ended: *"Making it a real goal means shipping a visible tier-1 way to
meet someone in the same change."*

Measured consequences of having no tier-1 door:

- CASUAL SOCIAL and RISK-TAKER held **zero** chosen relationships until week 50.
- The `true_love` ambition's first milestone ("Make a Connection") was unreachable
  at tier 1 — as were four of five ambitions' first milestones (Program 9 §21.4).
- Every unbound `relationship` effect in the event engine was **silently dropped**
  for a tier-1 player: the fallback targets a romantic partner, else the
  highest-scored non-family relationship, and a tier-1 life has neither.
- Coworkers exist in nineteen event and life-moment templates and are never
  people. `networking_opportunity` — the payoff to the coffee-break moment —
  says *"There's someone you should meet"* and grants +10 reputation.

## 4. Relationship depth findings

| type | what the player does | what a high score buys |
|---|---|---|
| **parent** | Call (free, 1/wk), Hang Out ($30, 1/wk), Ask $, Lend $ | nothing mechanical; avoids the −1/wk estrangement drag |
| **friend** | the same four, plus Bond ($400 + 60×score, 1/wk, +8→+2) | `strongRelationshipCount` (goal emphasis), two gem achievements, Pulse authorship, luxury-party guest lists |
| **partner** | the above plus 7 date tiers (2/wk cap), gifts, move in, propose, wed | household income, jealousy risk, dark-web betrayal risk, pregnancy, the marriage ladder |
| **child** | 3 parenting actions/week, age-banded, cooled down | nurture stats → heir quality at prestige |

The friend loop is thin — four capped taps and a paid gesture — and a friendship
at 100 buys almost nothing a friendship at 45 does not. That is the honest
finding; it is Priority 3 and it is **reported, not fixed**, because widening it
without evidence is how a social system becomes a chore (§26, §33).

## 5. THE HEADLINE DEFECT — a partner paid up to $62,500 a week

`Relationship.income` is populated from exactly one place: the 52
`DATING_PROFILES` rows, copied at promotion. Every one is an **annual** salary
written as such — Student 15,000 · Elementary Teacher 45,000 · Software Engineer
75,000 · Investment Banker 150,000 · CEO & Founder 250,000.
`householdPartnerIncome` added a quarter of it to a **weekly** total, beside a
career salary that runs $110 at the bottom rung to $6,000 at the top of the best
ladder in the game.

Measured on the real tick (ROMANCE-FOCUSED, seed 1):

| week | event | tick delta | salary |
|---|---|---|---|
| 12 | — | $111 | $110 |
| **13** | **Spark match promoted to partner** | **$15,796** | $110 |
| 14–250 | — | mean **$15,064**/wk | $130 |

The loner's mean tick delta over the same weeks: **$223**.

| persona | net worth @ 250w, before | after |
|---|---|---|
| ROMANCE-FOCUSED | $3,357,244 | $11,236 |
| FAMILY-FOCUSED | $3,393,697 | $15,781 |
| LONER | $53,746 | $50,946 |

Three rounds of fixing the *formula* had passed over it (the FamilyTab ×7, the
missing 25% share) because the error was in the **unit**, not the arithmetic.
Fixed by dividing by `WEEKS_PER_YEAR` at the one place the number becomes money,
which repairs saves that already carry a partner without a migration that would
have to guess. A partner is now worth **$72–$1,202 a week** — a second earner at
a quarter share, which is what `PARTNER_INCOME_SHARE` always claimed to be.

Two duplicated copies of the same formula were corrected with it: the Bank app's
DTI gate (its own `rel.income * 0.25`, summed over every partner) and
`heirGeneration`'s net-worth estimate (`income × 52`).

## 6. Relationship repetition findings

Over 250 weeks the FRIENDSHIP-FOCUSED persona received **121 relationship
notifications, all of the same kind**: `npc-life-event` flavour ("{name} is
obsessed with a new TV show"). Every persona's only relationship news was that
one template family. NPC life events are announcements, never situations: a
friend losing their job costs the player nothing and asks them nothing.

The maintenance loop itself is *not* a chore, which is the good news: the
RISK-TAKER held ten friendships for 150 weeks on one Call each per ten weeks, so
the −0.5 bond/week of total silence is comfortably out-run by any attention at
all.

## 7. Conflict findings

**Zero relationship losses across 1,750 simulated persona-weeks**, including a
persona designed to collect people and drop them. The mechanisms exist and are
sound but effectively never fire:

- a friend drifts away only after ~40 weeks of *total* silence (45 → 25 at
  −0.5/wk), then 4 more weeks, then a ≤25% roll — and any single Call resets it;
- a partner breaks up below 30 for 2 weeks at `min(0.4, (30−score)/100)`, which
  a dating loop never approaches;
- the jealousy spawn needs Spark swipes while partnered.

Conflict in this game is **contextual and recoverable, and almost never
reached**. Reported, not tuned — turning the dials without an owner decision
would be manufacturing drama, which §12 forbids.

## 8. Neglect and recovery findings

- Estrangement is **silent and permanent for family**. The LONER sat at an
  average bond below 25 for **170 of 250 weeks** and CAREER-OBSESSED for 149,
  paying a −1/wk drag capped at −3 and receiving the "Growing Distant" notice
  exactly once, on the first week. Family is never removed (correctly — it would
  break inheritance and the family tree), so there is no end state at all.
- Recovery is cheap and works: +3 a Call, +4/2/1 for satisfying a want, +8→+2 for
  the paid gesture, against −0.5/wk of decay.
- **A friendship fading was not filed as a relationship event.** The journal's
  tag regex matched `married|partner|date|broke up|divorce|relationship` — so
  "🍂 Friendship Faded / you have drifted apart", "💤 Growing Distant" and the
  neglect notice were all recorded as plain weekly entries and vanished from the
  Journal's relationship filter. Fixed.

## 9. Family findings

The family systems are the **strongest** part of the social simulation and are
mostly real: children carry 13 genetic traits and four nurture stats, age
continuously, generate grandchildren, and feed heir quality at prestige;
parenting is age-banded with a weekly cap and per-action cooldowns; anniversaries
and scheduled weddings run on the tick.

Two defects found:

1. **A renter could not move in together.** `moveInTogether` walked
   `realEstate[]`, which since v32 never contains a tenancy — a rental lives in
   `state.rental` deliberately, so it cannot inflate net worth. Every renting
   player was refused with *"you need to … rent a property"* while renting one,
   and because `proposeMarriage` requires `livingTogether`, that closed the
   **entire marriage path** for anyone who had not bought a house — on the taught
   path, where Chapter 2 asks for a roof and prices the $45 shared room. Fixed:
   the gate now reads `computeHousingWellbeing`, the same function the chapter
   goal reads.
2. Children are reachable only through Life → Family, a header action. Not
   changed; reported.

## 10. Personal history and life-moment findings

The game remembers a great deal — `eventLog`, `journal`, `choiceHistory`,
`lifetimeStatistics`, `careerHistory`, `npcMemories` — and the event engine is
genuinely story-aware (`relationId` binds an effect to a named person,
`followUpEventId` schedules sequels, outcomes are seeded so the sequel is
guaranteed and the result is not).

What it could not remember was **how anybody entered the life**. `npcMemories`
looked like the place, but `decayMemories` drops anything older than 52 weeks —
so an origin written as a memory is guaranteed to be forgotten in the second
year, exactly when remembering it starts to matter. **v50 `metAt`** is the
durable stamp: it is surfaced on the Contacts card ("Met at work · week 12") and
the life story now says *"…whom they met at the gym"* and names the friendships a
life kept. Life moments themselves remain stateless — no template addresses a
named relationship. Reported, not changed.

## 11. Story variation results (250 weeks, seed 1, after)

| persona | tier | chosen | friends | strong | romance | mean happiness | net worth |
|---|---|---|---|---|---|---|---|
| LONER | 5 | 0 | 0 | 0 | none | 74.5 | $50,946 |
| CAREER-OBSESSED | 5 | 0 | 0 | 0 | none | 76.7 | $52,786 |
| CASUAL SOCIAL | 5 | 23 | 23 | 25 | none | 76.2 | $51,116 |
| RISK-TAKER | 5 | 18 | 18 | — | none | 82.1 | $52,950 |
| FRIENDSHIP-FOCUSED | 5 | 36 | 36 | 38 | none | 82.8 | $5,496 |
| ROMANCE-FOCUSED | 5 | 9 | 8 | — | partner | 92.3 | $11,236 |
| FAMILY-FOCUSED | 5 | 9 | 8 | — | partner | 95.3 | $15,781 |

The lives are now **differently shaped rather than differently sized**: the
social lives buy happiness (+15 mean, +15 floor) and pay for it in cash
(a fifth to a tenth of the loner's), and the romance life reaches a stage the
friendship life never does. Before the income fix the same table read
$3.36M for romance against $53k for the loner, which is not a tradeoff — it is a
dominant strategy hidden behind a heart icon.

## 12. Social persona results

- **LONER** — survives 250 weeks housed, solvent, at tier 5, with nobody. Gated.
- **CASUAL SOCIAL** — 3 people by week 20 (was 0 until week 50).
- **FRIENDSHIP-FOCUSED** — 36 relationships, the poorest life in the set: keeping
  in touch with everyone costs real money, which is an honest tradeoff.
- **ROMANCE-FOCUSED / FAMILY-FOCUSED** — happiest, mid-wealth, partnered.
- **CAREER-OBSESSED** — richest, no relationships, by choice not by blockage.
- **RISK-TAKER** — collects and neglects; loses nobody, which is finding §7.

## 13. Mid-game aspiration findings

Program 10 found weeks 20–100 contain cash and few decisions. Social progression
now supplies some: a person arrives roughly every six weeks up to eight, each one
a small decision (say hello or not, then keep up or not), and the
`soon_deepen_friendships` goal has an actual population to measure. It is not a
full answer to the plateau; it is a thread that now exists at all.

## 14. Discoverability findings

- The Home screen carries **no social surface at all** — no relationship card, no
  "someone is around", nothing.
- Family sits behind a header action on the Life tab.
- Contacts and Spark are behind the Apps tab, which requires owning a device.
- The Contacts empty state advertised "Match on Spark…" to a tier-1 player who
  cannot open Spark.

The meeting card is placed at the top of Contacts' Personal tab, and the header
no longer suppresses itself when the book is empty — the one case where the card
matters most. The Home-screen gap is **reported, not fixed**.

## 15. Exploit findings

| exploit | status |
|---|---|
| **Partner income** — one promotion = up to $62,500/wk, forever, uncapped, from week 13 | **FIXED** (§5) |
| **Duplicate people** — `unmatch` leaves the relationship, so re-swiping the same profile minted a new match id that walked past the promote-once guard: two records both named "Sarah Johnson", both counting toward the 10-friend (25 gems) and 25-friend (75 gems) achievements | **FIXED** — both promotion paths guard on the person |
| `increaseRelationshipLevel` — +5 bond, no cost, no cooldown, no cap | **FIXED** — deleted (zero callers) |
| `startConversation` — +2 happiness, no cost, no cooldown | **FIXED** — deleted (zero callers) |
| Bond / Call / Hang Out / date / gift spam | not exploitable — every one is once-per-action-per-week (or 2/wk for dates) and re-checked inside its own updater |
| Ask-for-money pity | not exploitable — once per week per contact, the grant becomes an owed IOU |
| Breakup → re-promote | not exploitable — `SparkMatch.promoted` is sticky, and the person guard now covers the unmatch route |
| Spark match rerolls | not exploitable — `rollMatch` is seeded on `(handle, week, profileId)`, so a reload cannot re-roll a swipe |
| Friend count | **NOT exploitable but PERMISSIVE** — 28 friends by week 20 through Spark alone, which claims both gem achievements cheaply. Reported (§17) |

## 16. Implemented changes

1. **Partner income units** — `householdPartnerIncome` divides by
   `WEEKS_PER_YEAR`; the two "/wk" labels say "/yr"; the Bank app routes through
   the tick's own function; `heirGeneration` stops multiplying by 52; the NPC
   life-event income deltas are rescaled to the annual unit.
   · `__tests__/social/partnerIncomeUnits.test.ts`
2. **A tier-1 way to meet somebody** — `lib/social/meetPeople.ts` + `meetSomeone`
   + the Contacts card. Derived, deterministic per life and week, no new stored
   bookkeeping, capped at 8, paced at one person per 6 weeks, venue read off the
   life. · `__tests__/social/meetPeople.test.ts`
3. **v50 `metAt`** — where and when somebody entered the life; surfaced on the
   Contacts card and in the life story. Carve-out; no backfill.
   · `__tests__/save/carveOutRoundTrip.test.ts`
4. **Chapter 2's social goal is real** — `ch2_someone_close`: one bond at 60,
   satisfiable by a loner who calls their mother or by anyone who meets someone.
   Never pre-ticked, no tier-2 app needed. · `wealthRatchet.test.ts`,
   `progressionIntegrity.test.ts`
5. **One person, one record** — both Spark promotion paths guard on the person.
   · `__tests__/social/duplicatePeople.test.ts`
6. **A renter can move in together** — the gate reads `computeHousingWellbeing`.
   · `__tests__/social/movingInWhileRenting.test.ts`
7. **Three dead verbs deleted** from `SocialActionsContext`.
8. **The journal files a lost friendship as a relationship event.**
9. **The life story names friends and origins.**
10. **The measurement itself** — social columns on `SimRow`, ten social actions
    and five policy blocks in the harness, seven personas, a soak and eight
    gates.

## 17. Proposed but NOT implemented

| # | proposal | problem it solves | why not now |
|---|---|---|---|
| 1 | `networking_opportunity` delivers the person it promises | an event says "there's someone you should meet" and creates nobody | needs a new declarative effect kind in the event engine — a bigger change than this program's evidence supports |
| 2 | NPC life events become situations, not announcements | 121 identical toasts per 250 weeks; a friend losing their job asks nothing | content + an event-engine hook; owner call on how much drama is wanted |
| 3 | A cap or a cost on Spark friend promotion | 28 friends by week 20 claims two gem achievements cheaply | a design decision about how many people a life should hold, not a defect |
| 4 | A friendship at 100 should buy something | the loop is four capped taps and the ceiling is inert | needs a design answer (a favour? an opportunity? a story?) before code |
| 5 | A social surface on the Home screen | no relationship signal outside the Apps tab | Home is dense; placement is an owner decision |
| 6 | Life moments that name a real relationship | moments are stateless, so no moment is ever *about* anyone | template rewrite + a targeting rule |
| 7 | An end state for family estrangement | 170/250 weeks below the threshold with no consequence beyond −1/wk | family must never be deleted; needs a different mechanism |

## 18. Remaining social-system risks

1. The friend loop is still thin; nothing above 60 changes gameplay.
2. Conflict effectively never fires on a normally-played life.
3. Children remain behind a header action on the Life tab.
4. The meeting door needs a device (the Apps tab does), so a player who never
   buys a phone meets nobody — mitigated because Chapter 2's goal is satisfiable
   on the family a life starts with.
5. The personas are one seed each; the tables are shapes, not distributions.

## 19. Verification

See §20 of this file's companion entry in `tasks/todo.md` for the plan status.
Gate output is recorded in the commit that closes the program.

## 20. Scores (0–100, honest)

| dimension | before | after | basis |
|---|---|---|---|
| social discoverability | 25 | 48 | a card on the tier-1 app the game routes to; Home still silent |
| relationship entry | 15 | 62 | was tier 2 only, and the chapter goal had to lie about it |
| relationship depth | 35 | 38 | unchanged by design; the loop is still four capped taps |
| player agency | 55 | 72 | the loner is gated as a supported life; no relationship is mandatory |
| friendship system | 30 | 45 | reachable, capped, remembered — but a 100 bond still buys little |
| romance system | 40 | 58 | the fortune is gone, the marriage path is unblocked for renters |
| family system | 60 | 66 | strong already; the move-in gate was closing marriage for renters |
| relationship variety | 30 | 42 | one new origin axis; the event pool is unchanged |
| social consequences | 30 | 46 | income is a real contribution now; estrangement still nearly free |
| conflict quality | 25 | 27 | mechanisms sound, almost never reached |
| recovery quality | 55 | 58 | cheap and works; now visible in the journal |
| emergent story potential | 35 | 55 | `metAt` + the story lines; moments still name nobody |
| mid-game aspiration | 30 | 45 | a person every six weeks is a thread, not an arc |
| exploit resistance | 20 | 78 | the two-order-of-magnitude income exploit and the duplicate-person path are closed |
| **overall social simulation** | **33** | **54** | |

Under 60 because the depth question is untouched: a friendship at 100 still buys
almost nothing, conflict almost never fires, and no life moment has ever been
about a person the player knows. What changed is that other people can now enter
a life at all, that having one is no longer the best financial decision in the
game, and that the game remembers where they came from.
