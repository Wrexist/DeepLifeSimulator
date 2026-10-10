# DeepLife Glossy — Groups A–D delivery

Created 2026-10-05 for Deep Life Simulator. **Gates 1, 2 and 3 approved. Gate 4
was rejected for not fitting the game.** The approved badge direction is front-facing with skinny raised
numerals in the exact same metal/color as the rim. White/painted/inset typography
studies are superseded; see dated evidence for the review history.

## Rejected review: onboarding heroes

**Current replacement review (6 October):** `proposals/immersive-entry/preview.html`
is a self-contained interactive opening proposal; `review.png` shows its three
chapters. The owner rejected the grounded wallet/album slides as boring. Those
Blender proposals remain in `proposals/grounded-entry/` for reference, not intake.
The new UX prototype uses approved props and existing character portraits.
It is awaiting design review and is not integrated into runtime onboarding.
Four scenario cards separately reuse already-approved laptop/gym props.

The owner rejected this Group D direction. These files are retained for reference,
not approved for intake. The owner clarified that the toy-like artwork/scenes
are the concern. One revised work pilot is now in `proposals/grounded-work/`:
`navy-light-review.png` and `phone-review.png`, with matching PNG/GLB and linked
Blender source. It uses restrained teal canvas, satin metal and paper, preserving
the preview layout. This pilot awaits visual approval. A-C approvals remain intact.
Do not advance to loops on the technical checks below.

- `previews/gate4-phone-previews.png`: three 390x844 phone placement studies.
- `previews/gate4-hero-contact-sheet.png`: full navy/light canvases with guides
  showing empty top 15% and bottom 30%.
- `heroes/hero-start.png`: empty open wallet and one incoming coin.
- `heroes/hero-grow.png`: briefcase and three rising coin stacks with tiny flag.
- `heroes/hero-legacy.png`: crowned cozy house and two gift boxes.

Each hero has a matching embedded GLB and a 1600x1200 RGBA PNG. Editable sources
are in `blend/group-d.blend`. Hero masters have no text. Phone copy is placeholder
review copy, not implemented app UI or native screenshots. Reserved alpha bands
exceed the brief: >=216 empty top rows and >=396 empty bottom rows.

## Prior approved sets

`icons/`: 12 1024px PNG/GLB pairs. `tiers/`: six pairs. `badges/`: five pairs.
Badge masters remain text-free. Approved numeral treatment is demonstrated in
`previews/gate3-matching-metal-navy.png`, `-light.png`, `-gold-large.png` and
`-platinum-large.png`. `render-metal-numbers.py` renders temporary slender beveled
number geometry with each rim's identical material. `compose-metal-numbers.py`
creates the review composites. No fixed number is baked into delivery masters;
dynamic number rendering in the app is not implemented by this art task.

Group C uses owner-selected frontal geometry, thinner satin borders and a larger
navy face (~81% of backing width, replacing the original angled 55% face and
iridescent platinum center). The laurel faces forward and aligns behind badges
at identical canvas coordinates. Other groups retain their approved art direction.
Flame-1's small 60% size is intentional. Flame-2 and trophy-gold exports are exact
copies of their bases. Flame-3 has three intentional floating embers.

## Files, provenance and reproduction

All four group .blend files link the unchanged `blend/shared-scene.blend` camera,
lights and packed world through relative paths. Keep them together. Enable one
local asset collection at a time to render. All object scales are applied.

Original geometry authored by Codex, rendered with local Blender 5.2.1 LTS /
Cycles on RTX 3060. No Astra service, paid provider, external model, stock texture
or provider-account claim. The neutral float studio environment was generated
locally; warm key RGB approximates 5200K. Existing project licensing governs use;
no new public asset license is assigned. `source/brief.md` preserves the brief.

For a complete rebuild, run these scripts with Blender `--background --python`:
1. `source/build-gate1.py`
2. `source/build-gate2.py`
3. `source/build-gate3.py`
4. `source/build-front-badges.py` (required owner-selected Group C revision)
5. `source/build-gate4.py`
Paths are relative to this delivery folder; invoke from the repository root with
`art/astra-v1/` prefixed. These commands replace generated outputs.

Verification: run `check-gate3-scenes.py` and `check-gate4-scene.py` through Blender;
run `check-gate3.py` and `check-gate4.py` with Python (Pillow, NumPy, SciPy).
The former's white number composites are historical layout checks, not the
approved numeral treatment; render matching-metal previews with the scripts above.
Do not reproduce the obsolete inset/painted number studies for current review.

Evidence: `source/gate4-file-checks.json`, `gate4-scene-checks.json`,
`gate4-geometry-checks.json`, `gate4-preservation.json`, plus earlier gate reports.
`manifest.csv` records geometry and dimensions; `manifest.json` records hashes.
Static checks cover dimensions, alpha, framing, embedded GLBs, triangle counts,
shared scene and master preservation. No mobile runtime import/device claim.

Next after Gate 4 approval: six 2-second, 48-frame, 512px seamless loops and GIF
previews. Loops remain masters until runtime animation delivery is decided.
No runtime intake, publishing, signed build or production deployment performed.

