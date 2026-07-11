/**
 * Styles for LoanManager. Extracted verbatim to slim the component file.
 * Static module-level StyleSheet.
 */
import { Platform, StyleSheet } from 'react-native';
import { getShadow } from '@/utils/shadow';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    ...getShadow(4, '#000'),
  },
  containerDark: {
    backgroundColor: '#1E293B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  newLoanButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newLoanButtonDark: {
    backgroundColor: '#1D4ED8',
  },
  newLoanButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  newLoanButtonTextDark: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardDark: {
    backgroundColor: '#334155',
    borderColor: '#4B5563',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    ...Platform.select({
      web: { textShadow: '-1px 1px 2px rgba(0, 0, 0, 0.75)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 2,
      },
    }),
  },
  summaryLabelDark: {
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
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  summaryValueDark: {
    color: '#F9FAFB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  sectionTitleDark: {
    color: '#F9FAFB',
  },
  loanItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  loanItemDark: {
    backgroundColor: '#4B5563',
    borderColor: '#6B7280',
  },
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  loanTypeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loanTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loanName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  loanNameDark: {
    color: '#F9FAFB',
  },
  loanMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    ...Platform.select({
      web: { textShadow: '-1px 1px 2px rgba(0, 0, 0, 0.75)' } as any,
      default: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 2,
      },
    }),
  },
  loanMetaDark: {
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
  loanAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  loanAmountDark: {
    color: '#F9FAFB',
  },
  loanProgress: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginBottom: 4,
  },
  progressBarDark: {
    backgroundColor: '#6B7280',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  progressTextDark: {
    color: '#94A3B8',
  },
  loanPayment: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  paymentLabelDark: {
    color: '#94A3B8',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateTitleDark: {
    color: '#F9FAFB',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyStateTextDark: {
    color: '#94A3B8',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalContentDark: {
    backgroundColor: '#1E293B',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderDark: {
    borderBottomColor: '#4B5563',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalTitleDark: {
    color: '#F9FAFB',
  },
  modalBody: {
    padding: 20,
    maxHeight: 500,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
    marginTop: 16,
  },
  inputLabelDark: {
    color: '#F9FAFB',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  inputDark: {
    borderColor: '#6B7280',
    color: '#F9FAFB',
    backgroundColor: '#334155',
  },
  loanTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  loanTypeCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  loanTypeCardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#3B82F6',
  },
  loanTypeCardDark: {
    backgroundColor: '#334155',
  },
  loanTypeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 8,
    textAlign: 'center',
  },
  loanTypeNameSelected: {
    color: '#FFFFFF',
  },
  loanTypeNameDark: {
    color: '#F9FAFB',
  },
  termGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  termButton: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  termButtonSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  termButtonDark: {
    backgroundColor: '#334155',
    borderColor: '#6B7280',
  },
  termText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  termTextSelected: {
    color: '#FFFFFF',
  },
  termTextDark: {
    color: '#F9FAFB',
  },
  loanDetails: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  loanDetailsDark: {
    backgroundColor: '#334155',
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  detailsTitleDark: {
    color: '#F9FAFB',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailsLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailsLabelDark: {
    color: '#94A3B8',
  },
  detailsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  detailsValueDark: {
    color: '#F9FAFB',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#DC2626',
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalButtonSecondary: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    // Gradient will be applied
  },
  modalButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  modalButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  repaySourceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  repaySourceButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  repaySourceButtonSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  repaySourceButtonDark: {
    backgroundColor: '#334155',
    borderColor: '#6B7280',
  },
  repaySourceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  repaySourceTextSelected: {
    color: '#FFFFFF',
  },
  repaySourceTextDark: {
    color: '#F9FAFB',
  },
  autoPaymentNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  autoPaymentNoticeDark: {
    backgroundColor: '#064E3B',
    borderColor: '#059669',
  },
  autoPaymentText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#059669',
  },
  autoPaymentTextDark: {
    color: '#34D399',
  },
  quickPayButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickPayButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  quickPayButtonDark: {
    backgroundColor: '#334155',
    borderColor: '#6B7280',
  },
  quickPayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  quickPayTextDark: {
    color: '#F9FAFB',
  },
});
