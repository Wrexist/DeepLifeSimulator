import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff, Wifi } from 'lucide-react-native';
import { useNetworkStatus } from '@/utils/offlineManager';
import { useGame } from '@/contexts/GameContext';
import { responsiveFontSize, responsiveSpacing } from '@/utils/scaling';

export default function OfflineIndicator() {
  const { isOnline, pendingActions } = useNetworkStatus();
  const { gameState } = useGame();

  if (isOnline && pendingActions === 0) {
    return null;
  }

  const isDarkMode = gameState?.settings?.darkMode ?? false;

  return (
    <View style={[
      styles.container,
      isDarkMode && styles.containerDark,
      !isOnline && styles.containerOffline,
    ]}>
      {!isOnline ? (
        <>
          <WifiOff size={16} color="#EF4444" />
          <Text style={[
            styles.text,
            isDarkMode && styles.textDark,
            styles.textOffline,
          ]}>
            Offline Mode
          </Text>
        </>
      ) : (
        <>
          <Wifi size={16} color="#10B981" />
          <Text style={[
            styles.text,
            isDarkMode && styles.textDark,
          ]}>
            Syncing {pendingActions} action{pendingActions !== 1 ? 's' : ''}...
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 1000,
  },
  containerDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
  },
  containerOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
  text: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
  },
  textDark: {
    color: '#FFFFFF',
  },
  textOffline: {
    color: '#FFFFFF',
  },
});

