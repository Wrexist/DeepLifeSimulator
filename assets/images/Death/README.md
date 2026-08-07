# Death screen art

Drop the hero illustration here as `gravestone.webp`, then wire it in
`components/DeathPopup.tsx`:

```tsx
<DeathHero
  height={heroHeight}
  mood={quality.mood}
  source={require('@/assets/images/Death/gravestone.webp')}
/>
```

That is the whole change — `DeathHero` swaps its drawing for the image and keeps
the same band height, so nothing below it moves.

**Do not add the `require` before the file exists.** Metro resolves `require()`
at build time, so pointing at a missing file does not degrade gracefully — the
app fails to bundle. That is the entire reason the hero is drawn from views
today rather than shipped broken and waiting for art.

Prompts, sizes and what NOT to generate: `docs/DEATH_SCREEN_ASSETS.md`.
