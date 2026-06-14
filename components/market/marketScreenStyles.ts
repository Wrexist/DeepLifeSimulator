/**
 * Styles for the Market screen (app/(tabs)/market.tsx).
 *
 * Extracted verbatim and kept outside app/ so expo-router does not treat it as
 * a route. Static module-level StyleSheet.
 */
import { Platform, StyleSheet } from 'react-native';
import { responsiveBorderRadius, responsiveSpacing } from '@/utils/scaling';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    margin: responsiveSpacing.md,
    marginBottom: 0,
    borderRadius: responsiveBorderRadius.sm,
    padding: 4,
    zIndex: 10,
  },
  tabWithInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainerDark: {
    backgroundColor: '#1F2937',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.sm,
    minHeight: 44,
  },
  activeTab: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 4,
    ...Platform.select({
      web: { textShadow: '-1px 1px 2px rgba(0, 0, 0, 0.75)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 2,
      },
    }),
  },
  tabTextDark: {
    color: '#FFFFFF',
    ...Platform.select({
      web: { textShadow: '-1px 1px 2px rgba(0, 0, 0, 0.75)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 2,
      },
    }),
  },
  activeTabText: {
    color: '#FFFFFF',
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
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
    ...Platform.select({
      web: { textShadow: '-1px 1px 2px rgba(0, 0, 0, 0.75)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 2,
      },
    }),
  },
  sectionDescriptionDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
  },
  // Filter bar styles
  filterContainer: {
    marginBottom: 16,
    flexGrow: 0,
    flexShrink: 0,
  },
  filterContent: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    gap: 10,
    alignItems: 'center',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  filterButtonDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterButtonTextDark: {
    color: '#9CA3AF',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  filterCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowRadius: 2,
  },
  itemCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    marginBottom: responsiveSpacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  itemCardDark: {
    // Same surface in dark mode — the glass look is the default.
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  itemNameDark: {
    color: '#F8FAFC',
  },
  itemDescription: {
    fontSize: 12,
    color: 'rgba(226, 232, 240, 0.65)',
    marginBottom: 4,
    lineHeight: 17,
  },
  itemDescriptionDark: {
    color: 'rgba(226, 232, 240, 0.65)',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#34D399',
    letterSpacing: -0.2,
    marginBottom: 6,
    fontVariant: ['tabular-nums'],
  },
  bonusInfo: {
    marginTop: 4,
  },
  bonusTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 2,
  },
  bonusTitleDark: {
    color: '#9CA3AF',
  },
  bonusText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '500',
  },
  bonusTextDark: {
    color: '#93C5FD',
  },
  buyButton: {
    // LoadingButton handles all styling
  },
  sellButton: {
    // LoadingButton handles all styling
  },
  ownedButton: {
    backgroundColor: '#10B981',
  },
  disabledButton: {
    backgroundColor: '#E5E7EB',
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sellButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  ownedButtonText: {
    color: '#FFFFFF',
  },
  disabledButtonText: {
    color: '#9CA3AF',
  },
  gymCardWrapper: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  gymCardGradient: {
    padding: 20,
    borderRadius: 16,
  },
  gymCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  gymIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    marginRight: 16,
  },
  gymTitleContainer: {
    flex: 1,
  },
  gymCardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 6,
  },
  gymCardTitleDark: {
    color: '#FFFFFF',
  },
  gymCardSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
  },
  gymCardSubtitleDark: {
    color: '#93C5FD',
  },
  membershipWarningContainer: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  membershipWarning: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  membershipWarningDark: {
    backgroundColor: '#4B5563',
    borderColor: '#F59E0B',
  },
  membershipWarningText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  membershipWarningTextDark: {
    color: '#FCD34D',
  },
  membershipWarningSubtext: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  membershipWarningSubtextDark: {
    color: '#FCD34D',
  },
  gymCardDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  gymCardDescriptionDark: {
    color: '#D1D5DB',
  },
  gymStatsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  gymStatCard: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    aspectRatio: 1,
    minWidth: 0,
  },
  gymStatGradient: {
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
  },
  gymStatValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    ...Platform.select({
      web: { textShadow: '0px 1px 2px rgba(0, 0, 0, 0.3)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
      },
    }),
  },
  gymStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    ...Platform.select({
      web: { textShadow: '0px 1px 2px rgba(0, 0, 0, 0.3)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
      },
    }),
    maxWidth: '100%',
  },
  gymStatLabelDark: {
    color: '#FFFFFF',
  },
  gymCostCard: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  gymCostGradient: {
    padding: 16,
    alignItems: 'center',
  },
  gymCostLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gymCostLabelDark: {
    color: '#9CA3AF',
  },
  gymCostValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
  },
  gymCostValueDark: {
    color: '#FFFFFF',
  },
  gymButtonContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...Platform.select({
      web: { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.2)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
    }),
    elevation: 4,
  },
  gymButtonGradient: {
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gymButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    ...Platform.select({
      web: { textShadow: '0px 1px 2px rgba(0, 0, 0, 0.3)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
      },
    }),
  },
  gymButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  gymButton: {
    // LoadingButton handles all styling
  },
  scrollIndicatorContainer: {
    position: 'absolute',
    right: 10,
    top: 20,
    bottom: 20,
    width: 4,
    zIndex: 1,
  },
  scrollIndicator: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollBar: {
    width: 4,
    height: 40,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  scrollBarDark: {
    backgroundColor: '#374151',
  },
  scrollThumb: {
    width: 4,
    height: 20,
    backgroundColor: '#9CA3AF',
    borderRadius: 2,
  },
  scrollThumbDark: {
    backgroundColor: '#6B7280',
  },
  highlightedCard: {
    // Subtle accent border instead of the previous yellow glow + scale.
    borderColor: 'rgba(245, 158, 11, 0.55)',
  },
  recommendedCard: {
    // No left bar, no green glow — just a quiet white-alpha border bump.
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 6,
  },
  itemBadge: {
    // Flat tag — no pill, no border. A tiny color dot + uppercase label.
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'transparent',
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  unlockDescription: {
    fontSize: 12,
    color: 'rgba(226, 232, 240, 0.65)',
    fontWeight: '500',
    marginBottom: 4,
  },
  unlockDescriptionDark: {
    color: 'rgba(226, 232, 240, 0.65)',
  },
});
