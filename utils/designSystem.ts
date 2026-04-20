import { Platform } from 'react-native';

// Design System Constants
export const DesignSystem = {
  // Color Palette
  colors: {
    // Primary Colors
    primary: {
      50: '#EFF6FF',
      100: '#DBEAFE',
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#3B82F6',
      600: '#2563EB',
      700: '#1D4ED8',
      800: '#1E40AF',
      900: '#1E3A8A',
    },
    
    // Secondary Colors
    secondary: {
      50: '#F0FDF4',
      100: '#DCFCE7',
      200: '#BBF7D0',
      300: '#86EFAC',
      400: '#4ADE80',
      500: '#22C55E',
      600: '#16A34A',
      700: '#15803D',
      800: '#166534',
      900: '#14532D',
    },
    
    // Accent Colors
    accent: {
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      info: '#3B82F6',
    },
    
    // Neutral Colors
    neutral: {
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
    
    // Dark Mode Colors
    dark: {
      background: '#0B0C10',
      surface: '#1F2937',
      surfaceVariant: '#374151',
      onSurface: '#F9FAFB',
      onSurfaceVariant: '#D1D5DB',
      outline: '#4B5563',
      outlineVariant: '#6B7280',
    },
    
    // Light Mode Colors
    light: {
      background: '#FFFFFF',
      surface: '#F9FAFB',
      surfaceVariant: '#F3F4F6',
      onSurface: '#111827',
      onSurfaceVariant: '#374151',
      outline: '#D1D5DB',
      outlineVariant: '#E5E7EB',
    },
  },

  // Typography
  typography: {
    fontFamily: {
      regular: Platform.OS === 'ios' ? 'System' : 'Roboto',
      medium: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
      bold: Platform.OS === 'ios' ? 'System' : 'Roboto-Bold',
    },
    
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
      '5xl': 48,
    },
    
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
    
    fontWeight: {
      normal: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
  },

  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
  },

  // Border Radius
  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 24,
    full: 9999,
  },

  // Shadows
  shadows: {
    sm: {
      boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 3,
    },
    lg: {
      boxShadow: '0px 8px 12px rgba(0, 0, 0, 0.15)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
    xl: {
      boxShadow: '0px 16px 24px rgba(0, 0, 0, 0.2)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
      elevation: 12,
    },
  },

  // Animation Durations
  animation: {
    fast: 150,
    normal: 300,
    slow: 500,
    slower: 750,
  },

  // Easing Functions
  easing: {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },

  // Breakpoints
  breakpoints: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
  },
};

// Theme-aware color getter
export const getThemeColor = (color: string, isDark: boolean = false) => {
  const theme = isDark ? DesignSystem.colors.dark : DesignSystem.colors.light;
  return theme[color as keyof typeof theme] || color;
};

// Responsive design utilities
export const getResponsiveValue = <T>(
  values: { sm?: T; md?: T; lg?: T; xl?: T },
  screenWidth: number
): T => {
  if (screenWidth >= DesignSystem.breakpoints.xl && values.xl) return values.xl;
  if (screenWidth >= DesignSystem.breakpoints.lg && values.lg) return values.lg;
  if (screenWidth >= DesignSystem.breakpoints.md && values.md) return values.md;
  if (screenWidth >= DesignSystem.breakpoints.sm && values.sm) return values.sm;
  return values.sm || values.md || values.lg || values.xl || ({} as T);
};

// Gradient presets
export const gradients = {
  primary: ['#3B82F6', '#1D4ED8'],
  secondary: ['#10B981', '#059669'],
  accent: ['#F59E0B', '#D97706'],
  error: ['#EF4444', '#DC2626'],
  success: ['#10B981', '#059669'],
  warning: ['#F59E0B', '#D97706'],
  info: ['#3B82F6', '#1D4ED8'],
  neutral: ['#6B7280', '#4B5563'],
  dark: ['#1F2937', '#111827'],
  light: ['#F9FAFB', '#E5E7EB'],
};

// Component-specific styles
export const componentStyles = {
  button: {
    primary: {
      backgroundColor: DesignSystem.colors.primary[500],
      borderRadius: DesignSystem.borderRadius.md,
      paddingVertical: DesignSystem.spacing.sm,
      paddingHorizontal: DesignSystem.spacing.md,
      ...DesignSystem.shadows.sm,
    },
    secondary: {
      backgroundColor: DesignSystem.colors.neutral[100],
      borderRadius: DesignSystem.borderRadius.md,
      paddingVertical: DesignSystem.spacing.sm,
      paddingHorizontal: DesignSystem.spacing.md,
      ...DesignSystem.shadows.sm,
    },
  },
  
  card: {
    default: {
      backgroundColor: DesignSystem.colors.neutral[50],
      borderRadius: DesignSystem.borderRadius.lg,
      padding: DesignSystem.spacing.md,
      ...DesignSystem.shadows.md,
    },
    elevated: {
      backgroundColor: DesignSystem.colors.neutral[50],
      borderRadius: DesignSystem.borderRadius.lg,
      padding: DesignSystem.spacing.md,
      ...DesignSystem.shadows.lg,
    },
  },
  
  input: {
    default: {
      borderWidth: 1,
      borderColor: DesignSystem.colors.neutral[300],
      borderRadius: DesignSystem.borderRadius.md,
      paddingVertical: DesignSystem.spacing.sm,
      paddingHorizontal: DesignSystem.spacing.md,
      fontSize: DesignSystem.typography.fontSize.base,
    },
    focused: {
      borderColor: DesignSystem.colors.primary[500],
      ...DesignSystem.shadows.sm,
    },
  },
};

// Animation presets
export const animationPresets = {
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
    duration: DesignSystem.animation.normal,
  },
  
  slideUp: {
    from: { opacity: 0, translateY: 20 },
    to: { opacity: 1, translateY: 0 },
    duration: DesignSystem.animation.normal,
  },
  
  slideDown: {
    from: { opacity: 0, translateY: -20 },
    to: { opacity: 1, translateY: 0 },
    duration: DesignSystem.animation.normal,
  },
  
  scaleIn: {
    from: { opacity: 0, scale: 0.9 },
    to: { opacity: 1, scale: 1 },
    duration: DesignSystem.animation.normal,
  },
  
  bounce: {
    from: { scale: 0.8 },
    to: { scale: 1 },
    duration: DesignSystem.animation.slow,
    easing: DesignSystem.easing.easeOut,
  },
};

// Status colors
export const statusColors = {
  success: DesignSystem.colors.accent.success,
  warning: DesignSystem.colors.accent.warning,
  error: DesignSystem.colors.accent.error,
  info: DesignSystem.colors.accent.info,
};

// Utility functions
export const createShadow = (color: string, opacity: number, radius: number, offset: { width: number; height: number }) => {
  // Convert color to rgba format for boxShadow
  const rgbaColor = color === '#000' 
    ? `rgba(0, 0, 0, ${opacity})`
    : color.startsWith('#')
    ? (() => {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      })()
    : color;
  
  return {
    boxShadow: `${offset.width}px ${offset.height}px ${radius}px ${rgbaColor}`,
    shadowColor: color,
    shadowOffset: offset,
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation: radius / 2,
  };
};

export const createGradient = (colors: string[], start: { x: number; y: number }, end: { x: number; y: number }) => ({
  colors,
  start,
  end,
});

export default DesignSystem;
