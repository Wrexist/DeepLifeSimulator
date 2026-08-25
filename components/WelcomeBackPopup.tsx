import React, { useEffect, useRef } from 'react';
import { Platform, Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions } from 'react-native';
import Gradient from '@/components/ui/Gradient';
import { MS_PER_DAY } from '@/lib/config/gameConstants';
import {
  Home,
  TrendingUp,
  Clock,
  Sparkles,
  ArrowRight,
  Heart,
  DollarSign,
  Zap,
  Mail,
  BookOpen,
  CalendarClock,
} from 'lucide-react-native';
import { useGameState } from '@/contexts/GameContext';
import { safeSettings } from "@/utils/safeGameState";
import { scale, responsivePadding, responsiveBorderRadius, responsiveFontSize, responsiveSpacing } from '@/utils/scaling';
import { formatMoney } from '@/utils/moneyFormatting';
import { computeWelcomeBackBonus } from '@/utils/welcomeBackBonus';
import { primaryGoal } from '@/lib/goals';
import { upcomingEvents } from '@/lib/anticipation';
import { calculateNetWorth } from '@/lib/statistics/statisticsTracker';
import { track } from '@/lib/analytics';
const LinearGradient = Gradient;

const { width: _screenWidth } = Dimensions.get('window');

interface WelcomeBackPopupProps {
  visible: boolean;
  onClose: () => void;
}

export default function WelcomeBackPopup({ visible, onClose }: WelcomeBackPopupProps) {
  const { gameState } = useGameState();
  const settings = safeSettings(gameState); // R3-D: defensive - see utils/safeGameState.ts
  const isDarkMode = settings.darkMode;

  // Calculate time away
  const lastLogin = gameState.lastLogin || Date.now();
  const daysAway = Math.floor((Date.now() - lastLogin) / MS_PER_DAY);
  const weeksAway = Math.floor(daysAway / 7);
  const hoursAway = Math.floor((Date.now() - lastLogin) / (1000 * 60 * 60));

  // Top of the return funnel: record that the summary actually PRESENTED (it
  // can lose the interruption slot and never show), carrying the absence
  // length. Once per popup appearance, not per render.
  const trackedRef = useRef(false);
  useEffect(() => {
    if (!visible) {
      trackedRef.current = false;
      return;
    }
    if (trackedRef.current) return;
    trackedRef.current = true;
    track('return_summary_viewed', { daysAway });
  }, [visible, daysAway]);

  // Animations
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let glowLoopRef: Animated.CompositeAnimation | null = null;
    let pulseLoopRef: Animated.CompositeAnimation | null = null;

    if (visible) {
      // Reset animations
      scaleAnim.setValue(0.9);
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      glowAnim.setValue(0);
      pulseAnim.setValue(1);

      // Entrance animations
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      // Glow pulse animation
      glowLoopRef = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      glowLoopRef.start();

      // Pulse animation for icon
      pulseLoopRef = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoopRef.start();
    }

    return () => {
      if (glowLoopRef) glowLoopRef.stop();
      if (pulseLoopRef) pulseLoopRef.stop();
    };
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.28],
  });

  const getTimeAwayText = () => {
    if (daysAway === 0) {
      if (hoursAway < 1) return 'Just now';
      if (hoursAway === 1) return '1 hour ago';
      return `${hoursAway} hours ago`;
    }
    if (daysAway === 1) return 'Yesterday';
    if (daysAway < 7) return `${daysAway} days ago`;
    if (weeksAway === 1) return '1 week ago';
    if (weeksAway < 4) return `${weeksAway} weeks ago`;
    const monthsAway = Math.floor(weeksAway / 4);
    if (monthsAway === 1) return '1 month ago';
    return `${monthsAway} months ago`;
  };

  const getWelcomeMessage = () => {
    if (daysAway === 0) return "Welcome back!";
    if (daysAway < 7) return "Welcome back!";
    if (weeksAway < 4) return "Long time no see!";
    return "Welcome back, traveler!";
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: slideAnim }
              ],
            },
          ]}
        >
          {/* Animated background glow */}
          <Animated.View
            style={[
              styles.glowCircle,
              {
                opacity: glowOpacity,
              },
            ]}
          />

          <LinearGradient
            colors={isDarkMode
              ? ['#1E293B', '#0F172A', '#0F172A']
              : ['#FFFFFF', '#F8FAFC', '#EFF6FF']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.content}
          >
            {/* ── The scroll surface ───────────────────────────────────────
                Everything from the home crest down to the "what's waiting"
                rows scrolls; the Continue button stays pinned below it.

                The body here is VARIABLE height - the info block renders
                between one and six rows depending on streak, pending events,
                an unresolved cliffhanger and a neglected partner - on top of a
                fixed crest, title, and two stat cards. A returning player who
                triggers most of those pushes the column past the screen, and
                Continue is the ONLY way out of this popup: it has no close X
                and no backdrop tap, and `onRequestClose` is Android's hardware
                back button alone. Off the bottom of the screen means stuck.

                `flexShrink: 1`, not `flex: 1` - see the note in
                `WeddingPopup`/`ApplyCardModal`: grow-with-no-shrink lets a tall
                pinned footer collapse the scroller to zero height, which is the
                same bug wearing a different hat. */}
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              bounces={false}
            >
              {/* Header with animated home icon */}
              <View style={styles.header}>
                <Animated.View
                  style={[
                    styles.iconContainer,
                    {
                      transform: [{ scale: pulseAnim }],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB', '#1D4ED8']}
                    style={styles.iconGradient}
                  >
                    <Home size={scale(40)} color="#FFFFFF" strokeWidth={2.5} />
                  </LinearGradient>

                  {/* Sparkle accents */}
                  <View style={[styles.sparkleAccent, styles.sparkleTopLeft]}>
                    <Sparkles size={scale(14)} color="#60A5FA" fill="#60A5FA" />
                  </View>
                  <View style={[styles.sparkleAccent, styles.sparkleTopRight]}>
                    <Sparkles size={scale(12)} color="#93C5FD" fill="#93C5FD" />
                  </View>
                </Animated.View>
              </View>

              {/* Title */}
              <View style={styles.titleContainer}>
                <Text style={[styles.title, isDarkMode && styles.titleDark]}>
                  {getWelcomeMessage()}
                </Text>
                <View style={styles.timeAwayContainer}>
                  <Clock size={scale(16)} color={isDarkMode ? '#94A3B8' : '#6B7280'} />
                  <Text style={[styles.timeAway, isDarkMode && styles.timeAwayDark]}>
                    Last played: {getTimeAwayText()}
                  </Text>
                </View>
              </View>

              {/* Stats Preview */}
              <View style={styles.statsContainer}>
                <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
                  <View style={styles.statIconContainer}>
                    <DollarSign size={scale(20)} color="#10B981" />
                  </View>
                  <View style={styles.statContent}>
                    <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>
                      Net Worth
                    </Text>
                    <Text style={[styles.statValue, isDarkMode && styles.statValueDark]}>
                      {/* The canonical net-worth calculator, not cash+savings:
                          the popup used to understate for anyone holding
                          property, stocks, crypto or a company — on the one
                          screen summarising their life. Same source as the
                          home dashboard, so the two cannot disagree. */}
                      {formatMoney(calculateNetWorth(gameState))}
                    </Text>
                  </View>
                </View>

                <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
                  <View style={styles.statIconContainer}>
                    <Heart size={scale(20)} color="#EF4444" />
                  </View>
                  <View style={styles.statContent}>
                    <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>
                      Life Progress
                    </Text>
                    <Text style={[styles.statValue, isDarkMode && styles.statValueDark]}>
                      Week {gameState.weeksLived || 0} | Age {Math.floor(gameState.date?.age ?? 0)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* ENGAGEMENT: Scaled Welcome Back Bonus + "what's waiting" preview.
                  Surfacing pending events / cliffhanger / partner status creates a
                  forward narrative hook ("I want to see what happens") rather than
                  just a stats snapshot ("here's what you had"). */}
              <View style={styles.infoContainer}>
                {(() => {
                  // Calculate welcome bonus based on player income level. Uses the
                  // shared helper so the displayed amount is exactly what the
                  // caller grants on close.
                  const welcomeBonus = computeWelcomeBackBonus(gameState, daysAway);
                  const streakCount = gameState.playStreak?.count || 0;
                  const pendingEventsCount = (gameState.pendingEvents || []).length;
                  const hasCliffhanger = !!gameState.pendingCliffhanger;
                  // What's COMING, from the same anticipation engine as the
                  // home dashboard's Week Ahead card. The game does not
                  // simulate while closed, so the honest return summary is not
                  // a fabricated delta — it is where you stand plus what is
                  // already scheduled to land. Two rows: enough to create a
                  // reason to press Next Week, not enough to push the Continue
                  // button off-screen.
                  const coming = upcomingEvents(gameState, { limit: 2 });
                  // The same derived recommendation the home screen shows, so the
                  // return screen and the dashboard cannot tell the player two
                  // different things. Pure and cheap; nothing is stored or paid.
                  const nextGoal = primaryGoal(gameState);
                  const neglectedPartner = (gameState.relationships || []).find(
                    (r: any) =>
                      (r?.type === 'partner' || r?.type === 'spouse') &&
                      typeof r?.relationshipScore === 'number' &&
                      r.relationshipScore <= 40
                  );
                  return (
                    <>
                      <View style={styles.infoRow}>
                        <View style={styles.infoIcon}>
                          <DollarSign size={scale(18)} color="#10B981" />
                        </View>
                        <Text style={[styles.infoText, isDarkMode && styles.infoTextDark]}>
                          Welcome back bonus: +{formatMoney(welcomeBonus)}
                        </Text>
                      </View>
                      {streakCount > 1 && (
                        <View style={styles.infoRow}>
                          <View style={styles.infoIcon}>
                            <TrendingUp size={scale(18)} color="#F59E0B" />
                          </View>
                          <Text style={[styles.infoText, isDarkMode && styles.infoTextDark]}>
                            {/* The counter counts consecutive WEEKS PLAYED
                                (week-advances under 48h apart), not calendar
                                days — the old "N days" label promised a daily
                                habit the code never measured. */}
                            Play streak: {streakCount} weeks in a row (+{Math.min(streakCount * 2, 20)}% income)
                          </Text>
                        </View>
                      )}
                      {coming.map((u) => (
                        <View style={styles.infoRow} key={u.id}>
                          <View style={styles.infoIcon}>
                            <CalendarClock size={scale(18)} color="#0EA5E9" />
                          </View>
                          <Text
                            style={[styles.infoText, isDarkMode && styles.infoTextDark]}
                            numberOfLines={2}
                          >
                            {u.weeksAway <= 0
                              ? `This week: ${u.title}`
                              : u.weeksAway === 1
                                ? `Next week: ${u.title}`
                                : `In ${u.weeksAway} weeks: ${u.title}`}
                          </Text>
                        </View>
                      ))}
                      {pendingEventsCount > 0 && (
                        <View style={styles.infoRow}>
                          <View style={styles.infoIcon}>
                            <Mail size={scale(18)} color="#3B82F6" />
                          </View>
                          <Text style={[styles.infoText, isDarkMode && styles.infoTextDark]}>
                            {pendingEventsCount === 1
                              ? '1 event is waiting for your decision'
                              : `${pendingEventsCount} events are waiting for your decision`}
                          </Text>
                        </View>
                      )}
                      {hasCliffhanger && (
                        <View style={styles.infoRow}>
                          <View style={styles.infoIcon}>
                            <BookOpen size={scale(18)} color="#A855F7" />
                          </View>
                          <Text style={[styles.infoText, isDarkMode && styles.infoTextDark]} numberOfLines={2}>
                            Story unresolved: {gameState.pendingCliffhanger?.teaser || 'something happened while you were away.'}
                          </Text>
                        </View>
                      )}
                      {neglectedPartner && (
                        <View style={styles.infoRow}>
                          <View style={styles.infoIcon}>
                            <Heart size={scale(18)} color="#EF4444" />
                          </View>
                          <Text style={[styles.infoText, isDarkMode && styles.infoTextDark]}>
                            {neglectedPartner.name || 'Your partner'} has been missing you.
                          </Text>
                        </View>
                      )}
                      {/* The one FORWARD-looking line on a screen that is
                          otherwise entirely a report of the past.
                        
                          This replaced "Continue your life journey" - a row that
                          occupied the most valuable slot on the return screen and
                          told the player nothing they did not already know. The
                          return screen's job is to answer "what happened while I
                          was away", and then "so what do I do now"; without the
                          second half it closes on a shrug.
                        
                          Derived, never stored, and it pays nothing - the same
                          read-only recommendation the home screen shows, so the
                          two surfaces cannot disagree. Falls back to the original
                          line when no goal is eligible. */}
                      <View style={styles.infoRow}>
                        <View style={styles.infoIcon}>
                          <Zap size={scale(18)} color="#8B5CF6" />
                        </View>
                        <Text
                          style={[styles.infoText, isDarkMode && styles.infoTextDark]}
                          numberOfLines={2}
                        >
                          {nextGoal
                            ? `Next: ${nextGoal.title} - ${nextGoal.progressLabel}`
                            : 'Continue your life journey'}
                        </Text>
                      </View>
                    </>
                  );
                })()}
              </View>
            </ScrollView>

            {/* Action Button - pinned OUTSIDE the scroller, because it is the
                only way to dismiss this popup. */}
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleClose}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.continueButtonGradient}
              >
                <Text style={styles.continueButtonText}>Continue Playing</Text>
                <ArrowRight size={scale(20)} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsivePadding.horizontal,
  },
  container: {
    width: '100%',
    maxWidth: scale(420),
    position: 'relative',
    // The bound the scroll area shrinks within. Without something bounded
    // above it `flexShrink` is a no-op and the card just grows off-screen
    // again. '100%' is the overlay's height minus its padding.
    maxHeight: '100%',
  },
  glowCircle: {
    position: 'absolute',
    top: -60,
    left: '50%',
    marginLeft: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#3B82F6',
    boxShadow: '0px 0px 40px rgba(59, 130, 246, 0.6)',
    ...Platform.select({
      web: { boxShadow: '0px 0px 40px rgba(59, 130, 246, 0.6)' } as any,
      default: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 40,
      },
    }),
    elevation: 10,
  },
  content: {
    borderRadius: responsiveBorderRadius.xl,
    padding: responsiveSpacing.xl,
    // `stretch` rather than `center` so the ScrollView spans the card width;
    // the children that wanted centring get it from `scrollContent`.
    alignItems: 'stretch',
    flexShrink: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    boxShadow: '0px 8px 20px rgba(0, 0, 0, 0.3)',
    ...Platform.select({
      web: { boxShadow: '0px 8px 20px rgba(0, 0, 0, 0.3)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
    }),
    elevation: 12,
  },
  scrollArea: {
    flexShrink: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: responsiveSpacing.lg,
  },
  iconContainer: {
    position: 'relative',
    width: scale(88),
    height: scale(88),
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconGradient: {
    width: scale(88),
    height: scale(88),
    borderRadius: scale(44),
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0px 4px 12px rgba(59, 130, 246, 0.4)' } as any,
      default: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
    }),
    elevation: 8,
  },
  sparkleAccent: {
    position: 'absolute',
  },
  sparkleTopLeft: {
    top: scale(-4),
    left: scale(-4),
  },
  sparkleTopRight: {
    top: scale(-2),
    right: scale(-2),
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: responsiveSpacing.xl,
  },
  title: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  timeAwayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  timeAway: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  timeAwayDark: {
    color: '#94A3B8',
  },
  statsContainer: {
    width: '100%',
    gap: responsiveSpacing.md,
    marginBottom: responsiveSpacing.lg,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statCardDark: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statIconContainer: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    // Neutral slate chip - reads correctly behind any icon color (the previous
    // fixed green tint clashed with the red Heart in the Life Progress card).
    backgroundColor: 'rgba(148,163,184,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.md,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: scale(2),
  },
  statLabelDark: {
    color: '#94A3B8',
  },
  statValue: {
    fontSize: responsiveFontSize.base,
    color: '#1E293B',
    fontWeight: '700',
  },
  statValueDark: {
    color: '#FFFFFF',
  },
  infoContainer: {
    width: '100%',
    marginBottom: responsiveSpacing.xl,
    gap: responsiveSpacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.sm,
  },
  infoIcon: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    // Neutral slate chip - reads correctly behind every icon color used in the
    // info rows (green, amber, blue, purple, red) instead of a fixed purple.
    backgroundColor: 'rgba(148,163,184,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.md,
  },
  infoText: {
    fontSize: responsiveFontSize.sm,
    color: '#4B5563',
    flex: 1,
    fontWeight: '500',
  },
  infoTextDark: {
    color: '#D1D5DB',
  },
  continueButton: {
    width: '100%',
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0px 6px 12px rgba(59, 130, 246, 0.4)' } as any,
      default: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
    }),
    elevation: 10,
  },
  continueButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.lg,
    gap: responsiveSpacing.sm,
  },
  continueButtonText: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});


