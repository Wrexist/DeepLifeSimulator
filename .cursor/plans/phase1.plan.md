<!-- 03b91dda-c025-4308-b446-90cf02bd5a5a dd75956a-fffa-4f15-b567-e307b2d5870f -->
# Phase 1: Quick Wins Implementation Plan

**Timeline**: 1-2 weeks

**Priority**: High impact, moderate complexity

---

## 1. Bug Fixes (Critical - Do First)

### 1.1 Event Engine Syntax Error

**File**: [lib/events/engine.ts](lib/events/engine.ts) (line 2059)

```typescript
// Current (broken):
petsitterNeeded
communityService,

// Fix to:
petsitterNeeded,
communityService,
```

### 1.2 Political Career Education Alignment

**Files**: [lib/careers/political.ts](lib/careers/political.ts) references `business_degree`. Verify this ID exists in [contexts/game/initialState.ts](contexts/game/initialState.ts) educations array.

### 1.3 Social Media Function Consolidation

**File**: [lib/social/socialMedia.ts](lib/social/socialMedia.ts) - Consolidate duplicate `calculateFollowerGrowth` and `calculateFollowerGrowthFull` functions.

---

## 2. Vehicle System (Full Implementation)

### 2.1 Types Definition

**File**: [contexts/game/types.ts](contexts/game/types.ts)

```typescript
export interface Vehicle {
  id: string;
  name: string;
  type: 'car' | 'motorcycle' | 'luxury' | 'sports';
  price: number;
  condition: number; // 0-100
  fuelLevel: number; // 0-100
  insurance: VehicleInsurance | null;
  weeklyMaintenanceCost: number;
  weeklyFuelCost: number;
  reputationBonus: number;
  speedBonus: number;
  owned: boolean;
  mileage: number;
}

export interface VehicleInsurance {
  id: string;
  type: 'basic' | 'comprehensive' | 'premium';
  monthlyCost: number;
  coveragePercent: number;
  active: boolean;
  expiresWeek: number;
}
```

Add to GameState: `vehicles?: Vehicle[]`, `hasDriversLicense?: boolean`, `activeVehicleId?: string`

### 2.2 Vehicle Data

**New File**: `lib/vehicles/vehicles.ts` - Define 10-15 vehicles (Economy: $15-20K, Mid: $45-50K, Luxury: $85-250K, Motorcycles: $20-25K)

### 2.3 Vehicle Actions

**New File**: `contexts/game/actions/VehicleActions.ts` - Functions: purchaseVehicle, sellVehicle, refuelVehicle, repairVehicle, purchaseInsurance, getDriversLicense, processVehicleWeekly

### 2.4 Vehicle Events

**File**: [lib/events/engine.ts](lib/events/engine.ts) - Add: carAccident, trafficTicket, carStolen, uberOpportunity

### 2.5 Vehicle UI

**New File**: `components/computer/VehicleApp.tsx` - Garage view, purchase/sell, fuel gauge, condition/repair, insurance management

---

## 3. Enhanced Dating and Wedding System

### 3.1 Types Updates

**File**: [contexts/game/types.ts](contexts/game/types.ts)

```typescript
// Extend Relationship interface
engagementWeek?: number;
weddingPlanned?: WeddingPlan;
anniversaryWeek?: number;
marriageWeek?: number;

export interface WeddingPlan {
  venue: 'courthouse' | 'church' | 'beach' | 'luxury_hotel' | 'destination';
  budget: number;
  guestCount: number;
  scheduledWeek: number;
}

export interface EngagementRing {
  id: string;
  name: string;
  price: number;
  qualityTier: 'simple' | 'elegant' | 'luxury' | 'extravagant';
  acceptanceBonus: number;
}
```

### 3.2 Dating Data

**New Files**: `lib/dating/engagementRings.ts` (5-8 rings $500-$200K), `lib/dating/weddingVenues.ts` (5 venues $200-$100K)

### 3.3 Dating Actions

**New File**: `contexts/game/actions/DatingActions.ts` - goOnDate, giveGift, proposeMarriage, planWedding, executeWedding, fileDivorce

### 3.4 TinderApp Enhancement

**File**: [components/mobile/TinderApp.tsx](components/mobile/TinderApp.tsx) - Add milestone tracker, proposal button (relationship > 80), wedding planning modal

---

## 4. Comprehensive Audio System

### 4.1 New Audio Manager

**Replace**: [utils/soundManager.ts](utils/soundManager.ts)

```typescript
class AudioManager {
  private uiSounds: Map<string, Sound>;
  private musicTracks: Map<string, Sound>;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  
  playSFX(soundId): void;
  playMusic(trackId, loop?): void;
  crossfadeMusic(from, to): void;
}
```

### 4.2 Sound Library

**New File**: `utils/audioLibrary.ts` - Define: button_click, money_earned, money_spent, success, error, level_up, achievement, notification, week_advance, event_popup

### 4.3 Sound Assets

**New Folder**: `assets/sounds/`, `assets/music/` - 15 UI sounds, 10 feedback sounds, 5 music tracks

### 4.4 Settings Integration

**File**: [components/SettingsModal.tsx](components/SettingsModal.tsx) - Add master/SFX/music volume sliders. Update GameSettings type.

---

## 5. Scenario Mode (Challenges Menu)

### 5.1 Scenario Definitions

**New File**: `lib/scenarios/scenarioDefinitions.ts`

5 Core Scenarios:

- **Rags to Riches**: Start $0, homeless, reach $1M
- **Trust Fund Baby**: Start $1M, spoiled spending habits
- **Immigrant Story**: New country, no connections, $500
- **Single Parent**: 2 kids, balance work/family, $5K
- **Second Chance**: Age 40, post-prison, rebuild reputation

### 5.2 Scenarios Screen

**Enhance**: `app/(onboarding)/Scenarios.tsx` - Grid of scenario cards with difficulty badges

### 5.3 Challenges Screen

**New File**: `app/(onboarding)/Challenges.tsx` - Menu-based access, weekly challenges, scenario leaderboard (local)

### 5.4 Main Menu Integration

**File**: `app/(onboarding)/MainMenu.tsx` - Add "Challenges" button

---

## 6. State Migration

**File**: [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) migrateState():

```typescript
if (!state.vehicles) state.vehicles = [];
if (state.hasDriversLicense === undefined) state.hasDriversLicense = false;
if (state.settings.masterVolume === undefined) state.settings.masterVolume = 1.0;
if (state.settings.sfxVolume === undefined) state.settings.sfxVolume = 1.0;
if (state.settings.musicVolume === undefined) state.settings.musicVolume = 0.5;
if (!state.lifeMilestones) state.lifeMilestones = [];
```

---

## Testing Checklist

- [ ] Vehicle purchase/sell/maintenance flow
- [ ] Insurance claims on accidents
- [ ] Proposal success/failure based on relationship + ring
- [ ] Wedding execution creates spouse
- [ ] Audio plays on key actions
- [ ] Scenario applies correct starting conditions
- [ ] Migration preserves existing saves
- [ ] All bug fixes verified

### To-dos

- [ ] Fix event engine syntax error, verify political career education alignment, consolidate social media functions
- [ ] Add Vehicle, VehicleInsurance, VehicleAccident interfaces to types.ts
- [ ] Create lib/vehicles/vehicles.ts with 10-15 vehicle definitions
- [ ] Create contexts/game/actions/VehicleActions.ts with purchase/sell/refuel/repair/insurance functions
- [ ] Add 5-8 vehicle events to lib/events/engine.ts
- [ ] Create components/computer/VehicleApp.tsx garage interface
- [ ] Add WeddingPlan, EngagementRing interfaces and extend Relationship type
- [ ] Create lib/dating/engagementRings.ts and lib/dating/weddingVenues.ts
- [ ] Create contexts/game/actions/DatingActions.ts with proposal/wedding/divorce functions
- [ ] Enhance TinderApp.tsx with milestone tracker, proposal button, wedding planning
- [ ] Replace utils/soundManager.ts with comprehensive AudioManager class
- [ ] Create utils/audioLibrary.ts with sound effect definitions
- [ ] Source/create royalty-free sound effects and music tracks
- [ ] Add volume controls to SettingsModal.tsx and GameSettings type
- [ ] Create lib/scenarios/scenarioDefinitions.ts with 5 core scenarios
- [ ] Enhance app/(onboarding)/Scenarios.tsx with scenario selection UI
- [ ] Create app/(onboarding)/Challenges.tsx for menu-based access
- [ ] Add vehicle, audio, milestone defaults to migrateState()