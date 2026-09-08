# Home first decisions — 2026-09-08

First implementation slice after the owner rejected decorative buildings on Home.
Based on main a70df9f. The rejected scene/asset PR #200 remains separate and draft.

## Behavior

- Home places its state-selected lead (urgent tip, prestige action or goals)
  before the profile card.
- Goals lead with an actionable recommendation, then the selected ambition,
  then chapter progress. Secondary ladders remain in Show details.
- The coach distinguishes unemployment, a pending application, acceptance and
  the first paid work week. Passive income and bonuses cannot trigger payroll
  congratulations. Displayed money is explicitly the total weekly income.
- Job progress follows the real one-application limit, replacing an unreachable
  three-pending-application target with application and hiring stages.
- CTA pulse stops after two cycles. The completion CTA uses dark text on gold.

## Verification

- Startup and state-driven hierarchy plus initial coach/goal suites: 12 suites,
  141 tests passed.
- Final coach/render/goal engine suites: 9 suites, 78 tests passed (overlaps the
  coach and goal-builder suites above).
- First-session signal suite: 8 tests passed.
- App and test TypeScript checks passed. Scoped ESLint: zero errors, one existing
  internal-require warning in Home. Routes, UI ratchet and diff checks passed.
- Production web export completed. Actual Chromium flow: Play, Find a job,
  apply, return Home, pending application, week 1 hired, week 2 first paid week.
  The observed week-2 total was $151, with cash moving from $1,530 to $1,681.
  The daily reward was dismissed through its actual accessible button.
- Captures inspected at 390×844, 375×667 and 768×1024 CSS pixels, device scale 2.
  No browser page errors logged. Screens are real captures, not mockups.
- Early automation attempts stopped at the daily reward. The corrected runner
  waited for the popup and matched its accessible name before advancing. No
  reward implementation was changed and no modal defect is claimed.

## Remaining work

This is a guidance/priority correction, not the completed redesign. The HUD is
still tall. The coach and job goal repeat the same intent on a fresh life, and
small screens need scrolling to reach the profile. The existing decision-inbox
pill overlaps lower content at 375px. Those are inputs to the next HUD/feed
composition slice. Connected choices and authored story consequences follow
that work. No retention improvement is claimed from these tests.

Native iPhone, VoiceOver and Dynamic Type verification remain required before
release. No save migration, new dependency, game-balance change, or release build.

## Captures

- `home-390.png`: first opening
- `application.png`: application awaiting review
- `week-1.png`: accepted, before salary
- `week-2.png`: first paid week
- `home-375.png`, `home-768.png`: same paid state at smaller/larger viewport
