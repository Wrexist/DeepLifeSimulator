import React from 'react';
import { MotiView, MotiText } from '@/components/anim/MotiStub';

interface FadeInUpProps {
  delay?: number;
  children: React.ReactNode;
}

export default function FadeInUp({ delay = 0, children }: FadeInUpProps) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 250, delay }}
    >
      {children}
    </MotiView>
  );
}
