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
