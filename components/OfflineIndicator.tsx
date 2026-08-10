import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff, Wifi } from 'lucide-react-native';
import { useNetworkStatus } from '@/utils/offlineManager';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { responsiveFontSize } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';

function OfflineIndicator() {
  const { isOnline, pendingActions } = useNetworkStatus();
  const isDarkMode = useGameSelector((s) => s?.settings?.darkMode ?? false);

  if (isOnline && pendingActions === 0) {
    return null;
  }

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
    zIndex: Z_INDEX.TOAST,
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

/**
 * `React.memo` is load-bearing here, not decoration.
 *
 * This is rendered INLINE in a layout root (app/_layout.tsx), which itself
 * subscribes to game state. A selector inside a component cannot stop a
 * re-render driven by its parent — so narrowing this component's own
 * subscription achieved nothing on its own. Taking no props, `React.memo` is a
 * total barrier against that cascade, which is what makes the narrowing pay.
 */
export default React.memo(OfflineIndicator);
