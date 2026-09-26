import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import { soundManager } from '@/utils/soundManager';

/** Settings and lifecycle only. Observes committed weeks; never runs a tick. */
export default function GameAudioBridge() {
  const { enabled, week, life } = useGameSelector(s => ({ enabled: s.settings?.soundEnabled !== false, week: s.weeksLived, life: `${s.lineageId}:${s.generationNumber}` }), shallowEqual);
  const previous = useRef({ week, life });
  useEffect(() => {
    const apply = () => soundManager.setEnabled(enabled && AppState.currentState === 'active');
    apply();
    if (enabled) void soundManager.initialize();
    const listener = AppState.addEventListener('change', apply);
    return () => { listener.remove(); soundManager.setEnabled(false); };
  }, [enabled]);
  useEffect(() => {
    if (life === previous.current.life && week === previous.current.week + 1) void soundManager.playSound('week');
    previous.current = { week, life };
  }, [week, life]);
  return null;
}
