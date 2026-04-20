import React from 'react';
import { StyleSheet, View } from 'react-native';
import { responsiveBorderRadius, verticalScale } from '@/utils/scaling';

interface OnboardingStepBarProps {
  currentStep: number;
  totalSteps: number;
}

export default function OnboardingStepBar({ currentStep, totalSteps }: OnboardingStepBarProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isFilled = step <= currentStep;
        const isCurrent = step === currentStep;
        return (
          <View
            key={step}
            style={[
              styles.segment,
              isFilled ? styles.segmentFilled : styles.segmentEmpty,
              isCurrent ? styles.segmentCurrent : undefined,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
    marginTop: verticalScale(8),
  },
  segment: {
    flex: 1,
    height: verticalScale(3),
    borderRadius: responsiveBorderRadius.full,
  },
  segmentEmpty: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  segmentFilled: {
    backgroundColor: 'rgba(16, 185, 129, 0.6)',
  },
  segmentCurrent: {
    backgroundColor: 'rgba(16, 185, 129, 0.85)',
  },
});
