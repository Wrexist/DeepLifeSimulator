/**
 * PartnerProfileScreen — partner / match profile view.
 *
 * R7 Phase 3-B: replaces the earlier stub where `onOpenPartnerProfile` in
 * SparkApp returned to the matches tab. Surface for a single match's
 * profile: bio, interests, job, last messages, unmatch + report actions.
 *
 * Mounted by SparkApp as a full-screen overlay (same pattern as ChatScreen).
 * The screen reads from `gameState.sparkApp.matches`/`messages` and the
 * `DATING_PROFILES` catalog — no extra state of its own besides a
 * confirmation modal for the destructive actions.
 *
 * Promoted matches additionally show a "Dating" status tag — the existing
 * DatingActions flow remains canonical for relationship progression
 * (proposeMarriage, planWedding, etc.) and is reachable from the
 * SocialActionsContext via the Family tab.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, AlertTriangle, Briefcase, GraduationCap, Heart, MapPin, MessageCircle, Sparkles, UserX } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { DATING_PROFILES, getDatingProfileImage } from '@/lib/dating/datingProfiles';
import { unmatch, reportProfile } from '@/contexts/game/actions/SparkActions';
import { SPARK_GRADIENT, SPARK_COLORS } from '../styles/sparkTheme';
import { sparkHaptics } from '../utils/sparkHaptics';
import EmptyState from '../components/EmptyState';
import type { SparkMessage } from '@/contexts/game/types';

const LinearGradient = LinearGradientFallback;

interface PartnerProfileScreenProps {
  matchId: string;
  onBack: () => void;
  /** Called after a successful unmatch / report so the parent can pop the route. */
  onClosed: () => void;
}

export default function PartnerProfileScreen({ matchId, onBack, onClosed }: PartnerProfileScreenProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();

  const sp = gameState.sparkApp;
  const match = sp?.matches?.find((m: any) => m.id === matchId);
  const profile = match ? DATING_PROFILES.find((p) => p.id === match.profileId) : undefined;
  const messages: SparkMessage[] = sp?.messages?.[matchId] ?? [];
  const lastMessages = useMemo(() => messages.slice(-3), [messages]);

  const handleUnmatch = useCallback(() => {
    Alert.alert(
      'Unmatch?',
      profile
        ? `Unmatch ${profile.name}? This removes the conversation and they won't see you again.`
        : 'Unmatch and remove this conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unmatch',
          style: 'destructive',
          onPress: () => {
            sparkHaptics.tap();
            unmatch(setGameState, matchId);
            saveGame?.();
            onClosed();
          },
        },
      ],
    );
  }, [matchId, profile, setGameState, saveGame, onClosed]);

  const handleReport = useCallback(() => {
    if (!profile) return;
    Alert.alert(
      'Report profile?',
      `Report ${profile.name}? They'll be unmatched and you won't see them again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            sparkHaptics.tap();
            const result = reportProfile(setGameState, profile.id);
            if (result.success) {
              saveGame?.();
              onClosed();
            }
          },
        },
      ],
    );
  }, [profile, setGameState, saveGame, onClosed]);

  if (!match || !profile) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <Header theme={theme} title="Profile" onBack={onBack} />
        <EmptyState observation="Profile not found." nudge="Open a different match." />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Header theme={theme} title="Profile" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero */}
        <View style={styles.hero}>
          <LinearGradient
            colors={SPARK_GRADIENT as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarRing}
          >
            <Image source={getDatingProfileImage(profile.gender)} style={styles.avatar} />
          </LinearGradient>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {profile.name}, {profile.age}
          </Text>
          <View style={styles.metaRow}>
            <MapPin size={fontScale(12)} color={theme.textSecondary} />
            <Text style={[styles.metaText, { color: theme.textSecondary }]}>
              {profile.distance} mi away
            </Text>
            {match.promoted ? (
              <View style={[styles.tag, { backgroundColor: SPARK_COLORS.accent }]}>
                <Heart size={fontScale(10)} color="#FFFFFF" fill="#FFFFFF" />
                <Text style={styles.tagText}>Dating</Text>
              </View>
            ) : (
              <View style={[styles.tag, { backgroundColor: theme.border }]}>
                <Text style={[styles.tagText, { color: theme.text }]}>New match</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bio */}
        {profile.bio ? (
          <Section theme={theme} icon={<Sparkles size={fontScale(14)} color={theme.text} />} title="About">
            <Text style={[styles.bodyText, { color: theme.text }]}>{profile.bio}</Text>
          </Section>
        ) : null}

        {/* Interests */}
        {profile.interests && profile.interests.length > 0 ? (
          <Section theme={theme} title="Interests">
            <View style={styles.chipRow}>
              {profile.interests.map((interest) => (
                <View
                  key={interest}
                  style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Text style={[styles.chipText, { color: theme.text }]}>{interest}</Text>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        {/* Job / education */}
        <Section theme={theme} title="Background">
          {profile.job ? (
            <Row icon={<Briefcase size={fontScale(14)} color={theme.textSecondary} />} text={profile.job} theme={theme} />
          ) : null}
          {profile.education ? (
            <Row icon={<GraduationCap size={fontScale(14)} color={theme.textSecondary} />} text={profile.education} theme={theme} />
          ) : null}
          {profile.personality ? (
            <Row icon={<Sparkles size={fontScale(14)} color={theme.textSecondary} />} text={profile.personality} theme={theme} />
          ) : null}
        </Section>

        {/* Last messages */}
        {lastMessages.length > 0 ? (
          <Section
            theme={theme}
            icon={<MessageCircle size={fontScale(14)} color={theme.text} />}
            title="Recent messages"
          >
            {lastMessages.map((m) => (
              <View key={m.id} style={[styles.msgRow, { borderColor: theme.border }]}>
                <Text style={[styles.msgFrom, { color: theme.textSecondary }]}>
                  {m.from === 'player' ? 'You' : profile.name.split(' ')[0]}
                </Text>
                <Text style={[styles.msgText, { color: theme.text }]} numberOfLines={2}>
                  {m.text}
                </Text>
              </View>
            ))}
          </Section>
        ) : null}

        {/* Destructive actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={handleUnmatch}
            accessibilityRole="button"
            accessibilityLabel={`Unmatch ${profile.name}`}
            style={[styles.actionBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
          >
            <UserX size={fontScale(16)} color={theme.text} />
            <Text style={[styles.actionText, { color: theme.text }]}>Unmatch</Text>
          </Pressable>
          <Pressable
            onPress={handleReport}
            accessibilityRole="button"
            accessibilityLabel={`Report ${profile.name}`}
            style={[styles.actionBtn, { borderColor: SPARK_COLORS.danger, backgroundColor: theme.surface }]}
          >
            <AlertTriangle size={fontScale(16)} color={SPARK_COLORS.danger} />
            <Text style={[styles.actionText, { color: SPARK_COLORS.danger }]}>Report</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Header({ theme, title, onBack }: { theme: any; title: string; onBack: () => void }) {
  return (
    <View style={[styles.header, { borderBottomColor: theme.border }]}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={styles.headerBtn}>
        <ArrowLeft size={fontScale(22)} color={theme.text} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: theme.text }]}>{title}</Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

function Section({
  theme, title, icon, children,
}: {
  theme: any;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.sectionHeader}>
        {icon}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ icon, text, theme }: { icon: React.ReactNode; text: string; theme: any }) {
  return (
    <View style={styles.row}>
      {icon}
      <Text style={[styles.rowText, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontScale(16),
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: responsiveSpacing.md,
    paddingBottom: responsiveSpacing.xl,
    gap: responsiveSpacing.md,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: responsiveSpacing.lg,
  },
  avatarRing: {
    width: scale(112),
    height: scale(112),
    borderRadius: scale(56),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: scale(56),
  },
  name: {
    fontSize: fontScale(22),
    fontWeight: '700',
    marginTop: responsiveSpacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  metaText: {
    fontSize: fontScale(12),
  },
  tag: {
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: fontScale(10),
    fontWeight: '700',
  },
  section: {
    borderRadius: scale(14),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: fontScale(13),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBody: {
    gap: responsiveSpacing.xs,
  },
  bodyText: {
    fontSize: fontScale(14),
    lineHeight: fontScale(20),
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: fontScale(12),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  rowText: {
    fontSize: fontScale(13),
    flex: 1,
  },
  msgRow: {
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  msgFrom: {
    fontSize: fontScale(11),
    fontWeight: '600',
    marginBottom: 2,
  },
  msgText: {
    fontSize: fontScale(13),
  },
  actions: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
    marginTop: responsiveSpacing.md,
  },
  actionBtn: {
    flex: 1,
    minHeight: touchTargets.minimum,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: scale(10),
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionText: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
});
