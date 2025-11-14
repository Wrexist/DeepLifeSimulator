import { Dimensions, PixelRatio, Platform } from 'react-native';

// --- DEV viewport override (web) ---
let __DEV_VIEWPORT__: { width?: number; height?: number } | null = null;

/** Sätt/ta bort override. Används av /preview. */
export function setViewportOverride(width?: number, height?: number) {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined') return;
  if (width) {
    try {
      localStorage.setItem('dl_viewport_w', String(width));
      if (height) localStorage.setItem('dl_viewport_h', String(height));
    } catch {}
    __DEV_VIEWPORT__ = { width, height };
  } else {
    try {
      localStorage.removeItem('dl_viewport_w');
      localStorage.removeItem('dl_viewport_h');
    } catch {}
    __DEV_VIEWPORT__ = null;
  }
}

function readViewportOverride() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const w = params.get('w') || (typeof localStorage !== 'undefined' ? localStorage.getItem('dl_viewport_w') : null);
  const h = params.get('h') || (typeof localStorage !== 'undefined' ? localStorage.getItem('dl_viewport_h') : null);
  const width = w ? parseInt(w, 10) : undefined;
  const height = h ? parseInt(h, 10) : undefined;
  return width ? { width, height } : null;
}

function getWindowSize() {
  if (Platform.OS === 'web') {
    const ov = __DEV_VIEWPORT__ || readViewportOverride();
    if (ov?.width) {
      // Tryck in måtten i RN Dimensions (best effort).
      try {
        const scale = (window as any).devicePixelRatio || 1;
        // @ts-ignore
        Dimensions.set?.({
          window: { width: ov.width, height: ov.height ?? window.innerHeight, scale, fontScale: 1 },
          screen: { width: ov.width, height: ov.height ?? window.innerHeight, scale, fontScale: 1 },
        });
      } catch {}
      return { width: ov.width, height: ov.height ?? window.innerHeight };
    }
  }
  return Dimensions.get('window');
}

// Get screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions for scaling calculations
const baseWidth = 375; // iPhone standard width
const baseHeight = 812; // iPhone standard height

// Simple device type detection
export const getDeviceType = (): 'small' | 'medium' | 'large' | 'xlarge' => {
  if (SCREEN_WIDTH <= 375) return 'small';
  if (SCREEN_WIDTH <= 414) return 'medium';
  if (SCREEN_WIDTH <= 428) return 'large';
    return 'xlarge';
};

// Simple device checks
export const isSmallDevice = () => getDeviceType() === 'small';
export const isMediumDevice = () => getDeviceType() === 'medium';
export const isLargeDevice = () => getDeviceType() === 'large';
export const isExtraLargeDevice = () => getDeviceType() === 'xlarge';

// Platform checks
export const isIOS = () => Platform.OS === 'ios';
export const isAndroid = () => Platform.OS === 'android';
export const isIPhone = () => Platform.OS === 'ios' && SCREEN_HEIGHT <= 926;
export const isIPad = () => Platform.OS === 'ios' && SCREEN_HEIGHT > 926;
export const isLatestIPhone = () => Platform.OS === 'ios' && SCREEN_HEIGHT > 800;

// Android-specific checks
export const isAndroidSmall = () => Platform.OS === 'android' && SCREEN_WIDTH <= 360;
export const isAndroidMedium = () => Platform.OS === 'android' && SCREEN_WIDTH > 360 && SCREEN_WIDTH <= 480;
export const isAndroidLarge = () => Platform.OS === 'android' && SCREEN_WIDTH > 480 && SCREEN_WIDTH <= 600;
export const isAndroidXLarge = () => Platform.OS === 'android' && SCREEN_WIDTH > 600;
export const isAndroidTablet = () => Platform.OS === 'android' && SCREEN_WIDTH >= 600;
export const isAndroidFoldable = () => Platform.OS === 'android' && SCREEN_WIDTH >= 600;

// Web tablet heuristic (treat iPad-like viewports as tablet)
export const isWebTablet = () => Platform.OS === 'web' && Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) >= 768;

// Unified tablet check across platforms (iPad, Android tablet, or web tablet)
export const isTablet = () => isIPad() || isAndroidTablet() || isWebTablet();

// Core scaling functions with tablet-aware limits
export const scale = (size: number): number => {
  const maxClamp = isTablet() ? 1.8 : 1.3;
  const scaleFactor = Math.min(Math.max(SCREEN_WIDTH / baseWidth, 0.7), maxClamp);
  const newSize = size * scaleFactor;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

export const verticalScale = (size: number): number => {
  const maxClamp = isTablet() ? 1.8 : 1.3;
  const scaleFactor = Math.min(Math.max(SCREEN_HEIGHT / baseHeight, 0.7), maxClamp);
  const newSize = size * scaleFactor;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

export const fontScale = (size: number): number => {
  const maxClamp = isTablet() ? 1.6 : 1.25;
  const minClamp = 0.75;
  const base = SCREEN_WIDTH / baseWidth;
  const scaleFactor = Math.min(Math.max(base, minClamp), maxClamp);
  const newSize = size * scaleFactor;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Responsive spacing with safe fallbacks
export const responsiveSpacing = {
  xs: scale(4),
  sm: scale(8),
  md: scale(16),
  lg: scale(24),
  xl: scale(32),
  '2xl': scale(40),
  '3xl': scale(48),
  '4xl': scale(56),
  '5xl': scale(64),
};

// Responsive font sizes with safe fallbacks
export const responsiveFontSize = {
  xs: fontScale(10),
  sm: fontScale(12),
  base: fontScale(14),
  lg: fontScale(16),
  xl: fontScale(18),
  '2xl': fontScale(20),
  '3xl': fontScale(24),
  '4xl': fontScale(28),
  '5xl': fontScale(32),
};

// Responsive border radius with safe fallbacks
export const responsiveBorderRadius = {
  xs: scale(2),
  sm: scale(4),
  md: scale(8),
  lg: scale(12),
  xl: scale(16),
  '2xl': scale(20),
  full: scale(9999),
};

// Responsive icon sizes with safe fallbacks
export const responsiveIconSize = {
  xs: scale(12),
  sm: scale(16),
  md: scale(20),
  lg: scale(24),
  xl: scale(28),
  '2xl': scale(32),
  '3xl': scale(40),
  '4xl': scale(48),
  '5xl': scale(56),
};

// Touch target sizes for accessibility
export const touchTargets = {
  minimum: scale(44), // iOS minimum touch target
  minimumAndroid: scale(48), // Android minimum touch target
  small: scale(32),
  medium: scale(44),
  large: scale(56),
  xlarge: scale(64),
};

// Responsive padding with safe fallbacks
export const responsivePadding = {
  horizontal: scale(16),
  vertical: verticalScale(12),
  small: scale(8),
  medium: scale(16),
  large: scale(24),
  xlarge: scale(32),
  // Platform-specific padding
  horizontalSmall: isSmallDevice() ? scale(12) : scale(16),
  horizontalLarge: isLargeDevice() ? scale(20) : scale(16),
  // Android-specific adjustments
  horizontalAndroid: Platform.OS === 'android' ? scale(14) : scale(16),
  verticalAndroid: Platform.OS === 'android' ? verticalScale(10) : verticalScale(12),
};

// Screen dimensions with comprehensive device detection
export const screenDimensions = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isSmallDevice: isSmallDevice(),
  isMediumDevice: isMediumDevice(),
  isLargeDevice: isLargeDevice(),
  isExtraLargeDevice: isExtraLargeDevice(),
  isIPhone: isIPhone(),
  isLatestIPhone: isLatestIPhone(),
  isIPad: isIPad(),
  isAndroid: isAndroid(),
  isAndroidSmall: isAndroidSmall(),
  isAndroidMedium: isAndroidMedium(),
  isAndroidLarge: isAndroidLarge(),
  isAndroidXLarge: isAndroidXLarge(),
  isAndroidTablet: isAndroidTablet(),
  isAndroidFoldable: isAndroidFoldable(),
  isTablet: isTablet(),
  deviceType: getDeviceType(),
  pixelDensity: PixelRatio.get(),
  baseWidth,
  baseHeight,
  scaleFactor: SCREEN_WIDTH / baseWidth,
  verticalScaleFactor: SCREEN_HEIGHT / baseHeight,
};

// Enhanced responsive design utilities
export const responsiveDesign = {
  // Dynamic padding based on screen size
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
    xs: fontScale(10),
    sm: fontScale(12),
    md: fontScale(14),
    lg: fontScale(16),
    xl: fontScale(18),
    xxl: fontScale(20),
    xxxl: fontScale(24),
    title: fontScale(28),
    largeTitle: fontScale(32),
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
      fontSize: fontScale(14),
    },
    android: {
      buttonHeight: verticalScale(48),
      iconSize: scale(22),
      fontSize: fontScale(13),
    },
  },
  
  // Device-specific adjustments
  device: {
    small: {
      buttonHeight: verticalScale(40),
      iconSize: scale(20),
      fontSize: fontScale(13),
      padding: scale(12),
    },
    medium: {
      buttonHeight: verticalScale(44),
      iconSize: scale(24),
      fontSize: fontScale(14),
      padding: scale(16),
    },
    large: {
      buttonHeight: verticalScale(48),
      iconSize: scale(26),
      fontSize: fontScale(15),
      padding: scale(18),
    },
    xlarge: {
      buttonHeight: verticalScale(52),
      iconSize: scale(28),
      fontSize: fontScale(16),
      padding: scale(20),
    },
  },
};

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
  return responsiveSpacing[size] || responsiveSpacing.md; // Safe fallback
};

export const getResponsiveFontSize = (size: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl') => {
  return responsiveFontSize[size] || responsiveFontSize.base; // Safe fallback
};

// Enhanced responsive scale function with better control
export const responsiveScale = (size: number, options: {
  minScale?: number;
  maxScale?: number;
  deviceType?: 'small' | 'medium' | 'large' | 'xlarge';
  platform?: 'ios' | 'android';
} = {}) => {
  const {
    minScale = 0.7,
    maxScale = 1.3,
    deviceType = getDeviceType(),
    platform = Platform.OS
  } = options;
  
  let scaleFactor = SCREEN_WIDTH / baseWidth;
  
  // Apply limits
  scaleFactor = Math.min(Math.max(scaleFactor, minScale), maxScale);
  
  // Device-specific adjustments
  switch (deviceType) {
    case 'small':
      scaleFactor *= 0.9;
      break;
    case 'medium':
      scaleFactor *= 1.0;
      break;
    case 'large':
      scaleFactor *= 1.1;
      break;
    case 'xlarge':
      scaleFactor *= 1.2;
      break;
  }
  
  // Platform-specific adjustments
  if (platform === 'android') {
    scaleFactor *= 0.95; // Slightly smaller on Android
  }
  
  const newSize = size * scaleFactor;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Responsive width percentage
export const responsiveWidth = (percentage: number): number => {
  return (SCREEN_WIDTH * percentage) / 100;
};

// Responsive height percentage
export const responsiveHeight = (percentage: number): number => {
  return (SCREEN_HEIGHT * percentage) / 100;
};

// Grid system for responsive layouts
export const responsiveGrid = {
  columns: isTablet() ? 4 : 3, // More columns on tablets
  gap: scale(12),
  gapSmall: isSmallDevice() ? scale(8) : scale(12),
  gapLarge: isLargeDevice() ? scale(16) : scale(12),
  // Android-specific grid
  gapAndroid: Platform.OS === 'android' ? scale(10) : scale(12),
};

// Responsive card sizes
export const responsiveCard = {
  width: isTablet() ? responsiveWidth(22) : responsiveWidth(30),
  height: scale(120),
  padding: scale(12),
  paddingSmall: isSmallDevice() ? scale(10) : scale(12),
  paddingLarge: isLargeDevice() ? scale(14) : scale(12),
  // Android-specific card sizes
  paddingAndroid: Platform.OS === 'android' ? scale(10) : scale(12),
  heightAndroid: Platform.OS === 'android' ? scale(110) : scale(120),
};

// Responsive button sizes
export const responsiveButton = {
  height: Platform.OS === 'android' ? scale(48) : scale(44), // Android Material Design vs iOS HIG
  heightSmall: isSmallDevice() ? scale(40) : scale(44),
  heightLarge: isLargeDevice() ? scale(48) : scale(44),
  paddingHorizontal: scale(16),
  paddingHorizontalSmall: isSmallDevice() ? scale(12) : scale(16),
  paddingHorizontalLarge: isLargeDevice() ? scale(20) : scale(16),
  // Android-specific button sizes
  heightAndroid: Platform.OS === 'android' ? scale(48) : scale(44),
  paddingHorizontalAndroid: Platform.OS === 'android' ? scale(14) : scale(16),
};

// Comprehensive device information for both platforms
export const getDeviceInfo = () => {
  const deviceInfo = {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    deviceType: getDeviceType(),
    platform: Platform.OS,
    isIPad: isIPad(),
    isIPhone: isIPhone(),
    isLatestIPhone: isLatestIPhone(),
    isAndroid: isAndroid(),
    isAndroidTablet: isAndroidTablet(),
    isAndroidFoldable: isAndroidFoldable(),
    
    // Specific iPhone model detection
    iPhoneModel: (() => {
      if (Platform.OS !== 'ios') return null;
      if (SCREEN_WIDTH === 375 && SCREEN_HEIGHT === 667) return 'iPhone SE (2nd/3rd gen)';
      if (SCREEN_WIDTH === 375 && SCREEN_HEIGHT === 812) return 'iPhone X/XS';
      if (SCREEN_WIDTH === 414 && SCREEN_HEIGHT === 736) return 'iPhone 6/7/8 Plus';
      if (SCREEN_WIDTH === 414 && SCREEN_HEIGHT === 896) return 'iPhone XR/XS Max';
      if (SCREEN_WIDTH === 390 && SCREEN_HEIGHT === 844) return 'iPhone 11/12/13';
      if (SCREEN_WIDTH === 428 && SCREEN_HEIGHT === 926) return 'iPhone 11/12/13 Pro Max';
      if (SCREEN_WIDTH === 393 && SCREEN_HEIGHT === 852) return 'iPhone 14/15/16/17';
      if (SCREEN_WIDTH === 430 && SCREEN_HEIGHT === 932) return 'iPhone 14/15/16/17 Plus';
      if (SCREEN_WIDTH === 393 && SCREEN_HEIGHT === 852) return 'iPhone 14/15/16/17 Pro';
      if (SCREEN_WIDTH === 430 && SCREEN_HEIGHT === 932) return 'iPhone 14/15/16/17 Pro Max';
      return 'Unknown iPhone';
    })(),
    
    // iPad model detection
    iPadModel: (() => {
      if (Platform.OS !== 'ios' || !isIPad()) return null;
      if (SCREEN_WIDTH === 768 && SCREEN_HEIGHT === 1024) return 'iPad';
      if (SCREEN_WIDTH === 834 && SCREEN_HEIGHT === 1194) return 'iPad Pro 11"';
      if (SCREEN_WIDTH === 1024 && SCREEN_HEIGHT === 1366) return 'iPad Pro 12.9"';
      return 'iPad (Unknown Model)';
    })(),
    
    // Android device detection
    androidModel: (() => {
      if (Platform.OS !== 'android') return null;
      
      // Small Android devices
      if (SCREEN_WIDTH <= 360) {
        if (SCREEN_WIDTH === 320) return 'Small Android (320dp)';
        return 'Small Android (360dp)';
      }
      
      // Medium Android devices
      if (SCREEN_WIDTH <= 480) {
        if (SCREEN_WIDTH === 360) return 'Medium Android (360dp)';
        if (SCREEN_WIDTH === 375) return 'Medium Android (375dp)';
        return 'Medium Android (384dp)';
      }
      
      // Large Android devices
      if (SCREEN_WIDTH <= 600) {
        if (SCREEN_WIDTH === 400) return 'Large Android (400dp)';
        if (SCREEN_WIDTH === 412) return 'Large Android (412dp)';
        return 'Large Android (430dp)';
      }
      
      // Extra large Android devices
      if (SCREEN_WIDTH <= 600) { // Assuming 600 is the threshold for xlarge
        if (SCREEN_WIDTH === 450) return 'Extra Large Android (450dp)';
        return 'Extra Large Android (480dp)';
      }
      
      // Android tablets
      if (SCREEN_WIDTH >= 600) {
        if (SCREEN_WIDTH === 600) return 'Android Tablet 7"';
        if (SCREEN_WIDTH === 768) return 'Android Tablet 8"';
        if (SCREEN_WIDTH === 800) return 'Android Tablet 10"';
        if (SCREEN_WIDTH === 1024) return 'Android Tablet 12"';
        return 'Android Tablet (Unknown Size)';
      }
      
      // Foldable devices
      if (SCREEN_WIDTH === 280) return 'Android Fold (Closed)';
      if (SCREEN_WIDTH === 717) return 'Android Fold (Open)';
      if (SCREEN_WIDTH === 84) return 'Android Flip (Closed)';
      if (SCREEN_WIDTH === 360) return 'Android Flip (Open)';
      
      return 'Unknown Android Device';
    })(),
  };
  
  return deviceInfo;
};

// Device-specific scaling recommendations for both platforms
export const getDeviceScalingRecommendations = () => {
  const deviceType = getDeviceType();
  const isAndroidDevice = Platform.OS === 'android';
  
  return {
    // Font size recommendations
    fontSizes: {
      small: deviceType === 'small' ? { min: isAndroidDevice ? 12 : 12, max: isAndroidDevice ? 16 : 16 } : 
             deviceType === 'medium' ? { min: isAndroidDevice ? 13 : 14, max: isAndroidDevice ? 17 : 18 } :
             deviceType === 'large' ? { min: isAndroidDevice ? 14 : 16, max: isAndroidDevice ? 18 : 20 } :
             { min: isAndroidDevice ? 16 : 18, max: isAndroidDevice ? 22 : 24 }, // xlarge
    },
    
    // Touch target recommendations
    touchTargets: {
      minimum: deviceType === 'small' ? (isAndroidDevice ? 48 : 40) : 
               deviceType === 'medium' ? (isAndroidDevice ? 48 : 44) :
               deviceType === 'large' ? (isAndroidDevice ? 56 : 48) :
               (isAndroidDevice ? 64 : 52), // xlarge
    },
    
    // Spacing recommendations
    spacing: {
      compact: deviceType === 'small' ? (isAndroidDevice ? 8 : 8) : 
               deviceType === 'medium' ? (isAndroidDevice ? 10 : 12) :
               deviceType === 'large' ? (isAndroidDevice ? 12 : 16) :
               (isAndroidDevice ? 16 : 20), // xlarge
      comfortable: deviceType === 'small' ? (isAndroidDevice ? 12 : 12) : 
                   deviceType === 'medium' ? (isAndroidDevice ? 14 : 16) :
                   deviceType === 'large' ? (isAndroidDevice ? 16 : 20) :
                   (isAndroidDevice ? 20 : 24), // xlarge
    },
    
    // Platform-specific recommendations
    platform: {
      android: {
        useMaterialDesign: true,
        touchTargetMin: 48,
        fontScaleFactor: 1.0,
        spacingMultiplier: 1.0,
      },
      ios: {
        useHumanInterfaceGuidelines: true,
        touchTargetMin: 44,
        fontScaleFactor: 1.05,
        spacingMultiplier: 1.1,
      },
    },
  };
};

// Android-specific scaling utilities
export const androidScale = {
  // Material Design touch targets
  touchTarget: {
    minimum: 48,
    comfortable: 56,
    large: 64,
  },
  
  // Material Design spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  
  // Material Design typography
  typography: {
    caption: fontScale(12),
    body2: fontScale(14),
    body1: fontScale(16),
    h6: fontScale(20),
    h5: fontScale(24),
    h4: fontScale(34),
    h3: fontScale(48),
    h2: fontScale(60),
    h1: fontScale(96),
  },
  
  // Material Design elevation
  elevation: {
    none: 0,
    low: 2,
    medium: 4,
    high: 8,
    veryHigh: 16,
  },
};

// iOS-specific scaling utilities
export const iosScale = {
  // Human Interface Guidelines touch targets
  touchTarget: {
    minimum: 44,
    comfortable: 48,
    large: 56,
  },
  
  // iOS spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  
  // iOS typography
  typography: {
    footnote: fontScale(13),
    caption1: fontScale(12),
    caption2: fontScale(11),
    body: fontScale(17),
    callout: fontScale(16),
    subheadline: fontScale(15),
    headline: fontScale(17),
    title3: fontScale(20),
    title2: fontScale(22),
    title1: fontScale(28),
    largeTitle: fontScale(34),
  },
};




