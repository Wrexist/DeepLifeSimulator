import React, { useState, useCallback } from 'react';
import { Image, View, StyleSheet, ImageStyle, ImageSourcePropType, ActivityIndicator } from 'react-native';

interface OptimizedImageProps {
  source: ImageSourcePropType;
  style?: ImageStyle;
  fallbackSource?: ImageSourcePropType;
  showLoadingIndicator?: boolean;
  loadingIndicatorColor?: string;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
}

export default function OptimizedImage({
  source,
  style,
  fallbackSource,
  showLoadingIndicator = true,
  loadingIndicatorColor = '#3B82F6',
  resizeMode = 'cover',
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
  }, []);

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const currentSource = hasError && fallbackSource ? fallbackSource : source;

  return (
    <View style={[styles.container, style]}>
      <Image
        source={currentSource}
        style={[styles.image, style]}
        resizeMode={resizeMode}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        fadeDuration={200}
      />
      {isLoading && showLoadingIndicator && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator 
            size="small" 
            color={loadingIndicatorColor} 
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
});
