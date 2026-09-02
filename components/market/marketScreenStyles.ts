/**
 * Styles for the Market screen (app/(tabs)/market.tsx).
 *
 * Extracted verbatim and kept outside app/ so expo-router does not treat it as
 * a route. Static module-level StyleSheet.
 *
 * House style: dark-glass surfaces (matches Health + the item cards), full
 * hairline borders (no side accent stripes — DEV.md Hard Rule 7), no textShadow,
 * no decorative gradients. Sizing via scale/fontScale.
 *
 * The tab-bar, filter-bar, empty-state and gym styles are gone with the
 * features that used them (UI overhaul, Phase 5): the screen is now one
 * scrolling list under CollapsibleSection headers, and the gym card lives on
 * Health (components/health/GymCard.tsx, which carries its own styles).
 */
import { StyleSheet } from 'react-native';
import { fontScale, scale, responsiveBorderRadius, responsiveSpacing } from '@/utils/scaling';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import { accent } from '@/lib/config/theme';

const GLASS_BG = 'rgba(15, 23, 42, 0.55)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.08)';
const TEXT = '#F8FAFC';
const TEXT_SECONDARY = 'rgba(226, 232, 240, 0.65)';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  containerDark: {
    backgroundColor: '#020617',
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
  /** The one line that names why a section leads (energy critical -> food). */
  leadNote: {
    fontSize: fontScale(13),
    lineHeight: fontScale(18),
    fontWeight: '600',
    color: '#FBBF24',
    marginBottom: scale(6),
  },
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
    fontWeight: '600',
    color: accent.amber,
    fontVariant: ['tabular-nums'],
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
  // Housing rows — single dark-glass card, no gradients. (These carried the
  // gym card too until it moved to Health.)
  housingCard: {
    backgroundColor: GLASS_BG,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS_BORDER,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.md,
    gap: responsiveSpacing.md,
  },
  housingCardTitle: {
    // Tier 2: a rental row must not outrank the section header above it.
    fontSize: fontScale(16),
    fontWeight: '600',
    color: TEXT,
    letterSpacing: -0.3,
    marginBottom: scale(2),
  },
  housingCardSubtitle: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#93C5FD',
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
