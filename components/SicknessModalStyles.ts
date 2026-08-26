/**
 * Styles for SicknessModal. Extracted verbatim to slim the component file.
 * Static module-level StyleSheet.
 */
import { StyleSheet } from 'react-native';
import { responsiveSpacing, scale, fontScale } from '@/utils/scaling';

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: scale(12),
    paddingBottom: scale(40),
  },
  container: {
    width: '100%',
    maxWidth: scale(700),
    height: '85%',
    maxHeight: '85%',
    borderRadius: scale(24),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scale(20) },
    shadowOpacity: 0.4,
    shadowRadius: scale(30),
    elevation: 20,
  },
  content: {
    flex: 1,
    borderRadius: scale(24),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerBlur: {
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: scale(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainer: {
    position: 'relative',
    marginRight: responsiveSpacing.md,
  },
  sparkleIcon: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 2,
  },
  title: {
    fontSize: fontScale(24),
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: fontScale(12),
    color: '#FFFFFF',
    marginTop: scale(2),
    fontWeight: '500',
  },
  subtitleDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    overflow: 'hidden',
  },
  closeButtonInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButtonInnerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: scale(20),
    paddingBottom: scale(20),
  },
  section: {
    marginBottom: scale(20),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  iconBadge: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(10),
  },
  sectionTitle: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.3,
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  effectsCard: {
    borderRadius: scale(16),
    padding: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  effectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(12),
  },
  effectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    borderRadius: scale(12),
    gap: scale(6),
    minWidth: scale(100),
  },
  effectLabel: {
    fontSize: fontScale(13),
    color: '#FFFFFF',
    fontWeight: '500',
  },
  effectLabelDark: {
    color: '#FFFFFF',
  },
  effectValue: {
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  positiveEffect: {
    color: '#10B981',
  },
  negativeEffect: {
    color: '#EF4444',
  },
  diseaseCardWrapper: {
    marginBottom: scale(16),
  },
  diseaseCard: {
    borderRadius: scale(16),
    padding: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  urgentDiseaseCard: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  diseaseHeader: {
    marginBottom: scale(12),
  },
  diseaseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  diseaseName: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  diseaseNameDark: {
    color: '#FFFFFF',
  },
  severityBadge: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(8),
  },
  severityText: {
    color: '#FFFFFF',
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  diseaseDescription: {
    marginTop: scale(12),
    marginBottom: scale(12),
    padding: scale(12),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: scale(12),
  },
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(6),
  },
  descriptionTitle: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: scale(6),
  },
  descriptionTitleDark: {
    color: '#FFFFFF',
  },
  descriptionText: {
    fontSize: fontScale(13),
    color: '#FFFFFF',
    lineHeight: fontScale(13) * 1.5,
  },
  descriptionTextDark: {
    color: '#FFFFFF',
  },
  diseaseTimeline: {
    marginTop: scale(12),
    marginBottom: scale(12),
    padding: scale(12),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: scale(12),
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(6),
  },
  timelineTitle: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: scale(6),
  },
  timelineTitleDark: {
    color: '#FFFFFF',
  },
  timelineText: {
    fontSize: fontScale(12),
    color: '#FFFFFF',
    marginTop: scale(4),
  },
  timelineTextDark: {
    color: '#FFFFFF',
  },
  deathCountdown: {
    marginTop: scale(12),
    marginBottom: scale(12),
    padding: scale(12),
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderRadius: scale(12),
  },
  countdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  countdownTitle: {
    fontSize: fontScale(13),
    fontWeight: '700',
    color: '#DC2626',
    marginLeft: scale(6),
  },
  countdownTitleDark: {
    color: '#FCA5A5',
  },
  urgentText: {
    color: '#DC2626',
    fontWeight: '800',
  },
  progressBar: {
    height: scale(8),
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: scale(4),
  },
  recoveryProgress: {
    marginTop: scale(12),
    marginBottom: scale(12),
    padding: scale(12),
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: scale(12),
  },
  recoveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  recoveryTitle: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#166534',
    marginLeft: scale(6),
  },
  recoveryTitleDark: {
    color: '#6EE7B7',
  },
  diseaseEffects: {
    marginTop: scale(12),
    padding: scale(12),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: scale(12),
  },
  effectsTitle: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: scale(8),
  },
  effectsTitleDark: {
    color: '#FFFFFF',
  },
  effectsList: {
    gap: scale(6),
  },
  diseaseEffectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  diseaseEffectLabel: {
    fontSize: fontScale(12),
    color: '#FFFFFF',
    flex: 1,
  },
  diseaseEffectLabelDark: {
    color: '#FFFFFF',
  },
  diseaseEffectValue: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  curableBadge: {
    marginTop: scale(12),
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  curableBadgeGradient: {
    padding: scale(10),
    alignItems: 'center',
  },
  curableText: {
    fontSize: fontScale(12),
    color: '#166534',
    fontWeight: '600',
  },
  curableTextDark: {
    color: '#10B981',
  },
  treatmentButtons: {
    flexDirection: 'row',
    gap: scale(12),
    width: '100%',
  },
  treatmentButton: {
    flex: 1,
    borderRadius: scale(16),
    overflow: 'hidden',
    minWidth: 0, // Ensure equal distribution
  },
  treatmentButtonGradient: {
    padding: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: scale(100),
    height: scale(100),
  },
  treatmentButtonText: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: '700',
    marginTop: scale(8),
    textAlign: 'center',
    width: '100%',
  },
  treatmentButtonPrice: {
    color: '#FFFFFF',
    fontSize: fontScale(12),
    fontWeight: '500',
    marginTop: scale(4),
    opacity: 0.9,
    textAlign: 'center',
    width: '100%',
  },
  historyCard: {
    borderRadius: scale(16),
    padding: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  historyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: scale(16),
  },
  historyStatItem: {
    alignItems: 'center',
  },
  historyStatValue: {
    fontSize: fontScale(24),
    fontWeight: '700',
    color: '#1E293B',
  },
  historyStatValueDark: {
    color: '#FFFFFF',
  },
  historyStatLabel: {
    fontSize: fontScale(11),
    color: '#FFFFFF',
    marginTop: scale(4),
    fontWeight: '500',
  },
  historyStatLabelDark: {
    color: '#FFFFFF',
  },
  historyList: {
    marginTop: scale(12),
  },
  historyListTitle: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: scale(8),
  },
  historyListTitleDark: {
    color: '#FFFFFF',
  },
  historyItem: {
    marginBottom: scale(6),
    paddingLeft: scale(8),
  },
  historyItemText: {
    fontSize: fontScale(11),
    color: '#FFFFFF',
    lineHeight: fontScale(11) * 1.4,
  },
  historyItemTextDark: {
    color: '#FFFFFF',
  },
  recommendationsCard: {
    borderRadius: scale(16),
    padding: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  recommendationText: {
    fontSize: fontScale(13),
    color: '#FFFFFF',
    marginBottom: scale(8),
    lineHeight: fontScale(13) * 1.5,
  },
  recommendationTextDark: {
    color: '#FFFFFF',
  },
  diseaseRecommendations: {
    marginBottom: scale(12),
  },
  diseaseRecommendationTitle: {
    fontSize: fontScale(14),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: scale(6),
  },
  diseaseRecommendationTitleDark: {
    color: '#F8FAFC',
  },
  urgentRecommendation: {
    color: '#DC2626',
    fontWeight: '700',
  },
  footer: {
    padding: scale(20),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  continueButton: {
    borderRadius: scale(16),
    overflow: 'hidden',
  },
  buttonGradient: {
    padding: scale(16),
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: fontScale(16),
    fontWeight: '700',
  },
});
