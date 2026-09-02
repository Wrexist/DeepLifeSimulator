/**
 * PartnerProfileScreen - partner / match profile view.
 *
 * R7 Phase 3-B: replaces the earlier stub where `onOpenPartnerProfile` in
 * SparkApp returned to the matches tab. Surface for a single match's
 * profile: bio, interests, job, last messages, unmatch + report actions.
 *
 * Mounted by SparkApp as a full-screen overlay (same pattern as ChatScreen).
 * The screen reads from `gameState.sparkApp.matches`/`messages` and the
 * `DATING_PROFILES` catalog - no extra state of its own besides a
 * confirmation modal for the destructive actions.
 *
 * Promoted matches additionally show a "Dating" status tag - the existing
 * DatingActions flow remains canonical for relationship progression
 * (proposeMarriage, planWedding, etc.) and is reachable from the
 * SocialActionsContext via the Family tab.
 */
import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, Briefcase, DollarSign, GraduationCap, Heart, MapPin, MessageCircle, ShieldCheck, Sparkles, UserX } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '@/components/ui/AppHeader';
import Chip from '@/components/ui/Chip';
import SectionTitle from '@/components/ui/SectionTitle';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { withAlpha } from '@/lib/config/theme';
import { scale, fontScale, responsiveSpacing, responsiveBorderRadius, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { getGlassCard, getGlassButton } from '@/utils/glassmorphismStyles';
import { DATING_PROFILES } from '@/lib/dating/datingProfiles';
import CharacterAvatar from '@/components/avatar/CharacterAvatar';
import { unmatch, reportProfile, exposeCatfish, fallForCatfish } from '@/contexts/game/actions/SparkActions';
import { isCatfish } from '@/lib/dating/sparkLogic';
import { SPARK_COLORS } from '../styles/sparkTheme';
import { sparkHaptics } from '../utils/sparkHaptics';
import EmptyState from '../components/EmptyState';
import type { SparkMessage } from '@/contexts/game/types';
import { gameAlert } from '@/utils/gameAlert';

/** Money the player loses if they fall for a catfish's "send money" ask. */
const CATFISH_SCAM_LOSS = 500;

interface PartnerProfileScreenProps {
  matchId: string;
  onBack: () => void;
  /** Called after a successful unmatch / report so the parent can pop the route. */
  onClosed: () => void;
}

export default function PartnerProfileScreen({ matchId, onBack, onClosed }: PartnerProfileScreenProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const sp = gameState.sparkApp;
  const match = sp?.matches?.find((m) => m.id === matchId);
  const profile = match ? DATING_PROFILES.find((p) => p.id === match.profileId) : undefined;
  const messages: SparkMessage[] = sp?.messages?.[matchId] ?? [];
  const lastMessages = useMemo(() => messages.slice(-3), [messages]);

  // Catfish determination - same seed `swipeOnProfile` / the swipe-deck chip use,
  // so the "Expose" / "Send money" actions only appear on a genuine catfish.
  const catfishSuspected = profile ? isCatfish(profile, gameState.lineageId ?? 'initial') : false;

  const handleUnmatch = useCallback(() => {
    gameAlert(
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
    gameAlert(
      'Report profile?',
      `Report ${profile.name}? They'll be unmatched and you won't see them again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            sparkHaptics.tap();
            const result = reportProfile(gameState, setGameState, profile.id);
            if (result.success) {
              saveGame?.();
              onClosed();
            }
          },
        },
      ],
    );
  }, [profile, gameState, setGameState, saveGame, onClosed]);

  // 1c: expose a matched catfish - unmatches and grants reputation for calling
  // out the fake profile. Mirrors handleReport's confirm → act → save → close.
  const handleExpose = useCallback(() => {
    if (!profile) return;
    gameAlert(
      'Expose catfish?',
      `Call out ${profile.name} as a fake profile? You'll unmatch and gain reputation for protecting other users.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Expose',
          style: 'default',
          onPress: () => {
            sparkHaptics.warning();
            const result = exposeCatfish(setGameState, gameState, profile.id);
            if (result.success) {
              saveGame?.();
              onClosed();
            }
          },
        },
      ],
    );
  }, [profile, gameState, setGameState, saveGame, onClosed]);

  // 1e: the risky counterpart to Expose - trust the catfish and send money.
  // Loses money + reputation (the scam downside) via the existing action.
  const handleSendMoney = useCallback(() => {
    if (!profile) return;
    gameAlert(
      'Send money?',
      `${profile.name} is asking you to send $${CATFISH_SCAM_LOSS}. If this is a scam, the money is gone for good.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send money',
          style: 'destructive',
          onPress: () => {
            sparkHaptics.error();
            fallForCatfish(setGameState, gameState, profile.id, CATFISH_SCAM_LOSS);
            saveGame?.();
            onClosed();
          },
        },
      ],
    );
  }, [profile, gameState, setGameState, saveGame, onClosed]);

  if (!match || !profile) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <AppHeader title="Profile" onBack={onBack} backLabel="Back to chat" centered />
        <EmptyState observation="Profile not found." nudge="Open a different match." />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <AppHeader title={profile.name} onBack={onBack} backLabel="Back to chat" centered />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
        {/* Hero - one plain glass card; the identity tint is the avatar ring. */}
        <View
          style={[
            getGlassCard(isDark, 12),
            styles.heroCard,
            { backgroundColor: theme.surface, borderColor: isDark ? theme.glassBorder : theme.border },
          ]}
        >
          <View style={styles.heroInner}>
            <View style={[styles.avatarRing, { backgroundColor: withAlpha(SPARK_COLORS.accent, 0.16) }]}>
              <CharacterAvatar seed={profile.id} sex={profile.gender} age={profile.age} size={scale(108)} />
            </View>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {profile.name}, {profile.age}
            </Text>
            <View style={styles.metaRow}>
              <MapPin size={fontScale(12)} color={theme.textSecondary} />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {profile.distance} mi away
              </Text>
              {match.promoted ? (
                <Chip
                  label="Dating"
                  tint={SPARK_COLORS.accent}
                  icon={<Heart size={fontScale(10)} color={SPARK_COLORS.accent} fill={SPARK_COLORS.accent} />}
                />
              ) : (
                <Chip label="New match" />
              )}
            </View>
          </View>
        </View>

        {/* Bio */}
        {profile.bio ? (
          <Section theme={theme} darkMode={isDark} icon={<Sparkles size={fontScale(14)} color={theme.text} />} title="About">
            <Text style={[styles.bodyText, { color: theme.text }]}>{profile.bio}</Text>
          </Section>
        ) : null}

        {/* Interests */}
        {profile.interests && profile.interests.length > 0 ? (
          <Section theme={theme} darkMode={isDark} title="Interests">
            <View style={styles.chipRow}>
              {profile.interests.map((interest) => (
                <Chip key={interest} label={interest} />
              ))}
            </View>
          </Section>
        ) : null}

        {/* Job / education */}
        <Section theme={theme} darkMode={isDark} title="Background">
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
            darkMode={isDark}
            icon={<MessageCircle size={fontScale(14)} color={theme.text} />}
            title="Recent messages"
          >
            {lastMessages.map((m) => (
              <View key={m.id} style={styles.msgRow}>
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

        {/* Catfish actions - only shown when this match is a suspected catfish.
            Expose (safe, +reputation) vs. Send money (risky, the scam downside). */}
        {catfishSuspected ? (
          <View style={styles.actions}>
            <Pressable
              onPress={handleExpose}
              accessibilityRole="button"
              accessibilityLabel={`Expose ${profile.name} as a catfish`}
              style={[getGlassButton(isDark), styles.actionBtn]}
            >
              <ShieldCheck size={fontScale(16)} color={SPARK_COLORS.success} />
              <Text style={[styles.actionText, { color: SPARK_COLORS.success }]}>Expose</Text>
            </Pressable>
            <Pressable
              onPress={handleSendMoney}
              accessibilityRole="button"
              accessibilityLabel={`Send money to ${profile.name}`}
              style={[getGlassButton(isDark), styles.actionBtn]}
            >
              <DollarSign size={fontScale(16)} color={SPARK_COLORS.danger} />
              <Text style={[styles.actionText, { color: SPARK_COLORS.danger }]}>Send money</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Destructive actions - quiet glass buttons; danger lives on the label only. */}
        <View style={styles.actions}>
          <Pressable
            onPress={handleUnmatch}
            accessibilityRole="button"
            accessibilityLabel={`Unmatch ${profile.name}`}
            style={[getGlassButton(isDark), styles.actionBtn]}
          >
            <UserX size={fontScale(16)} color={theme.text} />
            <Text style={[styles.actionText, { color: theme.text }]}>Unmatch</Text>
          </Pressable>
          <Pressable
            onPress={handleReport}
            accessibilityRole="button"
            accessibilityLabel={`Report ${profile.name}`}
            style={[getGlassButton(isDark), styles.actionBtn]}
          >
            <AlertTriangle size={fontScale(16)} color={SPARK_COLORS.danger} />
            <Text style={[styles.actionText, { color: SPARK_COLORS.danger }]}>Report</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({
  theme, darkMode, title, icon, children,
}: {
  theme: ReturnType<typeof useTheme>['theme'];
  darkMode: boolean;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={[getGlassCard(darkMode, 6), styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <SectionTitle title={title} right={icon} />
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ icon, text, theme }: { icon: React.ReactNode; text: string; theme: ReturnType<typeof useTheme>['theme'] }) {
  return (
    <View style={styles.row}>
      {icon}
      <Text style={[styles.rowText, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    paddingHorizontal: responsiveSpacing.md,
    paddingTop: responsiveSpacing.sm,
    paddingBottom: responsiveSpacing.xl,
    gap: responsiveSpacing.lg,
  },
  heroCard: {
    borderRadius: responsiveBorderRadius['2xl'],
    borderWidth: 1,
  },
  heroInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.lg,
    alignItems: 'center',
  },
  avatarRing: {
    width: scale(112),
    height: scale(112),
    borderRadius: scale(56),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  name: {
    fontSize: fontScale(22),
    fontWeight: '600',
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
  section: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
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
  },
  actionText: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
});
