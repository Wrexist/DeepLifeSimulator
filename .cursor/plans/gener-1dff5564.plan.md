<!-- 1dff5564-ffff-4683-aab8-e3972f46c4d7 02fb5a51-9e1b-4abb-b037-a420cf1ef586 -->
# Generational Legacy + Mindset + UX Overhaul – Final Plan

### 1. Data Model & Save Structure

#### 1.1 GameState extensions

Add to `GameState` (and `contexts/game/types.ts`):

- `generationNumber: number`  
- Starts at 1 for existing runs; incremented every time you start a new life in the same lineage.
- `lineageId: string`  
- A UUID created on first run; reused for all generations in that family.
- `previousLives: Array<{
generation: number;
netWorth: number;
ageAtDeath: number;
deathReason: 'health' | 'happiness' | 'other';
timestamp: number;
summaryAchievements: string[];
}>`
- `legacyBonuses: {
incomeMultiplier: number;
learningMultiplier: number;
reputationBonus: number;
}`

Children (in `family.children` or similar):

- Extend child entries to include:
- `id: string`
- `name: string`
- `age: number`
- `educationLevel: 'none' | 'highSchool' | 'university' | 'specialized'`
- `careerPath?: 'blueCollar' | 'whiteCollar' | 'professional' | 'entrepreneur'`
- `jobTier?: 1 | 2 | 3 | 4` (rough job quality)
- `savings: number`
- `mindsetHints?: string[]`
- `isHeirEligible: boolean`

Mindset:

- `mindset: {
traits: Array<'frugal' | 'gambler' | 'workaholic' | 'socialite' | 'riskAverse'>;
activeTraitId?: 'frugal' | 'gambler' | 'workaholic' | 'socialite' | 'riskAverse';
}`

#### 1.2 Assets, inheritance, and debts

Implement a helper:

- `computeInheritance(state: GameState) => {
totalNetWorth: number;
realEstateIds: string[];
companyIds: string[];
cash: number;
bankSavings: number;
debts: number;
}`

Rules:

- Net worth includes cash, bank savings, owned properties (price or current value), companies (simple valuation), minus debts (loans, negative balances).
- Debt rule:
- If `totalNetWorth` ≥ 0:
- Heir gets full assets.
- Siblings are treated as NPCs who “benefit” narratively but not tracked as full separate economies.
- If `totalNetWorth` < 0:
- New life starts with `max(totalNetWorth, -5000)` as “family debt” but never worse than a defined floor.
- Tax / cap (for balance):
- Optionally apply a soft cap like: `effectiveInheritance = min(totalNetWorth, 10_000_000)`.

Migration:

- When loading existing saves, if new fields are missing:
- Set `generationNumber = 1`, create `lineageId`, `previousLives = []`, `legacyBonuses` with neutral multipliers (1.0 / 0).

---

### 2. Death Flow & Legacy Setup (With Children & Heirs)

#### 2.1 Children and heir system

Simulation frequency (simple v1):

- Once per in‑game year or per N weeks:
- Increment each child’s age.
- Check if they hit education milestones:
- Age 6–18: “school” (highSchool).
- Age 18+: can go to university or specialized education if the player invests.
- Simulate their job after education:
- Based on `educationLevel` and your investments, roll a `careerPath` and `jobTier`.
- Example: `highSchool` → blueCollar/whiteCollar, `university` → professional, `specialized` → professional/entrepreneur.

Parent decisions (during life):

- New events/choices:
- Pay for school/university for each child (recurring or one‑time).
- Pay for extra tutoring, courses, or business support.
- These increase:
- Probability of higher `educationLevel`.
- Probability of better `careerPath` and `jobTier`.
- Starting `savings` and reputation for that child.

Education → job mapping (example):

- none:
- jobTier 1, low income band.
- highSchool:
- jobTier 1–2, medium income band.
- university:
- jobTier 2–3, higher income band.
- specialized:
- jobTier 3–4, best band, higher chance of entrepreneur path.

#### 2.2 Death trigger integration

Reuse existing death logic (0 health / 0 happiness for 4 weeks):

- On death:
- Call `computeInheritance(state)`.
- Compute `legacyBonuses` from achievements, goals, net worth (small multipliers, e.g. +5–10%).
- Append an entry to `previousLives` with summary data.
- Compute per‑child summaries (age, education, career, estimated personal wealth) for heir selection.

Edge cases:

- If there are no children:
- Fallback: the next life is a “fresh heir” (new character) with inheritance and bonuses but no specific child simulation.
- If there are children but none `isHeirEligible` (e.g. too young):
- Allow choosing them anyway but with appropriate starting conditions (e.g. low starting age, simpler start), or auto‑select the oldest child.

#### 2.3 Heir selection & new life setup

Add:

- `startNewLifeFromLegacy(inheritance, bonuses, heirId?: string)` in `GameActionsContext`.

Flow:

1. User sees DeathPopup → chooses “Start New Life”.
2. Show Heir Selection Screen:

- List all children `isHeirEligible === true`.
- For each:
- Age, educationLevel, careerPath, rough salary tier, text like “Working as a junior engineer” or “Self‑employed”.
- Summary of what they’d inherit (cash, savings, properties, companies).

3. User picks one child → pass `heirId` to `startNewLifeFromLegacy`.

New life initialization:

- Reset:
- `week`, `day`, `date` to starting values.
- Warnings (happinessZeroWeeks, healthZeroWeeks).
- Increment `generationNumber`, keep `lineageId`.
- For the chosen heir:
- Set starting education and career‑related stats:
- Education level influences starting jobs available, skill levels, possibly mindset hints.
- Set starting money:
- Use inheritance object, applying cap/tax.
- Apply inherited real estate and companies as owned, with reasonable defaults (e.g. properties with full occupancy, companies with stable weekly income).
- Apply `legacyBonuses`:
- Multiply income in job/companies by `incomeMultiplier`.
- Multiply learning rate in skill systems by `learningMultiplier`.
- Apply initial reputation boost.

Other children:

- Move non‑chosen children into NPC space (siblings):
- They can appear in events, inheritance text, etc., but you don’t fully simulate their finances.

---

### 3. Light Mindset Trait System (Per‑Life Traits)

#### 3.1 Trait model

Config file `lib/mindset/config.ts`:

- Trait shape:
- `id`, `name`, `description`.
- `effects` (functions or simple numeric modifiers).
- `unlockConditions` (achievements or previousLives thresholds).

Initial traits:

- `frugal`:
- +10% savings (when money is moved to savings).
- −5 happiness when spending large % of income.
- `gambler`:
- Higher variance on investments and risky actions.
- `workaholic`:
- +10–15% job income.
- Faster health/happiness decay when working long hours.
- `socialite`:
- Faster relationship gains, slight spending increase.
- `riskAverse`:
- Lower variance on risky actions, slightly lower upside.

#### 3.2 Hooking into systems

Add a helper:

- `applyMindsetEffects(state, change: { moneyDelta?: number; healthDelta?: number; happinessDelta?: number; ... })`

Usage:

- In key places where stats change (weekly resolution, jobs, spending, major events), wrap:
- `const adjustedChange = applyMindsetEffects(gameState, baseChange);`
- Then apply `adjustedChange` instead of `baseChange`.

Keep effect sizes modest (±5–15%) to avoid breaking balance.

#### 3.3 Trait selection & generational links

- Generation 1:
- Optional: either no trait or a very simple starting choice during onboarding.
- Later generations:
- During “Family Legacy / New Life” screen:
- Player chooses one active trait for that generation.
- Mindset inheritance:
- Children inherit tendencies:
- If parent used `workaholic`, higher chance for “career‑oriented” flavor text and a recommendation to pick `workaholic` or similar.
- Some traits can be unlocked only if certain conditions are met over multiple generations (e.g. dynasty achievements).

---

### 4. Generational UX & Legacy Feedback

#### 4.1 Death summary & legacy panel

Enhance `DeathPopup` to clearly show:

- Generation number (`Gen 3`).
- Age at death, net worth, key achievements.
- A Legacy Summary:
- `You leave behind: X properties, Y companies, $Z cash, $W in savings.`
- `Heirs: N children (M educated, K in training).`

Ensure layout:

- Header fixed.
- Body below can scroll vertically for long lists.

#### 4.2 Heir selection UI

New Heir Selection screen/modal:

- Cards for each child:
- Name, age, education, career snippet.
- Icons for properties/companies.
- Short text: “Will start life as a [careerPath] with [educationLevel] education.”
- Confirm button → calls `startNewLifeFromLegacy`.

#### 4.3 Legacy timeline / family view

New optional screen:

- `LegacyTimeline`:
- Shows each generation: portrait/placeholder, age at death, net worth, major achievements, cause of death.
- Can hint at branches when you had multiple children but chose one as heir.

#### 4.4 In‑run indicators

- Badge in top stats bar:
- `Gen 2`, `Gen 3`, etc. with tooltip text.
- Occasional flavor events referencing:
- Ancestors’ achievements.
- Sacrifices made (e.g. “Your parents paid for your university; you start with X education.”).

---

### 5. Mindset UX & Feedback

#### 5.1 Selection UI

During onboarding / new life:

- Simple card list for traits:
- Icon, name, 1–2 bullet points describing exactly what changes.

#### 5.2 Feedback

- On key actions:
- Small toast or inline text: “Frugal: You saved a bit extra this week (+10%).”
- Add a Mindset section in help or stats screen summarizing:
- Active trait.
- Current effects.

---

### 6. Technical & Testing Plan

#### 6.1 Implementation order

1. Extend `GameState` and types with generational, legacy, children fields, and mindset object; update save/load & migrations.
2. Implement `computeInheritance`, child simulation helpers, and `startNewLifeFromLegacy`.
3. Wire DeathPopup → Death summary → Heir Selection → `startNewLifeFromLegacy`.
4. Implement mindset config + `applyMindsetEffects` and integrate into 2–3 core flows.
5. Add UX: Legacy summary on DeathPopup; Heir selection screen; generation badge / timeline; mindset selection & feedback.

#### 6.2 Testing scenarios

- Death at 0 health/happiness:
- `previousLives` updated correctly.
- Inheritance, bonuses, and heir selection screen appear.
- New life:
- Assets and money inherited correctly, debts handled as defined.
- Chosen heir starts with correct education, job opportunities, and stats.
- Mindset:
- Simulate weeks with/without traits and verify modifiers numerically.
- Edge cases:
- No children, or many children.
- Negative net worth at death.
- Long legacy chains (5–10 generations).

---

### To-dos

- [ ] Extend GameState/types with generational fields, legacy structures, and mindset object, and update save/load logic to handle them safely.
- [ ] Implement inheritance computation and startNewLifeFromLegacy function, and wire DeathPopup new-life action to the legacy setup.
- [ ] Create mindset trait config and hook trait effects into core economic and stat update functions with small, balanced modifiers.
- [ ] Enhance DeathPopup, onboarding, and top-bar UI for generation indicators, legacy summary, and mindset selection.

### To-dos

- [ ] Extend GameState/types with generational fields, legacy structures, children simulation fields, and mindset object; update save/load logic and migrations.
- [ ] Implement inheritance computation, child simulation helpers, and `startNewLifeFromLegacy`, and wire DeathPopup new-life action to the legacy setup and heir selection.
- [ ] Create mindset trait config and hook trait effects into core economic and stat update functions with small, balanced modifiers.
- [ ] Enhance DeathPopup, onboarding, top-bar UI, and add LegacyTimeline and Heir Selection screens for generation indicators, legacy summary, and mindset selection.