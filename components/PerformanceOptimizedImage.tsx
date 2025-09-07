import React, { useState, useCallback } from 'react';
import { Image, ImageStyle, View, ActivityIndicator } from 'react-native';
import { responsiveIconSize } from '@/utils/scaling';

interface PerformanceOptimizedImageProps {
  source: any;
  style?: ImageStyle;
  size?: 'small' | 'medium' | 'large' | 'custom';
  showLoader?: boolean;
  fadeDuration?: number;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  onLoad?: () => void;
  onError?: () => void;
}

const PerformanceOptimizedImage = React.memo<PerformanceOptimizedImageProps>(({
  source,
  style,
  size = 'medium',
  showLoader = false, // Disable loader by default for faster loading
  fadeDuration = 0, // No fade for instant loading
  resizeMode = 'contain',
  onLoad,
  onError,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Start as not loading

  const imageSize = {
    small: { width: responsiveIconSize.sm, height: responsiveIconSize.sm },
    medium: { width: responsiveIconSize.md, height: responsiveIconSize.md },
    large: { width: responsiveIconSize.lg, height: responsiveIconSize.lg },
    custom: {},
  };

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  if (hasError) {
    return (
      <View style={[imageSize[size], style, { backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="small" color="#6B7280" />
      </View>
    );
  }

  return (
    <View style={[imageSize[size], style]}>
      <Image
        source={source}
        style={[
          imageSize[size],
          style,
          { opacity: isLoaded ? 1 : 1 } // Always show image immediately
        ]}
        onLoad={handleLoad}
        onError={handleError}
        fadeDuration={fadeDuration}
        resizeMode={resizeMode}
      />
    </View>
  );
});

export default PerformanceOptimizedImage;
