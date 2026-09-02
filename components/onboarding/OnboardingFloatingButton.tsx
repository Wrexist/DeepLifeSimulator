import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import usePressableScale from '@/hooks/usePressableScale';
import { fontScale } from '@/utils/scaling';

const LinearGradient = Gradient;

interface OnboardingFloatingButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

export default function OnboardingFloatingButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  icon,
}: OnboardingFloatingButtonProps) {
  // Native-driver press scale for instant tactile feedback. Handlers own the
  // action haptic, so disable the hook's press-in haptic to avoid doubling.
  const { AnimatedView, animatedStyle, onPressIn, onPressOut } = usePressableScale({ haptic: false });
  const isDisabled = disabled || loading;

  return (
    <AnimatedView style={animatedStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        style={[styles.floatingButton, isDisabled ? styles.disabled : undefined]}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#3B82F6', '#2563EB', '#1D4ED8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.iconContainer}>
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                icon || <ArrowRight size={24} color="#FFFFFF" />
              )}
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 16,
    ...Platform.select({
      web: { boxShadow: '0px 8px 20px rgba(59, 130, 246, 0.6)' } as any,
      default: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
      },
    }),
  },
  disabled: {
    opacity: 0.5,
  },
  gradient: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    overflow: 'hidden',
    minHeight: 64,
    justifyContent: 'center',
    elevation: 8,
    ...Platform.select({
      web: { boxShadow: '0px 4px 12px rgba(59, 130, 246, 0.5)' } as any,
      default: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
      },
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    width: '100%',
  },
  title: {
    // The one raw literal on the wizard - the CTA was the only text that
    // ignored fontScale. Tier 1 of the wizard, sized on the ladder.
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    ...Platform.select({
      web: { textShadow: '0px 2px 4px rgba(0, 0, 0, 0.3)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
      },
    }),
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    elevation: 3,
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(255, 255, 255, 0.1)' } as any,
      default: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
});
