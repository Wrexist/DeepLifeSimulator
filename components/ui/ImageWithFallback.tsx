/**
 * ImageWithFallback — drop-in replacement for `<Image source={{ uri }} />`
 * that gracefully degrades to a placeholder when the URI fails to load.
 *
 * R4-B: round 2's UI audit flagged that every `<Image source={{ uri }}>` in
 * Pulse/Spark/Tinder profile photos had no `onError`, no `defaultSource`, no
 * fallback. A 404 or network failure showed up as a transparent gap with
 * console spam — rendering a feed of broken posts.
 *
 * Usage:
 *   <ImageWithFallback
 *     uri={author.photo}
 *     fallback={author.handle}   // first letter is used as a text fallback
 *     style={styles.avatar}
 *   />
 */
import React, { useState, useEffect, useRef } from 'react';
import { Image, View, Text, StyleSheet, ImageStyle, StyleProp } from 'react-native';

interface ImageWithFallbackProps {
  /** Source URI. If undefined/null/empty, the fallback renders directly. */
  uri?: string | null;
  /** Text to show in the placeholder (typically a name or handle — first
   * letter is uppercased and rendered). */
  fallback?: string;
  /** Style applied to both the <Image> and the placeholder <View>. */
  style?: StyleProp<ImageStyle>;
  /** Optional: override the placeholder background color. */
  placeholderColor?: string;
  /** Optional: override the placeholder text color. */
  placeholderTextColor?: string;
}

export default function ImageWithFallback({
  uri,
  fallback,
  style,
  placeholderColor = '#E5E7EB',
  placeholderTextColor = '#6B7280',
}: ImageWithFallbackProps) {
  const [errored, setErrored] = useState(false);
  // Reset error state when the uri changes — previously a failed-load left
  // the placeholder stuck even when a new valid uri came in.
  const lastUriRef = useRef(uri);
  useEffect(() => {
    if (lastUriRef.current !== uri) {
      lastUriRef.current = uri;
      setErrored(false);
    }
  }, [uri]);

  const shouldShowFallback = !uri || errored;

  if (shouldShowFallback) {
    const initial = (fallback && fallback.length > 0 ? fallback.charAt(0) : '?').toUpperCase();
    return (
      <View style={[styles.placeholder, style as StyleProp<ImageStyle>, { backgroundColor: placeholderColor }]}>
        <Text style={[styles.placeholderText, { color: placeholderTextColor }]}>{initial}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: uri ?? undefined }}
      style={style}
      onError={() => setErrored(true)}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
