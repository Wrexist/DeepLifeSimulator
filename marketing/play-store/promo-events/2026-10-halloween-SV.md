# Play-händelse: Halloween 2026 "Nothing to Fear" — fält för fält

**Status (2026-09-25):** steg 1–2 är ifyllda i din Chrome-flik
(*Kampanjinnehåll → Skapa händelse*). Kvar: steg 3 (text + bilder) och
steg 4 (skicka in). Tid: ~5 minuter.

**Deadline: skicka in senast 2 oktober.** Google kräver 14 dagars
framförhållning för att kunna framhäva (featura) eventet, och upp till 4 dagar
för granskning. Förhandsvisningen på Play startar 2 oktober.

> Eventet måste finnas i spelet när det startar (Googles regel). Det gör det
> när PR:en med `support-site/liveops.json` är mergad till `main` — ingen
> appuppdatering behövs, v2.13.0 i produktion läser kalendern vid start.
> Merga före 16 oktober.

---

## Steg 1 — Konfiguration ✅ klart

- **Skapa ny händelse**

## Steg 2 — Lägg till detaljer ✅ klart

| Fält | Värde |
|---|---|
| Händelsens namn (internt) | `Halloween 2026 - Nothing to Fear (in-game event halloween_nothing_to_fear)` |
| Händelsetyp | **Tidsbegränsade händelser → Tävling, utmaning** |
| Länder | **Alla tillgängliga (176 länder/regioner)** |
| Startdatum | **16 okt. 2026, 00:00 UTC** |
| Slutdatum | **6 nov. 2026, 00:00 UTC** |
| Förhandsgranska händelsen | **Visa det här eventet på Play före startdatumet → 14 dagar innan** |

## Steg 3 — Lägg till innehåll (gör detta)

**Språk: Standard: Engelska (USA) – en-US**

**Tagline** (72/80 tecken):
```
Halloween event: get happiness and health to 70 and claim 250 bonus gems
```

**Beskrivning** (470/500 tecken):
```
From October 16 to November 6, Deep Life Simulator celebrates Halloween with a limited-time event called Nothing to Fear. It shows up in your goals on the home screen of every life, whether you started yesterday or you are three generations into a dynasty. Get your character's happiness and health up to 70 at the same time, keep your current life going for at least four weeks, and a 250 gem Halloween bonus is yours to claim toward permanent upgrades in the Gem Shop.
```

**Bilder** (i `marketing/play-store/promo-events/out/`):

| Fält | Fil | Spec |
|---|---|---|
| Primär bild | `halloween-2026-1920x1080.jpg` | 1920×1080, 96 KB |
| Kvadratisk bild | `halloween-2026-1080x1080.jpg` | 1080×1080, 71 KB |
| Animation / video | hoppa över | valfritt |

Bilderna följer Googles regler: ingen text, ingen logga, inga ramar eller
rundade hörn, motivet inom säkerhetszonen (10 % sidor, 15 % topp, 20 % botten).
Bygg om dem med `python marketing/play-store/promo-events/build_halloween.py`.

**Svenska (valfritt):** finns *sv-SE* i språkväljaren, lägg till:

Tagline (65/80):
```
Halloween-event: nå 70 i lycka och hälsa och hämta 250 bonus-gems
```
Beskrivning (440/500):
```
Från 16 oktober till 6 november firar Deep Life Simulator halloween med det tidsbegränsade eventet Nothing to Fear. Det dyker upp bland dina mål på hemskärmen i varje liv, oavsett om du började i går eller är tre generationer in i en dynasti. Få upp din karaktärs lycka och hälsa till 70 samtidigt, håll ditt nuvarande liv igång i minst fyra veckor, så väntar en halloweenbonus på 250 gems att lägga på permanenta uppgraderingar i Gem Shop.
```

## Steg 4 — Granska och bekräfta

1. Läs igenom sammanfattningen.
2. Om det finns ett val för **framhävning / featuring**: begär det (spel har
   4 sådana per kvartal för bred målgrupp).
3. **Skicka in.** Obs: ett inskickat event går inte att redigera.

---

## Varför siffrorna är sanna (Google avvisar vilseledande text)

Allt i texten matchar eventet i `support-site/liveops.json`:

| Påstående | I spelet |
|---|---|
| 16 okt – 6 nov | `startsAt` 2026-10-16T00:00Z, `endsAt` 2026-11-06T00:00Z |
| Varje liv, ny som gammal | ingen `eligibility` → alla stadier |
| Lycka och hälsa 70 samtidigt | objectives `happiness` 70 + `health` 70 |
| Minst fyra veckor i livet | objective `weeks_this_life` 4 |
| 250 gems | reward `gems` 250 |
| Syns bland målen på hemskärmen | `GoalsCard` visar aktivt/claimbart live-event |
| Gem Shop-uppgraderingar | `lib/config/gemUpgrades.ts` |
