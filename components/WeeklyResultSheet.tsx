import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { MotiView } from 'moti';

interface WeeklyResultSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function WeeklyResultSheet({ visible, onClose, children }: WeeklyResultSheetProps) {
  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} style={{ pointerEvents: 'box-none' }}>
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 150 }}
        style={styles.backdrop}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
      </MotiView>
      <MotiView
        from={{ translateY: 40, opacity: 0 }}
        animate={{ translateY: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 18 }}
        style={styles.sheet}
      >
        {children}
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    padding: 16,
  },
});
