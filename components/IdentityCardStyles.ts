import { colors, uiPalette } from '@/lib/config/theme';
/**
 * Styles for IdentityCard. Extracted verbatim to slim the component file.
 * Static module-level StyleSheet.
 */
import { Platform, StyleSheet } from 'react-native';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, fontScale } from '@/utils/scaling';
import { getShadow } from '@/utils/shadow';
import { rhythm, tier2, tier4 } from '@/lib/config/hierarchy';

export const styles = StyleSheet.create({
  cardContainer: {
    position: 'relative',
    width: '100%',
  },
  card: {
    borderRadius: responsiveBorderRadius.xl,
    padding: responsiveSpacing.xl,
    marginBottom: responsiveSpacing.lg,
    alignItems: 'center',
    width: '100%',
    backgroundColor: uiPalette.surface,
    borderWidth: 0,
  },
  /** The compact identity strip (Program 4): avatar · name + facts · net worth. */
  heroBackdrop: { position: 'absolute', right: 0, bottom: 0, width: '70%', height: scale(80), opacity: 0.12 },
  recordHeader: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', gap: responsiveSpacing.sm },
  recordLabel: { ...tier4, color: uiPalette.muted, letterSpacing: 1, fontVariant: ['tabular-nums'] },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
    minHeight: scale(120),
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    alignItems: 'center',
    gap: scale(12),
    padding: responsiveSpacing.md,
    marginBottom: rhythm.tight,
  },
  stripAvatar: {
    position: 'relative',
  },
  stripText: {
    flex: 1,
    minWidth: scale(120),
    gap: scale(8),
  },
  stripMeta: {
    ...tier4,
    color: uiPalette.muted,
  },
  stripWorth: {
    flexShrink: 0,
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: scale(8),
    minHeight: scale(44),
    justifyContent: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.dark.border,
    paddingTop: responsiveSpacing.sm,
  },
  stripWorthValue: {
    fontSize: fontScale(17),
    lineHeight: fontScale(22),
    fontWeight: '600',
    color: uiPalette.paper,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  stripWorthLabel: {
    ...tier4,
    color: uiPalette.muted,
  },
  stripFlow: {
    ...tier4,
    fontVariant: ['tabular-nums'],
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
  },
  avatar: {
    width: scale(68),
    height: scale(68),
    borderRadius: responsiveBorderRadius.md,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    // Now wraps an SVG rather than being an <Image>: centre and clip the child
    // so the ring stays a ring.
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // Light mode: subtle shadow for the avatar
    ...Platform.select({
      web: { boxShadow: '0px 2px 6px rgba(59, 130, 246, 0.2)' } as any,
      default: {
        shadowColor: 'rgba(59, 130, 246, 0.2)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
      },
    }),
  },
  avatarGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    top: -3,
    left: -3,
    zIndex: -1,
  },
  name: {
    ...tier2,
    fontSize: fontScale(16),
    lineHeight: fontScale(21),
    color: uiPalette.navy,
    // Light mode: subtle text shadow for name
    ...Platform.select({
      web: { textShadow: '0px 1px 2px rgba(0,0,0,0.1)' } as any,
      default: {
        textShadowColor: 'rgba(0,0,0,0.1)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
      },
    }),
    letterSpacing: -0.5,
  },
  nameDark: {
    color: uiPalette.paper,
    textShadowColor: 'transparent',
  },
  text: {
    fontSize: responsiveFontSize.lg,
    color: uiPalette.surface,
    marginBottom: 2,
    fontWeight: '600',
  },
  textDark: {
    color: uiPalette.secondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: responsiveSpacing.lg,
    width: '100%',
    gap: responsiveSpacing.sm,
  },
  statItem: {
    // Equal halves with one consistent gap — guarantees pixel-perfect symmetry.
    flexBasis: 0,
    flexGrow: 1,
    minWidth: '47%',
    height: responsiveSpacing['4xl'], // fixed height across all four cards
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: responsiveBorderRadius.md,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  statLabel: {
    fontSize: responsiveFontSize.xs,
    color: 'rgba(226, 232, 240, 0.55)',
    marginBottom: 4,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  statLabelDark: {
    color: 'rgba(226, 232, 240, 0.55)',
  },
  statValue: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
    color: uiPalette.paper,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  statValueDark: {
    color: uiPalette.paper,
  },
  list: {
    borderRadius: responsiveBorderRadius.xl,
    marginBottom: responsiveSpacing.lg,
    width: '100%',
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
    }),
    elevation: 4,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    minHeight: scale(44),
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  listLabel: {
    fontSize: fontScale(14),
    color: uiPalette.slate,
    marginLeft: responsiveSpacing.sm,
  },
  listLabelDark: {
    color: uiPalette.paper,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    borderRadius: scale(20),
    padding: 0,
    width: '95%',
    maxWidth: scale(600),
    height: '90%',
    maxHeight: scale(800),
    backgroundColor: uiPalette.white,
    overflow: 'hidden',
    ...getShadow(20, '#000'),
  },
  modalDark: {
    backgroundColor: uiPalette.surface,
  },
  modalHeaderNew: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: scale(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    minHeight: scale(60),
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    flex: 1,
    marginRight: scale(12),
  },
  modalTitleNew: {
    fontSize: fontScale(22),
    fontWeight: 'bold',
    color: uiPalette.navy,
    flexShrink: 1,
  },
  modalTitleNewDark: {
    color: uiPalette.paper,
  },
  modalCloseButton: {
    padding: scale(8),
    minWidth: scale(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: 'bold',
    color: uiPalette.surface,
    textAlign: 'center',
  },
  modalTitleDark: {
    color: uiPalette.paper,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: scale(20),
    paddingBottom: scale(30),
    flexGrow: 1,
  },
  modalSection: {
    marginBottom: scale(28),
  },
  modalSectionTitle: {
    fontSize: fontScale(22),
    fontWeight: '700',
    color: uiPalette.navy,
    marginBottom: scale(18),
    lineHeight: fontScale(28),
  },
  modalSectionTitleDark: {
    color: uiPalette.white,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: uiPalette.paper,
    borderRadius: scale(12),
    padding: scale(18),
    marginBottom: scale(14),
    gap: scale(10),
    borderWidth: 1,
    borderColor: uiPalette.line,
    minHeight: scale(50),
  },
  modalItemDark: {
    backgroundColor: uiPalette.slate,
    borderColor: uiPalette.lightSecondary,
  },
  modalText: {
    fontSize: fontScale(17),
    color: uiPalette.surface,
    flex: 1,
    fontWeight: '600',
    lineHeight: fontScale(24),
  },
  modalTextDark: {
    color: uiPalette.white,
  },
  modalSubText: {
    fontSize: fontScale(15),
    color: uiPalette.muted,
    flex: 1,
    lineHeight: fontScale(22),
  },
  modalSubTextDark: {
    color: uiPalette.muted,
  },
  negativeText: {
    color: '#DC2626',
  },
  closeButton: {
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  closeText: {
    fontSize: responsiveFontSize.lg,
    color: uiPalette.white,
    fontWeight: '600',
  },

  // Trait bonus styles
  traitContainer: {
    backgroundColor: uiPalette.paper,
    borderRadius: scale(12),
    padding: scale(18),
    marginBottom: scale(14),
    borderWidth: 1,
    borderColor: uiPalette.line,
    minHeight: scale(60),
  },
  traitContainerDark: {
    backgroundColor: uiPalette.slate,
    borderColor: uiPalette.lightSecondary,
  },
  traitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.xs,
  },
  traitName: {
    fontSize: fontScale(17),
    fontWeight: '600',
    color: uiPalette.surface,
    marginLeft: responsiveSpacing.xs,
    lineHeight: fontScale(24),
  },
  traitNameDark: {
    color: uiPalette.paper,
  },
  traitBonuses: {
    marginLeft: responsiveSpacing.lg,
  },
  bonusItem: {
    marginBottom: responsiveSpacing.xs,
  },
  bonusText: {
    fontSize: fontScale(15),
    color: uiPalette.muted,
    lineHeight: fontScale(22),
  },
  modalSubSection: {
    marginLeft: scale(16),
    marginBottom: scale(8),
    marginTop: scale(-4),
  },
  modalSubItem: {
    paddingVertical: scale(6),
    paddingLeft: scale(8),
  },
  modalSubItemDark: {
    // Inherit dark mode from parent
  },
  modalSubItemDetails: {
    marginTop: scale(2),
    marginLeft: scale(12),
  },
  bonusTextDark: {
    color: uiPalette.muted,
  },
  positiveBonus: {
    color: '#10B981',
    fontWeight: '500',
  },
  negativeBonus: {
    color: '#EF4444',
    fontWeight: '500',
  },
  youthPillButton: {
    // Pinned to the Age card's corner so the centered label+value stay
    // symmetrical with the other three cards.
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: responsiveBorderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(165, 180, 252, 0.4)',
    gap: 3,
  },
  youthPillIcon: {
    width: 14,
    height: 14,
  },
  youthPillButtonText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
    color: '#C4B5FD',
    fontVariant: ['tabular-nums'],
  },
  prestigeBadge: {
    position: 'absolute',
    top: -responsiveSpacing.xs,
    right: -responsiveSpacing.xs,
    zIndex: 10,
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },
  // DeepLife+ crest — mirrors the prestige badge on the opposite (top-left)
  // corner of the avatar so the two never overlap.
  //
  // Pulled further out than the prestige badge's matching inset on purpose. The
  // crest is bigger than the coin it replaced, and it is a SQUARE mark sitting
  // against a round avatar: at the old -xs inset its lower-right corner pushed
  // into the character's hair and face. Hanging it off the avatar's edge lets it
  // read as a badge pinned to the portrait rather than something covering it.
  prestigeBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
    gap: 4,
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(245, 158, 11, 0.4)' } as any,
      default: {
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
      },
    }),
    elevation: 5,
  },
  prestigeBadgeText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: 'bold',
    color: uiPalette.white,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: scale(4),
    marginTop: scale(2),
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: scale(2),
    // Color matches the Flame icon (Tailwind orange-400) — consistent with
    // the prestige badge above which also uses inline orange/amber. There is
    // no semantic "streak" token in lib/config/theme.ts; keep literal until
    // theme tokens grow a `streak` entry, then migrate.
    backgroundColor: 'rgba(251, 146, 60, 0.15)',
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  streakBadgeText: {
    fontSize: fontScale(12),
    fontWeight: '700',
    color: '#FB923C',
    letterSpacing: scale(0.2),
  },
  positiveText: {
    color: '#059669',
  },
});
