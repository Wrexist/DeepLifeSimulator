import React, { useState } from 'react';
import { Image, ImageProps, StyleSheet, View, ActivityIndicator } from 'react-native';
// Try to import FastImage, fallback to null if not available
let FastImage: any = null;
try {
  FastImage = require('react-native-fast-image').default;
} catch (e) {
  // FastImage not installed, will use native Image
}

interface OptimizedImageProps extends Omit<ImageProps, 'source'> {
  source: { uri: string } | number;
  useFastImage?: boolean;
  fallbackToNative?: boolean;
  placeholder?: React.ReactNode;
}

/**
 * Optimized Image component that uses react-native-fast-image when available
 * Falls back to native Image component if fast-image is not available
 */
export default function OptimizedImage({
  source,
  useFastImage = true,
  fallbackToNative = true,
  placeholder,
  style,
  ...props
}: OptimizedImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Check if source is a URI (remote image)
  const isRemote = typeof source === 'object' && 'uri' in source;

  // Use FastImage for remote images if available and enabled
  if (useFastImage && isRemote && !error) {
    try {
      return (
        <View style={style}>
          {loading && placeholder && (
            <View style={[StyleSheet.absoluteFill, styles.placeholderContainer]}>
              {placeholder}
            </View>
          )}
          <FastImage
            source={source}
            style={style}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setError(true);
              setLoading(false);
            }}
            resizeMode={FastImage.resizeMode.cover}
            {...props}
          />
        </View>
      );
    } catch (fastImageError) {
      // FastImage not available, fall through to native Image
      if (!fallbackToNative) {
        throw fastImageError;
      }
    }
  }

  // Fallback to native Image component
  return (
    <View style={style}>
      {loading && placeholder && (
        <View style={[StyleSheet.absoluteFill, styles.placeholderContainer]}>
          {placeholder}
        </View>
      )}
      <Image
        source={source}
        style={style}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
});
