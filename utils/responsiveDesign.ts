import { 
  responsiveSpacing, 
  responsiveFontSize, 
  responsiveBorderRadius,
  responsiveIconSize,
  scale,
  verticalScale,
  getDeviceType,
  isSmallDevice,
  isMediumDevice,
  isLargeDevice,
  isExtraLargeDevice
} from './scaling';

// Helper functions for responsive design
export const getResponsiveValue = (small: number, medium: number, large: number, xlarge: number) => {
  const deviceType = getDeviceType();
  switch (deviceType) {
    case 'small': return small;
    case 'medium': return medium;
    case 'large': return large;
    case 'xlarge': return xlarge;
    default: return medium;
  }
};

export const getResponsiveSpacing = (size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl') => {
  return responsiveSpacing[size];
};

export const getResponsiveFontSize = (size: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl') => {
  return responsiveFontSize[size];
};

// Responsive design utilities
export const responsiveDesign = {
  // Dynamic padding based on screen size and orientation
  padding: {
    xs: scale(4),
    sm: scale(8),
    md: scale(16),
    lg: scale(24),
    xl: scale(32),
    xxl: scale(48),
  },
  
  // Dynamic margins based on screen size
  margin: {
    xs: scale(4),
    sm: scale(8),
    md: scale(16),
    lg: scale(24),
    xl: scale(32),
    xxl: scale(48),
  },
  
  // Dynamic border radius based on screen size
  borderRadius: {
    xs: scale(4),
    sm: scale(8),
    md: scale(12),
    lg: scale(16),
    xl: scale(24),
    xxl: scale(32),
  },
  
  // Dynamic icon sizes based on screen size
  icon: {
    xs: scale(12),
    sm: scale(16),
    md: scale(20),
    lg: scale(24),
    xl: scale(32),
    xxl: scale(48),
  },
  
  // Dynamic button sizes based on screen size
  button: {
    height: {
      small: verticalScale(36),
      medium: verticalScale(44),
      large: verticalScale(52),
    },
    padding: {
      horizontal: scale(16),
      vertical: verticalScale(8),
    },
  },
  
  // Dynamic card sizes based on screen size
  card: {
    padding: scale(16),
    margin: scale(8),
    borderRadius: scale(12),
  },
  
  // Dynamic font sizes with better scaling
  fontSize: {
    xs: responsiveFontSize.xs,
    sm: responsiveFontSize.sm,
    md: responsiveFontSize.base,
    lg: responsiveFontSize.lg,
    xl: responsiveFontSize.xl,
    xxl: responsiveFontSize['2xl'],
    xxxl: responsiveFontSize['3xl'],
    title: responsiveFontSize['4xl'],
    largeTitle: responsiveFontSize['5xl'],
  },
  
  // Dynamic spacing for different screen densities
  spacing: {
    compact: scale(4),
    tight: scale(8),
    normal: scale(16),
    loose: scale(24),
    extraLoose: scale(32),
  },
  
  // Screen-specific adjustments
  screen: {
    // Adjustments for different screen sizes
    small: {
      paddingMultiplier: 0.8,
      fontSizeMultiplier: 0.9,
      iconSizeMultiplier: 0.85,
    },
    medium: {
      paddingMultiplier: 1.0,
      fontSizeMultiplier: 1.0,
      iconSizeMultiplier: 1.0,
    },
    large: {
      paddingMultiplier: 1.1,
      fontSizeMultiplier: 1.05,
      iconSizeMultiplier: 1.1,
    },
    xlarge: {
      paddingMultiplier: 1.2,
      fontSizeMultiplier: 1.1,
      iconSizeMultiplier: 1.15,
    },
  },
  
  // Platform-specific adjustments
  platform: {
    ios: {
      buttonHeight: verticalScale(44),
      iconSize: scale(24),
      fontSize: responsiveFontSize.base,
    },
    android: {
      buttonHeight: verticalScale(48),
      iconSize: scale(22),
      fontSize: responsiveFontSize.sm,
    },
  },
  
  // Device-specific adjustments
  device: {
    small: {
      buttonHeight: verticalScale(40),
      iconSize: scale(20),
      fontSize: responsiveFontSize.sm,
      padding: scale(12),
    },
    medium: {
      buttonHeight: verticalScale(44),
      iconSize: scale(24),
      fontSize: responsiveFontSize.base,
      padding: scale(16),
    },
    large: {
      buttonHeight: verticalScale(48),
      iconSize: scale(26),
      fontSize: responsiveFontSize.lg,
      padding: scale(18),
    },
    xlarge: {
      buttonHeight: verticalScale(52),
      iconSize: scale(28),
      fontSize: responsiveFontSize.xl,
      padding: scale(20),
    },
  },
};

// Export all utilities
export {
  responsiveSpacing,
  responsiveFontSize,
  responsiveBorderRadius,
  responsiveIconSize,
  scale,
  verticalScale,
  getDeviceType,
  isSmallDevice,
  isMediumDevice,
  isLargeDevice,
  isExtraLargeDevice,
};
