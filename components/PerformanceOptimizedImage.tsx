import React, { useState, useMemo } from 'react';
import { Image, ImageProps, StyleSheet, View, Animated, StyleProp, ImageStyle } from 'react-native';

interface PerformanceOptimizedImageProps extends ImageProps {
  fallbackSource?: ImageProps['source'];
  transitionDuration?: number;
}

/**
 * A performance-optimized Image component.
 * 
 * Features:
 * - React.memo to prevent unnecessary re-renders
 * - Fade-in animation on load
 * - Error handling with fallback source
 * - Memoized source to prevent flicker
 */
const PerformanceOptimizedImageComponent = ({
  source,
  style,
  fallbackSource,
  transitionDuration = 300,
  ...props
}: PerformanceOptimizedImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const opacity = useMemo(() => new Animated.Value(0), []);

  const onLoad = (e: any) => {
    setIsLoaded(true);
    Animated.timing(opacity, {
      toValue: 1,
      duration: transitionDuration,
      useNativeDriver: true,
    }).start();
    props.onLoad && props.onLoad(e);
  };

  const onError = (e: any) => {
    setHasError(true);
    props.onError && props.onError(e);
  };

  const finalSource = useMemo(() => {
    if (hasError && fallbackSource) {
      return fallbackSource;
    }
    return source;
  }, [source, hasError, fallbackSource]);

  // If simple number source (require), it loads instantly, so show immediately
  const isLocalImage = typeof source === 'number';

  return (
    <View style={[styles.container, style]}>
      <Animated.Image
        {...props}
        source={finalSource}
        style={[
          StyleSheet.absoluteFill, 
          style as StyleProp<ImageStyle>,
          { opacity: isLocalImage ? 1 : opacity }
        ]}
        onLoad={onLoad}
        onError={onError}
      />
      {!isLoaded && !isLocalImage && (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  placeholder: {
    backgroundColor: '#E5E7EB', // Light gray placeholder
  },
});

export const PerformanceOptimizedImage = React.memo(PerformanceOptimizedImageComponent);
