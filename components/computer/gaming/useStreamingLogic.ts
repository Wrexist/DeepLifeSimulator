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

  // Load saved state
  useEffect(() => {
    if (gamingStreaming?.streamingState) {
      const state = gamingStreaming.streamingState;
      setIsStreaming(state.isStreaming);
      setStreamDuration(state.streamDuration);
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

  const resumeStreamTimers = () => {
    // Duration timer
    const sTimer = setInterval(() => {
      setStreamDuration(prev => {
        const next = prev + 1;
        updateStreamingState({ streamDuration: next });
        return next;
      });
    }, 1000);
    setStreamTimer(sTimer);

    // Viewers logic
    const vTimer = setInterval(() => {
      setCurrentViewers(prev => {
        const game = availableGames.find(g => g.id === selectedGame);
        const base = game ? game.baseViewers : 10;
        const variation = Math.floor(Math.random() * 10) - 2;
        const next = Math.max(0, prev + variation + Math.floor(base * 0.1));
        updateStreamingState({ currentViewers: next });
        return next;
      });
    }, 2000);
    setViewersTimer(vTimer);

    // Subs logic
    const subTimer = setInterval(() => {
      if (Math.random() < 0.1) { // 10% chance every 3s
        setCurrentSubsGained(prev => {
          const next = prev + 1;
          updateStreamingState({ currentSubsGained: next });
          return next;
        });
      }
    }, 3000);
    setSubsTimer(subTimer);

    // Donation logic
    const dTimer = setInterval(() => {
      if (Math.random() < 0.05) { // 5% chance every 2s
        const amount = Math.floor(Math.random() * 50) + 5;
        setTotalDonations(prev => {
          const next = prev + amount;
          updateStreamingState({ totalDonations: next });
          return next;
        });
        
        const newDonation = {
          id: Date.now().toString(),
          amount,
          message: 'Great stream!', // Randomize later
          position: { top: Math.random() * 200, left: Math.random() * 200 }
        };
        setStreamDonations(prev => [...prev, newDonation]);
        setTimeout(() => {
          setStreamDonations(prev => prev.filter(d => d.id !== newDonation.id));
        }, 3000);
      }
    }, 2000);
    setDonationTimer(dTimer);
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
        streamHistory: [session, ...(prev.gamingStreaming!.streamHistory || [])],
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

  const clearTimers = () => {
    if (streamTimer) clearInterval(streamTimer);
    if (viewersTimer) clearInterval(viewersTimer);
    if (subsTimer) clearInterval(subsTimer);
    if (donationTimer) clearInterval(donationTimer);
    
    setStreamTimer(null);
    setViewersTimer(null);
    setSubsTimer(null);
    setDonationTimer(null);
  };

  // Pause timers on background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState.match(/inactive|background/)) {
        clearTimers();
      } else if (nextAppState === 'active' && isStreaming) {
        resumeStreamTimers();
      }
    });

    return () => {
      subscription.remove();
      clearTimers();
    };
  }, [isStreaming, selectedGame]);

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


