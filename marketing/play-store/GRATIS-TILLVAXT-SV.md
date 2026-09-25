# Gratis tillväxt på Google Play — vad som faktiskt flyttar nålen

Mätt i Play Console 2026-09-25, inte gissat:

| Mått (senaste 28 dagarna) | Värde | Vad det betyder |
|---|---|---|
| Besökare på butikssidan | **14** | Nästan ingen hittar hit |
| Installationsklick | **13** | |
| Konvertering | **93 %** | Butikssidan är INTE problemet |
| Installationer totalt (produktion) | 57 | v2.13.0, 176 länder |
| Översättningar | sv, de, es … live | Redan klart |

**Slutsats: flaskhalsen är trafik.** Fler A/B-test av ikon och skärmbilder
ger procent av 14 besökare. Allt nedan handlar om att få fler människor till
sidan — gratis.

---

## Gör nu (~15 min)

1. **Skicka in Halloween-eventet** — `promo-events/2026-10-halloween-SV.md`
   (5 min, deadline 2 okt). Play-event syns i *Event*-fliken, i sökresultat
   och på butikssidan — gratis exponering för spelare som aldrig hört om
   spelet. Under förhandsvisningen (från 2 okt) kan folk anmäla sig för en
   avisering när eventet startar.
2. **Merga PR:en** (2 min). Den lägger in eventet i spelet (når v2.13.0 utan
   uppdatering), fixar delningslänken och byter "Android beta" till
   "Google Play" på webbplatsen.
3. **Få de första betygen** (5 min). Appen har **0 betyg** — Play visar inga
   stjärnor förrän det finns några, och betyg väger in i sökrankningen. Be
   Android-spelarna i Discord om ett *ärligt* betyg, utan belöning. Spelets
   egen betygsprompt (Play In-App Review) sköter resten när spelare har goda
   veckor.

## Denna vecka

4. **Nästa Android-bygge (2.15.0)** tar med delningsfixen till spelarna. Innan
   dess skickade varje delning från Android vännerna till Apples App Store.
   (~30 min för dig, bygget är ditt beslut.)
5. **1 kort video om dagen** i 7 dagar på TikTok / YouTube Shorts / Reels.
   Livssimulatorer går viralt på *utmaningar*, inte på reklam. Färdiga manus:
   `marketing/tiktok_scripts.md`, färdiga klipp: `marketing/videos/`.
   Halloween-krokar att spela in:
   - "Jag försökte överleva halloween med 70 i lycka OCH hälsa"
   - "Kan en fattig 18-åring nå 70 i lycka på fyra veckor?"
   - "Jag spelade tills jag dog — här är min dödsruna" (visa delningskortet)

## Spårbara länkar (fungerar efter merge)

Använd EN länk överallt, med olika `src` — då visar Play Console vilken kanal
som ger installationer (*Butikens resultat → Butiksanalys*, UTM-källa):

| Kanal | Länk |
|---|---|
| TikTok-bio | `https://wrexist.github.io/DeepLifeSimulator/get/?src=tiktok` |
| YouTube | `https://wrexist.github.io/DeepLifeSimulator/get/?src=youtube` |
| Reddit | `https://wrexist.github.io/DeepLifeSimulator/get/?src=reddit` |
| Discord | `https://wrexist.github.io/DeepLifeSimulator/get/?src=discord` |
| Instagram | `https://wrexist.github.io/DeepLifeSimulator/get/?src=instagram` |

Länken skickar Android till Google Play och iPhone till App Store, och ger en
snygg förhandsvisning (bild + titel) i WhatsApp, Discord, iMessage och X.

## Q4-kalender för Play-event (4 framhävningar/kvartal för spel)

| # | Event | Fönster | Skicka in senast | Status |
|---|---|---|---|---|
| 1 | Halloween "Nothing to Fear" | 16 okt – 6 nov | **2 okt** | klart att skicka |
| 2 | *Valfritt:* Black Friday-erbjudande (typ **Erbjudande**) | 27 nov – 1 dec | 13 nov | ditt beslut: kräver en riktig rea på gem-paket/ta bort reklam i Play Console |
| 3 | Jul "Home for the Holidays" | 18 dec – 4 jan | **4 dec** (tidigast 19 okt) | klart att skicka — `promo-events/2026-12-holidays-SV.md` |

Hoppa över *Större uppdatering* för 2.15.0: den är buggfixar, och Google
avvisar rutinuppdateringar. Spara den typen till en version med en ny funktion.

Regel: ett Play-event måste gälla **alla** användare. Spelets egna event
`autumn_foundations`, `second_act` och `winter_ledger` är spärrade till vissa
stadier och kan därför inte marknadsföras på Play — därför fick Halloween inget
stadiefilter.

## Reddit

Färdiga, regelsäkra inlägg: `GROWTH-PLAYBOOK.md`. Ändra "Android (new)" till
"live on Google Play" och använd `?src=reddit`-länken. En subreddit per dag,
säg att du är utvecklaren, svara på allt inom en timme.

## Gör INTE (får appen borttagen eller kontot avstängt)

- Belöna betyg eller recensioner (gems, koder, tävlingar för 5 stjärnor).
- Köpa installationer, recensioner eller "gratis marknadsföring"-tjänster.
- Egna alt-konton som kommenterar eller recenserar.
- Nämna andra spels namn (t.ex. BitLife) i titel, beskrivning eller event.
- Event-text som lovar något spelet inte ger.
