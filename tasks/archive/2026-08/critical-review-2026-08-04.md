# Kritisk granskning — DeepLife Simulator, 2026-08-04

Fullständig, avsiktligt hård genomgång. Allt nedan är verifierat mot källan eller
uppmätt med kod som drivits mot de riktiga modulerna. Varje fynd anger hur det
bevisades. Ordnat efter allvarlighetsgrad, inte efter var det ligger.

Baslinje som kördes för den här granskningen:

| Kontroll | Resultat |
|---|---|
| `npm run type-check` | ren |
| `npx jest --ci` | 446 sviter / 5 494 tester gröna, 1 svit skippad |
| `npx jest --coverage` | statements 48.94 · branches 30.48 · functions 38.84 · lines 50.24 |
| `npx eslint .` | 0 fel, **1 234 varningar** |
| `expo export --platform ios` | 12,8 MB hbc-bundle, 307,5 MB bildassets |

---

## A. Kritiska spel-/ekonomibuggar

### A-1. Aktiemarknaden kollapsar deterministiskt mot noll — för alla spelare

**Filer:** `lib/economy/stockMarket.ts:167-250` (`simulateWeek`)

Priset uppdateras `price *= (1 + z·σ)` där `z ~ N(0,1)` (Box-Muller) och
`σ = 4–8 %` per vecka. Det finns **ingen driftterm**. En aritmetiskt medelvärdes-
lös avkastning ger negativ *geometrisk* avkastning: `E[log(1+zσ)] ≈ −σ²/2` per
vecka. Vid σ = 0,08 är det −0,32 %/vecka, vilket över ett helt liv (~3 120
veckor) är en faktor `e^-10`.

Uppmätt genom att driva den riktiga `simulateWeek` + `runStocksWeeklyTick` +
`adjustStockPrice` i exakt samma ordning som veckoloopen (`GameActionsContext.tsx:2236-2341`):

```
FULL PIPELINE (walk + sektortilt), 10 spelår:
  NFLX  $485.20 -> $6.74    x0.0139
  MSFT  $310.45 -> $38.26   x0.1232
  ...
  n=25  min=0.0139  median=0.3215  max=2.3591  förlorare=22/25

FULL PIPELINE, 40 spelår:
  NFLX  $485.20 -> $0.01    x0.0000   (golvet)
  NVDA  $432.50 -> $0.02    x0.0000
  META  $324.15 -> $0.02    x0.0001
  TSLA  $245.67 -> $0.02    x0.0001
  n=25  min=0.0000  median=0.0516  max=12.2469  förlorare=20/25
```

Efter 10 spelår har medianaktien tappat 68 % utan att spelaren gjort något fel.
Efter 40 år ligger fyra aktier på 1-cents-golvet.

Det värsta: `simulateWeek` seedas på `weeksLived`, så det här är **inte otur —
det är exakt samma bana för varje spelare i varje sparfil**. Aktier är en
garanterad långsiktig förlust, och 4,8 % årlig utdelning kompenserar inte
−68 % på tio år. En av spelets rubriksatta pelare är matematiskt trasig.

Kontrast som visar att det är ett förbiseende och inte design: `lib/crypto/marketModel.ts:33-36`
har explicita `meanReturn`-termer per regim (stable +0,0010, bull +0,0150,
bear −0,0120) och är i praktiken drift-neutral. Aktiemodellen fick aldrig samma
behandling.

**Fix:** lägg till en driftterm `μ = σ²/2 + målavkastning` i `simulateWeek`, eller
byt till log-normal (`price *= Math.exp(μ + σ·z)`). Och lägg en regressionstest
som asserterar medianmultipeln över 520 veckor ligger inom ett rimligt band —
inte att funktionen "returnerar ett tal".

### A-2. `resetStockPrices` anropas aldrig i produktion — börskurser läcker mellan liv och slots

**Filer:** `lib/economy/stockMarket.ts:154-159`

Funktionens egen docstring säger "used on prestige/new game". Grep över hela
repot: de enda anroparna är tre testfiler. Prestige, nytt spel och slotbyte
återställer alltså aldrig modulnivå-priserna.

Konsekvenskedja:
- `restoreStockPrices` (`GameActionsContext.tsx:4206-4216`) körs bara vid load
  och bara om `savedMarketPrices` finns.
- Ett **nytt** spel har ingen `savedMarketPrices` → tidig return → modulen
  behåller föregående livs priser.
- Första `nextWeek` snapshottar dem in i den nya sparfilen (`:2554`).

Kombinerat med A-1: arvingen ärver en marknad där NFLX handlas för 1 cent. Det
är också ett generellt designproblem — börsen är **mutabelt modulglobalt tillstånd
utanför `GameState`**, vilket bryter mot hela statsarkitekturen i §4.1.

### A-3. Inflationssystemet är helt dött — och en dokumenterad "fix" kopplade in en död funktion

**Filer:** `lib/economy/inflation.ts:29-67`, `contexts/game/MoneyActionsContext.tsx:3`

`applyWeeklyInflation` har **noll produktionsanropare**. Grep över hela repot ger:

- `contexts/game/MoneyActionsContext.tsx:3` — importerar `applyWeeklyInflation`
  **och** `getInflatedPrice`, använder ingendera (död import, en av 245
  `no-unused-vars`-varningar).
- `components/computer/PoliticalApp.tsx:224` och
  `contexts/game/actions/PoliticalActions.ts:49` — bara kommentarer som
  *påstår* att kopplingen finns.

Följdverkningar:
1. `economy.priceIndex` initieras till `1` (`initialState.ts:1137`) och den enda
   skrivaren är `applyWeeklyInflation`. Indexet är alltså **permanent 1** för
   varje spelare, för alltid.
2. Därmed är `getInflatedPrice(x, 1) === x` på alla ~8 riktiga anropsställen
   (`CompanyActions.ts:49,225`, `MiningActions.ts:368,722,…`). Varje
   "inflationsjusterat" pris i spelet är råpriset.
3. `economy.inflationRateAnnual: 0.03` är ett dött fält.
4. R4-X7-fixen som kopplade politik-`inflationRate` in i `applyWeeklyInflation`
   drog ett rör till en funktion ingen anropar. Politikkorten som lovar
   "Inflation +2.0 %" levererar fortfarande ingenting.

**Varför testerna inte fångade det:** `__tests__/economy/policyEffectsHonesty.test.ts:66-76`
anropar `applyWeeklyInflation` **direkt** och asserterar att policydeltat når
prisindexet. Testet är grönt. Det bevisar att bladet fungerar, inte att
funktionen är nåbar — exakt samma felläge som `applyBenefit`-lärdomen från
2026-06-30 i `tasks/lessons.md`, som uttryckligen säger *"Test the COMBINED
entry point, not just the shared leaf helper"*.

### A-4. Det går inte att gå i konkurs — pengar är hårdgolvade på 0 överallt

**Filer:** `GameActionsContext.tsx:935,952`, `actions/MoneyActions.ts:44`

```ts
const cashBeforeLoans = Math.max(0, currentMoney + totalIncome - incomeTax
  - weeklyRent + housingRentalIncome - housingUpkeep - dietWeeklyCost - educationWeeklyCost);
```

Om summan är negativ klampas den till 0. Hyra, skatt, kost och studielån som
spelaren inte har råd med **efterskänks tyst**, utan att någonstans registreras
som obetalt. `applyLoanAutopay` hoppar dessutom över betalningen helt när
`cashAfter - paymentDue < BANKRUPTCY_FLOOR` (500), och `updateMoney`
(`MoneyActions.ts:37-40`) avvisar varje uttag som skulle gå under noll.

Nettoresultat: pengaaxeln har **inget fail-state**. Man kan inte hamna i skuld,
inte bli vräkt, inte gå omkull. `BANKRUPTCY_FLOOR` heter "konkursgolv" men det
finns ingen konkurs.

Förvärras av att det inte finns någon **obligatorisk** levnadskostnad alls:
`realEstate: []` från start (`initialState.ts:1136`), hyra betalas bara för
poster med `status === 'rented' && !owned`, och mat/prenumerationer/husdjur/
fordon är alla frivilliga. En livssimulator vars centrala spänning — inkomst mot
utgifter — är bortkopplad som standard.

### A-5. Löneskalan är internt inkonsekvent med en faktor ~10

**Filer:** `lib/careers/careerData.ts`, `lib/careers/advancedCareers.ts`, `lib/realEstate/catalog.ts:25-32`

De avancerade karriärerna är kalibrerade som årslön ÷ 52 och kommenterar det:
`salary: 3850, // ~$200k/yr`. Baskarriärerna är det inte:

| Roll | Veckolön | Implicit årslön |
|---|---|---|
| Line Cook | $40 | $2 080 |
| Fast Food Worker | $50 | $2 600 |
| Regional Manager (retail, toppsteget) | $155 | $8 060 |
| Registered Nurse | $420 | $21 840 |
| Medical Intern | $1 700 | $88 400 |
| CEO (advanced, ingångssteget) | $3 850 | $200 000 |

Ingångsläkare tjänar 34× en ingångskock. I verkligheten ~2×. Samtidigt kostar
den billigaste lägenheten $95 000 och `RENT_INCOME_RATE = 0.005` gör hyran
0,5 %/vecka av fastighetsvärdet — en studio genererar $475/vecka, mer än tre
gånger vad hela retail-stegen betalar på toppen.

Effekten är inte "svårt" utan "meningslöst": hela den blåkragade halvan av
karriärträdet är frånkopplad från resten av ekonomin. Den existerar bara som
något att lämna.

### A-6. Kalendern motsäger sig själv: 4 veckor/månad mot 52 veckor/år

**Filer:** `lib/config/gameConstants.ts:9-10`, `GameActionsContext.tsx:478,497-505`

`WEEKS_PER_MONTH = 4` men `WEEKS_PER_YEAR = 52`. 4 × 12 = 48 ≠ 52.

Visningsveckan cyklar på 4 (`nextWeek = ((nextWeeksLived % 4) + 1)`) medan
månaden avancerar på `52/12 = 4,333` veckor (`monthsElapsed = Math.floor(nextWeeksLived / weeksPerMonth)`).
Uträknat:

```
weeksLived= 4  visasSomVecka=1  månaderPasserade=0   <- veckoräknaren nollställs, månaden har inte bytt
weeksLived= 5  visasSomVecka=2  månaderPasserade=1   <- månaden byter mitt i veckocykeln
weeksLived=12  visasSomVecka=1  månaderPasserade=2
weeksLived=13  visasSomVecka=2  månaderPasserade=3
```

Månadsgränsen glider ett steg för var tredje månad och kommer aldrig tillbaka i
fas. "Vecka 1" i HUD:en betyder ingenting stabilt i förhållande till
månadsetiketten bredvid.

### A-7. Daily-login-belöningen är fortfarande farmbar — bara bakåtriktad klockmanipulation blockeras

**Filer:** `app/(tabs)/home.tsx:247-330`, `contexts/game/actions/SubscriptionActions.ts:97-117`

Kommentaren i `home.tsx:258-267` beskriver exploiten som stängd. Det är den inte.
`canClaimDailyGemsFor` har två grindar:

```ts
if (lastClaimKey && todayKey <= lastClaimKey) return false;     // (1) inte samma/tidigare dag
if (nowMs < lastClaimAt - SKEW) return false;                   // (2) inte tillbakaställd klocka
```

Båda blockerar **bakåt**. Att ställa fram enhetsklockan ett dygn i taget passerar
båda villkoren varje gång. Och `LOGIN_STREAK_GRACE_HOURS = 48` (`gameConstants.ts:126`)
gör att streaken fortsätter klättra vid 24-timmarshopp, så cykeln
`DAILY_LOGIN_REWARDS = [25,50,75,100,150,200,500]` (≈157 gems/dag i snitt) kan
plockas obegränsat på premiumvalutan som annars säljs som IAP.

Sekundärt: `lastLoginDate` sparas som dagsträng (`'YYYY-MM-DD'`) men
streak-matten gör `Date.now() - new Date(lastLogin).getTime()`, dvs. mäter
timmar sedan *UTC-midnatt på anspråksdagen*, inte sedan anspråket. Ett riktigt
missat dygn ger exakt 48,0 h och behåller streaken.

**Fix:** grinda på spelstate (t.ex. `weeksLived`) eller på en serversidig
tidsstämpel. Varje grind på enhetens klocka är farmbar per definition — vilket
`CLAUDE.md` §4.4 redan säger.

### A-8. `jailWeeks` tilldelas i stället för adderas i street-job-vägen

**Fil:** `contexts/game/actions/JobActions.ts:429`

```ts
jailWeeks: Math.min(52, job.jailWeeks || 1),   // = , inte +
```

Alla andra källor adderar (`GameActionsContext.tsx:2511-2518` lägger
`darkWebTick.jailWeeksAdded` ovanpå basen). Just nu inte exploaterbart eftersom
`app/(tabs)/work.tsx:954` byter ut hela Work-fliken mot `JailScreen` när
`jailWeeks > 0`, så man inte kan ta ett gatujobb inifrån fängelset — men det är
en icke-lokal invariant som håller av en slump i en UI-fil. Nästa väg som kan
sätta straff utan att blockera Work-fliken gör "bli tagen" till ett sätt att
*korta* sitt straff.

Samma block: felmeddelandet (`:447`) rapporterar `moneyLost`, beräknat från den
inaktuella render-snapshoten, medan avdraget faktiskt använder `freshMoneyLost`
från `prev` (`:406`). Toasten kan alltså ljuga om beloppet — samma
"lögnaktig toast"-klass som Legacy Pass-lärdomen från 2026-06-24.

### A-9. Böter och straff skalar inte med förmögenhet

**Fil:** `contexts/game/actions/weekly/applyCrimeTick.ts:58-61`

Polisböterna är 5 % av kassan, taket för fängelse är 4 veckor, och `wantedLevel`
minskar med 1 varje vecka man är fri. För en spelare med tio miljoner i
tillgångar (varav det mesta inte är kassa) är brott i praktiken riskfritt.
Straffskalan är balanserad för det tidiga spelet och följer aldrig med.

---

## B. Testning och kvalitetsgrindar — 5 494 gröna tester ger falsk trygghet

### B-1. 72 av 447 testfiler asserterar på **källkodstext**, inte på beteende

```
grep -rl readFileSync --include=*.test.ts  ->  72 filer
grep -rn "toMatch(/"  --include=*.test.ts  ->  588 assertions
```

Exempel som är representativa, inte utvalda:

- `__tests__/render/adRewardOrbSubscription.test.ts` — läser
  `components/AdRewardOrb.tsx` som sträng, strippar kommentarer och asserterar
  `expect(code).not.toMatch(/\buseGame\s*\(/)`.
- `__tests__/progression/deadAchievementSweep.test.ts` — asserterar bl.a. att
  *"the stale P2-7 sweep comment is gone"*.

De här testerna går igenom även om körtidsbeteendet är trasigt, och går sönder
vid harmlösa refaktoreringar. De mäter kodens *utseende*. Det gör dem aktivt
kontraproduktiva som regressionsskydd: de kostar underhåll och betalar inget
tillbaka.

### B-2. Nästan inga komponenter renderas i test

12 filer använder `react-test-renderer` — mot ~245 komponenter. `jest.config.js:3`
kör `testEnvironment: 'node'` och det finns ingen `@testing-library/react-native`
i `devDependencies`. UI-lagret är i praktiken otestat, vilket är exakt där de
senaste rapporterade buggarna satt (kreditkortslistan som inte gick att scrolla,
avatarens ålderssteg).

### B-3. Coverage-siffran mäts på en delmängd som utelämnar den farligaste koden

`jest.config.js:18-27` samlar bara från `lib/`, `components/`, `contexts/`,
`hooks/`, `utils/`. Utanför mätningen ligger:

- hela `app/` — inkl. `_layout.tsx` (55 KB boot/providers), `work.tsx` (1 618 rader)
  och `home.tsx` där A-7-exploiten bor
- hela `services/` — `IAPService.ts` (2 309 rader), RevenueCat, AdMob, Firebase, cloud sync
- hela `src/` — onboarding-flödet

De 48,94 % är alltså inte spelets täckning, det är täckningen för den del av
spelet som redan är lättast att testa. Betalningar, routing och boot ingår inte
i ratchet-golvet överhuvudtaget, så de kan aldrig utlösa den.

### B-4. Lint-grindarna är avstängda i praktiken

`npx eslint .` → **0 fel, 1 234 varningar**:

| Antal | Regel |
|---|---|
| 321 | `import/first` |
| 255 | `no-restricted-syntax` (repots egna hard rules) |
| 245 | `@typescript-eslint/no-unused-vars` |
| 157 | `@typescript-eslint/no-require-imports` |
| 102 | `react-hooks/exhaustive-deps` |
| 47 | `import/no-duplicates` |

Värst: `contexts/game/GameActionsContext.tsx` (103), `lib/simulation/BugHunterSimulator.ts` (48),
`contexts/game/MoneyActionsContext.tsx` (27).

`npm run lint:errors` kör `--quiet` och passerar därför alltid, oavsett hur många
varningar som ackumuleras. De 255 `no-restricted-syntax` är repots **egna**
hårda regler från `CLAUDE.md` §5 — kodifierade och sedan ignorerade.
102 `react-hooks/exhaustive-deps` i en app som redan har dokumenterade
stale-closure-buggar är inte en stilfråga.

### B-5. Typsäkerhetsskuld

- **185** `as any` i produktionskoden (exkl. tester). Värst:
  `components/work/workScreenStyles.ts` (18), `hooks/useTimerManager.ts` (8),
  `lib/statistics/crossSystemSummary.ts` (5).
- **340** interna `require('@/…')`. Repots egen regel säger att de degraderar
  typer till `any`/`never`. Flera ligger i het kod:
  `JobActions.ts:277,288` kräver in `karmaSystem` och `randomnessConstants` per
  anrop, inne i gatujobbsvägen.
- Reglerna är `error` enbart i `lib/travel/**`. Resten av repot är opt-out.

### B-6. Permanent avstängda tester

- `jest.config.js:55` — `lib/skillTrees/__tests__/careerSkillTrees.test.ts` är
  hårdkodad i `testPathIgnorePatterns`. En test-fil som aldrig får köras och
  ingen kommentar om varför.
- `__tests__/refactor/tickProfile.manual.test.ts:55` — `describe.skip`.

### B-7. Testsviten läcker handles

Varje körning slutar med `A worker process has failed to exit gracefully… Active
timers can also cause this`. Det är inte kosmetiskt: en app med
`hooks/useTimerManager.ts` och dokumenterade `setTimeout`-ackumuleringsbuggar
(`GameActionsContext.tsx:449-451`) har läckande timers som en känd felklass.
Sviten säger till dig varje körning och ingen har följt upp.

---

## C. Arkitektur och underhållbarhet

### C-1. `nextWeek()` är en enda funktion på ~2 400 rader

`contexts/game/GameActionsContext.tsx:377-2800`. Filen är 4 655 rader; 103
lint-varningar; 57 `try`-block. Extraktionen till `actions/weekly/apply*.ts`
(37 moduler) har flyttat ut *kropparna* men lämnat kvar all sammanflätning —
lokala variabler tråds igenom hela updatern, och två separata "FREE-EDUCATION
FIX"/"diet"-kommentarer (`:672-680`, `:745-752`) dokumenterar samma bugg två
gånger: en nedströms-uträkning skriver över `newStats.money` och raderade tyst
kostnaden. Att buggen uppstod två gånger är beviset — formen bjuder in den.

Inte alla `apply*`-anrop ligger i en egen `try`. `applyCareerSalaryAndPenalty`
(`:662`), `applyDietPlanForWeek` (`:679`), `applyCareerApplications` (`:689`),
`applyCareerProgress` (`:704`), `applyEducationStress` (`:734`),
`applyEducationProgression` (`:758`), `applyRentAndHousing` (`:894`),
`applyLoanAutopay` (`:936`), `applyCrimeTick` (`:1223`), `applyEconomicEvent`
(`:1261`), `applyWeeklyEvents` (`:1269`) och `applyLifeMoment` (`:1338`) körs
alla enbart under den yttre catchen. Ett kast där ger den "förlorade veckan"
som `CLAUDE.md` §4.3 varnar för fem gånger om — den yttre catchen returnerar
`prevState` och "Next Week" no-oppar tyst.

### C-2. 394 exporterade funktioner utan en enda anropare i annan produktionsfil

Mätt genom att korsreferera varje `export function` i `lib/`, `contexts/`,
`utils/`, `components/`, `app/`, `services/`, `hooks/`, `src/` mot alla andra
källfiler (tester och `lib/simulation`/`lib/devtools` exkluderade).

Per katalog: `lib/social` 29, `lib/statistics` 17, `lib/types` 17,
`contexts/game` 17, `lib/politics` 15, `lib/events` 11, `lib/darkweb` 10,
`lib/luxury` 10, `lib/vehicles` 10, `lib/automation` 9.

Några med direkt spelbetydelse:

| Modul | Död export |
|---|---|
| `lib/economy/stockMarket.ts` | `resetStockPrices` (se A-2) |
| `lib/economy/inflation.ts` | `policyInflationDelta`, `getWeeklyInflationRate` |
| `lib/automation/*` (5 filer) | hela regelfabriken + `automationEngine`s `evaluateConditions`, `validateAutomationRule`, `isAutomationEnabled` |
| `lib/diseases/diseaseGenerator.ts` | `calculateDiseaseRisk`, `shouldGenerateDisease` |
| `lib/darkweb/laundering.ts` | `computeNetLaunder`, `effectiveFeePct` |
| `lib/events/engine.ts` | `rollEventChain` |
| `lib/dating/sparkLogic.ts` | `calculateCatfishProbability`, `maxSwipesPerWeek` |
| `lib/depth/*` | `calculateDepthScore`, `getSystemHealth`, `trackSystemEngagement` |

`lib/politics/policies.ts:66-101` listar redan åtta inerta policynycklar och
säger rakt ut att R&D/patentsystemet är onåbart. Det är hederligt — men listan
växer i stället för att krympa, och `INERT_POLICY_KEYS` har blivit en plats att
parkera saker på i stället för att ta bort dem.

Kommentaren på `policies.ts:81` — *"economy.priceIndex — no policy in the
catalogue even sets it"* — är dessutom faktiskt fel. Två gör det: `:229`
(`-0.05`) och `:812` (`-0.1`).

### C-3. Modulglobalt mutabelt marknadstillstånd

`lib/economy/stockMarket.ts:72-94` bygger `stocks` och `volatilityMap` som
modulnivå-objekt som muteras av `simulateWeek`. `GameActionsContext.tsx:433`
anropar `simulateWeek` **utanför** `setGameState`. Om updatern sedan kastar och
den yttre catchen returnerar `prevState`, har marknaden rört sig men veckan inte
— och `savedMarketPrices` skrivs inne i updatern och persisteras alltså inte.
Tyst desynk mellan spel och marknad, precis den klass som resten av tick-koden
byggt `buildPreRolls` för att undvika.

### C-4. Filstorlekar

269 121 rader TS/TSX utanför tester. Topp:

```
4655  contexts/game/GameActionsContext.tsx
4337  lib/simulation/ComprehensiveGameSimulator.ts
3691  lib/events/engine.ts
3381  components/work/workScreenStyles.ts     <- en stylesheet-fil, med 18 `as any`
3210  contexts/game/types.ts
2353  utils/saveValidation.ts
2309  services/IAPService.ts
1618  app/(tabs)/work.tsx
```

En stylesheet på 3 381 rader med `as any` i sig är inte en stilfil längre.

### C-5. Trippelspeglad dokumentation

`CLAUDE.md`, `DEV.md` och `WORKFLOW.md` beskriver samma sak. `CLAUDE.md` säger
själv att den vinner vid konflikt, vilket är ett medgivande om att de driftar.
`STATE_VERSION` måste hållas i synk i tre filer manuellt — utan någon kontroll
som verifierar det.

---

## D. Leverans och plattform

### D-1. 307,5 MB bildassets, varav 67,3 MB oanvända

```
291 bildfiler, 307,5 MB totalt
278 PNG · 12 JPG · 1 WebP
48 filer (67,3 MB) refereras inte av filnamn någonstans i källan
```

Störst bland de oreferade:

```
2,69 MB  assets/images/Main_Menu_2.png
2,26 MB  assets/images/backupMain_Menu.png
2,10 MB  assets/images/Main_Menu/Credits.png
1,95 MB  assets/images/Main_Menu_3.png
1,85 MB  assets/images/iap/banking/private_banking.png
1,81 MB  assets/images/iap/store/buy_gems.png
```

(React Native kräver literala sökvägar i `require()` för lokala bilder, så en
fil som inte nämns vid namn kan inte laddas. Fyra av topp-sex är dessutom
uppenbara rester: `backupMain_Menu`, `Main_Menu_2`, `Main_Menu_3`.)

Två separata problem:
1. **Formatet.** 278 PNG för fotografiskt innehåll. WebP q85 ger typiskt 5–15×
   för samma material — 307 MB skulle bli ~30 MB. En enda WebP-fil finns i hela
   repot, så någon har provat och sedan slutat.
2. **Storleken.** Google Plays base-AAB-gräns är 200 MB. Med 307 MB assets
   passerar en Android-build inte utan Play Asset Delivery. På iOS är
   nedladdningen över gränsen för mobildata-varning, vilket direkt sänker
   installationskonverteringen.

Ingen preflight-sektion kontrollerar assetstorlek. De 10 sektionerna i
`scripts/preflight-check.js` täcker typer, lint, bundling, annons-SDK,
privacy manifest, purpose strings, IAP och save-signering — men inte den enda
siffra som avgör om appen ens går att distribuera på Android.

### D-2. Ingen lokalisering överhuvudtaget

Inga `i18n`-, `react-intl`- eller `expo-localization`-beroenden. Varje sträng är
hårdkodad amerikansk engelska, inklusive `$`-tecken direkt i mallsträngar
(`applyCrimeTick.ts:64`: `` `fined $${fine.toLocaleString()}` ``). Valutan är
hårdkodad USD i formateringen, inte bara i siffrorna. För en livssimulator som
säljs globalt är det både en intäktsbegränsning och en retrofit som blir
oproportionerligt dyr ju längre den skjuts upp — det är ~245 komponenter att gå
igenom.

### D-3. Tillgänglighet

534 `accessibilityLabel` mot 789 `<TouchableOpacity>`/`<Pressable>`, och 483
`accessibilityRole`. Grovt räknat saknar ungefär en tredjedel av de
interaktiva elementen etikett. (En del bärs av barn-`<Text>`, så siffran är
indikativ, inte exakt.) `allowFontScaling={false}` används på fyra ställen,
alla brandtext, vilket är rimligt — men det finns ingen kontroll som hindrar
att det sprids.

### D-4. Byggartefakter

iOS-bundlen är 12,8 MB (Hermes). Dev-verktygen är korrekt bortoptimerade —
verifierat genom att bygga en produktionsbundle och greppa: `DEBUG PRESET`,
`Game Dev Tools`, `ComprehensiveGameSimulator`, `BugHunterSimulator` och
`RealActionSimulator` förekommer noll gånger, medan kontrollsträngarna
`WEEK PROGRESSION` och `Fast Food Worker` gör det. `DEV_TOOLS_ENABLED`-mönstret
i `components/SettingsModal.tsx:52-56` fungerar alltså som avsett. **Det här är
inget fynd — det är det enda i den här listan jag testade och som höll.**

---

## E. Design och spelkänsla

### E-1. Bredd utan djup

Karriärer, utbildning, dejting, familj, brott, dark web, aktier, krypto,
fastigheter, företag, politik, husdjur, fordon, hobbies, sociala medier
(Pulse), dejtingapp (Spark), streaming, R&D, bankverksamhet, prestige,
legacy pass, resor, lyxvaror. Två dussin system.

Under dem: 30 baskarriärer med 6 steg vardera, 5 avancerade. Innehållsdjupet är
en bråkdel av systembredden. `lib/politics/policies.ts` medger själv att R&D-
och patentsystemet inte går att nå.

Det här är den underliggande orsaken bakom halva den här listan. Varje nytt
system har en aktiveringsyta (UI, state, migration, veckotick) och det är där
de 394 döda exporterna och de åtta inerta policynycklarna kommer ifrån —
system som blivit byggda till 80 % och sedan lämnats för nästa system.

### E-2. Kärnloopens spänning är bortkopplad

Sammanfattat från A-1, A-4 och A-5:

- Pengar kan inte bli negativa och obetalda räkningar efterskänks (A-4).
- Det finns ingen obligatorisk levnadskostnad (A-4).
- Investeringar är en garanterad förlust över tid (A-1).
- Den nedre halvan av karriärstegen är ekonomiskt irrelevant (A-5).

Kvar blir en loop där "Next Week" nästan alltid är rätt drag, riskerna är
kosmetiska och den enda riktiga fail-staten är stat-döden (`ZERO_STAT_DEATH_WEEKS = 4`).

### E-3. Notisbrus har adresserats symtomatiskt

`gameConstants.ts:68-97` innehåller en lång rad nedjusteringar efter spelar-
rapporter: `EARLY_GAME_EVENT_CHANCE` sänkt från 0,45 till 0,08,
`EVENT_MIN_GAP_*`, `ECONOMY_EVENT_WEEKLY_CHANCE` från 0,02-0,03 till 0,01 plus
20 påtvingade lugna veckor. Kommentaren på `:74-83` medger dessutom att
`EARLY_GAME_PITY_THRESHOLD = 16` är satt så att den tidiga pity-grenen
**aldrig kan trigga**, med en not om att fixa den ordentligt skulle kräva en
ändring i `engine.ts` som var förbjuden i den vågen.

Det är en död kodgren dokumenterad som avsiktlig. Symtomet (för många popups)
behandlades genom att skruva ned sannolikheter tills de nästan är noll, snarare
än genom att göra händelserna värda att avbryta för.

---

## Prioritering

**Måste fixas innan nästa release:**

1. A-1 — aktiedriften. Ett tal i `simulateWeek`. Störst effekt per rad i hela
   listan.
2. A-3 — anropa `applyWeeklyInflation` i veckoloopen, eller ta bort systemet.
   Just nu är det ett halvt dussin dokumenterade fixar ovanpå en död funktion.
3. A-2 — anropa `resetStockPrices` vid prestige och nytt spel.
4. A-7 — flytta daily-login-grinden till spelstate.

**Före nästa större feature:**

5. D-1 — assetkonvertering till WebP + rensning av de 48 oreferade filerna.
   Blockerar Android-distribution.
6. B-3 — lägg `app/`, `services/` och `src/` i `collectCoverageFrom` och
   sätt golv på de faktiska siffrorna.
7. B-4 — höj `no-restricted-syntax` till `error` och beta av de 255 träffarna.
   En regel som varnar 255 gånger är ingen regel.
8. C-1 — lägg de tolv oskyddade `apply*`-anropen i egna `try`-block.

**Strukturellt, kräver ett produktbeslut:**

9. B-1/B-2 — ersätt källkodstest-mönstret med riktiga renderingstester.
10. E-1/E-2 — bestäm om ekonomin ska ha ett fail-state. Nästan allt i avsnitt A
    följer av att den inte har det.
11. D-2 — lokalisering, om appen ska säljas utanför engelskspråkiga marknader.
