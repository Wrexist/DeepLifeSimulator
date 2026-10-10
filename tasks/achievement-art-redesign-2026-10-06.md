# Achievement artwork redesign — 6 October 2026

Owner rejected generic metallic frames in the achievement rows. This supersedes
the 6 October rarity-frame presentation approval assumption, not other user work.

- [x] Inventory the current catalogue by stable ID/title/meaning.
- [x] Produce distinct, detailed illustrative objects for wealth, work and property.
- [x] Inspect individual artwork and actual card-scale readability before extending
  the family across every achievement. No generic rarity-only substitution.
- [x] Replace rejected row frames with existing subject art while new art is reviewed.
- [x] Owner approved the new illustration direction and requested matching UI/UX.
- [x] All 10 beginner achievements illustrated and integrated (nine added after pilot).
- [x] All six wealth and eight career achievements illustrated and integrated.
- [x] All education, company and workforce achievements illustrated and integrated.
- [x] All health, fitness and happiness achievements illustrated and integrated.
- [x] All Nighter added to finish the mounted Health category.
- [ ] Remaining 113 individual illustrations.

New direction: sophisticated editorial 3D, tactile material detail, carefully
lit layered objects, rich emerald/teal/cream with restrained gold. No text baked
into art. This is a new raster illustration direction, not editable Blender/GLB.
All existing game data and reward eligibility remain untouched.

## Delivered direction samples

[Art review](../art/achievement-illustrations-v2/review.png) and
[actual phone card](../art/achievement-illustrations-v2/in-app-375.png).

- Triple Digits: emerald leather wallet, cream notes and machined gold coins.
- First Paycheck: teal work satchel, appointment envelope, pen and ID pass.
- Real Estate Mogul: keys, house charm and property folio; represents the
  property subject, not a changed requirement (still five properties).

Built-in image-generation outputs are preserved as PNG originals in
`art/achievement-illustrations-v2/`. Runtime WebPs at 512px are mapped by stable
achievement ID in `lib/config/achievementArtwork.ts`. Generated pixels contain
no title or reward values. Catalogue JSON explicitly marks three as approved and
156 as needing individual artwork; not a completed delivery. Sources are raster,
with no claim of Blender geometry/GLB exports for this new direction.

Verified full alpha range, original hashes and loaded runtime files. Live Expo
achievement-sheet open/close passed at 375x667 and 768x1024. Inspected Triple
Digits at its 64px app size; source types and changed-file lint passed. No reward
or claim logic changed. Native review remains pending. The generic rarity metal
row mapping is rejected and removed; prior catalogue icons remain for IDs without
new artwork. Earlier profile evidence screenshots were refreshed during the
first check; current v2 screenshots are stored with this art batch.

Beginner completion: see achievement-beginner-art-2026-10-06.md. Current totals
are 12 integrated illustrations / 159 achievements, with 147 still pending.

Wealth/career completion: achievement-wealth-career-art-2026-10-06.md. Current
coverage is 25/159, with 134 pending. Prior batch counts above are historical.

Education/business completion: achievement-education-business-art-2026-10-06.md.
Current coverage: 35/159; 124 pending. Earlier batch totals are historical.

Health completion: achievement-health-art-2026-10-06.md. Current coverage 45/159;
114 pending. Earlier batch totals are historical.

All Nighter addition brought coverage to 46/159, 113 pending.

Family, relationship and parenting artwork: achievement-family-relationship-art-2026-10-10.md.
That batch brought coverage to 57/159.

Collector, gold and crypto artwork: achievement-collectibles-crypto-art-2026-10-10.md.
That batch brought coverage to 69/159.

Crime/legal artwork: achievement-crime-art-2026-10-10.md. That batch brought
coverage to 80/159.

Life milestones and civic leadership artwork: achievement-life-milestones-art-2026-10-10.md
and achievement-politics-art-2026-10-10.md.

Pulse, social, Spark, wealth/prestige and travel/street/hobby groups complete.
All 159 stable catalogue IDs now have individual art and a runtime mapping;
see achievement-art-completion-2026-10-10.md for the full gallery and file audit.
App-level and native-device acceptance remain pending.
