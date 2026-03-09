import React from 'react';
import {
  Animated,
  ImageBackground,
  ImageSourcePropType,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '@/contexts/GameContext';
import { getOnboardingTheme } from '@/lib/config/onboardingTheme';
import { useOnboardingScreenAnimation } from '@/hooks/useOnboardingScreenAnimation';
import { responsivePadding, scale, verticalScale } from '@/utils/scaling';

interface OnboardingScreenShellProps {
  backgroundSource: ImageSourcePropType;
  children: React.ReactNode;
  footer?: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  contentMaxWidth?: number;
}

export default function OnboardingScreenShell({
  backgroundSource,
  children,
  footer,
  contentContainerStyle,
  contentMaxWidth = scale(420),
}: OnboardingScreenShellProps) {
  const { gameState } = useGame();
  const insets = useSafeAreaInsets();
  const { opacity, translateY } = useOnboardingScreenAnimation();
  const isDarkMode = Boolean(gameState?.settings?.darkMode);
  const theme = getOnboardingTheme(isDarkMode);

  return (
    <ImageBackground source={backgroundSource} style={styles.container} resizeMode="cover">
      <View pointerEvents="none" style={[styles.backdrop, { backgroundColor: theme.backdrop }]} />
      <View pointerEvents="none" style={[styles.topGlow, { backgroundColor: theme.topGlow }]} />
      <View pointerEvents="none" style={[styles.bottomShade, { backgroundColor: theme.bottomShade }]} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity,
            transform: [{ translateY }],
            paddingTop: insets.top + verticalScale(32),
            paddingBottom: insets.bottom + verticalScale(18),
          },
          contentContainerStyle,
        ]}
      >
        <View style={[styles.inner, { maxWidth: contentMaxWidth }]}>{children}</View>
      </Animated.View>

      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + verticalScale(10) }]}>{footer}</View>
      ) : null}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  topGlow: {
    position: 'absolute',
    top: -verticalScale(80),
    left: '18%',
    right: '18%',
    height: verticalScale(220),
    borderRadius: scale(120),
  },
  bottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: verticalScale(340),
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: responsivePadding.large,
    justifyContent: 'flex-end',
  },
  inner: {
    width: '100%',
  },
  footer: {
    position: 'absolute',
    left: responsivePadding.large,
    right: responsivePadding.large,
    bottom: 0,
    alignItems: 'center',
  },
});
