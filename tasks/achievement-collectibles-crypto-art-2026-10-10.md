# Collectibles and cryptocurrency achievement artwork - 10 October 2026

- [x] Create seven collector/gem illustrations and five crypto illustrations.
- [x] Replace generated recognizable coin marks with plain unbranded tokens.
- [x] Preserve transparent originals; package 512px runtime assets and record hashes and alpha bounds.
- [x] Update the ID map and catalogue; verify every integrated ID resolves to a runtime file.

The twelve illustrations cover Collector Supreme/Legend, all five gem milestones,
Crypto Portfolio/Curious/Trader/Millionaire/Tycoon. The five crypto pieces use
unmarked tokens without recognizable exchange or coin logos.

[Artwork review](../art/achievement-illustrations-v2/collectibles-crypto-review.html)
[Final prompts and source paths](../art/achievement-illustrations-v2/collectibles-crypto-prompts.json)
[Packaging validation](../art/achievement-illustrations-v2/collectibles-crypto-validation.json)

Built-in image generation was used, one call per distinct asset. Original RGBA
PNGs remain in `art/achievement-illustrations-v2/`; runtime WebPs are 512px under
`assets/images/achievement-v2/`, referenced from
`lib/config/achievementArtwork.ts`.

Catalogue accounting at completion: 69 of 159 achievements have integrated
individual illustrations; 90 remain. Next groups: crime and public life.
No app or native-device acceptance was run for this asset batch.
