# DeepLife Simulator - Guide till Google Play Console (för dig som kan App Store Connect)

Du är helt ny i Play Console. Den här guiden säger exakt vilken flik du klickar
på, i vilken ordning, och vad du klistrar in. Engelska ord står i parentes så du
känner igen dem om konsolen byter språk.

Viktigast att avlära sig: **Play har inget nyckelfältsfält (keywords).** Play
indexerar **titeln**, **kort beskrivning** och **lång beskrivning** - så
sökorden ligger i den långa beskrivningen. Allt annat är som App Store Connect,
bara andra namn.

## 1. Karta över vänstermenyn

| Flik i din konsol | Engelska | Vad den är till |
|---|---|---|
| **Översikt** | Dashboard | Checklistan "Lansera appen". Här ser du vad som återstår. |
| **Statistik** | Statistics | Nedladdningar, intäkter, betyg. Titta efter lansering. |
| **Publiceringsöversikt** | Publishing overview | Status för det du skickat till granskning. |
| **Skyddas med Play** | Protect with Play / Policy | Här ligger **Appinnehåll (App content)** och policyfrågor. **Börja här.** |
| **Testa och lansera** | Test and release | Alla testkanaler (intern/sluten/öppen) och **Produktion**. Här laddar du upp versionen. |
| **Övervaka och förbättra** | Monitor and improve | Kraschar, ANR, recensioner, vitals. |
| **Öka antalet användare** | Grow | **Butiksnärvaro (Store presence)** = butikslistningen, text och bilder. |
| **Generera intäkter med Play** | Monetize | In-app-produkter och prenumerationer (våra 27 + 2). |

## 2. Ordlista (Apple -> Play)

| App Store Connect | Google Play Console |
|---|---|
| TestFlight | **Intern testning / Öppen testning** (testkanaler) |
| Appintegritet (App Privacy) | **Data safety** (under Appinnehåll) |
| Åldersgräns | **Innehållsklassificering** (IARC-enkät) |
| Nyckelfält (keywords) | *finns inte* |
| Reklamtext (Promotional text) | *finns inte* |
| Ikon 1024 | **Ikon 512** |
| Bygge från Xcode | **App Bundle (.aab)** |

## 3. Steg för steg

### Steg 1 - Fyll i Appinnehåll (App content) - detta blockerar allt annat
1. Klicka **Skyddas med Play** i vänstermenyn.
2. Öppna **Appinnehåll**.
3. Fyll i alla kort (nästa avsnitt har svaren):
   - Integritetspolicy (Privacy policy)
   - Appåtkomst (App access)
   - Annonser (Ads)
   - Innehållsklassificering (Content rating)
   - Målgrupp (Target audience)
   - Datasäkerhet (Data safety)
   - Statliga appar (Government apps)
   - Finansiella funktioner (Financial features)
4. När allt är grönt: gå vidare till Steg 2.

**Svar att klistra in / välja:**
- Integritetspolicy: `https://wrexist.github.io/DeepLifeSimulator/privacy.html`
- Appåtkomst: **Nej, ingen inloggning.** Skriv till granskaren: "Tryck på **Play** på huvudmenyn för att starta ett liv."
- Annonser: **Ja, appen innehåller annonser.**
- Målgrupp: **13+**. Kryssa INTE i "Avsedd för barn".
- Innehållsklassificering: svara ärligt - brott och dark web finns, börshandel/krypto är **simulerat spel om pengar**, dejtning/mild alkohol förekommer. Förvänta Teen / PEGI 12+.
- Datasäkerhet: Insamlat = **Appaktivitet** + **Enhets-ID/annons-ID**; delat = **annons-ID med Google (annonser)**; krypterat vid överföring = **ja**; radering = via appens begäran om radering (länka till integritetspolicyn).
- Statliga appar: **Nej.** Finansiella funktioner: **Nej** (spelet simulerar bara pengar).

### Steg 2 - Butikslistningen (Store listing)
1. Klicka **Öka antalet användare** → **Butiksnärvaro (Store presence)** → **Huvudbutikslistning (Main store listing)**.
2. Klistra in:

**Appnamn (max 30):**
```
Deep Life Simulator: Tycoon
```
**Kort beskrivning (max 80):**
```
Career, crime, stocks and property. Build a fortune, then pass it on.
```
**Fullständig beskrivning (max 4000):** kopiera hela `PLAY.longDescription`
från `marketing/aso/metadata.mjs`.

3. Ladda upp bilderna:
   - **Appikon:** `marketing/play-store/icon-512.png` (512x512)
   - **Funktionsgrafik (Feature graphic):** `marketing/play-store/feature-graphic-1024x500.png`
   - **Telefonskärmbilder:** de 8 PNG-filerna i `marketing/play-store/screenshots/`
     (1080x1920). **Ladda INTE upp iOS-skärmbilderna** - de är 2.17:1 och Play
     avvisar allt över 2:1.
4. Kategori: **Simulering (Simulation)**.

### Steg 3 - Testa själv (Test och lansera)
Du är redan på "Översikt" och checklistan säger **1 av 4 klart**. Fortsätt:
1. Klicka **Testa och lansera** → välj kanalen du vill använda (t.ex. **Intern testning**).
2. **Skapa en ny version** → ladda upp `.aab`-filen (redan byggd, versionCode 114)
   om den inte redan ligger där.
3. **Versionsnamn:** `2.13.0`
4. **Viktig information (release notes):**
```
<sv-SE>
Första Android-versionen. Börja ett liv vid 18, bygg det genom karriärer,
marknader, familj och arv - och lämna vidare det du byggt till din arvinge.
</sv-SE>
```
5. **Spara → Förhandsgranska och bekräfta versionen → Skicka till granskning.**
6. Gå till **Testare (Testers)**, lägg till din e-post, spara, och öppna
   **länken för att gå med**. Installera på din Android-telefon.

### Steg 4 - Testa på telefonen
Kolla: startar utan krasch, flikarna fungerar, **annonser laddas**, ett **köp +
Återställ**, bakåtknappen stänger rutor, gamla sparade spel laddas.

### Steg 5 - Produktion
1. **Testa och lansera** → **Produktion** → **Skapa ny version** → välj samma `.aab`.
2. **Staged rollout** (t.ex. 20 %) → följ **Övervaka och förbättra → Android vitals** i ett dygn → höj till 100 %.

## 4. Extra knep för fler nedladdningar (ASO)

- **Svensk butikslistning = extra sökyta.** Lägg till svenska som listningsspråk
  under **Butiksnärvaro → Huvudbutikslistning → Hantera översättningar**, och
  klistra in texten från `marketing/app-store-localizations/sv.md`. Då hittas
  spelet på svenska sökord också.
- **Be om betyg i appen** - redan inbyggt nu (efter en bra vecka). Fler betyg =
  högre placering.
- **Förhandsregistrering (Pre-registration)** på Översikt ökar intresset före
  lansering och ger fler installationer dag ett.
- **Play Butikslistningsexperiment (Store listing experiments)** under
  **Öka antalet användare**: testa två ikoner/skärmbilder mot varandra - gratis
  A/B-test som höjer konverteringen.

## 5. Vanliga nybörjarmisstag

1. Letar efter nyckelfältet. Det finns inte.
2. Laddar upp iOS-skärmbilder (2.17:1) → avvisas.
3. Hoppar över **Appinnehåll** → då går inget att publicera.
4. Laddar upp en **APK** i stället för **.AAB**.
5. Återanvänder Apples versionsnummer - Android har **versionCode** (114) som
   bara får öka.

**Nästa steg:** öppna **Skyddas med Play → Appinnehåll** och börja överst. Skriv
vilken fråga som dyker upp först, så svarar jag exakt vad du ska fylla i.
