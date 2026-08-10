import { Dimensions, PixelRatio, Platform } from 'react-native';

// --- DEV viewport override (web) ---

/** Set/remove viewport override. Used by /preview. */
export function setViewportOverride(width?: number, height?: number) {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined') return;
  if (width) {
    try {
      localStorage.setItem('dl_viewport_w', String(width));
      if (height) localStorage.setItem('dl_viewport_h', String(height));
    } catch {}
  } else {
    try {
      localStorage.removeItem('dl_viewport_w');
      localStorage.removeItem('dl_viewport_h');
    } catch {}
  }
}

// CRITICAL FIX: Defer Dimensions.get('window') until first use to prevent startup crashes
// This runs at module load time, BEFORE React Native is fully initialized
// If Dimensions.get('window') throws or returns undefined, destructuring fails and app crashes
// Solution: Use lazy initialization with defensive fallbacks
let SCREEN_WIDTH: number | null = null;
let SCREEN_HEIGHT: number | null = null;

// Lazy getter for screen dimensions with defensive fallbacks
function getScreenDimensions(): { width: number; height: number } {
  if (SCREEN_WIDTH === null || SCREEN_HEIGHT === null) {
    try {
      const dimensions = Dimensions.get('window');
      // CRITICAL: Use fallbacks if Dimensions.get() fails or returns invalid values
      // This ensures the app can still render even if React Native isn't ready
      SCREEN_WIDTH = dimensions?.width ?? 375; // Fallback to iPhone standard width
      SCREEN_HEIGHT = dimensions?.height ?? 812; // Fallback to iPhone standard height
      
      // Validate dimensions are positive numbers
      if (!Number.isFinite(SCREEN_WIDTH) || SCREEN_WIDTH <= 0) {
        SCREEN_WIDTH = 375;
      }
      if (!Number.isFinite(SCREEN_HEIGHT) || SCREEN_HEIGHT <= 0) {
        SCREEN_HEIGHT = 812;
      }
    } catch (error) {
      // CRITICAL: If Dimensions.get() throws, use safe fallbacks
      // This ensures the app can still render even if React Native isn't ready
      SCREEN_WIDTH = 375;
      SCREEN_HEIGHT = 812;
    }
  }
  return { width: SCREEN_WIDTH, height: SCREEN_HEIGHT };
}

// Base dimensions for scaling calculations
const baseWidth = 375; // iPhone standard width
const baseHeight = 812; // iPhone standard height

// Simple device type detection
export const getDeviceType = (): 'small' | 'medium' | 'large' | 'xlarge' => {
  const { width } = getScreenDimensions();
  if (width <= 375) return 'small';
  if (width <= 414) return 'medium';
  if (width <= 428) return 'large';
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
// Treat iPad as a tablet form factor by shortest side, not height.
// Height-based checks can misclassify newer Pro Max iPhones as iPads.
export const isIPad = () => {
  if (Platform.OS !== 'ios') return false;
  const { width, height } = getScreenDimensions();
  return Math.min(width, height) >= 768;
};
export const isIPhone = () => Platform.OS === 'ios' && !isIPad();
export const isLatestIPhone = () => {
  if (!isIPhone()) return false;
  const { width, height } = getScreenDimensions();
  return Math.max(width, height) > 800;
};

// Android-specific checks
export const isAndroidSmall = () => {
  const { width } = getScreenDimensions();
  return Platform.OS === 'android' && width <= 360;
};
export const isAndroidMedium = () => {
  const { width } = getScreenDimensions();
  return Platform.OS === 'android' && width > 360 && width <= 480;
};
export const isAndroidLarge = () => {
  const { width } = getScreenDimensions();
  return Platform.OS === 'android' && width > 480 && width <= 600;
};
export const isAndroidXLarge = () => {
  const { width } = getScreenDimensions();
  return Platform.OS === 'android' && width > 600;
};
export const isAndroidTablet = () => {
  const { width } = getScreenDimensions();
  return Platform.OS === 'android' && width >= 600;
};
export const isAndroidFoldable = () => {
  const { width } = getScreenDimensions();
  return Platform.OS === 'android' && width >= 600;
};

// Web tablet heuristic (treat iPad-like viewports as tablet)
export const isWebTablet = () => {
  const { width, height } = getScreenDimensions();
  return Platform.OS === 'web' && Math.min(width, height) >= 768;
};

// Unified tablet check across platforms (iPad, Android tablet, or web tablet)
export const isTablet = () => isIPad() || isAndroidTablet() || isWebTablet();

// Core scaling functions with tablet-aware limits
export const scale = (size: number): number => {
  const { width } = getScreenDimensions();
  const maxClamp = isTablet() ? 1.8 : 1.3;
  const scaleFactor = Math.min(Math.max(width / baseWidth, 0.7), maxClamp);
  const newSize = size * scaleFactor;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

export const verticalScale = (size: number): number => {
  const { height } = getScreenDimensions();
  const maxClamp = isTablet() ? 1.8 : 1.3;
  const scaleFactor = Math.min(Math.max(height / baseHeight, 0.7), maxClamp);
  const newSize = size * scaleFactor;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

export const fontScale = (size: number): number => {
  const { width } = getScreenDimensions();
  const maxClamp = isTablet() ? 1.6 : 1.25;
  const minClamp = 0.75;
  const base = width / baseWidth;
  const scaleFactor = Math.min(Math.max(base, minClamp), maxClamp);
  const newSize = size * scaleFactor;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// The bottom tab bar floats with `position: absolute` (see app/(tabs)/_layout.tsx),
// so scrollable tab screens must reserve space for it or their last item is hidden
// behind the bar (the long-standing "can't see the Computer price / can't scroll"
// bug). TAB_BAR_HEIGHT mirrors the bar height in the layout; the extra spacing gives
// breathing room above it, and the caller adds the device's bottom safe-area inset.
export const TAB_BAR_HEIGHT = scale(70);
export const getTabBarSafePadding = (bottomInset = 0): number =>
  TAB_BAR_HEIGHT + scale(30) + bottomInset;

// In-phone / in-computer apps run full-screen (see utils/fullscreenAppStore):
// while an app is open the game's floating tab bar is HIDDEN, so those screens
// must NOT reserve TAB_BAR_HEIGHT for a bar that isn't there — doing so leaves
// a ~100pt dead strip at the bottom. This gives just the device's home-indicator
// inset plus a small breathing gap, which also lets sticky composers (chat,
// post detail) sit right above the home indicator instead of floating up.
export const getAppScreenBottomPadding = (bottomInset = 0): number =>
  scale(24) + bottomInset;

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
  /** Between base and lg — used by tab headers and category labels */
  md: fontScale(15),
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
export const screenDimensions = (() => {
  const { width, height } = getScreenDimensions();
  return {
    width,
    height,
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
    scaleFactor: width / baseWidth,
    verticalScaleFactor: height / baseHeight,
  };
})();

/**
 * Pick one of four raw (unscaled) values by device bucket.
 *
 * Note this deliberately does NOT run through `scale()` — the caller supplies a
 * value per bucket instead of one value that gets multiplied. Use `scale()` /
 * `responsiveSpacing` for the normal case; reach for this only when the steps
 * between device sizes aren't proportional.
 */
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

// Helper function for responsive border radius - takes a number and returns scaled value
export const getResponsiveBorderRadius = (value: number) => {
  return scale(value);
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
  
  const { width } = getScreenDimensions();
  let scaleFactor = width / baseWidth;
  
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
  const { width } = getScreenDimensions();
  return (width * percentage) / 100;
};

// Responsive height percentage
export const responsiveHeight = (percentage: number): number => {
  const { height } = getScreenDimensions();
  return (height * percentage) / 100;
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
  const { width, height } = getScreenDimensions();
  const deviceInfo = {
    width,
    height,
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
      if (width === 375 && height === 667) return 'iPhone SE (2nd/3rd gen)';
      if (width === 375 && height === 812) return 'iPhone X/XS';
      if (width === 414 && height === 736) return 'iPhone 6/7/8 Plus';
      if (width === 414 && height === 896) return 'iPhone XR/XS Max';
      if (width === 390 && height === 844) return 'iPhone 11/12/13';
      if (width === 428 && height === 926) return 'iPhone 11/12/13 Pro Max';
      if (width === 393 && height === 852) return 'iPhone 14/15/16/17';
      if (width === 430 && height === 932) return 'iPhone 14/15/16/17 Plus';
      if (width === 393 && height === 852) return 'iPhone 14/15/16/17 Pro';
      if (width === 430 && height === 932) return 'iPhone 14/15/16/17 Pro Max';
      return 'Unknown iPhone';
    })(),
    
    // iPad model detection
    iPadModel: (() => {
      if (Platform.OS !== 'ios' || !isIPad()) return null;
      if (width === 768 && height === 1024) return 'iPad';
      if (width === 834 && height === 1194) return 'iPad Pro 11"';
      if (width === 1024 && height === 1366) return 'iPad Pro 12.9"';
      return 'iPad (Unknown Model)';
    })(),
    
    // Android device detection
    androidModel: (() => {
      if (Platform.OS !== 'android') return null;
      
      // Small Android devices
      if (width <= 360) {
        if (width === 320) return 'Small Android (320dp)';
        return 'Small Android (360dp)';
      }
      
      // Medium Android devices
      if (width <= 480) {
        if (width === 360) return 'Medium Android (360dp)';
        if (width === 375) return 'Medium Android (375dp)';
        return 'Medium Android (384dp)';
      }
      
      // Large Android devices
      if (width <= 600) {
        if (width === 400) return 'Large Android (400dp)';
        if (width === 412) return 'Large Android (412dp)';
        return 'Large Android (430dp)';
      }
      
      // Extra large Android devices
      if (width <= 600) { // Assuming 600 is the threshold for xlarge
        if (width === 450) return 'Extra Large Android (450dp)';
        return 'Extra Large Android (480dp)';
      }
      
      // Android tablets
      if (width >= 600) {
        if (width === 600) return 'Android Tablet 7"';
        if (width === 768) return 'Android Tablet 8"';
        if (width === 800) return 'Android Tablet 10"';
        if (width === 1024) return 'Android Tablet 12"';
        return 'Android Tablet (Unknown Size)';
      }
      
      // Foldable devices
      if (width === 280) return 'Android Fold (Closed)';
      if (width === 717) return 'Android Fold (Open)';
      if (width === 84) return 'Android Flip (Closed)';
      if (width === 360) return 'Android Flip (Open)';
      
      return 'Unknown Android Device';
    })(),
  };
  
  return deviceInfo;
};


