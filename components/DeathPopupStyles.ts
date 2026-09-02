/**
 * Styles for DeathPopup.
 *
 * Theme-aware factory: call `createStyles(darkMode)` to get a StyleSheet whose
 * colors are routed through the design tokens in `lib/config/theme.ts` and whose
 * translucent surfaces use the shared glassmorphism helpers in
 * `utils/glassmorphismStyles.ts`. Layout/sizing is derived from the window the
 * same way the component did.
 */
import { Dimensions, StyleSheet } from 'react-native';
import { scale, fontScale } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { getThemeColors, accent, colors as theme } from '@/lib/config/theme';
import {
  getGlassCard,
  getGlassContainer,
  getGlassButton,
  getPlatformShadows,
} from '@/utils/glassmorphismStyles';

const { width, height } = Dimensions.get('window');

/**
 * Build the DeathPopup StyleSheet for the active color mode.
 *
 * @param darkMode - whether the player has dark mode enabled
 */
export function createStyles(darkMode: boolean) {
  const c = getThemeColors(darkMode);

  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: Z_INDEX.MODAL,
    },
    overlay: {
      position: 'absolute',
      width: width,
      height: height,
      // Strong scrim so the death screen reads as a hard stop, independent of mode.
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
    },
    content: {
      width: width * 0.9,
      maxWidth: 420,
      // A DEFINITE height (not just maxHeight) is still required. The chain is
      // content → card (flex:1) → ScrollView (flex:1), and a ScrollView has no
      // intrinsic height: without a bounded ancestor the card sizes to its
      // children, the children are a ScrollView measuring 0, and the whole card
      // collapses. Pinning the height here is what gives the single scroll
      // surface something definite to fill.
      height: height * 0.9,
    },
    card: {
      width: '100%',
      flex: 1,
      borderRadius: scale(24),
      overflow: 'hidden',
      // The card's gradient flattens to near-black under the fallback and would
      // vanish against the scrim — pin the slate surface token as a solid fill.
      backgroundColor: c.surface,
      ...getPlatformShadows(12, 0.3, 8, 24),
      flexDirection: 'column',
    },
    // The card is ONE scroll surface: hero, identity card, tab bar, the active
    // page and its actions all scroll together. Nothing is pinned.
    //
    // The previous shape pinned the hero above the scroller and the action rows
    // below it, so the scroller only got what was left over — and on a small
    // phone the Summary action stack alone is taller than that, which left the
    // scroll area at zero height and clipped "Start New Life" off the card.
    scrollView: {
      flex: 1,
    },
    // No horizontal padding here: the hero illustration is full-bleed and the
    // identity card / tab bar carry their own insets, exactly as they did when
    // they were direct children of the card. The per-tab content is padded by
    // `pageContent` instead.
    scrollContent: {
      paddingBottom: scale(8),
    },
    // The body of whichever tab is active.
    pageContent: {
      padding: scale(20),
      paddingBottom: scale(4),
    },
    // ── Hero: the verdict, centred under the illustration ──────────────────
    // Centred rather than left-aligned because this is the one screen in the
    // game that is not a dashboard. It is an ending, and an ending reads down
    // the middle.
    hero: {
      alignItems: 'center',
      paddingHorizontal: scale(24),
      // Pulled up into the illustration so the title sits ON the artwork's
      // lower edge, the way the design has it, rather than in a band below it.
      marginTop: -scale(18),
      marginBottom: scale(14),
    },
    heroTitle: {
      fontSize: fontScale(40),
      lineHeight: fontScale(46),
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -1,
      textAlign: 'center',
    },
    heroSubtitle: {
      fontSize: fontScale(14.5),
      fontWeight: '600',
      color: darkMode ? '#A78BFA' : '#6D28D9',
      textAlign: 'center',
      marginTop: scale(6),
    },
    heroCause: {
      fontSize: fontScale(13),
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: scale(3),
    },
    // ── Identity card — portrait, name, age ────────────────────────────────
    identityCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(14),
      marginHorizontal: scale(16),
      padding: scale(12),
      borderRadius: scale(16),
      backgroundColor: darkMode ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.03)',
      // Full four-sided border. Hard Rule #7 bans the one-sided decorative
      // kind; an outlined card is the sanctioned form.
      borderWidth: 1,
      borderColor: c.border,
    },
    identityAvatarRing: {
      width: scale(58),
      height: scale(58),
      borderRadius: scale(29),
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: scale(2),
      borderColor: darkMode ? '#7C4DFF' : '#7C3AED',
      overflow: 'hidden',
    },
    identityAvatar: {
      width: '100%',
      height: '100%',
      borderRadius: scale(29),
    },
    identityText: {
      flex: 1,
    },
    identityName: {
      fontSize: fontScale(21),
      fontWeight: '800',
      color: c.text,
      letterSpacing: -0.4,
    },
    identityDetails: {
      fontSize: fontScale(13),
      color: c.textSecondary,
      marginTop: scale(2),
    },
    identityAge: {
      color: darkMode ? '#A78BFA' : '#6D28D9',
      fontWeight: '700',
    },
    // TOP MENU BAR — segmented control switching between pages.
    topBar: {
      paddingHorizontal: scale(16),
      paddingBottom: scale(12),
    },
    segmented: {
      flexDirection: 'row',
      ...getGlassContainer(darkMode, darkMode ? 0.4 : 0.6),
      borderRadius: scale(12),
      padding: scale(4),
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: scale(6),
      paddingVertical: scale(10),
      borderRadius: scale(9),
    },
    segmentActive: {
      backgroundColor: theme.palette.primary,
    },
    segmentText: {
      fontSize: fontScale(14),
      fontWeight: '600',
      color: c.textSecondary,
    },
    segmentTextActive: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    // ── Verdict: the earned ribbon and the Life Quality arc, side by side ──
    // One card, because they are two readings of the same life. Split apart,
    // a LEGENDARY ribbon can sit above a 30% gauge with nothing reconciling
    // them and the player is right to call that broken.
    verdictCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(14),
      padding: scale(14),
      borderRadius: scale(16),
      backgroundColor: darkMode ? 'rgba(124,77,255,0.07)' : 'rgba(124,58,237,0.05)',
      borderWidth: 1,
      borderColor: darkMode ? 'rgba(124,77,255,0.22)' : 'rgba(124,58,237,0.18)',
    },
    verdictText: { flex: 1, gap: scale(4) },
    verdictName: {
      fontSize: fontScale(17),
      fontWeight: '800',
      letterSpacing: 0.3,
      color: darkMode ? '#A78BFA' : '#6D28D9',
    },
    verdictDesc: {
      fontSize: fontScale(12.5),
      lineHeight: fontScale(17),
      color: c.textSecondary,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(10),
      marginBottom: scale(12),
    },
    sectionIcon: {
      width: scale(32),
      height: scale(32),
      borderRadius: scale(10),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: darkMode ? 'rgba(124,77,255,0.16)' : 'rgba(124,58,237,0.10)',
      borderWidth: 1,
      borderColor: darkMode ? 'rgba(124,77,255,0.3)' : 'rgba(124,58,237,0.2)',
    },
    summaryCard: {
      ...getGlassCard(darkMode),
      borderRadius: scale(16),
      padding: scale(16),
      gap: scale(12),
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: scale(4),
    },
    summaryIconContainer: {
      width: scale(36),
      height: scale(36),
      borderRadius: scale(18),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: scale(12),
    },
    summaryContent: {
      flex: 1,
    },
    summaryLabel: {
      fontSize: fontScale(12),
      color: c.textSecondary,
      marginBottom: scale(2),
      fontWeight: '500',
    },
    summaryValue: {
      fontSize: fontScale(14),
      fontWeight: '600',
      color: c.text,
    },
    achievementsList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: scale(6),
      marginTop: scale(8),
      paddingTop: scale(12),
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    achievementBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(4),
      backgroundColor: darkMode ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
      paddingHorizontal: scale(10),
      paddingVertical: scale(6),
      borderRadius: scale(8),
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    achievementText: {
      fontSize: fontScale(11),
      fontWeight: '600',
      color: darkMode ? accent.gold : '#92400E',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: scale(12),
      marginTop: scale(8),
    },
    statBox: {
      ...getGlassContainer(darkMode, darkMode ? 0.4 : 0.6),
      flex: 1,
      minWidth: scale(100),
      borderRadius: scale(12),
      padding: scale(12),
      alignItems: 'center',
    },
    statBoxLabel: {
      fontSize: fontScale(11),
      color: c.textSecondary,
      marginBottom: scale(4),
      fontWeight: '500',
      textAlign: 'center',
    },
    statBoxValue: {
      fontSize: fontScale(16),
      fontWeight: '700',
      color: c.text,
      textAlign: 'center',
    },
    statsContainer: {
      flexDirection: 'row',
      gap: scale(12),
      marginBottom: scale(24),
    },
    statCard: {
      ...getGlassCard(darkMode),
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: scale(16),
      padding: scale(16),
    },
    statIconContainer: {
      width: scale(40),
      height: scale(40),
      borderRadius: scale(20),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: scale(12),
    },
    statContent: {
      flex: 1,
    },
    statLabel: {
      fontSize: fontScale(12),
      color: c.textSecondary,
      marginBottom: scale(2),
    },
    statValue: {
      fontSize: fontScale(18),
      fontWeight: '700',
      color: c.text,
    },
    section: {
      marginBottom: scale(24),
    },
    sectionTitle: {
      fontSize: fontScale(20),
      fontWeight: '700',
      color: c.text,
      marginBottom: scale(12),
    },
    breakdownCard: {
      ...getGlassCard(darkMode),
      borderRadius: scale(16),
      padding: scale(16),
    },
    breakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: scale(8),
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    breakdownLabel: {
      fontSize: fontScale(14),
      color: c.textSecondary,
      fontWeight: '500',
    },
    breakdownValue: {
      fontSize: fontScale(14),
      fontWeight: '600',
      color: c.text,
    },
    bonusesCard: {
      ...getGlassCard(darkMode),
      borderRadius: scale(16),
      padding: scale(16),
      gap: scale(12),
    },
    bonusItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    bonusIconContainer: {
      width: scale(32),
      height: scale(32),
      borderRadius: scale(16),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: scale(12),
    },
    bonusContent: {
      flex: 1,
    },
    bonusLabel: {
      fontSize: fontScale(12),
      color: c.textSecondary,
      marginBottom: scale(2),
    },
    bonusValue: {
      fontSize: fontScale(16),
      fontWeight: '700',
      color: accent.success,
    },
    // The action block that closes each page. It is the TAIL OF THE SCROLL, not
    // a pinned footer — pinning it is what made the Summary tab unscrollable.
    // The hairline above it is a section divider (a Rule #7 exception), not a
    // decorative accent bar.
    actions: {
      padding: scale(16),
      paddingTop: scale(14),
      gap: scale(10),
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)',
    },
    actionButton: {
      borderRadius: scale(14),
      overflow: 'hidden',
    },
    buttonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: scale(16),
      gap: scale(8),
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: fontScale(17),
      fontWeight: '700',
    },
    buttonSubtext: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: fontScale(12),
      marginTop: scale(1),
    },
    newLifeButton: {},
    disabledButton: {
      opacity: 0.6,
    },
    // ── Option rows: revive / gems / rewind ────────────────────────────────
    // A full-width row that states what it does and what it costs on one line,
    // instead of a pill with the price crammed into its label.
    //
    // Full four-sided borders throughout (Rule #7). The colour still carries
    // the meaning — pink is the paid second chance, amber is the cheaper
    // rewind — it just carries it on all four sides instead of a stripe.
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(12),
      padding: scale(12),
      borderRadius: scale(16),
      backgroundColor: darkMode ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.03)',
      borderWidth: 1,
      borderColor: c.border,
    },
    optionRevive: {
      backgroundColor: darkMode ? 'rgba(236,72,153,0.09)' : 'rgba(236,72,153,0.06)',
      borderColor: darkMode ? 'rgba(236,72,153,0.28)' : 'rgba(236,72,153,0.22)',
    },
    optionRewind: {
      backgroundColor: darkMode ? 'rgba(245,158,11,0.09)' : 'rgba(245,158,11,0.06)',
      borderColor: darkMode ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.24)',
    },
    optionIcon: {
      width: scale(42),
      height: scale(42),
      borderRadius: scale(12),
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionIconRevive: { backgroundColor: darkMode ? 'rgba(236,72,153,0.14)' : 'rgba(236,72,153,0.10)' },
    optionIconRewind: { backgroundColor: darkMode ? 'rgba(245,158,11,0.14)' : 'rgba(245,158,11,0.10)' },
    optionText: { flex: 1 },
    optionTitle: {
      fontSize: fontScale(15.5),
      fontWeight: '700',
      color: c.text,
    },
    optionTitleRewind: { color: accent.warning },
    optionSubtitle: {
      fontSize: fontScale(12),
      color: c.textSecondary,
      marginTop: scale(1),
    },
    optionSubtitleRewind: { color: darkMode ? 'rgba(245,158,11,0.75)' : '#92400E' },
    optionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(4),
      paddingHorizontal: scale(10),
      paddingVertical: scale(6),
      borderRadius: scale(10),
      borderWidth: 1,
      borderColor: c.border,
    },
    optionPillRevive: { borderColor: darkMode ? 'rgba(236,72,153,0.4)' : 'rgba(236,72,153,0.3)' },
    optionPillRewind: { borderColor: darkMode ? 'rgba(245,158,11,0.45)' : 'rgba(245,158,11,0.35)' },
    // The row stays tappable when unaffordable — that tap is the only route
    // into the store bridge — so only the PRICE dims. Nothing else about the
    // row pretends to be unavailable, because it is not.
    optionPillShort: { opacity: 0.45 },
    optionPillText: {
      fontSize: fontScale(13.5),
      fontWeight: '700',
      color: c.text,
    },
    optionPillTextRevive: { color: '#F472B6' },
    optionPillTextRewind: { color: accent.warning },
    // Streamlined secondary actions (Read Story + Share)
    secondaryRow: {
      flexDirection: 'row',
      gap: scale(10),
      marginTop: scale(2),
    },
    secondaryButton: {
      ...getGlassButton(darkMode),
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: scale(6),
      paddingVertical: scale(11),
      borderRadius: scale(12),
    },
    secondaryButtonText: {
      fontSize: fontScale(13),
      fontWeight: '600',
      color: c.text,
    },
    // Children Selection Styles
    childrenNote: {
      fontSize: fontScale(12),
      color: c.textSecondary,
      marginBottom: scale(12),
      fontStyle: 'italic',
      lineHeight: fontScale(16),
    },
    childrenList: {
      gap: scale(12),
    },
    childCard: {
      ...getGlassCard(darkMode),
      borderRadius: scale(16),
      padding: scale(16),
      borderWidth: 2,
      borderColor: 'transparent',
    },
    childCardSelected: {
      borderColor: accent.info,
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
    },
    childCardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: scale(12),
    },
    childImage: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      width: scale(56),
      height: scale(56),
      borderRadius: scale(28),
      marginRight: scale(12),
    },
    childInfo: {
      flex: 1,
    },
    childName: {
      fontSize: fontScale(18),
      fontWeight: '700',
      color: c.text,
      marginBottom: scale(4),
    },
    childDetails: {
      fontSize: fontScale(13),
      color: c.textSecondary,
      marginBottom: scale(6),
    },
    childNetWorthCard: {
      ...getGlassContainer(darkMode, 0.15),
      backgroundColor: darkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
      borderRadius: scale(12),
      padding: scale(12),
    },
    childNetWorthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(8),
      marginBottom: scale(4),
    },
    childNetWorthLabel: {
      fontSize: fontScale(12),
      color: c.textSecondary,
      flex: 1,
    },
    childNetWorthValue: {
      fontSize: fontScale(18),
      fontWeight: '700',
      color: accent.success,
    },
    childInheritanceText: {
      fontSize: fontScale(11),
      color: c.textSecondary,
      marginTop: scale(4),
    },
    noChildrenCard: {
      ...getGlassContainer(darkMode),
      borderRadius: scale(16),
      padding: scale(24),
      alignItems: 'center',
      borderStyle: 'dashed',
    },
    noChildrenText: {
      fontSize: fontScale(14),
      color: c.textSecondary,
      marginTop: scale(12),
      textAlign: 'center',
      fontStyle: 'italic',
    },
    // Heir Selection Styles
    heirHeader: {
      padding: scale(20),
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    backButton: {
      marginBottom: scale(16),
      padding: scale(4),
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerIconContainer: {
      width: scale(48),
      height: scale(48),
      borderRadius: scale(24),
      backgroundColor: darkMode ? 'rgba(252, 211, 77, 0.15)' : 'rgba(245, 158, 11, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: scale(12),
    },
    heirTitle: {
      fontSize: fontScale(24),
      fontWeight: '700',
      color: c.text,
      marginBottom: scale(4),
    },
    heirSubtitle: {
      fontSize: fontScale(14),
      color: c.textSecondary,
    },
    heirNote: {
      fontSize: fontScale(11),
      color: c.textSecondary,
      marginTop: scale(4),
      fontStyle: 'italic',
    },
    heirScrollView: {
      flex: 1,
    },
    heirScrollContent: {
      padding: scale(20),
      paddingBottom: scale(16),
    },
    heirCard: {
      ...getGlassCard(darkMode),
      borderRadius: scale(20),
      padding: scale(20),
      marginBottom: scale(16),
      borderWidth: 2,
      borderColor: 'transparent',
    },
    heirCardSelected: {
      borderColor: accent.info,
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
    },
    heirCardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: scale(16),
    },
    heirImage: {
      width: scale(64),
      height: scale(64),
      borderRadius: scale(32),
      marginRight: scale(16),
    },
    heirInfo: {
      flex: 1,
    },
    heirName: {
      fontSize: fontScale(20),
      fontWeight: '700',
      color: c.text,
      marginBottom: scale(4),
    },
    heirDetails: {
      fontSize: fontScale(14),
      color: c.textSecondary,
      marginBottom: scale(8),
    },
    badgeContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: scale(6),
      marginTop: scale(4),
    },
    badge: {
      paddingHorizontal: scale(10),
      paddingVertical: scale(4),
      borderRadius: scale(8),
    },
    badgeText: {
      fontSize: fontScale(11),
      fontWeight: '600',
    },
    selectedBadge: {
      width: scale(32),
      height: scale(32),
      borderRadius: scale(16),
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    inheritanceCard: {
      ...getGlassContainer(darkMode, 0.15),
      backgroundColor: darkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
      borderRadius: scale(12),
      padding: scale(12),
      marginBottom: scale(16),
    },
    inheritanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(8),
    },
    inheritanceLabel: {
      fontSize: fontScale(12),
      color: c.textSecondary,
      flex: 1,
    },
    inheritanceValue: {
      fontSize: fontScale(18),
      fontWeight: '700',
      color: accent.success,
    },
    savingsText: {
      fontSize: fontScale(11),
      color: c.textSecondary,
      marginTop: scale(4),
    },
    heirStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: scale(12),
      borderTopWidth: 1,
      borderTopColor: c.border,
      marginBottom: scale(12),
    },
    heirStatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(6),
    },
    heirStatValue: {
      fontSize: fontScale(14),
      fontWeight: '600',
      color: c.text,
    },
    traitsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: scale(6),
    },
    traitBadge: {
      paddingHorizontal: scale(10),
      paddingVertical: scale(4),
      borderRadius: scale(8),
    },
    traitText: {
      fontSize: fontScale(11),
      fontWeight: '600',
    },
    mindsetSection: {
      padding: scale(20),
      paddingTop: scale(16),
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    mindsetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(8),
      marginBottom: scale(12),
    },
    mindsetTitle: {
      fontSize: fontScale(16),
      fontWeight: '700',
      color: c.text,
    },
    mindsetScroll: {
      maxHeight: scale(120),
    },
    mindsetScrollContent: {
      gap: scale(8),
      paddingRight: scale(8),
    },
    mindsetOption: {
      ...getGlassButton(darkMode),
      minWidth: scale(120),
      padding: scale(12),
      borderRadius: scale(12),
      borderWidth: 2,
      borderColor: 'transparent',
      alignItems: 'center',
      position: 'relative',
    },
    mindsetOptionSelected: {
      borderColor: '#8B5CF6',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
    },
    mindsetIcon: {
      width: scale(40),
      height: scale(40),
      marginBottom: scale(8),
    },
    mindsetOptionName: {
      fontSize: fontScale(12),
      fontWeight: '600',
      color: c.text,
    },
    mindsetOptionNameSelected: {
      color: '#8B5CF6',
    },
    mindsetCheck: {
      position: 'absolute',
      top: scale(8),
      right: scale(8),
      width: scale(20),
      height: scale(20),
      borderRadius: scale(10),
      backgroundColor: '#8B5CF6',
      justifyContent: 'center',
      alignItems: 'center',
    },
    heirActions: {
      padding: scale(20),
      paddingTop: scale(16),
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    confirmButton: {
      borderRadius: scale(14),
      overflow: 'hidden',
    },
    // Prestige preview styles
    prestigePreviewCard: {
      ...getGlassContainer(darkMode, darkMode ? 0.12 : 0.08),
      backgroundColor: darkMode ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
      borderRadius: scale(12),
      padding: scale(16),
      alignItems: 'center' as const,
    },
    prestigePointsValue: {
      fontSize: fontScale(28),
      fontWeight: '800' as const,
      color: accent.warning,
      marginBottom: scale(4),
    },
    prestigeHint: {
      fontSize: fontScale(12),
      color: c.textSecondary,
      textAlign: 'center' as const,
      marginBottom: scale(12),
    },
    prestigeBuyList: {
      width: '100%',
      gap: scale(8),
    },
    prestigeBuyItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: scale(8),
      paddingVertical: scale(4),
    },
    prestigeBuyText: {
      fontSize: fontScale(12),
      color: c.text,
      flex: 1,
    },
  });
}

export type DeathPopupStyles = ReturnType<typeof createStyles>;
