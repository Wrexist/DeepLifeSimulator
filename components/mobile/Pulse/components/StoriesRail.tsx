/**
 * StoriesRail — horizontal scroller above the feed.
 *
 * Shows: your own live status (when streaming), then NPCs with high
 * relationship scores as "story" bubbles. Tap your own bubble to go live;
 * tap an NPC bubble to open their profile / DMs (future).
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Radio, Plus } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { PULSE_GRADIENT, PULSE_COLORS, PULSE_MOTION } from '../styles/pulseTheme';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import type { NpcStoryTarget } from '../modals/NpcProfileSheet';

const LinearGradient = Gradient;

interface StoriesRailProps {
  onGoLive: () => void;
  /** Tap an NPC story bubble → open the NPC follow sheet (owned by PulseApp). */
  onTapNpc?: (npc: NpcStoryTarget) => void;
}

const BUBBLE = scale(60);

export default function StoriesRail({ onGoLive, onTapNpc }: StoriesRailProps) {
  const { gameState } = useGame();
  const { theme } = useTheme();
  const ringScale = useRef(new Animated.Value(1)).current;

  const liveSession = gameState.socialMedia?.liveSession;
  const isLive = !!liveSession?.active;

  // Loop the live ring pulse when broadcasting
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!isLive || reduced) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringScale, { toValue: 1.06, duration: PULSE_MOTION.liveRingLoop / 2, useNativeDriver: true }),
        Animated.timing(ringScale, { toValue: 1, duration: PULSE_MOTION.liveRingLoop / 2, useNativeDriver: true }),
      ]),
    ).start();
    return () => {
      ringScale.stopAnimation();
    };
  }, [isLive, ringScale, reduced]);

  // NPCs with relationship score >= 30 — show top 8 by score
  const npcStories = useMemo(() => {
    const rels = gameState.relationships ?? [];
    return [...rels]
      .filter((r) => (r.relationshipScore ?? 0) >= 30)
      .sort((a, b) => (b.relationshipScore ?? 0) - (a.relationshipScore ?? 0))
      .slice(0, 8);
  }, [gameState.relationships]);

  const handleSelfPress = useCallback(() => {
    onGoLive();
  }, [onGoLive]);

  if (!isLive && npcStories.length === 0) {
    // Still render the "your story" bubble as a way to encourage going live
    // even when there's no other content.
  }

  return (
    <View style={[styles.wrap, { borderBottomColor: theme.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Your bubble */}
        <Pressable
          onPress={handleSelfPress}
          accessibilityRole="button"
          accessibilityLabel={isLive ? 'You are live, tap to manage' : 'Go live'}
          style={styles.item}
        >
          <Animated.View style={[styles.ringOuter, { transform: [{ scale: isLive ? ringScale : 1 }] }]}>
            {isLive ? (
              <LinearGradient
                colors={[PULSE_COLORS.danger, PULSE_GRADIENT[0]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ringInner}
              >
                <Avatar
                  uri={gameState.userProfile?.profilePhoto}
                  fallback="Y"
                  seed={gameState.userProfile?.name}
                  sex={gameState.userProfile?.sex}
                  age={gameState.date?.age}
                />
              </LinearGradient>
            ) : (
              <View style={[styles.ringInnerStatic, { borderColor: theme.border }]}>
                <Avatar
                  uri={gameState.userProfile?.profilePhoto}
                  fallback="Y"
                  seed={gameState.userProfile?.name}
                  sex={gameState.userProfile?.sex}
                  age={gameState.date?.age}
                />
                <View style={[styles.plusBadge, { backgroundColor: PULSE_GRADIENT[0] }]}>
                  <Plus size={fontScale(12)} color="#FFFFFF" strokeWidth={3} />
                </View>
              </View>
            )}
          </Animated.View>
          {isLive ? (
            <View style={styles.liveTag}>
              <Radio size={fontScale(10)} color="#FFFFFF" strokeWidth={3} />
              <Text style={styles.liveTagText}>LIVE</Text>
            </View>
          ) : (
            <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
              You
            </Text>
          )}
        </Pressable>

        {/* NPC bubbles */}
        {npcStories.map((npc) => (
          <Pressable
            key={npc.id}
            onPress={() => onTapNpc?.({ id: npc.id, name: npc.name, profilePicture: npc.profilePicture })}
            accessibilityRole="button"
            accessibilityLabel={`${npc.name}'s story`}
            style={styles.item}
          >
            <View style={[styles.ringInnerStatic, { borderColor: PULSE_GRADIENT[0] }]}>
              <Avatar
                uri={npc.profilePicture}
                fallback={npc.name.slice(0, 1).toUpperCase()}
                seed={npc.id}
              />
            </View>
            <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
              {npc.name.split(' ')[0]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function Avatar({ uri, fallback, seed, sex, age }: {
  uri?: string;
  fallback: string;
  /** Identity for the generated face shown when there is no photo. */
  seed?: string;
  sex?: string | null;
  age?: number;
}) {
  if (uri || seed) {
    // R6 H-12: ImageWithFallback degrades rather than leaving a transparent gap
    // on a broken URI / 404 / network failure. It now degrades to the
    // character's face rather than to a letter, when we know who this is.
    return (
      <ImageWithFallback
        uri={uri}
        fallback={fallback}
        face={seed ? { seed, sex, age, size: BUBBLE - 8 } : undefined}
        style={styles.avatar}
      />
    );
  }
  return (
    <LinearGradient
      colors={PULSE_GRADIENT as unknown as string[]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.avatar, styles.avatarFallback]}
    >
      <Text style={styles.avatarLetter}>{fallback}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scroll: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    gap: responsiveSpacing.md,
  },
  item: {
    alignItems: 'center',
    width: BUBBLE + 12,
    gap: 4,
  },
  ringOuter: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInnerStatic: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    borderWidth: 2,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: BUBBLE - 8,
    height: BUBBLE - 8,
    borderRadius: (BUBBLE - 8) / 2,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: fontScale(20),
    fontWeight: '700',
  },
  plusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  label: {
    fontSize: fontScale(10),
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: BUBBLE + 8,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: PULSE_COLORS.danger,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  liveTagText: {
    color: '#FFFFFF',
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
