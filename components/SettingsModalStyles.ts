/**
 * Styles for SettingsModal.
 *
 * Extracted verbatim from components/SettingsModal.tsx to keep the modal logic
 * readable. Static module-level StyleSheet — no component-scope dependencies.
 */
import { Platform, StyleSheet } from 'react-native';
import {
  responsivePadding,
  responsiveFontSize,
  responsiveSpacing,
  responsiveBorderRadius,
  scale,
  fontScale,
} from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { getShadow } from '@/utils/shadow';

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'none',
  },
  blurOverlay: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsivePadding.large,
  },
  overlayDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'none',
  },
  modal: {
    backgroundColor: '#1E293B',
    borderRadius: responsiveBorderRadius.xl,
    maxWidth: 450,
    width: '100%',
    maxHeight: '90%',
    ...Platform.select({
      web: { boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.25)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
    }),
    elevation: 10,
    borderWidth: 0,
    overflow: 'hidden',
  },
  header: {
    padding: responsivePadding.large,
    paddingBottom: responsivePadding.medium,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#FAFBFC',
  },
  glassHeader: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: responsivePadding.large,
    paddingVertical: responsivePadding.large,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        ...getShadow(16, '#000'),
      },
      android: {
        elevation: 12,
      },
      web: {
        ...getShadow(16, '#000'),
      },
    }),
  },
  glassOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 20,
  },
  glassTitleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  glassCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: responsiveFontSize.xl,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  titleDark: {
    color: '#F8FAFC',
  },
  closeButton: {
    borderRadius: scale(20),
    overflow: 'hidden',
  },
  content: {
    padding: responsivePadding.large,
    paddingTop: responsivePadding.medium,
  },
  settingItem: {
    marginBottom: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  settingItemDark: {},
  settingItemBlur: {
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  settingItemGradient: {
    padding: responsivePadding.medium,
    borderRadius: responsiveBorderRadius.lg,
  },
  settingInfo: {
    flex: 1,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.sm,
  },
  settingIconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.sm,
    ...Platform.select({
      ios: {
        ...getShadow(4, '#000'),
      },
      android: {
        elevation: 3,
      },
      web: {
        ...getShadow(4, '#000'),
      },
    }),
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  settingTitleDark: {
    color: '#F8FAFC',
  },
  settingDescription: {
    fontSize: responsiveFontSize.sm,
    color: '#64748B',
    // Scaled font in a raw line box clips on a tablet; scale it at the same ratio.
    lineHeight: fontScale(18),
    ...Platform.select({
      web: { textShadow: '-1px 1px 2px rgba(0, 0, 0, 0.75)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 2,
      },
    }),
  },
  settingDescriptionDark: {
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
  switchContainer: {
    marginLeft: responsiveSpacing.sm,
  },
  // Enhanced Tab Styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: responsiveBorderRadius.lg,
    padding: 4,
    marginBottom: responsiveSpacing.lg,
    ...Platform.select({
      ios: {
        ...getShadow(4, '#000'),
      },
      android: {
        elevation: 2,
      },
      web: {
        ...getShadow(4, '#000'),
      },
    }),
  },
  tabContainerDark: {
    backgroundColor: '#334155',
  },
  settingsTab: {
    flex: 1,
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
  },
  activeSettingsTab: {},
  activeTabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
    ...Platform.select({
      ios: {
        ...getShadow(4, '#000'),
      },
      android: {
        elevation: 3,
      },
      web: {
        ...getShadow(4, '#000'),
      },
    }),
  },
  inactiveTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
  },
  tabIcon: {
    marginRight: responsiveSpacing.xs,
  },
  settingsTabText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '500',
    color: '#64748B',
  },
  settingsTabTextDark: {
    color: '#94A3B8',
  },
  activeSettingsTabText: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Enhanced Action Button Styles
  actionButtonContainer: {
    marginBottom: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        ...getShadow(8, '#000'),
      },
      android: {
        elevation: 4,
      },
      web: {
        ...getShadow(8, '#000'),
      },
    }),
  },
  // On-theme glass action row (see SettingsActionButton). Dark surface + a
  // tinted icon chip + left-aligned label — the accent never fills the button.
  glassActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: responsiveSpacing.md,
  },
  glassActionIconChip: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  glassActionLabel: {
    flex: 1,
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: responsiveFontSize.base,
  },
  dangerIconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.sm,
    ...Platform.select({
      ios: {
        ...getShadow(4, '#EF4444'),
      },
      android: {
        elevation: 3,
      },
      web: {
        ...getShadow(4, '#EF4444'),
      },
    }),
  },
  dangerTitle: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#EF4444',
  },
  completedBadge: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  goalTitle: {
    display: 'none',
  },
  goalDesc: {
    display: 'none',
  },
  // Discord Button Styles
  discordButtonContainer: {
    marginBottom: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'visible',
    position: 'relative',
    ...Platform.select({
      ios: {
        ...getShadow(16, '#5865F2'),
      },
      android: {
        elevation: 8,
      },
      web: {
        ...getShadow(16, '#5865F2'),
      },
    }),
  },
  discordButtonGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: responsiveBorderRadius.lg + 4,
    zIndex: 0,
  },
  discordButtonGlowGradient: {
    flex: 1,
    borderRadius: responsiveBorderRadius.lg + 4,
  },
  discordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.lg,
    paddingHorizontal: responsiveSpacing.lg,
    borderRadius: responsiveBorderRadius.lg,
    position: 'relative',
    zIndex: 1,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  discordButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  discordButtonIcon: {
    marginRight: responsiveSpacing.sm,
  },
  discordButtonTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  discordButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: responsiveFontSize.base + 2,
    textAlign: 'center',
  },
  discordButtonRewardText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: responsiveFontSize.sm,
    marginTop: 2,
    opacity: 0.9,
  },
  discordBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: 4,
    borderRadius: responsiveBorderRadius.md,
    marginLeft: responsiveSpacing.sm,
    ...Platform.select({
      ios: {
        ...getShadow(4, '#10B981'),
      },
      android: {
        elevation: 3,
      },
      web: {
        ...getShadow(4, '#10B981'),
      },
    }),
  },
  discordBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: responsiveFontSize.xs,
    letterSpacing: 0.5,
  },
  // Liquid Glass Reward Popup
  rewardOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: Z_INDEX.MODAL,
  },
  rewardOverlayTouch: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardCard: {
    width: '82%',
    maxWidth: scale(340),
    borderRadius: responsiveBorderRadius.xl + 4,
    overflow: 'hidden',
    // Solid slate panel so the card reads as a real surface; the blurple
    // gradient (fallback renders only colors[0]) stays as an accent film on top.
    backgroundColor: 'rgba(15,23,42,0.97)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
      },
      android: { elevation: 16 },
    }),
  },
  rewardGradient: {
    alignItems: 'center',
    paddingTop: scale(8),
    paddingBottom: scale(24),
    paddingHorizontal: scale(24),
  },
  rewardAccentLine: {
    width: '60%',
    height: 3,
    borderRadius: 2,
    marginBottom: scale(20),
    opacity: 0.8,
  },
  rewardGemContainer: {
    marginBottom: scale(16),
  },
  rewardGemCircle: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    ...Platform.select({
      ios: {
        shadowColor: '#818CF8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  rewardTitle: {
    fontSize: fontScale(22),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: scale(8),
  },
  rewardAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    marginBottom: scale(12),
  },
  rewardAmountText: {
    fontSize: fontScale(26),
    fontWeight: '800',
    color: '#A5B4FC',
  },
  rewardAmountLabel: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#C7D2FE',
  },
  rewardMessage: {
    fontSize: fontScale(14),
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
    lineHeight: fontScale(20),
    marginBottom: scale(20),
  },
  rewardDismissButton: {
    width: '100%',
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  rewardDismissGradient: {
    paddingVertical: scale(14),
    alignItems: 'center',
    borderRadius: responsiveBorderRadius.lg,
  },
  rewardDismissText: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },});
