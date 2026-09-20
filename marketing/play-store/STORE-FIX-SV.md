# Fixa hela Play-butiken - exakt vad du gör, fält för fält

Din live-butik har tre problem. En av dem är allvarlig. Gör i denna ordning.

## ⚠️ 1. Innehållsklassificeringen är FEL (gör först)

Din butik visar **PEGI 3**. Det är fel: spelet har **brott, dark web och
simulerat spel om pengar** (aktier/krypto). Fel klassificering kan få Google att
**ta bort appen**, och den visas för barn just nu.

**Gör så här:**
1. **Skyddas med Play → Appinnehåll → Innehållsklassificering** (Content rating).
2. Klicka på kategorin och **fyll i enkäten om igen**, ärligt:
   - **Våld:** Nej.
   - **Brott / kriminalitet:** Ja (brott och dark web är en spelväg).
   - **Simulerat spel om pengar:** Ja (aktier, krypto - ingen riktig vadslagning).
   - **Alkohol/droger:** Mild.
   - **Sexualitet:** Mild (dejting, äktenskap, inget explicit).
   - **Språk:** Mild.
3. Skicka in. Förväntat resultat: **PEGI 12 eller 16 / Teen**. Detta kräver ny
   granskning av butiken (några timmar-dagar).

> Din app är kompatibel med Google Play Billing i testkanalen men butiken är
> fortfarande märkt "Delta Inc." och 5+ nedladdningar - det är den gamla
> publiceringen. Nästa granskning uppdaterar den.

## 2. Titeln

Live: `Deep Life Simulator` (19 tecken, 11 oanvända).

**Byt till (30 tecken, lägger till sökordet "tycoon"):**
```
Deep Life Simulator: Tycoon
```
**Var:** **Öka antalet användare → Butiksnärvaro → Huvudbutikslistning → App-namn.**
(Titelbyte kräver ny granskning.)

## 3. Skärmbilderna (5 gamla → 8 nya)

**Var:** **Öka antalet användare → Butiksnärvaro → Huvudbutikslistning → Telefonbilder.**
Ta bort de 5 gamla och ladda upp **alla 8** i denna ordning (filerna ligger i
`marketing/play-store/screenshots/`):

| Ordning | Fil | Vad den visar |
|---|---|---|
| 1 | `01-your-life.png` | Small start. Big life. |
| 2 | `02-build-an-empire.png` | Build it. Be the boss. |
| 3 | `03-find-love.png` | Hitta kärlek |
| 4 | `04-reach-the-top.png` | Dream job? Work for it. |
| 5 | `05-build-your-wealth.png` | Bygg förmögenhet |
| 6 | `06-drive-the-dream.png` | Kör drömmen |
| 7 | `07-shape-your-story.png` | Forma din story |
| 8 | `08-become-a-creator.png` | Bli creator |

Alla är **1080x1920 (9:16)** med **3D-modeller, glöd och partiklar** - godkända av
Play (max 2:1). Ladda **inte** upp iOS-bilderna (2.17:1) - de avvisas.

## 4. Övriga fält - kontrollera att de stämmer

| Fält | Värde |
|---|---|
| Kort beskrivning | `Career, crime, stocks and property. Build a fortune, then pass it on.` |
| Fullständig beskrivning | `PLAY.longDescription` i `marketing/aso/metadata.mjs` |
| Appikon | `marketing/play-store/icon-512.png` |
| Funktionsgrafik | `marketing/play-store/feature-graphic-1024x500.png` |
| Kategori | Simulering (Simulation) |
| Integritetspolicy | `https://wrexist.github.io/DeepLifeSimulator/privacy.html` |
| Supportwebbplats | `https://wrexist.github.io/DeepLifeSimulator/support.html` |

## 5. Efteråt - lokaliseringar (fler nedladdningar)

Lägg till språken i `marketing/play-store/LOCALIZATIONS.md` under
**Huvudbutikslistning → Hantera översättningar**. Börja med **svenska** (din
hemmamarknad) - texten är färdig.

## 6. Sist - A/B-testa för fler installationer

**Öka antalet användare → Butikslistningsexperiment.** Testa **ikonen** först
(största effekten), sedan första skärmbilden. Detta är gratis och höjer
konverteringen permanent.

---

### Checklista

- [ ] Innehållsklassificering gjord om (PEGI 3 → 12/16)
- [ ] Titel bytt till "Deep Life Simulator: Tycoon"
- [ ] 5 gamla skärmbilder borttagna, 8 nya uppladdade
- [ ] Kort + lång beskrivning kontrollerade
- [ ] Ikon + funktionsgrafik kontrollerade
- [ ] Svenska listningen tillagd
- [ ] Butikslistningsexperiment startat (ikon)
