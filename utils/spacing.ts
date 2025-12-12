import { StyleSheet, Platform } from 'react-native';

// Enhanced spacing system for consistent UI
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

// Enhanced padding utilities
export const padding = {
  xs: { padding: spacing.xs },
  sm: { padding: spacing.sm },
  md: { padding: spacing.md },
  lg: { padding: spacing.lg },
  xl: { padding: spacing.xl },
  xxl: { padding: spacing.xxl },
  
  // Horizontal padding
  horizontal: {
    xs: { paddingHorizontal: spacing.xs },
    sm: { paddingHorizontal: spacing.sm },
    md: { paddingHorizontal: spacing.md },
    lg: { paddingHorizontal: spacing.lg },
    xl: { paddingHorizontal: spacing.xl },
  },
  
  // Vertical padding
  vertical: {
    xs: { paddingVertical: spacing.xs },
    sm: { paddingVertical: spacing.sm },
    md: { paddingVertical: spacing.md },
    lg: { paddingVertical: spacing.lg },
    xl: { paddingVertical: spacing.xl },
  },
  
  // Top padding
  top: {
    xs: { paddingTop: spacing.xs },
    sm: { paddingTop: spacing.sm },
    md: { paddingTop: spacing.md },
    lg: { paddingTop: spacing.lg },
    xl: { paddingTop: spacing.xl },
  },
  
  // Bottom padding
  bottom: {
    xs: { paddingBottom: spacing.xs },
    sm: { paddingBottom: spacing.sm },
    md: { paddingBottom: spacing.md },
    lg: { paddingBottom: spacing.lg },
    xl: { paddingBottom: spacing.xl },
  },
} as const;

// Enhanced margin utilities
export const margin = {
  xs: { margin: spacing.xs },
  sm: { margin: spacing.sm },
  md: { margin: spacing.md },
  lg: { margin: spacing.lg },
  xl: { margin: spacing.xl },
  xxl: { margin: spacing.xxl },
  
  // Horizontal margin
  horizontal: {
    xs: { marginHorizontal: spacing.xs },
    sm: { marginHorizontal: spacing.sm },
    md: { marginHorizontal: spacing.md },
    lg: { marginHorizontal: spacing.lg },
    xl: { marginHorizontal: spacing.xl },
  },
  
  // Vertical margin
  vertical: {
    xs: { marginVertical: spacing.xs },
    sm: { marginVertical: spacing.sm },
    md: { marginVertical: spacing.md },
    lg: { marginVertical: spacing.lg },
    xl: { marginVertical: spacing.xl },
  },
  
  // Top margin
  top: {
    xs: { marginTop: spacing.xs },
    sm: { marginTop: spacing.sm },
    md: { marginTop: spacing.md },
    lg: { marginTop: spacing.lg },
    xl: { marginTop: spacing.xl },
  },
  
  // Bottom margin
  bottom: {
    xs: { marginBottom: spacing.xs },
    sm: { marginBottom: spacing.sm },
    md: { marginBottom: spacing.md },
    lg: { marginBottom: spacing.lg },
    xl: { marginBottom: spacing.xl },
  },
} as const;

// Enhanced gap utilities
export const gap = {
  xs: { gap: spacing.xs },
  sm: { gap: spacing.sm },
  md: { gap: spacing.md },
  lg: { gap: spacing.lg },
  xl: { gap: spacing.xl },
} as const;

// Enhanced border radius utilities
export const borderRadius = {
  xs: { borderRadius: 4 },
  sm: { borderRadius: 6 },
  md: { borderRadius: 8 },
  lg: { borderRadius: 12 },
  xl: { borderRadius: 16 },
  xxl: { borderRadius: 24 },
  full: { borderRadius: 9999 },
} as const;

// Enhanced shadow utilities
export const shadow = {
  sm: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  md: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  lg: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  xl: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.2)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
} as const;

// Enhanced layout utilities
export const layout = {
  center: {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  centerHorizontal: {
    alignItems: 'center' as const,
  },
  centerVertical: {
    justifyContent: 'center' as const,
  },
  spaceBetween: {
    justifyContent: 'space-between' as const,
  },
  spaceAround: {
    justifyContent: 'space-around' as const,
  },
  spaceEvenly: {
    justifyContent: 'space-evenly' as const,
  },
  row: {
    flexDirection: 'row' as const,
  },
  column: {
    flexDirection: 'column' as const,
  },
  wrap: {
    flexWrap: 'wrap' as const,
  },
  nowrap: {
    flexWrap: 'nowrap' as const,
  },
} as const;

// Enhanced flex utilities
export const flex = {
  none: { flex: 0 },
  auto: { flex: 1 },
  full: { flex: 1 },
  half: { flex: 0.5 },
  quarter: { flex: 0.25 },
  threeQuarter: { flex: 0.75 },
} as const;

// Enhanced position utilities
export const position = {
  absolute: { position: 'absolute' as const },
  relative: { position: 'relative' as const },
  absoluteFill: StyleSheet.absoluteFillObject,
} as const;

// Enhanced overflow utilities
export const overflow = {
  hidden: { overflow: 'hidden' as const },
  visible: { overflow: 'visible' as const },
  scroll: { overflow: 'scroll' as const },
} as const;

// Enhanced opacity utilities
export const opacity = {
  transparent: { opacity: 0 },
  semiTransparent: { opacity: 0.5 },
  opaque: { opacity: 1 },
} as const;

// Enhanced z-index utilities
export const zIndex = {
  behind: { zIndex: -1 },
  default: { zIndex: 0 },
  dropdown: { zIndex: 1000 },
  sticky: { zIndex: 1020 },
  fixed: { zIndex: 1030 },
  modalBackdrop: { zIndex: 1040 },
  modal: { zIndex: 1050 },
  popover: { zIndex: 1060 },
  tooltip: { zIndex: 1070 },
} as const;

// Enhanced width utilities
export const width = {
  full: { width: '100%' },
  half: { width: '50%' },
  quarter: { width: '25%' },
  threeQuarter: { width: '75%' },
  auto: { width: 'auto' },
} as const;

// Enhanced height utilities
export const height = {
  full: { height: '100%' },
  half: { height: '50%' },
  quarter: { height: '25%' },
  threeQuarter: { height: '75%' },
  auto: { height: 'auto' },
} as const;

// Enhanced text alignment utilities
export const textAlign = {
  left: { textAlign: 'left' as const },
  center: { textAlign: 'center' as const },
  right: { textAlign: 'right' as const },
  justify: { textAlign: 'justify' as const },
} as const;

// Enhanced font weight utilities
export const fontWeight = {
  normal: { fontWeight: 'normal' as const },
  bold: { fontWeight: 'bold' as const },
  '100': { fontWeight: '100' as const },
  '200': { fontWeight: '200' as const },
  '300': { fontWeight: '300' as const },
  '400': { fontWeight: '400' as const },
  '500': { fontWeight: '500' as const },
  '600': { fontWeight: '600' as const },
  '700': { fontWeight: '700' as const },
  '800': { fontWeight: '800' as const },
  '900': { fontWeight: '900' as const },
} as const;

// Enhanced font size utilities
export const fontSize = {
  xs: { fontSize: 12 },
  sm: { fontSize: 14 },
  md: { fontSize: 16 },
  lg: { fontSize: 18 },
  xl: { fontSize: 20 },
  xxl: { fontSize: 24 },
  xxxl: { fontSize: 32 },
} as const;

// Enhanced line height utilities
export const lineHeight = {
  xs: { lineHeight: 16 },
  sm: { lineHeight: 20 },
  md: { lineHeight: 24 },
  lg: { lineHeight: 28 },
  xl: { lineHeight: 32 },
  xxl: { lineHeight: 40 },
  xxxl: { lineHeight: 48 },
} as const;

// Enhanced color utilities
export const colors = {
  // Primary colors
  primary: '#3B82F6',
  primaryDark: '#1D4ED8',
  primaryLight: '#60A5FA',
  
  // Secondary colors
  secondary: '#10B981',
  secondaryDark: '#059669',
  secondaryLight: '#34D399',
  
  // Success colors
  success: '#10B981',
  successDark: '#059669',
  successLight: '#34D399',
  
  // Warning colors
  warning: '#F59E0B',
  warningDark: '#D97706',
  warningLight: '#FBBF24',
  
  // Error colors
  error: '#EF4444',
  errorDark: '#DC2626',
  errorLight: '#F87171',
  
  // Info colors
  info: '#3B82F6',
  infoDark: '#1D4ED8',
  infoLight: '#60A5FA',
  
  // Neutral colors
  white: '#FFFFFF',
  black: '#000000',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  
  // Dark mode colors
  dark: {
    background: '#111827',
    surface: '#1F2937',
    card: '#374151',
    text: '#FFFFFF',
    textSecondary: '#9CA3AF',
    border: '#4B5563',
  },
  
  // Light mode colors
  light: {
    background: '#FFFFFF',
    surface: '#F9FAFB',
    card: '#FFFFFF',
    text: '#1F2937',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
  },
} as const;

// Enhanced background utilities
export const background = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondary },
  success: { backgroundColor: colors.success },
  warning: { backgroundColor: colors.warning },
  error: { backgroundColor: colors.error },
  info: { backgroundColor: colors.info },
  white: { backgroundColor: colors.white },
  black: { backgroundColor: colors.black },
  transparent: { backgroundColor: 'transparent' },
} as const;

// Enhanced text color utilities
export const textColor = {
  primary: { color: colors.primary },
  secondary: { color: colors.secondary },
  success: { color: colors.success },
  warning: { color: colors.warning },
  error: { color: colors.error },
  info: { color: colors.info },
  white: { color: colors.white },
  black: { color: colors.black },
  gray: { color: colors.gray[500] },
  grayLight: { color: colors.gray[400] },
  grayDark: { color: colors.gray[600] },
} as const;

// Enhanced border color utilities
export const borderColor = {
  primary: { borderColor: colors.primary },
  secondary: { borderColor: colors.secondary },
  success: { borderColor: colors.success },
  warning: { borderColor: colors.warning },
  error: { borderColor: colors.error },
  info: { borderColor: colors.info },
  white: { borderColor: colors.white },
  black: { borderColor: colors.black },
  gray: { borderColor: colors.gray[300] },
  grayLight: { borderColor: colors.gray[200] },
  grayDark: { borderColor: colors.gray[400] },
} as const;

// Enhanced border width utilities
export const borderWidth = {
  none: { borderWidth: 0 },
  thin: { borderWidth: 1 },
  medium: { borderWidth: 2 },
  thick: { borderWidth: 4 },
} as const;

// Enhanced border style utilities
export const borderStyle = {
  solid: { borderStyle: 'solid' as const },
  dashed: { borderStyle: 'dashed' as const },
  dotted: { borderStyle: 'dotted' as const },
} as const;

// Enhanced border utilities
export const border = {
  none: { borderWidth: 0 },
  thin: { borderWidth: 1 },
  medium: { borderWidth: 2 },
  thick: { borderWidth: 4 },
  
  // Border radius combinations
  rounded: { ...borderRadius.md, ...borderWidth.thin },
  roundedThick: { ...borderRadius.md, ...borderWidth.medium },
  roundedThin: { ...borderRadius.sm, ...borderWidth.thin },
} as const;

// Enhanced display utilities
export const display = {
  none: { display: 'none' as const },
  flex: { display: 'flex' as const },
} as const;

// Enhanced visibility utilities
export const visibility = {
  visible: { visibility: 'visible' as const },
  hidden: { visibility: 'hidden' as const },
} as const;

// Enhanced pointer events utilities
export const pointerEvents = {
  auto: { pointerEvents: 'auto' as const },
  none: { pointerEvents: 'none' as const },
  boxNone: { pointerEvents: 'box-none' as const },
  boxOnly: { pointerEvents: 'box-only' as const },
} as const;

// Enhanced touchable utilities
export const touchable = {
  disabled: { opacity: 0.5, pointerEvents: 'none' as const },
  enabled: { opacity: 1, pointerEvents: 'auto' as const },
} as const;

// Enhanced accessibility utilities
export const accessibility = {
  hidden: { accessibilityElementsHidden: true },
  visible: { accessibilityElementsHidden: false },
  label: (label: string) => ({ accessibilityLabel: label }),
  hint: (hint: string) => ({ accessibilityHint: hint }),
  role: (role: string) => ({ accessibilityRole: role as any }),
} as const;

// Enhanced animation utilities
export const animation = {
  duration: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  easing: {
    linear: 'linear' as const,
    ease: 'ease' as const,
    easeIn: 'ease-in' as const,
    easeOut: 'ease-out' as const,
    easeInOut: 'ease-in-out' as const,
  },
} as const;

// Enhanced responsive utilities
export const responsive = {
  // Breakpoints
  breakpoints: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
  },
  
  // Media queries
  isSmallScreen: (width: number) => width < 640,
  isMediumScreen: (width: number) => width >= 640 && width < 768,
  isLargeScreen: (width: number) => width >= 768 && width < 1024,
  isXLargeScreen: (width: number) => width >= 1024,
} as const;

// Enhanced utility functions
export const utils = {
  // Combine multiple style objects
  combine: (...styles: any[]) => StyleSheet.flatten(styles),
  
  // Create conditional styles
  conditional: (condition: boolean, trueStyle: any, falseStyle: any = {}) => 
    condition ? trueStyle : falseStyle,
  
  // Create responsive styles
  responsive: (styles: any, width: number) => {
    if (responsive.isSmallScreen(width)) {
      return { ...styles, ...styles.sm };
    } else if (responsive.isMediumScreen(width)) {
      return { ...styles, ...styles.md };
    } else if (responsive.isLargeScreen(width)) {
      return { ...styles, ...styles.lg };
    } else {
      return { ...styles, ...styles.xl };
    }
  },
  
  // Create dark mode styles
  darkMode: (lightStyle: any, darkStyle: any) => ({
    ...lightStyle,
    ...darkStyle,
  }),
} as const;

// Export all utilities
export default {
  spacing,
  padding,
  margin,
  gap,
  borderRadius,
  shadow,
  layout,
  flex,
  position,
  overflow,
  opacity,
  zIndex,
  width,
  height,
  textAlign,
  fontWeight,
  fontSize,
  lineHeight,
  colors,
  background,
  textColor,
  borderColor,
  borderWidth,
  borderStyle,
  border,
  display,
  visibility,
  pointerEvents,
  touchable,
  accessibility,
  animation,
  responsive,
  utils,
};
