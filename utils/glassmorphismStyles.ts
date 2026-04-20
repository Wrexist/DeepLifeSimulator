/**
 * Glassmorphism Design System Utilities
 * 
 * Provides reusable style generators for glassmorphism UI elements
 * inspired by Apple's Liquid Glass aesthetic.
 */

import { Platform, ViewStyle } from 'react-native';
import { responsiveBorderRadius, scale } from './scaling';

/**
 * Platform-specific shadow configuration for glassmorphism
 */
export function getPlatformShadows(
  elevation: number = 8,
  opacity: number = 0.15,
  offsetY: number = 0,
  radius: number = 20
) {
  return Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: offsetY || Math.ceil(elevation / 2) },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: {
      elevation: Math.ceil(elevation / 2),
    },
    web: {
      boxShadow: `0px ${offsetY || Math.ceil(elevation / 2)}px ${radius}px rgba(0, 0, 0, ${opacity})`,
    },
  });
}

/**
 * Base glass container style generator
 */
export function getGlassContainer(darkMode: boolean = false, opacity: number = 0.3): ViewStyle {
  return {
    backgroundColor: darkMode
      ? `rgba(15, 23, 42, ${opacity})`
      : `rgba(255, 255, 255, ${opacity})`,
    borderWidth: 1.5,
    borderColor: darkMode
      ? 'rgba(255, 255, 255, 0.15)'
      : 'rgba(255, 255, 255, 0.4)',
    borderRadius: responsiveBorderRadius.xl,
    ...getPlatformShadows(8, 0.15),
  };
}

/**
 * Glass card style with elevation
 */
export function getGlassCard(darkMode: boolean = false, elevation: number = 8): ViewStyle {
  return {
    ...getGlassContainer(darkMode, darkMode ? 0.4 : 0.3),
    ...getPlatformShadows(elevation, 0.2, 0, 16),
  };
}

/**
 * Glass button style
 */
export function getGlassButton(darkMode: boolean = false, active: boolean = false): ViewStyle {
  const baseOpacity = active ? (darkMode ? 0.5 : 0.4) : (darkMode ? 0.3 : 0.25);
  const borderOpacity = active ? 0.5 : (darkMode ? 0.15 : 0.3);
  
  return {
    backgroundColor: darkMode
      ? `rgba(15, 23, 42, ${baseOpacity})`
      : `rgba(255, 255, 255, ${baseOpacity})`,
    borderWidth: 1.5,
    borderColor: darkMode
      ? `rgba(255, 255, 255, ${borderOpacity})`
      : `rgba(255, 255, 255, ${borderOpacity})`,
    borderRadius: responsiveBorderRadius.lg,
    ...getPlatformShadows(active ? 6 : 4, active ? 0.25 : 0.15),
  };
}

/**
 * Glass tab style
 */
export function getGlassTab(darkMode: boolean = false, active: boolean = false): ViewStyle {
  const baseOpacity = active ? (darkMode ? 0.4 : 0.35) : (darkMode ? 0.25 : 0.2);
  const borderColor = active
    ? (darkMode ? 'rgba(59, 130, 246, 0.6)' : 'rgba(59, 130, 246, 0.5)')
    : (darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)');
  
  return {
    backgroundColor: darkMode
      ? `rgba(15, 23, 42, ${baseOpacity})`
      : `rgba(255, 255, 255, ${baseOpacity})`,
    borderWidth: 1.5,
    borderColor: borderColor,
    borderRadius: responsiveBorderRadius.lg,
    ...getPlatformShadows(active ? 6 : 2, active ? 0.3 : 0.1),
  };
}

/**
 * Glass icon container style
 */
export function getGlassIconContainer(darkMode: boolean = false, size: number = 48): ViewStyle {
  return {
    width: scale(size),
    height: scale(size),
    borderRadius: scale(size / 2),
    backgroundColor: darkMode
      ? 'rgba(30, 41, 59, 0.3)'
      : 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: darkMode
      ? 'rgba(255, 255, 255, 0.2)'
      : 'rgba(255, 255, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    ...getPlatformShadows(4, 0.2),
  };
}

/**
 * Glass header style
 */
export function getGlassHeader(darkMode: boolean = false): ViewStyle {
  return {
    backgroundColor: darkMode
      ? 'rgba(15, 23, 42, 0.4)'
      : 'rgba(255, 255, 255, 0.25)',
    borderRadius: responsiveBorderRadius.xl,
    padding: scale(18),
    borderWidth: 1,
    borderColor: darkMode
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(255, 255, 255, 0.4)',
    ...getPlatformShadows(8, 0.15, 0, 20),
  };
}

/**
 * Glass tab bar container style
 */
export function getGlassTabBar(darkMode: boolean = false): ViewStyle {
  return {
    backgroundColor: darkMode
      ? 'rgba(15, 23, 42, 0.7)'
      : 'rgba(255, 255, 255, 0.7)',
    borderTopWidth: 1,
    borderTopColor: darkMode
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(0, 0, 0, 0.05)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 0,
      },
      web: {
        boxShadow: '0px -4px 20px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(20px) saturate(180%)',
      },
    }),
  };
}

/**
 * Glass app card style
 */
export function getGlassAppCard(darkMode: boolean = false): ViewStyle {
  return {
    backgroundColor: darkMode
      ? 'rgba(15, 23, 42, 0.4)'
      : 'rgba(255, 255, 255, 0.3)',
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1.5,
    borderColor: darkMode
      ? 'rgba(255, 255, 255, 0.15)'
      : 'rgba(255, 255, 255, 0.5)',
    ...getPlatformShadows(8, 0.2, 0, 16),
  };
}

/**
 * Glass category tabs container style
 */
export function getGlassCategoryTabsContainer(darkMode: boolean = false): ViewStyle {
  return {
    backgroundColor: darkMode
      ? 'rgba(15, 23, 42, 0.5)'
      : 'rgba(255, 255, 255, 0.2)',
    borderRadius: responsiveBorderRadius.xl,
    padding: scale(4),
    borderWidth: 1,
    borderColor: darkMode
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(255, 255, 255, 0.3)',
    ...getPlatformShadows(4, 0.1, 0, 12),
  };
}

