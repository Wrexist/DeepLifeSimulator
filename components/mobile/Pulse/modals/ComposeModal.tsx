/**
 * ComposeModal — full-sheet composer for new Pulse posts.
 *
 * Wires the input straight into `PulseActions.composePost`. Closes on
 * success; surfaces failure messages inline. Honors Verified Pro's 500-char
 * limit (vs the default 280) by reading `socialMedia.verifiedPro.active`.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Gradient from '@/components/ui/Gradient';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { composePost, deliverBrandDealPost } from '@/contexts/game/actions/PulseActions';
import { getEnergyCost } from '@/lib/social/socialMedia';
import { PULSE_COLORS, PULSE_GRADIENT } from '../styles/pulseTheme';
import { pulseHaptics } from '../utils/pulseHaptics';
import type { PulseContentType, PulseActiveBrandDeal } from '@/contexts/game/types';

const LinearGradient = Gradient;

const CONTENT_TYPES: { id: PulseContentType; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'photo', label: 'Photo' },
  { id: 'video', label: 'Video' },
  { id: 'story', label: 'Story' },
];

interface ComposeModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function ComposeModal({ visible, onDismiss }: ComposeModalProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [content, setContent] = useState('');
  const [contentType, setContentType] = useState<PulseContentType>('text');
  const [hashtagsRaw, setHashtagsRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Optional sponsored-by: if set, after a successful composePost we call
  // deliverBrandDealPost to tag the new post as fulfilling this deal.
  const [sponsorDealId, setSponsorDealId] = useState<string | null>(null);

  // Eligible deals = currently-active brand deals not flagged as high-risk
  // of breach. Player picks one chip to sponsor; tap again to clear.
  const eligibleDeals: PulseActiveBrandDeal[] = useMemo(
    () =>
      (gameState.socialMedia?.activeBrandDeals ?? []).filter(
        (d: PulseActiveBrandDeal) => (d.riskOfBreach ?? 0) < 50,
      ),
    [gameState.socialMedia?.activeBrandDeals],
  );

  const proActive = gameState.socialMedia?.verifiedPro?.active === true;
  const maxLength = proActive ? 500 : 280;
  const remaining = maxLength - content.length;
  const overLimit = remaining < 0;

  // Energy preview — composePost charges getEnergyCost(contentType) (text 15 /
  // photo 20 / video 40 / story 12), NOT a flat 5. Show ⚡N · −cost for the
  // selected type so the player isn't surprised by a "not enough energy" error
  // post-tap, and disable Post when they can't afford the real cost.
  const currentEnergy = Math.max(0, Math.floor(gameState.stats?.energy ?? 0));
  const postEnergyCost = getEnergyCost(contentType);
  const lowEnergy = currentEnergy < postEnergyCost;

  const hashtags = useMemo(
    () => hashtagsRaw
      .split(/[,\s]+/)
      .map(t => t.trim())
      .filter(Boolean)
      .slice(0, 5),
    [hashtagsRaw],
  );

  const reset = useCallback(() => {
    setContent('');
    setContentType('text');
    setHashtagsRaw('');
    setError(null);
    setSponsorDealId(null);
  }, []);

  const handlePost = useCallback(() => {
    if (!content.trim() || overLimit) {
      setError(overLimit ? `Over limit by ${-remaining} chars.` : 'Write something first.');
      pulseHaptics.error();
      return;
    }
    const r = composePost(setGameState, gameState, { content, contentType, hashtags });
    if (r.success) {
      // If the player chose to sponsor a deal, tag the freshly-composed post as
      // its delivery. composePost returns the new post's id, so we call
      // deliverBrandDealPost DIRECTLY (a normal action call) with r.postId.
      // The old code ran that dispatch INSIDE a setGameState updater that
      // returned `prev` — an impure updater with a side-effect. React 19
      // StrictMode double-invokes updaters, so postsDelivered was incremented
      // twice, and the synchronous save above the dispatch never captured the
      // completion payout. A direct call fixes both.
      if (sponsorDealId && r.postId) {
        deliverBrandDealPost(setGameState, sponsorDealId, r.postId);
      }
      pulseHaptics.success();
      // Persist AFTER the commit (post-commit ref-sync pattern) so the delivery
      // + any completion payout are saved, not the pre-action snapshot.
      setTimeout(() => { void saveGame?.(); }, 0);
      reset();
      onDismiss();
    } else {
      setError(r.message);
      pulseHaptics.error();
    }
  }, [content, contentType, hashtags, overLimit, remaining, gameState, setGameState, saveGame, onDismiss, reset, sponsorDealId]);

  const handleClose = useCallback(() => {
    reset();
    onDismiss();
  }, [reset, onDismiss]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.backdrop, { zIndex: Z_INDEX.MODAL }]}
      >
        {/* paddingBottom must come from the real inset, not a scaled constant:
            the home indicator is a fixed 34pt, while scale() shrinks toward 0.7
            on small devices — i.e. the padding got smallest exactly where it was
            already too tight. */}
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: insets.bottom + responsiveSpacing.md },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close composer"
              hitSlop={8}
              style={styles.headerBtn}
            >
              <X size={fontScale(20)} color={theme.text} />
            </Pressable>
            <View style={styles.titleWrap}>
              <Text style={[styles.title, { color: theme.text }]}>New post</Text>
              <Text
                style={[
                  styles.energyPill,
                  {
                    color: lowEnergy ? PULSE_COLORS.danger : theme.textSecondary,
                    borderColor: lowEnergy ? PULSE_COLORS.danger : theme.border,
                  },
                ]}
                accessibilityLabel={`Energy ${currentEnergy}, costs ${postEnergyCost} to post a ${contentType}`}
              >
                ⚡ {currentEnergy} · −{postEnergyCost}
              </Text>
            </View>
            <Pressable
              onPress={handlePost}
              disabled={!content.trim() || overLimit || lowEnergy}
              accessibilityRole="button"
              accessibilityLabel="Post"
              accessibilityState={{ disabled: !content.trim() || overLimit || lowEnergy }}
              style={[styles.postBtn, (!content.trim() || overLimit || lowEnergy) && styles.postBtnDisabled]}
            >
              <LinearGradient
                colors={PULSE_GRADIENT as unknown as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.postBtnGradient}
              >
                <Text style={styles.postBtnText}>Post</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Content type chips */}
          <View style={styles.typeRow}>
            {CONTENT_TYPES.map(t => (
              <Pressable
                key={t.id}
                onPress={() => setContentType(t.id)}
                accessibilityRole="button"
                accessibilityLabel={`Post type: ${t.label}`}
                accessibilityState={{ selected: contentType === t.id }}
                style={[
                  styles.typeChip,
                  contentType === t.id
                    ? { backgroundColor: PULSE_COLORS.tierCelebrity, borderColor: PULSE_COLORS.tierCelebrity }
                    : { borderColor: theme.border },
                ]}
              >
                <Text style={[
                  styles.typeChipText,
                  { color: contentType === t.id ? '#FFFFFF' : theme.textSecondary },
                ]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Body input */}
          <TextInput
            value={content}
            onChangeText={(v) => { setContent(v); if (error) setError(null); }}
            placeholder={proActive ? "What's happening? (500 chars)" : "What's happening?"}
            placeholderTextColor={theme.textSecondary}
            multiline
            autoFocus
            style={[styles.input, { color: theme.text }]}
            maxLength={maxLength + 50 /* allow brief over so the overLimit message can show */}
          />

          {/* Hashtags input */}
          <TextInput
            value={hashtagsRaw}
            onChangeText={setHashtagsRaw}
            placeholder="#tags (space- or comma-separated, max 5)"
            placeholderTextColor={theme.textSecondary}
            style={[styles.hashtagsInput, { color: theme.text, borderColor: theme.border }]}
          />

          {/* Sponsor-this-post picker (only when active brand deals exist) */}
          {eligibleDeals.length > 0 ? (
            <View style={styles.sponsorWrap}>
              <Text style={[styles.sponsorLabel, { color: theme.textSecondary }]}>
                Sponsor this post?
              </Text>
              <View style={styles.sponsorChips}>
                {eligibleDeals.map((d) => {
                  const selected = sponsorDealId === d.id;
                  const remaining = (d.postsRequired ?? 1) - (d.postsDelivered ?? 0);
                  return (
                    <Pressable
                      key={d.id}
                      onPress={() => setSponsorDealId(selected ? null : d.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Sponsor ${d.brandName}, ${remaining} posts remaining`}
                      accessibilityState={{ selected }}
                      style={[
                        styles.sponsorChip,
                        selected
                          ? { backgroundColor: PULSE_COLORS.tierCelebrity, borderColor: PULSE_COLORS.tierCelebrity }
                          : { borderColor: theme.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sponsorChipText,
                          { color: selected ? '#FFFFFF' : theme.textSecondary },
                        ]}
                      >
                        {d.brandName} · {remaining} left
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Footer: counter + error */}
          <View style={styles.footer}>
            <Text
              style={[
                styles.counter,
                { color: overLimit ? PULSE_COLORS.like : remaining < 20 ? PULSE_COLORS.scandalMid : theme.textSecondary },
              ]}
            >
              {remaining}
            </Text>
            {error ? (
              <Text style={[styles.errorText, { color: PULSE_COLORS.like }]}>{error}</Text>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheet: {
    borderTopLeftRadius: scale(20),
    borderTopRightRadius: scale(20),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.lg,
    minHeight: '55%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing.md,
  },
  headerBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  title: {
    fontSize: fontScale(17),
    fontWeight: '700',
  },
  energyPill: {
    fontSize: fontScale(11),
    fontWeight: '600',
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: 999,
    borderWidth: 1,
  },
  postBtn: {
    borderRadius: scale(20),
    overflow: 'hidden',
  },
  postBtnDisabled: {
    opacity: 0.45,
  },
  postBtnGradient: {
    paddingHorizontal: scale(20),
    paddingVertical: scale(8),
  },
  postBtnText: {
    color: '#FFFFFF',
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  typeRow: {
    flexDirection: 'row',
    gap: scale(8),
    marginBottom: responsiveSpacing.md,
  },
  typeChip: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(16),
    borderWidth: 1,
  },
  typeChipText: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  input: {
    fontSize: fontScale(16),
    lineHeight: fontScale(22),
    minHeight: scale(140),
    textAlignVertical: 'top',
    paddingVertical: responsiveSpacing.sm,
  },
  sponsorWrap: {
    marginTop: responsiveSpacing.sm,
  },
  sponsorLabel: {
    fontSize: fontScale(11),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: scale(6),
  },
  sponsorChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(6),
  },
  sponsorChip: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(5),
    borderRadius: 999,
    borderWidth: 1,
  },
  sponsorChipText: {
    fontSize: fontScale(11),
    fontWeight: '600',
  },
  hashtagsInput: {
    fontSize: fontScale(13),
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.sm,
    borderRadius: scale(10),
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: responsiveSpacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: responsiveSpacing.md,
  },
  counter: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  errorText: {
    flex: 1,
    fontSize: fontScale(12),
    textAlign: 'right',
    marginLeft: responsiveSpacing.sm,
  },
});
