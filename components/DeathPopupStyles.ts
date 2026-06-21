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
  getGlassIconContainer,
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
      // A DEFINITE height (not just maxHeight) is required: the card lays out as
      // a flex column with a flex:1 "page" containing a flex:1 ScrollView. A
      // ScrollView has no intrinsic height, so without a bounded parent height
      // the flex:1 page collapses to 0 and the tab content + footer vanish
      // (card ends right after the tab bar). Pinning the height resolves the
      // flex chain so the scroll area fills and the footer pins to the bottom.
      height: height * 0.9,
    },
    card: {
      width: '100%',
      flex: 1,
      borderRadius: scale(24),
      overflow: 'hidden',
      ...getPlatformShadows(12, 0.3, 8, 24),
      flexDirection: 'column',
    },
    // Each tab renders a full "page": a flex-filling scroll area above a pinned
    // footer. flex:1 lets the page consume all space between the top menu bar
    // and the bottom of the card so nothing overflows or gets clipped.
    page: {
      flex: 1,
      minHeight: 0,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: scale(20),
      paddingBottom: scale(16),
    },
    // Compact identity strip — persistent across both pages.
    identityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: scale(20),
      paddingTop: scale(20),
      paddingBottom: scale(14),
    },
    identityIcon: {
      ...getGlassIconContainer(darkMode, 48),
      marginRight: scale(14),
    },
    identityText: {
      flex: 1,
    },
    identityTitle: {
      fontSize: fontScale(22),
      fontWeight: '800',
      color: c.text,
      letterSpacing: -0.5,
    },
    identityName: {
      fontSize: fontScale(15),
      fontWeight: '700',
      color: c.text,
      marginTop: scale(2),
    },
    identityDetails: {
      fontSize: fontScale(12),
      color: c.textSecondary,
      marginTop: scale(1),
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
    // Cause-of-death banner at the top of the Summary page.
    causeCard: {
      ...getGlassContainer(darkMode, darkMode ? 0.3 : 0.5),
      borderRadius: scale(14),
      padding: scale(14),
      marginBottom: scale(16),
    },
    causeSubtitle: {
      fontSize: fontScale(15),
      fontWeight: '600',
      color: c.text,
      fontStyle: 'italic',
    },
    causeMessage: {
      fontSize: fontScale(13),
      color: c.textSecondary,
      marginTop: scale(4),
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(8),
      marginBottom: scale(12),
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
    // Pinned action footer at the bottom of each page.
    footer: {
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
      fontSize: fontScale(16),
      fontWeight: '700',
    },
    newLifeButton: {},
    disabledButton: {
      opacity: 0.5,
    },
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
    ribbonBanner: {
      ...getGlassContainer(darkMode),
      flexDirection: 'row',
      alignItems: 'center',
      padding: scale(14),
      borderRadius: scale(12),
      borderLeftWidth: scale(4),
    },
    ribbonEmoji: {
      fontSize: fontScale(36),
      marginRight: scale(12),
    },
    ribbonTextContainer: {
      flex: 1,
    },
    ribbonName: {
      fontSize: fontScale(18),
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    ribbonDesc: {
      fontSize: fontScale(12),
      color: c.textSecondary,
      marginTop: scale(2),
    },
    rewindSection: {
      ...getGlassContainer(darkMode, darkMode ? 0.12 : 0.08),
      backgroundColor: darkMode ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
      marginTop: scale(8),
      padding: scale(12),
      borderRadius: scale(10),
    },
    rewindTitle: {
      fontSize: fontScale(13),
      fontWeight: '700',
      color: accent.warning,
      textAlign: 'center',
      marginBottom: scale(8),
    },
    rewindChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(6),
      paddingVertical: scale(8),
      paddingHorizontal: scale(12),
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      borderRadius: scale(8),
      marginBottom: scale(4),
    },
    rewindChipText: {
      fontSize: fontScale(13),
      fontWeight: '600',
      color: accent.warning,
    },
  });
}

export type DeathPopupStyles = ReturnType<typeof createStyles>;
