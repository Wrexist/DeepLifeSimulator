# Death screen art

`gravestone.webp` — **shipped and wired.** 1024 × 683, quality 90, 98 KB with a
real alpha channel (76% of the canvas is transparent, so the panel behind it
shows through and the wisp glows against it rather than against a grey plate).
It is the hero at the top of `components/DeathPopup.tsx`:

```tsx
<DeathHero
  height={heroHeight}
  mood={quality.mood}
  source={require('@/assets/images/death/gravestone.webp')}
/>
```

`DeathHero` swaps its drawing for the image and keeps the same band height, so
nothing below it moves. Drop a replacement at the same path and the screen picks
it up with no code change — but keep the alpha, and keep it text-free (the game
renders "You Died" over this area, so carved lettering underneath reads as a
rendering bug).

**Do not add a `require` for a file that does not exist yet.** Metro resolves
`require()` at build time, so pointing at a missing asset does not degrade
gracefully — the app fails to bundle. That is why `DeathHero` still keeps its
drawn fallback for the `source`-less case, and why the second hero described in
the docs (`gravestone-longlife.webp`) is *not* referenced anywhere: the file
isn't here.

**Lowercase `death/`.** There was briefly a `Death/` alongside this directory;
git tracks the two as distinct paths but macOS and Windows do not, so a clone on
either would have collapsed them and left one `require` resolving to the wrong
file. Keep new art in this one.

Prompts, sizes and what NOT to generate: `docs/DEATH_SCREEN_ASSETS.md`.
