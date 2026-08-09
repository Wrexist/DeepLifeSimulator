/**
 * Family Tab — spouse / partner, children, pregnancy and the parenting loop.
 *
 * Opened as a `presentationStyle="fullScreen"` Modal from `app/(tabs)/life.tsx`,
 * which is the whole reason this file has to think about safe areas at all:
 *
 * PLAYER REPORT (2026-08-05, with screenshot): "it's too far up, can't press
 * close". A full-screen RN Modal is not inset by the tab navigator, so the old
 * `paddingTop: scale(16)` drew the header from y=0 — the title under the clock
 * and the close button under the battery indicator / Dynamic Island. The
 * control itself was already the right SIZE (the 2026-08-01 accessibility pass
 * gave it `minTouchTargetStyle` + `hitSlopToMinTarget`); it was in the wrong
 * place. A 44pt target behind the system status bar is still unhittable.
 *
 * Dark-first: light mode was removed from the game (`saveValidation` coerces
 * `settings.darkMode` back to `true`), so the old `darkMode && styles.xDark`
 * pairs were dead branches. Colours come from `lib/config/theme.ts`.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
 View,
 Text,
 StyleSheet,
 ScrollView,
 TouchableOpacity,
 Alert,
 Image,
 Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Gradient from '@/components/ui/Gradient';
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
 Lock,
 Smile,
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
 ShieldCheck,
 Activity,
 Search,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { householdPartnerIncome } from '@/contexts/game/actions/weekly/applyIncome';
import { scale, fontScale } from '@/utils/scaling';
import { CLOSE_BUTTON_A11Y, hitSlopToMinTarget, minTouchTargetStyle } from '@/utils/touchTargets';
import { getCharacterImage, getRelationshipImage } from '@/utils/characterImages';
import RingSelectionModal from '@/components/mobile/RingSelectionModal';
import WeddingPlanningModal from '@/components/mobile/WeddingPlanningModal';
import { proposeMarriage } from '@/contexts/game/actions/DatingActions';
import { updateMoney as rawUpdateMoney, applyMoneyDelta } from '@/contexts/game/actions/MoneyActions';
import { updateStats as rawUpdateStats } from '@/contexts/game/actions/StatsActions';
import { colors, accent } from '@/lib/config/theme';
import { getLifeStage } from '@/lib/config/gameConstants';
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
import type { ChildInfo, Relationship } from '@/contexts/game/types';
const LinearGradient = Gradient;

const c = colors.dark;

/**
 * Relationship gates, quoted from the action modules that enforce them so the
 * hint on a disabled button can never drift from what actually happens:
 * `DatingActions.proposeMarriage` (>= 60), `SocialActions.moveInTogether`
 * (>= 60) and `handleHaveChild` below (>= 70, adult, committed).
 */
const SCORE_TO_MOVE_IN = 60;
const SCORE_TO_PROPOSE = 60;
const SCORE_TO_TRY_FOR_BABY = 70;
const AGE_TO_TRY_FOR_BABY = 18;

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
 { key: 'intelligence', label: 'Intellect', icon: Brain, color: accent.info },
 { key: 'health', label: 'Health', icon: Dumbbell, color: accent.success },
 { key: 'happiness', label: 'Happiness', icon: Smile, color: accent.warning },
 { key: 'discipline', label: 'Discipline', icon: ShieldCheck, color: '#8B5CF6' },
 { key: 'relationship', label: 'Bond', icon: Heart, color: accent.danger },
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

function bondColor(score: number): string {
 if (score >= 80) return accent.success;
 if (score >= 60) return accent.warning;
 if (score >= 40) return accent.danger;
 return c.textMuted;
}

interface FamilyTabProps {
 onClose?: () => void;
}

/**
 * One always-visible action row.
 *
 * The old card RENDERED NOTHING for an action the player had not unlocked yet
 * (`canMoveIn`, `canTryForBaby` were plain `&&` guards) and drew "Propose" at
 * half opacity with no explanation. Neither shape tells the player what to do
 * next. Every action is now drawn, and a locked one states its own requirement
 * — the pattern the parenting list further down this file already used.
 */
function ActionRow({
 icon: Icon,
 label,
 hint,
 tone,
 gradient,
 onPress,
 lockedReason,
}: {
 icon: LucideIcon;
 label: string;
 hint?: string;
 tone: 'primary' | 'secondary';
 gradient?: readonly [string, string];
 onPress?: () => void;
 lockedReason?: string | null;
}) {
 const locked = Boolean(lockedReason);
 const body = (
 <View style={styles.actionRowBody}>
 <View style={[styles.actionRowIcon, tone === 'primary' && styles.actionRowIconPrimary]}>
 {locked ? <Lock size={scale(16)} color={c.textMuted} /> : <Icon size={scale(18)} color={tone === 'primary' ? '#FFF' : accent.info} />}
 </View>
 <View style={styles.actionRowText}>
 <Text style={[styles.actionRowLabel, tone === 'primary' && !locked && styles.actionRowLabelPrimary]}>
 {label}
 </Text>
 {!!(lockedReason || hint) && (
 <Text style={[styles.actionRowHint, locked && styles.actionRowHintLocked]} numberOfLines={2}>
 {lockedReason || hint}
 </Text>
 )}
 </View>
 {!locked && <ChevronRight size={scale(18)} color={tone === 'primary' ? 'rgba(255,255,255,0.85)' : c.textMuted} />}
 </View>
 );

 return (
 <TouchableOpacity
 style={[styles.actionRow, locked && styles.actionRowLocked]}
 onPress={onPress}
 disabled={locked || !onPress}
 activeOpacity={0.75}
 accessibilityRole="button"
 accessibilityLabel={label}
 accessibilityHint={lockedReason || hint}
 accessibilityState={{ disabled: locked }}
 >
 {tone === 'primary' && !locked ? (
 <LinearGradient
 colors={gradient ?? (['#6366F1', '#8B5CF6'] as const)}
 start={{ x: 0, y: 0 }}
 end={{ x: 1, y: 1 }}
 style={styles.actionRowFill}
 >
 {body}
 </LinearGradient>
 ) : (
 <View style={styles.actionRowPlain}>{body}</View>
 )}
 </TouchableOpacity>
 );
}

function FamilyTab({ onClose }: FamilyTabProps) {
 const {
 gameState,
 setGameState,
 saveGame,
 moveInTogether,
 haveChild,
 } = useGame();

 const insets = useSafeAreaInsets();
 const router = useRouter();
 const [selectedChild, setSelectedChild] = useState<string | null>(null);
 const [showChildModal, setShowChildModal] = useState(false);
 const [showRingModal, setShowRingModal] = useState(false);
 const [showWeddingModal, setShowWeddingModal] = useState(false);

 const partner = gameState.relationships?.find(r => r.type === 'partner');
 const spouse = gameState.family?.spouse;
 // Memoized because the `|| []` fallback allocates a NEW empty array on every
 // render, which would make the householdMood memo below re-run every time.
 const children = useMemo(() => gameState.family?.children || [], [gameState.family?.children]);
 const age = Math.floor(gameState.date.age);
 /**
  * Derived from age, NOT read from `gameState.lifeStage`.
  *
  * That field is written exactly once — `initialState.ts` sets it to
  * `getLifeStage(18)` = 'teen' — and nothing ever updates it: no birthday
  * handler, no weekly subsystem, no scenario override. This header was its
  * only product consumer (the other reader is `src/debug/aiDebugSnapshot`),
  * which is why the screen said "Teen · Age 21" on a fresh Trust Fund Baby —
  * and would still have said Teen at 70.
  */
 const lifeStage = useMemo(() => getLifeStage(age), [age]);

 /**
  * Household mood, 0-100.
  *
  * This used to render as "+{n} Family Happiness", a small integer with a plus
  * sign — which reads as a weekly happiness bonus. There is no such bonus:
  * nothing in `contexts/game/actions/weekly/` reads it, and `familyHappiness`
  * on a child has no writer anywhere in the repo. It is a readout of how the
  * household is doing, so it is now labelled and scaled as one: the average of
  * the partner/spouse bond and each child's happiness.
  */
 const householdMood = useMemo(() => {
 const scores: number[] = [];
 if (spouse) scores.push(spouse.relationshipScore);
 else if (partner) scores.push(partner.relationshipScore);
 children.forEach(child => {
 scores.push(child.happiness ?? child.familyHappiness ?? 50);
 });
 if (scores.length === 0) return null;
 return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
 }, [spouse, partner, children]);

 /**
  * What the household ACTUALLY contributes per week.
  *
  * Player report (1.4 bug-reports): a spouse rendered "$65000/week" on the card
  * directly below this headline, while the headline read "$455000" — because it
  * multiplied an already-weekly figure by 7. The player was receiving $16,250.
  *
  * Two separate errors, both closed by reading the tick's own function:
  *   - the x7 (`applyIncome` treats `rel.income` as weekly, and the spouse card
  *     one screen below labels it "/week"), and
  *   - the missing 25% household share, so even the un-multiplied figure was 4x
  *     what arrives.
  *
  * The invented "1% of each adult child's savings" term is dropped too — no
  * child contributes income anywhere in the weekly tick.
  */
 const familyIncome = useMemo(
 () => householdPartnerIncome(gameState.relationships),
 [gameState.relationships],
 );

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

 // The Apps tab only exists in the bar once a device is owned (see
 // `app/(tabs)/_layout.tsx`), so the empty-state CTA has to check the same
 // thing before it offers to take the player there.
 const ownsDevice = useMemo(
 () => (gameState.items || []).some(item => (item.id === 'smartphone' || item.id === 'computer') && item.owned),
 [gameState.items],
 );

 // `?app=tinder` opens the dating app itself. Without it this lands on the
 // launcher grid — and on a computer-owning save the grid opens on "Desktop
 // Apps", where Dating is not even in the visible category.
 const handleFindPartner = useCallback(() => {
 onClose?.();
 router.push('/(tabs)/apps?app=tinder');
 }, [onClose, router]);

 const handlePropose = useCallback(() => {
 if (!partner) return;

 if (partner.relationshipScore < SCORE_TO_PROPOSE) {
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

 if (partner.relationshipScore < SCORE_TO_MOVE_IN) {
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

 if (gameState.date.age < AGE_TO_TRY_FOR_BABY) {
 Alert.alert('Too Young', 'You must be at least 18 years old to have children.');
 return;
 }

 if (babyTarget.relationshipScore < SCORE_TO_TRY_FOR_BABY) {
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

 // Why "Try for a baby" is unavailable, or null when it is available. Shared by
 // the spouse and partner cards so both quote the same rule.
 const babyLockReason = useCallback((target: Relationship, committed: boolean): string | null => {
 if (age < AGE_TO_TRY_FOR_BABY) return `You must be at least ${AGE_TO_TRY_FOR_BABY} to start a family`;
 if (target.relationshipScore < SCORE_TO_TRY_FOR_BABY) {
 return `Needs ${SCORE_TO_TRY_FOR_BABY}% bond — you're at ${target.relationshipScore}%`;
 }
 if (!committed) return 'Move in together or get engaged first';
 return null;
 }, [age]);

 const renderPregnancy = (target: Relationship) => (
 <View style={styles.pregnancySection}>
 <View style={styles.pregnancyHeader}>
 <Baby size={scale(16)} color="#EC4899" />
 <Text style={styles.pregnancyTitle}>
 Expecting a {target.pregnancyChildGender === 'male' ? 'Boy' : 'Girl'}!
 </Text>
 </View>
 <Text style={styles.pregnancySubtext}>
 {target.pregnancyChildName} {'•'} Week {pregnancyWeeks} of 10
 </Text>
 <View style={styles.pregnancyBarContainer}>
 <View style={styles.pregnancyBarBg}>
 <View style={[styles.pregnancyBarFill, { width: `${pregnancyProgress}%` }]} />
 </View>
 <Text style={styles.pregnancyPercent}>{pregnancyProgress}%</Text>
 </View>
 </View>
 );

 // Shared header for the spouse/partner card: avatar, name, status, bond bar.
 const renderRelationshipHeader = (
 person: Relationship,
 kind: 'spouse' | 'partner',
 statusLine: string,
 ) => {
 const score = person.relationshipScore;
 return (
 <View style={styles.cardHeader}>
 <View style={styles.avatarContainer}>
 <Image
 source={getRelationshipImage(person.age || 25, person.gender || 'female', kind, person.id)}
 style={styles.avatar}
 />
 {kind === 'spouse' && (
 <View style={styles.statusBadge}>
 <Ring size={scale(11)} color={accent.gold} />
 </View>
 )}
 </View>
 <View style={styles.cardInfo}>
 <View style={styles.nameRow}>
 <Text style={styles.cardName} numberOfLines={1}>{person.name}</Text>
 <Heart size={scale(15)} color={bondColor(score)} fill={score >= 60 ? bondColor(score) : 'transparent'} />
 </View>
 <Text style={styles.cardSubtitle} numberOfLines={1}>{statusLine}</Text>
 <View style={styles.progressBar}>
 <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, score))}%`, backgroundColor: bondColor(score) }]} />
 </View>
 <Text style={styles.progressText}>
 <Text style={{ color: bondColor(score), fontWeight: '700' }}>{score}% bond</Text>
 {person.income ? ` · $${person.income.toLocaleString()}/wk` : ''}
 </Text>
 </View>
 </View>
 );
 };

 const renderSpouseCard = () => {
 if (!spouse) return null;
 const target = spouseRelationship ?? spouse;

 return (
 <View style={styles.card}>
 {renderRelationshipHeader(spouse, 'spouse', `Your spouse · ${spouse.personality}`)}

 {isPregnant && renderPregnancy(target)}

 {!isPregnant && (
 <ActionRow
 icon={Baby}
 label="Try for a baby"
 hint="Start or grow your family"
 tone="primary"
 gradient={['#EC4899', '#DB2777'] as const}
 onPress={handleHaveChild}
 lockedReason={babyLockReason(target, true)}
 />
 )}
 </View>
 );
 };

 const renderPartnerCard = () => {
 if (!partner || spouse) return null;

 const isEngaged = partner.engagementWeek != null;
 const hasWeddingPlan = Boolean(partner.weddingPlanned);
 const committed = Boolean(partner.livingTogether) || isEngaged;
 const score = partner.relationshipScore;

 const status = [
 isEngaged ? 'Your fiancé(e)' : 'Your partner',
 partner.personality,
 partner.livingTogether ? 'Living together' : null,
 ].filter(Boolean).join(' · ');

 return (
 <View style={styles.card}>
 {renderRelationshipHeader(partner, 'partner', status)}

 {partner.isPregnant && renderPregnancy(partner)}

 {!partner.livingTogether && (
 <ActionRow
 icon={Home}
 label="Move in together"
 hint="Share a home — and the rent"
 tone="secondary"
 onPress={handleMoveIn}
 lockedReason={score < SCORE_TO_MOVE_IN ? `Needs ${SCORE_TO_MOVE_IN}% bond — you're at ${score}%` : null}
 />
 )}

 {!isEngaged && (
 <ActionRow
 icon={Ring}
 label="Propose"
 hint="Pick a ring and pop the question"
 tone="primary"
 onPress={handlePropose}
 lockedReason={score < SCORE_TO_PROPOSE ? `Needs ${SCORE_TO_PROPOSE}% bond — you're at ${score}%` : null}
 />
 )}

 {isEngaged && !hasWeddingPlan && (
 <ActionRow
 icon={Heart}
 label="Plan the wedding"
 hint="Pick a venue, a date and a budget"
 tone="primary"
 gradient={['#EC4899', '#DB2777'] as const}
 onPress={() => setShowWeddingModal(true)}
 />
 )}

 {isEngaged && hasWeddingPlan && (
 <View style={styles.scheduledBanner}>
 <Heart size={scale(16)} color={accent.success} />
 <Text style={styles.scheduledBannerText}>Wedding scheduled — it happens on its week</Text>
 </View>
 )}

 {!partner.isPregnant && (
 <ActionRow
 icon={Baby}
 label="Try for a baby"
 hint="Start your family"
 tone="secondary"
 onPress={handleHaveChild}
 lockedReason={babyLockReason(partner, committed)}
 />
 )}
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
 const child = prevChildren.find(ch => ch.id === childId);
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
 children: prevChildren.map(ch => (ch.id === childId ? outcome.child! : ch)),
 },
 };
 });
 saveGame();
 }, [gameState.family?.children, gameState.weeksLived, gameState.stats.money, gameState.stats.energy, setGameState, saveGame]);

 const renderChildCard = (child: ChildInfo) => {
 const childAge = Math.floor(child.age);
 const isAdult = childAge >= 18;
 const mood = child.happiness ?? child.familyHappiness ?? 50;

 return (
 <TouchableOpacity
 key={child.id}
 style={styles.childCard}
 onPress={() => {
 setSelectedChild(child.id);
 setShowChildModal(true);
 }}
 activeOpacity={0.8}
 accessibilityRole="button"
 accessibilityLabel={`${child.name}, age ${childAge}`}
 >
 <View style={styles.childAvatarContainer}>
 <Image
 source={getCharacterImage(childAge, child.gender || 'male', child.id)}
 style={styles.childAvatar}
 />
 {isAdult && (
 <View style={styles.adultBadge}>
 <Star size={scale(11)} color={accent.gold} fill={accent.gold} />
 </View>
 )}
 </View>
 <View style={styles.childInfo}>
 <Text style={styles.childName} numberOfLines={1}>{child.name}</Text>
 <Text style={styles.childAge}>
 Age {childAge} · {isAdult ? 'Adult' : childAge >= 13 ? 'Teen' : 'Child'}
 </Text>
 {/* Mood + bond on the row itself: the two numbers that decide whether
     this child needs attention this week, without opening the sheet. */}
 <View style={styles.childChipRow}>
 <View style={styles.childChip}>
 <Smile size={scale(11)} color={accent.warning} />
 <Text style={styles.childChipText}>{Math.round(mood)}%</Text>
 </View>
 <View style={styles.childChip}>
 <Heart size={scale(11)} color={bondColor(child.relationshipScore)} />
 <Text style={styles.childChipText}>{Math.round(child.relationshipScore)}%</Text>
 </View>
 {!!child.educationLevel && child.educationLevel !== 'none' && (
 <View style={styles.childChip}>
 <GraduationCap size={scale(11)} color={accent.info} />
 <Text style={styles.childChipText}>{child.educationLevel}</Text>
 </View>
 )}
 </View>
 </View>
 <ChevronRight size={scale(20)} color={c.textMuted} />
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
 <View style={styles.parentingSection}>
 <View style={styles.parentingHeader}>
 <Text style={[styles.sectionTitle, styles.parentingHeaderTitle]}>Parenting</Text>
 <View style={styles.parentingQuotaBadge}>
 <Text style={styles.parentingQuotaText}>{remaining}/{MAX_PARENTING_ACTIONS_PER_WEEK} this week</Text>
 </View>
 </View>

 {/* Nurture stat readout — reflects the child's growing stats */}
 <View style={styles.nurtureRow}>
 {NURTURE_DISPLAY.map(({ key, label, icon: Icon, color }) => (
 <View key={key} style={styles.nurtureChip}>
 <Icon size={scale(14)} color={color} />
 <Text style={styles.nurtureValue}>{getNurtureStat(child, key)}</Text>
 <Text style={styles.nurtureLabel} numberOfLines={1}>{label}</Text>
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
 style={[styles.parentingAction, disabled && styles.parentingActionDisabled]}
 onPress={() => handleParentingAction(child.id, action.id)}
 disabled={disabled}
 activeOpacity={0.7}
 >
 <View style={styles.parentingActionIcon}>
 <Icon size={scale(20)} color={accent.info} />
 </View>
 <View style={styles.parentingActionBody}>
 <Text style={styles.parentingActionLabel}>{action.label}</Text>
 <Text style={styles.parentingActionDesc} numberOfLines={2}>{action.description}</Text>
 <View style={styles.parentingActionMetaRow}>
 {action.moneyCost > 0 && (
 <View style={styles.parentingCostChip}>
 <DollarSign size={scale(11)} color={accent.success} />
 <Text style={[styles.parentingCostText, { color: accent.success }]}>{action.moneyCost.toLocaleString()}</Text>
 </View>
 )}
 {action.energyCost > 0 && (
 <View style={styles.parentingCostChip}>
 <Activity size={scale(11)} color={accent.warning} />
 <Text style={[styles.parentingCostText, { color: accent.warning }]}>{action.energyCost}</Text>
 </View>
 )}
 <Text style={styles.parentingEffectText} numberOfLines={1}>
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
 const child = children.find(ch => ch.id === selectedChild);
 if (!child) return null;

 const childAge = Math.floor(child.age);

 return (
 <Modal
 visible={showChildModal}
 transparent
 animationType="slide"
 onRequestClose={() => setShowChildModal(false)}
 >
 <View style={[styles.modalOverlay, { paddingTop: insets.top + scale(24), paddingBottom: insets.bottom + scale(24) }]}>
 <View style={styles.modalContent}>
 <View style={styles.modalHeader}>
 <Text style={styles.modalTitle} numberOfLines={1}>{child.name}</Text>
 <TouchableOpacity
 onPress={() => setShowChildModal(false)}
 style={[styles.closeButton, minTouchTargetStyle]}
 hitSlop={hitSlopToMinTarget(scale(24))}
 {...CLOSE_BUTTON_A11Y}
 >
 <X size={scale(20)} color={c.text} />
 </TouchableOpacity>
 </View>

 <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
 <View style={styles.childProfileHeader}>
 <Image
 source={getCharacterImage(childAge, child.gender || 'male', child.id)}
 style={styles.childProfileAvatar}
 />
 <View style={styles.childProfileInfo}>
 <Text style={styles.childProfileName} numberOfLines={1}>{child.name}</Text>
 <Text style={styles.childProfileAge}>
 Age {childAge} · {child.gender === 'male' ? 'Son' : 'Daughter'}
 </Text>
 </View>
 </View>

 <View style={styles.childStatsGrid}>
 <View style={styles.childStatCard}>
 <Heart size={scale(18)} color={accent.danger} />
 <Text style={styles.childStatValue}>{child.happiness ?? child.familyHappiness ?? 50}%</Text>
 <Text style={styles.childStatLabel}>Happiness</Text>
 </View>
 <View style={styles.childStatCard}>
 <GraduationCap size={scale(18)} color={accent.info} />
 <Text style={styles.childStatValue}>{child.educationLevel || 'None'}</Text>
 <Text style={styles.childStatLabel}>Education</Text>
 </View>
 {childAge >= 18 && (
 <>
 <View style={styles.childStatCard}>
 <DollarSign size={scale(18)} color={accent.success} />
 <Text style={styles.childStatValue}>${(child.savings || 0).toLocaleString()}</Text>
 <Text style={styles.childStatLabel}>Savings</Text>
 </View>
 <View style={styles.childStatCard}>
 <TrendingUp size={scale(18)} color="#8B5CF6" />
 <Text style={styles.childStatValue}>{child.careerPath || 'Seeking'}</Text>
 <Text style={styles.childStatLabel}>Career</Text>
 </View>
 </>
 )}
 </View>

 {renderParentingSection(child)}

 {child.geneticTraits && child.geneticTraits.length > 0 && (
 <View style={styles.traitsSection}>
 <Text style={styles.sectionTitle}>Genetic Traits</Text>
 <View style={styles.traitsContainer}>
 {child.geneticTraits.map((trait: string, index: number) => (
 <View key={index} style={styles.traitBadge}>
 <Sparkles size={scale(11)} color={accent.warning} />
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
 <Crown size={scale(22)} color="#FFF" />
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
 <View style={styles.container}>
 {/*
   * SAFE AREA — the fix for "it's too far up, can't press close".
   * This screen is hosted in a full-screen Modal, which sits OUTSIDE the tab
   * navigator's safe-area padding, so the inset has to be applied here or the
   * header is drawn under the status bar / Dynamic Island.
   */}
 <View style={[styles.header, { paddingTop: insets.top + scale(8) }]}>
 <View style={styles.headerIcon}>
 <Users size={scale(20)} color={accent.info} />
 </View>
 <View style={styles.headerTitleWrap}>
 <Text style={styles.headerTitle}>Family</Text>
 <Text style={styles.headerSubtitle}>
 {lifeStage.charAt(0).toUpperCase() + lifeStage.slice(1)} · Age {age}
 </Text>
 </View>
 {onClose && (
 <TouchableOpacity
 onPress={onClose}
 style={[styles.closeButton, minTouchTargetStyle]}
 hitSlop={hitSlopToMinTarget(scale(24))}
 {...CLOSE_BUTTON_A11Y}
 >
 <X size={scale(20)} color={c.text} />
 </TouchableOpacity>
 )}
 </View>

 <ScrollView
 style={styles.content}
 contentContainerStyle={[styles.contentInner, { paddingBottom: insets.bottom + scale(32) }]}
 showsVerticalScrollIndicator={false}
 >
 {/* Household summary */}
 <View style={styles.statsCard}>
 <View style={styles.statsItem}>
 <Heart size={scale(18)} color={householdMood == null ? c.textMuted : bondColor(householdMood)} />
 <Text style={styles.statsValue}>{householdMood == null ? '—' : `${householdMood}%`}</Text>
 <Text style={styles.statsLabel}>Household Mood</Text>
 </View>
 <View style={styles.statsDivider} />
 <View style={styles.statsItem}>
 <Users size={scale(18)} color={accent.info} />
 <Text style={styles.statsValue}>{children.length}</Text>
 <Text style={styles.statsLabel}>Children</Text>
 </View>
 <View style={styles.statsDivider} />
 <View style={styles.statsItem}>
 <DollarSign size={scale(18)} color={accent.success} />
 <Text style={styles.statsValue}>${familyIncome.toLocaleString()}</Text>
 <Text style={styles.statsLabel}>Partner Income/wk</Text>
 </View>
 </View>

 {/* Spouse Section */}
 {spouse && (
 <View style={styles.section}>
 <Text style={styles.sectionTitle}>Spouse</Text>
 {renderSpouseCard()}
 </View>
 )}

 {/* Partner Section */}
 {partner && !spouse && (
 <View style={styles.section}>
 <Text style={styles.sectionTitle}>Partner</Text>
 {renderPartnerCard()}
 </View>
 )}

 {/* No Relationship State — an actionable dead end instead of a sentence
     telling the player where to go. */}
 {!partner && !spouse && (
 <View style={styles.emptyState}>
 <View style={styles.emptyStateIcon}>
 <Heart size={scale(32)} color={accent.danger} />
 </View>
 <Text style={styles.emptyStateTitle}>No partner yet</Text>
 <Text style={styles.emptyStateText}>
 {ownsDevice
 ? 'Match on the dating app, go on dates to build the bond, then move in, propose and start a family.'
 : 'Buy a smartphone from the Market to unlock the dating app — that is where every relationship starts.'}
 </Text>
 {ownsDevice && (
 <TouchableOpacity
 style={styles.emptyStateCta}
 onPress={handleFindPartner}
 activeOpacity={0.85}
 accessibilityRole="button"
 accessibilityLabel="Open the dating app"
 >
 <LinearGradient
 colors={['#EC4899', '#DB2777']}
 start={{ x: 0, y: 0 }}
 end={{ x: 1, y: 1 }}
 style={styles.emptyStateCtaFill}
 >
 <Search size={scale(17)} color="#FFF" />
 <Text style={styles.emptyStateCtaText}>Open the dating app</Text>
 </LinearGradient>
 </TouchableOpacity>
 )}
 <View style={styles.pathList}>
 {[
 `Build the bond to ${SCORE_TO_MOVE_IN}% to move in together`,
 `${SCORE_TO_PROPOSE}% and a ring to propose`,
 `${SCORE_TO_TRY_FOR_BABY}% and living together to start a family`,
 ].map(step => (
 <View key={step} style={styles.pathRow}>
 <View style={styles.pathDot} />
 <Text style={styles.pathText}>{step}</Text>
 </View>
 ))}
 </View>
 </View>
 )}

 {/* Children Section */}
 {children.length > 0 && (
 <View style={styles.section}>
 <Text style={styles.sectionTitle}>Children ({children.length})</Text>
 {children.map(renderChildCard)}
 </View>
 )}

 {/* Empty Children State */}
 {(spouse || partner) && children.length === 0 && (
 <View style={styles.emptyChildrenState}>
 <Baby size={scale(28)} color={c.textMuted} />
 <Text style={styles.emptyChildrenText}>
 No children yet. Any child you raise here can inherit everything when this
 life ends.
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
 </View>
 );
}

const styles = StyleSheet.create({
 container: {
 flex: 1,
 backgroundColor: c.background,
 },
 // ── Header ────────────────────────────────────────────────────────────
 header: {
 flexDirection: 'row',
 alignItems: 'center',
 paddingHorizontal: scale(16),
 paddingBottom: scale(12),
 // Structural divider, not a decorative accent bar — allowed by Hard Rule #7.
 borderBottomWidth: StyleSheet.hairlineWidth,
 borderBottomColor: c.border,
 },
 headerIcon: {
 width: scale(36),
 height: scale(36),
 borderRadius: scale(12),
 backgroundColor: 'rgba(59, 130, 246, 0.14)',
 alignItems: 'center',
 justifyContent: 'center',
 },
 headerTitleWrap: {
 flex: 1,
 marginLeft: scale(12),
 },
 headerTitle: {
 fontSize: fontScale(22),
 fontWeight: '700',
 color: c.text,
 },
 headerSubtitle: {
 fontSize: fontScale(12),
 color: c.textMuted,
 marginTop: scale(1),
 },
 closeButton: {
 borderRadius: scale(22),
 backgroundColor: c.surfaceElevated,
 borderWidth: 1,
 borderColor: c.border,
 },
 // ── Layout ────────────────────────────────────────────────────────────
 content: {
 flex: 1,
 },
 contentInner: {
 paddingHorizontal: scale(16),
 paddingTop: scale(16),
 },
 section: {
 marginBottom: scale(20),
 },
 sectionTitle: {
 fontSize: fontScale(13),
 fontWeight: '700',
 color: c.textMuted,
 letterSpacing: 0.8,
 textTransform: 'uppercase',
 marginBottom: scale(10),
 },
 // ── Household summary ─────────────────────────────────────────────────
 statsCard: {
 flexDirection: 'row',
 alignItems: 'stretch',
 backgroundColor: c.surface,
 borderRadius: scale(16),
 borderWidth: 1,
 borderColor: c.border,
 paddingVertical: scale(14),
 marginBottom: scale(20),
 },
 statsItem: {
 flex: 1,
 alignItems: 'center',
 paddingHorizontal: scale(4),
 },
 statsDivider: {
 width: StyleSheet.hairlineWidth,
 backgroundColor: c.border,
 marginVertical: scale(4),
 },
 statsValue: {
 fontSize: fontScale(18),
 fontWeight: '700',
 color: c.text,
 marginTop: scale(6),
 },
 statsLabel: {
 fontSize: fontScale(10),
 color: c.textMuted,
 marginTop: scale(2),
 textAlign: 'center',
 },
 // ── Relationship card ─────────────────────────────────────────────────
 card: {
 backgroundColor: c.surface,
 borderRadius: scale(16),
 borderWidth: 1,
 borderColor: c.border,
 padding: scale(14),
 },
 cardHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 marginBottom: scale(14),
 },
 avatarContainer: {
 position: 'relative',
 },
 avatar: {
 width: scale(60),
 height: scale(60),
 borderRadius: scale(30),
 borderWidth: 2,
 borderColor: c.borderStrong,
 },
 statusBadge: {
 position: 'absolute',
 bottom: -scale(2),
 right: -scale(2),
 backgroundColor: c.surfaceElevated,
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
 gap: scale(6),
 },
 cardName: {
 fontSize: fontScale(18),
 fontWeight: '700',
 color: c.text,
 flexShrink: 1,
 },
 cardSubtitle: {
 fontSize: fontScale(12),
 color: c.textMuted,
 marginTop: scale(2),
 },
 progressBar: {
 height: scale(6),
 backgroundColor: 'rgba(255,255,255,0.08)',
 borderRadius: scale(3),
 overflow: 'hidden',
 marginTop: scale(8),
 },
 progressFill: {
 height: '100%',
 borderRadius: scale(3),
 },
 progressText: {
 fontSize: fontScale(11),
 color: c.textSecondary,
 marginTop: scale(5),
 },
 // ── Action rows ───────────────────────────────────────────────────────
 actionRow: {
 borderRadius: scale(12),
 overflow: 'hidden',
 marginTop: scale(8),
 },
 actionRowLocked: {
 opacity: 0.75,
 },
 actionRowFill: {
 paddingVertical: scale(11),
 paddingHorizontal: scale(12),
 },
 actionRowPlain: {
 paddingVertical: scale(11),
 paddingHorizontal: scale(12),
 backgroundColor: c.surfaceElevated,
 borderRadius: scale(12),
 borderWidth: 1,
 borderColor: c.border,
 },
 actionRowBody: {
 flexDirection: 'row',
 alignItems: 'center',
 },
 actionRowIcon: {
 width: scale(32),
 height: scale(32),
 borderRadius: scale(10),
 alignItems: 'center',
 justifyContent: 'center',
 backgroundColor: 'rgba(59, 130, 246, 0.14)',
 marginRight: scale(10),
 },
 actionRowIconPrimary: {
 backgroundColor: 'rgba(255,255,255,0.18)',
 },
 actionRowText: {
 flex: 1,
 },
 actionRowLabel: {
 fontSize: fontScale(14),
 fontWeight: '700',
 color: c.text,
 },
 actionRowLabelPrimary: {
 color: '#FFF',
 },
 actionRowHint: {
 fontSize: fontScale(11),
 color: c.textSecondary,
 marginTop: scale(2),
 },
 actionRowHintLocked: {
 color: accent.warning,
 },
 scheduledBanner: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: scale(8),
 marginTop: scale(8),
 paddingVertical: scale(11),
 paddingHorizontal: scale(12),
 borderRadius: scale(12),
 backgroundColor: 'rgba(16, 185, 129, 0.12)',
 borderWidth: 1,
 borderColor: 'rgba(16, 185, 129, 0.35)',
 },
 scheduledBannerText: {
 flex: 1,
 fontSize: fontScale(12),
 fontWeight: '600',
 color: accent.success,
 },
 // ── Children ──────────────────────────────────────────────────────────
 childCard: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: c.surface,
 borderRadius: scale(14),
 borderWidth: 1,
 borderColor: c.border,
 padding: scale(12),
 marginBottom: scale(8),
 },
 childAvatarContainer: {
 position: 'relative',
 },
 childAvatar: {
 width: scale(46),
 height: scale(46),
 borderRadius: scale(23),
 },
 adultBadge: {
 position: 'absolute',
 bottom: -scale(2),
 right: -scale(2),
 backgroundColor: c.surfaceElevated,
 borderRadius: scale(8),
 padding: scale(2),
 },
 childInfo: {
 flex: 1,
 marginLeft: scale(12),
 },
 childName: {
 fontSize: fontScale(15),
 fontWeight: '700',
 color: c.text,
 },
 childAge: {
 fontSize: fontScale(12),
 color: c.textMuted,
 marginTop: scale(1),
 },
 childChipRow: {
 flexDirection: 'row',
 flexWrap: 'wrap',
 gap: scale(6),
 marginTop: scale(6),
 },
 childChip: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: scale(3),
 backgroundColor: 'rgba(255,255,255,0.06)',
 borderRadius: scale(8),
 paddingHorizontal: scale(7),
 paddingVertical: scale(3),
 },
 childChipText: {
 fontSize: fontScale(10),
 fontWeight: '600',
 color: c.textSecondary,
 },
 // ── Empty states ──────────────────────────────────────────────────────
 emptyState: {
 alignItems: 'center',
 paddingVertical: scale(28),
 paddingHorizontal: scale(20),
 backgroundColor: c.surface,
 borderRadius: scale(16),
 borderWidth: 1,
 borderColor: c.border,
 marginBottom: scale(20),
 },
 emptyStateIcon: {
 width: scale(64),
 height: scale(64),
 borderRadius: scale(32),
 alignItems: 'center',
 justifyContent: 'center',
 backgroundColor: 'rgba(239, 68, 68, 0.12)',
 },
 emptyStateTitle: {
 fontSize: fontScale(18),
 fontWeight: '700',
 color: c.text,
 marginTop: scale(14),
 },
 emptyStateText: {
 fontSize: fontScale(13),
 color: c.textSecondary,
 marginTop: scale(6),
 textAlign: 'center',
 lineHeight: fontScale(19),
 },
 emptyStateCta: {
 alignSelf: 'stretch',
 borderRadius: scale(12),
 overflow: 'hidden',
 marginTop: scale(16),
 },
 emptyStateCtaFill: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'center',
 gap: scale(8),
 paddingVertical: scale(13),
 },
 emptyStateCtaText: {
 color: '#FFF',
 fontSize: fontScale(14),
 fontWeight: '700',
 },
 pathList: {
 alignSelf: 'stretch',
 marginTop: scale(16),
 gap: scale(8),
 },
 pathRow: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: scale(8),
 },
 pathDot: {
 width: scale(5),
 height: scale(5),
 borderRadius: scale(3),
 backgroundColor: c.textMuted,
 },
 pathText: {
 flex: 1,
 fontSize: fontScale(12),
 color: c.textMuted,
 },
 emptyChildrenState: {
 alignItems: 'center',
 paddingVertical: scale(22),
 paddingHorizontal: scale(20),
 backgroundColor: c.surface,
 borderRadius: scale(14),
 borderWidth: 1,
 borderColor: c.border,
 marginBottom: scale(20),
 },
 emptyChildrenText: {
 fontSize: fontScale(12),
 color: c.textMuted,
 marginTop: scale(8),
 textAlign: 'center',
 lineHeight: fontScale(18),
 },
 // ── Child sheet ───────────────────────────────────────────────────────
 modalOverlay: {
 flex: 1,
 backgroundColor: c.overlay,
 justifyContent: 'center',
 alignItems: 'center',
 paddingHorizontal: scale(16),
 },
 modalContent: {
 width: '100%',
 maxWidth: scale(420),
 maxHeight: '100%',
 backgroundColor: c.surface,
 borderRadius: scale(20),
 borderWidth: 1,
 borderColor: c.border,
 overflow: 'hidden',
 ...getPlatformShadows(6, 0.25, 4, 14),
 },
 modalHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 paddingHorizontal: scale(16),
 paddingVertical: scale(12),
 borderBottomWidth: StyleSheet.hairlineWidth,
 borderBottomColor: c.border,
 },
 modalTitle: {
 flex: 1,
 fontSize: fontScale(18),
 fontWeight: '700',
 color: c.text,
 },
 modalScroll: {
 flexGrow: 0,
 // `flexShrink: 1` is the half that makes the sheet's `maxHeight` bite. RN
 // defaults flexShrink to 0, so without it this list keeps its full content
 // height and overflows the sheet — which is `overflow: 'hidden'`, so the
 // tail of a long child's parenting actions is clipped with nothing to
 // scroll. See __tests__/render/modalListsShrink.test.ts.
 flexShrink: 1,
 },
 modalScrollContent: {
 padding: scale(16),
 },
 childProfileHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 marginBottom: scale(18),
 },
 childProfileAvatar: {
 width: scale(72),
 height: scale(72),
 borderRadius: scale(36),
 borderWidth: 2,
 borderColor: accent.info,
 },
 childProfileInfo: {
 flex: 1,
 marginLeft: scale(14),
 },
 childProfileName: {
 fontSize: fontScale(20),
 fontWeight: '700',
 color: c.text,
 },
 childProfileAge: {
 fontSize: fontScale(13),
 color: c.textMuted,
 marginTop: scale(3),
 },
 childStatsGrid: {
 flexDirection: 'row',
 flexWrap: 'wrap',
 gap: scale(8),
 },
 childStatCard: {
 flexGrow: 1,
 flexBasis: '46%',
 backgroundColor: c.surfaceElevated,
 borderRadius: scale(12),
 borderWidth: 1,
 borderColor: c.border,
 padding: scale(12),
 alignItems: 'center',
 },
 childStatValue: {
 fontSize: fontScale(15),
 fontWeight: '700',
 color: c.text,
 marginTop: scale(6),
 textAlign: 'center',
 },
 childStatLabel: {
 fontSize: fontScale(10),
 color: c.textMuted,
 marginTop: scale(2),
 textAlign: 'center',
 },
 traitsSection: {
 marginTop: scale(16),
 padding: scale(12),
 backgroundColor: c.surfaceElevated,
 borderRadius: scale(12),
 borderWidth: 1,
 borderColor: c.border,
 },
 traitsContainer: {
 flexDirection: 'row',
 flexWrap: 'wrap',
 gap: scale(6),
 },
 traitBadge: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: scale(4),
 backgroundColor: 'rgba(245, 158, 11, 0.15)',
 paddingHorizontal: scale(10),
 paddingVertical: scale(4),
 borderRadius: scale(10),
 },
 traitText: {
 fontSize: fontScale(11),
 color: accent.warning,
 fontWeight: '600',
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
 gap: scale(8),
 paddingVertical: scale(14),
 },
 heirBannerText: {
 color: '#FFF',
 fontSize: fontScale(15),
 fontWeight: '700',
 },
 // ── Parenting section ─────────────────────────────────────────────────
 parentingSection: {
 marginTop: scale(16),
 padding: scale(12),
 backgroundColor: c.surfaceElevated,
 borderRadius: scale(12),
 borderWidth: 1,
 borderColor: c.border,
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
 backgroundColor: 'rgba(59, 130, 246, 0.16)',
 borderRadius: scale(10),
 paddingHorizontal: scale(8),
 paddingVertical: scale(3),
 },
 parentingQuotaText: {
 fontSize: fontScale(11),
 fontWeight: '700',
 color: accent.info,
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
 fontWeight: '700',
 color: c.text,
 marginTop: scale(2),
 },
 nurtureLabel: {
 fontSize: fontScale(9),
 color: c.textMuted,
 marginTop: scale(1),
 },
 parentingAction: {
 flexDirection: 'row',
 alignItems: 'flex-start',
 backgroundColor: c.surface,
 borderRadius: scale(12),
 padding: scale(10),
 marginBottom: scale(8),
 borderWidth: 1,
 borderColor: c.border,
 },
 parentingActionDisabled: {
 opacity: 0.5,
 },
 parentingActionIcon: {
 width: scale(38),
 height: scale(38),
 borderRadius: scale(10),
 backgroundColor: 'rgba(59, 130, 246, 0.14)',
 alignItems: 'center',
 justifyContent: 'center',
 marginRight: scale(10),
 },
 parentingActionBody: {
 flex: 1,
 },
 parentingActionLabel: {
 fontSize: fontScale(14),
 fontWeight: '700',
 color: c.text,
 },
 parentingActionDesc: {
 fontSize: fontScale(11),
 color: c.textMuted,
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
 color: '#93C5FD',
 flexShrink: 1,
 },
 parentingReason: {
 fontSize: fontScale(10),
 color: accent.danger,
 marginTop: scale(4),
 fontWeight: '500',
 },
 // ── Pregnancy ─────────────────────────────────────────────────────────
 pregnancySection: {
 marginTop: scale(4),
 marginBottom: scale(4),
 padding: scale(12),
 backgroundColor: 'rgba(236, 72, 153, 0.10)',
 borderRadius: scale(12),
 borderWidth: 1,
 borderColor: 'rgba(236, 72, 153, 0.30)',
 },
 pregnancyHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: scale(8),
 marginBottom: scale(4),
 },
 pregnancyTitle: {
 fontSize: fontScale(14),
 fontWeight: '700',
 color: '#F472B6',
 },
 pregnancySubtext: {
 fontSize: fontScale(12),
 color: c.textSecondary,
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
 backgroundColor: 'rgba(236, 72, 153, 0.20)',
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
 fontWeight: '700',
 color: '#F472B6',
 minWidth: scale(32),
 textAlign: 'right',
 },
});

export default React.memo(FamilyTab);
