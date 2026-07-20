# The Update's Editorial Angle & "What's New" Copy

An editor reading your "What's New" is deciding whether there's a *story* worth a
feature slot. A changelog isn't a story. This doc gives you the hook first, then
copy in three registers: **editor pitch**, **store "What's New"**, and **full
release notes**.

Everything here is grounded in improvements already documented in
`WHATS_NEW.md` — no invented features.

---

## The hook (one sentence)

> **The economic life sim you actually wanted just got fast, fair, and rock-solid —
> this is the version to meet it on.**

## The story (one paragraph — this is what you pitch)

> Deep Life Simulator always had the ambition: a life sim with a *real* economy
> where your choices compound. This update delivers on it. The game now feels
> **instant** — tapping "Next Week" responds immediately, income math is up to ~90%
> faster, and menus open with no lag. It plays **fair by design** — crime only pays
> when you actually get away with it, money exploits are closed, and a live safety
> net guarantees currency can never appear from nowhere. And it's **dependable** —
> 70+ fixes, hardened saves, and a crash-on-launch test suite that catches the
> startup bugs before players ever see them. It's a turnaround, and it's the first
> impression we want new players to have.

**Why editors care:** speed, fairness, and reliability are the three things that
make a sim *featurable* rather than merely playable. This update hits all three and
frames them as design values, not patch notes.

---

## Copy A — Editor pitch blurb (for nomination "what's new" fields)

```
This update is a turnaround. Deep Life Simulator now feels instant — immediate
week-advance, ~90% faster income math, and lag-free menus. It plays fair by design:
getting caught no longer rewards you, money exploits are closed, and a live
invariant guarantees currency can never appear from nowhere. And it's dependable:
70+ fixes, hardened saves, and a crash-on-launch test suite covering all tabs and
onboarding. Plus accessibility polish — WCAG-AA light-mode contrast and
reduced-motion support. It's the version we want new players to discover.
```

---

## Copy B — Store "What's New" (player-facing, copy-paste ready)

> Fill in the version number when the build is finalized.

```
v[X.Y.Z] — Faster, Fairer, Rock-Solid

We rebuilt how the game feels. This is our biggest polish pass yet.

⚡ Instant to play
• "Next Week" responds immediately — no more waiting on the weekly update
• Money and stats change the moment you act
• Menus and screens open instantly

⚖️ Fair by design
• Getting caught no longer rewards you — crime XP counts only when you succeed
• Closed money exploits, with a live safety net so money can't appear from nowhere
• Weekly bonuses respect the rules and count toward your real lifetime total

🛡️ Rock-solid
• 70+ fixes across saves, the economy, and the store
• Hardened saves — safer through very long lifetimes
• Fixed rare double-deaths, "NaN" stats, and a jail freeze

♿ Polish
• More readable text in light mode (WCAG-AA contrast)
• Reduced-motion support for a calmer experience

No forced ads. No pay-to-win. Just a fair, strategic life sim.
Join the community: discord.gg/deeplifesim
```

---

## Copy C — Full release notes (long form)

Reuse the detailed, already-verified notes in the repo's top-level `WHATS_NEW.md`
(Performance / IAP / Stability / Economy & Fair Play / Accessibility / Under the
Hood sections). They're accurate and thorough — link or paste them for anyone who
wants the full list. Just make sure whatever you show an **editor** leads with Copy
A/B above, not the raw changelog.

---

## Do / don't for the "What's New" field

**Do**
- Lead with the one-sentence hook and the "feels instant / fair / solid" trio.
- Keep it to ~5 short, scannable groups with emoji anchors.
- Name the player-first values (no forced ads, no pay-to-win) — editors reward them.
- Tie it to a date and, ideally, an In-App Event (doc 06).

**Don't**
- Open with "bug fixes and performance improvements" (invisible to editors).
- Paste the full 100-line changelog into the store field.
- Claim anything not verified in the build (esp. Dynamic Type / VoiceOver flow).
- Mention competitor trademarks in metadata (fine as comparison in body copy only).
