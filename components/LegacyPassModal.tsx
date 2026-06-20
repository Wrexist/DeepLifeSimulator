/**
 * LegacyPassModal — the seasonal Legacy Pass UI (dual free/premium track).
 *
 * Reads the `legacyPass` slice via `useGameSelector` and drives the pure engine
 * (`lib/legacyPass`) + actions (`LegacyPassActions`). Premium is gated on an
 * active subscription (synced into the pass on open).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { X, Lock, Check, Crown, Gift } from 'lucide-react-native';
import { useGameSelector, useSetGameState } from '@/contexts/game/useGameSelector';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { scale, fontScale, responsiveBorderRadius } from '@/utils/scaling';
import { accent, colors } from '@/lib/config/theme';
import {
  ensureCurrentSeason,
  getTierForXp,
  xpIntoCurrentTier,
  xpToNextTier,
  XP_PER_TIER,
  MAX_TIER,
  getLegacyPassReward,
  getClaimableCount,
  getUnclaimedEarnedRewards,
  claimLegacyPassTier,
  type LegacyPassTrack,
} from '@/lib/legacyPass/legacyPass';
import {
  claimLegacyPassReward,
  claimAllLegacyPassRewards,
  reconcileLegacyPassSeason,
} from '@/contexts/game/actions/LegacyPassActions';
import { toggleCosmetic } from '@/contexts/game/actions/CosmeticActions';
import { resolveOwnedCosmetics, getCosmetic } from '@/lib/cosmetics/cosmetics';
import { subscriptionService } from '@/services/SubscriptionService';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Optional: open the subscription/paywall flow. */
  onSubscribe?: () => void;
}

const reasonMessage = (reason: string): string => {
  switch (reason) {
    case 'locked': return 'Earn more XP to unlock this tier';
    case 'already-claimed': return 'Already claimed';
    case 'premium-required': return 'Subscribe to unlock the premium track';
    default: return 'Nothing to claim';
  }
};

export default function LegacyPassModal({ visible, onClose, onSubscribe }: Props) {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const legacyPassRaw = useGameSelector((s) => s.legacyPass);
  const setGameState = useSetGameState();
  const { saveGame } = useGameActions();
  const [toast, setToast] = useState<string | null>(null);

  const seasonSummary = useGameSelector((s) => s.legacyPassSeasonSummary);

  const pass = useMemo(() => ensureCurrentSeason(legacyPassRaw), [legacyPassRaw]);
  const currentTier = getTierForXp(pass.xp);
  const intoTier = xpIntoCurrentTier(pass.xp);
  const toNext = xpToNextTier(pass.xp);
  const claimableCount = useMemo(() => getClaimableCount(pass), [pass]);

  const claimedFree = useMemo(() => new Set(pass.claimedFreeTiers), [pass.claimedFreeTiers]);
  const claimedPremium = useMemo(() => new Set(pass.claimedPremiumTiers), [pass.claimedPremiumTiers]);

  const equipped = useGameSelector((s) => s.equippedCosmetics);
  const ownedCosmetics = useMemo(() => resolveOwnedCosmetics(pass.ownedCosmetics), [pass.ownedCosmetics]);
  const equippedFrame = equipped?.frame ? getCosmetic(equipped.frame) : undefined;
  const equippedTheme = equipped?.theme ? getCosmetic(equipped.theme) : undefined;

  // Animations (reduced-motion aware): progress-bar fill + toast entrance.
  const fillRatio = currentTier >= MAX_TIER ? 1 : intoTier / XP_PER_TIER;
  const fillAnim = useRef(new Animated.Value(fillRatio)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      fillAnim.setValue(fillRatio);
      return;
    }
    Animated.timing(fillAnim, { toValue: fillRatio, duration: 500, useNativeDriver: false }).start();
  }, [fillRatio, reducedMotion, fillAnim]);

  useEffect(() => {
    if (!toast) return;
    if (reducedMotion) {
      toastAnim.setValue(1);
      return;
    }
    toastAnim.setValue(0);
    Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 80 }).start();
  }, [toast, reducedMotion, toastAnim]);

  // New-season banner entrance — a celebratory pop when a rollover summary appears.
  const hasSeasonSummary = !!(seasonSummary && seasonSummary.collectedCount > 0);
  const bannerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!hasSeasonSummary) return;
    if (reducedMotion) {
      bannerAnim.setValue(1);
      return;
    }
    bannerAnim.setValue(0);
    Animated.spring(bannerAnim, { toValue: 1, useNativeDriver: true, friction: 6, tension: 70 }).start();
  }, [hasSeasonSummary, reducedMotion, bannerAnim]);

  // Reconcile the season on open: rolls over (auto-collecting unclaimed rewards,
  // no silent loss) and re-derives the premium flag from the live subscription.
  useEffect(() => {
    if (!visible) return;
    const subscribed = subscriptionService.getSubscriptionTier() !== 'free';
    setGameState((prev) => reconcileLegacyPassSeason(prev, subscribed));
  }, [visible, setGameState]);

  const dismissSeasonSummary = () => {
    setGameState((prev) => ({ ...prev, legacyPassSeasonSummary: undefined }));
    void saveGame?.(false);
  };

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const handleClaim = (track: LegacyPassTrack, tier: number) => {
    // Preview the outcome from the (already-reconciled) pass so messaging is
    // consistent, then apply against full state.
    const preview = claimLegacyPassTier(pass, track, tier);
    if (!preview.ok) {
      setToast(reasonMessage(preview.reason));
      return;
    }
    setToast(`Claimed: ${preview.reward.label}`);
    setGameState((prev) => claimLegacyPassReward(prev, track, tier).state);
    void saveGame?.(false); // persist the claim immediately
  };

  const handleClaimAll = () => {
    if (claimableCount === 0) {
      setToast('Nothing to claim');
      return;
    }
    // Preview the message from the local pass (claiming never unlocks new tiers),
    // then apply against full state.
    const rewards = getUnclaimedEarnedRewards(pass);
    const gems = rewards
      .filter((r) => r.kind === 'gems')
      .reduce((sum, r) => sum + (r.amount ?? 0), 0);
    setToast(`Claimed ${rewards.length} reward${rewards.length === 1 ? '' : 's'}${gems > 0 ? ` (+${gems} gems)` : ''}`);
    setGameState((prev) => claimAllLegacyPassRewards(prev).state);
    void saveGame?.(false); // persist the bulk claim immediately
  };

  const handleToggleCosmetic = (id: string) => {
    setGameState((prev) => toggleCosmetic(prev, id));
    void saveGame?.(false); // persist the equip change immediately
  };

  const renderCell = (track: LegacyPassTrack, tier: number) => {
    const reward = getLegacyPassReward(track, tier);
    if (!reward) return <View style={styles.cell} />;
    const claimed = (track === 'free' ? claimedFree : claimedPremium).has(tier);
    const unlocked = currentTier >= tier;
    const premiumLocked = track === 'premium' && !pass.premiumOwned;

    let bg: string = theme.surfaceElevated;
    let icon = <Gift size={scale(14)} color={theme.textSecondary} />;
    let disabled = true;
    if (claimed) {
      bg = 'rgba(16,185,129,0.15)';
      icon = <Check size={scale(14)} color={accent.success} />;
    } else if (premiumLocked) {
      icon = <Crown size={scale(14)} color={accent.warning} />;
    } else if (unlocked) {
      bg = track === 'premium' ? 'rgba(99,102,241,0.18)' : theme.surface;
      icon = <Gift size={scale(14)} color={colors.palette.primary} />;
      disabled = false;
    } else {
      icon = <Lock size={scale(14)} color={theme.textMuted} />;
    }

    return (
      <TouchableOpacity
        style={[styles.cell, { backgroundColor: bg, borderColor: theme.border }]}
        disabled={disabled}
        onPress={() => handleClaim(track, tier)}
        accessibilityRole="button"
        accessibilityLabel={`${track} tier ${tier}: ${reward.label}${claimed ? ', claimed' : unlocked ? ', claimable' : ', locked'}`}
      >
        {icon}
        <Text numberOfLines={1} style={[styles.cellLabel, { color: theme.text }]}>{reward.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType={reducedMotion ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Crown size={scale(20)} color={accent.warning} />
              <Text style={[styles.title, { color: theme.text }]}>Legacy Pass</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close Legacy Pass">
              <X size={scale(22)} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Progress */}
          <View style={[styles.progressBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.tierText, { color: theme.text }]}>Tier {currentTier} / {MAX_TIER}</Text>
            <View style={[styles.progressTrack, { backgroundColor: theme.surfaceElevated }]}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: fillAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    backgroundColor: colors.palette.primary,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
              {currentTier >= MAX_TIER ? 'Max tier reached' : `${intoTier}/${XP_PER_TIER} XP · ${toNext} to next tier`}
            </Text>
          </View>

          {/* New-season summary — shown once after a rollover auto-collected rewards */}
          {hasSeasonSummary && seasonSummary && (
            <Animated.View
              style={[
                styles.seasonBanner,
                { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: accent.success },
                { opacity: bannerAnim, transform: [{ scale: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] },
              ]}
            >
              <View style={styles.seasonBannerText}>
                <Text style={[styles.seasonBannerTitle, { color: theme.text }]}>New season started!</Text>
                <Text style={[styles.seasonBannerDesc, { color: theme.textSecondary }]}>
                  Auto-collected {seasonSummary.collectedCount} reward
                  {seasonSummary.collectedCount === 1 ? '' : 's'}
                  {seasonSummary.collectedGems > 0 ? ` (+${seasonSummary.collectedGems} gems)` : ''} from last season.
                </Text>
              </View>
              <TouchableOpacity onPress={dismissSeasonSummary} accessibilityRole="button" accessibilityLabel="Dismiss season summary">
                <Check size={scale(18)} color={accent.success} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Premium banner */}
          {!pass.premiumOwned && (
            <TouchableOpacity
              style={[styles.premiumBanner, { borderColor: accent.warning }]}
              onPress={onSubscribe}
              accessibilityRole="button"
              accessibilityLabel="Subscribe to unlock the premium track"
            >
              <Crown size={scale(16)} color={accent.warning} />
              <Text style={[styles.premiumText, { color: theme.text }]}>Subscribe to unlock the premium track</Text>
            </TouchableOpacity>
          )}

          {/* Cosmetics — owned items, tap to equip; live preview reflects the loadout */}
          {ownedCosmetics.length > 0 && (
            <View style={[styles.cosmeticsBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.cosmeticsHeader}>
                <Text style={[styles.cosmeticsTitle, { color: theme.text }]}>Cosmetics</Text>
                {/* Live preview: avatar tinted by the theme, ringed by the frame */}
                <View
                  style={[
                    styles.cosmeticPreview,
                    {
                      backgroundColor: equippedTheme ? `${equippedTheme.color}33` : theme.surfaceElevated,
                      borderColor: equippedFrame ? equippedFrame.color : theme.border,
                    },
                  ]}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatchRow}>
                {ownedCosmetics.map((c) => {
                  const isEquipped = equipped?.[c.type] === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.swatchItem}
                      onPress={() => handleToggleCosmetic(c.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${c.name}${isEquipped ? ', equipped' : ''}`}
                    >
                      <View
                        style={[
                          c.type === 'frame' ? styles.swatchFrame : styles.swatchTheme,
                          c.type === 'frame'
                            ? { borderColor: c.color }
                            : { backgroundColor: c.color },
                          isEquipped && { borderColor: accent.success, borderWidth: 2 },
                        ]}
                      >
                        {isEquipped && <Check size={scale(12)} color={accent.success} />}
                      </View>
                      <Text numberOfLines={1} style={[styles.swatchLabel, { color: theme.textSecondary }]}>{c.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Claim all */}
          {claimableCount > 0 && (
            <TouchableOpacity
              style={[styles.claimAll, { backgroundColor: accent.success }]}
              onPress={handleClaimAll}
              accessibilityRole="button"
              accessibilityLabel={`Claim all ${claimableCount} rewards`}
            >
              <Gift size={scale(16)} color={colors.palette.white} />
              <Text style={styles.claimAllText}>Claim all ({claimableCount})</Text>
            </TouchableOpacity>
          )}

          {/* Track headers */}
          <View style={styles.trackHeaderRow}>
            <Text style={[styles.trackHeaderTier, { color: theme.textMuted }]}>Tier</Text>
            <Text style={[styles.trackHeader, { color: theme.textSecondary }]}>Free</Text>
            <Text style={[styles.trackHeader, { color: accent.warning }]}>Premium</Text>
          </View>

          {/* Ladder */}
          <ScrollView style={styles.ladder} contentContainerStyle={styles.ladderContent}>
            {Array.from({ length: MAX_TIER }, (_, i) => i + 1).map((tier) => (
              <View key={tier} style={styles.row}>
                <View style={[styles.tierBadge, { backgroundColor: currentTier >= tier ? colors.palette.primary : theme.surfaceElevated }]}>
                  <Text style={[styles.tierBadgeText, { color: currentTier >= tier ? colors.palette.white : theme.textMuted }]}>{tier}</Text>
                </View>
                {renderCell('free', tier)}
                {renderCell('premium', tier)}
              </View>
            ))}
          </ScrollView>

          {/* Toast */}
          {toast && (
            <Animated.View
              style={[
                styles.toast,
                { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
                {
                  opacity: toastAnim,
                  transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [scale(12), 0] }) }],
                },
              ]}
            >
              <Text style={[styles.toastText, { color: theme.text }]}>{toast}</Text>
            </Animated.View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: responsiveBorderRadius['2xl'],
    borderTopRightRadius: responsiveBorderRadius['2xl'],
    borderWidth: 1,
    paddingHorizontal: scale(16),
    paddingTop: scale(14),
    paddingBottom: scale(24),
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(12) },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  title: { fontSize: fontScale(20), fontWeight: '700' },
  progressBox: { borderWidth: 1, borderRadius: responsiveBorderRadius.lg, padding: scale(12), marginBottom: scale(12) },
  tierText: { fontSize: fontScale(15), fontWeight: '700', marginBottom: scale(8) },
  progressTrack: { height: scale(8), borderRadius: scale(4), overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: scale(4) },
  progressLabel: { fontSize: fontScale(12), marginTop: scale(6) },
  seasonBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: scale(8),
    borderWidth: 1, borderRadius: responsiveBorderRadius.md,
    padding: scale(10), marginBottom: scale(12),
  },
  seasonBannerText: { flex: 1, paddingRight: scale(8) },
  seasonBannerTitle: { fontSize: fontScale(13), fontWeight: '700' },
  seasonBannerDesc: { fontSize: fontScale(12), marginTop: scale(2) },
  premiumBanner: {
    flexDirection: 'row', alignItems: 'center', gap: scale(8),
    borderWidth: 1, borderRadius: responsiveBorderRadius.md,
    padding: scale(10), marginBottom: scale(12),
  },
  premiumText: { fontSize: fontScale(13), fontWeight: '600', flex: 1 },
  cosmeticsBox: { borderWidth: 1, borderRadius: responsiveBorderRadius.md, padding: scale(10), marginBottom: scale(12) },
  cosmeticsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: scale(8) },
  cosmeticsTitle: { fontSize: fontScale(13), fontWeight: '700' },
  cosmeticPreview: { width: scale(28), height: scale(28), borderRadius: scale(14), borderWidth: 2 },
  swatchRow: { gap: scale(12), paddingRight: scale(4) },
  swatchItem: { alignItems: 'center', width: scale(56) },
  swatchFrame: {
    width: scale(32), height: scale(32), borderRadius: scale(16), borderWidth: 3,
    alignItems: 'center', justifyContent: 'center', marginBottom: scale(4),
  },
  swatchTheme: {
    width: scale(32), height: scale(32), borderRadius: scale(8), borderWidth: 1, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center', marginBottom: scale(4),
  },
  swatchLabel: { fontSize: fontScale(10), fontWeight: '600', textAlign: 'center' },
  claimAll: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(8),
    borderRadius: responsiveBorderRadius.md, paddingVertical: scale(10), marginBottom: scale(12),
  },
  claimAllText: { color: '#FFFFFF', fontSize: fontScale(14), fontWeight: '800' },
  trackHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: scale(6) },
  trackHeaderTier: { width: scale(36), fontSize: fontScale(11), fontWeight: '600' },
  trackHeader: { flex: 1, textAlign: 'center', fontSize: fontScale(12), fontWeight: '700' },
  ladder: { flexGrow: 0 },
  ladderContent: { paddingBottom: scale(8) },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: scale(8), gap: scale(8) },
  tierBadge: { width: scale(28), height: scale(28), borderRadius: scale(14), alignItems: 'center', justifyContent: 'center' },
  tierBadgeText: { fontSize: fontScale(12), fontWeight: '700' },
  cell: {
    flex: 1, minHeight: scale(40), borderWidth: 1, borderRadius: responsiveBorderRadius.md,
    paddingHorizontal: scale(8), paddingVertical: scale(6),
    flexDirection: 'row', alignItems: 'center', gap: scale(6),
  },
  cellLabel: { fontSize: fontScale(11), fontWeight: '600', flexShrink: 1 },
  toast: {
    position: 'absolute', bottom: scale(28), alignSelf: 'center',
    borderWidth: 1, borderRadius: responsiveBorderRadius['2xl'],
    paddingHorizontal: scale(16), paddingVertical: scale(8),
  },
  toastText: { fontSize: fontScale(13), fontWeight: '600' },
});
