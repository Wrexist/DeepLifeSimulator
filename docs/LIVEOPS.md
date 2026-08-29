# Live Operations

How Deep Life Simulator ships content without shipping a build, what it will and
will not let a live event do, and the one rule that governs all of it.

Code lives in `lib/liveops/` (pure), `hooks/useLiveOps.ts` (the React layer) and
`components/LiveEventsCard.tsx` (the surface).

---

## 1. The one rule

**Windows are real UTC time. Progress and rewards are game state.**

This repo has five `STATE_VERSION` bumps whose entire purpose is closing a
device-clock exploit (v28/v31/v35/v40/v44), so "gate on game state, not the
device clock" is a scar, not a preference. But a winter event has to arrive in
winter, or it arrives in July for anyone who started playing in June. The split
lets both be true:

| Thing | Clock | Why |
|---|---|---|
| When an event is available | Real UTC | A calendar has to be a calendar |
| Objective progress | `GameState` | A clock scrub must not manufacture progress |
| Whether a reward was taken | Claim ledger | Keyed on the event *instance* |
| Cooldown between repeats | Game weeks | Real time would cool down a player who has not played |
| The rolling reward budget | Real time | It bounds payouts per real week, and never refunds on a rewind |

What a moved device clock actually buys:

- **Forward past the end** — the event expires early. A self-inflicted loss.
- **Back into a claimed window** — still `claimed`; the instance id is in the ledger.
- **Back into an unclaimed window** — claimable *only if the objectives are met*,
  and those read the save. No progress is manufactured.
- **Forward into a future window** — the player sees an event early. That is a
  shop window; the budget bounds the value of doing it repeatedly.

---

## 2. Architecture

```
LiveEventDefinition (pure data)
  └─> validation      caps, dates, schema version, known objectives   validation.ts
        └─> content    remote → cached → compiled-in                  remote.ts / content.ts
              └─> eligibility  stage · life weeks · subscription · away · cooldown · rollout
                    └─> resolve  objectives read GameState            engine.ts
                          └─> lifecycle  upcoming/active/claimable/… schedule.ts
                                └─> UI    the card                    LiveEventsCard.tsx
                                      └─> claim  ONE pure reducer     claim.ts
                                            └─> analytics funnel      funnel.ts / analytics.ts
```

Everything under `lib/liveops/` is pure and synchronous. The only React is the
hook and the card; the only I/O is one optional `fetch` and the AsyncStorage
cache behind it.

---

## 3. The event model

A definition is **pure data**. It carries no logic, which is what makes it safe
to accept from a server.

| Field | Notes |
|---|---|
| `id` | lower snake_case, enforced. It appears in analytics and the claim ledger |
| `schemaVersion` | A definition from a *newer* schema is refused, not guessed at |
| `kind` | `challenge` · `opportunity` · `seasonal` · `returning` |
| `title` / `summary` / `brief` | Length-capped |
| `startsAt` / `endsAt` | ISO UTC. ≤ 60 days (`returning`: ≤ 400 — see below) |
| `claimGraceDays` | Extends the **claim**, never the work. ≤ 14 |
| `objectives` | `{ objectiveId, target }` — ids into a compiled-in registry |
| `rewards` | `gems` · `cash` · `legacyPoints`, each capped |
| `eligibility` | All optional; absent means no constraint |
| `rolloutPercent` | Staged rollout, deterministic per install |
| `priority` | Hub ordering |

**Evergreen kinds.** `returning` events may run up to 400 days, because their
real gate is `eligibility.minDaysAway`, not the window — a win-back that greets
someone returning in August has to exist in August. The validator enforces the
pairing: an evergreen kind with no absence rule is refused, because a year-long
window with no gate is permanent content wearing an event's clothes.

### The objective registry

`lib/liveops/objectives.ts` holds the *reads*. A definition names one by id and
supplies a target. Every read is **pure**, **total** (a malformed save yields a
number, not a throw — these run on every render of the hub), and stable forever,
so completion rates a year apart are comparable.

`weeks_this_life` reads weeks in the **current** life, never raw `weeksLived` —
that counter is seeded from the starting age, and three shipped bugs came from
testing it directly (CLAUDE.md §4.2).

---

## 4. Lifecycle

```
upcoming ──(startsAt)──> active ──(all objectives met)──> claimable ──(claim)──> claimed
     │                      │                                  ▲
     │                   (endsAt)                               │
     │                      ├─ complete?   ────────────────────┘  until endsAt + grace
     │                      └─ incomplete ──> expired
     └── ineligible at any point ──> unavailable
```

`claimable` is reachable from two directions: "you have finished, take it now",
and "you finished in time and the app closed before you tapped". `claimed`
outranks everything — an event whose window closed, or whose audience the player
has aged out of, still reads `claimed`, because a machine that can *leave*
`claimed` is one that can be argued back into paying.

The hub hides `unavailable` and `expired`. A player who cannot take part learns
nothing from a locked card, and listing an event that closed on them converts a
missed opportunity into a reproach.

---

## 5. Reward safety

Three protections, because each fails differently.

**1. Per-event caps** (`rewards.ts`), checked at *validation* time so an
over-generous event never reaches a player.

| Currency | Cap | Reasoning |
|---|---|---|
| `gems` | 500 | ~2× the richest weekly challenge (300). A great week, not a new faucet |
| `cash` | $25,000 | **Flat, deliberately not net-worth-relative** — a relative reward compounds, which is how the ad orb became a doubling machine before v35 |
| `legacyPoints` | 5 | They cross a life boundary, so over-paying compounds across the whole dynasty |

Plus `MAX_EVENT_VALUE_GEMS` (600) on the combined bundle, so one event cannot max
every currency at once; and one entry per currency, so a cap means what it says.

**2. The claim ledger.** Keyed on the event **instance** (`eventId@<epoch of
startsAt>`), so the same window can never pay twice — a double tap in one React
batch, an app restart mid-claim, or a clock scrubbed back into a claimed window.
Keyed on the *parsed instant* rather than the raw string, because
`2026-12-14T00:00:00Z` and `2026-12-14T00:00:00.000Z` are the same moment and
two different strings: republishing an event with a reformatted date would
otherwise have handed everyone who claimed it a second payout.

**3. The rolling weekly budget** (900 gem-equivalents per real 7 days across
*all* events). This is the one that actually keeps the economy safe, because it
holds however the calendar is scheduled — a live-ops calendar is authored under
time pressure, and the budget makes a scheduling mistake cost a skipped reward
rather than an inflation event. All-or-nothing: a bundle that does not fit is
**refused, never scaled down**, and the event stays claimable until the window
clears. A future-stamped entry is kept, not dropped, so a rewound clock cannot
refund the budget.

### The claim path

`applyLiveEventClaim` is a **pure reducer**, so the one dangerous operation in
the subsystem is testable:

```ts
setGameState(prev => {
  const result = applyLiveEventClaim(prev, definition, context, Date.now());
  return result.ok ? { ...prev, ...result.patch } : prev;   // reject atomically
});
```

Every gate reads the state *passed in*, never a captured value, so a second
invocation in a React batch sees the ledger the first one wrote (CLAUDE.md §4.4).
The card computes the outcome **once out of band** purely to decide what to
*say*; the authoritative claim runs inside the updater. Reporting may be stale,
payment may not.

---

## 6. Remote content

**The contract: the network can only ADD events or TAKE THEM AWAY.** It can
never break the game, exceed a reward cap, or execute anything.

The fallback ladder, with the game fully playable on the bottom rung:

```
fresh remote payload  →  last VALID cached payload  →  LOCAL_EVENTS
```

- Objectives are **ids into a compiled-in registry**, so the most a payload can
  express is a combination of reads this binary already performs. An unknown
  objective drops the event.
- One bad definition is dropped **individually**. A single typo must not take the
  calendar off the air.
- Remote definitions come first in the merge, so republishing an id **corrects a
  shipped event without an app update**. A *broken* correction leaves the
  original running rather than turning a typo into an outage.
- The cache holds only definitions that already validated, so a corrupt cache and
  an empty one behave identically.
- Nothing is awaited on the boot path.

The compiled-in catalogue runs through **the same validator**, asserted by its
own test — a local catalogue that skipped the caps would be a hole no reviewer
would think to look for.

### Payload

```json
{
  "events": [ /* LiveEventDefinition[] */ ],
  "disabledEventIds": ["broken_event"],
  "paused": false
}
```

`EXPO_PUBLIC_LIVEOPS_URL` points at it. Absent → local catalogue, forever, fine.

### Kill switches

- `disabledEventIds` — removes one event, local or remote.
- `paused` — takes the whole system off the air.

Both are honoured **from the cache**, so an event killed while the player was
online stays killed on their next offline launch — which is exactly when a broken
event does damage.

**Remote content must never** change balance constants, prices, or feature flags.
Those are the values this app is careful about precisely because externally
supplied and device-clock values have been exploitable five times over.

---

## 7. Staged rollout

`rolloutPercent` buckets deterministically on `installId:eventId`, so:

- **Stable** — an event never appears and then vanishes between launches.
- **Monotonic** — raising 10 → 50 only ever *adds* installs, never removes one
  who may already have made progress.
- **Independent** — salted per event, so two rollouts do not land on the same
  installs.

The hash gained an avalanche finalizer for this: raw FNV-1a avalanches poorly on
its last byte, and every id here puts the varying part there. Measured, `exp_a`
and `exp_b` agreed on a 50/50 split for 36% of installs instead of 50%. See
`lib/analytics/experiments.ts`.

---

## 8. Analytics

```
live_event_shown → live_event_opened → live_event_progressed
   → live_event_completed → live_event_claimed
                          ↘ live_event_expired
```

Each step answers a different failure:

- **`shown` vs `opened`** — a discovery problem (bad card, buried surface) versus
  a design one (wrong objectives for this audience). They need opposite fixes.
- **`completed` vs `claimed`** — the "did the work, never got paid" gap. A gap
  here is a bug, not a preference, the same reason `purchase_succeeded` and
  `premium_activated` are separate.
- **`expired`** — the biggest drop-off in any live-ops programme, and the hub
  deliberately hides expired events from the player, so nothing else can see one.

Three of these are **transitions**, which a stateless resolver cannot emit — they
come from `funnel.ts`, a session-scoped observer. Progress compares against a
*high-water mark*, so an objective the player goes backwards on (cash, which is
spent) does not fill the funnel with progress that never happened.

`live_event_claim_refused` should be rare; a rise means the calendar is
over-scheduled and players are being told no after doing the work.
`liveops_content_resolved` reports which rung of the ladder was used and how many
definitions validation dropped — that is what makes a bad publish a number rather
than a support ticket.

`__tests__/analytics/liveOpsFunnelReachable.test.ts` fails CI if any declared
step has no emitter. Three of them shipped with none in the first pass.

---

## 9. Content calendar

A sustainable rhythm, not a hardcoded future.

| Layer | Cadence | Mechanism | Purpose |
|---|---|---|---|
| Daily | Real day | Daily gem claim (existing) | A reason to open the app |
| Weekly | 4 game weeks | Weekly challenge (existing) | A goal that waits for you |
| Weekly | UTC week | Offer rotation (existing) | Shop variety |
| **Event** | **2–4 real weeks** | **This system** | **A reason to come back *now*** |
| Seasonal | Quarterly | This system, `kind: 'seasonal'` | Coherence with the real calendar |
| Evergreen | Always | This system, `kind: 'returning'` | A soft landing for a returning player |

Shipped in `catalogue.ts`: a returning-player event, an early-player on-ramp, a
discipline challenge, a cross-system spring event, a mid-game-wall event, and a
year-end event. Each asks for a **decision the player would not otherwise make
this week** — holding cash fights the instinct to spend, three-axis objectives
stop single-axis optimising — rather than a button to tap.

### Operating loop

1. **Plan** against the budget: what can a single player claim in one real week?
2. **Author** the definition; the required fields are the checklist.
3. **Validate** — `validateEventDefinition` locally, and the catalogue test.
4. **Roll out** at `rolloutPercent: 10`, watch `live_event_claim_refused`,
   `save_failed` and `app_startup` (guardrails), then widen.
5. **Measure** the funnel: discovery, participation, completion, claim, expiry.
6. **Kill or keep.** An event with low discovery has a card problem; low
   completion has a difficulty problem; high `expired` has a window problem.

---

## 10. Save format

`STATE_VERSION 49` adds `liveOps` — one optional object for the whole subsystem
(the v36 `dynasty` precedent). A **carve-out**: no backfill, no `repairGameState`
mirror. Absence already resolves to "nothing claimed, nothing seen, nothing
paid", which is the truth for any save written before live events existed.

Progress is **deliberately not stored**. Every objective reads a value the save
already tracks (the v33 `legacyContracts` reasoning), so nothing drifts out of
sync, a tick that runs twice cannot double-credit, and an existing save loads
with its events already part-complete rather than reset to zero.

---

## 11. Limitations

1. **Objective progress is a snapshot, not a record.** An objective the player
   can go backwards on (cash) is met only while it is true. Deliberate — but it
   means "hold $25,000" is a different promise from "earn $25,000", and the
   catalogue is written to make that distinction visible in the copy.
2. **Expiry is reported per session, not per install-ever.** A player who plays
   twice in a day reports an expiry twice. The analysis counts distinct installs.
3. **`daysAway` is frozen at first read.** If the welcome-back popup rewrites
   `lastLogin` before any live-ops surface renders, a returning-player event will
   not fire that session. It fires on the next launch.
4. **The claim ledger is capped at 200 ids**, oldest evicted. Unreachable with a
   single-digit catalogue and ≤400-day windows, but not impossible in principle.
5. **No event hub screen.** The home card shows the top three. A dedicated hub is
   worth building when the calendar routinely runs more than that; today it would
   be a screen with three rows.
6. **No push notifications for events.** Deliberate: the card is a surface the
   player chooses to look at. A notification is an interruption, and the return
   loop should be worth returning to on its own.
7. **Remote content is fetched once per session.** An event published mid-session
   appears on the next launch.
8. **No server-authoritative validation.** A modified client could present itself
   whatever content it liked — but the caps, the ledger and the budget are all
   enforced client-side against the same save the player is playing, so the blast
   radius is that player's own save.
