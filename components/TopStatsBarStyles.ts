/**
 * Styles for TopStatsBar. Extracted verbatim to slim the component file.
 * Static module-level StyleSheet.
 */
import { Platform, StyleSheet } from 'react-native';
import { responsivePadding, responsiveFontSize, responsiveSpacing, responsiveBorderRadius, touchTargets, scale, isIPad } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';

export const styles = StyleSheet.create({
 container: {
 flexDirection:'row',
 justifyContent: 'space-between',
 alignItems: 'flex-start',
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

 leftSection: {
 flex: 1,
 flexDirection: 'column',
 alignItems: 'flex-start',
 minWidth: 0, // Allow flex shrinking
 flexShrink: 1,
 },
 generationRow: {
 flexDirection: 'row',
 alignItems: 'center',
 marginBottom: responsiveSpacing.xs * 0.5,
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
 backgroundColor: 'rgba(255, 255, 255, 0.08)',
 color: '#E5E7EB',
 borderWidth: 0,
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
 leftIconRow: { flexDirection: 'row', marginBottom: responsiveSpacing.xs },

 iconButton: {
 width: isIPad() ? touchTargets.large: touchTargets.minimum,
 height: isIPad() ? touchTargets.large: touchTargets.minimum,
 marginRight: responsiveSpacing.xs,
 borderRadius: (isIPad() ? touchTargets.large: touchTargets.minimum) / 2,
 overflow: 'hidden',
 backgroundColor: 'transparent',
 },
 iconButtonDark: {},
 iconButtonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center'},

 // Labeled store entry — a blue-accent pill that reads as THE shop, visually
 // set apart from the mono Help/Settings icon buttons. Same height as the icon
 // buttons so the row stays aligned; ≥ touchTargets.minimum tap target.
 shopPill: {
 height: isIPad() ? touchTargets.large: touchTargets.minimum,
 minWidth: touchTargets.minimum,
 marginRight: responsiveSpacing.xs,
 borderRadius: (isIPad() ? touchTargets.large: touchTargets.minimum) / 2,
 overflow: 'hidden',
 },
 shopPillGradient: {
 flex: 1,
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'center',
 gap: scale(5),
 paddingHorizontal: responsiveSpacing.sm,
 },
 shopPillLabel: {
 color: '#FFFFFF',
 fontWeight: '700',
 fontSize: responsiveFontSize.sm,
 },

 statRow: {
 flexDirection:'row',
 alignItems: 'center',
 marginBottom: scale(2), // Minimal spacing to prevent collapsing but reduce dead space
 minHeight: scale(18), // Ensure minimum height to prevent collapsing
 },
 statArrowContainer: {
 marginLeft: scale(6),
 alignItems: 'center',
 justifyContent: 'center',
 width: scale(20),
 },
 diseaseIndicator: {
 backgroundColor: '#F59E0B',
 borderRadius: scale(10),
 paddingHorizontal: scale(6),
 paddingVertical: scale(2),
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'center',
 minWidth: scale(20),
 height: scale(18),
 },
 diseaseIndicatorSerious: {
 backgroundColor: '#EF4444',
 },
 diseaseIndicatorCritical: {
 backgroundColor: '#DC2626',
 },
 diseaseIndicatorCount: {
 fontSize: scale(10),
 fontWeight: '700',
 color: '#FFFFFF',
 marginLeft: scale(2),
 },

 // Progress bars
 progressBarWrapper: {
 height: isIPad() ? scale(24): scale(16),
 backgroundColor: '#F1F5F9',
 borderRadius: responsiveBorderRadius.lg,
 marginLeft: responsiveSpacing.sm,
 overflow: 'hidden',
 justifyContent: 'center',
 borderWidth: 1,
 borderColor: 'rgba(0,0,0,0.06)',
 minWidth: scale(60), // Ensure minimum width to prevent collapsing
 flexShrink: 1, // Allow progress bars to yield space when layout is tight
 // Light mode: subtle inner shadow
...Platform.select({
 web: { boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.08)'} as any,
 default: {
 shadowColor:'rgba(0,0,0,0.08)',
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 1,
 shadowRadius: 2,
 },
 }),
 elevation: 1,
 },
 progressBarWrapperDark: {
 backgroundColor: '#334155',
 borderWidth: 0,
...Platform.select({
 web: { boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)'} as any,
 default: {
 shadowColor:'#000',
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.1,
 shadowRadius: 2,
 },
 }),
 elevation: 1,
 },
 progressFill: {
 height: '100%',
 borderRadius: responsiveBorderRadius.lg,
 backgroundColor: '#3B82F6',
 // Subtle glow effect
...Platform.select({
 web: { boxShadow: '0px 0px 4px rgba(59, 130, 246, 0.3)'} as any,
 default: {
 shadowColor:'#3B82F6',
 shadowOffset: { width: 0, height: 0 },
 shadowOpacity: 0.3,
 shadowRadius: 4,
 },
 }),
 },
 progressFillDark: {
 backgroundColor: '#3B82F6',
 shadowColor: 'transparent',
 },

 // --- NEW CHIP STYLES ---
 moneyRow: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 marginTop: responsiveSpacing.md,
 width: '100%',
 },
 leftMoneySection: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: responsiveSpacing.sm,
 flexWrap: 'wrap', // Allow wrapping on small devices
 flexShrink: 1,
 maxWidth: '100%', // Add max width constraint to prevent overflow
 },
 moneyChip: {
 flexDirection: 'row',
 alignItems: 'center',
 paddingHorizontal: 12,
 height: 28,
 borderRadius: 999, // true pill
 flexShrink: 1, // Changed from 0 to allow shrinking on very small screens
 minWidth: 60, // Reduced from 70
 overflow: 'hidden', // Prevent text overflow
 maxWidth: '100%', // Ensure chip doesn't exceed container
 // Subtle glass rim to match the app design language
 borderWidth: 1,
 borderColor: 'rgba(255,255,255,0.18)',
 },
 chipIcon: {
 marginRight: 6,
 flexShrink: 0, // Icon should never shrink
 },
 chipTextContainer: {
 flexShrink: 1, // Allow text container to shrink
 minWidth: 0, // Allow flex shrinking
 maxWidth: '100%', // Prevent overflow
 },
 chipText: {
 color: '#FFFFFF',
 fontWeight: '700',
 fontSize: responsiveFontSize.sm,
 lineHeight: 18,
 flexShrink: 1, // Allow text to shrink if needed
 },
 // Small "+" badge on the gem chip — a static hint that the chip buys gems.
 gemChipPlus: {
 marginLeft: scale(4),
 width: scale(16),
 height: scale(16),
 borderRadius: scale(8),
 alignItems: 'center',
 justifyContent: 'center',
 backgroundColor: 'rgba(255,255,255,0.25)',
 flexShrink: 0,
 },

 // Right side
 rightSection: {
 alignItems: 'flex-end',
 flexShrink: 0, // Changed from 1 to prevent shrinking too much
 flexBasis: 'auto',
 minWidth: 0, // Allow flex shrinking
 marginLeft: responsiveSpacing.md, // Reduced from lg on small devices (will be overridden dynamically)
 marginTop: responsiveSpacing.md,
 // Max width will be set dynamically in component to prevent overflow
 },
 dateOuter: {
 padding: 2,
 borderRadius: responsiveBorderRadius.lg,
 marginBottom: responsiveSpacing.xs,
 flexShrink: 1,
 },
 dateInner: {
 alignItems: 'center',
 justifyContent: 'space-between',
 paddingHorizontal: 8,
 paddingVertical: 6,
 borderRadius: responsiveBorderRadius.md,
 backgroundColor: 'rgba(255,255,255,0.15)',
 height: '100%',
 },
 dateHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'center',
 gap: 6,
 marginTop: 2,
 },
 yearText: {
 fontSize: responsiveFontSize.lg,
 fontWeight: '800',
 color: '#FFFFFF',
 lineHeight: 20,
 },
 monthText: {
 fontSize: responsiveFontSize.base,
 fontWeight: '700',
 color: '#FFFFFF',
 textAlign: 'center',
 lineHeight: 18,
 marginTop: 2,
 },
 ageText: {
 fontSize: responsiveFontSize.sm,
 fontWeight: '700',
 color: '#FFFFFF',
 lineHeight: 16,
 marginTop: 2,
 },

 weekDots: {
 flexDirection: 'row',
 marginTop: 4,
 marginBottom: 2,
 justifyContent: 'center',
 alignItems: 'center',
 },
 // Month progress: 4 dots, one per week. Elapsed weeks are filled, the current
 // week is bright + softly glowing ("you are here"), upcoming weeks are hollow.
 weekDot: {
 width: 7,
 height: 7,
 borderRadius: 3.5,
 marginHorizontal: 2.5,
 backgroundColor: 'rgba(255,255,255,0.22)',
 },
 weekDotPast: {
 backgroundColor: 'rgba(255,255,255,0.55)',
 },
 weekDotCurrent: {
 width: 8,
 height: 8,
 borderRadius: 4,
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

 seasonalAndNextWeekContainer: {
 flexDirection:'row',
 alignItems: 'center',
 justifyContent: 'flex-end',
 gap: responsiveSpacing.sm,
 marginTop: responsiveSpacing.xs,
 },
 nextWeekContainer: { alignItems: 'center'},
 nextWeekButton: {
 alignItems:'center',
 justifyContent: 'center',
 borderRadius: responsiveBorderRadius.lg,
 width: 50, // Square button
 height: 50, // Square button
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

 statTouchable: { width: '100%'},
 statRowContent: {
 flexDirection:'row',
 alignItems: 'center',
 justifyContent: 'flex-start',
 flex: 1,
 minHeight: scale(18), // Ensure minimum height
 },
 statIconContainer: {
 flexDirection: 'row',
 alignItems: 'center',
 marginRight: responsiveSpacing.xs,
 flexShrink: 0, // Prevent icon from shrinking
 },

 // --- Vitals activity rings (health / mood / energy) ---
 vitalsRingRow: {
 flexDirection: 'row',
 alignItems: 'flex-start',
 gap: scale(16),
 marginTop: responsiveSpacing.sm,
 marginBottom: scale(2),
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

 quickActionsContainer: {
 position: 'absolute',
 top: 40,
 left: 0,
 right: 0,
 backgroundColor: 'rgba(0, 0, 0, 0.95)',
 borderRadius: responsiveBorderRadius.md,
 padding: responsiveSpacing.sm,
 zIndex: Z_INDEX.DROPDOWN,
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
 }
});
