# Deep Life illustrated catalogue family

Approved UI reference: `docs/PRESENTATION_SYSTEM.md`, 27 September 2026.

## Retention and replacement

| Family | Decision | Runtime owner |
| --- | --- | --- |
| 19 pet breeds | Replace primary emoji identity in adoption, active pet, detail, roster and memorial with distinct portraits. | CatalogArt / PETS_ART |
| 17 travel destinations | Replace destination emoji with local landmark miniatures; use the same image in the fare detail. Keep route codes and all quoted costs. | CatalogArt / TRAVEL_ART |
| 16 vehicles including aircraft | Replace Garage/dealer photography and aircraft placeholders with a consistent illustrated catalogue. Keep legacy image files for other consumers/history; no domain-template mutation. | CatalogArt / VEHICLES_ART |
| Illustrated player/NPC identities | Retain accepted V06 family and inheritance/aging. | CharacterAvatar |
| Creator media | Retain accepted media-v2. | mediaArtAssets |
| Rendered destination rooms | Retain original local scene family. | SceneCard |
| Luxury catalogue photography | Replaced by the matching 12-item luxury-v2 family in the subsequent batch. | CatalogArt / LUXURY_ART |
| Food/toy/vet emoji | Retained secondary functional symbols; not animal identities. A separate icon cleanup can migrate them to existing vector icons. | PetApp |

Original sheets and a replacement helicopter live in `originals/`. Exact built-in
imagegen prompts are in `prompts.json` and `helicopter-prompt.json`. The original
helicopter sheet tile clipped the rotor, so it was rejected for runtime use.

Rebuild with `node scripts/normalize-life-art.cjs`. The script records precise
reviewed grid cuts, flattens alpha onto navy, exports 256x256 WebP and writes
stable-ID require maps and SHA-256 manifests. No runtime remote URLs or native
library additions. Unknown/failed artwork uses a non-emoji vector fallback.

These are expressive game illustrations rather than literal breed/landmark
photographs. Native sharpness and decode/memory acceptance remain open.
