# Face pool — drop your expanded 3D faces here

This folder is the landing zone for the extra character faces that fix the
"everyone's a clone" problem. Generate them in the **exact style** of the 5 faces
in the parent folder (`../Male.png`, `../Female.png`, `../Old_Male.png`) — full
prompts + style lock in **`docs/avatar-portraits-prompts.md`**.

## Naming (this is what the seeded picker reads)

```
<sex>_<band>_<nn>.png      (babies: baby_<nn>.png · heroes: hero_<role>.png)
```

- `<sex>` = `m` (man) · `f` (woman)
- `<band>` = `ya` (18–29) · `ad` (30–39) · `mid` (40–55) · `sr` (55+) · `tn` (13–17) · `kid` (5–12)
- `<nn>` = two-digit index, `01`, `02`, …

**Examples:** `f_ya_01.png`, `m_ad_03.png`, `f_mid_02.png`, `m_sr_01.png`,
`f_kid_02.png`, `baby_01.png`, `hero_mom.png`

The complete list of ~75 faces — every copy‑paste prompt + its exact filename —
is in **`docs/avatar-portraits-prompts.md`**, with a priority order if you don't
do them all at once. The original `Baby` / `Old_Male` / `Old_Female` stay in the
parent folder as guaranteed fallbacks.

## What happens next

Once files are here, the `getPortrait(seed, age, sex)` picker (to be wired) will
deterministically assign them across Spark, Contacts, Family, Prestige and
Hustle — each NPC gets a stable, unique face, with the original 5 as fallbacks so
empty buckets never break. Just generate, name, drop, and ping.
