/**
 * Styles for DeathPopup.
 *
 * Extracted verbatim from components/DeathPopup.tsx to keep the component
 * readable. Static module-level StyleSheet. `width`/`height` are derived from
 * the window the same way the component did.
 */
import { Dimensions, Platform, StyleSheet } from 'react-native';
import { scale, fontScale } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';

const { width, height } = Dimensions.get('window');

export const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  content: {
    width: width * 0.9,
    maxWidth: 420,
    maxHeight: height * 0.85,
  },
  card: {
    width: '100%',
    borderRadius: scale(24),
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.3)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
      },
    }),
    elevation: 12,
    maxHeight: height * 0.85,
    flexDirection: 'column',
  },
  scrollContainer: {
    maxHeight: height * 0.55,
    minHeight: scale(300),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: scale(24),
    paddingBottom: scale(20),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(24),
  },
  iconContainer: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(16),
  },
  iconContainerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerText: {
    flex: 1,
  },
  mainTitle: {
    fontSize: fontScale(36),
    fontWeight: '800',
    color: '#111827',
    marginBottom: scale(6),
    letterSpacing: -0.5,
  },
  mainTitleDark: {
    color: '#F9FAFB',
  },
  title: {
    fontSize: fontScale(32),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(4),
    letterSpacing: -0.5,
  },
  titleDark: {
    color: '#F9FAFB',
  },
  subtitle: {
    fontSize: fontScale(16),
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: scale(8),
    fontStyle: 'italic',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  nameText: {
    fontSize: fontScale(22),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(4),
  },
  nameTextDark: {
    color: '#F9FAFB',
  },
  details: {
    fontSize: fontScale(14),
    color: '#6B7280',
  },
  detailsDark: {
    color: '#9CA3AF',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(12),
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: scale(16),
    padding: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    gap: scale(12),
  },
  summaryCardDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    color: '#6B7280',
    marginBottom: scale(2),
    fontWeight: '500',
  },
  summaryLabelDark: {
    color: '#9CA3AF',
  },
  summaryValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#111827',
  },
  summaryValueDark: {
    color: '#F9FAFB',
  },
  achievementsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(6),
    marginTop: scale(8),
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  achievementBadgeDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  achievementText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    color: '#92400E',
  },
  achievementTextDark: {
    color: '#FCD34D',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(12),
    marginTop: scale(8),
  },
  statsGridDark: {},
  statBox: {
    flex: 1,
    minWidth: scale(100),
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: scale(12),
    padding: scale(12),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  statBoxDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statBoxLabel: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginBottom: scale(4),
    fontWeight: '500',
    textAlign: 'center',
  },
  statBoxLabelDark: {
    color: '#9CA3AF',
  },
  statBoxValue: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  statBoxValueDark: {
    color: '#F9FAFB',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: scale(12),
    marginBottom: scale(24),
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: scale(16),
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  statCardDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    color: '#6B7280',
    marginBottom: scale(2),
  },
  statLabelDark: {
    color: '#9CA3AF',
  },
  statValue: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#111827',
  },
  statValueDark: {
    color: '#F9FAFB',
  },
  section: {
    marginBottom: scale(24),
  },
  sectionTitle: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(12),
  },
  sectionTitleDark: {
    color: '#F9FAFB',
  },
  breakdownCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: scale(16),
    padding: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  breakdownCardDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scale(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  breakdownLabel: {
    fontSize: fontScale(14),
    color: '#6B7280',
    fontWeight: '500',
  },
  breakdownLabelDark: {
    color: '#9CA3AF',
  },
  breakdownValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#111827',
  },
  breakdownValueDark: {
    color: '#F9FAFB',
  },
  bonusesCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: scale(16),
    padding: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    gap: scale(12),
  },
  bonusesCardDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    color: '#6B7280',
    marginBottom: scale(2),
  },
  bonusLabelDark: {
    color: '#9CA3AF',
  },
  bonusValue: {
    fontSize: fontScale(16),
    fontWeight: '700',
    color: '#10B981',
  },
  actions: {
    padding: scale(20),
    paddingTop: scale(16),
    gap: scale(10),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
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
  reviveButton: {},
  iapButton: {},
  continueButton: {},
  newLifeButton: {},
  disabledButton: {
    opacity: 0.5,
  },
  // Children Selection Styles
  childrenNote: {
    fontSize: fontScale(12),
    color: '#6B7280',
    marginBottom: scale(12),
    fontStyle: 'italic',
    lineHeight: fontScale(16),
  },
  childrenNoteDark: {
    color: '#9CA3AF',
  },
  childrenList: {
    gap: scale(12),
  },
  childCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: scale(16),
    padding: scale(16),
    borderWidth: 2,
    borderColor: 'transparent',
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
  childCardDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
  },
  childCardSelected: {
    borderColor: '#6366F1',
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
    color: '#111827',
    marginBottom: scale(4),
  },
  childNameDark: {
    color: '#F9FAFB',
  },
  childDetails: {
    fontSize: fontScale(13),
    color: '#6B7280',
    marginBottom: scale(6),
  },
  childDetailsDark: {
    color: '#9CA3AF',
  },
  childNetWorthCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: scale(12),
    padding: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  childNetWorthCardDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  childNetWorthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(4),
  },
  childNetWorthLabel: {
    fontSize: fontScale(12),
    color: '#6B7280',
    flex: 1,
  },
  childNetWorthLabelDark: {
    color: '#9CA3AF',
  },
  childNetWorthValue: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#10B981',
  },
  childInheritanceText: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginTop: scale(4),
  },
  childInheritanceTextDark: {
    color: '#9CA3AF',
  },
  noChildrenCard: {
    backgroundColor: 'rgba(243, 244, 246, 0.8)',
    borderRadius: scale(16),
    padding: scale(24),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    borderStyle: 'dashed',
  },
  noChildrenCardDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  noChildrenText: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginTop: scale(12),
    textAlign: 'center',
    fontStyle: 'italic',
  },
  noChildrenTextDark: {
    color: '#9CA3AF',
  },
  // Heir Selection Styles
  heirHeader: {
    padding: scale(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
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
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  headerIconContainerDark: {
    backgroundColor: 'rgba(252, 211, 77, 0.15)',
  },
  heirTitle: {
    fontSize: fontScale(24),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(4),
  },
  heirTitleDark: {
    color: '#F9FAFB',
  },
  heirSubtitle: {
    fontSize: fontScale(14),
    color: '#6B7280',
  },
  heirSubtitleDark: {
    color: '#9CA3AF',
  },
  heirNote: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginTop: scale(4),
    fontStyle: 'italic',
  },
  heirNoteDark: {
    color: '#9CA3AF',
  },
  heirScrollView: {
    flex: 1,
  },
  heirScrollContent: {
    padding: scale(20),
    paddingBottom: scale(16),
  },
  heirCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: scale(20),
    padding: scale(20),
    marginBottom: scale(16),
    borderWidth: 2,
    borderColor: 'transparent',
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
  heirCardDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
  },
  heirCardSelected: {
    borderColor: '#6366F1',
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
    color: '#111827',
    marginBottom: scale(4),
  },
  heirNameDark: {
    color: '#F9FAFB',
  },
  heirDetails: {
    fontSize: fontScale(14),
    color: '#6B7280',
    marginBottom: scale(8),
  },
  heirDetailsDark: {
    color: '#9CA3AF',
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
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: scale(12),
    padding: scale(12),
    marginBottom: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  inheritanceCardDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  inheritanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  inheritanceLabel: {
    fontSize: fontScale(12),
    color: '#6B7280',
    flex: 1,
  },
  inheritanceLabelDark: {
    color: '#9CA3AF',
  },
  inheritanceValue: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#10B981',
  },
  savingsText: {
    fontSize: fontScale(11),
    color: '#6B7280',
    marginTop: scale(4),
  },
  savingsTextDark: {
    color: '#9CA3AF',
  },
  heirStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
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
    color: '#374151',
  },
  heirStatValueDark: {
    color: '#D1D5DB',
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
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
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
    color: '#111827',
  },
  mindsetTitleDark: {
    color: '#F9FAFB',
  },
  mindsetScroll: {
    maxHeight: scale(120),
  },
  mindsetScrollContent: {
    gap: scale(8),
    paddingRight: scale(8),
  },
  mindsetOption: {
    minWidth: scale(120),
    padding: scale(12),
    borderRadius: scale(12),
    backgroundColor: 'rgba(243, 244, 246, 0.8)',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    position: 'relative',
  },
  mindsetOptionDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
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
    color: '#111827',
  },
  mindsetOptionNameDark: {
    color: '#D1D5DB',
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
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  confirmButton: {
    borderRadius: scale(14),
    overflow: 'hidden',
  },
  // Prestige preview styles
  prestigePreviewCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: scale(12),
    padding: scale(16),
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  prestigePreviewCardDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  prestigePointsValue: {
    fontSize: fontScale(28),
    fontWeight: '800' as const,
    color: '#F59E0B',
    marginBottom: scale(4),
  },
  prestigeHint: {
    fontSize: fontScale(12),
    color: '#6B7280',
    textAlign: 'center' as const,
    marginBottom: scale(12),
  },
  prestigeHintDark: {
    color: '#9CA3AF',
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
    color: '#374151',
    flex: 1,
  },
  prestigeBuyTextDark: {
    color: '#D1D5DB',
  },
  ribbonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(14),
    marginHorizontal: scale(16),
    marginBottom: scale(12),
    borderRadius: scale(12),
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
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
    color: '#6B7280',
    marginTop: scale(2),
  },
  rewindSection: {
    marginTop: scale(8),
    padding: scale(12),
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  rewindTitle: {
    fontSize: fontScale(13),
    fontWeight: '700',
    color: '#F59E0B',
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
    color: '#F59E0B',
  },
});
