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
  headerDark: {
    backgroundColor: 'transparent',
    borderBottomColor: 'rgba(229, 231, 235, 0.3)',
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
  titleIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: responsiveSpacing.sm,
    ...Platform.select({
      ios: {
        boxShadow: '0px 4px 8px rgba(99, 102, 241, 0.3)',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0px 4px 8px rgba(99, 102, 241, 0.3)',
      },
    }),
  },
  title: {
    fontSize: responsiveFontSize.xl,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  closeButton: {
    borderRadius: scale(20),
    overflow: 'hidden',
  },
  closeButtonGradient: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        ...getShadow(8, '#EF4444'),
      },
      android: {
        elevation: 6,
      },
      web: {
        ...getShadow(8, '#EF4444'),
      },
    }),
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
    color: '#F9FAFB',
  },
  settingDescription: {
    fontSize: responsiveFontSize.sm,
    color: '#6B7280',
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
  languageButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    marginTop: responsiveSpacing.sm,
  },
  languageButtonContainer: {
    marginLeft: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.xs,
  },
  languageButton: {
    paddingVertical: responsiveSpacing.xs,
    paddingHorizontal: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  languageButtonDark: {
    backgroundColor: '#334155',
    borderColor: '#475569',
  },
  activeLanguageButton: {
    paddingVertical: responsiveSpacing.xs,
    paddingHorizontal: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
    ...Platform.select({
      ios: {
        ...getShadow(4, '#6366F1'),
      },
      android: {
        elevation: 3,
      },
      web: {
        ...getShadow(4, '#6366F1'),
      },
    }),
  },
  languageButtonText: {
    fontSize: responsiveFontSize.xs,
    color: '#6B7280',
    fontWeight: '500',
    ...Platform.select({
      web: { textShadow: '-1px 1px 2px rgba(0, 0, 0, 0.75)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 2,
      },
    }),
  },
  languageButtonTextDark: {
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
  activeLanguageButtonText: {
    fontSize: responsiveFontSize.xs,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Enhanced Tab Styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
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
    color: '#6B7280',
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
    color: '#F9FAFB',
    fontWeight: '600',
    fontSize: responsiveFontSize.base,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  // Enhanced Danger Section Styles
  dangerSection: {
    marginTop: responsiveSpacing.xl,
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  dangerSectionDark: {},
  dangerSectionBlur: {
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  dangerSectionGradient: {
    padding: responsivePadding.large,
    borderRadius: responsiveBorderRadius.lg,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
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
  dangerTitleDark: {
    color: '#F87171',
  },
  dangerButtonContainer: {
    marginBottom: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
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
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.md,
  },
  dangerButtonIcon: {
    marginRight: responsiveSpacing.sm,
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: responsiveFontSize.sm,
  },
  // Life Goals styles moved to components/settings/LifeGoalsPanel.tsx
  lifeGoalGradient: {
    padding: scale(18),
    minHeight: scale(160),
  },
  lifeGoalGradientCompleted: {
    borderColor: 'rgba(255, 255, 255, 0.4)',
    ...Platform.select({
      ios: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: scale(2) },
        shadowOpacity: 0.3,
        shadowRadius: scale(8),
      },
      android: {
        elevation: 6,
      },
      web: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: scale(2) },
        shadowOpacity: 0.3,
        shadowRadius: scale(8),
      },
    }),
  },
  lifeGoalCardHeader: {
    flexDirection: 'row',
    marginBottom: scale(14),
    gap: scale(12),
  },
  lifeGoalIconWrapper: {
    alignItems: 'flex-start',
  },
  lifeGoalIconContainer: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  lifeGoalIconContainerCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  lifeGoalIcon: {
    width: scale(40),
    height: scale(40),
  },
  lifeGoalIconText: {
    fontSize: scale(40),
  },
  lifeGoalInfoSection: {
    flex: 1,
    minWidth: 0,
  },
  lifeGoalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(6),
  },
  lifeGoalCardTitle: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    letterSpacing: -0.3,
  },
  lifeGoalCardTitleDark: {
    color: '#FFFFFF',
  },
  lifeGoalCardTitleCompleted: {
    color: '#10B981',
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
  completedBadgeText: {
    fontSize: fontScale(14),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  lifeGoalReward: {
    fontSize: fontScale(13),
    color: '#6B7280',
    lineHeight: fontScale(18),
    fontWeight: '500',
  },
  lifeGoalRewardDark: {
    color: '#CBD5E1',
  },
  lifeGoalRequirementSection: {
    marginBottom: scale(14),
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  lifeGoalRequirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  lifeGoalRequirementText: {
    fontSize: fontScale(12),
    color: '#6B7280',
    fontWeight: '600',
    flex: 1,
  },
  lifeGoalRequirementTextDark: {
    color: '#94A3B8',
  },
  lifeGoalProgressSection: {
    marginTop: scale(4),
  },
  lifeGoalProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  lifeGoalProgressLabel: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lifeGoalProgressLabelDark: {
    color: '#94A3B8',
  },
  lifeGoalProgressPercent: {
    fontSize: fontScale(13),
    fontWeight: '700',
    color: '#3B82F6',
  },
  lifeGoalProgressPercentDark: {
    color: '#60A5FA',
  },
  lifeGoalProgressPercentCompleted: {
    color: '#10B981',
  },
  lifeGoalProgressBarContainer: {
    marginBottom: scale(6),
  },
  lifeGoalProgressBar: {
    height: scale(8),
    backgroundColor: 'rgba(229, 231, 235, 0.5)',
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  lifeGoalProgressBarDark: {
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
  },
  lifeGoalProgressFill: {
    height: '100%',
    borderRadius: scale(4),
    ...Platform.select({
      ios: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: scale(4),
      },
      android: {
        elevation: 2,
      },
      web: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: scale(4),
      },
    }),
  },
  lifeGoalProgressText: {
    fontSize: fontScale(11),
    color: '#6B7280',
    fontWeight: '500',
  },
  lifeGoalProgressTextDark: {
    color: '#94A3B8',
  },
  // Keep old styles hidden for backward compatibility
  lifeGoalInfo: {
    display: 'none',
  },
  lifeGoalInfoDark: {
    display: 'none',
  },
  goalItem: {
    display: 'none',
  },
  goalItemDark: {
    display: 'none',
  },
  goalIcon: {
    display: 'none',
  },
  goalIconText: {
    display: 'none',
  },
  goalIconTextDark: {
    display: 'none',
  },
  goalContent: {
    display: 'none',
  },
  goalTitle: {
    display: 'none',
  },
  goalTitleDark: {
    display: 'none',
  },
  goalDesc: {
    display: 'none',
  },
  goalDescDark: {
    display: 'none',
  },
  goalRequirement: {
    display: 'none',
  },
  goalRequirementDark: {
    display: 'none',
  },
  goalProgressBar: {
    display: 'none',
  },
  goalProgressFill: {
    display: 'none',
  },
  goalProgressText: {
    display: 'none',
  },
  upcomingSection: {
    marginBottom: 30,
  },
  upcomingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 15,
    textAlign: 'center',
  },
  upcomingTitleDark: {
    color: '#F9FAFB',
  },
  upcomingItem: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    // Plain full border, no side stripe (DEV.md Hard Rule 7).
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  upcomingItemDark: {
    backgroundColor: '#334155',
    borderColor: '#60A5FA',
  },
  upcomingItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  upcomingItemTitleDark: {
    color: '#F9FAFB',
  },
  upcomingItemDesc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 18,
  },
  upcomingItemDescDark: {
    color: '#94A3B8',
  },
  bugReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 12,
  },
  bugReportButtonDark: {
    backgroundColor: '#1E3A8A',
    borderColor: '#3B82F6',
  },
  bugReportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
    marginLeft: 8,
  },
  devToolsContent: {
    padding: 24,
    maxHeight: 400,
  },
  bugReportScrollView: {
    flex: 1,
  },
  bugReportContent: {
    padding: 24,
    paddingBottom: 12,
  },
  bugReportDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  bugReportDescriptionDark: {
    color: '#94A3B8',
  },
  bugReportInput: {
    borderWidth: 1,
    borderColor: '#4B5563',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#334155',
    color: '#F9FAFB',
    minHeight: 120,
    maxHeight: 200,
    marginBottom: 12,
  },
  bugReportActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bugReportActionsDark: {
    borderTopColor: '#334155',
  },
  cancelBugButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelBugButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
  },
  sendBugButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledSendButton: {
    backgroundColor: '#E5E7EB',
  },
  sendBugButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledSendButtonText: {
    color: '#94A3B8',
  },
  featureSuggestionSection: {
    backgroundColor: '#F0F9FF',
    padding: 20,
    borderRadius: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  featureSuggestionSectionDark: {
    backgroundColor: '#1E3A8A',
    borderColor: '#3B82F6',
  },
  featureSuggestionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 8,
    textAlign: 'center',
  },
  featureSuggestionTitleDark: {
    color: '#93C5FD',
  },
  featureSuggestionDesc: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  featureSuggestionDescDark: {
    color: '#CBD5E1',
  },
  featureSuggestionInput: {
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#4B5563',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#F9FAFB',
    marginBottom: 16,
    minHeight: 100,
  },
  featureSuggestionInputDark: {
    backgroundColor: '#334155',
    borderColor: '#94A3B8',
    color: '#F9FAFB',
  },
  featureSuggestionButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  featureSuggestionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
  disclosureLevelSelector: {
    flexDirection: 'row',
    gap: responsiveSpacing.xs,
    marginTop: responsiveSpacing.sm,
  },
  disclosureLevelButton: {
    flex: 1,
    paddingVertical: responsiveSpacing.xs,
    paddingHorizontal: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.md,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
  },
  disclosureLevelButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  disclosureLevelText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#334155',
  },
  disclosureLevelTextActive: {
    color: '#FFFFFF',
  },
  disclosureLevelTextDark: {
    color: '#94A3B8',
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
  },
});
