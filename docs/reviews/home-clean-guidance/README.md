# One Home action — 2026-09-08

The owner rejected the duplicated "Choose your first job" and "Get hired"
blocks in PR #201. They now share one card and one owner for the next action.

GoalsCard composes FirstSessionCoach inside its own surface. While the coach
is visible, catalogue recommendations and the matching get-hired chapter row
are omitted. Only a chosen ambition and a nonduplicate chapter goal appear
as compact secondary rows. The regular recommendations return immediately
when coaching is acknowledged, dismissed, expired or already completed.
No extra persisted flag, synchronization effect or dependency was added.

The embedded coach has no second background, border, shadow or outer margin.
Urgent Home tips retain their existing priority ahead of the combined card.

Validation: 13 suites / 145 tests passed, including startup and composed
unemployed → pending → hired → acknowledged → paid → dismissed transitions.
The render test also checks returning established players, ambition visibility
and absence of both catalogue and chapter job duplicates. App and test types
passed. Scoped lint has zero errors and the existing Home require warning.
UI ratchet and whitespace checks passed.

Production web export inspected at 390×844, 375×667 and 768×1024. Browser
assertions found no duplicate Get hired row or What matters now header during
the first-job prompt. Real flow: fresh start, immediate hire, first paid week.
No browser page errors. Pending applications are covered by the render test.
Native iPhone / VoiceOver / Dynamic Type verification remains outstanding.

Before and after are real captures of different newly generated characters,
not a claim that the same save was replayed. `before-390.png` is the prior PR
layout, `home-390.png` is this update. `opening-375.png` checks the narrow
opening, `application.png` shows immediate hiring, `week-1.png` shows the first
paid week. Other captures show the same paid state at additional widths.
The large HUD and decision-inbox positioning are still separate follow-ups.
