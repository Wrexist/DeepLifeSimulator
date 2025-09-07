# 🐛 Bug Fixes Implementation Plan

## **5. Vanliga buggar att leta efter och fixa:**

### **✅ Memory Leaks (app blir långsammare över tid)**

#### **Problem 1: setTimeout utan cleanup i work.tsx**
```typescript
// ❌ Dåligt - memory leak
setTimeout(() => {
  setWorkFeedback(prev => {
    const newFeedback = { ...prev };
    delete newFeedback[jobId];
    return newFeedback;
  });
}, 3000);
```

**Fix:**
```typescript
// ✅ Bra - med cleanup
useEffect(() => {
  const timeouts: NodeJS.Timeout[] = [];
  
  const handleStreetJob = (jobId: string) => {
    const result = performStreetJob(jobId);
    if (result) {
      setWorkFeedback({ [jobId]: result.message });
      const timeout = setTimeout(() => {
        setWorkFeedback(prev => {
          const newFeedback = { ...prev };
          delete newFeedback[jobId];
          return newFeedback;
        });
      }, 3000);
      timeouts.push(timeout);
    }
  };

  return () => {
    timeouts.forEach(clearTimeout);
  };
}, []);
```

#### **Problem 2: Animated.timing utan cleanup**
```typescript
// ❌ Dåligt - animationer som inte städas upp
Animated.timing(feedbackOpacity, {
  toValue: 1,
  duration: 200,
  useNativeDriver: true,
}).start(() => {
  Animated.timing(feedbackOpacity, {
    toValue: 0,
    duration: 200,
    delay: 2500,
    useNativeDriver: true,
  }).start();
});
```

**Fix:**
```typescript
// ✅ Bra - med cleanup
useEffect(() => {
  let animationRef: Animated.CompositeAnimation | null = null;
  
  if (Object.keys(workFeedback).length > 0) {
    feedbackOpacity.setValue(0);
    animationRef = Animated.timing(feedbackOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    });
    
    animationRef.start(() => {
      animationRef = Animated.timing(feedbackOpacity, {
        toValue: 0,
        duration: 200,
        delay: 2500,
        useNativeDriver: true,
      });
      animationRef?.start();
    });
  }

  return () => {
    if (animationRef) {
      animationRef.stop();
    }
  };
}, [workFeedback, feedbackOpacity]);
```

### **✅ Crashes vid snabb navigation mellan screens**

#### **Problem 3: Navigation state race conditions**
```typescript
// ❌ Dåligt - kan crasha vid snabb navigation
const continueGame = async () => {
  await loadGame();
  router.replace('/(tabs)');
};
```

**Fix:**
```typescript
// ✅ Bra - med navigation guards
const continueGame = async () => {
  try {
    const isMounted = useRef(true);
    
    if (!isMounted.current) return;
    
    await loadGame();
    
    if (isMounted.current) {
      router.replace('/(tabs)');
    }
  } catch (error) {
    console.error('Navigation error:', error);
  }
};
```

#### **Problem 4: AsyncStorage race conditions**
```typescript
// ❌ Dåligt - kan crasha vid snabb navigation
useEffect(() => {
  (async () => {
    const last = await AsyncStorage.getItem('lastSlot');
    if (last) setHasSave(true);
  })();
}, []);
```

**Fix:**
```typescript
// ✅ Bra - med cleanup och error handling
useEffect(() => {
  let isMounted = true;
  
  (async () => {
    try {
      const last = await AsyncStorage.getItem('lastSlot');
      if (isMounted && last) {
        setHasSave(true);
      }
    } catch (error) {
      console.error('Error loading save slot:', error);
    }
  })();

  return () => {
    isMounted = false;
  };
}, []);
```

### **✅ Data som inte sparas korrekt**

#### **Problem 5: AsyncStorage error handling**
```typescript
// ❌ Dåligt - ingen error handling
const saveGame = async () => {
  await AsyncStorage.setItem(`save_slot_${currentSlot}`, JSON.stringify(gameState));
};
```

**Fix:**
```typescript
// ✅ Bra - med retry logic och error handling
const saveGame = async (retryCount = 0) => {
  try {
    const stateToSave = {
      ...gameState,
      lastSaved: Date.now(),
      version: STATE_VERSION,
    };
    
    await AsyncStorage.setItem(
      `save_slot_${currentSlot}`, 
      JSON.stringify(stateToSave)
    );
    
    console.log('Game saved successfully');
  } catch (error) {
    console.error('Save error:', error);
    
    if (retryCount < 3) {
      console.log(`Retrying save... (${retryCount + 1}/3)`);
      setTimeout(() => saveGame(retryCount + 1), 1000);
    } else {
      Alert.alert('Save Error', 'Failed to save game. Please try again.');
    }
  }
};
```

#### **Problem 6: State migration issues**
```typescript
// ❌ Dåligt - kan förlora data vid migration
const migrateState = (state: any) => {
  if (!state.bankSavings) {
    state.bankSavings = 0;
  }
  return state;
};
```

**Fix:**
```typescript
// ✅ Bra - säker migration med backup
const migrateState = (state: any) => {
  const backup = JSON.stringify(state);
  
  try {
    if (!state.bankSavings) {
      state.bankSavings = 0;
    }
    
    // Validera state efter migration
    if (!state.stats || !state.settings) {
      throw new Error('Invalid state structure');
    }
    
    return state;
  } catch (error) {
    console.error('Migration failed, restoring backup:', error);
    return JSON.parse(backup);
  }
};
```

### **✅ Animationer som fryser eller hackar**

#### **Problem 7: Reanimated animationer utan cleanup**
```typescript
// ❌ Dåligt - kan frysa
const scale = useSharedValue(1);
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: scale.value }],
}));
```

**Fix:**
```typescript
// ✅ Bra - med proper cleanup
const usePressableScale = () => {
  const scale = useSharedValue(1);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      scale.value = 1;
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    if (isMounted.current) {
      scale.value = withTiming(0.97, { duration: 80 });
    }
  };

  const onPressOut = () => {
    if (isMounted.current) {
      scale.value = withTiming(1, { duration: 80 });
    }
  };

  return { animatedStyle, onPressIn, onPressOut };
};
```

#### **Problem 8: Lottie animationer utan cleanup**
```typescript
// ❌ Dåligt - memory leak
<LottieView
  source={require('@/assets/lottie/confetti.json')}
  autoPlay
  loop={false}
/>
```

**Fix:**
```typescript
// ✅ Bra - med proper cleanup
const [shouldPlay, setShouldPlay] = useState(false);

useEffect(() => {
  if (title) {
    setShouldPlay(true);
    const timer = setTimeout(() => {
      setShouldPlay(false);
      setTitle(null);
    }, 2500);
    
    return () => {
      clearTimeout(timer);
      setShouldPlay(false);
    };
  }
}, [title]);

{shouldPlay && (
  <LottieView
    source={require('@/assets/lottie/confetti.json')}
    autoPlay
    loop={false}
    onAnimationFinish={() => setShouldPlay(false)}
  />
)}
```

### **✅ Ljud som inte fungerar korrekt**

#### **Problem 9: Haptics utan error handling**
```typescript
// ❌ Dåligt - kan crasha
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
```

**Fix:**
```typescript
// ✅ Bra - med error handling och platform check
const triggerHaptic = async () => {
  try {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch (error) {
    console.warn('Haptic feedback failed:', error);
  }
};
```

#### **Problem 10: Sound settings inte implementerade**
```typescript
// ❌ Dåligt - soundEnabled finns men används inte
settings: {
  soundEnabled: true,
}
```

**Fix:**
```typescript
// ✅ Bra - implementera sound system
import { Audio } from 'expo-av';

const useSound = () => {
  const { gameState } = useGame();
  const { soundEnabled } = gameState.settings;
  
  const playSound = async (soundFile: string) => {
    if (!soundEnabled) return;
    
    try {
      const { sound } = await Audio.Sound.createAsync(
        require(`@/assets/sounds/${soundFile}.mp3`)
      );
      await sound.playAsync();
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.warn('Sound playback failed:', error);
    }
  };
  
  return { playSound };
};
```

### **✅ Notifikationer som inte fungerar**

#### **Problem 11: Notifications utan proper error handling**
```typescript
// ❌ Dåligt - kan faila tyst
export async function scheduleDailyReminder(hour = 9) {
  const hasPermission = await initializeNotifications();
  if (!hasPermission) return;
  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-reminder',
    content: {
      title: 'Daily Bonus Ready',
      body: 'Return to claim your gold and cash boost!'
    },
    trigger: { hour, minute: 0, repeats: true }
  });
}
```

**Fix:**
```typescript
// ✅ Bra - med proper error handling och retry logic
export async function scheduleDailyReminder(hour = 9, retryCount = 0) {
  try {
    if (Platform.OS === 'web') return;
    
    const hasPermission = await initializeNotifications();
    if (!hasPermission) {
      console.warn('Notification permission denied');
      return false;
    }
    
    // Cancel existing notification first
    await Notifications.cancelScheduledNotificationAsync('daily-reminder');
    
    await Notifications.scheduleNotificationAsync({
      identifier: 'daily-reminder',
      content: {
        title: 'Daily Bonus Ready',
        body: 'Return to claim your gold and cash boost!',
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: { 
        hour, 
        minute: 0, 
        repeats: true 
      }
    });
    
    console.log('Daily reminder scheduled successfully');
    return true;
  } catch (error) {
    console.error('Failed to schedule notification:', error);
    
    if (retryCount < 3) {
      console.log(`Retrying notification setup... (${retryCount + 1}/3)`);
      setTimeout(() => scheduleDailyReminder(hour, retryCount + 1), 2000);
    }
    
    return false;
  }
}
```

#### **Problem 12: Notification permissions inte hanterade**
```typescript
// ❌ Dåligt - ingen proper permission handling
export async function initializeNotifications(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const request = await Notifications.requestPermissionsAsync();
  return request.granted;
}
```

**Fix:**
```typescript
// ✅ Bra - med proper permission flow
export async function initializeNotifications(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return false;
    
    const settings = await Notifications.getPermissionsAsync();
    
    if (settings.granted) {
      return true;
    }
    
    if (settings.canAskAgain) {
      const request = await Notifications.requestPermissionsAsync();
      return request.granted;
    } else {
      // User denied and can't ask again
      console.warn('Notification permissions permanently denied');
      return false;
    }
  } catch (error) {
    console.error('Notification permission error:', error);
    return false;
  }
}
```

## **🔧 Implementation Steps:**

### **Step 1: Fix Memory Leaks**
1. Add cleanup functions to all useEffect hooks
2. Clear timeouts and intervals properly
3. Stop animations on component unmount

### **Step 2: Fix Navigation Crashes**
1. Add navigation guards
2. Implement proper error boundaries
3. Handle async operations safely

### **Step 3: Fix Data Persistence**
1. Add retry logic to AsyncStorage operations
2. Implement proper state migration
3. Add data validation

### **Step 4: Fix Animation Issues**
1. Clean up Reanimated animations
2. Handle Lottie animation lifecycle
3. Add animation error boundaries

### **Step 5: Fix Sound System**
1. Implement proper sound management
2. Add error handling for audio
3. Respect sound settings

### **Step 6: Fix Notifications**
1. Add proper permission handling
2. Implement retry logic
3. Add error reporting

## **🧪 Testing Checklist:**

- [ ] Test rapid navigation between screens
- [ ] Test app performance over long sessions
- [ ] Test data persistence after app restart
- [ ] Test animations on different devices
- [ ] Test sound with different settings
- [ ] Test notifications on different platforms
- [ ] Test error scenarios (no internet, low memory)
- [ ] Test app behavior when backgrounded/foregrounded

## **📊 Performance Monitoring:**

```typescript
// Add performance monitoring
const usePerformanceMonitor = () => {
  useEffect(() => {
    const startTime = Date.now();
    
    return () => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (duration > 1000) {
        console.warn(`Component took ${duration}ms to unmount`);
      }
    };
  }, []);
};
```

This comprehensive bug-fixing plan addresses all the common issues that can affect app stability, performance, and user experience! 🚀
