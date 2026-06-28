import React from 'react';
import {
  Animated,
  ImageBackground,
  ImageSourcePropType,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameState } from '@/contexts/game/GameStateContext';
import { getOnboardingTheme } from '@/lib/config/onboardingTheme';
import { useOnboardingScreenAnimation } from '@/hooks/useOnboardingScreenAnimation';
import { responsivePadding, scale, verticalScale } from '@/utils/scaling';

interface OnboardingScreenShellProps {
  backgroundSource: ImageSourcePropType;
  children: React.ReactNode;
  /** Pinned region above the scrolling content (e.g. the main-menu profile bar). */
  header?: React.ReactNode;
  footer?: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  contentMaxWidth?: number;
  /**
   * When true the body scrolls (top-aligned) instead of being pinned to the
   * bottom. Use for taller layouts like the redesigned Main Menu.
   */
  scrollable?: boolean;
}

export default function OnboardingScreenShell({
  backgroundSource,
  children,
  header,
  footer,
  contentContainerStyle,
  contentMaxWidth = scale(420),
  scrollable = false,
}: OnboardingScreenShellProps) {
  const { gameState } = useGameState();
  const insets = useSafeAreaInsets();
  const { opacity, translateY } = useOnboardingScreenAnimation();
  const isDarkMode = Boolean(gameState?.settings?.darkMode);
  const theme = getOnboardingTheme(isDarkMode);

  const inner = <View style={[styles.inner, { maxWidth: contentMaxWidth }]}>{children}</View>;

  return (
    <ImageBackground source={backgroundSource} style={styles.container} resizeMode="cover">
      <View pointerEvents="none" style={[styles.backdrop, { backgroundColor: theme.backdrop }]} />
      <View pointerEvents="none" style={[styles.topGlow, { backgroundColor: theme.topGlow }]} />
      <View pointerEvents="none" style={[styles.bottomShade, { backgroundColor: theme.bottomShade }]} />

      {header ? (
        <View style={[styles.header, { paddingTop: insets.top + verticalScale(10) }]}>
          <View style={[styles.inner, { maxWidth: contentMaxWidth }]}>{header}</View>
        </View>
      ) : null}

      <Animated.View
        style={[
          styles.content,
          scrollable ? styles.contentScrollable : null,
          {
            opacity,
            transform: [{ translateY }],
            paddingTop: header ? verticalScale(12) : insets.top + verticalScale(32),
            paddingBottom: insets.bottom + verticalScale(18),
          },
          contentContainerStyle,
        ]}
      >
        {scrollable ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {inner}
          </ScrollView>
        ) : (
          inner
        )}
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
  contentScrollable: {
    justifyContent: 'flex-start',
  },
  scroll: {
    width: '100%',
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: verticalScale(8),
  },
  header: {
    paddingHorizontal: responsivePadding.large,
    alignItems: 'center',
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
