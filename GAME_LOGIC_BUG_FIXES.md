# 🐛 Game Logic Bug Fixes Implementation

## **7. Game Logic Bugs:**

### **✅ Pengar som försvinner eller dupliceras**

#### **Problem 1: Inconsistent Money Updates**
```typescript
// ❌ Dåligt - olika sätt att uppdatera pengar
setGameState(prev => ({ ...prev, stats: { ...prev.stats, money: prev.stats.money - cost } }));
updateStats({ money: gameState.stats.money - cost });
```

**Fix:**
```typescript
// ✅ Bra - centraliserad money handling
const updateMoney = useCallback((amount: number, reason: string) => {
  setGameState(prev => {
    const newMoney = Math.max(0, prev.stats.money + amount);
    console.log(`Money ${amount >= 0 ? '+' : ''}${amount} (${reason}): ${prev.stats.money} → ${newMoney}`);
    
    return {
      ...prev,
      stats: { ...prev.stats, money: newMoney },
      dailySummary: {
        ...prev.dailySummary,
        moneyChange: (prev.dailySummary?.moneyChange || 0) + amount,
      }
    };
  });
}, []);

// Använd alltid updateMoney istället för direkt manipulation
const buyItem = (itemId: string) => {
  const item = gameState.items.find(i => i.id === itemId);
  if (!item || gameState.stats.money < item.price) return;
  
  updateMoney(-item.price, `Buy ${item.name}`);
  // ... resten av logiken
};
```

#### **Problem 2: Race Conditions in Money Updates**
```typescript
// ❌ Dåligt - race conditions
const handleMultipleTransactions = () => {
  updateStats({ money: gameState.stats.money - 100 });
  updateStats({ money: gameState.stats.money - 50 });
  // Kan leda till inkorrekt summa
};
```

**Fix:**
```typescript
// ✅ Bra - batch updates
const batchUpdateMoney = useCallback((transactions: Array<{amount: number, reason: string}>) => {
  setGameState(prev => {
    const totalChange = transactions.reduce((sum, t) => sum + t.amount, 0);
    const newMoney = Math.max(0, prev.stats.money + totalChange);
    
    console.log(`Batch money update: ${totalChange} (${transactions.map(t => t.reason).join(', ')}): ${prev.stats.money} → ${newMoney}`);
    
    return {
      ...prev,
      stats: { ...prev.stats, money: newMoney },
      dailySummary: {
        ...prev.dailySummary,
        moneyChange: (prev.dailySummary?.moneyChange || 0) + totalChange,
      }
    };
  });
}, []);
```

### **✅ Stats som inte uppdateras korrekt**

#### **Problem 3: Stats Not Bounded Properly**
```typescript
// ❌ Dåligt - stats kan gå utanför gränser
updateStats({ health: gameState.stats.health + 10 });
```

**Fix:**
```typescript
// ✅ Bra - bounded stats updates
const updateStats = useCallback((newStats: Partial<GameStats>) => {
  setGameState(prev => {
    const updatedStats = { ...prev.stats };
    
    Object.entries(newStats).forEach(([key, value]) => {
      const statKey = key as keyof GameStats;
      const currentValue = updatedStats[statKey];
      
      if (typeof value === 'number' && typeof currentValue === 'number') {
        // Bounds checking
        const min = 0;
        const max = statKey === 'gems' ? Infinity : 100;
        
        updatedStats[statKey] = Math.max(min, Math.min(max, currentValue + value));
        
        console.log(`${statKey}: ${currentValue} → ${updatedStats[statKey]} (${value >= 0 ? '+' : ''}${value})`);
      }
    });
    
    return {
      ...prev,
      stats: updatedStats,
      dailySummary: {
        ...prev.dailySummary,
        statsChange: { ...prev.dailySummary?.statsChange, ...newStats }
      }
    };
  });
}, []);
```

#### **Problem 4: Stats Not Persisting Between Sessions**
```typescript
// ❌ Dåligt - stats återställs vid reload
const initialGameState = {
  stats: { health: 50, happiness: 50, energy: 50, fitness: 50, money: 0, reputation: 0, gems: 0 }
};
```

**Fix:**
```typescript
// ✅ Bra - stats persistence
const loadGame = async (slot?: number) => {
  try {
    const slotToLoad = slot || currentSlot;
    const savedData = await AsyncStorage.getItem(`save_slot_${slotToLoad}`);
    
    if (savedData) {
      const loadedState = JSON.parse(savedData);
      
      // Ensure all stats are present and valid
      const validatedStats: GameStats = {
        health: Math.max(0, Math.min(100, loadedState.stats?.health ?? 50)),
        happiness: Math.max(0, Math.min(100, loadedState.stats?.happiness ?? 50)),
        energy: Math.max(0, Math.min(100, loadedState.stats?.energy ?? 50)),
        fitness: Math.max(0, Math.min(100, loadedState.stats?.fitness ?? 50)),
        money: Math.max(0, loadedState.stats?.money ?? 0),
        reputation: Math.max(0, Math.min(100, loadedState.stats?.reputation ?? 0)),
        gems: Math.max(0, loadedState.stats?.gems ?? 0),
      };
      
      setGameState({
        ...loadedState,
        stats: validatedStats,
        version: STATE_VERSION,
      });
      
      setCurrentSlot(slotToLoad);
      console.log('Game loaded successfully with validated stats');
    }
  } catch (error) {
    console.error('Failed to load game:', error);
  }
};
```

### **✅ Achievements som inte unlockas**

#### **Problem 5: Achievement Checking Not Triggered**
```typescript
// ❌ Dåligt - achievements checkas bara vid nextWeek
const nextWeek = () => {
  // ... week logic
  checkAchievements(); // Bara här
};
```

**Fix:**
```typescript
// ✅ Bra - achievements checkas vid alla relevanta events
const checkAchievements = useCallback((state: GameState = gameState) => {
  if (!state.achievements) return;

  const newAchievements = [...state.achievements];
  let hasChanges = false;
  let goldReward = 0;

  const completeAchievement = (id: string) => {
    const achievement = newAchievements.find(a => a.id === id);
    if (achievement && !achievement.completed) {
      achievement.completed = true;
      hasChanges = true;
      goldReward += achievement.reward ?? 1;
      showAchievementToast(achievement.name);
      notifyAchievementUnlock(achievement.name, achievement.reward ?? 1);
      console.log(`Achievement unlocked: ${achievement.name}`);
    }
  };

  // Money achievements
  if (state.stats.money >= 1) completeAchievement('first_dollar');
  if (state.stats.money >= 100) completeAchievement('hundred_dollars');
  if (state.stats.money >= 1000) completeAchievement('thousand_dollars');
  if (state.stats.money >= 10000) completeAchievement('ten_thousand');
  if (state.stats.money >= 100000) completeAchievement('hundred_thousand');
  if (state.stats.money >= 1000000) completeAchievement('millionaire');
  if (state.stats.money >= 10000000) completeAchievement('deca_millionaire');

  // Career achievements
  if (state.currentJob) completeAchievement('first_job');
  if (state.streetJobsCompleted >= 10) completeAchievement('street_worker');
  
  const hasCareerJob = state.careers.some(career => career.accepted);
  if (hasCareerJob) completeAchievement('career_starter');

  // Company achievements
  if (state.companies.length > 0) completeAchievement('entrepreneur');
  
  const purchasedUpgrades = state.companies.reduce(
    (sum, company) => sum + company.upgrades.filter(u => u.level > 0).length, 0
  );
  if (purchasedUpgrades >= 1) completeAchievement('first_upgrade');

  // Education achievements
  const completedEducations = state.educations.filter(edu => edu.completed);
  if (completedEducations.some(edu => edu.id === 'high_school')) completeAchievement('graduate');
  if (completedEducations.some(edu => edu.id === 'university')) completeAchievement('college_grad');

  // Relationship achievements
  if (state.relationships.length >= 1) completeAchievement('first_friend');
  if (state.relationships.length >= 5) completeAchievement('popular');

  // Health achievements
  if (state.stats.fitness >= 50) completeAchievement('fitness_buff');
  if (state.stats.fitness >= 100) completeAchievement('athlete');

  // Item achievements
  const ownedItems = state.items.filter(item => item.owned);
  if (ownedItems.length >= 1) completeAchievement('first_purchase');
  if (ownedItems.some(item => item.id === 'smartphone') && 
      ownedItems.some(item => item.id === 'computer')) completeAchievement('tech_savvy');

  if (hasChanges) {
    setGameState(prev => ({
      ...prev,
      achievements: newAchievements,
      stats: { ...prev.stats, gems: prev.stats.gems + goldReward }
    }));
    saveGame();
  }
}, [gameState, saveGame]);

// Trigger achievement checks on relevant events
useEffect(() => {
  checkAchievements();
}, [
  gameState.stats.money,
  gameState.stats.fitness,
  gameState.currentJob,
  gameState.streetJobsCompleted,
  gameState.companies.length,
  gameState.educations.filter(e => e.completed).length,
  gameState.relationships.length,
  gameState.items.filter(i => i.owned).length,
]);
```

### **✅ Save/load som inte fungerar**

#### **Problem 6: Incomplete Save/Load Logic**
```typescript
// ❌ Dåligt - ofullständig save/load
const saveGame = async () => {
  await AsyncStorage.setItem('gameState', JSON.stringify(gameState));
};
```

**Fix:**
```typescript
// ✅ Bra - robust save/load med validation
const saveGame = useCallback(async (retryCount = 0) => {
  try {
    const stateToSave = {
      ...gameState,
      version: STATE_VERSION,
      updatedAt: Date.now(),
      lastLogin: Date.now(),
    };

    // Validate state before saving
    if (!stateToSave.stats || !stateToSave.settings) {
      throw new Error('Invalid game state structure');
    }

    await AsyncStorage.setItem(
      `save_slot_${currentSlot}`,
      JSON.stringify(stateToSave)
    );
    await AsyncStorage.setItem('lastSlot', String(currentSlot));

    // Cloud save with error handling
    try {
      await uploadGameState({ state: stateToSave, updatedAt: stateToSave.updatedAt });
      console.log('Cloud save successful');
    } catch (cloudError) {
      console.warn('Cloud save failed, but local save succeeded:', cloudError);
    }

    console.log('Game saved successfully to slot', currentSlot);
  } catch (error) {
    console.error('Save error:', error);
    
    if (retryCount < 3) {
      console.log(`Retrying save... (${retryCount + 1}/3)`);
      setTimeout(() => saveGame(retryCount + 1), 1000);
    } else {
      console.error('Failed to save game after 3 retries');
    }
  }
}, [gameState, currentSlot]);

const loadGame = useCallback(async (slot?: number) => {
  try {
    const slotToLoad = slot || currentSlot;
    const savedData = await AsyncStorage.getItem(`save_slot_${slotToLoad}`);
    
    if (savedData) {
      const loadedState = JSON.parse(savedData);
      
      // Validate and migrate state
      const validatedState = migrateState(loadedState);
      
      setGameState(validatedState);
      setCurrentSlot(slotToLoad);
      
      console.log('Game loaded successfully from slot', slotToLoad);
    } else {
      console.log('No save data found for slot', slotToLoad);
    }
  } catch (error) {
    console.error('Failed to load game:', error);
  }
}, [currentSlot]);

const migrateState = (loaded: any): GameState => {
  const version = loaded.version || 1;
  let state = { ...loaded };
  
  // Ensure all required fields exist
  if (!state.stats) state.stats = initialGameState.stats;
  if (!state.settings) state.settings = initialGameState.settings;
  if (!state.achievements) state.achievements = initialGameState.achievements;
  if (!state.perks) state.perks = {};
  if (!state.bankSavings) state.bankSavings = 0;
  if (!state.stocks) state.stocks = { holdings: [], watchlist: [] };
  if (!state.realEstate) state.realEstate = [];
  if (!state.companies) state.companies = [];
  if (!state.relationships) state.relationships = [];
  if (!state.items) state.items = initialGameState.items;
  if (!state.foods) state.foods = initialGameState.foods;
  if (!state.careers) state.careers = initialGameState.careers;
  if (!state.hobbies) state.hobbies = initialGameState.hobbies;
  if (!state.educations) state.educations = initialGameState.educations;
  if (!state.cryptos) state.cryptos = initialGameState.cryptos;
  if (!state.economy) state.economy = initialGameState.economy;
  if (!state.social) state.social = initialGameState.social;
  if (!state.family) state.family = initialGameState.family;
  if (!state.pendingEvents) state.pendingEvents = [];
  if (!state.eventLog) state.eventLog = [];
  if (!state.claimedProgressAchievements) state.claimedProgressAchievements = [];
  if (!state.streetJobsCompleted) state.streetJobsCompleted = 0;
  if (!state.happinessZeroWeeks) state.happinessZeroWeeks = 0;
  if (!state.healthZeroWeeks) state.healthZeroWeeks = 0;
  
  return state as GameState;
};
```

### **✅ Perks som inte fungerar som de ska**

#### **Problem 7: Perks Not Applied to Game Logic**
```typescript
// ❌ Dåligt - perks finns men används inte
const perks = {
  workBoost: true,
  mindset: true,
  fastLearner: true,
  goodCredit: true,
};
```

**Fix:**
```typescript
// ✅ Bra - perks appliceras på all game logic
const applyPerkEffects = useCallback((baseValue: number, perkType: string): number => {
  const { perks } = gameState;
  let multiplier = 1;
  
  switch (perkType) {
    case 'income':
      if (perks?.workBoost) multiplier *= 1.5; // +50% income
      if (perks?.goodCredit) multiplier *= 1.1; // +10% from good credit
      break;
      
    case 'promotion':
      if (perks?.mindset) multiplier *= 1.5; // 50% faster promotions
      break;
      
    case 'education':
      if (perks?.fastLearner) multiplier *= 1.5; // 50% faster education
      break;
      
    case 'bankInterest':
      if (perks?.goodCredit) multiplier *= 1.25; // +25% bank interest
      break;
      
    case 'energy':
      if (perks?.astute_planner) multiplier *= 0.9; // -10% energy cost
      break;
  }
  
  return Math.round(baseValue * multiplier);
}, [gameState.perks]);

// Använd perks i alla relevanta funktioner
const performStreetJob = useCallback((jobId: string) => {
  const job = gameState.streetJobs.find(j => j.id === jobId);
  if (!job) return;

  const baseIncome = job.income;
  const finalIncome = applyPerkEffects(baseIncome, 'income');
  
  updateMoney(finalIncome, `Street job: ${job.name}`);
  updateStats({ energy: -job.energyCost });
  
  return {
    success: true,
    message: `Earned $${finalIncome} from ${job.name}`,
  };
}, [gameState.streetJobs, gameState.perks, updateMoney, updateStats, applyPerkEffects]);

const applyForJob = useCallback((jobId: string) => {
  const career = gameState.careers.find(c => c.id === jobId);
  if (!career) return;

  const baseSalary = career.levels[0].salary;
  const finalSalary = applyPerkEffects(baseSalary, 'income');
  
  setGameState(prev => ({
    ...prev,
    careers: prev.careers.map(c => 
      c.id === jobId 
        ? { ...c, accepted: true, levels: c.levels.map(l => ({ ...l, salary: applyPerkEffects(l.salary, 'income') })) }
        : c
    ),
    currentJob: jobId,
  }));
  
  console.log(`Job applied: ${career.name} with salary $${finalSalary} (base: $${baseSalary})`);
}, [gameState.careers, applyPerkEffects]);

const startEducation = useCallback((educationId: string) => {
  const education = gameState.educations.find(e => e.id === educationId);
  if (!education) return;

  const baseDuration = education.duration;
  const finalDuration = applyPerkEffects(baseDuration, 'education');
  
  setGameState(prev => ({
    ...prev,
    educations: prev.educations.map(e => 
      e.id === educationId 
        ? { ...e, weeksRemaining: finalDuration, inProgress: true }
        : e
    ),
  }));
  
  console.log(`Education started: ${education.name} for ${finalDuration} weeks (base: ${baseDuration})`);
}, [gameState.educations, applyPerkEffects]);
```

## **🔧 Implementation Steps:**

### **Step 1: Fix Money Handling**
1. Implement centralized `updateMoney` function
2. Add transaction logging
3. Fix race conditions with batch updates
4. Add bounds checking

### **Step 2: Fix Stats Updates**
1. Implement bounded stats updates
2. Add validation and persistence
3. Fix stats migration between versions
4. Add daily summary tracking

### **Step 3: Fix Achievements**
1. Implement comprehensive achievement checking
2. Add achievement triggers on all relevant events
3. Fix achievement persistence
4. Add achievement notifications

### **Step 4: Fix Save/Load**
1. Implement robust save/load with validation
2. Add state migration for version compatibility
3. Fix cloud save error handling
4. Add save slot management

### **Step 5: Fix Perks**
1. Implement perk effect application
2. Add perks to all relevant game mechanics
3. Fix perk persistence
4. Add perk validation

## **📊 Testing Checklist:**

- [ ] Test money transactions for accuracy
- [ ] Test stats bounds and persistence
- [ ] Test achievement unlocking
- [ ] Test save/load functionality
- [ ] Test perk effects
- [ ] Test edge cases and error handling
- [ ] Test data migration
- [ ] Test cloud save/load

## **🚀 Expected Results:**

### **Money Handling**
- ✅ No money disappearing or duplicating
- ✅ Accurate transaction logging
- ✅ Proper bounds checking
- ✅ Race condition prevention

### **Stats Updates**
- ✅ Stats stay within bounds (0-100)
- ✅ Stats persist between sessions
- ✅ Proper validation and migration
- ✅ Daily summary tracking

### **Achievements**
- ✅ All achievements unlock correctly
- ✅ Achievement progress persists
- ✅ Achievement notifications work
- ✅ Achievement rewards given

### **Save/Load**
- ✅ Reliable save/load functionality
- ✅ State migration works
- ✅ Cloud save/load works
- ✅ Error handling robust

### **Perks**
- ✅ All perks apply correctly
- ✅ Perk effects visible in game
- ✅ Perks persist between sessions
- ✅ Perk validation works

This comprehensive bug fix implementation will ensure all game logic works correctly and reliably! 🚀
