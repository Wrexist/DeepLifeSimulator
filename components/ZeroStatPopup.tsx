import React, { useState, useRef, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { AlertTriangle } from 'lucide-react-native';
import { logger } from '@/utils/logger';

const log = logger.scope('ZeroStatPopup');

export default function ZeroStatPopup() {
  const { gameState, dismissStatWarning } = useGame();
  const { settings, zeroStatType, showZeroStatPopup, week, stats } = gameState;
  const [localDismissed, setLocalDismissed] = useState(false);
  const dismissedRef = useRef(false);

  // Only show popup when in an active game (week > 0 indicates active game)
  const isInActiveGame = week > 0;

  // Validate that popup conditions are actually met
  const isValidPopupState = () => {
    if (!showZeroStatPopup || !zeroStatType) return false;
    
    // Check if the stat is actually at zero
    if (zeroStatType === 'health' && stats.health > 0) return false;
    if (zeroStatType === 'happiness' && stats.happiness > 0) return false;
    
    return true;
  };

  // Auto-dismiss if popup state is invalid (corrupted save)
  useEffect(() => {
    if (showZeroStatPopup && !isValidPopupState()) {
      log.warn('Auto-dismissing invalid zero stat popup state');
      dismissStatWarning();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showZeroStatPopup, zeroStatType, stats.health, stats.happiness]);

  // Reset local dismissed state when popup should show again
  useEffect(() => {
    if (showZeroStatPopup && zeroStatType && isValidPopupState()) {
      setLocalDismissed(false);
      dismissedRef.current = false;
    }
  }, [showZeroStatPopup, zeroStatType, stats.health, stats.happiness]);

  // Don't render if not in active game or if conditions aren't met
  if (!isInActiveGame || !showZeroStatPopup || !zeroStatType || localDismissed || !isValidPopupState()) {
    return null;
  }

  const message = zeroStatType === 'happiness'
    ? 'Your happiness is at 0! Increase it within 4 weeks or your character will die.'
    : 'Your health is at 0! Increase it within 4 weeks or your character will die.';

  const handleDismiss = () => {
    // Prevent multiple calls
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    
    // Immediately hide locally to prevent overlay from blocking
    setLocalDismissed(true);
    
    // Update global state - use setTimeout to ensure it happens after render
    setTimeout(() => {
      dismissStatWarning();
    }, 0);
  };

  return (
    <Modal 
      visible={!localDismissed && showZeroStatPopup && isValidPopupState()} 
      transparent 
      animationType="fade" 
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay} pointerEvents={localDismissed ? 'none' : 'auto'}>
        <View style={[styles.popup, settings.darkMode && styles.popupDark]}>
          <View style={styles.iconContainer}>
            <AlertTriangle size={32} color="#F59E0B" />
          </View>
          <Text style={[styles.title, settings.darkMode && styles.titleDark]}>Warning</Text>
          <Text style={[styles.message, settings.darkMode && styles.messageDark]}>{message}</Text>
          <TouchableOpacity 
            style={styles.button} 
            onPress={handleDismiss}
            activeOpacity={0.8}
            disabled={localDismissed}
          >
            <Text style={styles.buttonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  popupDark: {
    backgroundColor: '#1F2937',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  message: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 24,
  },
  messageDark: {
    color: '#D1D5DB',
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
