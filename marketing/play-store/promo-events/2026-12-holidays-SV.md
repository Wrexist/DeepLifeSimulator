# Play-händelse: Jul 2026 "Home for the Holidays" — fält för fält

**Skicka in mellan 19 oktober och 4 december.** Tidigast 60 dagar före start,
senast 14 dagar före för att kunna begära framhävning. Julveckan är årets
största vecka för appnedladdningar (nya telefoner i julklapp) — det här är
Q4:s viktigaste event-plats.

> Eventet finns i spelet när PR:en med `support-site/liveops.json` är mergad
> (id `winter_holidays_home`). Ingen appuppdatering behövs.

Tid: ~10 minuter. Samma formulär som Halloween: *Öka antalet användare →
Butiksvisning → Kampanjinnehåll → Skapa händelse*.

## Steg 1 — Konfiguration

- **Skapa ny händelse**

## Steg 2 — Lägg till detaljer

| Fält | Värde |
|---|---|
| Händelsens namn (internt) | `Holidays 2026 - Home for the Holidays (in-game event winter_holidays_home)` |
| Händelsetyp | **Tidsbegränsade händelser → Tävling, utmaning** |
| Länder | **Markera alla** → Tillämpa |
| Startdatum | **18 dec. 2026, 00:00 UTC** |
| Slutdatum | **4 jan. 2027, 00:00 UTC** |
| Förhandsgranska händelsen | **Visa före startdatumet → 14 dagar innan** |

Tips från Halloween-ifyllningen: datumväljaren har ett textfält "Ange datum"
överst, och tidslistan väljs säkrast med piltangenterna + Enter.

## Steg 3 — Lägg till innehåll

**Språk: Standard: Engelska (USA) – en-US**

Tagline (78/80):
```
Holiday event: set aside $2,500, keep happiness at 65 and claim 200 bonus gems
```

Beskrivning (487/500):
```
From December 18 to January 4, Deep Life Simulator celebrates the holidays with a limited-time event called Home for the Holidays. It shows up in your goals on the home screen of every life, whether you started yesterday or you are three generations into a dynasty. Set aside at least $2,500 in cash, keep your character's happiness at 65 or higher and keep your current life going for three weeks, and a 200 gem holiday bonus is yours to claim toward permanent upgrades in the Gem Shop.
```

**Bilder** (`marketing/play-store/promo-events/out/`):

| Fält | Fil |
|---|---|
| Primär bild | `winter-2026-1920x1080.jpg` |
| Kvadratisk bild | `winter-2026-1080x1080.jpg` |

**Svenska (valfritt, sv-SE):**

Tagline (67/80):
```
Julevent: spara 2 500 $, håll lyckan på 65 och hämta 200 bonus-gems
```
Beskrivning (451/500):
```
Från 18 december till 4 januari firar Deep Life Simulator helgerna med det tidsbegränsade eventet Home for the Holidays. Det dyker upp bland dina mål på hemskärmen i varje liv, oavsett om du började i går eller är tre generationer in i en dynasti. Ha minst 2 500 $ i kontanter, håll din karaktärs lycka på 65 eller mer och håll ditt nuvarande liv igång i tre veckor, så väntar en julbonus på 200 gems att lägga på permanenta uppgraderingar i Gem Shop.
```

## Steg 4 — Granska och bekräfta

1. Begär **framhävning** om valet finns.
2. **Skicka in.** Ett inskickat event går inte att redigera.

## Varför siffrorna är sanna

| Påstående | I spelet (`support-site/liveops.json`) |
|---|---|
| 18 dec – 4 jan | `startsAt` 2026-12-18T00:00Z, `endsAt` 2027-01-04T00:00Z |
| Varje liv | ingen `eligibility` → alla stadier |
| $2 500 undanlagt | objective `cash_on_hand` 2500 |
| Lycka 65 | objective `happiness` 65 |
| Tre veckor | objective `weeks_this_life` 3 |
| 200 gems | reward `gems` 200 |

Budget: för sena/slutspel-stadiet löper `winter_ledger` (500 gem-värde)
samtidigt; 150 + 500 + 200 = 850 ≤ veckobudgeten 900, så ingen spelare kan
klara eventet och sedan nekas belöningen. `publishedCalendar.test.ts` håller
det.
