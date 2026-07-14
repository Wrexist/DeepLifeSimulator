/**
 * Styles for TopStatsBar. Extracted verbatim to slim the component file.
 * Static module-level StyleSheet.
 *
 * Layout model (redesign): a calm vertical 3-row grid instead of a tall left
 * stack vs. a big right block —
 *   Row 1 (topRow):     identity cluster (Gen + prestige + subtle utilities)  ↔  compact date + advance button
 *   Row 2 (vitalsRow):  the 3 vital rings, centered and evenly spaced
 *   Row 3 (bottomRow):  money / bank / gems chips, centered
 * Even spacing, consistent radii, aligned baselines, symmetric padding.
 */
import { Platform, StyleSheet } from 'react-native';
import { responsivePadding, responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale, isIPad, isSmallDevice } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';

// Small, de-emphasized utility button size (gem shop / help / settings / seasonal).
// Smaller than a primary touch target on purpose — a subtle cluster, not a bright
// row — but kept reachable via hitSlop on the pressables.
const UTILITY_SIZE = isIPad() ? scale(42) : isSmallDevice() ? scale(30) : scale(34);

export const styles = StyleSheet.create({
 container: {
 flexDirection: 'column',
 justifyContent: 'center',
 alignItems: 'stretch',
 paddingHorizontal: responsivePadding.horizontal * 1.2,
 paddingVertical: responsiveSpacing.xs,
 backgroundColor: '#FFFFFF',
 overflow: 'hidden', // Prevent overflow
 // Subtle bottom border for definition
 borderBottomWidth: 1,
 borderBottomColor: 'rgba(0,0,0,0.04)',
 // Soft shadow for floating effect
...Platform.select({
 web: { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.06)'} as any,
 default: {
 shadowColor:'rgba(0,0,0,0.06)',
 shadowOffset: { width: 0, height: 2 },
 shadowOpacity: 1,
 shadowRadius: 4,
 },
 }),
 elevation: 2,
 },
 containerDark: {
 backgroundColor: '#0F172A',
 // Hairline separation + soft downward shadow so the HUD reads as a floating
 // glass app-bar above the scrolling content below (was flat with no depth).
 borderBottomWidth: 1,
 borderBottomColor: 'rgba(255,255,255,0.06)',
...Platform.select({
 web: { boxShadow: '0px 4px 16px rgba(0,0,0,0.35)'} as any,
 default: {
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 3 },
 shadowOpacity: 0.35,
 shadowRadius: 12,
 },
 }),
 elevation: 6,
 },

 // --- Row 1: identity (left) ↔ date + advance (right) ---
 topRow: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 marginBottom: responsiveSpacing.sm,
 },
 identityCluster: {
 flexDirection: 'column',
 alignItems: 'flex-start',
 justifyContent: 'center',
 gap: responsiveSpacing.xs,
 flexShrink: 1,
 minWidth: 0,
 },
 generationRow: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: responsiveSpacing.xs,
 },
 generationBadge: {
 paddingHorizontal: responsiveSpacing.sm,
 paddingVertical: 2,
 borderRadius: responsiveBorderRadius.full,
 backgroundColor: 'rgba(59, 130, 246, 0.08)',
 color: '#1E40AF',
 fontSize: responsiveFontSize.xs,
 fontWeight: '600',
 borderWidth: 1,
 borderColor: 'rgba(255, 255, 255, 0.15)',
 // Light mode: subtle shadow
...Platform.select({
 web: { boxShadow: '0px 1px 2px rgba(59, 130, 246, 0.2)'} as any,
 default: {
 shadowColor:'rgba(59, 130, 246, 0.2)',
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 1,
 shadowRadius: 2,
 },
 }),
 },
 generationBadgeDark: {
 backgroundColor: 'rgba(96, 165, 250, 0.14)',
 color: '#BFDBFE',
 borderWidth: 1,
 borderColor: 'rgba(96, 165, 250, 0.22)',
 shadowColor: 'transparent',
 },
 prestigeBadgeContainer: {
 borderRadius: responsiveBorderRadius.full,
 overflow: 'hidden',
 },
 prestigeBadge: {
 flexDirection: 'row',
 alignItems: 'center',
 paddingHorizontal: responsiveSpacing.sm,
 paddingVertical: 2,
 borderRadius: responsiveBorderRadius.full,
 gap: 4,
 backgroundColor: '#F59E0B',
...Platform.select({
 web: { boxShadow: '0px 2px 6px rgba(245, 158, 11, 0.4)'} as any,
 default: {
 shadowColor:'rgba(245, 158, 11, 0.4)',
 shadowOffset: { width: 0, height: 2 },
 shadowOpacity: 1,
 shadowRadius: 6,
 },
 }),
 elevation: 4,
 borderWidth: 1,
 borderColor: 'rgba(255, 255, 255, 0.3)',
 },
 prestigeBadgeText: {
 fontSize: responsiveFontSize.xs,
 fontWeight: 'bold',
 color: '#FFFFFF',
 },

 // --- De-emphasized utility cluster (gem shop / help / settings / seasonal) ---
 utilityCluster: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: responsiveSpacing.xs,
 },
 utilityButton: {
 width: UTILITY_SIZE,
 height: UTILITY_SIZE,
 borderRadius: UTILITY_SIZE / 2,
 overflow: 'hidden',
 alignItems: 'center',
 justifyContent: 'center',
 },
 utilityButtonInner: {
 width: '100%',
 height: '100%',
 alignItems: 'center',
 justifyContent: 'center',
 borderRadius: UTILITY_SIZE / 2,
 borderWidth: 1,
 },

 // --- Row 2: vitals activity rings (health / mood / energy), centered ---
 vitalsRingRow: {
 flexDirection: 'row',
 alignItems: 'flex-start',
 justifyContent: 'center',
 gap: scale(22),
 marginBottom: responsiveSpacing.sm,
 },
 vitalRingCell: {
 alignItems: 'center',
 },
 vitalRingTouchable: {
 alignItems: 'center',
 },
 vitalRingWrap: {
 position: 'relative',
 alignItems: 'center',
 justifyContent: 'center',
 },
 vitalRingLabelRow: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: scale(2),
 marginTop: scale(3),
 },
 vitalRingValue: {
 color: '#E2E8F0',
 fontSize: responsiveFontSize.sm,
 fontWeight: '800',
 fontVariant: ['tabular-nums'],
 lineHeight: scale(14),
 },
 vitalRingValueLight: {
 color: '#334155',
 },
 vitalRingDisease: {
 position: 'absolute',
 top: -scale(2),
 right: -scale(4),
 backgroundColor: '#F59E0B',
 borderRadius: scale(8),
 width: scale(15),
 height: scale(15),
 alignItems: 'center',
 justifyContent: 'center',
 borderWidth: 1,
 borderColor: '#0F172A',
 zIndex: 10,
 elevation: 10,
 },
 diseaseIndicatorSerious: {
 backgroundColor: '#EF4444',
 },
 diseaseIndicatorCritical: {
 backgroundColor: '#DC2626',
 },

 quickActionsContainer: {
 position: 'absolute',
 top: 40,
 left: 0,
 right: 0,
 backgroundColor: 'rgba(0, 0, 0, 0.95)',
 borderRadius: responsiveBorderRadius.md,
 padding: responsiveSpacing.sm,
 zIndex: Z_INDEX.DROPDOWN,
 minWidth: scale(120),
 },
 quickActionButton: {
 marginBottom: responsiveSpacing.xs,
 },
 quickActionGradient: {
 flexDirection: 'row',
 alignItems: 'center',
 paddingHorizontal: responsiveSpacing.sm,
 paddingVertical: responsiveSpacing.xs,
 borderRadius: responsiveBorderRadius.sm,
 },
 quickActionText: {
 color: '#FFFFFF',
 fontSize: responsiveFontSize.sm,
 fontWeight: '600',
 marginLeft: responsiveSpacing.xs,
 },

 // --- Row 3: money / bank / gems chips, centered ---
 bottomRow: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'center',
 },
 moneyCluster: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'center',
 gap: responsiveSpacing.sm,
 flexWrap: 'wrap',
 flexShrink: 1,
 maxWidth: '100%',
 },
 moneyChip: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'center',
 paddingHorizontal: 12,
 height: 28,
 borderRadius: 999, // true pill
 flexShrink: 1,
 minWidth: 60,
 overflow: 'hidden',
 maxWidth: '100%',
 // Subtle glass rim to match the app design language
 borderWidth: 1,
 borderColor: 'rgba(255,255,255,0.18)',
 },
 chipIcon: {
 marginRight: 6,
 flexShrink: 0, // Icon should never shrink
 },
 chipTextContainer: {
 flexShrink: 1,
 minWidth: 0,
 maxWidth: '100%',
 },
 chipText: {
 color: '#FFFFFF',
 fontWeight: '700',
 fontSize: responsiveFontSize.sm,
 lineHeight: 18,
 flexShrink: 1,
 },

 // --- Right side of Row 1: compact date read + advance button ---
 rightSection: {
 alignItems: 'flex-end',
 justifyContent: 'center',
 flexShrink: 0,
 flexBasis: 'auto',
 minWidth: 0,
 marginLeft: responsiveSpacing.md,
 },
 dateAdvanceCluster: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'flex-end',
 gap: scale(6),
 },
 dateChip: {
 alignItems: 'center',
 justifyContent: 'center',
 paddingHorizontal: scale(10),
 paddingVertical: scale(5),
 borderRadius: responsiveBorderRadius.lg,
 flexShrink: 1,
 borderWidth: 1,
 borderColor: 'rgba(255,255,255,0.18)',
 },
 datePrimaryText: {
 fontSize: responsiveFontSize.sm,
 fontWeight: '800',
 color: '#FFFFFF',
 letterSpacing: 0.2,
 lineHeight: scale(16),
 textAlign: 'center',
 },
 dateAgeText: {
 fontSize: responsiveFontSize.xs,
 fontWeight: '600',
 color: 'rgba(255,255,255,0.82)',
 lineHeight: scale(13),
 marginTop: 1,
 textAlign: 'center',
 },

 weekDots: {
 flexDirection: 'row',
 marginTop: scale(4),
 justifyContent: 'center',
 alignItems: 'center',
 },
 // Month progress: 4 dots, one per week. Elapsed weeks are filled, the current
 // week is bright + softly glowing ("you are here"), upcoming weeks are hollow.
 weekDot: {
 width: 6,
 height: 6,
 borderRadius: 3,
 marginHorizontal: 2,
 backgroundColor: 'rgba(255,255,255,0.22)',
 },
 weekDotPast: {
 backgroundColor: 'rgba(255,255,255,0.55)',
 },
 weekDotCurrent: {
 width: 7,
 height: 7,
 borderRadius: 3.5,
 backgroundColor: '#FFFFFF',
...Platform.select({
 web: { boxShadow: '0px 0px 5px rgba(255,255,255,0.9)'} as any,
 default: {
 shadowColor: '#FFFFFF',
 shadowOffset: { width: 0, height: 0 },
 shadowOpacity: 0.9,
 shadowRadius: 4,
 },
 }),
 elevation: 3,
 },
 weekDotFuture: {
 backgroundColor: 'transparent',
 borderWidth: 1,
 borderColor: 'rgba(255,255,255,0.35)',
 },
 weekDotXL: {
 width: scale(6),
 height: scale(6),
 borderRadius: scale(3),
 marginHorizontal: 1.5,
 },

 nextWeekContainer: { alignItems: 'center' },
 nextWeekButton: {
 alignItems: 'center',
 justifyContent: 'center',
 borderRadius: responsiveBorderRadius.lg,
 // Light mode button shadow
...Platform.select({
 web: { boxShadow: '0px 2px 4px rgba(22, 163, 74, 0.09)'} as any,
 default: {
 shadowColor:'rgba(22, 163, 74, 0.3)',
 shadowOffset: { width: 0, height: 2 },
 shadowOpacity: 0.3,
 shadowRadius: 4,
 },
 }),
 elevation: 3,
 },
});
