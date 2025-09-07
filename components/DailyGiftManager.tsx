import React, { useEffect } from 'react';
import { useGame } from '@/contexts/GameContext';
import DailyGiftModal from './DailyGiftModal';

export default function DailyGiftManager() {
  const { gameState, generateWeeklyGifts, hideDailyGiftModal } = useGame();
  const { dailyGifts } = gameState;
  
  // Add null checks to prevent errors
  if (!dailyGifts) {
    return null;
  }
  
  const { showDailyGiftModal, weeklyGifts } = dailyGifts;

  useEffect(() => {
    // Generate weekly gifts if not already generated
    if (weeklyGifts && weeklyGifts.length === 0) {
      generateWeeklyGifts();
    }
  }, [weeklyGifts?.length, generateWeeklyGifts]);

  return (
    <DailyGiftModal
      visible={showDailyGiftModal || false}
      onClose={hideDailyGiftModal}
    />
  );
}
