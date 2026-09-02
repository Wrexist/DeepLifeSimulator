/**
 * ComposeModal - full-sheet composer for new Pulse posts.
 *
 * Wires the input straight into `PulseActions.composePost`. Closes on
 * success; surfaces failure messages inline. Honors Verified Pro's 500-char
 * limit (vs the default 280) by reading `socialMedia.verifiedPro.active`.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Zap } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import BaseModal from '@/components/ui/BaseModal';
import SegmentedControl from '@/components/ui/SegmentedControl';
import Chip from '@/components/ui/Chip';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { composePost, deliverBrandDealPost } from '@/contexts/game/actions/PulseActions';
import { getEnergyCost } from '@/lib/social/socialMedia';
import { PULSE_COLORS } from '../styles/pulseTheme';
import { pulseHaptics } from '../utils/pulseHaptics';
import type { PulseContentType, PulseActiveBrandDeal } from '@/contexts/game/types';

/** The ONE gradient left in Pulse: the primary Post CTA. */
const LinearGradient = Gradient;
const PULSE_GRADIENT_CTA: string[] = [PULSE_COLORS.accent, PULSE_COLORS.accentSecondary];

const CONTENT_TYPES: { key: PulseContentType; label: string }[] = [
  { key: 'text', label: 'Text' },
  { key: 'photo', label: 'Photo' },
  { key: 'video', label: 'Video' },
  { key: 'story', label: 'Story' },
];

interface ComposeModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function ComposeModal({ visible, onDismiss }: ComposeModalProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();

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

  // Energy preview - composePost charges getEnergyCost(contentType) (text 15 /
  // photo 20 / video 40 / story 12), NOT a flat 5. Show N · −cost for the
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
      // returned `prev` - an impure updater with a side-effect. React 19
      // StrictMode double-invokes updaters, so postsDelivered was incremented
      // twice, and the synchronous save above the dispatch never captured the
      // completion payout. A direct call fixes both.
      if (sponsorDealId && r.postId) {
        deliverBrandDealPost(gameState, setGameState, sponsorDealId, r.postId);
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

  const postDisabled = !content.trim() || overLimit || lowEnergy;

  return (
    <BaseModal
      visible={visible}
      onClose={handleClose}
      variant="bottom"
      title="New post"
      footer={
        <View style={styles.footerRow}>
          <Chip
            label={`${currentEnergy} · −${postEnergyCost}`}
            tone={lowEnergy ? 'danger' : 'neutral'}
            icon={<Zap size={fontScale(12)} color={lowEnergy ? PULSE_COLORS.danger : theme.textSecondary} />}
            accessibilityLabel={`Energy ${currentEnergy}, costs ${postEnergyCost} to post a ${contentType}`}
          />
          <Text
            style={[
              styles.counter,
              { color: overLimit ? PULSE_COLORS.danger : remaining < 20 ? PULSE_COLORS.scandalMid : theme.textSecondary },
            ]}
          >
            {remaining}
          </Text>
          <Pressable
            onPress={handlePost}
            disabled={postDisabled}
            accessibilityRole="button"
            accessibilityLabel="Post"
            accessibilityState={{ disabled: postDisabled }}
            style={[styles.postBtn, postDisabled && styles.postBtnDisabled]}
          >
            <LinearGradient
              colors={PULSE_GRADIENT_CTA}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.postBtnGradient}
            >
              <Text style={styles.postBtnText}>Post</Text>
            </LinearGradient>
          </Pressable>
        </View>
      }
    >
      {/* Content type */}
      <SegmentedControl
        compact
        segments={CONTENT_TYPES}
        value={contentType}
        onChange={setContentType}
        activeColor={PULSE_COLORS.accent}
        style={styles.typeRow}
      />

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
          <Text style={[styles.sponsorLabel, { color: theme.textSecondary }]}>Sponsor this post?</Text>
          <View style={styles.sponsorChips}>
            {eligibleDeals.map((d) => {
              const selected = sponsorDealId === d.id;
              const left = (d.postsRequired ?? 1) - (d.postsDelivered ?? 0);
              return (
                <Chip
                  key={d.id}
                  label={`${d.brandName} · ${left} left`}
                  tint={PULSE_COLORS.tierCelebrity}
                  selected={selected}
                  onPress={() => setSponsorDealId(selected ? null : d.id)}
                  accessibilityLabel={`Sponsor ${d.brandName}, ${left} posts remaining`}
                />
              );
            })}
          </View>
        </View>
      ) : null}

      {error ? <Text style={[styles.errorText, { color: PULSE_COLORS.danger }]}>{error}</Text> : null}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  postBtn: {
    marginLeft: 'auto',
    borderRadius: scale(20),
    overflow: 'hidden',
  },
  postBtnDisabled: {
    opacity: 0.45,
  },
  postBtnGradient: {
    paddingHorizontal: scale(20),
    minHeight: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBtnText: {
    color: '#FFFFFF',
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  typeRow: {
    marginBottom: responsiveSpacing.md,
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
  hashtagsInput: {
    fontSize: fontScale(13),
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.sm,
    borderRadius: scale(10),
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: responsiveSpacing.sm,
  },
  counter: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  errorText: {
    fontSize: fontScale(12),
    marginTop: responsiveSpacing.sm,
  },
});
