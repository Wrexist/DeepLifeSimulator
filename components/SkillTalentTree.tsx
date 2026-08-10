import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Gradient from '@/components/ui/Gradient';
// expo-linear-gradient is a TurboModule that has crashed on iOS 26 — use the safe fallback.
const LinearGradient = Gradient;
import {
  AlertCircle,
  Brain,
  Check,
  ChevronDown,
  Crown,
  Eye,
  Flame,
  Lock,
  Shield,
  Sparkles,
  Sword,
  Target,
  X,
  Zap,
} from 'lucide-react-native';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import { useGame, CrimeSkillId } from '@/contexts/GameContext';
import { fontScale, responsiveBorderRadius, responsiveSpacing, scale, verticalScale } from '@/utils/scaling';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.78);

interface TalentNode {
  id: string;
  name: string;
  description: string;
  effect: string;
  pointsCost: number;
  level: number;
  row: number;
  column: number;
  requires?: string[];
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

interface TalentTree {
  name: string;
  description: string;
  accent: [string, string];
  nodes: TalentNode[];
}

const TALENT_TREES: Record<CrimeSkillId, TalentTree> = {
  stealth: {
    name: 'Shadow Arts',
    description: 'Move unseen. Each unlocked talent adds +5% success rate and +10% payment to stealth jobs.',
    accent: ['#475569', '#94A3B8'],
    nodes: [
      { id: 'silentStep', name: 'Silent Step', description: 'Move like a whisper in the wind.', effect: '+10% stealth success rate', pointsCost: 1, level: 1, row: 0, column: 1, icon: Eye },
      { id: 'shadowBlend', name: 'Shadow Blend', description: 'Become one with the darkness.', effect: '+20% stealth success rate', pointsCost: 1, level: 2, row: 1, column: 0, requires: ['silentStep'], icon: Shield },
      { id: 'ghost', name: 'Ghost', description: 'Phase through reality like a specter.', effect: '+30% stealth success rate', pointsCost: 1, level: 3, row: 1, column: 2, requires: ['silentStep'], icon: Sparkles },
      { id: 'nightMaster', name: 'Night Master', description: 'Command the shadows as your domain.', effect: '+40% stealth success rate', pointsCost: 2, level: 4, row: 2, column: 1, requires: ['shadowBlend', 'ghost'], icon: Crown },
      { id: 'shadowLord', name: 'Shadow Lord', description: 'Transcend mortal limitations in darkness.', effect: '+50% stealth success rate', pointsCost: 3, level: 5, row: 3, column: 1, requires: ['nightMaster'], icon: Flame },
    ],
  },
  hacking: {
    name: 'Digital Dominion',
    description: 'Command the network. Each unlocked talent adds +5% success rate and +10% payment to hacking jobs.',
    accent: ['#0369A1', '#38BDF8'],
    nodes: [
      { id: 'bruteForce', name: 'Brute Force', description: 'Unlock the secrets of digital architecture.', effect: '+10% hacking success rate', pointsCost: 1, level: 1, row: 0, column: 1, icon: Brain },
      { id: 'backdoor', name: 'Backdoor', description: 'Dissolve digital barriers like mist.', effect: '+20% hacking success rate', pointsCost: 1, level: 2, row: 1, column: 0, requires: ['bruteForce'], icon: Zap },
      { id: 'quantumLeap', name: 'Quantum Leap', description: 'Exist as pure data in the network.', effect: '+30% hacking success rate', pointsCost: 1, level: 3, row: 1, column: 2, requires: ['bruteForce'], icon: Sparkles },
      { id: 'deepSpoof', name: 'Deep Spoof', description: 'Bend information to your will.', effect: '+40% hacking success rate', pointsCost: 2, level: 4, row: 2, column: 1, requires: ['backdoor', 'quantumLeap'], icon: Crown },
      { id: 'aiOverride', name: 'AI Override', description: 'Transcend the boundaries of reality.', effect: '+50% hacking success rate', pointsCost: 3, level: 5, row: 3, column: 1, requires: ['deepSpoof'], icon: Flame },
    ],
  },
  lockpicking: {
    name: 'Lock Mastery',
    description: 'Open anything. Each unlocked talent adds +5% success rate and +10% payment to lockpicking jobs.',
    accent: ['#EA580C', '#FB923C'],
    nodes: [
      { id: 'quickPick', name: 'Quick Pick', description: 'Feel the tumblers dance to your touch.', effect: '+10% lockpicking success rate', pointsCost: 1, level: 1, row: 0, column: 1, icon: Target },
      { id: 'masterKey', name: 'Master Key', description: 'Forge keys that open any door.', effect: '+20% lockpicking success rate', pointsCost: 1, level: 2, row: 1, column: 0, requires: ['quickPick'], icon: Sword },
      { id: 'phantomTouch', name: 'Phantom Touch', description: 'Become one with the mechanism.', effect: '+30% lockpicking success rate', pointsCost: 1, level: 3, row: 1, column: 2, requires: ['quickPick'], icon: Sparkles },
      { id: 'silentDrill', name: 'Silent Drill', description: 'Command locks to surrender their secrets.', effect: '+40% lockpicking success rate', pointsCost: 2, level: 4, row: 2, column: 1, requires: ['masterKey', 'phantomTouch'], icon: Crown },
      { id: 'molecularKey', name: 'Molecular Key', description: 'Transcend the physical realm of locks.', effect: '+50% lockpicking success rate', pointsCost: 3, level: 5, row: 3, column: 1, requires: ['silentDrill'], icon: Flame },
    ],
  },
};

const SKILL_ICONS: Record<CrimeSkillId, React.ComponentType<{ size?: number; color?: string }>> = {
  stealth: Eye,
  hacking: Brain,
  lockpicking: Target,
};

interface SkillTalentTreeProps {
  skillId: CrimeSkillId;
  visible: boolean;
  onClose: () => void;
}

type NodeStatus = 'unlocked' | 'available' | 'locked';

export default function SkillTalentTree({ skillId, visible, onClose }: SkillTalentTreeProps) {
  const { gameState, unlockCrimeSkillUpgrade } = useGame();
  const [selectedNode, setSelectedNode] = useState<TalentNode | null>(null);

  const tree = TALENT_TREES[skillId];
  // `crimeSkills` (and any individual skill in it) can be absent on a partial
  // save; repairGameState now backfills it, but a modal must not throw in the
  // window before a repaired load lands. 2026-07-28 audit crash-1.
  const skill = gameState.crimeSkills?.[skillId];

  const skillLevel = skill?.level ?? 1;
  const availablePoints = Math.max(0, skillLevel - 1);
  const spentPoints = skill?.upgrades?.length || 0;
  const remainingPoints = availablePoints - spentPoints;
  const SkillIcon = SKILL_ICONS[skillId];

  const isNodeUnlocked = (id: string) => skill?.upgrades?.includes(id) || false;

  const canUnlockNode = (node: TalentNode): boolean => {
    if (isNodeUnlocked(node.id)) return false;
    if (remainingPoints < node.pointsCost) return false;
    if (skillLevel < node.level) return false;
    if (node.requires) return node.requires.every((req) => isNodeUnlocked(req));
    return true;
  };

  const getNodeStatus = (node: TalentNode): NodeStatus => {
    if (isNodeUnlocked(node.id)) return 'unlocked';
    if (canUnlockNode(node)) return 'available';
    return 'locked';
  };

  const sortedNodes = [...tree.nodes].sort((a, b) => (a.level !== b.level ? a.level - b.level : a.row - b.row));

  // Slide-up entrance
  const slideY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSelectedNode(null);
      Animated.parallel([
        Animated.timing(slideY, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else {
      slideY.setValue(SHEET_HEIGHT);
      backdropOpacity.setValue(0);
    }
  }, [visible, slideY, backdropOpacity]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: SHEET_HEIGHT,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => onClose());
  };

  const handleNodePress = (node: TalentNode) => {
    const status = getNodeStatus(node);
    if (status === 'available') {
      setSelectedNode(selectedNode?.id === node.id ? null : node);
    } else if (status === 'locked') {
      setSelectedNode(node);
    } else {
      setSelectedNode(null);
    }
  };

  const handleUnlock = () => {
    if (!selectedNode) return;
    const status = getNodeStatus(selectedNode);
    if (status !== 'available') return;
    const moneyCost = selectedNode.pointsCost * 100;
    unlockCrimeSkillUpgrade(skillId, selectedNode.id, moneyCost, selectedNode.level);
    setSelectedNode(null);
  };

  const renderLockedReason = (node: TalentNode): string => {
    const reasons: string[] = [];
    if (skillLevel < node.level) reasons.push(`Reach Lv ${node.level}`);
    if (node.requires) {
      const missing = node.requires.filter((req) => !isNodeUnlocked(req));
      if (missing.length > 0) {
        const names = missing.map((id) => tree.nodes.find((n) => n.id === id)?.name || id);
        reasons.push(`Unlock ${names.join(' + ')}`);
      }
    }
    if (remainingPoints < node.pointsCost && reasons.length === 0) {
      reasons.push(`Need ${node.pointsCost - remainingPoints} more point${node.pointsCost - remainingPoints > 1 ? 's' : ''}`);
    }
    return reasons.join(' • ');
  };

  if (!visible) return null;

  const accentPrimary = tree.accent[1];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleDismiss} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        </Animated.View>

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
          <BlurViewFallback intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.headerIcon, { borderColor: accentPrimary + '55' }]}>
              <SkillIcon size={scale(20)} color={accentPrimary} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>{tree.name}</Text>
              <Text style={styles.subtitle}>
                {skillId.charAt(0).toUpperCase() + skillId.slice(1)} • Level {skillLevel}
              </Text>
            </View>
            <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn} accessibilityLabel="Close">
              <X size={scale(18)} color="rgba(226, 232, 240, 0.7)" />
            </TouchableOpacity>
          </View>

          {/* Stats strip */}
          <View style={styles.statsStrip}>
            <View style={styles.statCell}>
              <Text style={[styles.statValue, { color: accentPrimary }]}>{remainingPoints}</Text>
              <Text style={styles.statLabel}>points</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{skillLevel}</Text>
              <Text style={styles.statLabel}>level</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{spentPoints} / {tree.nodes.length}</Text>
              <Text style={styles.statLabel}>unlocked</Text>
            </View>
          </View>

          <Text style={styles.description}>{tree.description}</Text>

          {/* Talent list */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={[styles.listContent, selectedNode && getNodeStatus(selectedNode) === 'available' ? { paddingBottom: verticalScale(80) } : undefined]}
            showsVerticalScrollIndicator={false}
          >
            {sortedNodes.map((node) => {
              const status = getNodeStatus(node);
              const isSelected = selectedNode?.id === node.id;
              const Icon = node.icon;
              const tierColor = status === 'unlocked'
                ? accentPrimary
                : status === 'available'
                  ? accentPrimary
                  : 'rgba(226, 232, 240, 0.35)';

              return (
                <TouchableOpacity
                  key={node.id}
                  onPress={() => handleNodePress(node)}
                  activeOpacity={0.85}
                  style={[
                    styles.talentRow,
                    isSelected && { borderColor: accentPrimary + '88' },
                    status === 'available' && !isSelected && { borderColor: accentPrimary + '40' },
                  ]}
                >
                  <View style={[styles.talentIcon, { borderColor: tierColor + '55' }]}>
                    {status === 'locked' ? (
                      <Lock size={scale(16)} color="rgba(226, 232, 240, 0.45)" />
                    ) : (
                      <Icon size={scale(16)} color={tierColor} />
                    )}
                    {status === 'unlocked' ? (
                      <View style={[styles.checkBadge, { backgroundColor: accentPrimary }]}>
                        <Check size={scale(9)} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.talentBody}>
                    <View style={styles.talentHeader}>
                      <Text style={[styles.talentName, status === 'locked' && styles.talentNameLocked]} numberOfLines={1}>
                        {node.name}
                      </Text>
                      <Text style={[styles.talentEffect, status === 'locked' && styles.talentEffectLocked, { color: status === 'locked' ? 'rgba(226, 232, 240, 0.35)' : accentPrimary }]}>
                        {node.effect.replace(/\+(\d+)% .*/, '+$1%')}
                      </Text>
                    </View>
                    <Text
                      style={[styles.talentDesc, status === 'locked' && styles.talentDescLocked]}
                      numberOfLines={2}
                    >
                      {status === 'locked' ? renderLockedReason(node) || node.description : node.description}
                    </Text>
                  </View>

                  <View style={styles.talentRight}>
                    {status === 'unlocked' ? (
                      <Text style={[styles.talentTier, { color: accentPrimary }]}>OWNED</Text>
                    ) : status === 'available' ? (
                      <Text style={[styles.talentTier, { color: accentPrimary }]}>{node.pointsCost} pt</Text>
                    ) : (
                      <Text style={[styles.talentTier, styles.talentTierLocked]}>Lv {node.level}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            {selectedNode && getNodeStatus(selectedNode) === 'locked' ? (
              <View style={styles.lockedInfoBox}>
                <AlertCircle size={scale(14)} color="rgba(251, 191, 36, 0.92)" />
                <Text style={styles.lockedInfoText}>{renderLockedReason(selectedNode) || 'Not yet available.'}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Sticky unlock CTA */}
          {selectedNode && getNodeStatus(selectedNode) === 'available' ? (
            <View style={styles.stickyCta}>
              <BlurViewFallback intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
              <TouchableOpacity activeOpacity={0.85} onPress={handleUnlock} style={styles.unlockBtnWrap}>
                <LinearGradient
                  colors={[tree.accent[0], tree.accent[1]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.unlockBtn}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.unlockBtnTitle}>Unlock {selectedNode.name}</Text>
                    <Text style={styles.unlockBtnMeta}>
                      {selectedNode.pointsCost} pt • ${selectedNode.pointsCost * 100}
                    </Text>
                  </View>
                  <ChevronDown size={scale(18)} color="#FFFFFF" style={{ transform: [{ rotate: '-90deg' }] }} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
  },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderTopLeftRadius: responsiveBorderRadius.xl,
    borderTopRightRadius: responsiveBorderRadius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: scale(40),
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginTop: verticalScale(8),
    marginBottom: verticalScale(8),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingBottom: verticalScale(10),
    gap: scale(12),
  },
  headerIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: fontScale(12),
    color: 'rgba(226, 232, 240, 0.6)',
    marginTop: 1,
  },
  closeBtn: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: responsiveSpacing.md,
    paddingVertical: verticalScale(12),
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontScale(17),
    fontWeight: '700',
    color: '#F8FAFC',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: fontScale(10),
    color: 'rgba(226, 232, 240, 0.55)',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: '60%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  description: {
    fontSize: fontScale(12),
    color: 'rgba(226, 232, 240, 0.65)',
    paddingHorizontal: responsiveSpacing.md,
    paddingTop: verticalScale(10),
    paddingBottom: verticalScale(4),
    lineHeight: fontScale(17),
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: responsiveSpacing.md,
    gap: verticalScale(8),
    paddingBottom: verticalScale(24),
  },
  talentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    padding: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: responsiveBorderRadius.md,
  },
  talentIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(10),
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    bottom: -scale(3),
    right: -scale(3),
    width: scale(14),
    height: scale(14),
    borderRadius: scale(7),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  talentBody: {
    flex: 1,
  },
  talentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: scale(8),
  },
  talentName: {
    flex: 1,
    fontSize: fontScale(14),
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.2,
  },
  talentNameLocked: {
    color: 'rgba(226, 232, 240, 0.55)',
  },
  talentEffect: {
    fontSize: fontScale(12),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  talentEffectLocked: {
    color: 'rgba(226, 232, 240, 0.4)',
  },
  talentDesc: {
    fontSize: fontScale(12),
    color: 'rgba(226, 232, 240, 0.65)',
    marginTop: 2,
    lineHeight: fontScale(16),
  },
  talentDescLocked: {
    color: 'rgba(226, 232, 240, 0.5)',
    fontStyle: 'italic',
  },
  talentRight: {
    alignItems: 'flex-end',
  },
  talentTier: {
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  talentTierLocked: {
    color: 'rgba(226, 232, 240, 0.4)',
  },
  lockedInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    marginTop: verticalScale(4),
  },
  lockedInfoText: {
    flex: 1,
    fontSize: fontScale(12),
    color: 'rgba(251, 191, 36, 0.92)',
    fontWeight: '600',
  },
  stickyCta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: responsiveSpacing.md,
    paddingBottom: verticalScale(20),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  unlockBtnWrap: {
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: verticalScale(12),
    gap: scale(12),
  },
  unlockBtnTitle: {
    fontSize: fontScale(14),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  unlockBtnMeta: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.78)',
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
});
