import React, { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import LottieView from 'lottie-react-native';

let trigger: ((title: string) => void) | null = null;

export const showAchievementToast = (title: string) => {
  trigger?.(title);
};

export default function AchievementToast() {
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    trigger = (t: string) => setTitle(t);
  }, []);

  useEffect(() => {
    if (title) {
      const t = setTimeout(() => setTitle(null), 2500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [title]);

  if (!title) return null;

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 220 }}
      style={styles.container}
    >
      <LottieView
        source={require('@/assets/lottie/confetti.json')}
        autoPlay
        loop={false}
        style={styles.lottie}
      />
      <Text style={styles.text}>{title}</Text>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    width: '80%',
    maxWidth: 300,
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontWeight: '600',
    marginTop: 8,
  },
  lottie: {
    width: 100,
    height: 50,
  },
});
