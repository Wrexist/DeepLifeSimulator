// DISABLED: react-native-reanimated removed to fix TurboModule crash
// This hook now returns non-animated versions
import { useRef, useEffect } from 'react';
import { View } from 'react-native';
// CRITICAL: Lazy-load expo-haptics to prevent TurboModule crash at module load
// import * as Haptics from 'expo-haptics'; // REMOVED - lazy load instead
import { logger } from '@/utils/logger';
import { Platform } from 'react-native';

// Lazy-loaded Haptics module
let Haptics: any = null;
let hapticsLoadAttempted = false;

function loadHapticsModule(): boolean {
  if (hapticsLoadAttempted) {
    return Haptics !== null;
  }
  
  hapticsLoadAttempted = true;
  
  try {
    Haptics = require('expo-haptics');
    return true;
  } catch (error) {
    // Module not available - will skip haptics
    return false;
  }
}

interface UsePressableScaleOptions {
  scale?: number;
  duration?: number;
  haptic?: boolean;
  spring?: boolean;
  glow?: boolean;
  hapticEnabled?: boolean; // Optional - pass from parent if needed
}

export default function usePressableScale(options: UsePressableScaleOptions = {}) {
  const {
    haptic = true,
    hapticEnabled = true,
  } = options;

  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Non-animated empty style
  const animatedStyle = {};

  // No-op press handlers (animations disabled)
  const onPressIn = () => {
    // Animation disabled - do nothing
  };

  const onPressOut = () => {
    // Animation disabled - do nothing
  };

  const onHaptic = async () => {
    if (!haptic || !hapticEnabled) return;
    
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePressableScale.ts:48',message:'Before Haptics.impactAsync',data:{platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePressableScale.ts:53',message:'After Haptics.impactAsync',data:{success:true},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePressableScale.ts:57',message:'Haptics error',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      if (__DEV__) {
        logger.warn('Haptic feedback not available:', error);
      }
    }
  };

  return {
    AnimatedView: View, // Use plain View instead of Animated.View
    animatedStyle,
    onPressIn,
    onPressOut,
    onHaptic,
  } as const;
}