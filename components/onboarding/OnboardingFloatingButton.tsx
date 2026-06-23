import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import usePressableScale from '@/hooks/usePressableScale';
import { useOnboardingTheme } from '@/lib/config/onboardingTheme';

const LinearGradient = LinearGradientFallback;

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
  const theme = useOnboardingTheme();
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
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[...theme.ctaGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <Text style={[styles.title, { color: theme.ctaText }]}>{title}</Text>
            <View style={styles.iconContainer}>
              {loading ? (
                <ActivityIndicator size="small" color={theme.ctaText} />
              ) : (
                icon || <ArrowRight size={24} color={theme.ctaText} />
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
    borderRadius: 999,
    overflow: 'hidden',
    elevation: 16,
    ...Platform.select({
      web: { boxShadow: '0px 8px 24px rgba(245, 158, 11, 0.45)' } as any,
      default: {
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 22,
      },
    }),
  },
  disabled: {
    opacity: 0.5,
  },
  gradient: {
    width: '100%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    overflow: 'hidden',
    minHeight: 60,
    justifyContent: 'center',
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
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.18)',
  },
});
