# Face pool — drop your expanded 3D faces here

This folder is the landing zone for the extra character faces that fix the
"everyone's a clone" problem. Generate them in the **exact style** of the 5 faces
in the parent folder (`../Male.png`, `../Female.png`, `../Old_Male.png`) — full
prompts + style lock in **`docs/avatar-portraits-prompts.md`**.

## Naming (this is what the seeded picker reads)

```
<sex>_<ageband>_<nn>.png
```

- `<sex>` = `m` (man) · `f` (woman)
- `<ageband>` = `ya` (young adult, ~18–29) · `ad` (adult, ~30–39) · `mid` (middle-aged, ~40–55)
- `<nn>` = two-digit index, `01`, `02`, …

**Examples:** `f_ya_01.png`, `f_ya_02.png`, `f_ad_01.png`, `m_ya_01.png`,
`m_mid_02.png`

A good first batch: ~a dozen women + a dozen men across skin tones and hair,
mostly `ya`/`ad`. Keep `Baby` / `Old_Male` / `Old_Female` in the parent folder for
kids and seniors (add `old_m_02.png` etc. here later if you want senior variety).

## What happens next

Once files are here, the `getPortrait(seed, age, sex)` picker (to be wired) will
deterministically assign them across Spark, Contacts, Family, Prestige and
Hustle — each NPC gets a stable, unique face, with the original 5 as fallbacks so
empty buckets never break. Just generate, name, drop, and ping.
