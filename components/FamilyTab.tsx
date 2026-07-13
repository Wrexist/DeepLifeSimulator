/**
 * Family Tab Component
 * 
 * Comprehensive family management with spouse, children, and family activities
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Platform, View,
 Text,
 StyleSheet,
 ScrollView,
 TouchableOpacity,
 Alert,
 Image,
 Modal } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { safeSettings } from '@/utils/safeGameState';
import {
 Users,
 Heart,
 Baby,
 Gem as Ring,
 Home,
 GraduationCap,
 DollarSign,
 Star,
 Crown,
 Sparkles,
 X,
 ChevronRight,
 Activity,
 TrendingUp,
 BookOpen,
 Stethoscope,
 Trees,
 Blocks,
 PencilRuler,
 Trophy,
 Music,
 HeartHandshake,
 Plane,
 MessageCircleHeart,
 Wallet,
 ShieldAlert,
 Car,
 Brain,
 Dumbbell,
 Smile,
 ShieldCheck,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { scale, fontScale } from '@/utils/scaling';
import { getCharacterImage, getRelationshipImage } from '@/utils/characterImages';
import RingSelectionModal from '@/components/mobile/RingSelectionModal';
import WeddingPlanningModal from '@/components/mobile/WeddingPlanningModal';
import { proposeMarriage } from '@/contexts/game/actions/DatingActions';
import { updateMoney as rawUpdateMoney, applyMoneyDelta } from '@/contexts/game/actions/MoneyActions';
import { updateStats as rawUpdateStats } from '@/contexts/game/actions/StatsActions';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import {
 getActionsForAge,
 getActionById,
 getNurtureStat,
 canPerformParentingAction,
 applyParentingAction,
 describeRejectReason,
 MAX_PARENTING_ACTIONS_PER_WEEK,
 type ParentingAction,
 type NurtureStatKey,
} from '@/lib/parenting';
import type { ChildInfo } from '@/contexts/game/types';
const LinearGradient = LinearGradientFallback;

// Maps a parenting action's icon hint to a concrete lucide component. Falls back
// to Sparkles so an unknown hint can never crash the modal.
const PARENTING_ICONS: Record<string, LucideIcon> = {
 BookOpen,
 Baby,
 Stethoscope,
 Trees,
 Blocks,
 PencilRuler,
 Trophy,
 Music,
 HeartHandshake,
 Plane,
 GraduationCap,
 MessageCircleHeart,
 Wallet,
 ShieldAlert,
 Car,
};

// Nurture stat readout config (label, icon, semantic color). `relationship`
// reuses the child's relationshipScore (bond with the parent).
const NURTURE_DISPLAY: { key: NurtureStatKey; label: string; icon: LucideIcon; color: string }[] = [
 { key: 'intelligence', label: 'Intellect', icon: Brain, color: '#3B82F6' },
 { key: 'health', label: 'Health', icon: Dumbbell, color: '#10B981' },
 { key: 'happiness', label: 'Happiness', icon: Smile, color: '#F59E0B' },
 { key: 'discipline', label: 'Discipline', icon: ShieldCheck, color: '#8B5CF6' },
 { key: 'relationship', label: 'Bond', icon: Heart, color: '#EF4444' },
];

const NURTURE_LABEL_BY_KEY = NURTURE_DISPLAY.reduce(
 (acc, d) => { acc[d.key] = d.label; return acc; },
 {} as Record<NurtureStatKey, string>,
);

// "+2 Intellect, +1 Bond" — compact effect summary for an action button.
function formatParentingEffects(action: ParentingAction): string {
 return (Object.entries(action.effects) as [NurtureStatKey, number][])
 .filter(([, v]) => typeof v === 'number' && v !== 0)
 .map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${NURTURE_LABEL_BY_KEY[k]}`)
 .join(' · ');
}

interface FamilyTabProps {
 onClose?: () => void;
}

function FamilyTab({ onClose }: FamilyTabProps) {
 const {
 gameState,
 setGameState,
 saveGame,
 moveInTogether,
 haveChild,
 } = useGame();

 // R2-A: defensive — this is the family tab, hit on every play session.
 const settings = safeSettings(gameState);
 const [selectedChild, setSelectedChild] = useState<string | null>(null);
 const [showChildModal, setShowChildModal] = useState(false);
 const [showRingModal, setShowRingModal] = useState(false);
 const [showWeddingModal, setShowWeddingModal] = useState(false);
 
 const partner = gameState.relationships?.find(r => r.type === 'partner');
 const spouse = gameState.family?.spouse;
 const children = gameState.family?.children || [];
 const lifeStage = gameState.lifeStage;

 // Calculate family happiness
 const familyHappiness = useMemo(() => {
 let happiness = 0;
 if (spouse) {
 happiness += Math.floor(spouse.relationshipScore / 10);
 }
 children.forEach(child => {
 happiness += Math.floor((child.familyHappiness || 50) / 20);
 });
 return happiness;
 }, [spouse, children]);

 // Calculate total family income
 const familyIncome = useMemo(() => {
 let income = 0;
 if (spouse?.income) {
 income += spouse.income * 7; // Weekly income
 }
 children.forEach(child => {
 if (child.savings && child.age >= 18) {
 income += Math.floor(child.savings * 0.01); // Small contribution
 }
 });
 return income;
 }, [spouse, children]);

 // Check pregnancy status from relationships array (has latest state).
 // Falls back to the partner relationship so engaged/cohabiting couples
 // (who never reach family.spouse) can also start a family.
 const spouseRelationship = useMemo(() =>
 gameState.relationships?.find(r => r.id === spouse?.id && (r.type === 'spouse' || r.type === 'partner')),
 [gameState.relationships, spouse?.id]
 );
 const babyTarget = spouseRelationship ?? partner ?? null;
 const isPregnant = babyTarget?.isPregnant ?? false;
 const pregnancyWeeks = isPregnant && babyTarget?.pregnancyStartWeek != null
 ? (gameState.weeksLived || 0) - babyTarget.pregnancyStartWeek
: 0;
 const pregnancyProgress = Math.min(100, Math.round((pregnancyWeeks / 10) * 100));

 const handlePropose = useCallback(() => {
 if (!partner) return;

 if (partner.relationshipScore < 60) {
 Alert.alert(
 'Not Ready',
 `Your relationship with ${partner.name} needs to be stronger before proposing. Current: ${partner.relationshipScore}/100`,
 [{ text: 'OK' }]
 );
 return;
 }

 setShowRingModal(true);
 }, [partner]);

 const handleProposeWithRing = useCallback((ringId: string) => {
 if (!partner) return;
 setShowRingModal(false);

 const result = proposeMarriage(gameState, setGameState, partner.id, ringId, {
 updateMoney: rawUpdateMoney,
 updateStats: rawUpdateStats,
 });
 saveGame();
 if (result.accepted) {
 Alert.alert('Congratulations! 💍', `${result.message}\n\nNext step: plan the wedding!`);
 } else if (result.success) {
 Alert.alert('Rejected', result.message);
 } else {
 Alert.alert('Cannot Propose', result.message);
 }
 }, [partner, gameState, setGameState, saveGame]);

 const handleMoveIn = useCallback(() => {
 if (!partner) return;

 if (partner.relationshipScore < 60) {
 Alert.alert(
 'Not Ready',
 `You should strengthen your relationship before moving in together. Current: ${partner.relationshipScore}/100`,
 [{ text: 'OK' }]
 );
 return;
 }

 Alert.alert(
 'Move In Together',
 `Would you like to move in with ${partner.name}?`,
 [
 { text: 'Cancel', style: 'cancel' },
 {
 text: 'Move In',
 onPress: () => {
 const result = moveInTogether(partner.id);
 if (result?.success) {
 saveGame();
 Alert.alert('New Home!', result.message);
 } else {
 Alert.alert('Cannot Move In', result?.message || 'Something went wrong.');
 }
 },
 },
 ]
 );
 }, [partner, moveInTogether, saveGame]);

 const handleHaveChild = useCallback(() => {
 if (!babyTarget) {
 Alert.alert('Partner Required', 'You need a partner or spouse before having children.');
 return;
 }

 if (gameState.date.age < 18) {
 Alert.alert('Too Young', 'You must be at least 18 years old to have children.');
 return;
 }

 if (babyTarget.relationshipScore < 70) {
 Alert.alert(
 'Not Ready',
 `Your relationship with ${babyTarget.name} needs to be stronger before starting a family. Current: ${babyTarget.relationshipScore}/100`
 );
 return;
 }

 Alert.alert(
 'Have a Child',
 `Are you and ${babyTarget.name} ready to start or expand your family?`,
 [
 { text: 'Cancel', style: 'cancel' },
 {
 text: 'Try for Baby',
 onPress: () => {
 haveChild(babyTarget.id);
 saveGame();
 },
 },
 ]
 );
 }, [babyTarget, gameState.date.age, haveChild, saveGame]);

 const getLifeStageColor = (stage: string) => {
 switch (stage) {
 case 'child': return ['#60A5FA', '#3B82F6'];
 case 'teen': return ['#A78BFA', '#8B5CF6'];
 case 'adult': return ['#34D399', '#10B981'];
 case 'senior': return ['#FBBF24', '#F59E0B'];
 default: return ['#6B7280', '#4B5563'];
 }
 };

 const getRelationshipStatusColor = (score: number) => {
 if (score >= 80) return '#10B981';
 if (score >= 60) return '#F59E0B';
 if (score >= 40) return '#EF4444';
 return '#6B7280';
 };

 const renderSpouseCard = () => {
 if (!spouse) return null;

 return (
 <View style={[styles.card, settings.darkMode && styles.cardDark]}>
 <LinearGradient
 colors={settings.darkMode ? ['#334155', '#1E293B']: ['#FDF2F8', '#FCE7F3']}
 style={styles.cardGradient}
 >
 <View style={styles.cardHeader}>
 <View style={styles.avatarContainer}>
 <Image
 source={getRelationshipImage(spouse.age || 25, spouse.gender || 'female', 'spouse', spouse.id)}
 style={styles.avatar}
 />
 <View style={styles.statusBadge}>
 <Ring size={12} color="#FFD700" />
 </View>
 </View>
 <View style={styles.cardInfo}>
 <View style={styles.nameRow}>
 <Text style={[styles.cardName, settings.darkMode && styles.textDark]}>
 {spouse.name}
 </Text>
 <Heart size={16} color="#EF4444" fill="#EF4444" />
 </View>
 <Text style={[styles.cardSubtitle, settings.darkMode && styles.textMuted]}>
 Your Spouse {'\u2022'} {spouse.personality}
 </Text>
 <View style={styles.statsRow}>
 <View style={styles.statItem}>
 <Heart size={14} color={getRelationshipStatusColor(spouse.relationshipScore)} />
 <Text style={[styles.statText, { color: getRelationshipStatusColor(spouse.relationshipScore) }]}>
 {spouse.relationshipScore}%
 </Text>
 </View>
 {spouse.income && (
 <View style={styles.statItem}>
 <DollarSign size={14} color="#10B981" />
 <Text style={styles.incomeText}>${spouse.income}/week</Text>
 </View>
 )}
 </View>
 </View>
 </View>

 {/* Pregnancy progress indicator */}
 {isPregnant && (
 <View style={styles.pregnancySection}>
 <View style={styles.pregnancyHeader}>
 <Baby size={16} color="#EC4899" />
 <Text style={[styles.pregnancyTitle, settings.darkMode && styles.textDark]}>
 Expecting a {babyTarget?.pregnancyChildGender === 'male' ? 'Boy': 'Girl'}!
 </Text>
 </View>
 <Text style={[styles.pregnancySubtext, settings.darkMode && styles.textMuted]}>
 {babyTarget?.pregnancyChildName} {'\u2022'} Week {pregnancyWeeks} of 10
 </Text>
 <View style={styles.pregnancyBarContainer}>
 <View style={styles.pregnancyBarBg}>
 <View style={[styles.pregnancyBarFill, { width: `${pregnancyProgress}%` }]} />
 </View>
 <Text style={styles.pregnancyPercent}>{pregnancyProgress}%</Text>
 </View>
 </View>
 )}

 {!isPregnant && (
 <TouchableOpacity
 style={styles.actionButton}
 onPress={handleHaveChild}
 >
 <LinearGradient
 colors={['#EC4899', '#DB2777']}
 style={styles.actionButtonGradient}
 >
 <Baby size={18} color="#FFF" />
 <Text style={styles.actionButtonText}>Try for Baby</Text>
 </LinearGradient>
 </TouchableOpacity>
 )}
 </LinearGradient>
 </View>
 );
 };

 const renderPartnerCard = () => {
 if (!partner || spouse) return null;

 const isEngaged = partner.engagementWeek != null;
 const hasWeddingPlan = Boolean(partner.weddingPlanned);
 const canPropose = partner.relationshipScore >= 60 && !isEngaged;
 const canMoveIn = partner.relationshipScore >= 60 &&!partner.livingTogether;
 const canTryForBaby = !partner.isPregnant
 && partner.relationshipScore >= 70
 && (partner.livingTogether || partner.engagementWeek != null);

 return (
 <View style={[styles.card, settings.darkMode && styles.cardDark]}>
 <LinearGradient
 colors={settings.darkMode ? ['#334155', '#1E293B']: ['#FEF3C7', '#FDE68A']}
 style={styles.cardGradient}
 >
 <View style={styles.cardHeader}>
 <View style={styles.avatarContainer}>
 <Image
 source={getRelationshipImage(partner.age || 25, partner.gender || 'female', 'partner', partner.id)}
 style={styles.avatar}
 />
 </View>
 <View style={styles.cardInfo}>
 <View style={styles.nameRow}>
 <Text style={[styles.cardName, settings.darkMode && styles.textDark]}>
 {partner.name}
 </Text>
 <Heart size={16} color="#F59E0B" />
 </View>
 <Text style={[styles.cardSubtitle, settings.darkMode && styles.textMuted]}>
 {isEngaged ? 'Your Fiancé(e)' : 'Your Partner'} • {partner.personality}
 {partner.livingTogether && ' • Living Together'}
 </Text>
 <View style={styles.progressContainer}>
 <View style={styles.progressBar}>
 <View
 style={[
 styles.progressFill,
 {
 width: `${partner.relationshipScore}%`,
 backgroundColor: getRelationshipStatusColor(partner.relationshipScore),
 },
 ]}
 />
 </View>
 <Text style={[styles.progressText, settings.darkMode && styles.textMuted]}>
 {partner.relationshipScore}% • {isEngaged ? 'Engaged!' : partner.relationshipScore >= 60 ? 'Ready for proposal!': 'Building relationship...'}
 </Text>
 </View>
 </View>
 </View>

 <View style={styles.actionRow}>
 {canMoveIn && (
 <TouchableOpacity
 style={[styles.secondaryButton, { flex: 1, marginRight: scale(8) }]}
 onPress={handleMoveIn}
 >
 <Home size={16} color={settings.darkMode ? '#60A5FA': '#3B82F6'} />
 <Text style={[styles.secondaryButtonText, settings.darkMode && { color: '#60A5FA' }]}>
 Move In
 </Text>
 </TouchableOpacity>
 )}
 {!isEngaged && (
 <TouchableOpacity
 style={[styles.actionButton, { flex: 1, opacity: canPropose ? 1: 0.5 }]}
 onPress={handlePropose}
 disabled={!canPropose}
 >
 <LinearGradient
 colors={canPropose ? ['#8B5CF6', '#7C3AED']: ['#6B7280', '#4B5563']}
 style={styles.actionButtonGradient}
 >
 <Ring size={18} color="#FFF" />
 <Text style={styles.actionButtonText}>Propose</Text>
 </LinearGradient>
 </TouchableOpacity>
 )}
 {isEngaged && !hasWeddingPlan && (
 <TouchableOpacity
 style={[styles.actionButton, { flex: 1 }]}
 onPress={() => setShowWeddingModal(true)}
 >
 <LinearGradient
 colors={['#EC4899', '#DB2777']}
 style={styles.actionButtonGradient}
 >
 <Heart size={18} color="#FFF" />
 <Text style={styles.actionButtonText}>Plan Wedding</Text>
 </LinearGradient>
 </TouchableOpacity>
 )}
 {isEngaged && hasWeddingPlan && (
 <View style={[styles.actionButton, { flex: 1 }]}>
 <LinearGradient
 colors={['#10B981', '#059669']}
 style={styles.actionButtonGradient}
 >
 <Heart size={18} color="#FFF" />
 <Text style={styles.actionButtonText}>Wedding scheduled!</Text>
 </LinearGradient>
 </View>
 )}
 </View>

 {partner.isPregnant && (
 <View style={styles.pregnancySection}>
 <View style={styles.pregnancyHeader}>
 <Baby size={16} color="#EC4899" />
 <Text style={[styles.pregnancyTitle, settings.darkMode && styles.textDark]}>
 Expecting a {partner.pregnancyChildGender === 'male' ? 'Boy': 'Girl'}!
 </Text>
 </View>
 <Text style={[styles.pregnancySubtext, settings.darkMode && styles.textMuted]}>
 {partner.pregnancyChildName} {'•'} Week {pregnancyWeeks} of 10
 </Text>
 <View style={styles.pregnancyBarContainer}>
 <View style={styles.pregnancyBarBg}>
 <View style={[styles.pregnancyBarFill, { width: `${pregnancyProgress}%` }]} />
 </View>
 <Text style={styles.pregnancyPercent}>{pregnancyProgress}%</Text>
 </View>
 </View>
 )}

 {canTryForBaby && (
 <TouchableOpacity
 style={[styles.actionButton, { marginTop: scale(8) }]}
 onPress={handleHaveChild}
 >
 <LinearGradient
 colors={['#EC4899', '#DB2777']}
 style={styles.actionButtonGradient}
 >
 <Baby size={18} color="#FFF" />
 <Text style={styles.actionButtonText}>Try for Baby</Text>
 </LinearGradient>
 </TouchableOpacity>
 )}
 </LinearGradient>
 </View>
 );
 };

 // Perform a parenting action on a child. Costs (money/energy) are charged
 // through the canonical mirror-safe paths and the child's nurture stats +
 // cooldown/weekly-cap bookkeeping are updated — all in ONE atomic setGameState
 // so rapid double-taps can neither double-charge nor double-apply.
 const handleParentingAction = useCallback((childId: string, actionId: string) => {
 const action = getActionById(actionId);
 if (!action) return;

 const snapChild = (gameState.family?.children || []).find(c => c.id === childId);
 if (!snapChild) return;
 const weeksLived = gameState.weeksLived || 0;
 const money = gameState.stats.money || 0;
 const energy = gameState.stats.energy || 0;

 // Pre-check against the current snapshot purely for user feedback.
 const pre = canPerformParentingAction(snapChild, action, weeksLived, money, energy);
 if (!pre.ok) {
 Alert.alert(
 action.label,
 describeRejectReason(pre.reason, { cooldownUntilWeek: pre.cooldownUntilWeek, weeksLived }),
 [{ text: 'OK' }]
 );
 return;
 }

 setGameState(prev => {
 const w = prev.weeksLived || 0;
 const prevChildren = prev.family?.children || [];
 const child = prevChildren.find(c => c.id === childId);
 if (!child) return prev;

 const outcome = applyParentingAction(child, actionId, w, prev.stats.money || 0, prev.stats.energy || 0);
 if (!outcome.ok || !outcome.child) return prev;

 // Money via the canonical mirror-safe path (overdraft-reject + summary).
 let stats = prev.stats;
 let dailySummary = prev.dailySummary;
 if (outcome.moneyDelta && outcome.moneyDelta !== 0) {
 const spend = applyMoneyDelta(prev, outcome.moneyDelta, `Parenting: ${action.label}`);
 if (!spend) return prev; // unaffordable → reject atomically (no negative money)
 stats = spend.stats;
 dailySummary = spend.dailySummary;
 }

 // Energy via stats — never below 0 (eligibility already guaranteed enough).
 const energyDelta = outcome.energyDelta || 0;
 if (energyDelta !== 0) {
 stats = { ...stats, energy: Math.max(0, (stats.energy || 0) + energyDelta) };
 }

 return {
 ...prev,
 stats,
 dailySummary,
 family: {
 ...prev.family,
 children: prevChildren.map(c => (c.id === childId ? outcome.child! : c)),
 },
 };
 });
 saveGame();
 }, [gameState.family?.children, gameState.weeksLived, gameState.stats.money, gameState.stats.energy, setGameState, saveGame]);

 const renderChildCard = (child: any) => {
 const childAge = Math.floor(child.age);
 const isAdult = childAge >= 18;

 return (
 <TouchableOpacity
 key={child.id}
 style={[styles.childCard, settings.darkMode && styles.childCardDark]}
 onPress={() => {
 setSelectedChild(child.id);
 setShowChildModal(true);
 }}
 >
 <View style={styles.childAvatarContainer}>
 <Image
 source={getCharacterImage(childAge, child.gender || 'male', child.id)}
 style={styles.childAvatar}
 />
 {isAdult && (
 <View style={styles.adultBadge}>
 <Star size={12} color="#FFD700" fill="#FFD700" />
 </View>
 )}
 </View>
 <View style={styles.childInfo}>
 <Text style={[styles.childName, settings.darkMode && styles.textDark]}>
 {child.name}
 </Text>
 <Text style={[styles.childAge, settings.darkMode && styles.textMuted]}>
 Age {childAge} • {isAdult ? 'Adult': childAge >= 13 ? 'Teen': 'Child'}
 </Text>
 {child.educationLevel && (
 <View style={styles.childBadge}>
 <GraduationCap size={12} color="#3B82F6" />
 <Text style={styles.childBadgeText}>{child.educationLevel}</Text>
 </View>
 )}
 </View>
 <ChevronRight size={20} color={settings.darkMode ? '#94A3B8': '#6B7280'} />
 </TouchableOpacity>
 );
 };

 // Age-appropriate parenting actions + nurture readout. Renders only while the
 // child is a minor (getActionsForAge returns [] once grown).
 const renderParentingSection = (child: ChildInfo) => {
 const actions = getActionsForAge(child.age);
 if (actions.length === 0) return null;

 const weeksLived = gameState.weeksLived || 0;
 const money = gameState.stats.money || 0;
 const energy = gameState.stats.energy || 0;
 const usedThisWeek = child.parenting?.weekStamp === weeksLived ? (child.parenting?.actionsThisWeek || 0) : 0;
 const remaining = Math.max(0, MAX_PARENTING_ACTIONS_PER_WEEK - usedThisWeek);

 return (
 <View style={[styles.parentingSection, settings.darkMode && styles.parentingSectionDark]}>
 <View style={styles.parentingHeader}>
 <Text style={[styles.sectionTitle, settings.darkMode && styles.textDark, styles.parentingHeaderTitle]}>
 Parenting
 </Text>
 <View style={styles.parentingQuotaBadge}>
 <Text style={styles.parentingQuotaText}>{remaining}/{MAX_PARENTING_ACTIONS_PER_WEEK} this week</Text>
 </View>
 </View>

 {/* Nurture stat readout — reflects the child's growing stats */}
 <View style={styles.nurtureRow}>
 {NURTURE_DISPLAY.map(({ key, label, icon: Icon, color }) => (
 <View key={key} style={styles.nurtureChip}>
 <Icon size={14} color={color} />
 <Text style={[styles.nurtureValue, settings.darkMode && styles.textDark]}>
 {getNurtureStat(child, key)}
 </Text>
 <Text style={[styles.nurtureLabel, settings.darkMode && styles.textMuted]} numberOfLines={1}>
 {label}
 </Text>
 </View>
 ))}
 </View>

 {/* Age-appropriate actions */}
 {actions.map(action => {
 const elig = canPerformParentingAction(child, action, weeksLived, money, energy);
 const Icon = PARENTING_ICONS[action.icon] || Sparkles;
 const disabled = !elig.ok;
 const reasonText = disabled
 ? describeRejectReason(elig.reason, { cooldownUntilWeek: elig.cooldownUntilWeek, weeksLived })
 : '';
 return (
 <TouchableOpacity
 key={action.id}
 style={[
 styles.parentingAction,
 settings.darkMode && styles.parentingActionDark,
 disabled && styles.parentingActionDisabled,
 ]}
 onPress={() => handleParentingAction(child.id, action.id)}
 disabled={disabled}
 activeOpacity={0.7}
 >
 <View style={[styles.parentingActionIcon, settings.darkMode && styles.parentingActionIconDark]}>
 <Icon size={20} color={settings.darkMode ? '#60A5FA' : '#3B82F6'} />
 </View>
 <View style={styles.parentingActionBody}>
 <Text style={[styles.parentingActionLabel, settings.darkMode && styles.textDark]}>
 {action.label}
 </Text>
 <Text style={[styles.parentingActionDesc, settings.darkMode && styles.textMuted]} numberOfLines={2}>
 {action.description}
 </Text>
 <View style={styles.parentingActionMetaRow}>
 {action.moneyCost > 0 && (
 <View style={styles.parentingCostChip}>
 <DollarSign size={11} color="#10B981" />
 <Text style={[styles.parentingCostText, { color: '#059669' }]}>{action.moneyCost.toLocaleString()}</Text>
 </View>
 )}
 {action.energyCost > 0 && (
 <View style={styles.parentingCostChip}>
 <Activity size={11} color="#F59E0B" />
 <Text style={[styles.parentingCostText, { color: '#B45309' }]}>{action.energyCost}</Text>
 </View>
 )}
 <Text style={[styles.parentingEffectText, settings.darkMode && { color: '#93C5FD' }]} numberOfLines={1}>
 {formatParentingEffects(action)}
 </Text>
 </View>
 {disabled && !!reasonText && (
 <Text style={styles.parentingReason}>{reasonText}</Text>
 )}
 </View>
 </TouchableOpacity>
 );
 })}
 </View>
 );
 };

 const renderChildModal = () => {
 const child = children.find(c => c.id === selectedChild);
 if (!child) return null;

 const childAge = Math.floor(child.age);

 return (
 <Modal
 visible={showChildModal}
 transparent
 animationType="slide"
 onRequestClose={() => setShowChildModal(false)}
 >
 <View style={styles.modalOverlay}>
 <View style={[styles.modalContent, settings.darkMode && styles.modalContentDark]}>
 <View style={styles.modalHeader}>
 <Text style={[styles.modalTitle, settings.darkMode && styles.textDark]}>
 {child.name}
 </Text>
 <TouchableOpacity onPress={() => setShowChildModal(false)}>
 <X size={24} color={settings.darkMode ? '#F9FAFB': '#0F172A'} />
 </TouchableOpacity>
 </View>

 <ScrollView style={styles.modalScroll}>
 <View style={styles.childProfileHeader}>
 <Image
 source={getCharacterImage(childAge, child.gender || 'male', child.id)}
 style={styles.childProfileAvatar}
 />
 <View style={styles.childProfileInfo}>
 <Text style={[styles.childProfileName, settings.darkMode && styles.textDark]}>
 {child.name}
 </Text>
 <Text style={[styles.childProfileAge, settings.darkMode && styles.textMuted]}>
 Age {childAge} • {child.gender === 'male' ? 'Son': 'Daughter'}
 </Text>
 </View>
 </View>

 <View style={styles.childStatsGrid}>
 <View style={[styles.childStatCard, settings.darkMode && styles.childStatCardDark]}>
 <Heart size={20} color="#EF4444" />
 <Text style={[styles.childStatValue, settings.darkMode && styles.textDark]}>
 {child.happiness ?? child.familyHappiness ?? 50}%
 </Text>
 <Text style={[styles.childStatLabel, settings.darkMode && styles.textMuted]}>
 Happiness
 </Text>
 </View>
 <View style={[styles.childStatCard, settings.darkMode && styles.childStatCardDark]}>
 <GraduationCap size={20} color="#3B82F6" />
 <Text style={[styles.childStatValue, settings.darkMode && styles.textDark]}>
 {child.educationLevel || 'None'}
 </Text>
 <Text style={[styles.childStatLabel, settings.darkMode && styles.textMuted]}>
 Education
 </Text>
 </View>
 {childAge >= 18 && (
 <>
 <View style={[styles.childStatCard, settings.darkMode && styles.childStatCardDark]}>
 <DollarSign size={20} color="#10B981" />
 <Text style={[styles.childStatValue, settings.darkMode && styles.textDark]}>
 ${(child.savings || 0).toLocaleString()}
 </Text>
 <Text style={[styles.childStatLabel, settings.darkMode && styles.textMuted]}>
 Savings
 </Text>
 </View>
 <View style={[styles.childStatCard, settings.darkMode && styles.childStatCardDark]}>
 <TrendingUp size={20} color="#8B5CF6" />
 <Text style={[styles.childStatValue, settings.darkMode && styles.textDark]}>
 {child.careerPath || 'Seeking'}
 </Text>
 <Text style={[styles.childStatLabel, settings.darkMode && styles.textMuted]}>
 Career
 </Text>
 </View>
 </>
 )}
 </View>

 {renderParentingSection(child)}

 {child.geneticTraits && child.geneticTraits.length > 0 && (
 <View style={[styles.traitsSection, settings.darkMode && styles.traitsSectionDark]}>
 <Text style={[styles.sectionTitle, settings.darkMode && styles.textDark]}>
 Genetic Traits
 </Text>
 <View style={styles.traitsContainer}>
 {child.geneticTraits.map((trait: string, index: number) => (
 <View key={index} style={styles.traitBadge}>
 <Sparkles size={12} color="#F59E0B" />
 <Text style={styles.traitText}>{trait}</Text>
 </View>
 ))}
 </View>
 </View>
 )}

 {child.isHeirEligible && (
 <View style={styles.heirBanner}>
 <LinearGradient
 colors={['#F59E0B', '#D97706']}
 style={styles.heirBannerGradient}
 >
 <Crown size={24} color="#FFF" />
 <Text style={styles.heirBannerText}>Eligible Heir</Text>
 </LinearGradient>
 </View>
 )}
 </ScrollView>
 </View>
 </View>
 </Modal>
 );
 };

 return (
 <View style={[styles.container, settings.darkMode && styles.containerDark]}>
 <LinearGradient
 colors={settings.darkMode ? ['#1E293B', '#0F172A']: ['#FFFFFF', '#F8FAFC']}
 style={styles.gradient}
 >
 {/* Header */}
 <View style={styles.header}>
 <View style={styles.headerContent}>
 <Users size={28} color={settings.darkMode ? '#60A5FA': '#3B82F6'} />
 <Text style={[styles.headerTitle, settings.darkMode && styles.textDark]}>
 Family
 </Text>
 </View>
 {onClose && (
 <TouchableOpacity onPress={onClose} style={styles.closeButton}>
 <X size={24} color={settings.darkMode ? '#F9FAFB': '#0F172A'} />
 </TouchableOpacity>
 )}
 </View>

 {/* Life Stage Badge */}
 <View style={styles.lifeStageBadge}>
 <LinearGradient
 colors={getLifeStageColor(lifeStage)}
 style={styles.lifeStageBadgeGradient}
 start={{ x: 0, y: 0 }}
 end={{ x: 1, y: 0 }}
 >
 <Activity size={16} color="#FFF" />
 <Text style={styles.lifeStageText}>
 {lifeStage.charAt(0).toUpperCase() + lifeStage.slice(1)} • Age {Math.floor(gameState.date.age)}
 </Text>
 </LinearGradient>
 </View>

 {/* Family Stats Summary */}
 <View style={[styles.statsCard, settings.darkMode && styles.statsCardDark]}>
 <View style={styles.statsItem}>
 <Heart size={20} color="#EF4444" />
 <Text style={[styles.statsValue, settings.darkMode && styles.textDark]}>
 +{familyHappiness}
 </Text>
 <Text style={[styles.statsLabel, settings.darkMode && styles.textMuted]}>
 Family Happiness
 </Text>
 </View>
 <View style={styles.statsDivider} />
 <View style={styles.statsItem}>
 <Users size={20} color="#3B82F6" />
 <Text style={[styles.statsValue, settings.darkMode && styles.textDark]}>
 {children.length}
 </Text>
 <Text style={[styles.statsLabel, settings.darkMode && styles.textMuted]}>
 Children
 </Text>
 </View>
 <View style={styles.statsDivider} />
 <View style={styles.statsItem}>
 <DollarSign size={20} color="#10B981" />
 <Text style={[styles.statsValue, settings.darkMode && styles.textDark]}>
 ${familyIncome}
 </Text>
 <Text style={[styles.statsLabel, settings.darkMode && styles.textMuted]}>
 Family Income/wk
 </Text>
 </View>
 </View>

 <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
 {/* Spouse Section */}
 {spouse && (
 <View style={styles.section}>
 <Text style={[styles.sectionTitle, settings.darkMode && styles.textDark]}>
 Spouse
 </Text>
 {renderSpouseCard()}
 </View>
 )}

 {/* Partner Section */}
 {partner &&!spouse && (
 <View style={styles.section}>
 <Text style={[styles.sectionTitle, settings.darkMode && styles.textDark]}>
 Partner
 </Text>
 {renderPartnerCard()}
 </View>
 )}

 {/* No Relationship State */}
 {!partner &&!spouse && (
 <View style={[styles.emptyState, settings.darkMode && styles.emptyStateDark]}>
 <Heart size={48} color={settings.darkMode ? '#475569': '#D1D5DB'} />
 <Text style={[styles.emptyStateTitle, settings.darkMode && styles.textDark]}>
 No Partner Yet
 </Text>
 <Text style={[styles.emptyStateText, settings.darkMode && styles.textMuted]}>
 Use the Dating app to find someone special!
 </Text>
 </View>
 )}

 {/* Children Section */}
 {children.length > 0 && (
 <View style={styles.section}>
 <Text style={[styles.sectionTitle, settings.darkMode && styles.textDark]}>
 Children ({children.length})
 </Text>
 {children.map(renderChildCard)}
 </View>
 )}

 {/* Empty Children State */}
 {spouse && children.length === 0 && (
 <View style={[styles.emptyChildrenState, settings.darkMode && styles.emptyChildrenStateDark]}>
 <Baby size={32} color={settings.darkMode ? '#475569': '#D1D5DB'} />
 <Text style={[styles.emptyChildrenText, settings.darkMode && styles.textMuted]}>
 No children yet. Start your family!
 </Text>
 </View>
 )}
 </ScrollView>

 {renderChildModal()}

 {partner && (
 <RingSelectionModal
 visible={showRingModal}
 onClose={() => setShowRingModal(false)}
 partnerName={partner.name}
 relationshipScore={partner.relationshipScore}
 datesCount={partner.datesCount || 0}
 livingTogether={partner.livingTogether || false}
 onPropose={handleProposeWithRing}
 />
 )}
 {partner && (
 <WeddingPlanningModal
 visible={showWeddingModal}
 onClose={() => setShowWeddingModal(false)}
 partnerId={partner.id}
 partnerName={partner.name}
 />
 )}
 </LinearGradient>
 </View>
 );
}

const styles = StyleSheet.create({
 container: {
 flex: 1,
 },
 containerDark: {
 backgroundColor: '#0F172A',
 },
 gradient: {
 flex: 1,
 },
 header: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 paddingHorizontal: scale(16),
 paddingTop: scale(16),
 paddingBottom: scale(12),
 },
 headerContent: {
 flexDirection: 'row',
 alignItems: 'center',
 },
 headerTitle: {
 fontSize: fontScale(24),
 fontWeight: 'bold',
 marginLeft: scale(12),
 color: '#0F172A',
 },
 closeButton: {
 padding: scale(8),
 },
 lifeStageBadge: {
 marginHorizontal: scale(16),
 marginBottom: scale(12),
 borderRadius: scale(12),
 overflow: 'hidden',
 },
 lifeStageBadgeGradient: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'center',
 paddingVertical: scale(10),
 paddingHorizontal: scale(16),
 },
 lifeStageText: {
 color: '#FFF',
 fontSize: fontScale(14),
 fontWeight: '600',
 marginLeft: scale(8),
 },
 statsCard: {
 flexDirection: 'row',
 marginHorizontal: scale(16),
 marginBottom: scale(16),
 backgroundColor: '#FFF',
 borderRadius: scale(12),
 padding: scale(16),
...Platform.select({
 web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)' } as any,
 default: {
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 2 },
 shadowOpacity: 0.1,
 shadowRadius: 4,
 },
 }),
 elevation: 3,
 },
 statsCardDark: {
 backgroundColor: '#1E293B',
 },
 statsItem: {
 flex: 1,
 alignItems: 'center',
 },
 statsDivider: {
 width: 1,
 backgroundColor: '#475569',
 marginHorizontal: scale(8),
 },
 statsValue: {
 fontSize: fontScale(18),
 fontWeight: 'bold',
 color: '#0F172A',
 marginTop: scale(4),
 },
 statsLabel: {
 fontSize: fontScale(11),
 color: '#6B7280',
 marginTop: scale(2),
 textAlign: 'center',
 },
 content: {
 flex: 1,
 paddingHorizontal: scale(16),
 },
 section: {
 marginBottom: scale(20),
 },
 sectionTitle: {
 fontSize: fontScale(18),
 fontWeight: '600',
 color: '#0F172A',
 marginBottom: scale(12),
 },
 card: {
 borderRadius: scale(16),
 overflow: 'hidden',
...Platform.select({
 web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)' } as any,
 default: {
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 2 },
 shadowOpacity: 0.1,
 shadowRadius: 4,
 },
 }),
 elevation: 3,
 },
 cardDark: {
 borderWidth: 1,
 borderColor: '#334155',
 },
 cardGradient: {
 padding: scale(16),
 },
 cardHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 marginBottom: scale(12),
 },
 avatarContainer: {
 position: 'relative',
 },
 avatar: {
 width: scale(64),
 height: scale(64),
 borderRadius: scale(32),
 borderWidth: 3,
 borderColor: '#FFF',
 },
 statusBadge: {
 position: 'absolute',
 bottom: 0,
 right: 0,
 backgroundColor: '#FFF',
 borderRadius: scale(10),
 padding: scale(4),
 },
 cardInfo: {
 flex: 1,
 marginLeft: scale(12),
 },
 nameRow: {
 flexDirection: 'row',
 alignItems: 'center',
 },
 cardName: {
 fontSize: fontScale(18),
 fontWeight: 'bold',
 color: '#0F172A',
 marginRight: scale(8),
 },
 cardSubtitle: {
 fontSize: fontScale(13),
 color: '#6B7280',
 marginTop: scale(2),
 },
 statsRow: {
 flexDirection: 'row',
 alignItems: 'center',
 marginTop: scale(8),
 },
 statItem: {
 flexDirection: 'row',
 alignItems: 'center',
 marginRight: scale(16),
 },
 statText: {
 fontSize: fontScale(13),
 fontWeight: '600',
 marginLeft: scale(4),
 },
 incomeText: {
 fontSize: fontScale(13),
 color: '#10B981',
 fontWeight: '600',
 marginLeft: scale(4),
 },
 progressContainer: {
 marginTop: scale(8),
 },
 progressBar: {
 height: scale(6),
 backgroundColor: 'rgba(0,0,0,0.1)',
 borderRadius: scale(3),
 overflow: 'hidden',
 },
 progressFill: {
 height: '100%',
 borderRadius: scale(3),
 },
 progressText: {
 fontSize: fontScale(11),
 color: '#6B7280',
 marginTop: scale(4),
 },
 actionRow: {
 flexDirection: 'row',
 },
 actionButton: {
 borderRadius: scale(10),
 overflow: 'hidden',
 },
 actionButtonGradient: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'center',
 paddingVertical: scale(12),
 paddingHorizontal: scale(20),
 },
 actionButtonText: {
 color: '#FFF',
 fontSize: fontScale(14),
 fontWeight: '600',
 marginLeft: scale(8),
 },
 secondaryButton: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'center',
 paddingVertical: scale(12),
 paddingHorizontal: scale(16),
 backgroundColor: 'rgba(59, 130, 246, 0.1)',
 borderRadius: scale(10),
 borderWidth: 1,
 borderColor: '#3B82F6',
 },
 secondaryButtonText: {
 color: '#3B82F6',
 fontSize: fontScale(14),
 fontWeight: '600',
 marginLeft: scale(6),
 },
 childCard: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: '#FFF',
 borderRadius: scale(12),
 padding: scale(12),
 marginBottom: scale(8),
...Platform.select({
 web: { boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)' } as any,
 default: {
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.05,
 shadowRadius: 2,
 },
 }),
 elevation: 1,
 },
 childCardDark: {
 backgroundColor: '#1E293B',
 borderWidth: 1,
 borderColor: '#334155',
 },
 childAvatarContainer: {
 position: 'relative',
 },
 childAvatar: {
 width: scale(48),
 height: scale(48),
 borderRadius: scale(24),
 },
 adultBadge: {
 position: 'absolute',
 bottom: -2,
 right: -2,
 backgroundColor: '#FFF',
 borderRadius: scale(8),
 padding: scale(2),
 },
 childInfo: {
 flex: 1,
 marginLeft: scale(12),
 },
 childName: {
 fontSize: fontScale(16),
 fontWeight: '600',
 color: '#0F172A',
 },
 childAge: {
 fontSize: fontScale(13),
 color: '#6B7280',
 marginTop: scale(2),
 },
 childBadge: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: 'rgba(59, 130, 246, 0.1)',
 paddingHorizontal: scale(8),
 paddingVertical: scale(2),
 borderRadius: scale(4),
 marginTop: scale(4),
 alignSelf: 'flex-start',
 },
 childBadgeText: {
 fontSize: fontScale(10),
 color: '#3B82F6',
 marginLeft: scale(4),
 fontWeight: '500',
 },
 emptyState: {
 alignItems: 'center',
 justifyContent: 'center',
 padding: scale(40),
 backgroundColor: '#F9FAFB',
 borderRadius: scale(16),
 marginVertical: scale(20),
 },
 emptyStateDark: {
 backgroundColor: '#1E293B',
 },
 emptyStateTitle: {
 fontSize: fontScale(18),
 fontWeight: '600',
 color: '#0F172A',
 marginTop: scale(16),
 },
 emptyStateText: {
 fontSize: fontScale(14),
 color: '#6B7280',
 marginTop: scale(8),
 textAlign: 'center',
 },
 emptyChildrenState: {
 alignItems: 'center',
 padding: scale(24),
 backgroundColor: '#F9FAFB',
 borderRadius: scale(12),
 },
 emptyChildrenStateDark: {
 backgroundColor: '#1E293B',
 },
 emptyChildrenText: {
 fontSize: fontScale(14),
 color: '#6B7280',
 marginTop: scale(8),
 textAlign: 'center',
 },
 modalOverlay: {
 flex: 1,
 backgroundColor: 'rgba(0,0,0,0.5)',
 justifyContent: 'center',
 alignItems: 'center',
 padding: scale(20),
 },
 modalContent: {
 width: '100%',
 maxWidth: scale(400),
 maxHeight: '80%',
 backgroundColor: '#FFF',
 borderRadius: scale(20),
 overflow: 'hidden',
 ...getPlatformShadows(6, 0.25, 4, 14),
 },
 modalContentDark: {
 backgroundColor: '#1E293B',
 },
 modalHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 padding: scale(16),
 borderBottomWidth: 1,
 borderBottomColor: '#475569',
 },
 modalTitle: {
 fontSize: fontScale(20),
 fontWeight: 'bold',
 color: '#0F172A',
 },
 modalScroll: {
 padding: scale(16),
 },
 childProfileHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 marginBottom: scale(20),
 },
 childProfileAvatar: {
 width: scale(80),
 height: scale(80),
 borderRadius: scale(40),
 borderWidth: 3,
 borderColor: '#3B82F6',
 },
 childProfileInfo: {
 marginLeft: scale(16),
 },
 childProfileName: {
 fontSize: fontScale(22),
 fontWeight: 'bold',
 color: '#0F172A',
 },
 childProfileAge: {
 fontSize: fontScale(14),
 color: '#6B7280',
 marginTop: scale(4),
 },
 childStatsGrid: {
 flexDirection: 'row',
 flexWrap: 'wrap',
 marginHorizontal: scale(-4),
 },
 childStatCard: {
 width: '48%',
 backgroundColor: '#F3F4F6',
 borderRadius: scale(12),
 padding: scale(12),
 alignItems: 'center',
 margin: scale(4),
 },
 childStatCardDark: {
 backgroundColor: '#334155',
 },
 childStatValue: {
 fontSize: fontScale(16),
 fontWeight: 'bold',
 color: '#0F172A',
 marginTop: scale(6),
 textAlign: 'center',
 },
 childStatLabel: {
 fontSize: fontScale(11),
 color: '#6B7280',
 marginTop: scale(2),
 textAlign: 'center',
 },
 traitsSection: {
 marginTop: scale(16),
 padding: scale(12),
 backgroundColor: '#F3F4F6',
 borderRadius: scale(12),
 },
 traitsSectionDark: {
 backgroundColor: '#334155',
 },
 traitsContainer: {
 flexDirection: 'row',
 flexWrap: 'wrap',
 marginTop: scale(8),
 },
 traitBadge: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: '#FEF3C7',
 paddingHorizontal: scale(10),
 paddingVertical: scale(4),
 borderRadius: scale(12),
 marginRight: scale(8),
 marginBottom: scale(4),
 },
 traitText: {
 fontSize: fontScale(12),
 color: '#92400E',
 marginLeft: scale(4),
 fontWeight: '500',
 },
 heirBanner: {
 marginTop: scale(16),
 borderRadius: scale(12),
 overflow: 'hidden',
 },
 heirBannerGradient: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'center',
 paddingVertical: scale(14),
 },
 heirBannerText: {
 color: '#FFF',
 fontSize: fontScale(16),
 fontWeight: 'bold',
 marginLeft: scale(8),
 },
 textDark: {
 color: '#F9FAFB',
 },
 textMuted: {
 color: '#94A3B8',
 },
 // ── Parenting section ─────────────────────────────────────────────────
 parentingSection: {
 marginTop: scale(16),
 padding: scale(12),
 backgroundColor: '#F3F4F6',
 borderRadius: scale(12),
 },
 parentingSectionDark: {
 backgroundColor: '#334155',
 },
 parentingHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 marginBottom: scale(10),
 },
 parentingHeaderTitle: {
 marginBottom: 0,
 },
 parentingQuotaBadge: {
 backgroundColor: 'rgba(59, 130, 246, 0.12)',
 borderRadius: scale(10),
 paddingHorizontal: scale(8),
 paddingVertical: scale(3),
 },
 parentingQuotaText: {
 fontSize: fontScale(11),
 fontWeight: '600',
 color: '#3B82F6',
 },
 nurtureRow: {
 flexDirection: 'row',
 justifyContent: 'space-between',
 marginBottom: scale(12),
 },
 nurtureChip: {
 flex: 1,
 alignItems: 'center',
 paddingVertical: scale(4),
 },
 nurtureValue: {
 fontSize: fontScale(14),
 fontWeight: 'bold',
 color: '#0F172A',
 marginTop: scale(2),
 },
 nurtureLabel: {
 fontSize: fontScale(9),
 color: '#6B7280',
 marginTop: scale(1),
 },
 parentingAction: {
 flexDirection: 'row',
 alignItems: 'flex-start',
 backgroundColor: '#FFFFFF',
 borderRadius: scale(12),
 padding: scale(10),
 marginBottom: scale(8),
 borderWidth: 1,
 borderColor: 'rgba(148, 163, 184, 0.2)',
 },
 parentingActionDark: {
 backgroundColor: '#1E293B',
 borderColor: 'rgba(148, 163, 184, 0.25)',
 },
 parentingActionDisabled: {
 opacity: 0.5,
 },
 parentingActionIcon: {
 width: scale(38),
 height: scale(38),
 borderRadius: scale(10),
 backgroundColor: '#EFF6FF',
 alignItems: 'center',
 justifyContent: 'center',
 marginRight: scale(10),
 },
 parentingActionIconDark: {
 backgroundColor: 'rgba(96, 165, 250, 0.15)',
 },
 parentingActionBody: {
 flex: 1,
 },
 parentingActionLabel: {
 fontSize: fontScale(14),
 fontWeight: '700',
 color: '#0F172A',
 },
 parentingActionDesc: {
 fontSize: fontScale(11),
 color: '#6B7280',
 marginTop: scale(1),
 },
 parentingActionMetaRow: {
 flexDirection: 'row',
 alignItems: 'center',
 flexWrap: 'wrap',
 marginTop: scale(6),
 gap: scale(8),
 },
 parentingCostChip: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: scale(2),
 },
 parentingCostText: {
 fontSize: fontScale(11),
 fontWeight: '600',
 },
 parentingEffectText: {
 fontSize: fontScale(11),
 fontWeight: '600',
 color: '#3B82F6',
 flexShrink: 1,
 },
 parentingReason: {
 fontSize: fontScale(10),
 color: '#DC2626',
 marginTop: scale(4),
 fontWeight: '500',
 },
 pregnancySection: {
 marginTop: scale(12),
 padding: scale(12),
 backgroundColor: 'rgba(236, 72, 153, 0.08)',
 borderRadius: scale(12),
 borderWidth: 1,
 borderColor: 'rgba(255, 255, 255, 0.2)',
 },
 pregnancyHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: scale(8),
 marginBottom: scale(4),
 },
 pregnancyTitle: {
 fontSize: fontScale(15),
 fontWeight: '700',
 color: '#EC4899',
 },
 pregnancySubtext: {
 fontSize: fontScale(12),
 color: '#6B7280',
 marginBottom: scale(8),
 },
 pregnancyBarContainer: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: scale(8),
 },
 pregnancyBarBg: {
 flex: 1,
 height: scale(8),
 backgroundColor: 'rgba(236, 72, 153, 0.15)',
 borderRadius: scale(4),
 overflow: 'hidden',
 },
 pregnancyBarFill: {
 height: '100%',
 backgroundColor: '#EC4899',
 borderRadius: scale(4),
 },
 pregnancyPercent: {
 fontSize: fontScale(12),
 fontWeight: '600',
 color: '#EC4899',
 minWidth: scale(32),
 textAlign: 'right',
 },
});

export default React.memo(FamilyTab);

