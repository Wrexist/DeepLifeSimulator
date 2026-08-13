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
 *
 * For a PERSON, pass `face` as well. Without it the fallback is a grey disc
 * with a letter in it — which is what the whole social feed looked like, since
 * hardly any character has an uploaded photo. With it, the same character's
 * generated face appears here as it does everywhere else in the game.
 *
 * Do NOT pass `face` for content images (a post's photo, a profile cover). A
 * face is the wrong fallback for a missing photograph of a beach.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Image, View, Text, StyleSheet, ImageStyle, StyleProp } from 'react-native';
import CharacterAvatar from '@/components/avatar/CharacterAvatar';

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
  /**
   * Identity for a generated face, used instead of the letter placeholder.
   * `size` is explicit because the face is an SVG and cannot inherit a
   * percentage height from `style` the way an <Image> does.
   */
  face?: { seed: string; sex?: string | null; age?: number; size: number };
}

export default function ImageWithFallback({
  uri,
  fallback,
  style,
  placeholderColor = '#E5E7EB',
  placeholderTextColor = '#6B7280',
  face,
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

  if (shouldShowFallback && face?.seed) {
    return (
      <View style={[styles.placeholder, style as StyleProp<ImageStyle>]}>
        <CharacterAvatar seed={face.seed} sex={face.sex} age={face.age ?? 25} size={face.size} />
      </View>
    );
  }

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
