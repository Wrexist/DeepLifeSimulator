/**
 * Styles for the Market screen (app/(tabs)/market.tsx).
 *
 * Extracted verbatim and kept outside app/ so expo-router does not treat it as
 * a route. Static module-level StyleSheet.
 *
 * House style: dark-glass surfaces (matches Health + the item cards), full
 * hairline borders (no side accent stripes — DEV.md Hard Rule 7), no textShadow,
 * no decorative gradients. Sizing via scale/fontScale.
 */
import { StyleSheet } from 'react-native';
import { fontScale, scale, responsiveBorderRadius, responsiveSpacing } from '@/utils/scaling';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import { accent } from '@/lib/config/theme';

const GLASS_BG = 'rgba(15, 23, 42, 0.55)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.08)';
const TEXT = '#F8FAFC';
const TEXT_SECONDARY = 'rgba(226, 232, 240, 0.65)';
const TEXT_MUTED = 'rgba(226, 232, 240, 0.45)';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  containerDark: {
    backgroundColor: '#020617',
  },
  // Segmented control tab bar — dark glass, active tab gets a tinted fill.
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: GLASS_BG,
    margin: responsiveSpacing.md,
    marginBottom: 0,
    borderRadius: responsiveBorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS_BORDER,
    padding: scale(4),
    gap: scale(4),
    zIndex: 10,
  },
  tabWithInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainerDark: {
    backgroundColor: GLASS_BG,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.sm,
    minHeight: scale(40),
  },
  activeTab: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
  },
  tabText: {
    fontSize: fontScale(12.5),
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  tabTextDark: {
    color: TEXT_MUTED,
  },
  activeTabText: {
    color: TEXT,
  },
  // The tab bar row: the segmented control plus the row's single info button.
  //
  // Opaque, and it owns the gap below itself. The control is translucent glass
  // and native has no backdrop filter (that is web-only), so a row sitting
  // directly on the scroll view let scrolled cards read straight through it —
  // which is what made the section header below look like it was sliding under
  // the tabs. A solid band and a real gap fix both halves.
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    backgroundColor: '#020617',
    paddingHorizontal: responsiveSpacing.md,
    paddingTop: responsiveSpacing.md,
    paddingBottom: responsiveSpacing.sm,
  },
  // Embedded in the Life tab: the primary Health/Shop/Stats control sits right
  // above, so tuck this secondary control up tight instead of adding a full gap.
  tabsRowEmbedded: {
    paddingTop: scale(2),
  },
  tabsControl: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: responsiveSpacing.md,
  },
  scrollContentDark: {},
  content: {
    paddingHorizontal: responsiveSpacing.md,
    paddingTop: responsiveSpacing.md,
  },
  contentDark: {},
  sectionDescription: {
    fontSize: fontScale(13),
    color: TEXT_SECONDARY,
    marginBottom: responsiveSpacing.sm,
    lineHeight: fontScale(19),
  },
  sectionDescriptionDark: {
    color: TEXT_SECONDARY,
  },
  // Inflation chip
  inflationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: scale(6),
    paddingHorizontal: scale(10),
    paddingVertical: scale(5),
    borderRadius: responsiveBorderRadius.full,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(249, 115, 22, 0.35)',
    marginBottom: responsiveSpacing.md,
  },
  inflationChipText: {
    fontSize: fontScale(11.5),
    fontWeight: '700',
    color: accent.amber,
    fontVariant: ['tabular-nums'],
  },
  // Filter bar — dark glass chips.
  filterContainer: {
    marginBottom: responsiveSpacing.md,
    flexGrow: 0,
    flexShrink: 0,
  },
  filterContent: {
    paddingHorizontal: scale(2),
    paddingVertical: scale(4),
    gap: scale(8),
    alignItems: 'center',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(14),
    paddingVertical: scale(8),
    borderRadius: responsiveBorderRadius.full,
    backgroundColor: GLASS_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS_BORDER,
    gap: scale(7),
  },
  filterButtonDark: {
    backgroundColor: GLASS_BG,
    borderColor: GLASS_BORDER,
  },
  filterButtonText: {
    fontSize: fontScale(12.5),
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  filterButtonTextDark: {
    color: TEXT_MUTED,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  filterCount: {
    paddingHorizontal: scale(6),
    paddingVertical: scale(1),
    borderRadius: responsiveBorderRadius.full,
    minWidth: scale(18),
    alignItems: 'center',
  },
  filterCountText: {
    fontSize: fontScale(10.5),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  // Named dead end for a filter chip that matches nothing — "Owned" in week 1
  // rendered nothing at all under the filter bar, which reads as a broken
  // screen rather than an empty shelf. Shape mirrors the Mail app's empty
  // state (icon, title, one line of why, an action back to something).
  emptyState: {
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    paddingHorizontal: responsiveSpacing.lg,
    paddingTop: scale(48),
    paddingBottom: scale(24),
  },
  emptyStateTitle: {
    fontSize: fontScale(15),
    fontWeight: '700',
    color: TEXT,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: fontScale(12.5),
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: fontScale(18),
  },
  emptyStateAction: {
    marginTop: responsiveSpacing.sm,
    fontSize: fontScale(13),
    fontWeight: '700',
    color: accent.info,
  },
  itemCard: {
    backgroundColor: GLASS_BG,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    marginBottom: responsiveSpacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: scale(12),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS_BORDER,
    ...getPlatformShadows(6, 0.25, 4, 14),
  },
  itemCardDark: {
    backgroundColor: GLASS_BG,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.2,
    marginBottom: scale(4),
  },
  itemNameDark: {
    color: TEXT,
  },
  itemDescription: {
    fontSize: fontScale(12),
    color: TEXT_SECONDARY,
    marginBottom: scale(4),
    lineHeight: fontScale(17),
  },
  itemDescriptionDark: {
    color: TEXT_SECONDARY,
  },
  itemPrice: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#34D399',
    letterSpacing: -0.2,
    marginBottom: scale(2),
    fontVariant: ['tabular-nums'],
  },
  // (The food cards' `bonusInfo` / `bonusTitle` / `bonusText` stack is gone —
  // per-stat effects now render through components/market/StatEffectChips.tsx,
  // which carries its own styles and the HUD's per-stat colors.)
  buyButton: {},
  sellButton: {},
  // Gym — single dark-glass card, no gradients.
  gymCard: {
    backgroundColor: GLASS_BG,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS_BORDER,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.md,
    gap: responsiveSpacing.md,
  },
  gymCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  gymIconContainer: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(13),
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  gymTitleContainer: {
    flex: 1,
  },
  gymCardTitle: {
    fontSize: fontScale(18),
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
    marginBottom: scale(2),
  },
  gymCardTitleDark: {
    color: TEXT,
  },
  gymCardSubtitle: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#93C5FD',
  },
  gymCardSubtitleDark: {
    color: '#93C5FD',
  },
  membershipWarningContainer: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  membershipWarningText: {
    fontSize: fontScale(14),
    fontWeight: '700',
    color: '#FCD34D',
    marginBottom: scale(3),
  },
  membershipWarningTextDark: {
    color: '#FCD34D',
  },
  membershipWarningSubtext: {
    fontSize: fontScale(12),
    color: 'rgba(252, 211, 77, 0.75)',
    lineHeight: fontScale(17),
  },
  membershipWarningSubtextDark: {
    color: 'rgba(252, 211, 77, 0.75)',
  },
  gymCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: responsiveSpacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GLASS_BORDER,
  },
  gymCostLabel: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gymCostLabelDark: {
    color: TEXT_MUTED,
  },
  gymCostValue: {
    fontSize: fontScale(15),
    fontWeight: '800',
    color: TEXT,
    fontVariant: ['tabular-nums'],
  },
  gymCostValueDark: {
    color: TEXT,
  },
  gymButton: {
    borderRadius: responsiveBorderRadius.md,
    paddingVertical: responsiveSpacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: accent.info,
  },
  gymButtonDisabled: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  gymButtonText: {
    fontSize: fontScale(15),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  gymButtonTextDisabled: {
    color: TEXT_MUTED,
  },
  gymTip: {
    fontSize: fontScale(11.5),
    color: TEXT_MUTED,
    lineHeight: fontScale(16),
    textAlign: 'center',
  },
  recommendedCard: {
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(10),
    marginBottom: scale(6),
  },
  itemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    backgroundColor: 'transparent',
  },
  badgeDot: {
    width: scale(5),
    height: scale(5),
    borderRadius: scale(3),
  },
  badgeLabel: {
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  unlockDescription: {
    fontSize: fontScale(12),
    color: TEXT_SECONDARY,
    fontWeight: '500',
    marginBottom: scale(4),
  },
  unlockDescriptionDark: {
    color: TEXT_SECONDARY,
  },
});
