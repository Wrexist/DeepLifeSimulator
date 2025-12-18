import React from 'react';
import { View, ViewStyle } from 'react-native';
import { MotiView, MotiText } from '@/components/anim/MotiStub';

interface StatBarProps {
  pct: number; // 0-100
  height?: number;
  style?: ViewStyle;
}

export default function StatBar({ pct, height = 10, style }: StatBarProps) {
  const color = pct > 66 ? '#22c55e' : pct > 33 ? '#eab308' : '#ef4444';

  return (
    <View style={[{ backgroundColor: '#1f2937', borderRadius: 8, overflow: 'hidden', height }, style]}>
      <MotiView
        from={{ width: '0%', backgroundColor: color }}
        animate={{ width: `${pct}%`, backgroundColor: color }}
        transition={{ type: 'timing', duration: 350 }}
        style={{ height: '100%' }}
      />
    </View>
  );
}
