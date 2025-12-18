/**
 * Gaming & Streaming App - Streaming Logic Hook
 */
import { useState, useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { GameState, StreamSession } from '@/contexts/game/types';

export const useStreamingLogic = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  availableGames: { id: string; name: string; baseViewers: number }[]
) => {
  const { gamingStreaming } = gameState;
  
  // Local state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamDuration, setStreamDuration] = useState(0);
  const [currentViewers, setCurrentViewers] = useState(0);
  const [totalDonations, setTotalDonations] = useState(0);
  const [currentSubsGained, setCurrentSubsGained] = useState(0);
  const [streamDonations, setStreamDonations] = useState<{ amount: number; message: string; timestamp: number }[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  // Timers - setInterval returns different types on different platforms
  type TimerType = ReturnType<typeof setInterval>;
  const [streamTimer, setStreamTimer] = useState<TimerType | null>(null);
  const [viewersTimer, setViewersTimer] = useState<TimerType | null>(null);
  const [subsTimer, setSubsTimer] = useState<TimerType | null>(null);
  const [donationTimer, setDonationTimer] = useState<TimerType | null>(null);
  
  // TESTFLIGHT FIX: Use ref to track current stream duration for deterministic calculations
  const streamDurationRef = useRef(0);

  // Load saved state
  useEffect(() => {
    if (gamingStreaming?.streamingState) {
      const state = gamingStreaming.streamingState;
      setIsStreaming(state.isStreaming);
      setStreamDuration(state.streamDuration);
      streamDurationRef.current = state.streamDuration; // TESTFLIGHT FIX: Initialize ref
      setCurrentViewers(state.currentViewers);
      setTotalDonations(state.totalDonations);
      setCurrentSubsGained(state.currentSubsGained);
      setSelectedGame(state.selectedGame || null);
      
      if (state.isStreaming) {
        resumeStreamTimers();
      }
    }
  }, []);

  // Helper to update persistent state
  const updateStreamingState = (newState: any) => {
    setGameState(prev => ({
      ...prev,
      gamingStreaming: {
        ...prev.gamingStreaming!,
        streamingState: {
          ...prev.gamingStreaming!.streamingState!,
          ...newState
        }
      }
    }));
  };

  const startStream = (gameId: string) => {
    if (isStreaming) return;
    
    setIsStreaming(true);
    setStreamDuration(0);
    streamDurationRef.current = 0; // TESTFLIGHT FIX: Initialize ref
    setCurrentViewers(0);
    setTotalDonations(0);
    setCurrentSubsGained(0);
    setStreamDonations([]);
    setSelectedGame(gameId);
    
    updateStreamingState({
      isStreaming: true,
      selectedGame: gameId,
      streamDuration: 0,
      currentViewers: 0,
      totalDonations: 0,
      currentSubsGained: 0,
    });

    resumeStreamTimers();
  };

  // TESTFLIGHT FIX: Deterministic random function for consistency on resume
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  const resumeStreamTimers = () => {
    // CRITICAL: Prevent double resume - clear existing timers first
    clearTimers();
    
    // CRITICAL: Use refs to get current values, not stale closures
    const currentSelectedGame = selectedGameRef.current;
    
    // Duration timer - update both state and ref
    const sTimer = setInterval(() => {
      setStreamDuration(prev => {
        const next = prev + 1;
        streamDurationRef.current = next; // TESTFLIGHT FIX: Update ref for deterministic calculations
        updateStreamingState({ streamDuration: next });
        return next;
      });
    }, 1000);
    setStreamTimer(sTimer);
    streamTimerRef.current = sTimer; // CRITICAL: Update ref immediately

    // Viewers logic - deterministic based on stream duration
    const vTimer = setInterval(() => {
      setCurrentViewers(prev => {
        // TESTFLIGHT FIX: Use ref for current duration (always up-to-date)
        const currentDuration = streamDurationRef.current;
        const game = availableGames.find(g => g.id === currentSelectedGame);
        const base = game ? game.baseViewers : 10;
        // Use current stream duration as seed for deterministic variation
        const streamSeed = currentDuration * 1000 + (currentSelectedGame?.charCodeAt(0) || 0);
        const variation = Math.floor(seededRandom(streamSeed) * 10) - 2;
        const next = Math.max(0, prev + variation + Math.floor(base * 0.1));
        updateStreamingState({ currentViewers: next });
        return next;
      });
    }, 2000);
    setViewersTimer(vTimer);
    viewersTimerRef.current = vTimer; // CRITICAL: Update ref immediately

    // Subs logic - deterministic based on stream duration
    const subTimer = setInterval(() => {
      // TESTFLIGHT FIX: Use ref for current duration (always up-to-date)
      const currentDuration = streamDurationRef.current;
      // Use current stream duration as seed for deterministic chance
      const subSeed = currentDuration * 1000 + 100 + (currentSelectedGame?.charCodeAt(0) || 0);
      if (seededRandom(subSeed) < 0.1) { // 10% chance every 3s (deterministic)
        setCurrentSubsGained(prev => {
          const next = prev + 1;
          updateStreamingState({ currentSubsGained: next });
          return next;
        });
      }
    }, 3000);
    setSubsTimer(subTimer);
    subsTimerRef.current = subTimer; // CRITICAL: Update ref immediately

    // Donation logic - deterministic based on stream duration
    const dTimer = setInterval(() => {
      // TESTFLIGHT FIX: Use ref for current duration (always up-to-date)
      const currentDuration = streamDurationRef.current;
      // Use current stream duration as seed for deterministic chance
      const donationSeed = currentDuration * 1000 + 200 + (currentSelectedGame?.charCodeAt(0) || 0);
      if (seededRandom(donationSeed) < 0.05) { // 5% chance every 2s (deterministic)
        const amountSeed = donationSeed + 1;
        const amount = Math.floor(seededRandom(amountSeed) * 50) + 5;
        setTotalDonations(prev => {
          const next = prev + amount;
          updateStreamingState({ totalDonations: next });
          return next;
        });
        
        const positionSeed = donationSeed + 2;
        const newDonation = {
          id: Date.now().toString(),
          amount,
          message: 'Great stream!',
          position: { 
            top: seededRandom(positionSeed) * 200, 
            left: seededRandom(positionSeed + 1) * 200 
          }
        };
        setStreamDonations(prev => [...prev, newDonation]);
        setTimeout(() => {
          setStreamDonations(prev => prev.filter(d => d.id !== newDonation.id));
        }, 3000);
      }
    }, 2000);
    setDonationTimer(dTimer);
    donationTimerRef.current = dTimer; // CRITICAL: Update ref immediately
  };

  const endStream = () => {
    setIsStreaming(false);
    clearTimers();
    
    // Calculate earnings
    const subEarnings = currentSubsGained * 2.5; // $2.50 per sub
    const totalEarnings = totalDonations + subEarnings;

    // Update history
    const session: StreamSession = {
      id: Date.now().toString(),
      date: Date.now(),
      duration: streamDuration,
      viewers: currentViewers,
      earnings: totalEarnings,
      gameId: selectedGame || 'chatting',
      newFollowers: Math.floor(currentViewers * 0.5),
      newSubscribers: currentSubsGained,
      donations: totalDonations
    };

    setGameState(prev => ({
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money + totalEarnings
      },
      gamingStreaming: {
        ...prev.gamingStreaming!,
        // PERFORMANCE FIX: Cap streamHistory to last 100 items to prevent unbounded growth
        streamHistory: [session, ...(prev.gamingStreaming!.streamHistory || [])].slice(0, 100),
        streamingState: {
          isStreaming: false,
          streamDuration: 0,
          currentViewers: 0,
          totalDonations: 0,
          currentSubsGained: 0,
          selectedGame: '',
        }
      }
    }));

    Alert.alert('Stream Ended', `You earned $${totalEarnings.toFixed(2)} from this stream!`);
  };

  // CRITICAL: Use refs to track timers to avoid stale closures
  const streamTimerRef = useRef<TimerType | null>(null);
  const viewersTimerRef = useRef<TimerType | null>(null);
  const subsTimerRef = useRef<TimerType | null>(null);
  const donationTimerRef = useRef<TimerType | null>(null);
  const isStreamingRef = useRef<boolean>(false);
  const selectedGameRef = useRef<string | null>(null);

  // Sync refs with state
  useEffect(() => {
    streamTimerRef.current = streamTimer;
    viewersTimerRef.current = viewersTimer;
    subsTimerRef.current = subsTimer;
    donationTimerRef.current = donationTimer;
    isStreamingRef.current = isStreaming;
    selectedGameRef.current = selectedGame;
  }, [streamTimer, viewersTimer, subsTimer, donationTimer, isStreaming, selectedGame]);

  const clearTimers = () => {
    // Use refs to access current timer values
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    if (viewersTimerRef.current) {
      clearInterval(viewersTimerRef.current);
      viewersTimerRef.current = null;
    }
    if (subsTimerRef.current) {
      clearInterval(subsTimerRef.current);
      subsTimerRef.current = null;
    }
    if (donationTimerRef.current) {
      clearInterval(donationTimerRef.current);
      donationTimerRef.current = null;
    }
    
    setStreamTimer(null);
    setViewersTimer(null);
    setSubsTimer(null);
    setDonationTimer(null);
  };

  // Pause timers on background
  // CRITICAL: Empty deps - uses refs to avoid stale closures and multiple listeners
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState.match(/inactive|background/)) {
        clearTimers();
      } else if (nextAppState === 'active' && isStreamingRef.current) {
        // CRITICAL: Only resume if streaming was actually active
        // Check ref to avoid stale closure issues
        resumeStreamTimers();
      }
    });

    return () => {
      subscription.remove();
      clearTimers();
    };
  }, []); // CRITICAL: Empty deps - listener never recreated, uses refs for current values

  return {
    isStreaming,
    streamDuration,
    currentViewers,
    totalDonations,
    currentSubsGained,
    streamDonations,
    showConfetti,
    selectedGame,
    startStream,
    endStream
  };
};


